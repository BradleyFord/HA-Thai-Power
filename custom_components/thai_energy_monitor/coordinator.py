"""DataUpdateCoordinator and mathematical processing engine for Thailand Energy & Solar Monitor.

Performs asynchronous numerical integration (Riemann sums), tariff calculation,
phantom predictive tariff comparison, BESS simulation, MEA gamification points,
monthly billing cycle auto-resets, HA Energy Dashboard compatibility, single
bidirectional net grid sensor support, Python recorder database LTS statistics querying,
billing cycle baseline subtraction for total increasing hardware meters, automatic Riemann
integration for power (W/kW) source sensors, and strict Thailand Standard Time (Asia/Bangkok)
timezone TOU peak/off-peak resolution.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import logging
import math
from typing import Any
import zoneinfo

from homeassistant.util import dt as dt_util
from homeassistant.components.recorder import get_instance
from homeassistant.components.recorder.history import get_significant_states
from homeassistant.components.recorder.statistics import statistics_during_period
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.helpers.storage import Store
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator

from .const import (
    CONF_BESS_CAPACITY_KWH,
    CONF_BESS_SOLAR_SELLBACK_ACTIVE,
    CONF_BILLING_DAY,
    CONF_ENABLE_SOLAR_SELLBACK,
    CONF_FT_RATE,
    CONF_GRID_EXPORT_SENSOR,
    CONF_GRID_IMPORT_SENSOR,
    CONF_MEA_EBILL,
    CONF_MEA_EPAYMENT,
    CONF_SOLAR_PROD_SENSOR,
    CONF_SOLAR_SELLBACK_RATE,
    CONF_TARIFF_CATEGORY,
    CONF_UTILITY_PROVIDER,
    DEFAULT_ENABLE_SOLAR_SELLBACK,
    DEFAULT_FT_RATE,
    DEFAULT_OUTAGE_COST_PER_KWH,
    DEFAULT_SOLAR_SELLBACK,
    DOMAIN,
    PROVIDER_MEA,
    TARIFF_1_1,
    TARIFF_1_1_PSO_SUBSIDY_LIMIT,
    TARIFF_1_1_SERVICE_CHARGE,
    TARIFF_1_1_TIERS,
    TARIFF_1_2,
    TARIFF_1_2_SERVICE_CHARGE,
    TARIFF_1_2_TIERS,
    TARIFF_1_3_1,
    TARIFF_1_3_1_OFFPEAK,
    TARIFF_1_3_1_PEAK,
    TARIFF_1_3_1_SERVICE_CHARGE,
    TARIFF_1_3_2,
    TARIFF_1_3_2_OFFPEAK,
    TARIFF_1_3_2_PEAK,
    TARIFF_1_3_2_SERVICE_CHARGE,
    VAT_RATE,
)

_LOGGER = logging.getLogger(__name__)

# Created once at import time (integration modules load in an executor) so the
# tz database is never read from disk on the event loop.
BKK_TZ = zoneinfo.ZoneInfo("Asia/Bangkok")


def parse_stat_datetime(start_val: Any, tz: zoneinfo.ZoneInfo) -> datetime:
    """Parse LTS statistic start value (timestamp float or datetime) into a timezone-aware datetime."""
    if isinstance(start_val, (int, float)):
        ts = start_val / 1000.0 if start_val > 1e11 else float(start_val)
        return datetime.fromtimestamp(ts, tz=tz)
    if isinstance(start_val, datetime):
        return start_val.astimezone(tz)
    return dt_util.now().astimezone(tz)


def get_stat_sort_key(stat: dict[str, Any]) -> float:
    """Extract numeric timestamp for sorting LTS statistics dictionaries chronologically."""
    start_val = stat.get("start")
    if isinstance(start_val, (int, float)):
        return float(start_val if start_val < 1e11 else start_val / 1000.0)
    if isinstance(start_val, datetime):
        return start_val.timestamp()
    return 0.0


class ThaiEnergyDataUpdateCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Coordinator to manage polling-free event updates and tariff mathematics."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        """Initialize the Thailand Energy Data Update Coordinator."""
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(minutes=10),
        )
        self.entry = entry
        self.config_data = dict(entry.data)

        # Storage Persistence Engine
        self._store = Store(hass, 1, f"thai_energy_monitor_{entry.entry_id}")

        # Source Sensor Entity IDs
        self.import_sensor_id: str = entry.data[CONF_GRID_IMPORT_SENSOR]
        self.export_sensor_id: str = entry.data.get(CONF_GRID_EXPORT_SENSOR, self.import_sensor_id)
        self.solar_sensor_id: str = entry.data[CONF_SOLAR_PROD_SENSOR]

        # Single bidirectional net grid sensor flag
        self.is_single_bidirectional_sensor: bool = (self.import_sensor_id == self.export_sensor_id)

        # Active Tariff Category
        self.active_tariff_category: str = entry.data.get(CONF_TARIFF_CATEGORY, TARIFF_1_2)

        # Thai Holiday Engine (loaded asynchronously in executor thread)
        self.th_holidays: Any | None = None

        # Billing Cycle Baselines (Raw sensor readings at 00:00 on Billing Day)
        self.import_baseline_kwh: float | None = None
        self.solar_baseline_kwh: float | None = None
        self.export_baseline_kwh: float | None = None

        # Riemann Integration tracking variables
        self._last_import_time: datetime | None = None
        self._last_solar_time: datetime | None = None
        self._last_export_time: datetime | None = None

        self._last_import_power_val: float | None = None
        self._last_solar_power_val: float | None = None
        self._last_export_power_val: float | None = None

        # Last raw sensor readings
        self._last_raw_grid_val: float | None = None
        self._last_import_val: float | None = None
        self._last_export_val: float | None = None
        self._last_solar_val: float | None = None

        # Lifetime Continuous Accumulators
        self.lifetime_import_kwh: float = 0.0
        self.lifetime_export_kwh: float = 0.0
        self.lifetime_solar_kwh: float = 0.0

        # Recorder history caching
        self._last_recorder_fetch_time: datetime | None = None
        self._cached_recorder_history: dict[str, list[float]] | None = None
        self.lifetime_solar_savings_thb: float = 0.0

        # Monthly Billing Cycle Accumulators
        self.monthly_import_kwh: float = 0.0
        self.monthly_export_kwh: float = 0.0
        self.monthly_solar_kwh: float = 0.0
        self.monthly_tou_peak_import_kwh: float = 0.0
        self.monthly_tou_offpeak_import_kwh: float = 0.0
        self.monthly_solar_savings_thb: float = 0.0

        # Today Calendar Day Baselines & Live Monotonic Accumulators
        self.today_import_baseline_kwh: float | None = None
        self.today_solar_baseline_kwh: float | None = None
        self.today_export_baseline_kwh: float | None = None
        self.today_import_kwh: float = 0.0
        self.today_solar_kwh: float = 0.0
        self.today_export_kwh: float = 0.0
        self.last_midnight_date: datetime.date | None = None

        # Last Month Archived Summary Stats
        self.last_month_bill_thb: float = 0.0
        self.last_month_import_kwh: float = 0.0

        # Date Tracking for Monthly Cycle Reset
        self.last_reset_date: datetime.date | None = None

        # Phantom Predictive Engine Accumulators
        self.phantom_tou_peak_kwh: float = 0.0
        self.phantom_tou_offpeak_kwh: float = 0.0

        # BESS Battery Simulation Accumulators
        self.bess_charged_kwh: float = 0.0
        self.bess_simulated_savings_thb: float = 0.0
        self.bess_capex_cost: float = float(entry.data.get("bess_capex_cost", 50000.0))

        # Grid Outage & Resilience Tracking
        self.is_grid_outage: bool = False
        self.outage_start_time: datetime | None = None
        self.total_outage_seconds: float = 0.0
        self.outage_count: int = 0
        self.economic_outage_loss_thb: float = 0.0
        self.outage_history: list[dict[str, Any]] = []
        self._has_seen_active_grid: bool = False

        # Tariff 1.1 >150 kWh consecutive high months tracking
        self.consecutive_high_months: int = 0

        self.lookback_12_months_data: list[dict[str, Any]] | None = None
        self.bess_12_months_data: list[dict[str, Any]] | None = None
        self._restored = False

    async def _async_load_storage(self) -> None:
        """Load persisted billing baselines and accumulators from Home Assistant storage."""
        try:
            data = await self._store.async_load()
            if data and isinstance(data, dict):
                now = dt_util.now()
                current_billing_start = self._get_billing_start_datetime(now).isoformat()
                stored_billing_start = data.get("billing_start_datetime")

                # If stored data matches current cycle, restore baselines and monthly totals
                if stored_billing_start == current_billing_start:
                    if self.import_baseline_kwh is None and data.get("import_baseline_kwh") is not None:
                        self.import_baseline_kwh = float(data["import_baseline_kwh"])
                    if self.solar_baseline_kwh is None and data.get("solar_baseline_kwh") is not None:
                        self.solar_baseline_kwh = float(data["solar_baseline_kwh"])
                    if self.export_baseline_kwh is None and data.get("export_baseline_kwh") is not None:
                        self.export_baseline_kwh = float(data["export_baseline_kwh"])

                    if data.get("monthly_import_kwh", 0) > self.monthly_import_kwh:
                        self.monthly_import_kwh = float(data["monthly_import_kwh"])
                    if data.get("monthly_solar_kwh", 0) > self.monthly_solar_kwh:
                        self.monthly_solar_kwh = float(data["monthly_solar_kwh"])
                    if data.get("monthly_export_kwh", 0) > self.monthly_export_kwh:
                        self.monthly_export_kwh = float(data["monthly_export_kwh"])

                # Restore today's live baselines if stored record is from today
                try:
                    today_str = now.astimezone(BKK_TZ).date().isoformat()
                except Exception:
                    today_str = now.date().isoformat()
                stored_today_str = data.get("today_date")

                if stored_today_str == today_str:
                    if self.today_import_baseline_kwh is None and data.get("today_import_baseline_kwh") is not None:
                        self.today_import_baseline_kwh = float(data["today_import_baseline_kwh"])
                    if self.today_solar_baseline_kwh is None and data.get("today_solar_baseline_kwh") is not None:
                        self.today_solar_baseline_kwh = float(data["today_solar_baseline_kwh"])
                    if self.today_export_baseline_kwh is None and data.get("today_export_baseline_kwh") is not None:
                        self.today_export_baseline_kwh = float(data["today_export_baseline_kwh"])

                    if data.get("today_import_kwh", 0) > self.today_import_kwh:
                        self.today_import_kwh = float(data["today_import_kwh"])
                    if data.get("today_solar_kwh", 0) > self.today_solar_kwh:
                        self.today_solar_kwh = float(data["today_solar_kwh"])
                    if data.get("today_export_kwh", 0) > self.today_export_kwh:
                        self.today_export_kwh = float(data["today_export_kwh"])

                # Always restore lifetime accumulators and archived prior stats
                if data.get("lifetime_solar_savings_thb", 0) > self.lifetime_solar_savings_thb:
                    self.lifetime_solar_savings_thb = float(data["lifetime_solar_savings_thb"])
                if data.get("lifetime_import_kwh", 0) > self.lifetime_import_kwh:
                    self.lifetime_import_kwh = float(data["lifetime_import_kwh"])
                if data.get("lifetime_solar_kwh", 0) > self.lifetime_solar_kwh:
                    self.lifetime_solar_kwh = float(data["lifetime_solar_kwh"])
                if data.get("lifetime_export_kwh", 0) > self.lifetime_export_kwh:
                    self.lifetime_export_kwh = float(data["lifetime_export_kwh"])
                if data.get("last_month_bill_thb", 0) > self.last_month_bill_thb:
                    self.last_month_bill_thb = float(data["last_month_bill_thb"])
                if data.get("last_month_import_kwh", 0) > self.last_month_import_kwh:
                    self.last_month_import_kwh = float(data["last_month_import_kwh"])

                # Restore outage tracking metrics
                if data.get("total_outage_seconds") is not None and float(data.get("total_outage_seconds", 0)) > self.total_outage_seconds:
                    self.total_outage_seconds = float(data["total_outage_seconds"])
                if data.get("outage_count") is not None and int(data.get("outage_count", 0)) > self.outage_count:
                    self.outage_count = int(data["outage_count"])
                if data.get("economic_outage_loss_thb") is not None and float(data.get("economic_outage_loss_thb", 0)) > self.economic_outage_loss_thb:
                    self.economic_outage_loss_thb = float(data["economic_outage_loss_thb"])
                if data.get("outage_history") and isinstance(data["outage_history"], list):
                    self.outage_history = list(data["outage_history"])
        except Exception as err:
            _LOGGER.debug("Could not load storage data: %s", err)

    async def _async_save_storage(self) -> None:
        """Save billing baselines and accumulators to Home Assistant storage."""
        try:
            now = dt_util.now()
            try:
                today_str = now.astimezone(BKK_TZ).date().isoformat()
            except Exception:
                today_str = now.date().isoformat()

            data = {
                "billing_start_datetime": self._get_billing_start_datetime(now).isoformat(),
                "today_date": today_str,
                "import_baseline_kwh": self.import_baseline_kwh,
                "solar_baseline_kwh": self.solar_baseline_kwh,
                "export_baseline_kwh": self.export_baseline_kwh,
                "today_import_baseline_kwh": self.today_import_baseline_kwh,
                "today_solar_baseline_kwh": self.today_solar_baseline_kwh,
                "today_export_baseline_kwh": self.today_export_baseline_kwh,
                "today_import_kwh": self.today_import_kwh,
                "today_solar_kwh": self.today_solar_kwh,
                "today_export_kwh": self.today_export_kwh,
                "monthly_import_kwh": self.monthly_import_kwh,
                "monthly_solar_kwh": self.monthly_solar_kwh,
                "monthly_export_kwh": self.monthly_export_kwh,
                "lifetime_solar_savings_thb": self.lifetime_solar_savings_thb,
                "lifetime_import_kwh": self.lifetime_import_kwh,
                "lifetime_solar_kwh": self.lifetime_solar_kwh,
                "lifetime_export_kwh": self.lifetime_export_kwh,
                "last_month_bill_thb": self.last_month_bill_thb,
                "last_month_import_kwh": self.last_month_import_kwh,
                "total_outage_seconds": self.total_outage_seconds,
                "outage_count": self.outage_count,
                "economic_outage_loss_thb": self.economic_outage_loss_thb,
                "outage_history": self.outage_history,
            }
            await self._store.async_save(data)
        except Exception as err:
            _LOGGER.debug("Could not save storage data: %s", err)

    async def async_setup_listeners(self) -> None:
        """Subscribe to source sensor state change events asynchronously."""
        source_entities = list(set([
            self.import_sensor_id,
            self.export_sensor_id,
            self.solar_sensor_id,
        ]))
        await self._async_load_storage()
        self.async_add_listener(self._async_handle_update)
        # Unsubscribe automatically when the config entry unloads/reloads
        self.entry.async_on_unload(
            async_track_state_change_event(
                self.hass, source_entities, self._async_sensor_state_listener
            )
        )
        await self.async_load_holidays()

    async def async_load_holidays(self) -> None:
        """Asynchronously load Thailand public holidays calendar in executor thread."""
        def _load():
            try:
                import holidays
                return holidays.TH()
            except Exception as err:
                _LOGGER.debug("Could not load Thailand holidays package: %s", err)
                return None

        self.th_holidays = await self.hass.async_add_executor_job(_load)

    def _get_workday_state(self) -> str | None:
        """Check Home Assistant Workday integration binary sensor state."""
        if not self.hass:
            return None

        # Check standard Workday entity IDs
        for entity_id in ("binary_sensor.workday_sensor", "binary_sensor.workday"):
            st = self.hass.states.get(entity_id)
            if st and st.state not in ("unavailable", "unknown"):
                return st.state

        # Search for any binary_sensor with 'workday' in name
        for state in self.hass.states.async_all("binary_sensor"):
            if "workday" in state.entity_id:
                if state.state not in ("unavailable", "unknown"):
                    return state.state
        return None

    @callback
    def _async_sensor_state_listener(self, event: Event) -> None:
        """Handle state change notification from any of the source energy sensors."""
        self.hass.async_create_task(self.async_refresh())

    @callback
    def _async_handle_update(self) -> None:
        """Update callback when data is refreshed."""
        pass

    def is_tou_offpeak(self, dt: datetime | float | int) -> bool:
        """Evaluate if datetime falls within TOU Off-Peak window in Thailand Standard Time.

        Uses Home Assistant Workday integration if available, falling back to calendar rules.
        """
        bkk_dt = parse_stat_datetime(dt, BKK_TZ)

        # 1. Check HA Workday Integration binary sensor (Highest Precedence)
        workday_state = self._get_workday_state()
        if workday_state is not None:
            if workday_state == "off":
                # Workday sensor is OFF -> Non-workday (weekend or public holiday) -> Always OFF-PEAK
                return True
            else:
                # Workday sensor is ON -> Workday -> Off-peak only between 22:00 and 09:00
                return bkk_dt.hour >= 22 or bkk_dt.hour < 9

        # 2. Fallback: Weekend check (Saturday=5, Sunday=6)
        if bkk_dt.weekday() in (5, 6):
            return True

        # 3. Fallback: Thailand Public Holidays calendar
        if self.th_holidays and bkk_dt.date() in self.th_holidays:
            return True

        # 4. Weekday Peak vs Off-Peak hours (09:00 - 22:00 is Peak)
        if bkk_dt.hour >= 22 or bkk_dt.hour < 9:
            return True

        return False

    @property
    def active_tiered_1_2_tiers(self) -> list[tuple[float, float, float]]:
        """Return active Tiered 1.2 rate tiers, using custom overrides if configured."""
        t1 = float(self.config_data.get("custom_tier1_rate") or 3.2484)
        t2 = float(self.config_data.get("custom_tier2_rate") or 4.2233)
        t3 = float(self.config_data.get("custom_tier3_rate") or 4.4217)
        return [(0.0, 150.0, t1), (150.0, 400.0, t2), (400.0, float("inf"), t3)]

    @property
    def active_tou_peak_rate(self) -> float:
        """Return active TOU Peak rate, using custom override if configured."""
        category = self.active_tariff_category
        default_peak = TARIFF_1_3_1_PEAK if category == TARIFF_1_3_1 else TARIFF_1_3_2_PEAK
        if self.config_data.get("custom_peak_rate") is not None:
            try:
                val = float(self.config_data["custom_peak_rate"])
                if val > 0:
                    return val
            except (ValueError, TypeError):
                pass
        return default_peak

    @property
    def active_tou_offpeak_rate(self) -> float:
        """Return active TOU Off-Peak rate, using custom override if configured."""
        category = self.active_tariff_category
        default_offpeak = TARIFF_1_3_1_OFFPEAK if category == TARIFF_1_3_1 else TARIFF_1_3_2_OFFPEAK
        if self.config_data.get("custom_offpeak_rate") is not None:
            try:
                val = float(self.config_data["custom_offpeak_rate"])
                if val > 0:
                    return val
            except (ValueError, TypeError):
                pass
        return default_offpeak

    def calculate_tiered_cost(
        self, energy_kwh: float, tiers: list[tuple[float, float, float]]
    ) -> float:
        """Compute base energy cost for progressive tiered tariffs (1.1 and 1.2)."""
        cost = 0.0
        for lower, upper, rate in tiers:
            if energy_kwh > lower:
                tier_consumption = min(energy_kwh - lower, upper - lower)
                cost += tier_consumption * rate
        return cost

    def get_marginal_rate(
        self, category: str, current_kwh: float, is_offpeak: bool
    ) -> float:
        """Determine the instantaneous marginal retail electricity rate (THB/kWh)."""
        if category == TARIFF_1_1:
            for lower, upper, rate in TARIFF_1_1_TIERS:
                if lower <= current_kwh < upper:
                    return rate
            return TARIFF_1_1_TIERS[-1][2]

        elif category == TARIFF_1_2:
            active_tiers = self.active_tiered_1_2_tiers
            for lower, upper, rate in active_tiers:
                if lower <= current_kwh < upper:
                    return rate
            return active_tiers[-1][2]

        elif category in (TARIFF_1_3_1, TARIFF_1_3_2):
            return self.active_tou_offpeak_rate if is_offpeak else self.active_tou_peak_rate

        return self.active_tiered_1_2_tiers[0][2]

    def _get_billing_start_datetime(self, now: datetime) -> datetime:
        """Calculate exact datetime for the start of the current billing cycle."""
        try:
            bkk_now = now.astimezone(BKK_TZ)
        except Exception:
            bkk_now = now

        target_day = int(self.config_data.get(CONF_BILLING_DAY, 1))

        if bkk_now.day >= target_day:
            return datetime(bkk_now.year, bkk_now.month, target_day, 0, 0, 0, tzinfo=BKK_TZ)
        else:
            prev_month = bkk_now.month - 1 if bkk_now.month > 1 else 12
            prev_year = bkk_now.year if bkk_now.month > 1 else bkk_now.year - 1
            return datetime(prev_year, prev_month, target_day, 0, 0, 0, tzinfo=BKK_TZ)

    async def _async_get_sensor_baseline(self, entity_id: str, target_dt: datetime) -> float | None:
        """Fetch historical cumulative meter reading at target_dt from HA Long-Term Statistics or recorder."""
        if not entity_id:
            return None

        # 1. Primary: Query Long-Term Statistics (LTS) for exact meter state
        def _query_lts() -> float | None:
            try:
                stats_dict = statistics_during_period(
                    self.hass,
                    start_time=target_dt - timedelta(hours=24),
                    end_time=target_dt + timedelta(hours=24),
                    statistic_ids=[entity_id],
                    period="hour",
                    units=None,
                    types={"state", "sum"},
                )
                entity_stats = stats_dict.get(entity_id, [])
                if entity_stats:

                    def _get_dt(s: dict[str, Any]) -> datetime:
                        start_val = s.get("start")
                        if isinstance(start_val, (int, float)):
                            if start_val > 1e11:
                                start_val = start_val / 1000.0
                            return datetime.fromtimestamp(start_val, tz=BKK_TZ)
                        elif isinstance(start_val, datetime):
                            return start_val.astimezone(BKK_TZ)
                        return target_dt

                    best_stat = min(entity_stats, key=lambda s: abs((_get_dt(s) - target_dt).total_seconds()))
                    stat_state = best_stat.get("state")
                    if stat_state is not None:
                        return float(stat_state)
                    stat_sum = best_stat.get("sum")
                    if stat_sum is not None:
                        return float(stat_sum)
            except Exception as err:
                _LOGGER.debug("Could not query LTS baseline for %s: %s", entity_id, err)
            return None

        try:
            lts_res = await get_instance(self.hass).async_add_executor_job(_query_lts)
            if lts_res is not None:
                return lts_res
        except Exception:
            pass

        # 2. Fallback: Query significant states from short-term recorder if LTS is not yet populated
        def _query_states():
            try:
                states = get_significant_states(
                    self.hass,
                    start_time=target_dt - timedelta(hours=48),
                    end_time=target_dt + timedelta(hours=48),
                    entity_ids=[entity_id],
                    significant_changes_only=False,
                )
                if entity_id in states and states[entity_id]:
                    best_state = min(
                        states[entity_id],
                        key=lambda s: abs((s.last_updated - target_dt).total_seconds())
                    )
                    st_val = best_state.state
                    if st_val not in ("unavailable", "unknown"):
                        return float(st_val)
            except Exception as err:
                _LOGGER.debug("Could not fetch historical baseline state for %s: %s", entity_id, err)
            return None

        try:
            return await get_instance(self.hass).async_add_executor_job(_query_states)
        except Exception:
            return None

    async def _async_populate_last_month_stats(self, now: datetime) -> None:
        """Populate previous month's bill and volume from HA recorder if uninitialized."""
        if self.last_month_import_kwh > 0.0 and self.last_month_bill_thb > 0.0:
            return

        if not self.import_sensor_id:
            return

        billing_start_dt = self._get_billing_start_datetime(now)
        prev_billing_start_dt = self._get_billing_start_datetime(billing_start_dt - timedelta(days=1))

        base_prev = await self._async_get_sensor_baseline(self.import_sensor_id, prev_billing_start_dt)
        base_curr = await self._async_get_sensor_baseline(self.import_sensor_id, billing_start_dt)

        if base_prev is not None and base_curr is not None and base_curr > base_prev:
            prev_import = base_curr - base_prev
            category = self.active_tariff_category
            ft_rate = float(self.config_data.get(CONF_FT_RATE, DEFAULT_FT_RATE))

            if category == TARIFF_1_1:
                service_charge = TARIFF_1_1_SERVICE_CHARGE
                base_cost = (
                    self.calculate_tiered_cost(prev_import, TARIFF_1_1_TIERS)
                    if prev_import > TARIFF_1_1_PSO_SUBSIDY_LIMIT
                    else 0.0
                )
            elif category == TARIFF_1_2:
                service_charge = TARIFF_1_2_SERVICE_CHARGE
                base_cost = self.calculate_tiered_cost(prev_import, self.active_tiered_1_2_tiers)
            elif category in (TARIFF_1_3_1, TARIFF_1_3_2):
                service_charge = (
                    TARIFF_1_3_1_SERVICE_CHARGE if category == TARIFF_1_3_1 else TARIFF_1_3_2_SERVICE_CHARGE
                )
                peak_ratio = 0.20 if self.monthly_solar_kwh > 5.0 else 0.40
                base_cost = (
                    (prev_import * peak_ratio) * self.active_tou_peak_rate
                ) + ((prev_import * (1.0 - peak_ratio)) * self.active_tou_offpeak_rate)
            else:
                service_charge = 24.62
                base_cost = prev_import * 4.4217

            ft_charge = prev_import * ft_rate
            subtotal = base_cost + service_charge + ft_charge
            prev_bill = subtotal * (1.0 + VAT_RATE)

            self.last_month_import_kwh = prev_import
            self.last_month_bill_thb = prev_bill

    def _check_monthly_reset(self, now: datetime) -> None:
        """Check if today matches the user's billing cycle start day and reset accumulators."""
        target_billing_day = int(self.config_data.get(CONF_BILLING_DAY, 1))
        
        try:
            today = now.astimezone(BKK_TZ).date()
        except Exception:
            today = now.date()

        if self.last_reset_date is None:
            self.last_reset_date = today
            return

        if today.day == target_billing_day and today != self.last_reset_date:
            _LOGGER.info("Executing monthly billing cycle reset on day %d", target_billing_day)
            
            if self.data:
                self.last_month_bill_thb = self.data.get("monthly_estimated_bill", 0.0)
            self.last_month_import_kwh = self.monthly_import_kwh

            self.import_baseline_kwh = self._last_import_val
            self.solar_baseline_kwh = self._last_solar_val
            self.export_baseline_kwh = self._last_export_val

            self.monthly_import_kwh = 0.0
            self.monthly_export_kwh = 0.0
            self.monthly_solar_kwh = 0.0
            self.monthly_tou_peak_import_kwh = 0.0
            self.monthly_tou_offpeak_import_kwh = 0.0
            self.monthly_solar_savings_thb = 0.0
            self.phantom_tou_peak_kwh = 0.0
            self.phantom_tou_offpeak_kwh = 0.0
            self.last_reset_date = today

    def _get_today_start_datetime(self, now: datetime) -> datetime:
        """Return datetime representing start of the current calendar day in Bangkok time."""
        try:
            bkk_now = now.astimezone(BKK_TZ)
        except Exception:
            bkk_now = now
        return datetime(bkk_now.year, bkk_now.month, bkk_now.day, 0, 0, 0, tzinfo=BKK_TZ)

    def _check_midnight_reset(
        self,
        now: datetime,
        curr_import: float,
        curr_solar: float,
        curr_export: float
    ) -> None:
        """Check for daily midnight transition and reset today live accumulators."""
        try:
            today = now.astimezone(BKK_TZ).date()
        except Exception:
            today = now.date()

        if self.last_midnight_date is None:
            self.last_midnight_date = today
            return

        if today != self.last_midnight_date:
            _LOGGER.info("Executing daily midnight reset for Bangkok date %s", today)
            self.today_import_baseline_kwh = curr_import if curr_import > 0.0 else None
            self.today_solar_baseline_kwh = curr_solar if curr_solar > 0.0 else None
            self.today_export_baseline_kwh = curr_export if curr_export > 0.0 else None
            self.today_import_kwh = 0.0
            self.today_solar_kwh = 0.0
            self.today_export_kwh = 0.0
            self.last_midnight_date = today

    def get_billing_cycle_day(self, now_dt: datetime) -> int:
        """Calculate the current day of the monthly billing cycle (1-30)."""
        try:
            billing_day = int(self.config_data.get(CONF_BILLING_DAY, 1))
        except (ValueError, TypeError):
            billing_day = 1

        try:
            local_now = now_dt.astimezone(BKK_TZ)
        except Exception:
            local_now = now_dt

        if local_now.day >= billing_day:
            cycle_start = local_now.replace(day=billing_day, hour=0, minute=0, second=0, microsecond=0)
        else:
            first_of_this_month = local_now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            last_day_of_prev_month = first_of_this_month - timedelta(days=1)
            target_day = min(billing_day, last_day_of_prev_month.day)
            cycle_start = last_day_of_prev_month.replace(day=target_day, hour=0, minute=0, second=0, microsecond=0)

        days_elapsed = (local_now.date() - cycle_start.date()).days + 1
        return min(30, max(1, days_elapsed))

    def calculate_bess_daily_savings(
        self,
        day_date: datetime.date,
        export_kwh: float,
        import_kwh: float,
        bess_capacity: float,
        bess_efficiency: float,
        sellback_rate: float,
        peak_rate: float,
        offpeak_rate: float,
        ft_rate: float,
        grid_charging: bool,
        tariff_model: str
    ) -> float:
        """Calculate BESS net savings for a single day based on charging strategy and TOU windows.

        This considers weekends, holidays, grid top-up costs during Off-Peak, and retail
        arbitrage differentials during Peak periods, supporting both normal tiered and TOU models.
        """
        # Check if day is weekend (Saturday=5, Sunday=6)
        is_weekend = day_date.weekday() in (5, 6)

        # Determine if it's off-peak all day
        is_offpeak_all_day = is_weekend
        if not is_offpeak_all_day and self.th_holidays:
            try:
                is_offpeak_all_day = day_date in self.th_holidays
            except Exception:
                is_offpeak_all_day = False

        vat_mult = 1.07

        # Rates including Ft & VAT
        if tariff_model == "normal":
            # Normal Tiered Tariff: flat rate (using 4.4217 as standard flat rate)
            flat_rate = 4.4217
            retail_cost_kwh = (flat_rate + ft_rate) * vat_mult

            # Solar charging only (grid charging makes no financial sense for flat rates)
            solar_charged = min(export_kwh, bess_capacity)
            discharged = solar_charged * bess_efficiency
            charge_cost = solar_charged * sellback_rate
            benefit = discharged * retail_cost_kwh
            return max(0.0, benefit - charge_cost)
        else:
            # TOU Tariff model
            peak_cost_kwh = (peak_rate + ft_rate) * vat_mult
            offpeak_cost_kwh = (offpeak_rate + ft_rate) * vat_mult

            if grid_charging:
                if is_offpeak_all_day:
                    # No arbitrage benefit on off-peak days because peak_rate == offpeak_rate.
                    # Just charge from solar surplus and discharge during off-peak to save opportunity cost.
                    solar_charged = min(export_kwh, bess_capacity)
                    discharged = solar_charged * bess_efficiency
                    charge_cost = solar_charged * sellback_rate
                    benefit = discharged * offpeak_cost_kwh
                    return max(0.0, benefit - charge_cost)
                else:
                    # Weekdays: charge to full capacity
                    solar_charged = min(export_kwh, bess_capacity)
                    grid_charged = max(0.0, bess_capacity - solar_charged)

                    charge_cost = (solar_charged * sellback_rate) + (grid_charged * offpeak_cost_kwh)
                    discharged = bess_capacity * bess_efficiency

                    # Check if household Peak import consumption limit is respected
                    # Assume peak consumption is 40% of daily import
                    peak_consumption = import_kwh * 0.40
                    actual_discharge = min(discharged, peak_consumption) if import_kwh > 0 else discharged

                    benefit = actual_discharge * peak_cost_kwh
                    return max(0.0, benefit - charge_cost)
            else:
                # Pure Solar Charging (no grid charging)
                solar_charged = min(export_kwh, bess_capacity)
                discharged = solar_charged * bess_efficiency
                charge_cost = solar_charged * sellback_rate

                if is_offpeak_all_day:
                    benefit = discharged * offpeak_cost_kwh
                else:
                    benefit = discharged * peak_cost_kwh

                return max(0.0, benefit - charge_cost)

    async def _async_fetch_recorder_history(
        self,
        now: datetime,
        today_import_live: float,
        today_solar_live: float,
        today_export_live: float
    ) -> dict[str, list[float]]:
        """Query actual daily states directly from Home Assistant recorder database for source sensors."""
        current_day = max(1, self.get_billing_cycle_day(now))
        today_idx = current_day - 1

        if (
            self._last_recorder_fetch_time is not None
            and self._cached_recorder_history is not None
            and (now - self._last_recorder_fetch_time).total_seconds() < 900
            and self.monthly_import_kwh > 0.0
        ):
            # Dynamically update today's live slot on every poll even when past LTS history is cached
            if 0 <= today_idx < 30:
                self._cached_recorder_history["daily_import_kwh_history"][today_idx] = round(today_import_live, 3)
                self._cached_recorder_history["daily_solar_kwh_history"][today_idx] = round(today_solar_live, 3)
                self._cached_recorder_history["daily_export_kwh_history"][today_idx] = round(
                    min(today_export_live, today_solar_live), 3
                )
            return self._cached_recorder_history

        try:
            bkk_now = now.astimezone(BKK_TZ)
        except Exception:
            bkk_now = now

        start_dt = self._get_billing_start_datetime(now)
        today_start_dt = datetime(bkk_now.year, bkk_now.month, bkk_now.day, 0, 0, 0, tzinfo=BKK_TZ)
        end_dt = now

        elapsed_sec = max(60.0, (now - start_dt).total_seconds())
        elapsed_days_fraction = max(0.04, elapsed_sec / 86400.0)

        stat_ids = [sid for sid in (self.import_sensor_id, self.solar_sensor_id, self.export_sensor_id) if sid]

        # Query permanent Long-Term Statistics (LTS) with hourly granularity across the billing cycle
        def _fetch_hourly_lts_stats() -> dict[str, list[dict[str, Any]]]:
            try:
                return statistics_during_period(
                    self.hass,
                    start_time=start_dt - timedelta(hours=1),
                    end_time=end_dt + timedelta(hours=1),
                    statistic_ids=stat_ids,
                    period="hour",
                    units=None,
                    types={"change", "state", "sum"},
                )
            except Exception as err:
                _LOGGER.debug("Could not query hourly LTS statistics in executor: %s", err)
                return {}

        stats_dict: dict[str, list[dict[str, Any]]] = {}
        try:
            stats_dict = await get_instance(self.hass).async_add_executor_job(_fetch_hourly_lts_stats)
        except Exception as err:
            _LOGGER.debug("Executor error fetching LTS hourly stats: %s", err)

        # Index hourly statistics for each sensor by datetime (hour resolution)
        def index_hourly_stats(entity_id: str) -> dict[datetime, float]:
            res: dict[datetime, float] = {}
            for stat in stats_dict.get(entity_id, []) if stats_dict else []:
                start_val = stat.get("start")
                if isinstance(start_val, (int, float)):
                    if start_val > 1e11:
                        start_val = start_val / 1000.0
                    stat_dt = datetime.fromtimestamp(start_val, tz=BKK_TZ)
                elif isinstance(start_val, datetime):
                    stat_dt = start_val.astimezone(BKK_TZ)
                else:
                    continue
                stat_dt_hour = stat_dt.replace(minute=0, second=0, microsecond=0)
                change_val = stat.get("change")
                if change_val is not None and change_val >= 0.0:
                    res[stat_dt_hour] = float(change_val)
            return res

        import_hourly = index_hourly_stats(self.import_sensor_id)
        solar_hourly = index_hourly_stats(self.solar_sensor_id)
        export_hourly = index_hourly_stats(self.export_sensor_id)

        # 1. Deterministic Hourly Classification for Past Completed Days (start_dt to today_start_dt)
        past_peak_import_kwh = 0.0
        past_offpeak_import_kwh = 0.0
        past_peak_base_cost_thb = 0.0
        past_offpeak_base_cost_thb = 0.0
        past_solar_savings_thb = 0.0

        daily_import_sums: dict[str, float] = {}
        daily_solar_sums: dict[str, float] = {}
        daily_export_sums: dict[str, float] = {}

        all_hours = sorted(set(list(import_hourly.keys()) + list(solar_hourly.keys()) + list(export_hourly.keys())))

        for h_dt in all_hours:
            if h_dt < start_dt or h_dt >= today_start_dt:
                continue

            h_date_str = h_dt.strftime("%Y-%m-%d")
            h_hour = h_dt.hour
            h_is_weekday = h_dt.weekday() < 5
            h_is_holiday = bool(self.th_holidays and h_dt.date() in self.th_holidays)
            is_peak = h_is_weekday and not h_is_holiday and (9 <= h_hour < 22)

            imp_kwh = import_hourly.get(h_dt, 0.0)
            sol_kwh = solar_hourly.get(h_dt, 0.0)
            exp_kwh = export_hourly.get(h_dt, 0.0)
            self_kwh = max(0.0, sol_kwh - exp_kwh)

            daily_import_sums[h_date_str] = daily_import_sums.get(h_date_str, 0.0) + imp_kwh
            daily_solar_sums[h_date_str] = daily_solar_sums.get(h_date_str, 0.0) + sol_kwh
            daily_export_sums[h_date_str] = daily_export_sums.get(h_date_str, 0.0) + exp_kwh

            if is_peak:
                past_peak_import_kwh += imp_kwh
                past_peak_base_cost_thb += imp_kwh * self.active_tou_peak_rate
                past_solar_savings_thb += self_kwh * self.active_tou_peak_rate
            else:
                past_offpeak_import_kwh += imp_kwh
                past_offpeak_base_cost_thb += imp_kwh * self.active_tou_offpeak_rate
                past_solar_savings_thb += self_kwh * self.active_tou_offpeak_rate

        # Build 30-day arrays for charts (completed past days, today, projected future days)
        def build_daily_series(
            daily_sums: dict[str, float],
            today_live_val: float,
            total_monthly: float
        ) -> list[float]:
            avg_run_rate = total_monthly / elapsed_days_fraction if elapsed_days_fraction > 0 else 0.0
            daily_values: list[float] = []
            missing_indices: list[int] = []

            for idx in range(current_day - 1):
                day_date = (start_dt + timedelta(days=idx)).date()
                date_key = day_date.strftime("%Y-%m-%d")
                if date_key in daily_sums:
                    daily_values.append(round(daily_sums[date_key], 3))
                else:
                    daily_values.append(-1.0)
                    missing_indices.append(idx)

            target_past_total = max(0.0, total_monthly - today_live_val)
            known_past_sum = sum(v for v in daily_values if v >= 0.0)

            if missing_indices:
                remaining_for_missing = max(0.0, target_past_total - known_past_sum)
                fallback_val = remaining_for_missing / len(missing_indices)
                for idx in missing_indices:
                    daily_values[idx] = round(fallback_val, 3)
            elif known_past_sum > 0.0 and abs(known_past_sum - target_past_total) > 0.01:
                scale_factor = target_past_total / known_past_sum
                for idx in range(len(daily_values)):
                    daily_values[idx] = round(daily_values[idx] * scale_factor, 3)

            # Today live value
            daily_values.append(round(today_live_val, 3))

            # Future days projection
            for idx in range(current_day, 30):
                daily_values.append(round(avg_run_rate, 3))

            return daily_values

        daily_import = build_daily_series(daily_import_sums, today_import_live, self.monthly_import_kwh)
        daily_solar = build_daily_series(daily_solar_sums, today_solar_live, self.monthly_solar_kwh)
        daily_export = build_daily_series(daily_export_sums, today_export_live, self.monthly_export_kwh)

        # Scale past peak/off-peak and solar savings if total monthly import conservation factor applies
        past_import_sum = past_peak_import_kwh + past_offpeak_import_kwh
        target_past_import = max(0.0, self.monthly_import_kwh - today_import_live)
        if past_import_sum > 0.0 and abs(past_import_sum - target_past_import) > 0.01:
            imp_scale = target_past_import / past_import_sum
            past_peak_import_kwh *= imp_scale
            past_offpeak_import_kwh *= imp_scale
            past_peak_base_cost_thb *= imp_scale
            past_offpeak_base_cost_thb *= imp_scale

        past_solar_sum = sum(daily_solar[:current_day - 1]) if current_day > 1 else 0.0
        target_past_solar = max(0.0, self.monthly_solar_kwh - today_solar_live)
        if past_solar_sum > 0.0 and abs(past_solar_sum - target_past_solar) > 0.01:
            sol_scale = target_past_solar / past_solar_sum
            past_solar_savings_thb *= sol_scale

        res_data = {
            "daily_import_kwh_history": daily_import,
            "daily_solar_kwh_history": daily_solar,
            "daily_export_kwh_history": daily_export,
            "past_peak_import_kwh": past_peak_import_kwh,
            "past_offpeak_import_kwh": past_offpeak_import_kwh,
            "past_peak_base_cost_thb": past_peak_base_cost_thb,
            "past_offpeak_base_cost_thb": past_offpeak_base_cost_thb,
            "past_solar_savings_thb": past_solar_savings_thb,
        }
        if self.monthly_import_kwh > 0.0:
            self._cached_recorder_history = res_data
            self._last_recorder_fetch_time = now
        return res_data

    def _is_power_sensor(self, entity_id: str, state_obj: Any) -> bool:
        """Check if a sensor represents instantaneous power (W/kW) rather than energy (kWh)."""
        if not state_obj:
            return False
        
        # Check unit of measurement first (highest precedence)
        unit = state_obj.attributes.get("unit_of_measurement")
        if unit:
            unit_upper = unit.upper()
            if "KWH" in unit_upper or "WH" in unit_upper:
                return False
            if unit_upper in ("W", "KW", "MW"):
                return True

        # Check device class second
        device_class = state_obj.attributes.get("device_class")
        if device_class:
            if device_class == "energy":
                return False
            if device_class == "power":
                return True

        # Last resort: entity name analysis
        id_lower = entity_id.lower()
        if "kwh" in id_lower or "energy" in id_lower or "consumption" in id_lower or "yield" in id_lower:
            return False
        if "power" in id_lower or "active_power" in id_lower:
            return True
            
        return False

    def _restore_accumulators(self) -> None:
        """Helper to restore coordinator accumulators from entity states on reboot."""
        if self._restored:
            return

        def _restore_key(key_str):
            for entity_id in self.hass.states.async_entity_ids("sensor"):
                if key_str in entity_id and "thailand_energy" in entity_id:
                    st = self.hass.states.get(entity_id)
                    if st and st.state not in ("unavailable", "unknown"):
                        try:
                            return float(st.state)
                        except ValueError:
                            pass
            return 0.0

        restored_import = _restore_key("monthly_import_kwh") or _restore_key("monthly_grid_import_energy")
        restored_solar = _restore_key("monthly_solar_kwh") or _restore_key("monthly_solar_production_energy")
        restored_export = _restore_key("monthly_export_kwh") or _restore_key("monthly_grid_export_energy")

        if restored_import > 0:
            self.monthly_import_kwh = restored_import
        if restored_solar > 0:
            self.monthly_solar_kwh = restored_solar
        if restored_export > 0:
            self.monthly_export_kwh = restored_export

        self._restored = True

    async def _async_update_data(self) -> dict[str, Any]:
        """Process incoming sensor states, baseline subtraction, and tariff engine."""
        now = dt_util.now()
        is_offpeak = self.is_tou_offpeak(now)

        self._check_monthly_reset(now)
        self._restore_accumulators()

        import_state = self.hass.states.get(self.import_sensor_id)
        export_state = self.hass.states.get(self.export_sensor_id) if not self.is_single_bidirectional_sensor else import_state
        solar_state = self.hass.states.get(self.solar_sensor_id)

        # Grid Outage & Resilience Tracking:
        # Protect against false outages during Home Assistant restart / integration boot.
        # An outage is only logged if Home Assistant is fully running (hass.is_running is True)
        # and the grid sensor was previously active and online.
        if import_state is not None and import_state.state not in ("unavailable", "unknown"):
            self._has_seen_active_grid = True

        if import_state is None or import_state.state in ("unavailable", "unknown"):
            if self.hass.is_running and self._has_seen_active_grid:
                if not self.is_grid_outage:
                    self.is_grid_outage = True
                    self.outage_start_time = now
                    self.outage_count += 1
        else:
            if self.is_grid_outage:
                self.is_grid_outage = False
                if self.outage_start_time:
                    duration = (now - self.outage_start_time).total_seconds()
                    # Only record genuine power outages (lasting 10 seconds or longer)
                    if duration >= 10.0:
                        self.total_outage_seconds += duration

                        local_start = self.outage_start_time.astimezone(BKK_TZ)
                        local_end = now.astimezone(BKK_TZ)

                        mins = int(duration // 60)
                        secs = int(duration % 60)
                        duration_str = f"{mins}m {secs}s" if mins > 0 else f"{secs}s"
                        if mins >= 60:
                            hrs = mins // 60
                            mins = mins % 60
                            duration_str = f"{hrs}h {mins}m"

                        self.outage_history.append({
                            "start": local_start.strftime("%Y-%m-%d %H:%M:%S"),
                            "end": local_end.strftime("%Y-%m-%d %H:%M:%S"),
                            "duration": duration_str,
                            "duration_seconds": round(duration, 1),
                        })
                        self.outage_history = self.outage_history[-50:]
                    else:
                        # Revert outage count increment for transient blip < 10s
                        self.outage_count = max(0, self.outage_count - 1)
                    self.outage_start_time = None

        # Outage tracking operates strictly on live grid state changes (no mock fallbacks)

        try:
            curr_import = float(import_state.state) if import_state and import_state.state not in ("unavailable", "unknown") else 0.0
        except (ValueError, TypeError):
            curr_import = 0.0

        try:
            curr_export = float(export_state.state) if export_state and export_state.state not in ("unavailable", "unknown") else 0.0
        except (ValueError, TypeError):
            curr_export = 0.0

        try:
            curr_solar = float(solar_state.state) if solar_state and solar_state.state not in ("unavailable", "unknown") else 0.0
        except (ValueError, TypeError):
            curr_solar = 0.0

        try:
            bkk_now = now.astimezone(BKK_TZ)
        except Exception:
            bkk_now = now
        
        current_day = self.get_billing_cycle_day(now)
        await self._async_populate_last_month_stats(now)
        self._check_midnight_reset(now, curr_import, curr_solar, curr_export)

        # --- RIEMANN INTEGRATION ENGINE FOR POWER SENSORS (kW/W) ---
        is_import_power = self._is_power_sensor(self.import_sensor_id, import_state)
        is_solar_power = self._is_power_sensor(self.solar_sensor_id, solar_state)
        is_export_power = self._is_power_sensor(self.export_sensor_id, export_state)

        today_start_dt = self._get_today_start_datetime(now)

        # Import Riemann Sum Integration or Baseline Subtraction
        if is_import_power:
            if self._last_import_time is not None:
                elapsed = (now - self._last_import_time).total_seconds()
                if elapsed > 0:
                    power_w = self._last_import_power_val if self._last_import_power_val is not None else curr_import
                    # Check unit: if it's W, convert to kW by dividing by 1000
                    unit = import_state.attributes.get("unit_of_measurement") if import_state else "W"
                    power_kw = (power_w / 1000.0) if unit == "W" else power_w
                    delta_kwh = (power_kw * elapsed) / 3600.0
                    self.monthly_import_kwh += delta_kwh
                    self.today_import_kwh += delta_kwh
                    self.lifetime_import_kwh += delta_kwh
            self._last_import_time = now
            self._last_import_power_val = curr_import
        else:
            # Baseline Subtraction for Energy Sensors
            billing_start_dt = self._get_billing_start_datetime(now)
            current_cycle_day = max(1, self.get_billing_cycle_day(now))
            if (self.import_baseline_kwh is None or self._last_recorder_fetch_time is None) and curr_import > 0.0:
                fetched_base = await self._async_get_sensor_baseline(self.import_sensor_id, billing_start_dt)
                if fetched_base is not None and 0.0 < fetched_base <= curr_import:
                    self.import_baseline_kwh = fetched_base
                elif self.import_baseline_kwh is None:
                    if self.monthly_import_kwh > 0.0 and curr_import > self.monthly_import_kwh:
                        self.import_baseline_kwh = curr_import - self.monthly_import_kwh
                    elif current_cycle_day == 1:
                        self.import_baseline_kwh = curr_import
                    else:
                        self.import_baseline_kwh = max(0.0, curr_import - self.monthly_import_kwh)

            if curr_import >= (self.import_baseline_kwh or 0.0) and (self.import_baseline_kwh or 0.0) > 0.0:
                self.monthly_import_kwh = curr_import - (self.import_baseline_kwh or 0.0)
            elif self.monthly_import_kwh > 0.0:
                pass
            else:
                self.monthly_import_kwh = 0.0

            # Today Direct Baseline Subtraction
            if self.today_import_baseline_kwh is None and curr_import > 0.0:
                fetched_today_import = await self._async_get_sensor_baseline(self.import_sensor_id, today_start_dt)
                if fetched_today_import is not None and 0.0 < fetched_today_import <= curr_import:
                    self.today_import_baseline_kwh = fetched_today_import
                elif current_cycle_day == 1 and self.import_baseline_kwh is not None:
                    self.today_import_baseline_kwh = self.import_baseline_kwh
                else:
                    self.today_import_baseline_kwh = curr_import

            if curr_import >= (self.today_import_baseline_kwh or 0.0) and (self.today_import_baseline_kwh or 0.0) > 0.0:
                self.today_import_kwh = curr_import - (self.today_import_baseline_kwh or 0.0)
            else:
                self.today_import_kwh = 0.0

        # Solar Riemann Sum Integration or Baseline Subtraction
        if is_solar_power:
            if self._last_solar_time is not None:
                elapsed = (now - self._last_solar_time).total_seconds()
                if elapsed > 0:
                    power_w = self._last_solar_power_val if self._last_solar_power_val is not None else curr_solar
                    unit = solar_state.attributes.get("unit_of_measurement") if solar_state else "W"
                    power_kw = (power_w / 1000.0) if unit == "W" else power_w
                    delta_kwh = (power_kw * elapsed) / 3600.0
                    self.monthly_solar_kwh += delta_kwh
                    self.today_solar_kwh += delta_kwh
                    self.lifetime_solar_kwh += delta_kwh
            self._last_solar_time = now
            self._last_solar_power_val = curr_solar
        else:
            # Baseline Subtraction for Energy Sensors
            billing_start_dt = self._get_billing_start_datetime(now)
            current_cycle_day = max(1, self.get_billing_cycle_day(now))
            if (self.solar_baseline_kwh is None or self._last_recorder_fetch_time is None) and curr_solar > 0.0:
                fetched_solar = await self._async_get_sensor_baseline(self.solar_sensor_id, billing_start_dt)
                if fetched_solar is not None and 0.0 < fetched_solar <= curr_solar:
                    self.solar_baseline_kwh = fetched_solar
                elif self.solar_baseline_kwh is None:
                    if self.monthly_solar_kwh > 0.0 and curr_solar > self.monthly_solar_kwh:
                        self.solar_baseline_kwh = curr_solar - self.monthly_solar_kwh
                    elif current_cycle_day == 1:
                        self.solar_baseline_kwh = curr_solar
                    else:
                        self.solar_baseline_kwh = max(0.0, curr_solar - self.monthly_solar_kwh)

            if curr_solar >= (self.solar_baseline_kwh or 0.0) and (self.solar_baseline_kwh or 0.0) > 0.0:
                self.monthly_solar_kwh = curr_solar - (self.solar_baseline_kwh or 0.0)
            elif self.monthly_solar_kwh > 0.0:
                pass
            else:
                self.monthly_solar_kwh = 0.0

            # Today Direct Baseline Subtraction
            if self.today_solar_baseline_kwh is None and curr_solar > 0.0:
                fetched_today_solar = await self._async_get_sensor_baseline(self.solar_sensor_id, today_start_dt)
                if fetched_today_solar is not None and 0.0 < fetched_today_solar <= curr_solar:
                    self.today_solar_baseline_kwh = fetched_today_solar
                elif current_cycle_day == 1 and self.solar_baseline_kwh is not None:
                    self.today_solar_baseline_kwh = self.solar_baseline_kwh
                else:
                    self.today_solar_baseline_kwh = curr_solar

            if curr_solar >= (self.today_solar_baseline_kwh or 0.0) and (self.today_solar_baseline_kwh or 0.0) > 0.0:
                self.today_solar_kwh = curr_solar - (self.today_solar_baseline_kwh or 0.0)
            else:
                self.today_solar_kwh = 0.0

        # Export Riemann Sum Integration or Baseline Subtraction
        if is_export_power:
            if self._last_export_time is not None:
                elapsed = (now - self._last_export_time).total_seconds()
                if elapsed > 0:
                    power_w = self._last_export_power_val if self._last_export_power_val is not None else curr_export
                    unit = export_state.attributes.get("unit_of_measurement") if export_state else "W"
                    power_kw = (power_w / 1000.0) if unit == "W" else power_w
                    delta_kwh = (power_kw * elapsed) / 3600.0
                    self.monthly_export_kwh += delta_kwh
                    self.today_export_kwh += delta_kwh
                    self.lifetime_export_kwh += delta_kwh
            self._last_export_time = now
            self._last_export_power_val = curr_export
        else:
            # Baseline Subtraction for Energy Sensors
            billing_start_dt = self._get_billing_start_datetime(now)
            current_cycle_day = max(1, self.get_billing_cycle_day(now))
            if (self.export_baseline_kwh is None or self._last_recorder_fetch_time is None) and curr_export > 0.0:
                fetched_export = await self._async_get_sensor_baseline(self.export_sensor_id, billing_start_dt)
                if fetched_export is not None and 0.0 < fetched_export <= curr_export:
                    self.export_baseline_kwh = fetched_export
                elif self.export_baseline_kwh is None:
                    if self.monthly_export_kwh > 0.0 and curr_export > self.monthly_export_kwh:
                        self.export_baseline_kwh = curr_export - self.monthly_export_kwh
                    elif current_cycle_day == 1:
                        self.export_baseline_kwh = curr_export
                    else:
                        self.export_baseline_kwh = max(0.0, curr_export - self.monthly_export_kwh)

            if curr_export >= (self.export_baseline_kwh or 0.0) and (self.export_baseline_kwh or 0.0) > 0.0:
                self.monthly_export_kwh = curr_export - (self.export_baseline_kwh or 0.0)
            elif self.monthly_export_kwh > 0.0:
                pass
            else:
                self.monthly_export_kwh = 0.0

            # Today Direct Baseline Subtraction
            if self.today_export_baseline_kwh is None and curr_export > 0.0:
                fetched_today_export = await self._async_get_sensor_baseline(self.export_sensor_id, today_start_dt)
                if fetched_today_export is not None and 0.0 < fetched_today_export <= curr_export:
                    self.today_export_baseline_kwh = fetched_today_export
                elif current_cycle_day == 1 and self.export_baseline_kwh is not None:
                    self.today_export_baseline_kwh = self.export_baseline_kwh
                else:
                    self.today_export_baseline_kwh = curr_export

            if curr_export >= (self.today_export_baseline_kwh or 0.0) and (self.today_export_baseline_kwh or 0.0) > 0.0:
                self.today_export_kwh = curr_export - (self.today_export_baseline_kwh or 0.0)
            else:
                self.today_export_kwh = 0.0

        if not is_import_power:
            self.lifetime_import_kwh = curr_import
        if not is_export_power:
            self.lifetime_export_kwh = curr_export
        if not is_solar_power:
            self.lifetime_solar_kwh = curr_solar

        # Split peak/off-peak consumption
        self.monthly_tou_offpeak_import_kwh = self.monthly_import_kwh * 0.60
        self.monthly_tou_peak_import_kwh = self.monthly_import_kwh * 0.40

        self.phantom_tou_offpeak_kwh = self.monthly_tou_offpeak_import_kwh
        self.phantom_tou_peak_kwh = self.monthly_tou_peak_import_kwh

        curr_self_consumption = max(0.0, self.monthly_solar_kwh - self.monthly_export_kwh)
        
        category = self.active_tariff_category
        marginal_rate = self.get_marginal_rate(category, self.monthly_import_kwh, is_offpeak)
        ft_rate = float(self.config_data.get(CONF_FT_RATE, DEFAULT_FT_RATE))
        
        current_grid_price = marginal_rate + ft_rate

        self.monthly_solar_savings_thb = curr_self_consumption * marginal_rate

        lifetime_self_consumption = max(0.0, self.lifetime_solar_kwh - self.lifetime_export_kwh)
        if category in (TARIFF_1_3_1, TARIFF_1_3_2):
            lifetime_savings_rate = (0.70 * self.active_tou_peak_rate) + (0.30 * self.active_tou_offpeak_rate)
        else:
            lifetime_savings_rate = marginal_rate

        self.lifetime_solar_savings_thb = lifetime_self_consumption * lifetime_savings_rate

        enable_solar_sellback = bool(self.config_data.get(CONF_ENABLE_SOLAR_SELLBACK, DEFAULT_ENABLE_SOLAR_SELLBACK))
        configured_sellback_rate = float(self.config_data.get(CONF_SOLAR_SELLBACK_RATE, DEFAULT_SOLAR_SELLBACK))
        sellback_rate = configured_sellback_rate if enable_solar_sellback else 0.0

        monthly_solar_revenue_thb = self.monthly_export_kwh * sellback_rate
        monthly_total_solar_benefit_thb = self.monthly_solar_savings_thb + monthly_solar_revenue_thb

        lifetime_solar_revenue_thb = self.lifetime_export_kwh * sellback_rate
        lifetime_total_solar_benefit_thb = self.lifetime_solar_savings_thb + lifetime_solar_revenue_thb

        # 1. Fetch 30-day historical hourly LTS arrays and past deterministic totals from Home Assistant recorder
        recorder_history = await self._async_fetch_recorder_history(
            now,
            self.today_import_kwh,
            self.today_solar_kwh,
            self.today_export_kwh
        )

        # Real-time BESS battery shifting simulation
        bess_capacity = float(self.config_data.get(CONF_BESS_CAPACITY_KWH, 5.0))
        bess_efficiency = 0.90
        grid_charging = bool(self.config_data.get("bess_grid_charging", False))
        tariff_model = self.config_data.get("bess_tariff_model", "tou")
        bess_solar_sellback_active = bool(
            self.config_data.get(
                CONF_BESS_SOLAR_SELLBACK_ACTIVE,
                self.config_data.get("bess_solar_sellback_active", enable_solar_sellback)
            )
        )
        bess_sellback_rate = configured_sellback_rate if bess_solar_sellback_active else 0.0

        total_shifted_savings = 0.0
        daily_export_history = recorder_history.get("daily_export_kwh_history", [])
        daily_import_history = recorder_history.get("daily_import_kwh_history", [])
        daily_solar_history = recorder_history.get("daily_solar_kwh_history", [])
        start_dt = self._get_billing_start_datetime(now)

        for idx in range(min(30, len(daily_export_history))):
            exp_kwh = daily_export_history[idx]
            imp_kwh = daily_import_history[idx] if idx < len(daily_import_history) else 0.0
            day_date = (start_dt + timedelta(days=idx)).date()

            day_savings = self.calculate_bess_daily_savings(
                day_date=day_date,
                export_kwh=exp_kwh,
                import_kwh=imp_kwh,
                bess_capacity=bess_capacity,
                bess_efficiency=bess_efficiency,
                sellback_rate=bess_sellback_rate,
                peak_rate=self.active_tou_peak_rate,
                offpeak_rate=self.active_tou_offpeak_rate,
                ft_rate=ft_rate,
                grid_charging=grid_charging,
                tariff_model=tariff_model
            )
            total_shifted_savings += day_savings

        self.bess_simulated_savings_thb = total_shifted_savings

        # 2. Extract past completed days from 100% hard hourly LTS recorder data
        past_peak_import_kwh = float(recorder_history.get("past_peak_import_kwh", 0.0))
        past_offpeak_import_kwh = float(recorder_history.get("past_offpeak_import_kwh", 0.0))
        past_peak_base_cost_thb = float(recorder_history.get("past_peak_base_cost_thb", 0.0))
        past_offpeak_base_cost_thb = float(recorder_history.get("past_offpeak_base_cost_thb", 0.0))
        past_solar_savings_thb = float(recorder_history.get("past_solar_savings_thb", 0.0))

        # 3. Calculate today's live incremental portion
        today_import_kwh = self.today_import_kwh
        today_solar_kwh = self.today_solar_kwh
        today_export_kwh = self.today_export_kwh
        today_self_kwh = max(0.0, today_solar_kwh - today_export_kwh)

        today_date = now.date()
        is_today_weekday = today_date.weekday() < 5
        is_today_holiday = bool(self.th_holidays and today_date in self.th_holidays)

        if not is_today_weekday or is_today_holiday:
            today_peak_import = 0.0
            today_offpeak_import = today_import_kwh
            today_peak_self = 0.0
            today_offpeak_self = today_self_kwh
        else:
            curr_hour = now.hour + (now.minute / 60.0)
            if curr_hour < 9.0:
                today_peak_import = 0.0
                today_offpeak_import = today_import_kwh
                today_peak_self = 0.0
                today_offpeak_self = today_self_kwh
            elif 9.0 <= curr_hour < 22.0:
                elapsed_peak_hours = curr_hour - 9.0
                total_elapsed_hours = max(1.0, curr_hour)
                peak_time_ratio = min(1.0, elapsed_peak_hours / total_elapsed_hours)
                today_peak_import = today_import_kwh * peak_time_ratio
                today_offpeak_import = max(0.0, today_import_kwh - today_peak_import)
                today_peak_self = today_self_kwh * 0.90
                today_offpeak_self = today_self_kwh * 0.10
            else:
                today_peak_import = today_import_kwh * (13.0 / 24.0)
                today_offpeak_import = max(0.0, today_import_kwh - today_peak_import)
                today_peak_self = today_self_kwh * 0.90
                today_offpeak_self = today_self_kwh * 0.10

        today_peak_cost = today_peak_import * self.active_tou_peak_rate
        today_offpeak_cost = today_offpeak_import * self.active_tou_offpeak_rate

        if category in (TARIFF_1_3_1, TARIFF_1_3_2):
            today_savings = (today_peak_self * self.active_tou_peak_rate) + (today_offpeak_self * self.active_tou_offpeak_rate)
        else:
            today_savings = today_self_kwh * marginal_rate

        # 4. Total Accrued Usage, Base Costs, and Bill to Date
        total_peak_import_kwh = past_peak_import_kwh + today_peak_import
        total_offpeak_import_kwh = past_offpeak_import_kwh + today_offpeak_import
        self.monthly_tou_peak_import_kwh = total_peak_import_kwh
        self.monthly_tou_offpeak_import_kwh = total_offpeak_import_kwh
        self.phantom_tou_peak_kwh = total_peak_import_kwh
        self.phantom_tou_offpeak_kwh = total_offpeak_import_kwh

        if category in (TARIFF_1_3_1, TARIFF_1_3_2):
            accrued_base_cost = past_peak_base_cost_thb + past_offpeak_base_cost_thb + today_peak_cost + today_offpeak_cost
            self.monthly_solar_savings_thb = past_solar_savings_thb + today_savings
        elif category == TARIFF_1_1:
            if self.monthly_import_kwh <= TARIFF_1_1_PSO_SUBSIDY_LIMIT:
                accrued_base_cost = 0.0
            else:
                accrued_base_cost = self.calculate_tiered_cost(self.monthly_import_kwh, TARIFF_1_1_TIERS)
            self.monthly_solar_savings_thb = (self.monthly_solar_kwh - self.monthly_export_kwh) * marginal_rate
        elif category == TARIFF_1_2:
            accrued_base_cost = self.calculate_tiered_cost(self.monthly_import_kwh, self.active_tiered_1_2_tiers)
            self.monthly_solar_savings_thb = (self.monthly_solar_kwh - self.monthly_export_kwh) * marginal_rate

        accrued_ft_charge = self.monthly_import_kwh * ft_rate
        service_charge = (
            TARIFF_1_1_SERVICE_CHARGE if category == TARIFF_1_1 else (
                TARIFF_1_2_SERVICE_CHARGE if category == TARIFF_1_2 else (
                    TARIFF_1_3_1_SERVICE_CHARGE if category == TARIFF_1_3_1 else TARIFF_1_3_2_SERVICE_CHARGE
                )
            )
        )

        billing_start_dt = self._get_billing_start_datetime(now)
        elapsed_sec = max(60.0, (now - billing_start_dt).total_seconds())
        elapsed_days_fraction = max(0.04, elapsed_sec / 86400.0)

        prorated_service_charge = (service_charge / 30.0) * min(30.0, elapsed_days_fraction)
        accrued_subtotal = accrued_base_cost + prorated_service_charge + accrued_ft_charge
        accrued_vat_amount = accrued_subtotal * VAT_RATE
        monthly_accrued_bill = accrued_subtotal + accrued_vat_amount

        # Lifetime Continuous Accumulator Updates
        lifetime_self_consumption = max(0.0, self.lifetime_solar_kwh - self.lifetime_export_kwh)
        if category in (TARIFF_1_3_1, TARIFF_1_3_2):
            lifetime_savings_rate = (0.70 * self.active_tou_peak_rate) + (0.30 * self.active_tou_offpeak_rate)
        else:
            lifetime_savings_rate = marginal_rate

        self.lifetime_solar_savings_thb = lifetime_self_consumption * lifetime_savings_rate
        monthly_solar_revenue_thb = self.monthly_export_kwh * sellback_rate
        monthly_total_solar_benefit_thb = self.monthly_solar_savings_thb + monthly_solar_revenue_thb
        lifetime_solar_revenue_thb = self.lifetime_export_kwh * sellback_rate
        lifetime_total_solar_benefit_thb = self.lifetime_solar_savings_thb + lifetime_solar_revenue_thb

        # 5. Project 30-day Month-End Totals for Unelapsed Days
        # Derive empirical weekday peak ratio from hard recorded historical data
        past_weekdays_import = past_peak_import_kwh + past_offpeak_import_kwh
        if past_weekdays_import > 0 and past_peak_import_kwh > 0:
            empirical_weekday_peak_ratio = min(0.60, max(0.20, past_peak_import_kwh / past_weekdays_import))
        else:
            empirical_weekday_peak_ratio = 0.385

        current_cycle_day = min(30, max(1, int(elapsed_days_fraction)))
        remaining_cycle_days = max(0, 30 - current_cycle_day)
        avg_daily_import = (self.monthly_import_kwh / elapsed_days_fraction) if elapsed_days_fraction > 0 else 0.0

        forward_peak_import_kwh = 0.0
        forward_offpeak_import_kwh = 0.0
        for r_idx in range(remaining_cycle_days):
            f_date = (now + timedelta(days=r_idx + 1)).date()
            f_is_weekday = f_date.weekday() < 5
            f_is_holiday = bool(self.th_holidays and f_date in self.th_holidays)
            if f_is_weekday and not f_is_holiday:
                forward_peak_import_kwh += avg_daily_import * empirical_weekday_peak_ratio
                forward_offpeak_import_kwh += avg_daily_import * (1.0 - empirical_weekday_peak_ratio)
            else:
                forward_offpeak_import_kwh += avg_daily_import

        projected_monthly_import = self.monthly_import_kwh + (avg_daily_import * remaining_cycle_days)
        projected_peak_import = total_peak_import_kwh + forward_peak_import_kwh
        projected_offpeak_import = total_offpeak_import_kwh + forward_offpeak_import_kwh

        monthly_ft_charge = projected_monthly_import * ft_rate
        if category in (TARIFF_1_3_1, TARIFF_1_3_2):
            base_cost = (projected_peak_import * self.active_tou_peak_rate) + (
                projected_offpeak_import * self.active_tou_offpeak_rate
            )
        elif category == TARIFF_1_1:
            if projected_monthly_import <= TARIFF_1_1_PSO_SUBSIDY_LIMIT:
                base_cost = 0.0
            else:
                base_cost = self.calculate_tiered_cost(projected_monthly_import, TARIFF_1_1_TIERS)
        elif category == TARIFF_1_2:
            base_cost = self.calculate_tiered_cost(projected_monthly_import, self.active_tiered_1_2_tiers)

        subtotal = base_cost + service_charge + monthly_ft_charge
        vat_amount = subtotal * VAT_RATE
        monthly_estimated_bill = subtotal + vat_amount

        if category in (TARIFF_1_1, TARIFF_1_2):
            phantom_base = ((projected_monthly_import * 0.4) * self.active_tou_peak_rate) + (
                (projected_monthly_import * 0.6) * self.active_tou_offpeak_rate
            )
            phantom_subtotal = phantom_base + TARIFF_1_3_2_SERVICE_CHARGE + monthly_ft_charge
            phantom_total_bill = phantom_subtotal * (1 + VAT_RATE)
            opposing_tariff_name = "TOU 1.3.2"
        else:
            phantom_base = self.calculate_tiered_cost(projected_monthly_import, self.active_tiered_1_2_tiers)
            phantom_subtotal = phantom_base + TARIFF_1_2_SERVICE_CHARGE + monthly_ft_charge
            phantom_total_bill = phantom_subtotal * (1 + VAT_RATE)
            opposing_tariff_name = "Tiered 1.2"

        potential_tariff_diff_thb = phantom_total_bill - monthly_estimated_bill

        # 4. Project 30-day monthly solar generation, export, savings, and bill without solar
        # Check if live multi-day Solcast forecast sensors are available in Home Assistant
        solcast_remaining_forecast_kwh = 0.0
        solcast_forward_savings_thb = 0.0
        solcast_found = False
        forward_days: list[float] = []
        solcast_dampen_factor = 1.0

        if hasattr(self, "hass") and self.hass and hasattr(self.hass, "states"):
            # 1. Check if Solcast dampening entity or factors are configured in Home Assistant
            damp_st = self.hass.states.get("sensor.solcast_pv_forecast_dampening")
            if damp_st and damp_st.attributes and "factors" in damp_st.attributes:
                factors_list = damp_st.attributes.get("factors", [])
                numeric_factors = [
                    float(f["factor"]) for f in factors_list if isinstance(f, dict) and "factor" in f
                ]
                if numeric_factors:
                    avg_factor = sum(numeric_factors) / len(numeric_factors)
                    if 0.05 <= avg_factor <= 1.0:
                        solcast_dampen_factor = avg_factor

            # 2. Extract remaining today solar forecast
            rem_today_kwh = 0.0
            for sensor_name in [
                "sensor.solcast_pv_forecast_forecast_remaining_today",
                "sensor.solcast_forecast_remaining_today",
            ]:
                st = self.hass.states.get(sensor_name)
                if st and st.state not in (None, "unavailable", "unknown"):
                    try:
                        val = float(st.state)
                        if val >= 0:
                            rem_today_kwh = val
                            solcast_found = True
                            break
                    except (ValueError, TypeError):
                        pass

            # 3. Extract forward daily forecasts (Days 2 to 7)
            for d_idx in range(2, 8):
                sensor_patterns = [
                    f"sensor.solcast_pv_forecast_forecast_day_{d_idx}",
                    f"sensor.solcast_forecast_day_{d_idx}",
                ]
                if d_idx == 2:
                    sensor_patterns.extend([
                        "sensor.solcast_pv_forecast_forecast_tomorrow",
                        "sensor.solcast_forecast_tomorrow",
                    ])
                for sp in sensor_patterns:
                    st = self.hass.states.get(sp)
                    if st and st.state not in (None, "unavailable", "unknown"):
                        try:
                            val = float(st.state)
                            if val >= 0:
                                forward_days.append(val)
                                solcast_found = True
                                break
                        except (ValueError, TypeError):
                            pass

            # If native dampening is inactive (1.0), calculate adaptive empirical dampening based on historical array output
            if solcast_found and forward_days and elapsed_days_fraction >= 3.0:
                avg_solcast_raw = sum(forward_days) / len(forward_days)
                actual_avg_daily_solar = self.monthly_solar_kwh / elapsed_days_fraction
                if avg_solcast_raw > 0 and actual_avg_daily_solar > 0:
                    empirical_dampen = actual_avg_daily_solar / avg_solcast_raw
                    if empirical_dampen < 0.85:
                        solcast_dampen_factor = min(solcast_dampen_factor, max(0.30, empirical_dampen))

            # Apply dampening to remaining today solar forecast
            dampened_rem_today = rem_today_kwh * solcast_dampen_factor
            if dampened_rem_today > 0:
                solcast_remaining_forecast_kwh += dampened_rem_today
                if category in (TARIFF_1_3_1, TARIFF_1_3_2):
                    today_is_workday = is_today_weekday and not (self.th_holidays and now.date() in self.th_holidays)
                    if today_is_workday:
                        today_rem_savings = (0.90 * dampened_rem_today * self.active_tou_peak_rate) + (
                            0.10 * dampened_rem_today * self.active_tou_offpeak_rate
                        )
                    else:
                        today_rem_savings = dampened_rem_today * self.active_tou_offpeak_rate
                else:
                    today_rem_savings = dampened_rem_today * marginal_rate
                solcast_forward_savings_thb += today_rem_savings

            if solcast_found and forward_days:
                current_cycle_day = min(30, max(1, int(elapsed_days_fraction)))
                remaining_days = max(0, 30 - current_cycle_day)
                avg_solcast = sum(forward_days) / len(forward_days)
                for r_idx in range(remaining_days):
                    raw_day_kwh = forward_days[r_idx] if r_idx < len(forward_days) else avg_solcast
                    day_kwh = raw_day_kwh * solcast_dampen_factor
                    solcast_remaining_forecast_kwh += day_kwh

                    f_date = (now + timedelta(days=r_idx + 1)).date()
                    f_is_weekday = f_date.weekday() < 5
                    f_is_workday = f_is_weekday and not (self.th_holidays and f_date in self.th_holidays)

                    if category in (TARIFF_1_3_1, TARIFF_1_3_2):
                        if f_is_workday:
                            day_savings = (0.90 * day_kwh * self.active_tou_peak_rate) + (
                                0.10 * day_kwh * self.active_tou_offpeak_rate
                            )
                        else:
                            day_savings = day_kwh * self.active_tou_offpeak_rate
                    else:
                        day_savings = day_kwh * marginal_rate

                    solcast_forward_savings_thb += day_savings

        if solcast_found and solcast_remaining_forecast_kwh > 0:
            projected_monthly_solar_kwh = self.monthly_solar_kwh + solcast_remaining_forecast_kwh
            projected_monthly_solar_savings_thb = (
                self.monthly_solar_savings_thb + solcast_forward_savings_thb
            )
        else:
            projected_monthly_solar_kwh = (self.monthly_solar_kwh / elapsed_days_fraction) * 30.0
            projected_monthly_solar_savings_thb = (
                self.monthly_solar_savings_thb / elapsed_days_fraction
            ) * 30.0

        projected_monthly_export_kwh = (self.monthly_export_kwh / elapsed_days_fraction) * 30.0
        projected_monthly_self_consumption_kwh = max(
            0.0, projected_monthly_solar_kwh - projected_monthly_export_kwh
        )

        projected_monthly_solar_revenue_thb = (
            projected_monthly_export_kwh * sellback_rate
        )
        projected_monthly_total_solar_benefit_thb = (
            projected_monthly_solar_savings_thb + projected_monthly_solar_revenue_thb
        )

        # Gross projected consumption without solar offset = grid import + self-consumed solar
        gross_projected_consumption = (
            projected_monthly_import + projected_monthly_self_consumption_kwh
        )
        gross_ft_charge = gross_projected_consumption * ft_rate
        gross_base_cost = 0.0

        if category == TARIFF_1_1:
            if gross_projected_consumption <= TARIFF_1_1_PSO_SUBSIDY_LIMIT:
                gross_base_cost = 0.0
            else:
                gross_base_cost = self.calculate_tiered_cost(
                    gross_projected_consumption, TARIFF_1_1_TIERS
                )
        elif category == TARIFF_1_2:
            gross_base_cost = self.calculate_tiered_cost(
                gross_projected_consumption, self.active_tiered_1_2_tiers
            )
        elif category in (TARIFF_1_3_1, TARIFF_1_3_2):
            base_import_peak = projected_monthly_import * (0.20 if self.monthly_solar_kwh > 5.0 else 0.40)
            displaced_solar_peak = 0.70 * projected_monthly_self_consumption_kwh
            gross_peak_kwh = min(gross_projected_consumption, base_import_peak + displaced_solar_peak)
            gross_offpeak_kwh = max(0.0, gross_projected_consumption - gross_peak_kwh)

            gross_base_cost = (
                gross_peak_kwh * self.active_tou_peak_rate
            ) + (
                gross_offpeak_kwh * self.active_tou_offpeak_rate
            )

        gross_subtotal = gross_base_cost + service_charge + gross_ft_charge
        projected_bill_without_solar_thb = gross_subtotal * (1.0 + VAT_RATE)
        saved_bill_amount = max(0.0, projected_bill_without_solar_thb - monthly_estimated_bill)
        projected_solar_bill_reduction_pct = (
            (saved_bill_amount / max(1.0, projected_bill_without_solar_thb)) * 100.0
        )

        # Grid Outage Economic Impact Analysis
        # Assume average baseline household load demand of 1.5 kW unserved power during grid failure
        outage_hours = self.total_outage_seconds / 3600.0
        economic_outage_loss = (outage_hours * 1.5) * DEFAULT_OUTAGE_COST_PER_KWH
        self.economic_outage_loss_thb = economic_outage_loss

        self.hass.async_create_task(self._async_save_storage())

        return {
            "tou_window_status": "Off-Peak" if is_offpeak else "Peak",
            # Monthly Resetting Entities (Accrued To Date & Projected Full Month)
            "monthly_accrued_bill": round(monthly_accrued_bill, 2),
            "monthly_accrued_base_cost": round(accrued_base_cost, 2),
            "monthly_accrued_ft_charge": round(accrued_ft_charge, 2),
            "monthly_accrued_vat_amount": round(accrued_vat_amount, 2),
            "projected_monthly_import": round(projected_monthly_import, 3),

            "monthly_estimated_bill": round(monthly_estimated_bill, 2),
            "monthly_base_cost": round(base_cost, 2),
            "monthly_ft_charge": round(monthly_ft_charge, 2),
            "monthly_service_charge": round(service_charge, 2),
            "monthly_vat_amount": round(vat_amount, 2),
            "monthly_import_kwh": round(self.monthly_import_kwh, 3),
            "monthly_export_kwh": round(self.monthly_export_kwh, 3),
            "monthly_solar_kwh": round(self.monthly_solar_kwh, 3),
            "monthly_solar_savings_thb": round(self.monthly_solar_savings_thb, 2),
            "monthly_solar_revenue_thb": round(monthly_solar_revenue_thb, 2),
            "monthly_total_solar_benefit_thb": round(monthly_total_solar_benefit_thb, 2),

            # Projected Month-End Solar Metrics
            "projected_monthly_solar_kwh": round(projected_monthly_solar_kwh, 3),
            "projected_monthly_export_kwh": round(projected_monthly_export_kwh, 3),
            "projected_monthly_self_consumption_kwh": round(projected_monthly_self_consumption_kwh, 3),
            "projected_monthly_solar_savings_thb": round(projected_monthly_solar_savings_thb, 2),
            "projected_monthly_solar_revenue_thb": round(projected_monthly_solar_revenue_thb, 2),
            "projected_monthly_total_solar_benefit_thb": round(projected_monthly_total_solar_benefit_thb, 2),
            "projected_bill_without_solar_thb": round(projected_bill_without_solar_thb, 2),
            "projected_solar_bill_reduction_pct": round(projected_solar_bill_reduction_pct, 1),
            "solcast_dampening_factor": round(solcast_dampen_factor, 2),

            # Today Calendar Day Live Entities
            "today_import_kwh": round(self.today_import_kwh, 3),
            "today_solar_kwh": round(self.today_solar_kwh, 3),
            "today_export_kwh": round(self.today_export_kwh, 3),
            "today_solar_savings_thb": round(today_savings, 2),
            
            # Lifetime Continuous Accumulators
            "lifetime_import_kwh": round(self.lifetime_import_kwh, 3),
            "lifetime_export_kwh": round(self.lifetime_export_kwh, 3),
            "lifetime_solar_kwh": round(self.lifetime_solar_kwh, 3),
            "lifetime_solar_savings_thb": round(self.lifetime_solar_savings_thb, 2),
            "lifetime_solar_revenue_thb": round(lifetime_solar_revenue_thb, 2),
            "lifetime_total_solar_benefit_thb": round(lifetime_total_solar_benefit_thb, 2),

            # HA Energy Dashboard Compatibility Entity
            "current_grid_price": round(current_grid_price, 4),

            # Instantaneous State & Rates
            "is_offpeak": is_offpeak,
            "marginal_rate": round(marginal_rate, 4),
            "ft_rate": ft_rate,
            "solar_sellback_rate": configured_sellback_rate,
            "effective_solar_sellback_rate": sellback_rate,
            "enable_solar_sellback": enable_solar_sellback,
            "active_tariff_category": self.active_tariff_category,

            # Predictive & Simulation Analytics
            "opposing_tariff_name": opposing_tariff_name,
            "phantom_total_bill": round(phantom_total_bill, 2),
            "potential_tariff_diff_thb": round(potential_tariff_diff_thb, 2),
            "bess_simulated_savings_thb": round(self.bess_simulated_savings_thb, 2),
            "bess_capacity_kwh": bess_capacity,
            "bess_capex_cost": float(self.config_data.get("bess_capex_cost") or getattr(self, "bess_capex_cost", 50000.0)),
            "bess_grid_charging": grid_charging,
            "bess_tariff_model": tariff_model,
            "bess_solar_sellback_active": bess_solar_sellback_active,
            
            # Grid Outages & Resilience Tracking
            "is_grid_outage": self.is_grid_outage,
            "outage_count": self.outage_count,
            "total_outage_seconds": self.total_outage_seconds,
            "economic_outage_loss_thb": round(self.economic_outage_loss_thb, 2),
            "outage_history": self.outage_history,

            # Last Month Archived Summary Stats
            "last_month_bill_thb": round(self.last_month_bill_thb, 2),
            "last_month_import_kwh": round(self.last_month_import_kwh, 3),

            # 30-Day Historical Recorder Arrays
            "daily_import_kwh_history": recorder_history["daily_import_kwh_history"],
            "daily_solar_kwh_history": recorder_history["daily_solar_kwh_history"],
            "daily_export_kwh_history": recorder_history["daily_export_kwh_history"],

            # 12-Month Historical Lookback & BESS Simulation Data
            "lookback_12_months_data": self.lookback_12_months_data,
            "bess_12_months_data": self.bess_12_months_data,
        }

    async def async_calculate_12_month_lookback(self) -> None:
        """Query hourly statistics from HA database over past year and simulate tiered vs TOU costs."""
        now = dt_util.now()
        
        # Query hourly stats for grid import sensor over the past 365 days
        def _fetch_lookback_stats() -> dict[str, list[dict[str, Any]]]:
            try:
                return statistics_during_period(
                    self.hass,
                    start_time=now - timedelta(days=365),
                    end_time=now,
                    statistic_ids=[self.import_sensor_id],
                    period="hour",
                    units=None,
                    types={"sum", "state", "change"},
                )
            except Exception as err:
                raise HomeAssistantError(
                    f"Could not query 12-month hourly statistics: {err}"
                ) from err

        # Errors propagate so the service call fails visibly
        stats_dict = await get_instance(self.hass).async_add_executor_job(_fetch_lookback_stats)
        import_stats = stats_dict.get(self.import_sensor_id, [])

        # Sort stats chronologically
        import_stats = sorted(import_stats, key=get_stat_sort_key)
        
        # Group hourly consumption by local Year-Month bucket
        monthly_groups = {}  # "2025-08" -> {"total": 0.0, "peak": 0.0, "offpeak": 0.0}
        
        for i in range(len(import_stats)):
            entry = import_stats[i]
            local_dt = parse_stat_datetime(entry.get("start"), BKK_TZ)
            month_key = local_dt.strftime("%Y-%m")
            
            # Determine change in kWh during this hour
            kwh = entry.get("change") or entry.get("sum_change")
            if kwh is None and i > 0:
                prev_sum = import_stats[i-1].get("sum")
                curr_sum = entry.get("sum")
                if prev_sum is not None and curr_sum is not None:
                    kwh = max(0.0, curr_sum - prev_sum)
            
            if kwh is None or kwh < 0.0:
                kwh = 0.0
                
            # Cap extreme anomalies
            if kwh > 50.0:
                kwh = 1.5
                
            is_off = self.is_tou_offpeak(local_dt)
            
            if month_key not in monthly_groups:
                monthly_groups[month_key] = {"total": 0.0, "peak": 0.0, "offpeak": 0.0}
                
            monthly_groups[month_key]["total"] += kwh
            if is_off:
                monthly_groups[month_key]["offpeak"] += kwh
            else:
                monthly_groups[month_key]["peak"] += kwh

        # Only months with real recorder statistics are reported; missing months are omitted

        lookback_data = []
        ft_rate = float(self.config_data.get(CONF_FT_RATE, DEFAULT_FT_RATE))

        # Enforce strictly the most recent 12 billing months
        for month_key in sorted(monthly_groups.keys())[-12:]:
            stats = monthly_groups[month_key]
            total_kwh = stats["total"]
            peak_kwh = stats["peak"]
            offpeak_kwh = stats["offpeak"]

            # Tiered 1.2 calculation
            tiered_base = self.calculate_tiered_cost(total_kwh, TARIFF_1_2_TIERS)
            tiered_subtotal = tiered_base + TARIFF_1_2_SERVICE_CHARGE + (total_kwh * ft_rate)
            tiered_total = tiered_subtotal * (1 + VAT_RATE)

            # TOU 1.3.2 calculation
            tou_base = (peak_kwh * 5.7982) + (offpeak_kwh * 2.6369)
            tou_subtotal = tou_base + TARIFF_1_3_2_SERVICE_CHARGE + (total_kwh * ft_rate)
            tou_total = tou_subtotal * (1 + VAT_RATE)

            savings = tiered_total - tou_total

            lookback_data.append({
                "month": month_key,
                "total_kwh": round(total_kwh, 1),
                "peak_kwh": round(peak_kwh, 1),
                "offpeak_kwh": round(offpeak_kwh, 1),
                "tiered_cost": round(tiered_total, 2),
                "tou_cost": round(tou_total, 2),
                "savings": round(savings, 2),
            })

        self.lookback_12_months_data = lookback_data
        _LOGGER.info("Calculated 12-month tariff lookback comparison with %d months", len(lookback_data))
        new_data = dict(self.data) if self.data else {}
        new_data["lookback_12_months_data"] = lookback_data
        self.async_set_updated_data(new_data)

    async def async_calculate_bess_lookback(self) -> None:
        """Query hourly statistics from HA database for grid export over past year and simulate BESS cycling.

        This performs a detailed daily cycling simulation of the battery over 365 days of historical data,
        taking into account battery capacity, round-trip efficiency (90%), and peak vs sellback rates.
        """
        now = dt_util.now()

        # Query hourly stats for grid export and import sensors over the past 365 days
        def _fetch_bess_stats() -> dict[str, list[dict[str, Any]]]:
            bess_stat_ids = [sid for sid in (self.export_sensor_id, self.import_sensor_id) if sid]
            try:
                return statistics_during_period(
                    self.hass,
                    start_time=now - timedelta(days=365),
                    end_time=now,
                    statistic_ids=bess_stat_ids,
                    period="hour",
                    units=None,
                    types={"sum", "state", "change"},
                )
            except Exception as err:
                raise HomeAssistantError(
                    f"Could not query 12-month BESS statistics: {err}"
                ) from err

        # Errors propagate so the service call fails visibly
        export_stats = []
        import_stats = []
        stats_dict = await get_instance(self.hass).async_add_executor_job(_fetch_bess_stats)
        if self.export_sensor_id:
            export_stats = stats_dict.get(self.export_sensor_id, [])
        if self.import_sensor_id:
            import_stats = stats_dict.get(self.import_sensor_id, [])

        # Sort stats chronologically
        export_stats = sorted(export_stats, key=get_stat_sort_key)
        import_stats = sorted(import_stats, key=get_stat_sort_key)

        # Group hourly export by Year-Month-Day bucket
        daily_export_groups = {}  # "2025-08-15" -> export_kwh
        for i in range(len(export_stats)):
            entry = export_stats[i]
            local_dt = parse_stat_datetime(entry.get("start"), BKK_TZ)
            day_key = local_dt.strftime("%Y-%m-%d")

            kwh = entry.get("change") or entry.get("sum_change")
            if kwh is None and i > 0:
                prev_sum = export_stats[i - 1].get("sum")
                curr_sum = entry.get("sum")
                if prev_sum is not None and curr_sum is not None:
                    kwh = max(0.0, curr_sum - prev_sum)

            if kwh is None or kwh < 0.0:
                kwh = 0.0
            if kwh > 50.0:
                kwh = 1.0  # cap anomaly

            if day_key not in daily_export_groups:
                daily_export_groups[day_key] = 0.0
            daily_export_groups[day_key] += kwh

        # Group hourly import by Year-Month-Day bucket
        daily_import_groups = {}  # "2025-08-15" -> import_kwh
        for i in range(len(import_stats)):
            entry = import_stats[i]
            local_dt = parse_stat_datetime(entry.get("start"), BKK_TZ)
            day_key = local_dt.strftime("%Y-%m-%d")

            kwh = entry.get("change") or entry.get("sum_change")
            if kwh is None and i > 0:
                prev_sum = import_stats[i - 1].get("sum")
                curr_sum = entry.get("sum")
                if prev_sum is not None and curr_sum is not None:
                    kwh = max(0.0, curr_sum - prev_sum)

            if kwh is None or kwh < 0.0:
                kwh = 0.0
            if kwh > 50.0:
                kwh = 1.5  # cap anomaly

            if day_key not in daily_import_groups:
                daily_import_groups[day_key] = 0.0
            daily_import_groups[day_key] += kwh

        # Only days with real recorder statistics are simulated; missing days are omitted

        # Combine all keys
        all_day_keys = sorted(list(set(list(daily_export_groups.keys()) + list(daily_import_groups.keys()))))

        # BESS configuration parameters
        capacity_cfg = self.config_data.get("bess_capacity_kwh") or self.config_data.get(CONF_BESS_CAPACITY_KWH)
        if not capacity_cfg:
            raise HomeAssistantError(
                "BESS capacity is not configured; run configure_bess first"
            )
        bess_capacity = float(capacity_cfg)
        bess_efficiency = 0.90
        grid_charging = bool(self.config_data.get("bess_grid_charging", False))
        tariff_model = self.config_data.get("bess_tariff_model", "tou")
        enable_solar_sellback = bool(self.config_data.get(CONF_ENABLE_SOLAR_SELLBACK, DEFAULT_ENABLE_SOLAR_SELLBACK))
        bess_solar_sellback_active = bool(
            self.config_data.get(
                CONF_BESS_SOLAR_SELLBACK_ACTIVE,
                self.config_data.get("bess_solar_sellback_active", enable_solar_sellback)
            )
        )
        configured_sellback_rate = float(self.config_data.get(CONF_SOLAR_SELLBACK_RATE, DEFAULT_SOLAR_SELLBACK))
        bess_sellback_rate = configured_sellback_rate if bess_solar_sellback_active else 0.0
        category = self.active_tariff_category

        peak_rate = self.active_tou_peak_rate
        offpeak_rate = self.active_tou_offpeak_rate
        ft_rate = float(self.config_data.get(CONF_FT_RATE, DEFAULT_FT_RATE))

        # Aggregate daily shifting simulation results by Month
        monthly_bess_sim = {}  # "2025-08" -> {"export_kwh": 0.0, "shifted_kwh": 0.0, "savings_thb": 0.0}

        for day_key in all_day_keys:
            month_key = day_key[:7]  # extract "YYYY-MM"

            export_kwh = daily_export_groups.get(day_key, 0.0)
            import_kwh = daily_import_groups.get(day_key, 0.0)

            # Keys are generated above as %Y-%m-%d, so parsing cannot legitimately fail
            day_date = datetime.strptime(day_key, "%Y-%m-%d").date()

            # Calculate daily savings using the unified daily BESS math
            day_savings = self.calculate_bess_daily_savings(
                day_date=day_date,
                export_kwh=export_kwh,
                import_kwh=import_kwh,
                bess_capacity=bess_capacity,
                bess_efficiency=bess_efficiency,
                sellback_rate=bess_sellback_rate,
                peak_rate=peak_rate,
                offpeak_rate=offpeak_rate,
                ft_rate=ft_rate,
                grid_charging=grid_charging,
                tariff_model=tariff_model
            )

            # Estimate shifted battery energy
            if grid_charging:
                # Weekdays we charge to full, weekends we only charge from solar surplus
                is_weekend = day_date.weekday() in (5, 6)
                if is_weekend:
                    shifted_kwh = min(export_kwh, bess_capacity)
                else:
                    shifted_kwh = bess_capacity
            else:
                shifted_kwh = min(export_kwh, bess_capacity)

            if month_key not in monthly_bess_sim:
                monthly_bess_sim[month_key] = {"export_kwh": 0.0, "shifted_kwh": 0.0, "savings_thb": 0.0}

            monthly_bess_sim[month_key]["export_kwh"] += export_kwh
            monthly_bess_sim[month_key]["shifted_kwh"] += shifted_kwh
            monthly_bess_sim[month_key]["savings_thb"] += day_savings

        # Convert to final list (strictly the most recent 12 billing months)
        bess_lookback_data = []
        for month_key in sorted(monthly_bess_sim.keys())[-12:]:
            stats = monthly_bess_sim[month_key]
            bess_lookback_data.append({
                "month": month_key,
                "export_kwh": round(stats["export_kwh"], 1),
                "shifted_kwh": round(stats["shifted_kwh"], 1),
                "savings_thb": round(stats["savings_thb"], 2)
            })

        self.bess_12_months_data = bess_lookback_data
        _LOGGER.info("Calculated 12-month BESS lookback simulation with %d months", len(bess_lookback_data))

        # Trigger coordinator data update notification so frontend redraws
        new_data = dict(self.data) if self.data else {}
        new_data["bess_12_months_data"] = bess_lookback_data
        self.async_set_updated_data(new_data)

    def reset_outage_statistics(self) -> None:
        """Reset grid outage incident counts, cumulative downtime, economic cost, and history log."""
        self.is_grid_outage = False
        self.outage_start_time = None
        self.total_outage_seconds = 0.0
        self.outage_count = 0
        self.economic_outage_loss_thb = 0.0
        self.outage_history = []
        _LOGGER.info("Reset grid outage tracking statistics to zero")
        if self.data:
            self.data["is_grid_outage"] = False
            self.data["outage_count"] = 0
            self.data["total_outage_seconds"] = 0.0
            self.data["economic_outage_loss_thb"] = 0.0
            self.data["outage_history"] = []
            self.async_set_updated_data(self.data)

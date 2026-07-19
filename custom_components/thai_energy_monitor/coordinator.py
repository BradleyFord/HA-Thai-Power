"""DataUpdateCoordinator and mathematical processing engine for Thailand Energy & Solar Monitor.

Performs asynchronous numerical integration (Riemann sums), tariff calculation,
phantom predictive tariff comparison, BESS simulation, MEA gamification points,
monthly billing cycle auto-resets, HA Energy Dashboard compatibility, single
bidirectional net grid sensor support, and strict Thailand Standard Time (Asia/Bangkok)
timezone TOU peak/off-peak resolution.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import logging
import math
from typing import Any
import zoneinfo

import holidays

from homeassistant.components.persistent_notification import async_create as async_create_notification
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.util import dt as dt_util

from .const import (
    CONF_BESS_CAPACITY_KWH,
    CONF_BILLING_DAY,
    CONF_FT_RATE,
    CONF_GRID_EXPORT_SENSOR,
    CONF_GRID_IMPORT_SENSOR,
    CONF_MEA_EBILL,
    CONF_MEA_EPAYMENT,
    CONF_SOLAR_PROD_SENSOR,
    CONF_SOLAR_SELLBACK_RATE,
    CONF_TARIFF_CATEGORY,
    CONF_UTILITY_PROVIDER,
    DEFAULT_FT_RATE,
    DEFAULT_OUTAGE_COST_PER_KWH,
    DEFAULT_SOLAR_SELLBACK,
    DOMAIN,
    MEA_POINT_CASH_CONVERSION,
    MEA_POINTS_EBILL_MONTHLY,
    MEA_POINTS_EPAYMENT_MONTHLY,
    MEA_POINTS_INITIAL_BONUS,
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


class ThaiEnergyDataUpdateCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Coordinator to manage polling-free event updates and tariff mathematics."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        """Initialize the Thailand Energy Data Update Coordinator."""
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=60),
        )
        self.entry = entry
        self.config_data = dict(entry.data)

        # Source Sensor Entity IDs
        self.import_sensor_id: str = entry.data[CONF_GRID_IMPORT_SENSOR]
        self.export_sensor_id: str = entry.data.get(CONF_GRID_EXPORT_SENSOR, self.import_sensor_id)
        self.solar_sensor_id: str = entry.data[CONF_SOLAR_PROD_SENSOR]

        # Single bidirectional net grid sensor flag
        self.is_single_bidirectional_sensor: bool = (self.import_sensor_id == self.export_sensor_id)

        # Active Tariff Category
        self.active_tariff_category: str = entry.data.get(CONF_TARIFF_CATEGORY, TARIFF_1_2)

        # Thai Holiday Engine
        self.th_holidays = holidays.TH()

        # Last raw sensor readings
        self._last_raw_grid_val: float | None = None
        self._last_import_val: float | None = None
        self._last_export_val: float | None = None
        self._last_solar_val: float | None = None
        self._last_self_consumption_val: float | None = None

        # Lifetime Continuous Accumulators
        self.lifetime_import_kwh: float = 0.0
        self.lifetime_export_kwh: float = 0.0
        self.lifetime_solar_kwh: float = 0.0
        self.lifetime_solar_savings_thb: float = 0.0

        # Monthly Billing Cycle Accumulators
        self.monthly_import_kwh: float = 0.0
        self.monthly_export_kwh: float = 0.0
        self.monthly_solar_kwh: float = 0.0
        self.monthly_tou_peak_import_kwh: float = 0.0
        self.monthly_tou_offpeak_import_kwh: float = 0.0
        self.monthly_solar_savings_thb: float = 0.0

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

        # MEA Gamification Accumulator
        self.mea_points: int = MEA_POINTS_INITIAL_BONUS if entry.data.get(CONF_UTILITY_PROVIDER) == PROVIDER_MEA else 0

        # Grid Outage & Resilience Tracking
        self.is_grid_outage: bool = False
        self.outage_start_time: datetime | None = None
        self.total_outage_seconds: float = 0.0
        self.outage_count: int = 0

        # Tariff 1.1 >150 kWh consecutive high months tracking
        self.consecutive_high_months: int = 0

    async def async_setup_listeners(self) -> None:
        """Subscribe to source sensor state change events asynchronously."""
        source_entities = list(set([
            self.import_sensor_id,
            self.export_sensor_id,
            self.solar_sensor_id,
        ]))
        self.async_add_listener(self._async_handle_update)
        async_track_state_change_event(
            self.hass, source_entities, self._async_sensor_state_listener
        )

    @callback
    def _async_sensor_state_listener(self, event: Event) -> None:
        """Handle state change notification from any of the source energy sensors."""
        self.hass.async_create_task(self.async_refresh())

    @callback
    def _async_handle_update(self) -> None:
        """Update callback when data is refreshed."""
        pass

    @callback
    def async_adjust_mea_points(self, points_delta: int) -> None:
        """Adjust MEA points balance (positive to add, negative to redeem)."""
        self.mea_points = max(0, self.mea_points + points_delta)
        _LOGGER.info("Adjusted MEA points by %d. New balance: %d", points_delta, self.mea_points)
        self.hass.async_create_task(self.async_refresh())

    def is_tou_offpeak(self, dt: datetime) -> bool:
        """Evaluate if datetime falls within TOU Off-Peak window in Thailand Standard Time.

        Off-Peak rules (Strictly in Asia/Bangkok time):
        - Monday through Friday 22:00 (10 PM) to 09:00 (9 AM)
        - Entirety of Saturday and Sunday
        - Official National Public Holidays in Thailand (holidays.TH)
        """
        try:
            bkk_tz = zoneinfo.ZoneInfo("Asia/Bangkok")
            bkk_dt = dt.astimezone(bkk_tz)
        except Exception:
            bkk_dt = dt.astimezone(timezone(timedelta(hours=7)))

        if bkk_dt.weekday() in (5, 6):
            return True

        if bkk_dt.date() in self.th_holidays:
            return True

        if bkk_dt.hour >= 22 or bkk_dt.hour < 9:
            return True

        return False

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
            for lower, upper, rate in TARIFF_1_2_TIERS:
                if lower <= current_kwh < upper:
                    return rate
            return TARIFF_1_2_TIERS[-1][2]

        elif category == TARIFF_1_3_1:
            return TARIFF_1_3_1_OFFPEAK if is_offpeak else TARIFF_1_3_1_PEAK

        elif category == TARIFF_1_3_2:
            return TARIFF_1_3_2_OFFPEAK if is_offpeak else TARIFF_1_3_2_PEAK

        return TARIFF_1_2_TIERS[0][2]

    def _check_monthly_reset(self, now: datetime) -> None:
        """Check if today matches the user's billing cycle start day and reset accumulators."""
        target_billing_day = int(self.config_data.get(CONF_BILLING_DAY, 1))
        
        try:
            bkk_tz = zoneinfo.ZoneInfo("Asia/Bangkok")
            today = now.astimezone(bkk_tz).date()
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

            if self.config_data.get(CONF_UTILITY_PROVIDER) == PROVIDER_MEA:
                if self.config_data.get(CONF_MEA_EBILL, False):
                    self.mea_points += MEA_POINTS_EBILL_MONTHLY
                if self.config_data.get(CONF_MEA_EPAYMENT, False):
                    self.mea_points += MEA_POINTS_EPAYMENT_MONTHLY

            if self.active_tariff_category == TARIFF_1_1:
                if self.monthly_import_kwh > 150.0:
                    self.consecutive_high_months += 1
                else:
                    self.consecutive_high_months = 0

                if self.consecutive_high_months >= 3:
                    _LOGGER.warning("Tariff 1.1 exceeded 150 kWh for 3 consecutive months. Auto-switching to Tariff 1.2.")
                    self.active_tariff_category = TARIFF_1_2
                    self.consecutive_high_months = 0

                    async_create_notification(
                        self.hass,
                        title="Thailand Energy Monitor: Auto-Switched to Tariff 1.2",
                        message=(
                            "Your monthly consumption exceeded 150 kWh for 3 consecutive months. "
                            "In accordance with MEA/PEA rules, your active rate has been automatically "
                            "switched to Tariff 1.2."
                        ),
                        notification_id="thai_energy_auto_tariff_switch",
                    )

            self.monthly_import_kwh = 0.0
            self.monthly_export_kwh = 0.0
            self.monthly_solar_kwh = 0.0
            self.monthly_tou_peak_import_kwh = 0.0
            self.monthly_tou_offpeak_import_kwh = 0.0
            self.monthly_solar_savings_thb = 0.0
            self.phantom_tou_peak_kwh = 0.0
            self.phantom_tou_offpeak_kwh = 0.0
            self.last_reset_date = today

    async def _async_update_data(self) -> dict[str, Any]:
        """Process incoming sensor states, numerical integration, and tariff engine."""
        now = dt_util.now()
        is_offpeak = self.is_tou_offpeak(now)

        self._check_monthly_reset(now)

        import_state = self.hass.states.get(self.import_sensor_id)
        export_state = self.hass.states.get(self.export_sensor_id) if not self.is_single_bidirectional_sensor else import_state
        solar_state = self.hass.states.get(self.solar_sensor_id)

        if import_state is None or import_state.state in ("unavailable", "unknown"):
            if not self.is_grid_outage:
                self.is_grid_outage = True
                self.outage_start_time = now
                self.outage_count += 1
                _LOGGER.warning("Grid outage detected on sensor %s", self.import_sensor_id)
        else:
            if self.is_grid_outage:
                self.is_grid_outage = False
                if self.outage_start_time:
                    duration = (now - self.outage_start_time).total_seconds()
                    self.total_outage_seconds += duration
                    self.outage_start_time = None

        delta_import = 0.0
        delta_export = 0.0

        if self.is_single_bidirectional_sensor:
            try:
                raw_grid = float(import_state.state) if import_state and import_state.state not in ("unavailable", "unknown") else None
            except (ValueError, TypeError):
                raw_grid = None

            if raw_grid is not None and not math.isnan(raw_grid):
                if self._last_raw_grid_val is not None:
                    grid_delta = raw_grid - self._last_raw_grid_val
                    if grid_delta > 0:
                        delta_import = grid_delta
                    elif grid_delta < 0:
                        delta_export = abs(grid_delta)
                self._last_raw_grid_val = raw_grid

                curr_import = max(0.0, raw_grid)
                curr_export = abs(min(0.0, raw_grid))
            else:
                curr_import = self._last_import_val or 0.0
                curr_export = self._last_export_val or 0.0

        else:
            try:
                curr_import = float(import_state.state) if import_state and import_state.state not in ("unavailable", "unknown") else None
                curr_export = float(export_state.state) if export_state and export_state.state not in ("unavailable", "unknown") else None
            except (ValueError, TypeError):
                curr_import, curr_export = None, None

            if curr_import is None or math.isnan(curr_import) or curr_import < 0:
                curr_import = self._last_import_val or 0.0

            if curr_export is None or math.isnan(curr_export) or curr_export < 0:
                curr_export = self._last_export_val or 0.0

            if self._last_import_val is not None and curr_import >= self._last_import_val:
                delta_import = curr_import - self._last_import_val
            self._last_import_val = curr_import

            if self._last_export_val is not None and curr_export >= self._last_export_val:
                delta_export = curr_export - self._last_export_val
            self._last_export_val = curr_export

        try:
            curr_solar = float(solar_state.state) if solar_state and solar_state.state not in ("unavailable", "unknown") else None
        except (ValueError, TypeError):
            curr_solar = None

        if curr_solar is None or math.isnan(curr_solar) or curr_solar < 0:
            curr_solar = self._last_solar_val or 0.0

        delta_solar = 0.0
        if self._last_solar_val is not None and curr_solar >= self._last_solar_val:
            delta_solar = curr_solar - self._last_solar_val
        self._last_solar_val = curr_solar

        self.lifetime_import_kwh += delta_import
        self.monthly_import_kwh += delta_import

        self.lifetime_export_kwh += delta_export
        self.monthly_export_kwh += delta_export

        self.lifetime_solar_kwh += delta_solar
        self.monthly_solar_kwh += delta_solar

        if is_offpeak:
            self.monthly_tou_offpeak_import_kwh += delta_import
            self.phantom_tou_offpeak_kwh += delta_import
        else:
            self.monthly_tou_peak_import_kwh += delta_import
            self.phantom_tou_peak_kwh += delta_import

        curr_self_consumption = max(0.0, curr_solar - curr_export)
        delta_sc = 0.0
        if self._last_self_consumption_val is not None and curr_self_consumption >= self._last_self_consumption_val:
            delta_sc = curr_self_consumption - self._last_self_consumption_val
        self._last_self_consumption_val = curr_self_consumption

        category = self.active_tariff_category
        marginal_rate = self.get_marginal_rate(category, self.monthly_import_kwh, is_offpeak)
        ft_rate = float(self.config_data.get(CONF_FT_RATE, DEFAULT_FT_RATE))
        
        current_grid_price = marginal_rate + ft_rate

        delta_savings = delta_sc * marginal_rate
        self.lifetime_solar_savings_thb += delta_savings
        self.monthly_solar_savings_thb += delta_savings

        sellback_rate = float(self.config_data.get(CONF_SOLAR_SELLBACK_RATE, DEFAULT_SOLAR_SELLBACK))
        monthly_solar_revenue_thb = self.monthly_export_kwh * sellback_rate
        monthly_total_solar_benefit_thb = self.monthly_solar_savings_thb + monthly_solar_revenue_thb

        lifetime_solar_revenue_thb = self.lifetime_export_kwh * sellback_rate
        lifetime_total_solar_benefit_thb = self.lifetime_solar_savings_thb + lifetime_solar_revenue_thb

        monthly_ft_charge = self.monthly_import_kwh * ft_rate
        base_cost = 0.0
        service_charge = 38.22

        if category == TARIFF_1_1:
            service_charge = TARIFF_1_1_SERVICE_CHARGE
            if self.monthly_import_kwh <= TARIFF_1_1_PSO_SUBSIDY_LIMIT:
                base_cost = 0.0
            else:
                base_cost = self.calculate_tiered_cost(self.monthly_import_kwh, TARIFF_1_1_TIERS)

        elif category == TARIFF_1_2:
            service_charge = TARIFF_1_2_SERVICE_CHARGE
            base_cost = self.calculate_tiered_cost(self.monthly_import_kwh, TARIFF_1_2_TIERS)

        elif category == TARIFF_1_3_1:
            service_charge = TARIFF_1_3_1_SERVICE_CHARGE
            base_cost = (self.monthly_tou_peak_import_kwh * TARIFF_1_3_1_PEAK) + (
                self.monthly_tou_offpeak_import_kwh * TARIFF_1_3_1_OFFPEAK
            )

        elif category == TARIFF_1_3_2:
            service_charge = TARIFF_1_3_2_SERVICE_CHARGE
            base_cost = (self.monthly_tou_peak_import_kwh * TARIFF_1_3_2_PEAK) + (
                self.monthly_tou_offpeak_import_kwh * TARIFF_1_3_2_OFFPEAK
            )

        subtotal = base_cost + service_charge + monthly_ft_charge
        vat_amount = subtotal * VAT_RATE
        monthly_estimated_bill = subtotal + vat_amount

        if category in (TARIFF_1_1, TARIFF_1_2):
            phantom_base = (self.phantom_tou_peak_kwh * TARIFF_1_3_2_PEAK) + (
                self.phantom_tou_offpeak_kwh * TARIFF_1_3_2_OFFPEAK
            )
            phantom_subtotal = phantom_base + TARIFF_1_3_2_SERVICE_CHARGE + monthly_ft_charge
            phantom_total_bill = phantom_subtotal * (1 + VAT_RATE)
            opposing_tariff_name = "TOU 1.3.2"
        else:
            phantom_base = self.calculate_tiered_cost(self.monthly_import_kwh, TARIFF_1_2_TIERS)
            phantom_subtotal = phantom_base + TARIFF_1_2_SERVICE_CHARGE + monthly_ft_charge
            phantom_total_bill = phantom_subtotal * (1 + VAT_RATE)
            opposing_tariff_name = "Tiered 1.2"

        potential_tariff_diff_thb = phantom_total_bill - monthly_estimated_bill

        bess_capacity = float(self.config_data.get(CONF_BESS_CAPACITY_KWH, 5.0))
        if delta_export > 0 and not is_offpeak:
            self.bess_charged_kwh = min(bess_capacity, self.bess_charged_kwh + delta_export)
        elif delta_import > 0 and not is_offpeak and self.bess_charged_kwh > 0:
            discharged = min(delta_import, self.bess_charged_kwh)
            self.bess_charged_kwh -= discharged
            peak_rate = TARIFF_1_3_2_PEAK if category == TARIFF_1_3_2 else TARIFF_1_2_TIERS[-1][2]
            self.bess_simulated_savings_thb += discharged * (peak_rate - sellback_rate)

        mea_points_cash_value = self.mea_points * MEA_POINT_CASH_CONVERSION
        outage_hours = self.total_outage_seconds / 3600.0
        economic_outage_loss = (outage_hours * 1.5) * DEFAULT_OUTAGE_COST_PER_KWH

        return {
            "tou_window_status": "Off-Peak" if is_offpeak else "Peak",
            # Monthly Resetting Entities
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
            "solar_sellback_rate": sellback_rate,
            "active_tariff_category": self.active_tariff_category,

            # Predictive & Simulation Analytics
            "opposing_tariff_name": opposing_tariff_name,
            "phantom_total_bill": round(phantom_total_bill, 2),
            "potential_tariff_diff_thb": round(potential_tariff_diff_thb, 2),
            "bess_simulated_savings_thb": round(self.bess_simulated_savings_thb, 2),
            
            # MEA Gamification & Outages
            "mea_points": self.mea_points,
            "mea_points_cash_value": round(mea_points_cash_value, 2),
            "is_grid_outage": self.is_grid_outage,
            "outage_count": self.outage_count,
            "total_outage_seconds": self.total_outage_seconds,
            "economic_outage_loss_thb": round(economic_outage_loss, 2),

            # Last Month Archived Summary Stats
            "last_month_bill_thb": round(self.last_month_bill_thb, 2),
            "last_month_import_kwh": round(self.last_month_import_kwh, 3),
        }

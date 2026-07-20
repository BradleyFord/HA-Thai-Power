"""Sensor Entity definitions for Thailand Energy & Solar Monitor.

Exposes energy costs, solar ROI, predictive analytics, gamification metrics, and
price parameters to Home Assistant with state restoration and recorder LTS support.
"""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.restore_state import RestoreEntity
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from homeassistant.util import dt as dt_util

from .const import ATTRIBUTION, DOMAIN
from .coordinator import ThaiEnergyDataUpdateCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Thailand Energy & Solar Monitor sensor entities."""
    coordinator: ThaiEnergyDataUpdateCoordinator = hass.data[DOMAIN][entry.entry_id]

    entities: list[SensorEntity] = [
        # --- Dedicated TOU Window Status Entity ---
        ThaiEnergyCostSensor(
            coordinator, entry, "tou_window_status", "TOU Window Status", None, None, None
        ),

        # --- Dedicated HA Energy Dashboard Compatibility Entity ---
        ThaiEnergyCostSensor(
            coordinator, entry, "current_grid_price", "Current Grid Energy Import Price", "THB/kWh", None, SensorStateClass.MEASUREMENT
        ),

        # --- Current Monthly Billing Cycle Entities (Auto-reset on billing day) ---
        ThaiEnergyCostSensor(
            coordinator, entry, "monthly_accrued_bill", "Monthly Accrued Bill (To Date)", "THB", SensorDeviceClass.MONETARY, SensorStateClass.TOTAL
        ),
        ThaiEnergyCostSensor(
            coordinator, entry, "monthly_estimated_bill", "Monthly Estimated Bill (Projected)", "THB", SensorDeviceClass.MONETARY, SensorStateClass.TOTAL
        ),
        ThaiEnergyCostSensor(
            coordinator, entry, "monthly_base_cost", "Monthly Base Energy Cost", "THB", SensorDeviceClass.MONETARY, SensorStateClass.TOTAL
        ),
        ThaiEnergyCostSensor(
            coordinator, entry, "monthly_ft_charge", "Monthly Ft Charge", "THB", SensorDeviceClass.MONETARY, SensorStateClass.TOTAL
        ),
        ThaiEnergyCostSensor(
            coordinator, entry, "monthly_service_charge", "Monthly Fixed Service Charge", "THB", SensorDeviceClass.MONETARY, SensorStateClass.TOTAL
        ),
        ThaiEnergyCostSensor(
            coordinator, entry, "monthly_vat_amount", "Monthly Calculated VAT (7%)", "THB", SensorDeviceClass.MONETARY, SensorStateClass.TOTAL
        ),
        ThaiEnergyCostSensor(
            coordinator, entry, "monthly_import_kwh", "Monthly Grid Import Energy", "kWh", SensorDeviceClass.ENERGY, SensorStateClass.TOTAL_INCREASING
        ),
        ThaiEnergyCostSensor(
            coordinator, entry, "monthly_export_kwh", "Monthly Grid Export Energy", "kWh", SensorDeviceClass.ENERGY, SensorStateClass.TOTAL_INCREASING
        ),
        ThaiEnergyCostSensor(
            coordinator, entry, "monthly_solar_kwh", "Monthly Solar Production Energy", "kWh", SensorDeviceClass.ENERGY, SensorStateClass.TOTAL_INCREASING
        ),
        ThaiEnergyCostSensor(
            coordinator, entry, "monthly_solar_savings_thb", "Monthly Solar Savings", "THB", SensorDeviceClass.MONETARY, SensorStateClass.TOTAL
        ),
        ThaiEnergyCostSensor(
            coordinator, entry, "monthly_solar_revenue_thb", "Monthly Solar Export Revenue", "THB", SensorDeviceClass.MONETARY, SensorStateClass.TOTAL
        ),
        ThaiEnergyCostSensor(
            coordinator, entry, "monthly_total_solar_benefit_thb", "Monthly Total Solar Benefit", "THB", SensorDeviceClass.MONETARY, SensorStateClass.TOTAL
        ),

        # --- Lifetime Continuous Entities (Never reset) ---
        ThaiEnergyCostSensor(
            coordinator, entry, "lifetime_import_kwh", "Lifetime Grid Import Energy", "kWh", SensorDeviceClass.ENERGY, SensorStateClass.TOTAL_INCREASING
        ),
        ThaiEnergyCostSensor(
            coordinator, entry, "lifetime_export_kwh", "Lifetime Grid Export Energy", "kWh", SensorDeviceClass.ENERGY, SensorStateClass.TOTAL_INCREASING
        ),
        ThaiEnergyCostSensor(
            coordinator, entry, "lifetime_solar_kwh", "Lifetime Solar Production Energy", "kWh", SensorDeviceClass.ENERGY, SensorStateClass.TOTAL_INCREASING
        ),
        ThaiEnergyCostSensor(
            coordinator, entry, "lifetime_solar_savings_thb", "Lifetime Solar Savings", "THB", SensorDeviceClass.MONETARY, SensorStateClass.TOTAL
        ),
        ThaiEnergyCostSensor(
            coordinator, entry, "lifetime_solar_revenue_thb", "Lifetime Solar Revenue", "THB", SensorDeviceClass.MONETARY, SensorStateClass.TOTAL
        ),
        ThaiEnergyCostSensor(
            coordinator, entry, "lifetime_total_solar_benefit_thb", "Lifetime Total Solar Benefit", "THB", SensorDeviceClass.MONETARY, SensorStateClass.TOTAL
        ),

        # --- Instantaneous Rates & Prices ---
        ThaiEnergyCostSensor(
            coordinator, entry, "marginal_rate", "Active Marginal Retail Rate", "THB/kWh", None, SensorStateClass.MEASUREMENT
        ),
        ThaiEnergyCostSensor(
            coordinator, entry, "ft_rate", "Current Ft Adjustment Rate", "THB/kWh", None, SensorStateClass.MEASUREMENT
        ),
        ThaiEnergyCostSensor(
            coordinator, entry, "solar_sellback_rate", "Solar Buy-Back Rate", "THB/kWh", None, SensorStateClass.MEASUREMENT
        ),

        # --- Predictive Analytics & Simulation ---
        ThaiEnergyCostSensor(
            coordinator, entry, "potential_tariff_diff_thb", "Predictive Tariff Difference", "THB", SensorDeviceClass.MONETARY, SensorStateClass.TOTAL
        ),
        ThaiEnergyCostSensor(
            coordinator, entry, "bess_simulated_savings_thb", "BESS Storage Simulated Savings", "THB", SensorDeviceClass.MONETARY, SensorStateClass.TOTAL
        ),

        # --- MEA Gamification & Outages ---
        ThaiEnergyCostSensor(
            coordinator, entry, "mea_points", "MEA Virtual Points Balance", "pts", None, SensorStateClass.TOTAL_INCREASING
        ),
        ThaiEnergyCostSensor(
            coordinator, entry, "mea_points_cash_value", "MEA Points Cash Value", "THB", SensorDeviceClass.MONETARY, SensorStateClass.TOTAL
        ),
        ThaiEnergyCostSensor(
            coordinator, entry, "economic_outage_loss_thb", "Grid Outage Economic Cost", "THB", SensorDeviceClass.MONETARY, SensorStateClass.TOTAL
        ),
        ThaiEnergyCostSensor(
            coordinator, entry, "outage_count", "Grid Outage Incident Count", "count", None, SensorStateClass.TOTAL_INCREASING
        ),
    ]

    async_add_entities(entities)


class ThaiEnergyCostSensor(
    CoordinatorEntity[ThaiEnergyDataUpdateCoordinator], RestoreEntity, SensorEntity
):
    """Representation of a Thailand Energy & Solar Monitor sensor entity."""

    _attr_has_entity_name = True
    _attr_attribution = ATTRIBUTION

    def __init__(
        self,
        coordinator: ThaiEnergyDataUpdateCoordinator,
        entry: ConfigEntry,
        key: str,
        name: str,
        unit: str | None,
        device_class: SensorDeviceClass | None,
        state_class: SensorStateClass | None,
    ) -> None:
        """Initialize the sensor entity."""
        super().__init__(coordinator)
        self.entry = entry
        self.key = key
        self._attr_name = name
        self._attr_native_unit_of_measurement = unit
        self._attr_device_class = device_class
        self._attr_state_class = state_class
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._restored_native_value: Any = None

    async def async_added_to_hass(self) -> None:
        """Handle state restoration from SQLite database upon core reboot."""
        await super().async_added_to_hass()
        last_state = await self.async_get_last_state()
        if last_state is not None and last_state.state not in ("unavailable", "unknown"):
            try:
                self._restored_native_value = float(last_state.state) if self.key != "tou_window_status" else last_state.state
            except ValueError:
                self._restored_native_value = last_state.state

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return additional diagnostic state attributes."""
        if not self.coordinator.data:
            return {}
        return {
            "utility_provider": self.entry.data.get("utility_provider"),
            "tariff_category": self.coordinator.data.get("active_tariff_category"),
            "is_offpeak": self.coordinator.data.get("is_offpeak"),
            "tou_status": "Off-Peak" if self.coordinator.data.get("is_offpeak") else "Peak",
            "opposing_tariff_name": self.coordinator.data.get("opposing_tariff_name"),
            "last_month_bill_thb": self.coordinator.data.get("last_month_bill_thb"),
            "last_month_import_kwh": self.coordinator.data.get("last_month_import_kwh"),
            "import_sensor_id": self.coordinator.import_sensor_id,
            "export_sensor_id": self.coordinator.export_sensor_id,
            "solar_sensor_id": self.coordinator.solar_sensor_id,
            "import_baseline_kwh": self.coordinator.import_baseline_kwh,
            "solar_baseline_kwh": self.coordinator.solar_baseline_kwh,
            "export_baseline_kwh": self.coordinator.export_baseline_kwh,
            "monthly_accrued_bill": self.coordinator.data.get("monthly_accrued_bill"),
            "monthly_accrued_base_cost": self.coordinator.data.get("monthly_accrued_base_cost"),
            "monthly_accrued_ft_charge": self.coordinator.data.get("monthly_accrued_ft_charge"),
            "monthly_accrued_vat_amount": self.coordinator.data.get("monthly_accrued_vat_amount"),
            "projected_monthly_import": self.coordinator.data.get("projected_monthly_import"),
            "daily_import_kwh_history": self.coordinator.data.get("daily_import_kwh_history"),
            "daily_solar_kwh_history": self.coordinator.data.get("daily_solar_kwh_history"),
            "daily_export_kwh_history": self.coordinator.data.get("daily_export_kwh_history"),
            "lookback_12_months_data": getattr(self.coordinator, "lookback_12_months_data", None),
            "bess_12_months_data": getattr(self.coordinator, "bess_12_months_data", None),
            "outage_history": self.coordinator.data.get("outage_history"),
            "total_outage_seconds": self.coordinator.data.get("total_outage_seconds"),
            "bess_capacity_kwh": self.coordinator.data.get("bess_capacity_kwh") or self.coordinator.config_data.get("bess_capacity_kwh", 5.0),
            "bess_capex_cost": self.coordinator.data.get("bess_capex_cost") or getattr(self.coordinator, "bess_capex_cost", 50000.0),
            "bess_grid_charging": self.coordinator.config_data.get("bess_grid_charging", False),
            "bess_tariff_model": self.coordinator.config_data.get("bess_tariff_model", "tou"),
            "lifetime_solar_savings_thb": self.coordinator.data.get("lifetime_solar_savings_thb", 0.0),
            "lifetime_solar_revenue_thb": self.coordinator.data.get("lifetime_solar_revenue_thb", 0.0),
            "custom_peak_rate": self.coordinator.config_data.get("custom_peak_rate"),
            "custom_offpeak_rate": self.coordinator.config_data.get("custom_offpeak_rate"),
            "custom_tier1_rate": self.coordinator.config_data.get("custom_tier1_rate"),
            "custom_tier2_rate": self.coordinator.config_data.get("custom_tier2_rate"),
            "custom_tier3_rate": self.coordinator.config_data.get("custom_tier3_rate"),
            "billing_day": self.entry.data.get("billing_day") or 1,
            "current_day_of_cycle": self.coordinator.get_billing_cycle_day(dt_util.now()),
            "ft_rate": self.coordinator.config_data.get("ft_rate") or 0.3950,
            "solar_sellback_rate": self.coordinator.config_data.get("solar_sellback_rate") or 2.20,
            "mea_ebill_active": self.entry.data.get("mea_ebill_active") or False,
            "mea_epayment_active": self.entry.data.get("mea_epayment_active") or False,
        }

    @property
    def native_value(self) -> Any:
        """Return the current state value calculated by the coordinator."""
        if self.coordinator.data and self.key in self.coordinator.data:
            return self.coordinator.data[self.key]
        return self._restored_native_value

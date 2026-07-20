"""Integration setup and lifecycle management for Thailand Energy & Solar Monitor.

Registers modern asynchronous frontend static paths, sidebar panels, and custom services.
"""

from __future__ import annotations

import logging
import voluptuous as vol

from homeassistant.components import frontend
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv

from .const import (
    DOMAIN,
    CONF_UTILITY_PROVIDER,
    CONF_TARIFF_CATEGORY,
    CONF_BILLING_DAY,
    CONF_GRID_IMPORT_SENSOR,
    CONF_GRID_EXPORT_SENSOR,
    CONF_SOLAR_PROD_SENSOR,
    CONF_FT_RATE,
    CONF_SOLAR_SELLBACK_RATE,
    CONF_MEA_EBILL,
    CONF_MEA_EPAYMENT,
    CONF_BESS_CAPACITY_KWH,
)
from .coordinator import ThaiEnergyDataUpdateCoordinator

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.SENSOR]

SERVICE_ADJUST_MEA_POINTS = "adjust_mea_points"
SERVICE_SCHEMA_ADJUST_MEA_POINTS = vol.Schema(
    {
        vol.Required("points_delta"): vol.Coerce(int),
    }
)
SERVICE_TRIGGER_12_MONTH_LOOKBACK = "trigger_12_month_lookback"
SERVICE_TRIGGER_BESS_LOOKBACK = "trigger_bess_lookback"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Thailand Energy & Solar Monitor from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    coordinator = ThaiEnergyDataUpdateCoordinator(hass, entry)
    await coordinator.async_setup_listeners()
    await coordinator.async_config_entry_first_refresh()

    hass.data[DOMAIN][entry.entry_id] = coordinator

    # Forward setup to sensor platform
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # Register custom service to adjust / redeem MEA points
    async def async_handle_adjust_mea_points(call: ServiceCall) -> None:
        points_delta = int(call.data["points_delta"])
        coordinator.async_adjust_mea_points(points_delta)

    if not hass.services.has_service(DOMAIN, SERVICE_ADJUST_MEA_POINTS):
        hass.services.async_register(
            DOMAIN,
            SERVICE_ADJUST_MEA_POINTS,
            async_handle_adjust_mea_points,
            schema=SERVICE_SCHEMA_ADJUST_MEA_POINTS,
        )

    # Register custom service to trigger 12-month historical lookback comparison
    async def async_handle_trigger_12_month_lookback(call: ServiceCall) -> None:
        await coordinator.async_calculate_12_month_lookback()

    if not hass.services.has_service(DOMAIN, SERVICE_TRIGGER_12_MONTH_LOOKBACK):
        hass.services.async_register(
            DOMAIN,
            SERVICE_TRIGGER_12_MONTH_LOOKBACK,
            async_handle_trigger_12_month_lookback,
        )

    # Register custom service to trigger 12-month BESS simulation lookback
    async def async_handle_trigger_bess_lookback(call: ServiceCall) -> None:
        await coordinator.async_calculate_bess_lookback()

    if not hass.services.has_service(DOMAIN, SERVICE_TRIGGER_BESS_LOOKBACK):
        hass.services.async_register(
            DOMAIN,
            SERVICE_TRIGGER_BESS_LOOKBACK,
            async_handle_trigger_bess_lookback,
        )

    # Register custom service to configure BESS battery parameters dynamically
    SERVICE_CONFIGURE_BESS = "configure_bess"
    SERVICE_SCHEMA_CONFIGURE_BESS = vol.Schema(
        {
            vol.Required("battery_capacity"): vol.Coerce(float),
            vol.Required("capex_cost"): vol.Coerce(float),
            vol.Optional("grid_charging"): vol.Coerce(bool),
            vol.Optional("tariff_model"): vol.Coerce(str),
        }
    )

    async def async_handle_configure_bess(call: ServiceCall) -> None:
        capacity = float(call.data["battery_capacity"])
        capex = float(call.data["capex_cost"])
        grid_charging = bool(call.data.get("grid_charging", False))
        tariff_model = str(call.data.get("tariff_model", "tou"))
        
        # Update config entry data dictionary directly
        new_data = {
            **entry.data,
            "bess_capacity_kwh": capacity,
            "bess_capex_cost": capex,
            "bess_grid_charging": grid_charging,
            "bess_tariff_model": tariff_model
        }
        hass.config_entries.async_update_entry(entry, data=new_data)
        
        # Update coordinator parameters immediately
        coordinator.config_data["bess_capacity_kwh"] = capacity
        coordinator.config_data["bess_grid_charging"] = grid_charging
        coordinator.config_data["bess_tariff_model"] = tariff_model
        coordinator.bess_capex_cost = capex
        
        await coordinator.async_request_refresh()

    if not hass.services.has_service(DOMAIN, SERVICE_CONFIGURE_BESS):
        hass.services.async_register(
            DOMAIN,
            SERVICE_CONFIGURE_BESS,
            async_handle_configure_bess,
            schema=SERVICE_SCHEMA_CONFIGURE_BESS,
        )

    # Register custom service to configure all settings from frontend settings page
    SERVICE_CONFIGURE_SETTINGS = "configure_settings"
    SERVICE_SCHEMA_CONFIGURE_SETTINGS = vol.Schema(
        {
            vol.Required(CONF_UTILITY_PROVIDER): cv.string,
            vol.Required(CONF_TARIFF_CATEGORY): cv.string,
            vol.Required(CONF_BILLING_DAY): vol.Coerce(int),
            vol.Required(CONF_GRID_IMPORT_SENSOR): cv.string,
            vol.Required(CONF_GRID_EXPORT_SENSOR): cv.string,
            vol.Required(CONF_SOLAR_PROD_SENSOR): cv.string,
            vol.Required(CONF_FT_RATE): vol.Coerce(float),
            vol.Required(CONF_SOLAR_SELLBACK_RATE): vol.Coerce(float),
            vol.Required(CONF_MEA_EBILL): vol.Coerce(bool),
            vol.Required(CONF_MEA_EPAYMENT): vol.Coerce(bool),
            vol.Optional("custom_peak_rate"): vol.Coerce(float),
            vol.Optional("custom_offpeak_rate"): vol.Coerce(float),
            vol.Optional("custom_tier1_rate"): vol.Coerce(float),
            vol.Optional("custom_tier2_rate"): vol.Coerce(float),
            vol.Optional("custom_tier3_rate"): vol.Coerce(float),
        }
    )

    async def async_handle_configure_settings(call: ServiceCall) -> None:
        new_data = {
            CONF_UTILITY_PROVIDER: call.data[CONF_UTILITY_PROVIDER],
            CONF_TARIFF_CATEGORY: call.data[CONF_TARIFF_CATEGORY],
            CONF_BILLING_DAY: int(call.data[CONF_BILLING_DAY]),
            CONF_GRID_IMPORT_SENSOR: call.data[CONF_GRID_IMPORT_SENSOR],
            CONF_GRID_EXPORT_SENSOR: call.data[CONF_GRID_EXPORT_SENSOR],
            CONF_SOLAR_PROD_SENSOR: call.data[CONF_SOLAR_PROD_SENSOR],
            CONF_FT_RATE: float(call.data[CONF_FT_RATE]),
            CONF_SOLAR_SELLBACK_RATE: float(call.data[CONF_SOLAR_SELLBACK_RATE]),
            CONF_MEA_EBILL: bool(call.data[CONF_MEA_EBILL]),
            CONF_MEA_EPAYMENT: bool(call.data[CONF_MEA_EPAYMENT]),
        }
        
        # Add custom rate overrides if provided
        for key in ("custom_peak_rate", "custom_offpeak_rate", "custom_tier1_rate", "custom_tier2_rate", "custom_tier3_rate"):
            if key in call.data and call.data[key] is not None:
                new_data[key] = float(call.data[key])

        # Preserve existing BESS values if present
        if "bess_capacity_kwh" in entry.data:
            new_data["bess_capacity_kwh"] = entry.data["bess_capacity_kwh"]
        if "bess_capex_cost" in entry.data:
            new_data["bess_capex_cost"] = entry.data["bess_capex_cost"]
        if "bess_grid_charging" in entry.data:
            new_data["bess_grid_charging"] = entry.data["bess_grid_charging"]
        if "bess_tariff_model" in entry.data:
            new_data["bess_tariff_model"] = entry.data["bess_tariff_model"]

        hass.config_entries.async_update_entry(entry, data=new_data)
        coordinator.config_data.update(new_data)
        
        # Cleanly reload config entry so everything starts fresh immediately!
        await hass.config_entries.async_reload(entry.entry_id)

    if not hass.services.has_service(DOMAIN, SERVICE_CONFIGURE_SETTINGS):
        hass.services.async_register(
            DOMAIN,
            SERVICE_CONFIGURE_SETTINGS,
            async_handle_configure_settings,
            schema=SERVICE_SCHEMA_CONFIGURE_SETTINGS,
        )

    # --- Modern Asynchronous Frontend Registration ---
    frontend_path = hass.config.path("custom_components/thai_energy_monitor/frontend")

    await hass.http.async_register_static_paths([
        StaticPathConfig(
            "/thai_energy_ui",
            frontend_path,
            cache_headers=False,
        )
    ])

    # Register custom sidebar panel safely using frontend module
    try:
        frontend.async_register_built_in_panel(
            hass,
            component_name="custom",
            sidebar_title="Thai Power Cost",
            sidebar_icon="mdi:transmission-tower",
            frontend_url_path="thai-energy-dashboard",
            config={
                "_panel_custom": {
                    "name": "thai-energy-panel",
                    "embed_iframe": False,
                    "trust_external": False,
                    "js_url": "/thai_energy_ui/panel.js?v=1.7.1",
                }
            },
            require_admin=False,
            update=True,
        )
    except Exception as err:
        _LOGGER.warning("Could not register custom sidebar panel: %s", err)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a Thailand Energy & Solar Monitor config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)

    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)
        if not hass.data[DOMAIN]:
            try:
                frontend.async_remove_panel(hass, "thai-energy-dashboard")
            except Exception:
                pass
            hass.services.async_remove(DOMAIN, SERVICE_ADJUST_MEA_POINTS)
            hass.services.async_remove(DOMAIN, SERVICE_TRIGGER_12_MONTH_LOOKBACK)
            try:
                hass.services.async_remove(DOMAIN, "configure_bess")
                hass.services.async_remove(DOMAIN, "configure_settings")
            except Exception:
                pass

    return unload_ok

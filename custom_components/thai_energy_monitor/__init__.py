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

from .const import DOMAIN
from .coordinator import ThaiEnergyDataUpdateCoordinator

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.SENSOR]

SERVICE_ADJUST_MEA_POINTS = "adjust_mea_points"
SERVICE_SCHEMA_ADJUST_MEA_POINTS = vol.Schema(
    {
        vol.Required("points_delta"): vol.Coerce(int),
    }
)


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
                    "js_url": "/thai_energy_ui/panel.js",
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

    return unload_ok

"""Config Flow and Options Flow handlers for Thailand Energy & Solar Monitor.

Provides UI-based setup and dynamic lifecycle reconfiguration in accordance
with Home Assistant modern architectural directives.
"""

from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers.selector import (
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
    selector,
)

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
    DEFAULT_SOLAR_SELLBACK,
    DOMAIN,
    PROVIDER_MEA,
    TARIFF_1_2,
    TARIFF_CATEGORIES,
    UTILITY_PROVIDERS,
)

_LOGGER = logging.getLogger(__name__)


class ThaiEnergyConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle initial config flow for Thailand Energy & Solar Monitor."""

    VERSION = 1
    DOMAIN = DOMAIN

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle the initial setup step triggered by the user."""
        errors: dict[str, str] = {}

        if user_input is not None:
            # Set unique ID based on provider and tariff
            await self.async_set_unique_id(
                f"{user_input[CONF_UTILITY_PROVIDER]}_{user_input[CONF_TARIFF_CATEGORY]}"
            )
            self._abort_if_unique_id_configured()

            # Default grid export sensor to grid import sensor if not specified (bidirectional sensor)
            grid_export = user_input.get(CONF_GRID_EXPORT_SENSOR) or user_input[CONF_GRID_IMPORT_SENSOR]
            user_input[CONF_GRID_EXPORT_SENSOR] = grid_export

            # Assign initial default financial rates if not provided
            data = {
                **user_input,
                CONF_FT_RATE: DEFAULT_FT_RATE,
                CONF_SOLAR_SELLBACK_RATE: DEFAULT_SOLAR_SELLBACK,
                CONF_MEA_EBILL: True if user_input[CONF_UTILITY_PROVIDER] == PROVIDER_MEA else False,
                CONF_MEA_EPAYMENT: True if user_input[CONF_UTILITY_PROVIDER] == PROVIDER_MEA else False,
                CONF_BESS_CAPACITY_KWH: 5.0,
            }

            return self.async_create_entry(
                title=f"Thailand Energy ({user_input[CONF_UTILITY_PROVIDER]} Tariff {user_input[CONF_TARIFF_CATEGORY]})",
                data=data,
            )

        # Interactive schema using clean Home Assistant selectors
        data_schema = vol.Schema(
            {
                vol.Required(
                    CONF_UTILITY_PROVIDER, default=PROVIDER_MEA
                ): SelectSelector(
                    SelectSelectorConfig(
                        options=UTILITY_PROVIDERS,
                        mode=SelectSelectorMode.DROPDOWN,
                    )
                ),
                vol.Required(
                    CONF_TARIFF_CATEGORY, default=TARIFF_1_2
                ): SelectSelector(
                    SelectSelectorConfig(
                        options=TARIFF_CATEGORIES,
                        mode=SelectSelectorMode.DROPDOWN,
                    )
                ),
                vol.Required(
                    CONF_BILLING_DAY, default=1
                ): NumberSelector(
                    NumberSelectorConfig(
                        min=1,
                        max=31,
                        step=1,
                        mode=NumberSelectorMode.BOX,
                    )
                ),
                vol.Required(CONF_GRID_IMPORT_SENSOR): selector({"entity": {"domain": "sensor"}}),
                vol.Optional(CONF_GRID_EXPORT_SENSOR): selector({"entity": {"domain": "sensor"}}),
                vol.Required(CONF_SOLAR_PROD_SENSOR): selector({"entity": {"domain": "sensor"}}),
            }
        )

        return self.async_show_form(
            step_id="user", data_schema=data_schema, errors=errors
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> config_entries.OptionsFlow:
        """Get the options flow handler for dynamic reconfiguration."""
        return ThaiEnergyOptionsFlowHandler(config_entry)


class ThaiEnergyOptionsFlowHandler(config_entries.OptionsFlow):
    """Handle options flow for Thailand Energy & Solar Monitor."""

    def __init__(self, config_entry: config_entries.ConfigEntry | None = None) -> None:
        """Initialize options flow handler."""
        if config_entry is not None:
            self._config_entry = config_entry

    @property
    def config_entry(self) -> config_entries.ConfigEntry:
        """Return current config entry across HA versions."""
        if hasattr(self, "_config_entry") and self._config_entry is not None:
            return self._config_entry
        return super().config_entry

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Manage options step for modifying dynamic financial and entity variables."""
        current_entry = self.config_entry

        if user_input is not None:
            # Default grid export sensor to grid import sensor if not specified (bidirectional sensor)
            grid_export = user_input.get(CONF_GRID_EXPORT_SENSOR) or user_input[CONF_GRID_IMPORT_SENSOR]
            user_input[CONF_GRID_EXPORT_SENSOR] = grid_export

            # Update base entry data dictionary directly
            new_data = {**current_entry.data, **user_input}
            self.hass.config_entries.async_update_entry(
                current_entry, data=new_data
            )
            # Reload entry to apply updated settings
            await self.hass.config_entries.async_reload(current_entry.entry_id)
            return self.async_create_entry(title="", data={})

        current_data = current_entry.data

        # Define schema without default values (pre-populated via add_suggested_values_to_schema)
        options_schema = vol.Schema(
            {
                vol.Required(CONF_GRID_IMPORT_SENSOR): selector({"entity": {"domain": "sensor"}}),
                vol.Optional(CONF_GRID_EXPORT_SENSOR): selector({"entity": {"domain": "sensor"}}),
                vol.Required(CONF_SOLAR_PROD_SENSOR): selector({"entity": {"domain": "sensor"}}),
                vol.Required(CONF_TARIFF_CATEGORY): SelectSelector(
                    SelectSelectorConfig(
                        options=TARIFF_CATEGORIES,
                        mode=SelectSelectorMode.DROPDOWN,
                    )
                ),
                vol.Required(CONF_FT_RATE): NumberSelector(
                    NumberSelectorConfig(
                        min=-2.0,
                        max=5.0,
                        step=0.0001,
                        mode=NumberSelectorMode.BOX,
                    )
                ),
                vol.Required(CONF_SOLAR_SELLBACK_RATE): NumberSelector(
                    NumberSelectorConfig(
                        min=0.0,
                        max=10.0,
                        step=0.01,
                        mode=NumberSelectorMode.BOX,
                    )
                ),
                vol.Required(CONF_BESS_CAPACITY_KWH): NumberSelector(
                    NumberSelectorConfig(
                        min=0.0,
                        max=100.0,
                        step=0.5,
                        mode=NumberSelectorMode.BOX,
                    )
                ),
                vol.Required(CONF_MEA_EBILL): bool,
                vol.Required(CONF_MEA_EPAYMENT): bool,
            }
        )

        # Merge with current values (including options) to prepopulate form safely
        suggested_values = {
            CONF_TARIFF_CATEGORY: current_data.get(CONF_TARIFF_CATEGORY, TARIFF_1_2),
            CONF_FT_RATE: float(current_data.get(CONF_FT_RATE, DEFAULT_FT_RATE)),
            CONF_SOLAR_SELLBACK_RATE: float(current_data.get(CONF_SOLAR_SELLBACK_RATE, DEFAULT_SOLAR_SELLBACK)),
            CONF_BESS_CAPACITY_KWH: float(current_data.get(CONF_BESS_CAPACITY_KWH, 5.0)),
            CONF_MEA_EBILL: bool(current_data.get(CONF_MEA_EBILL, False)),
            CONF_MEA_EPAYMENT: bool(current_data.get(CONF_MEA_EPAYMENT, False)),
        }

        if current_data.get(CONF_GRID_IMPORT_SENSOR):
            suggested_values[CONF_GRID_IMPORT_SENSOR] = current_data[CONF_GRID_IMPORT_SENSOR]
        if current_data.get(CONF_GRID_EXPORT_SENSOR):
            suggested_values[CONF_GRID_EXPORT_SENSOR] = current_data[CONF_GRID_EXPORT_SENSOR]
        if current_data.get(CONF_SOLAR_PROD_SENSOR):
            suggested_values[CONF_SOLAR_PROD_SENSOR] = current_data[CONF_SOLAR_PROD_SENSOR]

        return self.async_show_form(
            step_id="init",
            data_schema=self.add_suggested_values_to_schema(options_schema, suggested_values),
        )

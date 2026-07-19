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
from homeassistant.helpers.selector import (
    EntitySelector,
    EntitySelectorConfig,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
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
    """Handle a initial config flow for Thailand Energy & Solar Monitor."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Handle the initial setup step triggered by the user."""
        errors: dict[str, str] = {}

        if user_input is not None:
            # Validate unique entry per domain setup
            await self.async_set_unique_id(
                f"{user_input[CONF_UTILITY_PROVIDER]}_{user_input[CONF_TARIFF_CATEGORY]}"
            )
            self._abort_if_unique_id_configured()

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

        # Build interactive schema using Home Assistant selectors
        data_schema = vol.Schema(
            {
                vol.Required(
                    CONF_UTILITY_PROVIDER, default=PROVIDER_MEA
                ): SelectSelector(
                    SelectSelectorConfig(
                        options=UTILITY_PROVIDERS,
                        mode=SelectSelectorMode.DROPDOWN,
                        translation_key="utility_provider",
                    )
                ),
                vol.Required(
                    CONF_TARIFF_CATEGORY, default=TARIFF_1_2
                ): SelectSelector(
                    SelectSelectorConfig(
                        options=TARIFF_CATEGORIES,
                        mode=SelectSelectorMode.DROPDOWN,
                        translation_key="tariff_category",
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
                vol.Required(CONF_GRID_IMPORT_SENSOR): EntitySelector(
                    EntitySelectorConfig(domain="sensor")
                ),
                vol.Required(CONF_GRID_EXPORT_SENSOR): EntitySelector(
                    EntitySelectorConfig(domain="sensor")
                ),
                vol.Required(CONF_SOLAR_PROD_SENSOR): EntitySelector(
                    EntitySelectorConfig(domain="sensor")
                ),
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
    """Handle options flow for Thailand Energy & Solar Monitor.

    Directive Adherence: To prevent configuration key duplication, options flow
    reads defaults from self.config_entry.data and writes updates directly back into
    self.config_entry.data via async_update_entry, leaving options dictionary empty.
    """

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        """Initialize options flow handler."""
        self.config_entry = config_entry

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Manage options step for modifying dynamic financial variables."""
        if user_input is not None:
            # Update base entry data dictionary directly
            new_data = {**self.config_entry.data, **user_input}
            self.hass.config_entries.async_update_entry(
                self.config_entry, data=new_data
            )
            # Reload entry to apply updated settings to coordinator & sensors
            await self.hass.config_entries.async_reload(self.config_entry.entry_id)
            return self.async_create_entry(title="", data={})

        current_data = self.config_entry.data

        # Options schema allowing user updates to Ft rate, sellback rate, BESS, and MEA points
        options_schema = vol.Schema(
            {
                vol.Required(
                    CONF_TARIFF_CATEGORY,
                    default=current_data.get(CONF_TARIFF_CATEGORY, TARIFF_1_2),
                ): SelectSelector(
                    SelectSelectorConfig(
                        options=TARIFF_CATEGORIES,
                        mode=SelectSelectorMode.DROPDOWN,
                    )
                ),
                vol.Required(
                    CONF_FT_RATE,
                    default=current_data.get(CONF_FT_RATE, DEFAULT_FT_RATE),
                ): NumberSelector(
                    NumberSelectorConfig(
                        min=-2.0,
                        max=5.0,
                        step=0.0001,
                        mode=NumberSelectorMode.BOX,
                    )
                ),
                vol.Required(
                    CONF_SOLAR_SELLBACK_RATE,
                    default=current_data.get(
                        CONF_SOLAR_SELLBACK_RATE, DEFAULT_SOLAR_SELLBACK
                    ),
                ): NumberSelector(
                    NumberSelectorConfig(
                        min=0.0,
                        max=10.0,
                        step=0.01,
                        mode=NumberSelectorMode.BOX,
                    )
                ),
                vol.Required(
                    CONF_BESS_CAPACITY_KWH,
                    default=current_data.get(CONF_BESS_CAPACITY_KWH, 5.0),
                ): NumberSelector(
                    NumberSelectorConfig(
                        min=0.0,
                        max=100.0,
                        step=0.5,
                        mode=NumberSelectorMode.BOX,
                    )
                ),
                vol.Required(
                    CONF_MEA_EBILL,
                    default=current_data.get(CONF_MEA_EBILL, False),
                ): bool,
                vol.Required(
                    CONF_MEA_EPAYMENT,
                    default=current_data.get(CONF_MEA_EPAYMENT, False),
                ): bool,
            }
        )

        return self.async_show_form(step_id="init", data_schema=options_schema)

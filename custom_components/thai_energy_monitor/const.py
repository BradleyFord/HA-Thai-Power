"""Constants for the Thailand Energy & Solar Monitor integration.

This module defines all static parameters, configuration keys, default values,
and retail electricity tariff structures for both the Metropolitan Electricity
Authority (MEA) and Provincial Electricity Authority (PEA) in Thailand.
"""

from typing import Final

# Integration Domain & Identifiers
DOMAIN: Final[str] = "thai_energy_monitor"
ATTRIBUTION: Final[str] = "Data provided by Thailand Energy & Solar Monitor"

# Configuration Entry Keys
CONF_UTILITY_PROVIDER: Final[str] = "utility_provider"
CONF_TARIFF_CATEGORY: Final[str] = "tariff_category"
CONF_BILLING_DAY: Final[str] = "billing_day"
CONF_GRID_IMPORT_SENSOR: Final[str] = "grid_import_sensor"
CONF_GRID_EXPORT_SENSOR: Final[str] = "grid_export_sensor"
CONF_SOLAR_PROD_SENSOR: Final[str] = "solar_prod_sensor"

# Adjustable Financial Parameters Keys
CONF_FT_RATE: Final[str] = "ft_rate"
CONF_SOLAR_SELLBACK_RATE: Final[str] = "solar_sellback_rate"
CONF_MEA_EBILL: Final[str] = "mea_ebill_active"
CONF_MEA_EPAYMENT: Final[str] = "mea_epayment_active"
CONF_BESS_CAPACITY_KWH: Final[str] = "bess_capacity_kwh"
CONF_BESS_GRID_CHARGING: Final[str] = "bess_grid_charging"
CONF_BESS_TARIFF_MODEL: Final[str] = "bess_tariff_model"
CONF_CUSTOM_PEAK_RATE: Final[str] = "custom_peak_rate"
CONF_CUSTOM_OFFPEAK_RATE: Final[str] = "custom_offpeak_rate"
CONF_CUSTOM_TIER1_RATE: Final[str] = "custom_tier1_rate"
CONF_CUSTOM_TIER2_RATE: Final[str] = "custom_tier2_rate"
CONF_CUSTOM_TIER3_RATE: Final[str] = "custom_tier3_rate"

# Utility Providers
PROVIDER_MEA: Final[str] = "MEA"
PROVIDER_PEA: Final[str] = "PEA"
UTILITY_PROVIDERS: Final[list[str]] = [PROVIDER_MEA, PROVIDER_PEA]

# Tariff Categories
TARIFF_1_1: Final[str] = "1.1"      # Residential <= 150 kWh/mo (5A Meter)
TARIFF_1_2: Final[str] = "1.2"      # Residential > 150 kWh/mo (>5A Meter)
TARIFF_1_3_1: Final[str] = "1.3.1"  # TOU Voltage 12 - 24 kV
TARIFF_1_3_2: Final[str] = "1.3.2"  # TOU Voltage Below 12 kV
TARIFF_CATEGORIES: Final[list[str]] = [
    TARIFF_1_1,
    TARIFF_1_2,
    TARIFF_1_3_1,
    TARIFF_1_3_2,
]

# Statutory Tax Rate (7% VAT in Thailand)
VAT_RATE: Final[float] = 0.07

# Financial Parameter Default Values (in THB)
DEFAULT_FT_RATE: Final[float] = 0.3950          # Ft charge THB/kWh (e.g. May-Aug 2026 baseline)
DEFAULT_SOLAR_SELLBACK: Final[float] = 2.20     # Solar Prachachon net billing buy-back rate THB/kWh
DEFAULT_OUTAGE_COST_PER_KWH: Final[float] = 308.41 # Macroeconomic outage loss metric THB/kWh

# Tariff 1.1 - Tiered Rates (THB/kWh) and Fixed Service Charge (THB/month)
TARIFF_1_1_TIERS: Final[list[tuple[float, float, float]]] = [
    (0.0, 15.0, 2.3488),
    (15.0, 25.0, 2.9882),
    (25.0, 35.0, 3.2405),
    (35.0, 100.0, 3.6237),
    (100.0, 150.0, 3.7171),
    (150.0, 400.0, 4.2218),
    (400.0, float("inf"), 4.4217),
]
TARIFF_1_1_SERVICE_CHARGE: Final[float] = 8.19
TARIFF_1_1_PSO_SUBSIDY_LIMIT: Final[float] = 50.0 # Public Service Obligation free limit (kWh)

# Tariff 1.2 - Tiered Rates (THB/kWh) and Fixed Service Charge (THB/month)
TARIFF_1_2_TIERS: Final[list[tuple[float, float, float]]] = [
    (0.0, 150.0, 3.2482),
    (150.0, 400.0, 4.2218),
    (400.0, float("inf"), 4.4217),
]
TARIFF_1_2_SERVICE_CHARGE: Final[float] = 38.22

# Tariff 1.3.1 - Time of Use (TOU 12-24 kV)
TARIFF_1_3_1_PEAK: Final[float] = 5.1135
TARIFF_1_3_1_OFFPEAK: Final[float] = 2.6037
TARIFF_1_3_1_SERVICE_CHARGE: Final[float] = 312.24

# Tariff 1.3.2 - Time of Use (TOU Below 12 kV)
TARIFF_1_3_2_PEAK: Final[float] = 5.7982
TARIFF_1_3_2_OFFPEAK: Final[float] = 2.6369
TARIFF_1_3_2_SERVICE_CHARGE: Final[float] = 38.22

# MEA Point Gamification Rewards
MEA_POINTS_INITIAL_BONUS: Final[int] = 1000
MEA_POINTS_EBILL_MONTHLY: Final[int] = 30
MEA_POINTS_EPAYMENT_MONTHLY: Final[int] = 80
MEA_POINT_CASH_CONVERSION: Final[float] = 0.1

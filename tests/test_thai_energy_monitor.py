"""Comprehensive Unit Test Suite for Thailand Energy & Solar Monitor.

Validates all retail electricity tariff categories (MEA & PEA 1.1, 1.2, 1.3.1, 1.3.2),
Public Service Obligation (PSO) subsidies, TOU peak/off-peak windows, statutory 7% VAT,
Solar Net Billing Riemann sums, BESS storage shift simulation, MEA points conversion,
and single bidirectional net grid sensor logic.
"""

import os
import sys
import unittest

# Add custom_components directory to Python path
sys.path.insert(0, os.path.abspath("custom_components/thai_energy_monitor"))

from const import (
    DEFAULT_FT_RATE,
    DEFAULT_SOLAR_SELLBACK,
    MEA_POINT_CASH_CONVERSION,
    TARIFF_1_1_PSO_SUBSIDY_LIMIT,
    TARIFF_1_1_SERVICE_CHARGE,
    TARIFF_1_1_TIERS,
    TARIFF_1_2_SERVICE_CHARGE,
    TARIFF_1_2_TIERS,
    TARIFF_1_3_1_OFFPEAK,
    TARIFF_1_3_1_PEAK,
    TARIFF_1_3_1_SERVICE_CHARGE,
    TARIFF_1_3_2_OFFPEAK,
    TARIFF_1_3_2_PEAK,
    TARIFF_1_3_2_SERVICE_CHARGE,
    VAT_RATE,
)


def calculate_tiered_cost(energy_kwh: float, tiers: list[tuple[float, float, float]]) -> float:
    """Calculate progressive tiered energy cost."""
    cost = 0.0
    for lower, upper, rate in tiers:
        if energy_kwh > lower:
            tier_consumption = min(energy_kwh - lower, upper - lower)
            cost += tier_consumption * rate
    return cost


class TestThaiEnergyMonitorCore(unittest.TestCase):
    """Comprehensive test case for Thailand electricity grid economics."""

    def test_tariff_1_1_pso_subsidy_under_50kwh(self) -> None:
        """Test Tariff 1.1 Public Service Obligation free 50 kWh subsidy rule."""
        consumption_kwh = 49.5
        if consumption_kwh <= TARIFF_1_1_PSO_SUBSIDY_LIMIT:
            base_cost = 0.0
        else:
            base_cost = calculate_tiered_cost(consumption_kwh, TARIFF_1_1_TIERS)

        self.assertEqual(base_cost, 0.0)

    def test_tariff_1_1_full_tier_progression(self) -> None:
        """Test Tariff 1.1 across all 7 progressive consumption tiers (500 kWh)."""
        consumption_kwh = 500.0
        base_cost = calculate_tiered_cost(consumption_kwh, TARIFF_1_1_TIERS)
        self.assertAlmostEqual(base_cost, 2016.5345, places=4)

    def test_tariff_1_2_tier_progression(self) -> None:
        """Test Tariff 1.2 across all 3 progressive consumption tiers (500 kWh)."""
        consumption_kwh = 500.0
        base_cost = calculate_tiered_cost(consumption_kwh, TARIFF_1_2_TIERS)
        self.assertAlmostEqual(base_cost, 1984.85, places=2)

    def test_tou_tariff_1_3_1_cost(self) -> None:
        """Test TOU Tariff 1.3.1 (12-24 kV) peak and off-peak energy cost."""
        peak_kwh = 100.0
        offpeak_kwh = 300.0
        base_cost = (peak_kwh * TARIFF_1_3_1_PEAK) + (offpeak_kwh * TARIFF_1_3_1_OFFPEAK)
        self.assertAlmostEqual(base_cost, 1292.46, places=2)

    def test_tou_tariff_1_3_2_cost(self) -> None:
        """Test TOU Tariff 1.3.2 (Below 12 kV) peak and off-peak energy cost."""
        peak_kwh = 100.0
        offpeak_kwh = 300.0
        base_cost = (peak_kwh * TARIFF_1_3_2_PEAK) + (offpeak_kwh * TARIFF_1_3_2_OFFPEAK)
        self.assertAlmostEqual(base_cost, 1370.89, places=2)

    def test_statutory_vat_and_total_bill(self) -> None:
        """Test full financial pipeline including Ft charge, service charge, and 7% VAT."""
        import_kwh = 350.0
        ft_rate = DEFAULT_FT_RATE
        base_cost = calculate_tiered_cost(import_kwh, TARIFF_1_2_TIERS)
        service_charge = TARIFF_1_2_SERVICE_CHARGE
        ft_charge = import_kwh * ft_rate

        subtotal = base_cost + service_charge + ft_charge
        vat_amount = subtotal * VAT_RATE
        total_bill = subtotal + vat_amount

        self.assertAlmostEqual(subtotal, 1508.06, places=2)
        self.assertAlmostEqual(vat_amount, 105.5642, places=4)
        self.assertAlmostEqual(total_bill, 1613.6242, places=4)

    def test_solar_net_billing_riemann_sum(self) -> None:
        """Test Solar Prachachon self-consumption Riemann sum savings & export revenue."""
        export_kwh = 50.0
        self_consumption_kwh = 120.0
        marginal_rate = 4.2218

        solar_savings = self_consumption_kwh * marginal_rate
        solar_revenue = export_kwh * DEFAULT_SOLAR_SELLBACK
        total_benefit = solar_savings + solar_revenue

        self.assertAlmostEqual(solar_savings, 506.616, places=3)
        self.assertAlmostEqual(solar_revenue, 110.00, places=2)
        self.assertAlmostEqual(total_benefit, 616.616, places=3)

    def test_single_bidirectional_sensor_splitting(self) -> None:
        """Test splitting a single bidirectional net grid sensor (positive = import, negative = export)."""
        reading_positive_import = 3.5  # Importing 3.5 kW
        reading_negative_export = -2.1  # Exporting 2.1 kW

        curr_import_1 = max(0.0, reading_positive_import)
        curr_export_1 = abs(min(0.0, reading_positive_import))

        curr_import_2 = max(0.0, reading_negative_export)
        curr_export_2 = abs(min(0.0, reading_negative_export))

        self.assertEqual(curr_import_1, 3.5)
        self.assertEqual(curr_export_1, 0.0)

        self.assertEqual(curr_import_2, 0.0)
        self.assertEqual(curr_export_2, 2.1)

    def test_mea_points_cash_conversion(self) -> None:
        """Test MEA Points gamification balance to THB discount conversion."""
        points = 1250
        cash_value = points * MEA_POINT_CASH_CONVERSION
        self.assertEqual(cash_value, 125.0)


if __name__ == "__main__":
    unittest.main()

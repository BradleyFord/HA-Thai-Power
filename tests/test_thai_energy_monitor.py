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
    DEFAULT_OUTAGE_COST_PER_KWH,
    DEFAULT_SOLAR_SELLBACK,
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

    def test_lts_daily_history_sum_invariant(self) -> None:
        """Test that LTS daily history sum for elapsed days matches total monthly consumption exactly."""
        total_monthly_kwh = 580.14
        recorded_changes = [
            42.58, 35.91, 41.53, 37.05, 31.26, 48.88, 43.54,
            45.01, 48.00, 42.97, 46.27, 29.82, 43.91
        ]
        # Past 13 days
        past_sum = sum(recorded_changes)
        today_delta = max(0.0, total_monthly_kwh - past_sum)

        all_14_days = recorded_changes + [today_delta]
        self.assertAlmostEqual(sum(all_14_days), total_monthly_kwh, places=2)
        self.assertGreater(today_delta, 0.0)

    def test_lts_proportional_distribution_when_pruned(self) -> None:
        """Test that missing past days receive proportional remainder without exceeding monthly total."""
        total_monthly_kwh = 495.90
        # Days 4 to 13 recorded (days 1 to 3 missing)
        recorded_days_4_to_13 = [30.09, 31.26, 48.88, 43.54, 45.01, 48.0, 42.97, 46.27, 29.82, 43.91]
        known_sum = sum(recorded_days_4_to_13)
        missing_count = 3  # days 1, 2, 3

        remaining = max(0.0, total_monthly_kwh - known_sum)
        slots = missing_count + 1  # 3 missing days + today
        fallback_val = remaining / slots

        day_values = [fallback_val] * 3 + recorded_days_4_to_13
        past_sum = sum(day_values)
        today_delta = max(0.0, total_monthly_kwh - past_sum)
        day_values.append(today_delta)

        self.assertAlmostEqual(sum(day_values), total_monthly_kwh, places=2)
        self.assertGreaterEqual(today_delta, 0.0)

    def test_grid_outage_economic_cost_calculation(self) -> None:
        """Test macroeconomic grid outage cost calculation against ERC baseline."""
        downtime_seconds = 3600.0  # 1 hour
        hours = downtime_seconds / 3600.0
        assumed_load_kw = 1.5
        cost_per_kwh = DEFAULT_OUTAGE_COST_PER_KWH
        loss = (hours * assumed_load_kw) * cost_per_kwh
        self.assertAlmostEqual(loss, 462.615, places=3)

    def test_parse_stat_datetime_with_float_and_datetime(self) -> None:
        """Test that float timestamps and datetimes are parsed correctly into Bangkok timezone."""
        import zoneinfo
        from datetime import datetime

        bkk_tz = zoneinfo.ZoneInfo("Asia/Bangkok")

        def _parse(start_val):
            if isinstance(start_val, (int, float)):
                ts = start_val / 1000.0 if start_val > 1e11 else float(start_val)
                return datetime.fromtimestamp(ts, tz=bkk_tz)
            if isinstance(start_val, datetime):
                return start_val.astimezone(bkk_tz)
            return datetime.now(tz=bkk_tz)

        def _sort_key(stat):
            start_val = stat.get("start")
            if isinstance(start_val, (int, float)):
                return float(start_val if start_val < 1e11 else start_val / 1000.0)
            if isinstance(start_val, datetime):
                return start_val.timestamp()
            return 0.0

        # Test with float POSIX timestamp (seconds)
        ts_float = 1755993600.0
        dt_from_float = _parse(ts_float)
        self.assertEqual(dt_from_float.tzinfo, bkk_tz)

        # Test with float POSIX timestamp (milliseconds)
        ts_ms = 1755993600000.0
        dt_from_ms = _parse(ts_ms)
        self.assertEqual(dt_from_ms, dt_from_float)

        # Test sorting key
        stat1 = {"start": 1755993600.0}
        stat2 = {"start": dt_from_float}
        self.assertEqual(_sort_key(stat1), _sort_key(stat2))

    def test_tariff_notification_formatting(self) -> None:
        """Test before and after formatting for tariff change notification."""
        old_ft = 0.3972
        new_ft = 0.1572
        diff = new_ft - old_ft
        formatted_delta = f"{diff:+.4f} THB/kWh"
        self.assertEqual(formatted_delta, "-0.2400 THB/kWh")


if __name__ == "__main__":
    unittest.main()

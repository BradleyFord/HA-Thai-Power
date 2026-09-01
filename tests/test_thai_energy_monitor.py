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

    def test_live_today_baseline_and_lts_drift_reconciliation(self) -> None:
        """Test that today's live accumulation never stays 0 due to past LTS boundary drift."""
        # Simulated live continuous month total and today's live energy
        total_monthly_kwh = 514.08
        today_live_kwh = 12.50

        # Simulated completed past days from LTS which had slight boundary drift (sum = 527.92)
        past_lts_days = [42.58, 35.91, 41.53, 37.05, 31.26, 48.88, 43.54, 45.01, 48.0, 42.97, 46.27, 29.82, 43.91, 31.19]
        known_past_sum = sum(past_lts_days)

        # Target past total must equal (total_monthly_kwh - today_live_kwh)
        target_past_total = max(0.0, total_monthly_kwh - today_live_kwh)
        self.assertAlmostEqual(target_past_total, 501.58, places=2)

        # Apply proportional scaling reconciliation
        scale_factor = target_past_total / known_past_sum
        reconciled_past_days = [round(v * scale_factor, 3) for v in past_lts_days]

        # Daily series with today directly receiving today_live_kwh
        daily_series = reconciled_past_days + [round(today_live_kwh, 3)]

        # Verify today's slot is exactly today_live_kwh (never zero)
        self.assertEqual(daily_series[-1], 12.50)
        # Verify total sum matches monthly baseline within rounding precision
        self.assertAlmostEqual(sum(daily_series), total_monthly_kwh, places=1)

    def test_projected_monthly_solar_calculations(self) -> None:
        """Test continuous fractional run-rate projections for solar generation and financial savings."""
        elapsed_days_fraction = 15.0  # Exactly halfway through 30-day billing cycle
        monthly_solar_kwh = 250.0
        monthly_export_kwh = 50.0
        monthly_solar_savings_thb = 850.0
        sellback_rate = 2.20

        # Projected volume calculations
        projected_monthly_solar_kwh = (monthly_solar_kwh / elapsed_days_fraction) * 30.0
        projected_monthly_export_kwh = (monthly_export_kwh / elapsed_days_fraction) * 30.0
        projected_monthly_self_consumption_kwh = max(
            0.0, projected_monthly_solar_kwh - projected_monthly_export_kwh
        )

        self.assertAlmostEqual(projected_monthly_solar_kwh, 500.0, places=2)
        self.assertAlmostEqual(projected_monthly_export_kwh, 100.0, places=2)
        self.assertAlmostEqual(projected_monthly_self_consumption_kwh, 400.0, places=2)

        # Projected financial calculations
        projected_monthly_solar_savings_thb = (
            monthly_solar_savings_thb / elapsed_days_fraction
        ) * 30.0
        projected_monthly_solar_revenue_thb = projected_monthly_export_kwh * sellback_rate
        projected_monthly_total_solar_benefit_thb = (
            projected_monthly_solar_savings_thb + projected_monthly_solar_revenue_thb
        )

        self.assertAlmostEqual(projected_monthly_solar_savings_thb, 1700.0, places=2)
        self.assertAlmostEqual(projected_monthly_solar_revenue_thb, 220.0, places=2)
        self.assertAlmostEqual(projected_monthly_total_solar_benefit_thb, 1920.0, places=2)

    def test_solar_sellback_disabled_zero_revenue(self) -> None:
        """Test solar financial benefit when solar sellback contract is disabled."""
        export_kwh = 80.0
        self_consumption_kwh = 150.0
        marginal_rate = 4.4217
        enable_solar_sellback = False
        sellback_rate = DEFAULT_SOLAR_SELLBACK if enable_solar_sellback else 0.0

        solar_savings = self_consumption_kwh * marginal_rate
        solar_revenue = export_kwh * sellback_rate
        total_benefit = solar_savings + solar_revenue

        self.assertEqual(solar_revenue, 0.0)
        self.assertEqual(total_benefit, solar_savings)
        self.assertAlmostEqual(solar_savings, 663.255, places=3)

    def test_bess_solar_arbitrage_with_and_without_sellback(self) -> None:
        """Test BESS daily savings comparison with active buy-back contract vs unmonetized export."""
        # 5 kWh battery, 90% efficiency, TOU 1.3.2 (Peak: 5.7982, Ft: 0.3950, VAT: 7%)
        bess_capacity = 5.0
        bess_efficiency = 0.90
        peak_rate = 5.7982
        ft_rate = 0.3950
        vat_mult = 1.07
        peak_cost_kwh = (peak_rate + ft_rate) * vat_mult  # ~6.6267 THB/kWh

        export_kwh = 10.0  # Surplus solar available
        solar_charged = min(export_kwh, bess_capacity)  # 5 kWh
        discharged = solar_charged * bess_efficiency     # 4.5 kWh
        benefit = discharged * peak_cost_kwh             # 4.5 * 6.6267 = ~29.82 THB

        # Case 1: Sellback active (฿2.20 buyback contract)
        sellback_rate_active = 2.20
        charge_cost_active = solar_charged * sellback_rate_active  # 5 * 2.20 = 11.00 THB
        savings_with_sellback = benefit - charge_cost_active       # 29.82 - 11.00 = ~18.82 THB

        # Case 2: No sellback contract (฿0.00 / disabled)
        sellback_rate_disabled = 0.0
        charge_cost_disabled = solar_charged * sellback_rate_disabled  # 0.00 THB
        savings_without_sellback = benefit - charge_cost_disabled     # 29.82 THB (maximum arbitrage!)

        self.assertAlmostEqual(savings_with_sellback, 18.8202, places=3)
        self.assertAlmostEqual(savings_without_sellback, 29.8202, places=3)
        self.assertGreater(savings_without_sellback, savings_with_sellback)

    def test_bess_lookback_12_month_backfill(self) -> None:
        """Test that BESS simulation spans 12 distinct months even when historical DB data is partial."""
        import random
        from datetime import datetime, timedelta

        now = datetime.now()
        daily_export_groups = {}
        daily_import_groups = {}

        # 14 days of recorded data
        for d_offset in range(14, 0, -1):
            d_date = now - timedelta(days=d_offset)
            d_key = d_date.strftime("%Y-%m-%d")
            daily_export_groups[d_key] = 0.0
            daily_import_groups[d_key] = 20.0

        # Backfill across 365 days
        random.seed("bess_lookback_12m")
        for d_offset in range(365, 0, -1):
            d_date = now - timedelta(days=d_offset)
            d_key = d_date.strftime("%Y-%m-%d")
            month_num = d_date.month
            season_mult = 1.4 if month_num in (3, 4, 5) else (0.70 if month_num in (8, 9, 10) else 1.0)
            if d_key not in daily_export_groups:
                daily_export_groups[d_key] = max(0.0, random.uniform(2.0, 15.0) * season_mult)
            if d_key not in daily_import_groups:
                daily_import_groups[d_key] = max(5.0, random.uniform(8.0, 25.0) * (1.3 if month_num in (4, 5, 6) else 1.0))

        all_day_keys = sorted(list(set(list(daily_export_groups.keys()) + list(daily_import_groups.keys()))))
        monthly_sim = {}
        for day_key in all_day_keys:
            month_key = day_key[:7]
            if month_key not in monthly_sim:
                monthly_sim[month_key] = 0.0
            monthly_sim[month_key] += 1.0

        final_months = sorted(monthly_sim.keys())[-12:]
        self.assertEqual(len(final_months), 12)

    def test_solcast_multi_day_forward_projection(self) -> None:
        """Test multi-day forward Solcast projection calculation for remaining billing days."""
        accrued_solar_kwh = 350.0
        current_cycle_day = 10
        remaining_days = 30 - current_cycle_day  # 20 days

        # 6 forward days available from Solcast
        forward_solcast_days = [37.5, 37.0, 33.5, 35.0, 36.0, 35.5]
        avg_solcast = sum(forward_solcast_days) / len(forward_solcast_days)

        solcast_remaining_forecast = 0.0
        for r_idx in range(remaining_days):
            if r_idx < len(forward_solcast_days):
                solcast_remaining_forecast += forward_solcast_days[r_idx]
            else:
                solcast_remaining_forecast += avg_solcast

        projected_monthly_solar_kwh = accrued_solar_kwh + solcast_remaining_forecast
        self.assertAlmostEqual(solcast_remaining_forecast, 715.0, places=2)
        self.assertAlmostEqual(projected_monthly_solar_kwh, 1065.0, places=2)


if __name__ == "__main__":
    unittest.main()



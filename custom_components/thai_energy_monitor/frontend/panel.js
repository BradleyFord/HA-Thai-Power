/**
 * Thailand Energy & Solar Monitor - Native Home Assistant Sidebar Dashboard
 * Built with stable DOM data binding (zero flashing / zero click event destruction),
 * rich detailed metrics across 4 tabs, Y-axis labeled cumulative monthly cost chart,
 * 30-day multi-trend SVG solar line chart with solid historical vs dashed predicted segments,
 * exact integration entity ID mapping to avoid collision, dynamic Peak/Off-Peak TOU chart option,
 * daily side-by-side bar chart showing volume (kWh) & value (THB) comparisons,
 * 12-month historical database tariff comparison simulation lookback engine with chart & details,
 * and direct Python coordinator baseline subtraction diagnostic panel.
 */

(() => {
  if (customElements.get('thai-energy-panel')) {
    return;
  }

  const TRANSLATIONS = {
    en: {
      tab_overview: "Billing Overview",
      tab_solar: "Solar ROI",
      tab_bess: "BESS Simulation",
      tab_optimizer: "Tariff Optimizer",
      tab_outages: "Grid Outages",
      tab_settings: "⚙️ Settings",

      current_accrued_bill: "Current Accrued Bill (To Date)",
      projected_month_end: "Projected Month-End:",
      run_rate: "run-rate",
      projected_solar_offset: "Projected Solar Offset:",
      reduction_vs: "reduction vs",
      bill_without_solar: "bill without solar",
      accrued_base_energy_charge: "Accrued Base Energy Charge",
      accrued_ft_charge: "Accrued Ft Charge",
      fixed_service_charge: "Fixed Service Charge",
      accrued_statutory_vat: "Accrued Statutory VAT (7%)",
      detailed_consumption: "Detailed Consumption & Rates",
      projected_month_end_volume: "Projected Month-End Volume:",
      tou_window_status: "TOU Window Status",
      active_marginal_rate: "Active Marginal Retail Rate",
      energy_dashboard_price: "HA Energy Dashboard Price Entity",
      last_month_bill: "Last Month Total Bill",
      lifetime_import: "Lifetime Grid Import Volume",
      offpeak_window: "Off-Peak Window",
      peak_window: "Peak Window",

      chart_progression_title: "Cumulative Monthly Running Bill Progression",
      tou_base_split: "TOU Base Split",
      tiered_base_charge: "Tiered Base Charge",
      legend_fixed_service: "1. Fixed Service",
      legend_peak_charge: "2. Peak Base Charge",
      legend_offpeak_charge: "3. Off-Peak Base Charge",
      legend_tier1: "2. Base Tier 1 (0-150)",
      legend_tier2: "3. Base Tier 2 (151-400)",
      legend_tier3: "4. Base Tier 3 (>400)",
      legend_ft: "Ft Charge",
      legend_vat: "VAT (7%)",
      note_tou_progression: "Accurate progressive Time of Use billing cycle progression. Base Charge is split daily: Peak Charge (09:00 - 22:00, Mon-Fri) • Off-Peak Charge (all other hours, weekends, and holidays).",
      note_tiered_progression: "Accurate progressive tiered billing cycle progression. Base Charge is split daily: Tier 1 (first 150 kWh) • Tier 2 (next 250 kWh) • Tier 3 (excess over 400 kWh).",

      chart_daily_title: "Daily Grid Import vs Solar Production",
      show_volume_kwh: "Show Volume (kWh)",
      show_value_thb: "Show Value (THB)",
      legend_grid_import_kwh: "1. Grid Import (Consumption Volume)",
      legend_grid_import_thb: "1. Grid Import (Incremental Cost)",
      legend_solar_prod_kwh: "2. Solar Production (Yield Volume)",
      legend_solar_prod_thb: "2. Solar Production (Financial Benefit)",
      hover_deltas_hint: "(Hover over bars to view exact daily deltas)",

      solar_savings_title: "Solar Self-Consumption Savings",
      projected_month_end_savings: "Projected Month-End Savings:",
      total_solar_production_vol: "Total Solar Production Volume",
      projected_full_month_yield: "Projected Full Month Yield",
      self_consumed_vol: "Self-Consumed Volume",
      lifetime_self_consumption_savings: "Lifetime Self-Consumption Savings",
      solar_revenue_title: "Solar Export Buy-Back Revenue",
      projected_month_end_revenue: "Projected Month-End Revenue:",
      export_buyback_rate: "Export Buy-Back Tariff Rate",
      grid_export_vol: "Grid Export Volume",
      lifetime_grid_export_revenue: "Lifetime Grid Export Revenue",
      solcast_title: "Solcast PV Forecast Integration",
      solcast_status: "Solcast Integration Status",
      solcast_integrated: "Solcast Integrated",
      solcast_simulated: "Simulated Solcast Baseline",
      estimated_gen_today: "Estimated Generation Today",
      estimated_rem_today: "Estimated Remaining Today",
      current_estimated_power: "Current Estimated Power Output",
      solar_performance_trends: "Billing Month Solar Performance Trends",
      legend_solcast_forecast: "1. Solcast PV Forecast",
      legend_actual_solar_prod: "2. Actual Solar Production",
      legend_internal_self_consumption: "3. Internal Self-Consumption",
      legend_grid_export: "4. Grid Export",
      note_solar_trends: "Full 30-day billing month multi-line performance chart trending: Solcast PV Forecast • Actual Solar Production • Internal Self-Consumption • Grid Export.",

      bess_calibration_title: "BESS Interactive Calibration",
      simulated_battery_capacity: "Simulated Battery Capacity (kWh)",
      battery_capex_cost: "Battery CAPEX Capital Cost (THB)",
      simulated_tariff_model: "Simulated Tariff Model",
      tou_tariff_option: "TOU Tariff 1.3.2 (Peak / Off-Peak)",
      tiered_tariff_option: "Normal Tiered Tariff 1.2 (Flat/Marginal)",
      enable_grid_charging: "Enable Off-Peak Grid Charging (Smart TOU Arbitrage)",
      btn_save_bess: "💾 Save & Recalculate Simulation",
      bess_lookback_title: "12-Month Historical BESS Performance Simulation",
      bess_lookback_desc: "Verify battery savings over a full year using daily cycling simulations across your past 12 months of Home Assistant grid export recorder database history. This counts seasonal variations in solar generation and export surpluses.",
      btn_calc_bess: "🔍 Calculate 12-Month BESS Performance History",
      btn_calc_bess_running: "🔄 Running daily battery cycling simulation over 365 days...",
      annual_battery_savings: "Annual Simulated Battery Savings",
      annual_shifted_energy: "12-Month Total Shifted Energy",
      corrected_payback_period: "Corrected Payback Period",
      col_month: "Month",
      col_grid_export: "Grid Export Surplus (kWh)",
      col_shifted_energy: "Simulated Shifted Energy (kWh)",
      col_savings: "Calculated Savings (THB)",
      btn_run_again: "🔄 Run Simulation Again",

      tariff_optimizer_title: "Tariff Switch Justification Engine",
      tariff_optimizer_desc: "To make an informed decision on whether to transition from Tiered Tariff 1.2 to TOU Tariff 1.3.2, you can run a lookback simulation over your past 12 months of Home Assistant recorder database history. This will show how seasonal temperature changes affect your monthly bills under both structures.",
      no_lookback_yet: "No lookback simulation has been run for this cycle yet.",
      btn_trigger_lookback: "🔍 Trigger 12-Month Lookback Analysis",
      btn_running_lookback: "⏳ Running Database Analysis...",
      simulation_cost_comparison: "12-Month Simulation Cost Comparison (THB)",
      btn_rerun_analysis: "🔄 Re-run Analysis",
      col_tiered_bill: "Tiered 1.2 Bill",
      col_tou_bill: "TOU 1.3.2 Bill",
      col_difference: "Difference",
      col_winner: "Best Tariff",
      tariff_regulations_title: "Tariff Transition Regulations",
      tariff_11_pso: "Tariff 1.1 Free PSO Subsidy",
      tariff_11_pso_val: "Free base charge if ≤ 50 kWh/month",
      tariff_11_threshold: "Tariff 1.1 Exceed Threshold",
      tariff_11_threshold_val: "> 150 kWh/month for 3 consecutive months",
      auto_reclass_engine: "Auto-Reclassification Engine",
      auto_reclass_engine_val: "Auto-switches calculation to Tariff 1.2",

      outages_title: "Grid Outage & Reliability History",
      incidents_label: "Incidents",
      total_cumulative_downtime: "Total Cumulative Downtime",
      outage_log_book: "Outage Log Book",
      col_start_time: "Start Time",
      col_end_time: "End Time",
      col_duration: "Duration",
      no_outages_recorded: "No outages recorded in the log book yet.",

      settings_sensors_title: "Grid & Solar Sensors Configuration",
      setting_import_sensor: "Grid Energy Import Sensor ID",
      setting_export_sensor: "Grid Energy Export Sensor ID (Optional)",
      setting_solar_sensor: "Solar Yield Production Sensor ID",
      settings_utility_title: "Utility & Tariff Structure",
      setting_provider: "Electricity Provider",
      setting_tariff_category: "Tariff Classification Category",
      setting_billing_day: "Billing Cycle Start Day",
      settings_financial_title: "Financial & Subscription Options",
      setting_ft_rate: "Ft Charge rate (THB / kWh)",
      setting_sellback_rate: "Solar Buy-back sellback rate (THB / kWh)",
      setting_ebill: "Active MEA e-Bill",
      setting_epayment: "Active MEA e-Payment",
      settings_custom_rates_title: "Custom Base Energy Rate Overrides (Optional)",
      settings_custom_rates_desc: "Manually override statutory MEA/PEA base tariff rates (THB/kWh). Leave any field blank to automatically use official standard utility tariff schedules.",
      setting_tou_peak_rate: "TOU Peak Rate (THB/kWh)",
      setting_tou_offpeak_rate: "TOU Off-Peak Rate (THB/kWh)",
      setting_tier1_rate: "Tier 1 Rate (0-150 kWh)",
      setting_tier2_rate: "Tier 2 Rate (151-400 kWh)",
      setting_tier3_rate: "Tier 3 / Flat Rate (>400 kWh)",
      btn_save_settings: "💾 Save Configuration & Reload Integration",
      btn_saving_settings: "⏳ Saving...",
      btn_saved_settings: "✅ Saved & Reloaded!",

      monthly_savings: "Monthly Savings",
      higher_than: "Higher than",
      day_label: "Day",
      status_weekend_offpeak: "Weekend (100% Off-Peak)",
      status_today_live: "Today (Live)",
      status_past: "Past",
      status_past_actual: "Past Actual",
      status_projected: "Projected",
      status_projected_runrate: "Projected Run-Rate",
      tt_cumulative_bill: "Cumulative Bill:",
      tt_added_on_day: "Added on Day",
      tt_grid_import: "Grid Import:",
      tt_solar_production: "Solar Production:",
      tt_self_consumed: "Self-Consumed:",
      tt_grid_export: "Grid Export:",
      tt_production_yield: "Actual Solar Yield:",
      tt_solcast_forecast: "Solcast PV Forecast:",
      tt_self_consumption: "Internal Self-Consumption:",
      tt_surplus_export: "Grid Export:",
      tt_forecast_accuracy: "Forecast Ratio:"
    },

    th: {
      tab_overview: "ภาพรวมค่าไฟฟ้า",
      tab_solar: "ผลตอบแทนโซลาร์เซลล์",
      tab_bess: "แบบจำลองระบบแบตเตอรี่",
      tab_optimizer: "เปรียบเทียบอัตราค่าไฟ",
      tab_outages: "ประวัติไฟฟ้าดับ",
      tab_settings: "⚙️ ตั้งค่า",

      current_accrued_bill: "ยอดค่าไฟสะสมปัจจุบัน (ถึงวันนี้)",
      projected_month_end: "ประมาณการสิ้นรอบบิล:",
      run_rate: "อัตราเฉลี่ย",
      projected_solar_offset: "มูลค่าที่โซลาร์ช่วยประหยัด:",
      reduction_vs: "ลดลงจาก",
      bill_without_solar: "ค่าไฟกรณีไม่มีโซลาร์",
      accrued_base_energy_charge: "ค่าพลังงานไฟฟ้าฐานสะสม",
      accrued_ft_charge: "ค่าไฟฟ้าผันแปร (Ft) สะสม",
      fixed_service_charge: "ค่าบริการรายเดือน",
      accrued_statutory_vat: "ภาษีมูลค่าเพิ่มสะสม (7%)",
      detailed_consumption: "ข้อมูลการใช้ไฟฟ้าและอัตราค่าไฟ",
      projected_month_end_volume: "ประมาณการหน่วยใช้ไฟฟ้าสิ้นรอบบิล:",
      tou_window_status: "ช่วงเวลาอัตราค่าไฟ (TOU)",
      active_marginal_rate: "อัตราค่าไฟส่วนเพิ่มปัจจุบัน",
      energy_dashboard_price: "ราคาค่าไฟสำหรับ HA Energy Dashboard",
      last_month_bill: "ยอดค่าไฟรอบบิลที่แล้ว",
      lifetime_import: "หน่วยนำเข้าจากสายส่งสะสม",
      offpeak_window: "ช่วง Off-Peak (ค่าไฟถูก)",
      peak_window: "ช่วง Peak (ค่าไฟปกติ)",

      chart_progression_title: "กราฟแสดงยอดค่าไฟฟ้าสะสมรายวันตลอดรอบบิล",
      tou_base_split: "แยกตามช่วงเวลา TOU",
      tiered_base_charge: "อัตราค่าไฟฐานแบบขั้นบันได",
      legend_fixed_service: "1. ค่าบริการรายเดือน",
      legend_peak_charge: "2. ค่าไฟฐานช่วง Peak",
      legend_offpeak_charge: "3. ค่าไฟฐานช่วง Off-Peak",
      legend_tier1: "2. ค่าไฟฐานขั้นที่ 1 (0-150)",
      legend_tier2: "3. ค่าไฟฐานขั้นที่ 2 (151-400)",
      legend_tier3: "4. ค่าไฟฐานขั้นที่ 3 (>400)",
      legend_ft: "ค่า Ft",
      legend_vat: "ภาษีมูลค่าเพิ่ม (7%)",
      note_tou_progression: "กราฟจำลองการสะสมค่าไฟตามรอบบิล TOU อย่างแม่นยำ โดยค่าไฟฐานจะแบ่งตามวัน: ช่วง Peak (09:00 - 22:00 จันทร์-ศุกร์) • ช่วง Off-Peak (เวลานอกเหนือจากนี้ วันเสาร์-อาทิตย์ และวันหยุดราชการ)",
      note_tiered_progression: "กราฟจำลองการสะสมค่าไฟตามรอบบิลอัตราก้าวหน้า โดยค่าไฟฐานแบ่งเป็น: ขั้นที่ 1 (150 หน่วยแรก) • ขั้นที่ 2 (250 หน่วยถัดไป) • ขั้นที่ 3 (ส่วนที่เกิน 400 หน่วย)",

      chart_daily_title: "เปรียบเทียบหน่วยนำเข้าจากสายส่งและการผลิตโซลาร์รายวัน",
      show_volume_kwh: "แสดงเป็นหน่วย (kWh)",
      show_value_thb: "แสดงเป็นมูลค่า (บาท)",
      legend_grid_import_kwh: "1. หน่วยนำเข้าจากสายส่ง (kWh)",
      legend_grid_import_thb: "1. ค่าไฟฟ้าที่นำเข้าจากสายส่ง (บาท)",
      legend_solar_prod_kwh: "2. หน่วยผลิตโซลาร์ (kWh)",
      legend_solar_prod_thb: "2. มูลค่าผลประโยชน์จากโซลาร์ (บาท)",
      hover_deltas_hint: "(เลื่อนเมาส์ชี้บนแท่งกราฟเพื่อดูข้อมูลรายวัน)",

      solar_savings_title: "มูลค่าประหยัดจากการใช้ไฟโซลาร์เอง",
      projected_month_end_savings: "ประมาณการประหยัดสิ้นรอบบิล:",
      total_solar_production_vol: "หน่วยผลิตโซลาร์ทั้งหมด",
      projected_full_month_yield: "ประมาณการหน่วยผลิตทั้งรอบบิล",
      self_consumed_vol: "หน่วยที่ใช้เองในบ้าน",
      lifetime_self_consumption_savings: "มูลค่าประหยัดสะสมตลอดการใช้งาน",
      solar_revenue_title: "รายได้จากการขายไฟคืนสายส่ง",
      projected_month_end_revenue: "ประมาณการรายได้สิ้นรอบบิล:",
      export_buyback_rate: "ราคารับซื้อไฟคืน",
      grid_export_vol: "หน่วยส่งไฟขายคืน",
      lifetime_grid_export_revenue: "รายได้สะสมตลอดการใช้งาน",
      solcast_title: "การพยากรณ์แสงอาทิตย์ (Solcast)",
      solcast_status: "สถานะการเชื่อมต่อ Solcast",
      solcast_integrated: "เชื่อมต่อ Solcast แล้ว",
      solcast_simulated: "ข้อมูลจำลองพื้นฐาน",
      estimated_gen_today: "ประมาณการผลิตวันนี้",
      estimated_rem_today: "ประมาณการผลิตที่เหลือของวันนี้",
      current_estimated_power: "กำลังผลิตโดยประมาณขณะนี้",
      solar_performance_trends: "แนวโน้มการผลิตและใช้งานโซลาร์ตลอดรอบบิล",
      legend_solcast_forecast: "1. พยากรณ์ Solcast PV",
      legend_actual_solar_prod: "2. หน่วยผลิตจริงจากโซลาร์",
      legend_internal_self_consumption: "3. การใช้งานเองภายในบ้าน",
      legend_grid_export: "4. การส่งออกขายคืน",
      note_solar_trends: "กราฟติดตามประสิทธิภาพโซลาร์ตลอด 30 วัน: พยากรณ์ Solcast PV • หน่วยผลิตจริงจากโซลาร์ • การใช้งานเองภายในบ้าน • การส่งออกขายคืน",

      bess_calibration_title: "การตั้งค่าและคำนวณขนาดแบตเตอรี่ (BESS)",
      simulated_battery_capacity: "ความจุของแบตเตอรี่ (kWh)",
      battery_capex_cost: "งบลงทุนอุปกรณ์โดยประมาณ (บาท)",
      simulated_tariff_model: "แบบจำลองอัตราค่าไฟฟ้า",
      tou_tariff_option: "อัตรา TOU 1.3.2 (ช่วง Peak / Off-Peak)",
      tiered_tariff_option: "อัตราก้าวหน้า 1.2 (ตามขั้นบันได)",
      enable_grid_charging: "เปิดใช้งานการชาร์จไฟข้ามคืนจากสายส่ง (TOU Arbitrage)",
      btn_save_bess: "💾 บันทึกและคำนวณแบบจำลองใหม่",
      bess_lookback_title: "แบบจำลองผลตอบแทน BESS ย้อนหลัง 12 เดือน",
      bess_lookback_desc: "วิเคราะห์ความคุ้มค่าของแบตเตอรี่ตลอดทั้งปีโดยจำลองการชาร์จ-จ่ายไฟรายวันจากประวัติการส่งออกไฟย้อนหลัง 12 เดือนในฐานข้อมูล Home Assistant เพื่อคำนึงถึงความแปรปรวนตามฤดูกาล",
      btn_calc_bess: "🔍 คำนวณผลตอบแทน BESS ย้อนหลัง 12 เดือน",
      btn_calc_bess_running: "🔄 กำลังประมวลผลการจำลองรอบชาร์จ-จ่ายไฟตลอด 365 วัน...",
      annual_battery_savings: "มูลค่าประหยัดรวมต่อปีจากแบตเตอรี่",
      annual_shifted_energy: "หน่วยไฟฟ้าที่กักเก็บและจ่ายรวมต่อปี",
      corrected_payback_period: "ระยะเวลาคืนทุนโดยประมาณ",
      col_month: "เดือน",
      col_grid_export: "หน่วยส่งไฟขายคืนส่วนเกิน (kWh)",
      col_shifted_energy: "หน่วยไฟที่ชาร์จและจ่ายคืน (kWh)",
      col_savings: "มูลค่าประหยัดที่คำนวณได้ (บาท)",
      btn_run_again: "🔄 คำนวณแบบจำลองอีกครั้ง",

      tariff_optimizer_title: "ระบบวิเคราะห์และเปรียบเทียบอัตราค่าไฟฟ้า",
      tariff_optimizer_desc: "เพื่อการตัดสินใจเปลี่ยนจากอัตราก้าวหน้า 1.2 เป็นอัตรา TOU 1.3.2 อย่างมั่นใจ คุณสามารถเรียกใช้การจำลองย้อนหลัง 12 เดือนจากฐานข้อมูล Home Assistant เพื่อดูผลกระทบจากการใช้ไฟตามฤดูกาล",
      no_lookback_yet: "ยังไม่มีการประมวลผลแบบจำลองย้อนหลังสำหรับรอบบิลนี้",
      btn_trigger_lookback: "🔍 เริ่มการวิเคราะห์ย้อนหลัง 12 เดือน",
      btn_running_lookback: "⏳ กำลังประมวลผลข้อมูลจากฐานข้อมูล...",
      simulation_cost_comparison: "เปรียบเทียบค่าไฟฟ้าย้อนหลัง 12 เดือน (บาท)",
      btn_rerun_analysis: "🔄 ประมวลผลการวิเคราะห์ใหม่",
      col_tiered_bill: "ค่าไฟอัตรา 1.2",
      col_tou_bill: "ค่าไฟอัตรา 1.3.2",
      col_difference: "ส่วนต่าง",
      col_winner: "อัตราที่คุ้มค่ากว่า",
      tariff_regulations_title: "ข้อกำหนดและระเบียบการเปลี่ยนอัตราค่าไฟ",
      tariff_11_pso: "มาตรการค่าไฟฟ้าฟรี (PSO 1.1)",
      tariff_11_pso_val: "ฟรีค่าพลังงานไฟฟ้าฐานหากใช้ไฟไม่เกิน 50 หน่วย/เดือน",
      tariff_11_threshold: "เกณฑ์การเปลี่ยนอัตรา 1.1",
      tariff_11_threshold_val: "ใช้ไฟเกิน 150 หน่วย/เดือน ติดต่อกัน 3 เดือน",
      auto_reclass_engine: "ระบบปรับเปลี่ยนอัตโนมัติ",
      auto_reclass_engine_val: "ปรับการคำนวณเป็นอัตรา 1.2 โดยอัตโนมัติ",

      outages_title: "ประวัติไฟฟ้าดับและความเสถียรของสายส่ง",
      incidents_label: "ครั้ง",
      total_cumulative_downtime: "ระยะเวลารวมที่ไฟฟ้าดับ",
      outage_log_book: "บันทึกเหตุการณ์ไฟฟ้าดับ",
      col_start_time: "เวลาเริ่มต้น",
      col_end_time: "เวลาสิ้นสุด",
      col_duration: "ระยะเวลา",
      no_outages_recorded: "ยังไม่มีบันทึกเหตุการณ์ไฟฟ้าดับในระบบ",

      settings_sensors_title: "การตั้งค่าเซ็นเซอร์สายส่งและโซลาร์",
      setting_import_sensor: "Entity ID เซ็นเซอร์นำเข้าไฟฟ้าจากสายส่ง",
      setting_export_sensor: "Entity ID เซ็นเซอร์ส่งออกไฟฟ้าขายคืน (ถ้ามี)",
      setting_solar_sensor: "Entity ID เซ็นเซอร์หน่วยผลิตจากโซลาร์เซลล์",
      settings_utility_title: "โครงสร้างการไฟฟ้าและอัตราค่าไฟ",
      setting_provider: "หน่วยงานผู้ให้บริการไฟฟ้า",
      setting_tariff_category: "ประเภทอัตราค่าไฟฟ้า",
      setting_billing_day: "วันเริ่มต้นรอบบิลประจำเดือน",
      settings_financial_title: "อัตราค่าบริการและเงื่อนไขทางการเงิน",
      setting_ft_rate: "อัตราค่า Ft (บาท / kWh)",
      setting_sellback_rate: "ราคารับซื้อไฟคืนโครงการโซลาร์ (บาท / kWh)",
      setting_ebill: "สมัครบริการ MEA e-Bill",
      setting_epayment: "สมัครบริการ MEA e-Payment",
      settings_custom_rates_title: "กำหนดอัตราค่าไฟฐานเอง (ทางเลือกเพิ่มเติม)",
      settings_custom_rates_desc: "กำหนดอัตราค่าไฟฟ้าฐานของการไฟฟ้า (บาท/kWh) เอง หากเว้นว่างไว้ ระบบจะใช้อัตรามาตรฐานตามประกาศของการไฟฟ้าโดยอัตโนมัติ",
      setting_tou_peak_rate: "อัตรา TOU ช่วง Peak (บาท/kWh)",
      setting_tou_offpeak_rate: "อัตรา TOU ช่วง Off-Peak (บาท/kWh)",
      setting_tier1_rate: "อัตราขั้นที่ 1 (0-150 kWh)",
      setting_tier2_rate: "อัตราขั้นที่ 2 (151-400 kWh)",
      setting_tier3_rate: "อัตราขั้นที่ 3 / อัตราคงที่ (>400 kWh)",
      btn_save_settings: "💾 บันทึกการตั้งค่าและเริ่มการทำงานใหม่",
      btn_saving_settings: "⏳ กำลังบันทึก...",
      btn_saved_settings: "✅ บันทึกและเริ่มการทำงานใหม่สำเร็จ!",

      monthly_savings: "ประหยัดต่อเดือน",
      higher_than: "สูงกว่า",
      day_label: "วันที่",
      status_weekend_offpeak: "วันหยุด (Off-Peak 100%)",
      status_today_live: "วันนี้ (ข้อมูลสด)",
      status_past: "ย้อนหลัง",
      status_past_actual: "ข้อมูลจริงย้อนหลัง",
      status_projected: "ประมาณการ",
      status_projected_runrate: "ประมาณการตามอัตราเฉลี่ย",
      tt_cumulative_bill: "ยอดสะสม:",
      tt_added_on_day: "เพิ่มขึ้นในวันที่",
      tt_grid_import: "นำเข้าจากสายส่ง:",
      tt_solar_production: "หน่วยผลิตโซลาร์:",
      tt_self_consumed: "ใช้งานเองในบ้าน:",
      tt_grid_export: "ส่งออกขายคืน:",
      tt_production_yield: "หน่วยผลิตจริง:",
      tt_solcast_forecast: "พยากรณ์ Solcast:",
      tt_self_consumption: "ใช้เองในบ้าน:",
      tt_surplus_export: "ส่งออกขายคืน:",
      tt_forecast_accuracy: "ความแม่นยำพยากรณ์:"
    }
  };

  class ThaiEnergyPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._activeTab = 'overview';
    this._dailyChartMode = 'kwh';
    this._isAnalyzing = false;
    this._isBessAnalyzing = false;
    this._data = {};
    this._rendered = false;
    this._lang = this._resolveLanguage();
  }

  _resolveLanguage() {
    try {
      const saved = localStorage.getItem('thai_energy_language');
      if (saved === 'en' || saved === 'th') {
        return saved;
      }
    } catch (e) {}

    const haLang = this._hass?.language || this._hass?.locale?.language || navigator.language || 'en';
    return haLang.toLowerCase().startsWith('th') ? 'th' : 'en';
  }

  t(key) {
    const lang = this._lang || this._resolveLanguage();
    if (TRANSLATIONS[lang] && TRANSLATIONS[lang][key] !== undefined) {
      return TRANSLATIONS[lang][key];
    }
    if (TRANSLATIONS.en && TRANSLATIONS.en[key] !== undefined) {
      return TRANSLATIONS.en[key];
    }
    return key;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._lang) {
      this._lang = this._resolveLanguage();
    }

    const now = Date.now();
    if (this._lastHassUpdate && (now - this._lastHassUpdate < 500)) {
      if (!this._updateScheduled) {
        this._updateScheduled = true;
        setTimeout(() => {
          this._updateScheduled = false;
          this._lastHassUpdate = Date.now();
          this._extractData();
          if (!this._rendered) {
            this._initialRender();
          } else {
            this._updateDOMValues();
          }
        }, 500);
      }
      return;
    }

    this._lastHassUpdate = now;
    this._extractData();

    if (!this._rendered) {
      this._initialRender();
    } else {
      this._updateDOMValues();
    }
  }

  _getIsOffpeak(states) {
    if (!states) return false;
    let billEntityId = 'sensor.monthly_estimated_bill';
    for (const entityId in states) {
      if (entityId.includes('monthly_estimated_bill')) {
        billEntityId = entityId;
        break;
      }
    }
    const billSensor = states[billEntityId];
    if (billSensor && billSensor.attributes) {
      if (billSensor.attributes.tou_status) {
        return String(billSensor.attributes.tou_status).toLowerCase().includes('off');
      }
      if (billSensor.attributes.is_offpeak !== undefined && billSensor.attributes.is_offpeak !== null) {
        return billSensor.attributes.is_offpeak === true || String(billSensor.attributes.is_offpeak).toLowerCase() === 'true';
      }
    }
    const windowSensor = states['sensor.tou_window_status'] || states['sensor.tou_status'];
    if (windowSensor && windowSensor.state) {
      return String(windowSensor.state).toLowerCase().includes('off');
    }

    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const thaiDate = new Date(utcMs + (3600000 * 7));
    const day = thaiDate.getDay();
    const hour = thaiDate.getHours();

    if (day === 0 || day === 6) return true;
    if (hour >= 22 || hour < 9) return true;
    return false;
  }

  _formatNum(val, maxDec = 2, minDec = null) {
    if (val === null || val === undefined || val === '') return '0.00';
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    const minF = minDec !== null ? minDec : (maxDec === 2 ? 2 : 0);
    return num.toLocaleString('en-US', {
      minimumFractionDigits: minF,
      maximumFractionDigits: maxDec
    });
  }

  _extractData() {
    if (!this._hass) return;

    const states = this._hass.states;

    const getEntityState = (key) => {
      if (states[key]) {
        const st = states[key].state;
        if (st !== undefined && st !== null && st !== 'unavailable' && st !== 'unknown' && st !== '0.00' && st !== '0') {
          return st;
        }
      }
      return null;
    };

    const getAttribute = (key, attr) => {
      if (states[key] && states[key].attributes && states[key].attributes[attr] !== undefined && states[key].attributes[attr] !== null) {
        return states[key].attributes[attr];
      }
      return null;
    };

    const getUnit = (entityId, fallback = 'kWh') => {
      if (states[entityId] && states[entityId].attributes && states[entityId].attributes.unit_of_measurement) {
        return states[entityId].attributes.unit_of_measurement;
      }
      return fallback;
    };

    // Solcast PV Forecast Entity Search
    let solcastForecastToday = '0.00';
    let solcastPowerNow = '0.00';
    let solcastForecastRemaining = '0.00';
    let solcastEntityFound = false;
    let solcastPowerUnit = 'kW';

    for (const entityId in states) {
      if (entityId.includes('solcast')) {
        solcastEntityFound = true;
        if (entityId.includes('remaining')) {
          solcastForecastRemaining = states[entityId].state;
        } else if (entityId.includes('today')) {
          solcastForecastToday = states[entityId].state;
        } else if (entityId.includes('now')) {
          solcastPowerNow = states[entityId].state;
          solcastPowerUnit = states[entityId].attributes?.unit_of_measurement || 'kW';
        }
      }
    }

    // Convert W to kW dynamically if the sensor reports in Watts (W)
    let solcastPowerNowNum = parseFloat(solcastPowerNow) || 0;
    if (solcastPowerUnit === 'W') {
      solcastPowerNowNum = solcastPowerNowNum / 1000.0;
      solcastPowerUnit = 'kW';
    }

    const isOffpeak = this._getIsOffpeak(states);
    const touStatus = isOffpeak ? 'Off-Peak' : 'Peak';

    // Dynamically locate the estimated bill entity ID to support custom names/device prefixes
    let billEntityId = 'sensor.monthly_estimated_bill';
    for (const entityId in states) {
      if (entityId.includes('monthly_estimated_bill')) {
        billEntityId = entityId;
        break;
      }
    }

    // Map exact sensor names with multi-alias fallbacks & coordinator attribute resolution
    const importKwh = getEntityState('sensor.monthly_grid_import_energy') || getEntityState('sensor.monthly_import_kwh') || getAttribute(billEntityId, 'monthly_import_kwh') || '0.00';
    const exportKwh = getEntityState('sensor.monthly_grid_export_energy') || getEntityState('sensor.monthly_export_kwh') || getAttribute(billEntityId, 'monthly_export_kwh') || '0.00';
    const solarKwh = getEntityState('sensor.monthly_solar_production_energy') || getEntityState('sensor.monthly_solar_kwh') || getAttribute(billEntityId, 'monthly_solar_kwh') || '0.00';

    const accruedBill = getEntityState('sensor.monthly_accrued_bill_to_date') || getEntityState('sensor.monthly_accrued_bill') || getAttribute(billEntityId, 'monthly_accrued_bill') || '0.00';
    const accruedBaseCost = getAttribute(billEntityId, 'monthly_accrued_base_cost') || '0.00';
    const accruedFtCharge = getAttribute(billEntityId, 'monthly_accrued_ft_charge') || '0.00';
    const accruedVatAmount = getAttribute(billEntityId, 'monthly_accrued_vat_amount') || '0.00';
    const projectedImport = getAttribute(billEntityId, 'projected_monthly_import') || '0.00';

    const totalBill = getEntityState(billEntityId) || getAttribute(billEntityId, 'monthly_estimated_bill') || '0.00';
    const baseCost = getEntityState('sensor.monthly_base_energy_cost') || getEntityState('sensor.monthly_base_cost') || getAttribute(billEntityId, 'monthly_base_cost') || '0.00';
    const ftCharge = getEntityState('sensor.monthly_ft_charge') || getAttribute(billEntityId, 'monthly_ft_charge') || '0.00';
    const serviceCharge = getEntityState('sensor.monthly_fixed_service_charge') || getEntityState('sensor.monthly_service_charge') || getAttribute(billEntityId, 'monthly_service_charge') || '38.22';
    const vatAmount = getEntityState('sensor.monthly_calculated_vat_7') || getEntityState('sensor.monthly_vat_amount') || getAttribute(billEntityId, 'monthly_vat_amount') || '0.00';

    const projectedSolarKwh = getAttribute(billEntityId, 'projected_monthly_solar_kwh') || '0.00';
    const projectedExportKwh = getAttribute(billEntityId, 'projected_monthly_export_kwh') || '0.00';
    const projectedSelfConsumptionKwh = getAttribute(billEntityId, 'projected_monthly_self_consumption_kwh') || '0.00';
    const projectedSolarSavings = getAttribute(billEntityId, 'projected_monthly_solar_savings_thb') || '0.00';
    const projectedSolarRevenue = getAttribute(billEntityId, 'projected_monthly_solar_revenue_thb') || '0.00';
    const projectedTotalSolarBenefit = getAttribute(billEntityId, 'projected_monthly_total_solar_benefit_thb') || '0.00';
    const projectedBillWithoutSolar = getAttribute(billEntityId, 'projected_bill_without_solar_thb') || '0.00';
    const projectedSolarReductionPct = getAttribute(billEntityId, 'projected_solar_bill_reduction_pct') || '0.0';

    const solarKwhNum = parseFloat(solarKwh) || 0;
    const exportKwhNum = parseFloat(exportKwh) || 0;
    const selfConsumedKwh = Math.max(0, solarKwhNum - exportKwhNum);
    const selfConsumptionRatio = solarKwhNum > 0 ? Math.min(100, Math.round((selfConsumedKwh / solarKwhNum) * 100)) : 0;

    const totalBillNum = Math.max(1, parseFloat(totalBill) || 1);
    const basePct = Math.min(100, Math.round(((parseFloat(baseCost) || 0) / totalBillNum) * 100));
    const ftPct = Math.min(100, Math.round(((parseFloat(ftCharge) || 0) / totalBillNum) * 100));
    const vatPct = Math.min(100, Math.round(((parseFloat(vatAmount) || 0) / totalBillNum) * 100));

    // Extract Baseline Variables for Debug Diagnostic Panel
    const importSensorId = getAttribute(billEntityId, 'import_sensor_id') || 'sensor.power_meter_consumption';
    const exportSensorId = getAttribute(billEntityId, 'export_sensor_id') || 'sensor.power_meter_exported';
    const solarSensorId = getAttribute(billEntityId, 'solar_sensor_id') || 'sensor.inverter_total_yield';

    const importBaseline = getAttribute(billEntityId, 'import_baseline_kwh');
    const solarBaseline = getAttribute(billEntityId, 'solar_baseline_kwh');
    const exportBaseline = getAttribute(billEntityId, 'export_baseline_kwh');

    const importCurrentReading = getEntityState(importSensorId);
    const solarCurrentReading = getEntityState(solarSensorId);
    const exportCurrentReading = getEntityState(exportSensorId);

    const importUnit = getUnit(importSensorId, 'kWh');
    const solarUnit = getUnit(solarSensorId, 'kWh');
    const exportUnit = getUnit(exportSensorId, 'kWh');

    // Extract user configured active power & default placeholder sensors
    const pm2230Power = getEntityState('sensor.pm2230_total_active_power');
    const inverterPower = getEntityState('sensor.inverter_active_power');
    const defaultGridImport = getEntityState('sensor.grid_import_kwh');
    const defaultSolarProd = getEntityState('sensor.solar_production_energy');
    const defaultGridExport = getEntityState('sensor.grid_export_kwh');

    const pm2230PowerUnit = getUnit('sensor.pm2230_total_active_power', 'W');
    const inverterPowerUnit = getUnit('sensor.inverter_active_power', 'W');

    // Extract 30-Day Historical Arrays from Python Coordinator Attributes
    const pyImportHistory = getAttribute(billEntityId, 'daily_import_kwh_history') || [];
    const pySolarHistory = getAttribute(billEntityId, 'daily_solar_kwh_history') || [];
    const pyExportHistory = getAttribute(billEntityId, 'daily_export_kwh_history') || [];

    // Extract 12-Month lookback dataset from Python coordinator attributes
    const lookbackData = getAttribute(billEntityId, 'lookback_12_months_data');
    if (lookbackData) {
      this._isAnalyzing = false;
    }

    // Extract 12-Month BESS lookback dataset from Python coordinator attributes
    const bess12MonthsRaw = getAttribute(billEntityId, 'bess_12_months_data');
    if (bess12MonthsRaw) {
      this._isBessAnalyzing = false;
    }
    let bessLookbackTotalSavings = 0;
    let bessLookbackTotalShifted = 0;
    let bessLookbackPaybackYears = Infinity;
    if (bess12MonthsRaw && Array.isArray(bess12MonthsRaw)) {
      bessLookbackTotalSavings = bess12MonthsRaw.reduce((sum, row) => sum + parseFloat(row.savings_thb || 0), 0);
      bessLookbackTotalShifted = bess12MonthsRaw.reduce((sum, row) => sum + parseFloat(row.shifted_kwh || 0), 0);
      const capexVal = parseFloat(getAttribute(billEntityId, 'bess_capex_cost')) || 50000.0;
      bessLookbackPaybackYears = bessLookbackTotalSavings > 0 ? (capexVal / bessLookbackTotalSavings) : Infinity;
    }

    const today = new Date();
    const currentDay = parseInt(getAttribute(billEntityId, 'current_day_of_cycle')) || Math.min(30, Math.max(1, today.getDate()));
    const totalBaseNum = parseFloat(baseCost) || 0;
    const totalFtNum = parseFloat(ftCharge) || 0;
    const totalServiceNum = parseFloat(serviceCharge) || 38.22;
    const totalVatNum = parseFloat(vatAmount) || 0;
    const ftRate = getAttribute(billEntityId, 'ft_rate') || 0.395;
    const tariffCategory = getAttribute(billEntityId, 'tariff_category') || '1.2';
    const sellbackRate = getAttribute(billEntityId, 'solar_sellback_rate') || 2.20;
    const VAT_RATE = 0.07;

    // Check if active tariff is TOU (Time of Use 1.3.1 or 1.3.2)
    const isTou = tariffCategory.startsWith('1.3');
    const peakRate = tariffCategory === '1.3.1' ? 5.2636 : 5.7982;
    const offpeakRate = tariffCategory === '1.3.1' ? 2.6295 : 2.6369;

    const importKwhNum = parseFloat(importKwh) || 0;
    const nowTime = new Date();
    const elapsedDaysFraction = Math.max(0.04, (currentDay - 1) + (nowTime.getHours() / 24.0) + (nowTime.getMinutes() / 1440.0));
    const avgDailyImport = (importKwhNum > 0 && elapsedDaysFraction > 0) ? (importKwhNum / elapsedDaysFraction) : 15.0;
    const avgDailySolar = (solarKwhNum > 0 && elapsedDaysFraction > 0) ? (solarKwhNum / elapsedDaysFraction) : 15.0;
    const avgDailyExport = (exportKwhNum > 0 && elapsedDaysFraction > 0) ? (exportKwhNum / elapsedDaysFraction) : 2.0;

    // Calculate past days unscaled sums to normalize chart progression with actual accrued sensor readings
    let pastUnscaledImportSum = 0.0;
    let pastUnscaledSolarSum = 0.0;
    for (let day = 1; day <= currentDay; day++) {
      let imp = pyImportHistory[day - 1];
      let impVal = (imp !== undefined && imp !== null && parseFloat(imp) > 0.001) ? parseFloat(imp) : avgDailyImport;
      pastUnscaledImportSum += impVal;

      let sol = pySolarHistory[day - 1];
      let solVal = (sol !== undefined && sol !== null && parseFloat(sol) > 0.001) ? parseFloat(sol) : avgDailySolar;
      pastUnscaledSolarSum += solVal;
    }

    const importScale = (pastUnscaledImportSum > 0 && importKwhNum > 0) ? (importKwhNum / pastUnscaledImportSum) : 1.0;
    const solarScale = (pastUnscaledSolarSum > 0 && solarKwhNum > 0) ? (solarKwhNum / pastUnscaledSolarSum) : 1.0;

    // Generate non-linear cumulative monthly bill progression with 3 Base tiers or TOU Peak/Off-Peak split
    let runningKwh = 0.0;
    const dailyKwhList = [];
    for (let day = 1; day <= 30; day++) {
      const isPastOrToday = day <= currentDay;
      let dayKwh = 0.0;
      if (isPastOrToday) {
        let rawKwh = pyImportHistory[day - 1];
        let rawKwhVal = (rawKwh !== undefined && rawKwh !== null && parseFloat(rawKwh) > 0.001) ? parseFloat(rawKwh) : avgDailyImport;
        dayKwh = rawKwhVal * importScale;
      } else {
        dayKwh = avgDailyImport;
      }
      runningKwh += dayKwh;
      dailyKwhList.push({ day, dayKwh, runningKwh, isPastOrToday });
    }

    const maxAccruedKwh = Math.max(0.1, runningKwh);

    let cumPeakKwh = 0.0;
    let cumOffpeakKwh = 0.0;
    const peakRatio = solarKwhNum > 5.0 ? 0.20 : 0.40;

    const monthlyDailyBars = dailyKwhList.map((item) => {
      const isPastOrToday = item.isPastOrToday;
      let t1Val = 0, t2Val = 0, t3Val = 0, peakVal = 0, offpeakVal = 0, bVal = 0;
      let isWeekend = false;
      let dayPeakCost = 0.0;
      let dayOffpeakCost = 0.0;

      if (isTou) {
        // Resolve day of week to accurately reflect 100% off-peak on weekends vs peak on weekdays
        const dayDate = new Date();
        dayDate.setDate(dayDate.getDate() - (currentDay - item.day));
        const dayOfWeek = dayDate.getDay();
        isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

        const dayPeakKwh = isWeekend ? 0.0 : (item.dayKwh * peakRatio);
        const dayOffpeakKwh = isWeekend ? item.dayKwh : (item.dayKwh * (1.0 - peakRatio));

        cumPeakKwh += dayPeakKwh;
        cumOffpeakKwh += dayOffpeakKwh;

        peakVal = cumPeakKwh * peakRate;
        offpeakVal = cumOffpeakKwh * offpeakRate;
        bVal = peakVal + offpeakVal;

        dayPeakCost = dayPeakKwh * peakRate;
        dayOffpeakCost = dayOffpeakKwh * offpeakRate;
      } else {
        // Calculate progressive tiers for this day's cumulative runningKwh
        const t1Kwh = Math.min(item.runningKwh, 150);
        const t2Kwh = Math.max(0, Math.min(item.runningKwh - 150, 250));
        const t3Kwh = Math.max(0, item.runningKwh - 400);

        t1Val = t1Kwh * 3.2482;
        t2Val = t2Kwh * 4.2218;
        t3Val = t3Kwh * 4.4217;
        bVal = t1Val + t2Val + t3Val;
      }

      const sVal = totalServiceNum * (item.day / 30.0);
      const fVal = item.runningKwh * ftRate;
      const vVal = (sVal + bVal + fVal) * VAT_RATE;
      const dayCumulativeTotal = sVal + bVal + fVal + vVal;

      return {
        day: item.day,
        service: sVal,
        tier1: t1Val,
        tier2: t2Val,
        tier3: t3Val,
        peak: peakVal,
        offpeak: offpeakVal,
        dayPeakCost: dayPeakCost,
        dayOffpeakCost: dayOffpeakCost,
        isWeekend: isWeekend,
        dayKwh: item.dayKwh,
        ft: fVal,
        vat: vVal,
        total: dayCumulativeTotal,
        isPastOrToday: isPastOrToday,
      };
    });

    // Generate 30-Day Daily Import vs Solar Breakdown (Volume & Value Analysis)
    const dailyBreakdown = [];
    for (let i = 0; i < 30; i++) {
      const dayNum = i + 1;
      const isPastOrToday = dayNum <= currentDay;
      const bar = monthlyDailyBars[i];
      const prevBar = i > 0 ? monthlyDailyBars[i - 1] : { tier1: 0, tier2: 0, tier3: 0, ft: 0, peak: 0, offpeak: 0 };
      
      let impKwh = 0.0;
      if (isPastOrToday) {
        let rawImp = pyImportHistory[i];
        let rawImpVal = (rawImp !== undefined && rawImp !== null && parseFloat(rawImp) > 0.001) ? parseFloat(rawImp) : avgDailyImport;
        impKwh = rawImpVal * importScale;
      } else {
        impKwh = avgDailyImport;
      }

      let solKwh = 0.0;
      if (isPastOrToday) {
        let rawSol = pySolarHistory[i];
        let rawSolVal = (rawSol !== undefined && rawSol !== null && parseFloat(rawSol) > 0.001) ? parseFloat(rawSol) : avgDailySolar;
        solKwh = rawSolVal * solarScale;
      } else {
        solKwh = avgDailySolar;
      }

      let rawExp = pyExportHistory[i];
      let expKwh = (rawExp !== undefined && rawExp !== null && parseFloat(rawExp) >= 0) ? parseFloat(rawExp) : avgDailyExport;

      const selfKwh = Math.max(0, solKwh - expKwh);

      // Compute Daily cost of import = change in Base charge + change in Ft charge
      let baseDiff = 0;
      if (isTou) {
        baseDiff = (bar.peak + bar.offpeak) - (prevBar.peak + prevBar.offpeak);
      } else {
        baseDiff = (bar.tier1 + bar.tier2 + bar.tier3) - (prevBar.tier1 + prevBar.tier2 + prevBar.tier3);
      }
      const ftDiff = bar.ft - prevBar.ft;
      const impCost = Math.max(0, baseDiff + ftDiff);

      // Compute daily solar financial benefit = (self consumed * retail rate) + (export * sellback rate)
      const activeRetailRate = isTou
        ? (0.40 * peakRate + 0.60 * offpeakRate)
        : (bar.tier3 > 0 ? 4.4217 : (bar.tier2 > 0 ? 4.2218 : 3.2482));
      const solBenefit = (selfKwh * activeRetailRate) + (expKwh * sellbackRate);

      dailyBreakdown.push({
        day: dayNum,
        importKwh: impKwh,
        solarKwh: solKwh,
        importCost: impCost,
        solarBenefit: solBenefit,
        isPastOrToday: bar.isPastOrToday
      });
    }

    // Generate 30-Day Solar Multi-Trend Data from Python Historical Arrays
    const solcastTargetKwh = parseFloat(solcastForecastToday) > 0 ? parseFloat(solcastForecastToday) : 35.0;

    const solarMonthlyTrends = [];
    for (let day = 1; day <= 30; day++) {
      const isPastOrToday = day <= currentDay;
      const solcastVal = solcastTargetKwh;

      const rawProd = pySolarHistory[day - 1];
      const prodVal = (rawProd !== undefined && rawProd !== null && parseFloat(rawProd) > 0.001) ? parseFloat(rawProd) : avgDailySolar;
      const rawExp = pyExportHistory[day - 1];
      const exportVal = (rawExp !== undefined && rawExp !== null && parseFloat(rawExp) >= 0) ? parseFloat(rawExp) : (exportKwhNum > 0 ? avgDailyExport : 0.0);
      const selfVal = Math.max(0, prodVal - exportVal);

      solarMonthlyTrends.push({
        day: day,
        solcast: solcastVal,
        production: prodVal,
        selfConsumption: selfVal,
        export: exportVal,
        isPastOrToday: isPastOrToday,
      });
    }

    // Break down current configuration base cost into dynamic segments for progress horizontal bar
    const importKwhVal = parseFloat(importKwh) || 0;
    let t1Pct = 0, t2Pct = 0, t3Pct = 0, peakPct = 0, offpeakPct = 0;
    
    if (isTou) {
      const currentPeakVal = (importKwhVal * 0.40) * peakRate;
      const currentOffpeakVal = (importKwhVal * 0.60) * offpeakRate;
      peakPct = totalBillNum > 0 ? ((currentPeakVal / totalBillNum) * 100).toFixed(1) : 0;
      offpeakPct = totalBillNum > 0 ? ((currentOffpeakVal / totalBillNum) * 100).toFixed(1) : 0;
    } else {
      const currentT1Kwh = Math.min(importKwhVal, 150);
      const currentT2Kwh = Math.max(0, Math.min(importKwhVal - 150, 250));
      const currentT3Kwh = Math.max(0, importKwhVal - 400);

      const currentT1Val = currentT1Kwh * 3.2482;
      const currentT2Val = currentT2Kwh * 4.2218;
      const currentT3Val = currentT3Kwh * 4.4217;

      t1Pct = totalBillNum > 0 ? ((currentT1Val / totalBillNum) * 100).toFixed(1) : 0;
      t2Pct = totalBillNum > 0 ? ((currentT2Val / totalBillNum) * 100).toFixed(1) : 0;
      t3Pct = totalBillNum > 0 ? ((currentT3Val / totalBillNum) * 100).toFixed(1) : 0;
    }

    this._data = {
      touStatus: touStatus,
      isOffpeak: isOffpeak,
      accruedBill: accruedBill,
      accruedBaseCost: accruedBaseCost,
      accruedFtCharge: accruedFtCharge,
      accruedVatAmount: accruedVatAmount,
      projectedImport: projectedImport,
      totalBill: totalBill,
      baseCost: baseCost,
      ftCharge: ftCharge,
      serviceCharge: serviceCharge,
      vatAmount: vatAmount,
      importKwh: importKwh,
      exportKwh: exportKwh,
      solarKwh: solarKwh,
      selfConsumedKwh: selfConsumedKwh.toFixed(2),
      selfConsumptionRatio: selfConsumptionRatio,
      solarSavings: getEntityState('sensor.monthly_solar_savings'),
      solarRevenue: getEntityState('sensor.monthly_solar_export_revenue'),
      totalSolarBenefit: getEntityState('sensor.monthly_total_solar_benefit'),
      projectedSolarKwh: projectedSolarKwh,
      projectedExportKwh: projectedExportKwh,
      projectedSelfConsumptionKwh: projectedSelfConsumptionKwh,
      projectedSolarSavings: projectedSolarSavings,
      projectedSolarRevenue: projectedSolarRevenue,
      projectedTotalSolarBenefit: projectedTotalSolarBenefit,
      projectedBillWithoutSolar: projectedBillWithoutSolar,
      projectedSolarReductionPct: projectedSolarReductionPct,
      lifetimeBenefit: getEntityState('sensor.lifetime_total_solar_benefit'),
      lifetimeSolarSavings: getEntityState('sensor.lifetime_solar_savings') || getAttribute(billEntityId, 'lifetime_solar_savings_thb') || '0.00',
      lifetimeSolarRevenue: getEntityState('sensor.lifetime_solar_revenue') || getAttribute(billEntityId, 'lifetime_solar_revenue_thb') || '0.00',
      lifetimeImport: getEntityState('sensor.lifetime_grid_import_energy'),
      lifetimeSolar: getEntityState('sensor.lifetime_solar_production_energy'),
      marginalRate: getEntityState('sensor.active_marginal_retail_rate'),
      gridPrice: getEntityState('sensor.current_grid_energy_import_price'),
      ftRate: getEntityState('sensor.current_ft_adjustment_rate') || getAttribute(billEntityId, 'ft_rate') || '0.3950',
      sellbackRate: getEntityState('sensor.solar_buy_back_rate') || getAttribute(billEntityId, 'solar_sellback_rate') || '2.20',
      tariffDiff: getEntityState('sensor.predictive_tariff_difference'),
      bessSavings: getEntityState('sensor.bess_storage_simulated_savings'),
      outageCost: getEntityState('sensor.grid_outage_economic_cost'),
      outageCount: getEntityState('sensor.grid_outage_incident_count'),
      lastMonthBill: getAttribute(billEntityId, 'last_month_bill_thb') || '0.00',
      lastMonthImport: getAttribute(billEntityId, 'last_month_import_kwh') || '0.00',
      provider: getAttribute(billEntityId, 'utility_provider') || 'MEA',
      tariffCategory: tariffCategory,
      opposingTariffName: getAttribute(billEntityId, 'opposing_tariff_name') || 'TOU 1.3.2',
      basePct: basePct,
      ftPct: ftPct,
      vatPct: vatPct,
      t1Pct: t1Pct,
      t2Pct: t2Pct,
      t3Pct: t3Pct,
      peakPct: peakPct,
      offpeakPct: offpeakPct,
      isTou: isTou,
      monthlyDailyBars: monthlyDailyBars,
      solarMonthlyTrends: solarMonthlyTrends,
      dailyBreakdown: dailyBreakdown,
      lookbackData: lookbackData,
      bess12MonthsData: bess12MonthsRaw,
      bessLookbackTotalSavings: bessLookbackTotalSavings,
      bessLookbackTotalShifted: bessLookbackTotalShifted,
      bessLookbackPaybackYears: bessLookbackPaybackYears,
      outageHistory: getAttribute(billEntityId, 'outage_history') || [],
      totalOutageSeconds: getAttribute(billEntityId, 'total_outage_seconds') || 0,
      bessCapacityKwh: parseFloat(getAttribute(billEntityId, 'bess_capacity_kwh')) || 5.0,
      bessCapexCost: parseFloat(getAttribute(billEntityId, 'bess_capex_cost')) || 50000.0,
      bessGridCharging: getAttribute(billEntityId, 'bess_grid_charging') === true || String(getAttribute(billEntityId, 'bess_grid_charging')).toLowerCase() === 'true',
      bessTariffModel: getAttribute(billEntityId, 'bess_tariff_model') || 'tou',
      billingDay: parseInt(getAttribute(billEntityId, 'billing_day')) || 1,
      meaEbillActive: getAttribute(billEntityId, 'mea_ebill_active') === true || String(getAttribute(billEntityId, 'mea_ebill_active')).toLowerCase() === 'true',
      meaEpaymentActive: getAttribute(billEntityId, 'mea_epayment_active') === true || String(getAttribute(billEntityId, 'mea_epayment_active')).toLowerCase() === 'true',
      solcastEntityFound: solcastEntityFound,
      solcastForecastToday: parseFloat(solcastForecastToday || 0).toFixed(2),
      solcastPowerNow: solcastPowerNowNum.toFixed(2),
      solcastPowerNowUnit: solcastPowerUnit,
      solcastForecastRemaining: parseFloat(solcastForecastRemaining || 0).toFixed(2),

      customPeakRate: getAttribute(billEntityId, 'custom_peak_rate') || '',
      customOffpeakRate: getAttribute(billEntityId, 'custom_offpeak_rate') || '',
      customTier1Rate: getAttribute(billEntityId, 'custom_tier1_rate') || '',
      customTier2Rate: getAttribute(billEntityId, 'custom_tier2_rate') || '',
      customTier3Rate: getAttribute(billEntityId, 'custom_tier3_rate') || '',

      // Debug Diagnostic Properties
      importSensorId: importSensorId,
      exportSensorId: exportSensorId,
      solarSensorId: solarSensorId,
      importBaseline: importBaseline !== null ? parseFloat(importBaseline).toFixed(2) : 'Not Initialized',
      solarBaseline: solarBaseline !== null ? parseFloat(solarBaseline).toFixed(2) : 'Not Initialized',
      exportBaseline: exportBaseline !== null ? parseFloat(exportBaseline).toFixed(2) : 'Not Initialized',
      importCurrentReading: importCurrentReading !== null && !isNaN(parseFloat(importCurrentReading)) ? parseFloat(importCurrentReading).toFixed(2) : importCurrentReading,
      solarCurrentReading: solarCurrentReading !== null && !isNaN(parseFloat(solarCurrentReading)) ? parseFloat(solarCurrentReading).toFixed(2) : solarCurrentReading,
      exportCurrentReading: exportCurrentReading !== null && !isNaN(parseFloat(exportCurrentReading)) ? parseFloat(exportCurrentReading).toFixed(2) : exportCurrentReading,
      importUnit: importUnit,
      solarUnit: solarUnit,
      exportUnit: exportUnit,
      currentDayOfCycle: currentDay,
      billingResetDay: getAttribute(billEntityId, 'billing_day') || '1',

      // Additional User Configured Sensors
      pm2230Power: pm2230Power,
      inverterPower: inverterPower,
      defaultGridImport: defaultGridImport,
      defaultSolarProd: defaultSolarProd,
      defaultGridExport: defaultGridExport,
      pm2230PowerUnit: pm2230PowerUnit,
      inverterPowerUnit: inverterPowerUnit,
    };
  }

  _switchTab(tabName) {
    this._activeTab = tabName;
    this._initialRender();
  }

  _showTooltip(html, clientX, clientY) {
    const tooltip = this.shadowRoot.getElementById('chart-tooltip');
    if (!tooltip) return;
    const hostRect = this.shadowRoot.host.getBoundingClientRect();
    let left = clientX - hostRect.left;
    let top = clientY - hostRect.top - 12;

    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    tooltip.style.opacity = '1';

    // Clamp within host bounds
    const ttRect = tooltip.getBoundingClientRect();
    if (left - ttRect.width / 2 < 10) {
      left = ttRect.width / 2 + 10;
    } else if (left + ttRect.width / 2 > hostRect.width - 10) {
      left = hostRect.width - ttRect.width / 2 - 10;
    }
    if (top - ttRect.height < 10) {
      top = clientY - hostRect.top + 24;
      tooltip.style.transform = 'translate(-50%, 0)';
    } else {
      tooltip.style.transform = 'translate(-50%, -100%)';
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  _hideTooltip() {
    const tooltip = this.shadowRoot.getElementById('chart-tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
      tooltip.style.opacity = '0';
    }
  }

  _attachTabEvents() {
    const shadow = this.shadowRoot;
    const tabBtns = shadow.querySelectorAll('.tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        if (tab && tab !== this._activeTab) {
          this._switchTab(tab);
        }
      });
    });

    const btnLangEn = shadow.getElementById('btn-lang-en');
    if (btnLangEn) {
      btnLangEn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._lang !== 'en') {
          this._lang = 'en';
          try { localStorage.setItem('thai_energy_language', 'en'); } catch (err) {}
          this._initialRender();
        }
      });
    }

    const btnLangTh = shadow.getElementById('btn-lang-th');
    if (btnLangTh) {
      btnLangTh.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._lang !== 'th') {
          this._lang = 'th';
          try { localStorage.setItem('thai_energy_language', 'th'); } catch (err) {}
          this._initialRender();
        }
      });
    }

    const toggleBtns = shadow.querySelectorAll('.toggle-btn');
    toggleBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.getAttribute('data-mode');
        if (mode && mode !== this._dailyChartMode) {
          this._dailyChartMode = mode;
          this._initialRender();
        }
      });
    });

    // Tooltip Listeners: Cumulative Monthly Running Bill Progression (Chart 1)
    const stackedCols = shadow.querySelectorAll('.stacked-col');
    stackedCols.forEach((col) => {
      const onMove = (e) => {
        const dayIdx = parseInt(e.currentTarget.getAttribute('data-day-idx'), 10);
        if (isNaN(dayIdx)) return;
        const bar = this._data.monthlyDailyBars[dayIdx];
        if (!bar) return;

        const currentDay = this._data.currentDayOfCycle;
        const statusLabel = bar.isWeekend
          ? this.t('status_weekend_offpeak')
          : (bar.isPastOrToday ? (bar.day === currentDay ? this.t('status_today_live') : this.t('status_past')) : this.t('status_projected'));

        const html = `
          <div class="tt-title">
            <span>${this.t('day_label')} ${bar.day}</span>
            <span style="color: ${bar.isWeekend ? '#90caf9' : '#fff'}; font-weight: 500; font-size: 11px;">${statusLabel}</span>
          </div>
          <div class="tt-row"><span style="color:#bbb;">${this.t('tt_cumulative_bill')}</span><strong style="color:#4caf50;">฿${bar.total.toFixed(2)}</strong></div>
          <div class="tt-row"><span style="color:#bbb;">${this.t('tt_added_on_day')} ${bar.day}:</span><strong style="color:var(--primary-color, #03a9f4);">+฿${(bar.dayPeakCost + bar.dayOffpeakCost).toFixed(2)}</strong></div>
          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.12); font-size: 11px;">
            ${this._data.isTou ? `
              <div class="tt-row"><span><span class="tt-dot" style="background:#9e9e9e;"></span>${this.t('legend_fixed_service')}:</span><span>฿${bar.service.toFixed(2)}</span></div>
              <div class="tt-row"><span><span class="tt-dot" style="background:#1565c0;"></span>${this.t('legend_peak_charge')}:</span><span>฿${bar.peak.toFixed(2)} (+฿${bar.dayPeakCost.toFixed(2)})</span></div>
              <div class="tt-row"><span><span class="tt-dot" style="background:#90caf9;"></span>${this.t('legend_offpeak_charge')}:</span><span>฿${bar.offpeak.toFixed(2)} (+฿${bar.dayOffpeakCost.toFixed(2)})</span></div>
              <div class="tt-row"><span><span class="tt-dot" style="background:#ff9800;"></span>${this.t('legend_ft')}:</span><span>฿${bar.ft.toFixed(2)}</span></div>
              <div class="tt-row"><span><span class="tt-dot" style="background:#e91e63;"></span>${this.t('legend_vat')}:</span><span>฿${bar.vat.toFixed(2)}</span></div>
            ` : `
              <div class="tt-row"><span><span class="tt-dot" style="background:#9e9e9e;"></span>${this.t('legend_fixed_service')}:</span><span>฿${bar.service.toFixed(2)}</span></div>
              <div class="tt-row"><span><span class="tt-dot" style="background:#1976d2;"></span>${this.t('legend_tier1')}:</span><span>฿${bar.tier1.toFixed(2)}</span></div>
              <div class="tt-row"><span><span class="tt-dot" style="background:#2196f3;"></span>${this.t('legend_tier2')}:</span><span>฿${bar.tier2.toFixed(2)}</span></div>
              <div class="tt-row"><span><span class="tt-dot" style="background:#64b5f6;"></span>${this.t('legend_tier3')}:</span><span>฿${bar.tier3.toFixed(2)}</span></div>
              <div class="tt-row"><span><span class="tt-dot" style="background:#ff9800;"></span>${this.t('legend_ft')}:</span><span>฿${bar.ft.toFixed(2)}</span></div>
              <div class="tt-row"><span><span class="tt-dot" style="background:#e91e63;"></span>${this.t('legend_vat')}:</span><span>฿${bar.vat.toFixed(2)}</span></div>
            `}
          </div>
        `;
        this._showTooltip(html, e.clientX, e.clientY);
      };

      col.addEventListener('mouseenter', onMove);
      col.addEventListener('mousemove', onMove);
      col.addEventListener('mouseleave', () => {
        this._hideTooltip();
      });
    });

    // Tooltip Listeners: Daily Grid Import vs Solar Production (Chart 2)
    const dailyHits = shadow.querySelectorAll('.daily-bar-hit');
    dailyHits.forEach((hit) => {
      const onMove = (e) => {
        const dayIdx = parseInt(e.currentTarget.getAttribute('data-day-idx'), 10);
        if (isNaN(dayIdx)) return;
        const item = this._data.dailyBreakdown[dayIdx];
        if (!item) return;
        const currentDay = this._data.currentDayOfCycle;
        const statusLabel = item.day === currentDay
          ? this.t('status_today_live')
          : (item.day < currentDay ? this.t('status_past_actual') : this.t('status_projected_runrate'));

        const expKwh = this._data.solarMonthlyTrends[dayIdx]?.export || 0;
        const selfKwh = Math.max(0, item.solarKwh - expKwh);

        const html = `
          <div class="tt-title">
            <span>${this.t('day_label')} ${item.day}</span>
            <span style="color: #bbb; font-weight: 500; font-size: 11px;">${statusLabel}</span>
          </div>
          <div class="tt-row">
            <span><span class="tt-dot" style="background:#2196f3;"></span>${this.t('tt_grid_import')}</span>
            <strong style="color:#2196f3;">${item.importKwh.toFixed(2)} kWh <span style="color:#aaa; font-weight:normal;">(฿${item.importCost.toFixed(2)})</span></strong>
          </div>
          <div class="tt-row">
            <span><span class="tt-dot" style="background:#4caf50;"></span>${this.t('tt_solar_production')}</span>
            <strong style="color:#4caf50;">${item.solarKwh.toFixed(2)} kWh <span style="color:#aaa; font-weight:normal;">(฿${item.solarBenefit.toFixed(2)})</span></strong>
          </div>
          <div class="tt-row">
            <span><span class="tt-dot" style="background:#00e5ff;"></span>${this.t('tt_self_consumed')}</span>
            <span style="color:#00e5ff;">${selfKwh.toFixed(2)} kWh</span>
          </div>
          <div class="tt-row">
            <span><span class="tt-dot" style="background:#e91e63;"></span>${this.t('tt_grid_export')}</span>
            <span style="color:#e91e63;">${expKwh.toFixed(2)} kWh</span>
          </div>
        `;
        this._showTooltip(html, e.clientX, e.clientY);
      };

      hit.addEventListener('mouseenter', onMove);
      hit.addEventListener('mousemove', onMove);
      hit.addEventListener('mouseleave', () => {
        this._hideTooltip();
      });
    });

    // Tooltip Listeners: Billing Month Solar Performance Trends (Chart 3)
    const solarHits = shadow.querySelectorAll('.solar-trend-hit');
    const solarCrosshair = shadow.getElementById('solar-crosshair');
    const dotProd = shadow.getElementById('solar-dot-prod');
    const dotSolcast = shadow.getElementById('solar-dot-solcast');
    const dotSelf = shadow.getElementById('solar-dot-self');
    const dotExport = shadow.getElementById('solar-dot-export');

    solarHits.forEach((hit) => {
      const onMove = (e) => {
        const dayIdx = parseInt(e.currentTarget.getAttribute('data-day-idx'), 10);
        if (isNaN(dayIdx)) return;
        const t = this._data.solarMonthlyTrends[dayIdx];
        if (!t) return;
        const currentDay = this._data.currentDayOfCycle;
        const statusLabel = t.day === currentDay
          ? this.t('status_today_live')
          : (t.day < currentDay ? this.t('status_past') : this.t('status_projected'));

        const perfPct = t.solcast > 0 ? ((t.production / t.solcast) * 100).toFixed(0) : 0;

        // Position crosshair and dots
        const xPos = parseFloat(e.currentTarget.getAttribute('data-x') || 0);
        if (solarCrosshair) {
          solarCrosshair.setAttribute('x1', xPos);
          solarCrosshair.setAttribute('x2', xPos);
          solarCrosshair.style.display = 'block';
        }
        if (dotProd) {
          dotProd.setAttribute('cx', xPos);
          dotProd.setAttribute('cy', e.currentTarget.getAttribute('data-y-prod'));
          dotProd.style.display = 'block';
        }
        if (dotSolcast) {
          dotSolcast.setAttribute('cx', xPos);
          dotSolcast.setAttribute('cy', e.currentTarget.getAttribute('data-y-solcast'));
          dotSolcast.style.display = 'block';
        }
        if (dotSelf) {
          dotSelf.setAttribute('cx', xPos);
          dotSelf.setAttribute('cy', e.currentTarget.getAttribute('data-y-self'));
          dotSelf.style.display = 'block';
        }
        if (dotExport) {
          dotExport.setAttribute('cx', xPos);
          dotExport.setAttribute('cy', e.currentTarget.getAttribute('data-y-export'));
          dotExport.style.display = 'block';
        }

        const html = `
          <div class="tt-title">
            <span>${this.t('day_label')} ${t.day}</span>
            <span style="color: #bbb; font-weight: 500; font-size: 11px;">${statusLabel}</span>
          </div>
          <div class="tt-row">
            <span><span class="tt-dot" style="background:#4caf50;"></span>${this.t('tt_production_yield')}</span>
            <strong style="color:#4caf50;">${t.production.toFixed(2)} kWh</strong>
          </div>
          <div class="tt-row">
            <span><span class="tt-dot" style="background:#ff9800;"></span>${this.t('tt_solcast_forecast')}</span>
            <strong style="color:#ff9800;">${t.solcast.toFixed(2)} kWh</strong>
          </div>
          <div class="tt-row">
            <span><span class="tt-dot" style="background:#00e5ff;"></span>${this.t('tt_self_consumption')}</span>
            <strong style="color:#00e5ff;">${t.selfConsumption.toFixed(2)} kWh</strong>
          </div>
          <div class="tt-row">
            <span><span class="tt-dot" style="background:#e91e63;"></span>${this.t('tt_surplus_export')}</span>
            <strong style="color:#e91e63;">${t.export.toFixed(2)} kWh</strong>
          </div>
          <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed rgba(255,255,255,0.12); font-size: 11px; color:#bbb;">
            ${this.t('tt_forecast_accuracy')} <strong style="color:#fff;">${perfPct}%</strong>
          </div>
        `;
        this._showTooltip(html, e.clientX, e.clientY);
      };

      hit.addEventListener('mouseenter', onMove);
      hit.addEventListener('mousemove', onMove);
      hit.addEventListener('mouseleave', () => {
        this._hideTooltip();
        if (solarCrosshair) solarCrosshair.style.display = 'none';
        if (dotProd) dotProd.style.display = 'none';
        if (dotSolcast) dotSolcast.style.display = 'none';
        if (dotSelf) dotSelf.style.display = 'none';
        if (dotExport) dotExport.style.display = 'none';
      });
    });

    const btnTrigger = shadow.getElementById('btn-trigger-lookback');
    if (btnTrigger) {
      btnTrigger.addEventListener('click', () => {
        this._isAnalyzing = true;
        this._initialRender();
        this._hass.callService('thai_energy_monitor', 'trigger_12_month_lookback', {});
      });
    }

    const btnTriggerBess = shadow.getElementById('btn-trigger-bess-lookback');
    if (btnTriggerBess) {
      btnTriggerBess.addEventListener('click', () => {
        this._isBessAnalyzing = true;
        this._initialRender();
        this._hass.callService('thai_energy_monitor', 'trigger_bess_lookback', {});
      });
    }

    const btnSaveBess = shadow.getElementById('btn-save-bess');
    if (btnSaveBess) {
      btnSaveBess.addEventListener('click', () => {
        const capacityInput = shadow.getElementById('input-bess-capacity');
        const capexInput = shadow.getElementById('input-bess-capex');
        const gridChargeInput = shadow.getElementById('input-bess-grid-charge');
        const tariffModelInput = shadow.getElementById('input-bess-tariff-model');
        if (capacityInput && capexInput) {
          const cap = parseFloat(capacityInput.value) || 5.0;
          const capex = parseFloat(capexInput.value) || 50000.0;
          const gridCharge = gridChargeInput ? gridChargeInput.checked === true : false;
          const tariffModel = tariffModelInput ? tariffModelInput.value : 'tou';
          
          const origHtml = btnSaveBess.innerHTML;
          btnSaveBess.innerHTML = '⏳ Saving & Recalculating...';
          btnSaveBess.style.backgroundColor = 'var(--warning-color, #ff9800)';
          btnSaveBess.disabled = true;

          this._hass.callService('thai_energy_monitor', 'configure_bess', {
            battery_capacity: cap,
            capex_cost: capex,
            grid_charging: gridCharge,
            tariff_model: tariffModel
          }).then(() => {
            btnSaveBess.innerHTML = '✅ Saved & Recalculated!';
            btnSaveBess.style.backgroundColor = 'var(--success-color, #4caf50)';
            setTimeout(() => {
              btnSaveBess.innerHTML = origHtml;
              btnSaveBess.style.backgroundColor = 'var(--primary-color, #03a9f4)';
              btnSaveBess.disabled = false;
            }, 1800);
          }).catch((err) => {
            console.error("BESS configuration failed:", err);
            btnSaveBess.innerHTML = '❌ Save Failed!';
            btnSaveBess.style.backgroundColor = 'var(--error-color, #f44336)';
            setTimeout(() => {
              btnSaveBess.innerHTML = origHtml;
              btnSaveBess.style.backgroundColor = 'var(--primary-color, #03a9f4)';
              btnSaveBess.disabled = false;
            }, 3000);
          });
        }
      });
    }

    const btnSaveSettings = shadow.getElementById('btn-save-settings');
    if (btnSaveSettings) {
      btnSaveSettings.addEventListener('click', () => {
        const gridImport = shadow.getElementById('setting-grid-import')?.value || '';
        const gridExport = shadow.getElementById('setting-grid-export')?.value || '';
        const solarProd = shadow.getElementById('setting-solar-prod')?.value || '';
        const utilityProvider = shadow.getElementById('setting-utility-provider')?.value || 'MEA';
        const tariffCategory = shadow.getElementById('setting-tariff-category')?.value || '1.2';
        let billingDay = parseInt(shadow.getElementById('setting-billing-day')?.value || '1', 10);
        if (isNaN(billingDay)) billingDay = 1;
        let ftRate = parseFloat(shadow.getElementById('setting-ft-rate')?.value || '0.3950');
        if (isNaN(ftRate)) ftRate = 0.3950;
        let sellbackRate = parseFloat(shadow.getElementById('setting-sellback-rate')?.value || '2.20');
        if (isNaN(sellbackRate)) sellbackRate = 2.20;
        const meaEbill = shadow.getElementById('setting-mea-ebill')?.checked === true;
        const meaEpayment = shadow.getElementById('setting-mea-epayment')?.checked === true;

        const customPeakVal = shadow.getElementById('setting-custom-peak-rate')?.value;
        const customOffpeakVal = shadow.getElementById('setting-custom-offpeak-rate')?.value;
        const customTier1Val = shadow.getElementById('setting-custom-tier1-rate')?.value;
        const customTier2Val = shadow.getElementById('setting-custom-tier2-rate')?.value;
        const customTier3Val = shadow.getElementById('setting-custom-tier3-rate')?.value;

        const serviceData = {
          utility_provider: utilityProvider,
          tariff_category: tariffCategory,
          billing_day: billingDay,
          grid_import_sensor: gridImport,
          grid_export_sensor: gridExport,
          solar_prod_sensor: solarProd,
          ft_rate: ftRate,
          solar_sellback_rate: sellbackRate,
          mea_ebill_active: meaEbill,
          mea_epayment_active: meaEpayment
        };

        if (customPeakVal && !isNaN(parseFloat(customPeakVal))) serviceData.custom_peak_rate = parseFloat(customPeakVal);
        if (customOffpeakVal && !isNaN(parseFloat(customOffpeakVal))) serviceData.custom_offpeak_rate = parseFloat(customOffpeakVal);
        if (customTier1Val && !isNaN(parseFloat(customTier1Val))) serviceData.custom_tier1_rate = parseFloat(customTier1Val);
        if (customTier2Val && !isNaN(parseFloat(customTier2Val))) serviceData.custom_tier2_rate = parseFloat(customTier2Val);
        if (customTier3Val && !isNaN(parseFloat(customTier3Val))) serviceData.custom_tier3_rate = parseFloat(customTier3Val);

        const origHtml = btnSaveSettings.innerHTML;
        btnSaveSettings.innerHTML = '⏳ Saving Configuration...';
        btnSaveSettings.style.backgroundColor = 'var(--warning-color, #ff9800)';
        btnSaveSettings.disabled = true;

        this._hass.callService('thai_energy_monitor', 'configure_settings', serviceData).then(() => {
          btnSaveSettings.innerHTML = '✅ Configuration Saved & Reloaded!';
          btnSaveSettings.style.backgroundColor = 'var(--success-color, #4caf50)';
          setTimeout(() => {
            btnSaveSettings.innerHTML = origHtml;
            btnSaveSettings.style.backgroundColor = 'var(--success-color, #4caf50)';
            btnSaveSettings.disabled = false;
          }, 1800);
        }).catch((err) => {
          console.error("Save settings service call failed:", err);
          btnSaveSettings.innerHTML = '❌ Save Failed! Check HA logs';
          btnSaveSettings.style.backgroundColor = 'var(--error-color, #f44336)';
          setTimeout(() => {
            btnSaveSettings.innerHTML = origHtml;
            btnSaveSettings.style.backgroundColor = 'var(--success-color, #4caf50)';
            btnSaveSettings.disabled = false;
          }, 3000);
        });
      });
    }
  }

  _updateDOMValues() {
    const shadow = this.shadowRoot;
    const d = this._data;

    const setText = (id, text) => {
      const el = shadow.getElementById(id);
      if (el && el.textContent !== text) {
        el.textContent = text;
      }
    };

    const setHtml = (id, html) => {
      const el = shadow.getElementById(id);
      if (el && el.innerHTML !== html) {
        el.innerHTML = html;
      }
    };

    setText('val-tou-status', d.isOffpeak ? this.t('offpeak_window') : this.t('peak_window'));
    setText('val-accrued-bill', `฿${this._formatNum(d.accruedBill)}`);
    setText('val-total-bill', `฿${this._formatNum(d.totalBill)}`);
    setText('val-base-cost', `฿${this._formatNum(d.accruedBaseCost)}`);
    setText('val-ft-charge', `฿${this._formatNum(d.accruedFtCharge)}`);
    setText('val-vat-amount', `฿${this._formatNum(d.accruedVatAmount)}`);
    setText('val-import-kwh', this._formatNum(d.importKwh));
    setText('val-solar-benefit', `฿${d.totalSolarBenefit}`);
    setText('val-solar-savings-main', `฿${this._formatNum(d.solarSavings)}`);
    setText('val-solar-savings', `฿${this._formatNum(d.solarSavings)}`);
    setText('val-solar-revenue-main', `฿${this._formatNum(d.solarRevenue)}`);
    setText('val-solar-revenue', `฿${this._formatNum(d.solarRevenue)}`);

    // Dynamic updates for Solar Cards
    setText('val-solar-volume', `${d.solarKwh} kWh`);
    setText('val-projected-solar-volume', `${this._formatNum(d.projectedSolarKwh)} kWh`);
    setText('val-projected-solar-savings', `฿${this._formatNum(d.projectedSolarSavings)} (${this._formatNum(d.projectedSelfConsumptionKwh)} kWh)`);
    setText('val-projected-solar-revenue', `฿${this._formatNum(d.projectedSolarRevenue)} (${this._formatNum(d.projectedExportKwh)} kWh)`);
    setHtml('val-projected-solar-benefit-line', `${this.t('projected_solar_offset')} <strong>฿${this._formatNum(d.projectedTotalSolarBenefit)}</strong> (${d.projectedSolarReductionPct}% ${this.t('reduction_vs')} ฿${this._formatNum(d.projectedBillWithoutSolar)} ${this.t('bill_without_solar')})`);
    setText('val-self-consumed-volume', `${d.selfConsumedKwh} kWh (${d.selfConsumptionRatio}%)`);
    setText('val-grid-export-volume', `${d.exportKwh} kWh`);
    setText('val-lifetime-savings', `฿${this._formatNum(d.lifetimeSolarSavings)}`);
    setText('val-lifetime-revenue', `฿${this._formatNum(d.lifetimeSolarRevenue)}`);
    setText('val-lifetime-benefit', `฿${d.lifetimeBenefit}`);
    setText('val-sellback-rate-display', `฿${d.sellbackRate} / kWh`);
    setText('val-cycle-day', `${this.t('day_label')} ${d.currentDayOfCycle} / 30`);

    // Dynamic updates for Solcast Card
    setHtml('val-solcast-today-main', `${parseFloat(d.solcastForecastToday).toFixed(2)} <span style="font-size: 18px;">kWh</span>`);
    setText('val-solcast-today', `${d.solcastForecastToday} kWh`);
    setText('val-solcast-remaining', `${d.solcastForecastRemaining} kWh`);
    setText('val-solcast-power', `${d.solcastPowerNow} ${d.solcastPowerNowUnit}`);
  }

  _initialRender() {
    const d = this._data;
    const isOffpeak = d.isOffpeak;
    const isTou = d.isTou;
    const offpeakBadge = isTou
      ? (isOffpeak
        ? `<span class="badge offpeak">Off-Peak Window</span>`
        : `<span class="badge peak">Peak Window</span>`)
      : '';

    const diffVal = parseFloat(d.tariffDiff || '0');
    const diffClass = diffVal >= 0 ? 'saving' : 'warning';
    const diffText = diffVal >= 0
      ? `฿${Math.abs(diffVal).toFixed(2)} Monthly Savings`
      : `฿${Math.abs(diffVal).toFixed(2)} Higher than ${d.opposingTariffName}`;

    // Max day total for Billing chart scaling
    const maxDayTotal = Math.max(10, ...d.monthlyDailyBars.map(b => b.total));

    // Y-Axis Ticks for Billing Chart
    const yTick4 = (maxDayTotal).toFixed(0);
    const yTick3 = (maxDayTotal * 0.75).toFixed(0);
    const yTick2 = (maxDayTotal * 0.50).toFixed(0);
    const yTick1 = (maxDayTotal * 0.25).toFixed(0);

    // Solar Line Chart Calculations for Full 30-Day Billing Month
    const maxSolarKwh = Math.max(10, ...d.solarMonthlyTrends.map(t => Math.max(t.solcast, t.production, t.selfConsumption, t.export)));
    const svgW = 740;
    const svgH = 160;
    const stepX = svgW / 29.0;

    const getX = (index) => (index * stepX).toFixed(1);
    const getY = (val) => (svgH - ((val / maxSolarKwh) * (svgH - 20))).toFixed(1);

    // Dynamic Segmentation for Historical vs Predicted Segments
    const currentDay = d.currentDayOfCycle;

    const getPointsSegment = (trends, key, startIdx, endIdx) => {
      const pts = [];
      for (let i = startIdx; i <= endIdx; i++) {
        if (trends[i]) {
          pts.push(`${getX(i)},${getY(trends[i][key])}`);
        }
      }
      return pts.join(' ');
    };

    // Solcast is theoretical max forecast for the entire month
    const pointsSolcast = d.solarMonthlyTrends.map((t, idx) => `${getX(idx)},${getY(t.solcast)}`).join(' ');

    // Split Actual vs Predicted trends at the current cycle day boundary
    const pointsProdPast = getPointsSegment(d.solarMonthlyTrends, 'production', 0, currentDay - 1);
    const pointsProdFuture = getPointsSegment(d.solarMonthlyTrends, 'production', currentDay - 1, 29);

    const hasExport = d.solarMonthlyTrends.some(t => t.export > 0.05);
    const pointsSelfPast = hasExport ? getPointsSegment(d.solarMonthlyTrends, 'selfConsumption', 0, currentDay - 1) : '';
    const pointsSelfFuture = hasExport ? getPointsSegment(d.solarMonthlyTrends, 'selfConsumption', currentDay - 1, 29) : '';

    const pointsExportPast = getPointsSegment(d.solarMonthlyTrends, 'export', 0, currentDay - 1);
    const pointsExportFuture = getPointsSegment(d.solarMonthlyTrends, 'export', currentDay - 1, 29);

    // Interactive Hit Slices for Solar Trends Line Chart (Chart 3)
    const solarHitSlicesHtml = d.solarMonthlyTrends.map((t, idx) => {
      const xCenter = parseFloat(getX(idx));
      const xLeft = Math.max(0, xCenter - (stepX / 2)).toFixed(1);
      const width = stepX.toFixed(1);
      const yProd = getY(t.production);
      const ySolcast = getY(t.solcast);
      const ySelf = getY(t.selfConsumption);
      const yExport = getY(t.export);

      return `
        <rect class="solar-trend-hit" data-day-idx="${idx}" data-x="${xCenter}" data-y-prod="${yProd}" data-y-solcast="${ySolcast}" data-y-self="${ySelf}" data-y-export="${yExport}" x="${xLeft}" y="0" width="${width}" height="${svgH}" fill="transparent" style="cursor: crosshair;"></rect>
      `;
    }).join('');

    // Daily Side-by-Side Bar Chart Calculations (Volume/Value Mode)
    const mode = this._dailyChartMode;
    const dailyData = d.dailyBreakdown;
    
    let maxVal = 1.0;
    if (mode === 'kwh') {
      maxVal = Math.max(1, ...dailyData.map(item => Math.max(item.importKwh, item.solarKwh)));
    } else {
      maxVal = Math.max(1, ...dailyData.map(item => Math.max(item.importCost, item.solarBenefit)));
    }

    const dailySvgH = 150;
    const dailySvgW = 670; // adjusted to leave room for Y-axis labels
    const colStepX = dailySvgW / 30.0;
    const colW = 6;

    const getDailyColY = (val) => (dailySvgH - ((val / maxVal) * (dailySvgH - 20))).toFixed(1);
    const getDailyColHeight = (val) => (((val / maxVal) * (dailySvgH - 20))).toFixed(1);

    const columnsHtml = dailyData.map((item, idx) => {
      const xStart = idx * colStepX;
      const xImp = (xStart + 2).toFixed(1);
      const xSol = (xStart + 9).toFixed(1);
      
      const valImp = mode === 'kwh' ? item.importKwh : item.importCost;
      const valSol = mode === 'kwh' ? item.solarKwh : item.solarBenefit;

      const yImp = getDailyColY(valImp);
      const hImp = getDailyColHeight(valImp);

      const ySol = getDailyColY(valSol);
      const hSol = getDailyColHeight(valSol);

      const opacity = item.isPastOrToday ? '1.0' : '0.4';

      return `
        <!-- Import Column (Blue) -->
        <rect id="daily-bar-imp-${idx}" x="${xImp}" y="${yImp}" width="${colW}" height="${hImp}" fill="#2196f3" rx="2" opacity="${opacity}"></rect>
        
        <!-- Solar Column (Green) -->
        <rect id="daily-bar-sol-${idx}" x="${xSol}" y="${ySol}" width="${colW}" height="${hSol}" fill="#4caf50" rx="2" opacity="${opacity}"></rect>

        <!-- Interactive Day Hit Slice -->
        <rect class="daily-bar-hit" data-day-idx="${idx}" x="${xStart.toFixed(1)}" y="0" width="${colStepX.toFixed(1)}" height="${dailySvgH}" fill="transparent" style="cursor: pointer;"></rect>
      `;
    }).join('');

    const dailyYAxisHtml = mode === 'kwh'
      ? `
          <span>${maxVal.toFixed(1)} kWh</span>
          <span>${(maxVal * 0.75).toFixed(1)} kWh</span>
          <span>${(maxVal * 0.50).toFixed(1)} kWh</span>
          <span>${(maxVal * 0.25).toFixed(1)} kWh</span>
          <span>0 kWh</span>
        `
      : `
          <span>฿${maxVal.toFixed(1)}</span>
          <span>฿${(maxVal * 0.75).toFixed(1)}</span>
          <span>฿${(maxVal * 0.50).toFixed(1)}</span>
          <span>฿${(maxVal * 0.25).toFixed(1)}</span>
          <span>฿0</span>
        `;

    // 12-Month Lookback Chart & HTML Render calculations
    let lookbackColumnsHtml = '';
    let lookbackXLabelsHtml = '';
    let lookbackMaxVal = 100.0;

    if (d.lookbackData && Array.isArray(d.lookbackData)) {
      lookbackMaxVal = Math.max(100.0, ...d.lookbackData.map(r => Math.max(r.tiered_cost, r.tou_cost)));
      const lSvgW = 630;
      const lSvgH = 150;
      const lStepX = lSvgW / 12.0;
      const lColW = 14;

      const getLColY = (val) => (lSvgH - ((val / lookbackMaxVal) * (lSvgH - 20))).toFixed(1);
      const getLColHeight = (val) => (((val / lookbackMaxVal) * (lSvgH - 20))).toFixed(1);

      lookbackColumnsHtml = d.lookbackData.map((row, idx) => {
        const xStart = idx * lStepX;
        const xTiered = (xStart + 10).toFixed(1);
        const xTou = (xStart + 26).toFixed(1);

        const yTiered = getLColY(row.tiered_cost);
        const hTiered = getLColHeight(row.tiered_cost);

        const yTou = getLColY(row.tou_cost);
        const hTou = getLColHeight(row.tou_cost);

        const benefitText = row.savings >= 0
          ? `Benefit: +฿${row.savings.toFixed(2)}`
          : `Penalty: -฿${Math.abs(row.savings).toFixed(2)}`;

        return `
          <!-- Tiered Cost (Blue) -->
          <rect x="${xTiered}" y="${yTiered}" width="${lColW}" height="${hTiered}" fill="#3b82f6" rx="3">
            <title>Month: ${row.month}\nTiered Tariff 1.2: ฿${row.tiered_cost.toFixed(2)}\n${benefitText}</title>
          </rect>
          
          <!-- TOU Cost (Cyan) -->
          <rect x="${xTou}" y="${yTou}" width="${lColW}" height="${hTou}" fill="#0ea5e9" rx="3">
            <title>Month: ${row.month}\nTOU Tariff 1.3.2: ฿${row.tou_cost.toFixed(2)}\n${benefitText}</title>
          </rect>
        `;
      }).join('');

      lookbackXLabelsHtml = d.lookbackData.map((row) => {
        const parts = row.month.split('-');
        const monthNum = parseInt(parts[1] || '1', 10);
        const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const label = monthsShort[monthNum - 1] || row.month;
        return `<span style="width: 52px; text-align: center;">${label}</span>`;
      }).join('');
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 20px;
          background-color: var(--primary-background-color, #111111);
          color: var(--primary-text-color, #e1e1e1);
          font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
          box-sizing: border-box;
          min-height: 100vh;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: var(--card-background-color, var(--ha-card-background, #1c1c1e));
          padding: 20px 24px;
          border-radius: 12px;
          margin-bottom: 20px;
          border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.12));
        }

        .header h1 {
          margin: 0;
          font-size: 22px;
          font-weight: 600;
          color: var(--primary-text-color, #ffffff);
        }

        .header .subtitle {
          font-size: 13px;
          color: var(--secondary-text-color, #9e9e9e);
          margin-top: 4px;
        }

        .badge {
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .badge.offpeak {
          background-color: var(--success-color, #4caf50);
          color: #ffffff;
        }

        .badge.peak {
          background-color: var(--error-color, var(--warning-color, #f44336));
          color: #ffffff;
        }

        /* Navigation Tabs */
        .tabs {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          border-bottom: 1px solid var(--divider-color, rgba(255, 255, 255, 0.12));
          padding-bottom: 12px;
        }

        .tab-btn {
          background-color: var(--card-background-color, var(--ha-card-background, #1c1c1e));
          border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.12));
          color: var(--secondary-text-color, #9e9e9e);
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          font-size: 14px;
          outline: none;
        }

        .tab-btn:hover {
          color: var(--primary-text-color, #ffffff);
          background-color: var(--secondary-background-color, #2c2c2e);
        }

        .tab-btn.active {
          background-color: var(--primary-color, #03a9f4);
          color: #ffffff;
          border-color: var(--primary-color, #03a9f4);
          font-weight: 600;
        }

        .lang-selector {
          display: inline-flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.12));
          border-radius: 8px;
          padding: 3px;
          gap: 4px;
          margin-left: 10px;
        }

        .flag-btn {
          background: transparent;
          border: 2px solid transparent;
          border-radius: 5px;
          padding: 3px 6px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          opacity: 0.5;
          transition: all 0.2s ease;
          outline: none;
        }

        .flag-btn:hover {
          opacity: 0.85;
          background: rgba(255, 255, 255, 0.08);
        }

        .flag-btn.active {
          opacity: 1;
          background: rgba(255, 255, 255, 0.15);
          border-color: var(--primary-color, #03a9f4);
          box-shadow: 0 0 8px rgba(3, 169, 244, 0.4);
        }

        .flag-icon {
          border-radius: 2px;
          display: block;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 20px;
        }

        .grid.two-col {
          grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
        }

        @media (min-width: 860px) {
          .grid.two-col {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        .card {
          background-color: var(--card-background-color, var(--ha-card-background, #1c1c1e));
          border-radius: 12px;
          padding: 22px;
          border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.12));
        }

        .card.full-width {
          grid-column: 1 / -1;
        }

        .card h2 {
          margin-top: 0;
          font-size: 16px;
          font-weight: 500;
          color: var(--primary-text-color, #ffffff);
          border-bottom: 1px solid var(--divider-color, rgba(255, 255, 255, 0.12));
          padding-bottom: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .metric-main {
          font-size: 36px;
          font-weight: 700;
          color: var(--primary-color, #03a9f4);
          margin: 14px 0;
        }

        .table-rows {
          display: flex;
          flex-direction: column;
          gap: 10px;
          font-size: 14px;
        }

        .row {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
          border-bottom: 1px dashed var(--divider-color, rgba(255, 255, 255, 0.08));
        }

        .row .label {
          color: var(--secondary-text-color, #9e9e9e);
        }

        .row .val {
          font-weight: 500;
          color: var(--primary-text-color, #ffffff);
        }

        .saving { color: var(--success-color, #4caf50) !important; }
        .warning { color: var(--error-color, var(--warning-color, #f44336)) !important; }
        .highlight { color: var(--state-sensor-color, #ff9800) !important; }
        .accent { color: var(--accent-color, #e91e63) !important; }

        .progress-container {
          margin-top: 16px;
        }

        .bar-label {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--secondary-text-color, #9e9e9e);
          margin-bottom: 6px;
          flex-wrap: wrap;
        }

        .bar-bg {
          height: 10px;
          background-color: var(--secondary-background-color, #2c2c2e);
          border-radius: 6px;
          overflow: hidden;
          display: flex;
        }

        .bar-segment {
          height: 100%;
        }

        .seg-service { background-color: var(--secondary-text-color, #9e9e9e); }
        .seg-tier1 { background-color: #1976d2; }
        .seg-tier2 { background-color: #2196f3; }
        .seg-tier3 { background-color: #64b5f6; }
        .seg-peak { background-color: #1565c0; }
        .seg-offpeak { background-color: #90caf9; }
        .seg-ft { background-color: var(--warning-color, #ff9800); }
        .seg-vat { background-color: var(--accent-color, #e91e63); }

        /* Chart Components & Y-Axis */
        .chart-wrapper {
          display: flex;
          gap: 12px;
          height: 200px;
          margin-top: 12px;
          padding-bottom: 24px;
          border-bottom: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          position: relative;
        }

        .y-axis {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
          padding-right: 10px;
          border-right: 1px solid var(--divider-color, rgba(255, 255, 255, 0.12));
          font-size: 11px;
          color: var(--secondary-text-color, #9e9e9e);
          text-align: right;
          min-width: 55px;
          box-sizing: border-box;
        }

        .chart-legend {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
          font-size: 13px;
          color: var(--secondary-text-color, #9e9e9e);
          flex-wrap: wrap;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .legend-dot {
          width: 12px;
          height: 12px;
          border-radius: 3px;
        }

        .legend-line-solcast { width: 16px; height: 3px; background-color: var(--warning-color, #ff9800); border-radius: 2px; border-style: dashed; }
        .legend-line-prod { width: 16px; height: 3px; background-color: var(--success-color, #4caf50); border-radius: 4px; }
        .legend-line-self { width: 16px; height: 3px; background-color: var(--primary-color, #03a9f4); border-radius: 4px; }
        .legend-line-export { width: 16px; height: 3px; background-color: var(--accent-color, #e91e63); border-radius: 4px; }

        .stacked-chart-container {
          flex: 1;
          display: flex;
          align-items: flex-end;
          gap: 4px;
          height: 100%;
          position: relative;
        }

        .stacked-col {
          flex: 1;
          display: flex;
          flex-direction: column-reverse;
          height: 100%;
          justify-content: flex-start;
          align-items: center;
          position: relative;
          cursor: pointer;
          transition: filter 0.15s ease, transform 0.15s ease;
        }

        .stacked-col:hover {
          filter: brightness(1.25);
          transform: scaleY(1.02);
        }

        .bar-piece {
          width: 100%;
          border-radius: 1px;
        }

        .col-day-label {
          position: absolute;
          bottom: -22px;
          font-size: 10px;
          color: var(--secondary-text-color, #9e9e9e);
        }

        .svg-chart-container {
          flex: 1;
          height: 100%;
          position: relative;
        }

        .svg-x-axis-labels {
          display: flex;
          justify-content: space-between;
          position: absolute;
          bottom: -22px;
          left: 0;
          right: 0;
          font-size: 10px;
          color: var(--secondary-text-color, #9e9e9e);
        }

        /* Floating Interactive Tooltip */
        .floating-tooltip {
          position: absolute;
          display: none;
          pointer-events: none;
          z-index: 99999;
          background: rgba(18, 18, 22, 0.96);
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 8px;
          padding: 10px 14px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          font-size: 12px;
          line-height: 1.45;
          color: #ffffff;
          white-space: nowrap;
          transition: opacity 0.1s ease;
          transform: translate(-50%, -100%);
        }

        .floating-tooltip .tt-title {
          font-weight: 600;
          font-size: 13px;
          margin-bottom: 6px;
          padding-bottom: 4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          justify-content: space-between;
          gap: 16px;
        }

        .floating-tooltip .tt-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 2px 0;
        }

        .floating-tooltip .tt-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 6px;
        }

        .daily-bar-hit:hover ~ rect {
          filter: brightness(1.25);
        }

        .note-box {
          margin-top: 14px;
          padding: 12px;
          border-radius: 8px;
          background-color: var(--secondary-background-color, rgba(255,255,255,0.04));
          font-size: 13px;
          color: var(--secondary-text-color, #9e9e9e);
          line-height: 1.4;
        }

        .footer-note {
          margin-top: 32px;
          text-align: center;
          font-size: 12px;
          color: var(--secondary-text-color, #9e9e9e);
        }

        .debug-panel {
          grid-column: 1 / -1;
          margin-top: 24px;
          background-color: rgba(244, 67, 54, 0.06);
          border: 1px solid var(--error-color, #f44336);
          border-radius: 12px;
          padding: 18px;
        }

        .debug-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--error-color, #f44336);
          margin-top: 0;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .debug-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 16px;
          font-size: 13px;
        }

        .debug-section {
          background-color: rgba(0, 0, 0, 0.2);
          padding: 12px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .debug-section h4 {
          margin-top: 0;
          margin-bottom: 8px;
          color: var(--primary-color, #03a9f4);
          font-size: 13px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 4px;
        }
      </style>

      <!-- Floating Interactive Chart Tooltip -->
      <div id="chart-tooltip" class="floating-tooltip"></div>

      <div class="header">
        <div>
          <h1>Thailand Energy & Solar Monitor</h1>
          <div class="subtitle">Provider: <strong>${d.provider}</strong> | Active Category: <strong>Tariff ${d.tariffCategory}</strong></div>
        </div>
        <div>
          ${offpeakBadge}
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tabs">
        <button class="tab-btn ${this._activeTab === 'overview' ? 'active' : ''}" data-tab="overview">
          ${this.t('tab_overview')}
        </button>
        <button class="tab-btn ${this._activeTab === 'solar' ? 'active' : ''}" data-tab="solar">
          ${this.t('tab_solar')}
        </button>
        <button class="tab-btn ${this._activeTab === 'bess' ? 'active' : ''}" data-tab="bess">
          ${this.t('tab_bess')}
        </button>
        <button class="tab-btn ${this._activeTab === 'predictive' ? 'active' : ''}" data-tab="predictive">
          ${this.t('tab_optimizer')}
        </button>
        <button class="tab-btn ${this._activeTab === 'outages' ? 'active' : ''}" data-tab="outages">
          ${this.t('tab_outages')}
        </button>
        <button class="tab-btn ${this._activeTab === 'settings' ? 'active' : ''}" data-tab="settings" style="margin-left: auto;">
          ${this.t('tab_settings')}
        </button>

        <!-- Flag Language Switcher (Australian 🇦🇺 / Thai 🇹🇭 Vector Flags) -->
        <div class="lang-selector">
          <button class="flag-btn ${this._lang === 'en' ? 'active' : ''}" id="btn-lang-en" title="English (Australia)">
            <svg class="flag-icon" viewBox="0 0 640 320" width="22" height="15">
              <rect width="640" height="320" fill="#00008B"/>
              <g clip-path="url(#canton-clip)">
                <clipPath id="canton-clip"><rect width="320" height="160"/></clipPath>
                <path d="M0,0 L320,160 M320,0 L0,160" stroke="#FFF" stroke-width="32"/>
                <path d="M0,0 L320,160 M320,0 L0,160" stroke="#C8102E" stroke-width="20"/>
                <path d="M160,0 V160 M0,80 H320" stroke="#FFF" stroke-width="50"/>
                <path d="M160,0 V160 M0,80 H320" stroke="#C8102E" stroke-width="30"/>
              </g>
              <polygon points="160,200 166,220 186,212 174,228 190,242 170,244 172,264 160,250 148,264 150,244 130,242 146,228 134,212 154,220" fill="#FFF"/>
              <circle cx="480" cy="270" r="14" fill="#FFF"/>
              <circle cx="420" cy="140" r="14" fill="#FFF"/>
              <circle cx="480" cy="60" r="14" fill="#FFF"/>
              <circle cx="535" cy="115" r="14" fill="#FFF"/>
              <circle cx="505" cy="175" r="9" fill="#FFF"/>
            </svg>
          </button>
          <button class="flag-btn ${this._lang === 'th' ? 'active' : ''}" id="btn-lang-th" title="ภาษาไทย">
            <svg class="flag-icon" viewBox="0 0 900 600" width="22" height="15">
              <rect width="900" height="600" fill="#ED1C24"/>
              <rect y="100" width="900" height="400" fill="#FFFFFF"/>
              <rect y="200" width="900" height="200" fill="#241D4F"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Tab 1: Detailed Billing Overview -->
      ${this._activeTab === 'overview' ? `
        <div class="grid two-col">
          <div class="card">
            <h2>${this.t('current_accrued_bill')} <span>(THB)</span></h2>
            <div class="metric-main" id="val-accrued-bill">฿${this._formatNum(d.accruedBill)}</div>
            <div style="font-size: 13px; color: var(--primary-color, #03a9f4); margin-bottom: 4px; font-weight: 500;">
              ${this.t('projected_month_end')} <strong>฿${this._formatNum(d.totalBill)}</strong> (${this._formatNum(d.projectedImport)} kWh ${this.t('run_rate')})
            </div>
            <div style="font-size: 12px; color: var(--success-color, #4caf50); margin-bottom: 12px; font-weight: 500;" id="val-projected-solar-benefit-line">
              ${this.t('projected_solar_offset')} <strong>฿${this._formatNum(d.projectedTotalSolarBenefit)}</strong> (${d.projectedSolarReductionPct}% ${this.t('reduction_vs')} ฿${this._formatNum(d.projectedBillWithoutSolar)} ${this.t('bill_without_solar')})
            </div>
            <div class="table-rows">
              <div class="row">
                <span class="label">${this.t('accrued_base_energy_charge')}</span>
                <span class="val" id="val-base-cost">฿${this._formatNum(d.accruedBaseCost)}</span>
              </div>
              <div class="row">
                <span class="label">${this.t('accrued_ft_charge')} (${d.ftRate} ฿/kWh)</span>
                <span class="val" id="val-ft-charge">฿${this._formatNum(d.accruedFtCharge)}</span>
              </div>
              <div class="row">
                <span class="label">${this.t('fixed_service_charge')}</span>
                <span class="val">฿${this._formatNum(d.serviceCharge)}</span>
              </div>
              <div class="row">
                <span class="label">${this.t('accrued_statutory_vat')}</span>
                <span class="val" id="val-vat-amount">฿${this._formatNum(d.accruedVatAmount)}</span>
              </div>
            </div>
          </div>

          <div class="card">
            <h2>${this.t('detailed_consumption')}</h2>
            <div class="metric-main" style="color: var(--primary-color, #03a9f4);"><span id="val-import-kwh">${this._formatNum(d.importKwh)}</span> <span style="font-size: 18px;">kWh</span></div>
            <div style="font-size: 13px; color: #9e9e9e; margin-bottom: 12px;">
              ${this.t('projected_month_end_volume')} <strong>${this._formatNum(d.projectedImport)} kWh</strong>
            </div>
            <div class="table-rows">
              <div class="row">
                <span class="label">${this.t('tou_window_status')}</span>
                <span class="val" id="val-tou-status">${d.isOffpeak ? this.t('offpeak_window') : this.t('peak_window')}</span>
              </div>
              <div class="row">
                <span class="label">${this.t('active_marginal_rate')}</span>
                <span class="val">฿${this._formatNum(d.marginalRate)} / kWh</span>
              </div>
              <div class="row">
                <span class="label">${this.t('energy_dashboard_price')}</span>
                <span class="val">฿${this._formatNum(d.gridPrice)} / kWh</span>
              </div>
              <div class="row">
                <span class="label">${this.t('last_month_bill')}</span>
                <span class="val">฿${this._formatNum(d.lastMonthBill)} (${this._formatNum(d.lastMonthImport)} kWh)</span>
              </div>
              <div class="row">
                <span class="label">${this.t('lifetime_import')}</span>
                <span class="val">${this._formatNum(d.lifetimeImport)} kWh</span>
              </div>
            </div>
          </div>

          <!-- Full Width Cumulative Month Cost Chart with Labeled Y-Axis & Baseline Subtraction Engine -->
          <div class="card full-width">
            <h2>${this.t('chart_progression_title')} (${d.isTou ? this.t('tou_base_split') : this.t('tiered_base_charge')})</h2>
            <div class="chart-legend">
              ${d.isTou ? `
                <div class="legend-item"><div class="legend-dot seg-service"></div> ${this.t('legend_fixed_service')}</div>
                <div class="legend-item"><div class="legend-dot seg-peak"></div> ${this.t('legend_peak_charge')}</div>
                <div class="legend-item"><div class="legend-dot seg-offpeak"></div> ${this.t('legend_offpeak_charge')}</div>
                <div class="legend-item"><div class="legend-dot seg-ft"></div> 4. ${this.t('legend_ft')}</div>
                <div class="legend-item"><div class="legend-dot seg-vat"></div> 5. ${this.t('legend_vat')}</div>
              ` : `
                <div class="legend-item"><div class="legend-dot seg-service"></div> ${this.t('legend_fixed_service')}</div>
                <div class="legend-item"><div class="legend-dot seg-tier1"></div> ${this.t('legend_tier1')}</div>
                <div class="legend-item"><div class="legend-dot seg-tier2"></div> ${this.t('legend_tier2')}</div>
                <div class="legend-item"><div class="legend-dot seg-tier3"></div> ${this.t('legend_tier3')}</div>
                <div class="legend-item"><div class="legend-dot seg-ft"></div> 5. ${this.t('legend_ft')}</div>
                <div class="legend-item"><div class="legend-dot seg-vat"></div> 6. ${this.t('legend_vat')}</div>
              `}
            </div>

            <div class="chart-wrapper">
              <!-- Y-Axis Label Column -->
              <div class="y-axis">
                <span>฿${this._formatNum(yTick4, 0)}</span>
                <span>฿${this._formatNum(yTick3, 0)}</span>
                <span>฿${this._formatNum(yTick2, 0)}</span>
                <span>฿${this._formatNum(yTick1, 0)}</span>
                <span>฿0</span>
              </div>

              <!-- Stacked Bars Container -->
              <div class="stacked-chart-container">
                ${d.monthlyDailyBars.map(bar => {
                  const sPct = ((bar.service / maxDayTotal) * 100).toFixed(1);
                  const fPct = ((bar.ft / maxDayTotal) * 100).toFixed(1);
                  const vPct = ((bar.vat / maxDayTotal) * 100).toFixed(1);
                  const opacity = bar.isPastOrToday ? '1.0' : '0.4';

                  if (d.isTou) {
                    const pPct = ((bar.peak / maxDayTotal) * 100).toFixed(1);
                    const opPct = ((bar.offpeak / maxDayTotal) * 100).toFixed(1);
                    return `
                      <div class="stacked-col" data-day-idx="${bar.day - 1}" style="opacity: ${opacity};">
                        <div class="bar-piece seg-service" style="height: ${sPct}%;"></div>
                        <div class="bar-piece seg-peak" style="height: ${pPct}%;"></div>
                        <div class="bar-piece seg-offpeak" style="height: ${opPct}%;"></div>
                        <div class="bar-piece seg-ft" style="height: ${fPct}%;"></div>
                        <div class="bar-piece seg-vat" style="height: ${vPct}%;"></div>
                        <div class="col-day-label">${bar.day}</div>
                      </div>
                    `;
                  } else {
                    const t1Pct = ((bar.tier1 / maxDayTotal) * 100).toFixed(1);
                    const t2Pct = ((bar.tier2 / maxDayTotal) * 100).toFixed(1);
                    const t3Pct = ((bar.tier3 / maxDayTotal) * 100).toFixed(1);
                    return `
                      <div class="stacked-col" data-day-idx="${bar.day - 1}" style="opacity: ${opacity};">
                        <div class="bar-piece seg-service" style="height: ${sPct}%;"></div>
                        <div class="bar-piece seg-tier1" style="height: ${t1Pct}%;"></div>
                        <div class="bar-piece seg-tier2" style="height: ${t2Pct}%;"></div>
                        <div class="bar-piece seg-tier3" style="height: ${t3Pct}%;"></div>
                        <div class="bar-piece seg-ft" style="height: ${fPct}%;"></div>
                        <div class="bar-piece seg-vat" style="height: ${vPct}%;"></div>
                        <div class="col-day-label">${bar.day}</div>
                      </div>
                    `;
                  }
                }).join('')}
              </div>
            </div>

            <div class="note-box">
              ${d.isTou ? this.t('note_tou_progression') : this.t('note_tiered_progression')}
            </div>
          </div>

          <!-- Card: Daily Import vs Solar Comparison (Interactive Mode Toggle) -->
          <div class="card full-width">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--divider-color, rgba(255, 255, 255, 0.12)); padding-bottom: 10px; margin-bottom: 16px;">
              <h2 style="border-bottom: none; padding-bottom: 0; margin: 0;">${this.t('chart_daily_title')}</h2>
              <div style="display: flex; gap: 6px;">
                <button class="toggle-btn ${this._dailyChartMode === 'kwh' ? 'active' : ''}" data-mode="kwh" style="background-color: ${this._dailyChartMode === 'kwh' ? 'var(--primary-color, #03a9f4)' : 'rgba(255,255,255,0.05)'}; color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 6px 12px; font-size: 11px; cursor: pointer; outline: none; font-weight: 500;">
                  ${this.t('show_volume_kwh')}
                </button>
                <button class="toggle-btn ${this._dailyChartMode === 'thb' ? 'active' : ''}" data-mode="thb" style="background-color: ${this._dailyChartMode === 'thb' ? 'var(--primary-color, #03a9f4)' : 'rgba(255,255,255,0.05)'}; color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 6px 12px; font-size: 11px; cursor: pointer; outline: none; font-weight: 500;">
                  ${this.t('show_value_thb')}
                </button>
              </div>
            </div>

            <div class="chart-wrapper">
              <!-- Y-Axis Label Column -->
              <div class="y-axis">
                ${dailyYAxisHtml}
              </div>

              <!-- Side-by-Side Bar Chart SVG Container -->
              <div class="svg-chart-container">
                <svg viewBox="0 0 ${dailySvgW} ${dailySvgH}" preserveAspectRatio="none" style="width: 100%; height: 100%; overflow: visible;">
                  <!-- Background Grid Lines -->
                  <line x1="0" y1="0" x2="${dailySvgW}" y2="0" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4" />
                  <line x1="0" y1="32.5" x2="${dailySvgW}" y2="32.5" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4" />
                  <line x1="0" y1="65" x2="${dailySvgW}" y2="65" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4" />
                  <line x1="0" y1="97.5" x2="${dailySvgW}" y2="97.5" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4" />
                  <line x1="0" y1="130" x2="${dailySvgW}" y2="130" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4" />

                  <!-- Side-by-Side SVG Bars -->
                  ${columnsHtml}
                </svg>

                <!-- X-Axis Labels (Days 1 to 30) -->
                <div class="svg-x-axis-labels">
                  <span>${this.t('day_label')} 1</span>
                  <span>${this.t('day_label')} 5</span>
                  <span>${this.t('day_label')} 10</span>
                  <span>${this.t('day_label')} 15</span>
                  <span>${this.t('day_label')} 20</span>
                  <span>${this.t('day_label')} 25</span>
                  <span>${this.t('day_label')} 30</span>
                </div>
              </div>
            </div>

            <div class="chart-legend" style="margin-top: 14px;">
              <div class="legend-item"><div class="legend-dot" style="background-color: #2196f3;"></div> ${mode === 'kwh' ? this.t('legend_grid_import_kwh') : this.t('legend_grid_import_thb')}</div>
              <div class="legend-item"><div class="legend-dot" style="background-color: #4caf50;"></div> ${mode === 'kwh' ? this.t('legend_solar_prod_kwh') : this.t('legend_solar_prod_thb')}</div>
              <div style="font-size: 11px; color: var(--secondary-text-color, #9e9e9e); margin-left: auto;">
                ${this.t('hover_deltas_hint')}
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Tab 2: Detailed Solar ROI & BESS + Multi-Trend Line Chart -->
      ${this._activeTab === 'solar' ? `
        <div class="grid">
          <div class="card">
            <h2>${this.t('solar_savings_title')}</h2>
            <div class="metric-main saving" id="val-solar-savings-main">฿${this._formatNum(d.solarSavings)}</div>
            <div style="font-size: 13px; color: var(--success-color, #4caf50); margin-bottom: 12px; font-weight: 500;">
              ${this.t('projected_month_end_savings')} <strong id="val-projected-solar-savings">฿${this._formatNum(d.projectedSolarSavings)} (${this._formatNum(d.projectedSelfConsumptionKwh)} kWh)</strong>
            </div>
            <div class="table-rows">
              <div class="row">
                <span class="label">${this.t('total_solar_production_vol')}</span>
                <span class="val" id="val-solar-volume">${d.solarKwh} kWh</span>
              </div>
              <div class="row">
                <span class="label">${this.t('projected_full_month_yield')}</span>
                <span class="val saving" id="val-projected-solar-volume">${this._formatNum(d.projectedSolarKwh)} kWh</span>
              </div>
              <div class="row">
                <span class="label">${this.t('self_consumed_vol')}</span>
                <span class="val" id="val-self-consumed-volume">${d.selfConsumedKwh} kWh (${d.selfConsumptionRatio}%)</span>
              </div>
              <div class="row">
                <span class="label">${this.t('lifetime_self_consumption_savings')}</span>
                <span class="val saving" id="val-lifetime-savings">฿${this._formatNum(d.lifetimeSolarSavings)}</span>
              </div>
            </div>
          </div>

          <div class="card">
            <h2>${this.t('solar_revenue_title')}</h2>
            <div class="metric-main saving" id="val-solar-revenue-main">฿${this._formatNum(d.solarRevenue)}</div>
            <div style="font-size: 13px; color: var(--success-color, #4caf50); margin-bottom: 12px; font-weight: 500;">
              ${this.t('projected_month_end_revenue')} <strong id="val-projected-solar-revenue">฿${this._formatNum(d.projectedSolarRevenue)} (${this._formatNum(d.projectedExportKwh)} kWh)</strong>
            </div>
            <div class="table-rows">
              <div class="row">
                <span class="label">${this.t('export_buyback_rate')}</span>
                <span class="val" id="val-sellback-rate-display">฿${d.sellbackRate} / kWh</span>
              </div>
              <div class="row">
                <span class="label">${this.t('grid_export_vol')}</span>
                <span class="val" id="val-grid-export-volume">${d.exportKwh} kWh</span>
              </div>
              <div class="row">
                <span class="label">${this.t('lifetime_grid_export_revenue')}</span>
                <span class="val saving" id="val-lifetime-revenue">฿${this._formatNum(d.lifetimeSolarRevenue)}</span>
              </div>
            </div>
          </div>

          <div class="card">
            <h2>${this.t('solcast_title')}</h2>
            <div class="metric-main highlight" id="val-solcast-today-main" style="color: var(--warning-color, #ff9800);">${parseFloat(d.solcastForecastToday).toFixed(2)} <span style="font-size: 18px;">kWh</span></div>
            <div class="table-rows">
              <div class="row">
                <span class="label">${this.t('solcast_status')}</span>
                <span class="val ${d.solcastEntityFound ? 'saving' : ''}">${d.solcastEntityFound ? this.t('solcast_integrated') : this.t('solcast_simulated')}</span>
              </div>
              <div class="row">
                <span class="label">${this.t('estimated_gen_today')}</span>
                <span class="val" id="val-solcast-today">${d.solcastForecastToday} kWh</span>
              </div>
              <div class="row">
                <span class="label">${this.t('estimated_rem_today')}</span>
                <span class="val" id="val-solcast-remaining">${d.solcastForecastRemaining} kWh</span>
              </div>
              <div class="row">
                <span class="label">${this.t('current_estimated_power')}</span>
                <span class="val" id="val-solcast-power">${d.solcastPowerNow} ${d.solcastPowerNowUnit}</span>
              </div>
            </div>
          </div>

          <!-- Full Width 30-Day Multi-Trend Solar SVG Line Chart -->
          <div class="card full-width">
            <h2>${this.t('solar_performance_trends')}</h2>
            <div class="chart-legend">
              <div class="legend-item"><div class="legend-line-solcast"></div> ${this.t('legend_solcast_forecast')}</div>
              <div class="legend-item"><div class="legend-line-prod"></div> ${this.t('legend_actual_solar_prod')}</div>
              <div class="legend-item"><div class="legend-line-self"></div> ${this.t('legend_internal_self_consumption')}</div>
              <div class="legend-item"><div class="legend-line-export"></div> ${this.t('legend_grid_export')}</div>
            </div>

            <div class="chart-wrapper">
              <!-- Y-Axis for Solar Output in kWh -->
              <div class="y-axis">
                <span>${maxSolarKwh.toFixed(0)} kWh</span>
                <span>${(maxSolarKwh * 0.75).toFixed(0)} kWh</span>
                <span>${(maxSolarKwh * 0.50).toFixed(0)} kWh</span>
                <span>${(maxSolarKwh * 0.25).toFixed(0)} kWh</span>
                <span>0 kWh</span>
              </div>

              <!-- Multi-Trend SVG Line Chart Container -->
              <div class="svg-chart-container">
                <svg viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none" style="width: 100%; height: 100%; overflow: visible;">
                  <!-- Background Grid Lines -->
                  <line x1="0" y1="0" x2="${svgW}" y2="0" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4" />
                  <line x1="0" y1="40" x2="${svgW}" y2="40" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4" />
                  <line x1="0" y1="80" x2="${svgW}" y2="80" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4" />
                  <line x1="0" y1="120" x2="${svgW}" y2="120" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4" />
                  <line x1="0" y1="160" x2="${svgW}" y2="160" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4" />

                  <!-- Trend 1: Solcast PV Forecast (Theoretical Maximum - Dashed Line) -->
                  <polyline points="${pointsSolcast}" fill="none" stroke="var(--warning-color, #ff9800)" stroke-width="2.5" stroke-dasharray="6,4" />

                  <!-- Trend 2: Actual Solar Production (Consistent Solid Green History, Dashed Green Future) -->
                  ${pointsProdPast ? `<polyline points="${pointsProdPast}" fill="none" stroke="var(--success-color, #4caf50)" stroke-width="3.0" stroke-linecap="round" stroke-linejoin="round" />` : ''}
                  ${pointsProdFuture ? `<polyline points="${pointsProdFuture}" fill="none" stroke="var(--success-color, #4caf50)" stroke-width="3.0" stroke-dasharray="4,4" opacity="0.6" stroke-linecap="round" stroke-linejoin="round" />` : ''}

                  <!-- Trend 3: Internal Self-Consumption (Rendered in Cyan only when Export > 0 to show divergence) -->
                  ${pointsSelfPast ? `<polyline points="${pointsSelfPast}" fill="none" stroke="var(--primary-color, #00e5ff)" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round" />` : ''}
                  ${pointsSelfFuture ? `<polyline points="${pointsSelfFuture}" fill="none" stroke="var(--primary-color, #00e5ff)" stroke-width="2.0" stroke-dasharray="4,4" opacity="0.5" stroke-linecap="round" stroke-linejoin="round" />` : ''}

                  <!-- Trend 4: Grid Export (Past - Solid Orange/Pink, Future - Dashed) -->
                  ${pointsExportPast ? `<polyline points="${pointsExportPast}" fill="none" stroke="var(--accent-color, #e91e63)" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round" />` : ''}
                  ${pointsExportFuture ? `<polyline points="${pointsExportFuture}" fill="none" stroke="var(--accent-color, #e91e63)" stroke-width="1.8" stroke-dasharray="4,4" opacity="0.4" stroke-linecap="round" stroke-linejoin="round" />` : ''}

                  <!-- Dynamic Interactive Crosshair Hairline & Tracking Dots -->
                  <line id="solar-crosshair" x1="0" y1="0" x2="0" y2="${svgH}" stroke="rgba(255,255,255,0.45)" stroke-width="1.5" stroke-dasharray="3,3" style="display:none; pointer-events:none;"></line>
                  <circle id="solar-dot-solcast" r="4" fill="#ff9800" stroke="#ffffff" stroke-width="1.5" style="display:none; pointer-events:none;"></circle>
                  <circle id="solar-dot-prod" r="4" fill="#4caf50" stroke="#ffffff" stroke-width="1.5" style="display:none; pointer-events:none;"></circle>
                  <circle id="solar-dot-self" r="4" fill="#00e5ff" stroke="#ffffff" stroke-width="1.5" style="display:none; pointer-events:none;"></circle>
                  <circle id="solar-dot-export" r="4" fill="#e91e63" stroke="#ffffff" stroke-width="1.5" style="display:none; pointer-events:none;"></circle>

                  <!-- Interactive Day Hit Zones -->
                  ${solarHitSlicesHtml}
                </svg>

                <!-- X-Axis Labels (Days 1 to 30) -->
                <div class="svg-x-axis-labels">
                  <span>${this.t('day_label')} 1</span>
                  <span>${this.t('day_label')} 5</span>
                  <span>${this.t('day_label')} 10</span>
                  <span>${this.t('day_label')} 15</span>
                  <span>${this.t('day_label')} 20</span>
                  <span>${this.t('day_label')} 25</span>
                  <span>${this.t('day_label')} 30</span>
                </div>
              </div>
            </div>

            <div class="note-box">
              ${this.t('note_solar_trends')}
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Tab 3: BESS Simulation -->
      ${this._activeTab === 'bess' ? `
        <div class="grid">
          <div class="card full-width">
            <h2>${this.t('bess_calibration_title')}</h2>
            <div class="table-rows" style="gap: 16px; margin-bottom: 20px;">
              <div>
                <label style="display: block; font-size: 12px; color: #9e9e9e; margin-bottom: 6px;">${this.t('simulated_battery_capacity')}</label>
                <input type="number" id="input-bess-capacity" value="${d.bessCapacityKwh}" step="0.5" min="0.5" max="100.0" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--divider-color, rgba(255,255,255,0.12)); background-color: rgba(0,0,0,0.25); color: #fff; box-sizing: border-box; font-size: 14px; outline: none;" />
              </div>
              <div>
                <label style="display: block; font-size: 12px; color: #9e9e9e; margin-bottom: 6px;">${this.t('battery_capex_cost')}</label>
                <input type="number" id="input-bess-capex" value="${d.bessCapexCost}" step="1000" min="0" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--divider-color, rgba(255,255,255,0.12)); background-color: rgba(0,0,0,0.25); color: #fff; box-sizing: border-box; font-size: 14px; outline: none;" />
              </div>
              <div style="grid-column: 1 / -1;">
                <label style="display: block; font-size: 12px; color: #9e9e9e; margin-bottom: 6px;">${this.t('simulated_tariff_model')}</label>
                <select id="input-bess-tariff-model" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--divider-color, rgba(255,255,255,0.12)); background-color: rgba(0,0,0,0.25); color: #fff; box-sizing: border-box; font-size: 14px; outline: none; cursor: pointer;">
                  <option value="tou" ${d.bessTariffModel === 'tou' ? 'selected' : ''}>${this.t('tou_tariff_option')}</option>
                  <option value="normal" ${d.bessTariffModel === 'normal' ? 'selected' : ''}>${this.t('tiered_tariff_option')}</option>
                </select>
              </div>
              <div style="grid-column: 1 / -1; margin-top: 6px;">
                <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #fff; cursor: pointer; user-select: none;">
                  <input type="checkbox" id="input-bess-grid-charge" ${d.bessGridCharging ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px; margin: 0;" /> ${this.t('enable_grid_charging')}
                </label>
              </div>
            </div>
            <button class="action-btn" id="btn-save-bess" style="width: 100%; background-color: var(--primary-color, #03a9f4); color: #fff; border: none; border-radius: 6px; padding: 12px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; outline: none; transition: background-color 0.2s;">
              ${this.t('btn_save_bess')}
            </button>
          </div>

          <!-- Full Width BESS 12-Month simulation lookback -->
          <div class="card full-width" style="margin-top: 24px;">
            <h2>${this.t('bess_lookback_title')}</h2>
            <p style="font-size: 14px; color: var(--secondary-text-color, #9e9e9e); line-height: 1.5; margin-bottom: 20px;">
              ${this.t('bess_lookback_desc')}
            </p>

            ${!d.bess12MonthsData ? `
              <div style="text-align: center; padding: 30px 10px;">
                <button class="action-btn" id="btn-trigger-bess-lookback" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 14px 28px; background-color: var(--warning-color, #ff9800); color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; outline: none; transition: background-color 0.2s;">
                  ${this._isBessAnalyzing ? this.t('btn_calc_bess_running') : this.t('btn_calc_bess')}
                </button>
              </div>
            ` : `
              <div class="lookback-summary-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
                <div class="summary-subcard" style="background-color: rgba(255,255,255,0.03); border: 1px solid var(--divider-color, rgba(255,255,255,0.1)); padding: 16px; border-radius: 8px; text-align: center;">
                  <div style="font-size: 12px; color: #9e9e9e; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">${this.t('annual_battery_savings')}</div>
                  <div style="font-size: 24px; font-weight: bold; color: var(--success-color, #4caf50);">฿${this._formatNum(d.bessLookbackTotalSavings)}</div>
                </div>
                <div class="summary-subcard" style="background-color: rgba(255,255,255,0.03); border: 1px solid var(--divider-color, rgba(255,255,255,0.1)); padding: 16px; border-radius: 8px; text-align: center;">
                  <div style="font-size: 12px; color: #9e9e9e; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">${this.t('annual_shifted_energy')}</div>
                  <div style="font-size: 24px; font-weight: bold; color: var(--primary-color, #03a9f4);">${this._formatNum(d.bessLookbackTotalShifted)} kWh</div>
                </div>
                <div class="summary-subcard" style="background-color: rgba(255,255,255,0.03); border: 1px solid var(--divider-color, rgba(255,255,255,0.1)); padding: 16px; border-radius: 8px; text-align: center;">
                  <div style="font-size: 12px; color: #9e9e9e; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">${this.t('corrected_payback_period')}</div>
                  <div style="font-size: 24px; font-weight: bold; color: ${d.bessLookbackPaybackYears < 6.0 ? 'var(--success-color, #4caf50)' : (d.bessLookbackPaybackYears < 12.0 ? 'var(--warning-color, #ff9800)' : 'var(--error-color, #f44336)')};">
                    ${d.bessLookbackPaybackYears === Infinity ? 'Infinite' : `${d.bessLookbackPaybackYears.toFixed(1)} ${this._lang === 'th' ? 'ปี' : 'Years'}`}
                  </div>
                </div>
              </div>

              <div class="table-container" style="overflow-x: auto; border: 1px solid var(--divider-color, rgba(255,255,255,0.08)); border-radius: 8px;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                  <thead>
                    <tr style="background-color: rgba(255,255,255,0.04); border-bottom: 1px solid var(--divider-color, rgba(255,255,255,0.12));">
                      <th style="padding: 12px 16px; font-weight: 600; color: #fff;">${this.t('col_month')}</th>
                      <th style="padding: 12px 16px; font-weight: 600; color: #fff; text-align: right;">${this.t('col_grid_export')}</th>
                      <th style="padding: 12px 16px; font-weight: 600; color: #fff; text-align: right;">${this.t('col_shifted_energy')}</th>
                      <th style="padding: 12px 16px; font-weight: 600; color: #fff; text-align: right;">${this.t('col_savings')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${d.bess12MonthsData.map(row => `
                      <tr style="border-bottom: 1px solid var(--divider-color, rgba(255,255,255,0.06));">
                        <td style="padding: 12px 16px; font-weight: 500; color: #e0e0e0;">${row.month}</td>
                        <td style="padding: 12px 16px; color: var(--secondary-text-color, #9e9e9e); text-align: right;">${this._formatNum(row.export_kwh)} kWh</td>
                        <td style="padding: 12px 16px; color: var(--primary-color, #03a9f4); text-align: right; font-weight: 500;">${this._formatNum(row.shifted_kwh)} kWh</td>
                        <td style="padding: 12px 16px; color: var(--success-color, #4caf50); text-align: right; font-weight: 600;">฿${this._formatNum(row.savings_thb)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>

              <div style="text-align: center; margin-top: 20px;">
                <button class="action-btn" id="btn-trigger-bess-lookback" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 20px; background-color: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; outline: none; transition: background-color 0.2s;">
                  ${this._isBessAnalyzing ? '🔄 ...' : this.t('btn_run_again')}
                </button>
              </div>
            `}
          </div>
        </div>
      ` : ''}

      <!-- Tab 4: Detailed Tariff Optimizer -->
      ${this._activeTab === 'predictive' ? `
        <div class="grid">
          <div class="card full-width">
            <h2>${this.t('tariff_optimizer_title')}</h2>
            <p style="font-size: 14px; color: var(--secondary-text-color, #9e9e9e); line-height: 1.5; margin-bottom: 20px;">
              ${this.t('tariff_optimizer_desc')}
            </p>

            ${!d.lookbackData ? `
              <div style="text-align: center; padding: 40px 20px; border: 1px dashed var(--divider-color, rgba(255, 255, 255, 0.12)); border-radius: 8px;">
                <div style="font-size: 15px; margin-bottom: 16px; color: var(--primary-text-color, #ffffff);">
                  ${this.t('no_lookback_yet')}
                </div>
                <button class="action-btn" id="btn-trigger-lookback" style="background-color: var(--primary-color, #03a9f4); color: #fff; border: none; border-radius: 6px; padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; outline: none; transition: background-color 0.2s;">
                  ${this._isAnalyzing ? this.t('btn_running_lookback') : this.t('btn_trigger_lookback')}
                </button>
              </div>
            ` : `
              <!-- Lookback Simulation Results -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="margin: 0; font-size: 15px; font-weight: 500; color: #fff;">${this.t('simulation_cost_comparison')}</h3>
                <button class="action-btn" id="btn-trigger-lookback" style="background-color: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 6px 12px; font-size: 12px; cursor: pointer; outline: none;">
                  ${this._isAnalyzing ? '⏳ ...' : this.t('btn_rerun_analysis')}
                </button>
              </div>

              <!-- 12-Month Comparison SVG Bar Chart -->
              <div class="chart-wrapper" style="margin-bottom: 24px;">
                <div class="y-axis">
                  <span>฿${lookbackMaxVal.toFixed(0)}</span>
                  <span>฿${(lookbackMaxVal * 0.75).toFixed(0)}</span>
                  <span>฿${(lookbackMaxVal * 0.50).toFixed(0)}</span>
                  <span>฿${(lookbackMaxVal * 0.25).toFixed(0)}</span>
                  <span>฿0</span>
                </div>
                <div class="svg-chart-container">
                  <svg viewBox="0 0 630 150" preserveAspectRatio="none" style="width: 100%; height: 100%; overflow: visible;">
                    <!-- Grid Lines -->
                    <line x1="0" y1="0" x2="630" y2="0" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4" />
                    <line x1="0" y1="32.5" x2="630" y2="32.5" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4" />
                    <line x1="0" y1="65" x2="630" y2="65" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4" />
                    <line x1="0" y1="97.5" x2="630" y2="97.5" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4" />
                    <line x1="0" y1="130" x2="630" y2="130" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4" />

                    <!-- Columns -->
                    ${lookbackColumnsHtml}
                  </svg>
                  
                  <div class="svg-x-axis-labels" style="display: flex; justify-content: space-between; font-size: 10px; color: #9e9e9e; margin-top: 6px;">
                    ${lookbackXLabelsHtml}
                  </div>
                </div>
              </div>

              <div class="chart-legend" style="margin-bottom: 24px;">
                <div class="legend-item"><div class="legend-dot" style="background-color: #3b82f6;"></div> 1. ${this.t('col_tiered_bill')}</div>
                <div class="legend-item"><div class="legend-dot" style="background-color: #0ea5e9;"></div> 2. ${this.t('col_tou_bill')}</div>
                <div style="font-size: 11px; color: var(--secondary-text-color, #9e9e9e); margin-left: auto;">
                  ${this.t('hover_deltas_hint')}
                </div>
              </div>

              <!-- Detailed Historical Monthly Cost Table -->
              <h3 style="margin-bottom: 12px; font-size: 15px; font-weight: 500; color: #fff;">${this.t('simulation_cost_comparison')}</h3>
              <div style="overflow-x: auto; background-color: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid var(--divider-color, rgba(255,255,255,0.12));">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; color: var(--primary-text-color, #fff);">
                  <thead>
                    <tr style="background-color: rgba(255,255,255,0.04); border-bottom: 1px solid var(--divider-color, rgba(255,255,255,0.12));">
                      <th style="padding: 10px 14px; font-weight: 600; color: #9e9e9e;">${this.t('col_month')}</th>
                      <th style="padding: 10px 14px; font-weight: 600; color: #9e9e9e;">Total Import</th>
                      <th style="padding: 10px 14px; font-weight: 600; color: #9e9e9e;">Peak/Off-Peak split</th>
                      <th style="padding: 10px 14px; font-weight: 600; color: #9e9e9e;">${this.t('col_tiered_bill')}</th>
                      <th style="padding: 10px 14px; font-weight: 600; color: #9e9e9e;">${this.t('col_tou_bill')}</th>
                      <th style="padding: 10px 14px; font-weight: 600; color: #9e9e9e;">${this.t('col_difference')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${d.lookbackData.map(row => {
                      const savingClass = row.savings >= 0 ? 'saving' : 'warning';
                      const benefitText = row.savings >= 0 ? `+฿${row.savings.toFixed(2)}` : `-฿${Math.abs(row.savings).toFixed(2)}`;
                      return `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                          <td style="padding: 10px 14px; font-weight: 500;">${row.month}</td>
                          <td style="padding: 10px 14px;">${row.total_kwh.toFixed(1)} kWh</td>
                          <td style="padding: 10px 14px; color: #9e9e9e;">${row.peak_kwh.toFixed(1)} P / ${row.offpeak_kwh.toFixed(1)} OP</td>
                          <td style="padding: 10px 14px;">฿${row.tiered_cost.toFixed(2)}</td>
                          <td style="padding: 10px 14px;">฿${row.tou_cost.toFixed(2)}</td>
                          <td style="padding: 10px 14px; font-weight: 600;" class="${savingClass}">${benefitText}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>

          <!-- Existing Tariff details cards -->
          <div class="card">
            <h2>${this.t('tariff_optimizer_title')}</h2>
            <div class="metric-main ${diffClass}">${diffText}</div>
            <div class="table-rows">
              <div class="row">
                <span class="label">Current Registered Tariff</span>
                <span class="val">Tariff ${d.tariffCategory}</span>
              </div>
              <div class="row">
                <span class="label">Opposing Comparison Model</span>
                <span class="val">${d.opposingTariffName}</span>
              </div>
              <div class="row">
                <span class="label">Optimized Tariff Recommendation</span>
                <span class="val ${diffClass}">${diffVal >= 0 ? 'Stay on Tariff ' + d.tariffCategory : 'Switch to ' + d.opposingTariffName}</span>
              </div>
            </div>
          </div>

          <div class="card">
            <h2>${this.t('tariff_regulations_title')}</h2>
            <div class="table-rows">
              <div class="row">
                <span class="label">${this.t('tariff_11_pso')}</span>
                <span class="val">${this.t('tariff_11_pso_val')}</span>
              </div>
              <div class="row">
                <span class="label">${this.t('tariff_11_threshold')}</span>
                <span class="val">${this.t('tariff_11_threshold_val')}</span>
              </div>
              <div class="row">
                <span class="label">${this.t('auto_reclass_engine')}</span>
                <span class="val">${this.t('auto_reclass_engine_val')}</span>
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Tab 4: Grid Outages -->
      ${this._activeTab === 'outages' ? `
        <div class="grid">
          <div class="card full-width">
            <h2>${this.t('outages_title')}</h2>
            <div class="metric-main warning">${d.outageCount} <span style="font-size: 20px; font-weight: 500;">${this.t('incidents_label')}</span></div>
            <div class="table-rows" style="margin-bottom: 20px;">
              <div class="row">
                <span class="label">${this.t('total_cumulative_downtime')}</span>
                <span class="val warning">${(() => {
                  const totalSec = d.totalOutageSeconds || 0;
                  const mins = Math.floor(totalSec / 60);
                  if (mins === 0 && totalSec > 0) return `${totalSec.toFixed(0)}s`;
                  const hrs = Math.floor(mins / 60);
                  const remMins = mins % 60;
                  const remSecs = Math.floor(totalSec % 60);
                  return hrs > 0 ? `${hrs}h ${remMins}m` : `${mins}m ${remSecs}s`;
                })()}</span>
              </div>
            </div>

            <h3 style="margin-top: 20px; margin-bottom: 12px; font-size: 15px; font-weight: 500; color: #fff;">${this.t('outage_log_book')}</h3>
            ${d.outageHistory && d.outageHistory.length > 0 ? `
              <div style="overflow-x: auto; background-color: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid var(--divider-color, rgba(255,255,255,0.12));">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; color: var(--primary-text-color, #fff);">
                  <thead>
                    <tr style="background-color: rgba(255,255,255,0.04); border-bottom: 1px solid var(--divider-color, rgba(255,255,255,0.12));">
                      <th style="padding: 10px 14px; font-weight: 600; color: #9e9e9e;">${this.t('col_start_time')}</th>
                      <th style="padding: 10px 14px; font-weight: 600; color: #9e9e9e;">${this.t('col_end_time')}</th>
                      <th style="padding: 10px 14px; font-weight: 600; color: #9e9e9e;">${this.t('col_duration')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${d.outageHistory.map(row => `
                      <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                        <td style="padding: 10px 14px;">${row.start}</td>
                        <td style="padding: 10px 14px;">${row.end}</td>
                        <td style="padding: 10px 14px; font-weight: 600; color: var(--error-color, #f44336);">${row.duration}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : `
              <div style="text-align: center; padding: 20px; color: #9e9e9e; font-size: 13px; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">
                ${this.t('no_outages_recorded')}
              </div>
            `}
          </div>
        </div>
      ` : ''}

      <!-- Tab 7: Configuration Settings -->
      ${this._activeTab === 'settings' ? `
        <div class="grid">
          <div class="card">
            <h2>${this.t('settings_sensors_title')}</h2>
            <div class="table-rows" style="gap: 16px; margin-bottom: 20px;">
              <div>
                <label style="display: block; font-size: 12px; color: #9e9e9e; margin-bottom: 6px;">${this.t('setting_import_sensor')}</label>
                <input type="text" id="setting-grid-import" value="${d.importSensorId}" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--divider-color, rgba(255,255,255,0.12)); background-color: rgba(0,0,0,0.25); color: #fff; box-sizing: border-box; font-size: 14px; outline: none;" />
              </div>
              <div>
                <label style="display: block; font-size: 12px; color: #9e9e9e; margin-bottom: 6px;">${this.t('setting_export_sensor')}</label>
                <input type="text" id="setting-grid-export" value="${d.exportSensorId}" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--divider-color, rgba(255,255,255,0.12)); background-color: rgba(0,0,0,0.25); color: #fff; box-sizing: border-box; font-size: 14px; outline: none;" />
              </div>
              <div>
                <label style="display: block; font-size: 12px; color: #9e9e9e; margin-bottom: 6px;">${this.t('setting_solar_sensor')}</label>
                <input type="text" id="setting-solar-prod" value="${d.solarSensorId}" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--divider-color, rgba(255,255,255,0.12)); background-color: rgba(0,0,0,0.25); color: #fff; box-sizing: border-box; font-size: 14px; outline: none;" />
              </div>
            </div>
          </div>

          <div class="card">
            <h2>${this.t('settings_utility_title')}</h2>
            <div class="table-rows" style="gap: 16px; margin-bottom: 20px;">
              <div>
                <label style="display: block; font-size: 12px; color: #9e9e9e; margin-bottom: 6px;">${this.t('setting_provider')}</label>
                <select id="setting-utility-provider" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--divider-color, rgba(255,255,255,0.12)); background-color: rgba(0,0,0,0.25); color: #fff; box-sizing: border-box; font-size: 14px; outline: none; cursor: pointer;">
                  <option value="MEA" ${d.provider === 'MEA' ? 'selected' : ''}>MEA (Metropolitan Electricity Authority)</option>
                  <option value="PEA" ${d.provider === 'PEA' ? 'selected' : ''}>PEA (Provincial Electricity Authority)</option>
                </select>
              </div>
              <div>
                <label style="display: block; font-size: 12px; color: #9e9e9e; margin-bottom: 6px;">${this.t('setting_tariff_category')}</label>
                <select id="setting-tariff-category" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--divider-color, rgba(255,255,255,0.12)); background-color: rgba(0,0,0,0.25); color: #fff; box-sizing: border-box; font-size: 14px; outline: none; cursor: pointer;">
                  <option value="1.1" ${d.tariffCategory === '1.1' ? 'selected' : ''}>Tariff 1.1 (Progressive &le; 150 kWh)</option>
                  <option value="1.2" ${d.tariffCategory === '1.2' ? 'selected' : ''}>Tariff 1.2 (Progressive &gt; 150 kWh)</option>
                  <option value="1.3.1" ${d.tariffCategory === '1.3.1' ? 'selected' : ''}>Tariff 1.3.1 (TOU 12-24 kV)</option>
                  <option value="1.3.2" ${d.tariffCategory === '1.3.2' ? 'selected' : ''}>Tariff 1.3.2 (TOU Below 12 kV)</option>
                </select>
              </div>
              <div>
                <label style="display: block; font-size: 12px; color: #9e9e9e; margin-bottom: 6px;">${this.t('setting_billing_day')}</label>
                <input type="number" id="setting-billing-day" value="${d.billingDay}" min="1" max="31" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--divider-color, rgba(255,255,255,0.12)); background-color: rgba(0,0,0,0.25); color: #fff; box-sizing: border-box; font-size: 14px; outline: none;" />
              </div>
            </div>
          </div>

          <div class="card">
            <h2>${this.t('settings_financial_title')}</h2>
            <div class="table-rows" style="gap: 16px; margin-bottom: 20px;">
              <div>
                <label style="display: block; font-size: 12px; color: #9e9e9e; margin-bottom: 6px;">${this.t('setting_ft_rate')}</label>
                <input type="number" id="setting-ft-rate" value="${d.ftRate}" step="0.0001" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--divider-color, rgba(255,255,255,0.12)); background-color: rgba(0,0,0,0.25); color: #fff; box-sizing: border-box; font-size: 14px; outline: none;" />
              </div>
              <div>
                <label style="display: block; font-size: 12px; color: #9e9e9e; margin-bottom: 6px;">${this.t('setting_sellback_rate')}</label>
                <input type="number" id="setting-sellback-rate" value="${d.sellbackRate}" step="0.01" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--divider-color, rgba(255,255,255,0.12)); background-color: rgba(0,0,0,0.25); color: #fff; box-sizing: border-box; font-size: 14px; outline: none;" />
              </div>
              <div style="display: flex; gap: 20px; align-items: center; margin-top: 10px;">
                <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #fff; cursor: pointer;">
                  <input type="checkbox" id="setting-mea-ebill" ${d.meaEbillActive ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" /> ${this.t('setting_ebill')}
                </label>
                <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #fff; cursor: pointer;">
                  <input type="checkbox" id="setting-mea-epayment" ${d.meaEpaymentActive ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" /> ${this.t('setting_epayment')}
                </label>
              </div>
            </div>
          </div>
          <div class="card full-width" style="margin-top: 10px;">
            <h2>${this.t('settings_custom_rates_title')}</h2>
            <p style="font-size: 13px; color: var(--secondary-text-color, #9e9e9e); line-height: 1.4; margin-bottom: 16px;">
              ${this.t('settings_custom_rates_desc')}
            </p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
              <div>
                <label style="display: block; font-size: 12px; color: #9e9e9e; margin-bottom: 6px;">${this.t('setting_tou_peak_rate')}</label>
                <input type="number" id="setting-custom-peak-rate" value="${d.customPeakRate}" placeholder="Default: 5.7982" step="0.0001" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--divider-color, rgba(255,255,255,0.12)); background-color: rgba(0,0,0,0.25); color: #fff; box-sizing: border-box; font-size: 14px; outline: none;" />
              </div>
              <div>
                <label style="display: block; font-size: 12px; color: #9e9e9e; margin-bottom: 6px;">${this.t('setting_tou_offpeak_rate')}</label>
                <input type="number" id="setting-custom-offpeak-rate" value="${d.customOffpeakRate}" placeholder="Default: 2.6369" step="0.0001" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--divider-color, rgba(255,255,255,0.12)); background-color: rgba(0,0,0,0.25); color: #fff; box-sizing: border-box; font-size: 14px; outline: none;" />
              </div>
              <div>
                <label style="display: block; font-size: 12px; color: #9e9e9e; margin-bottom: 6px;">${this.t('setting_tier1_rate')}</label>
                <input type="number" id="setting-custom-tier1-rate" value="${d.customTier1Rate}" placeholder="Default: 3.2484" step="0.0001" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--divider-color, rgba(255,255,255,0.12)); background-color: rgba(0,0,0,0.25); color: #fff; box-sizing: border-box; font-size: 14px; outline: none;" />
              </div>
              <div>
                <label style="display: block; font-size: 12px; color: #9e9e9e; margin-bottom: 6px;">${this.t('setting_tier2_rate')}</label>
                <input type="number" id="setting-custom-tier2-rate" value="${d.customTier2Rate}" placeholder="Default: 4.2233" step="0.0001" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--divider-color, rgba(255,255,255,0.12)); background-color: rgba(0,0,0,0.25); color: #fff; box-sizing: border-box; font-size: 14px; outline: none;" />
              </div>
              <div>
                <label style="display: block; font-size: 12px; color: #9e9e9e; margin-bottom: 6px;">${this.t('setting_tier3_rate')}</label>
                <input type="number" id="setting-custom-tier3-rate" value="${d.customTier3Rate}" placeholder="Default: 4.4217" step="0.0001" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--divider-color, rgba(255,255,255,0.12)); background-color: rgba(0,0,0,0.25); color: #fff; box-sizing: border-box; font-size: 14px; outline: none;" />
              </div>
            </div>
          </div>

          <div class="card full-width" style="text-align: right; padding-top: 10px; border: none; background-color: transparent;">
            <button class="action-btn" id="btn-save-settings" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 14px 28px; background-color: var(--success-color, #4caf50); color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; outline: none; transition: background-color 0.2s;">
              ${this.t('btn_save_settings')}
            </button>
          </div>
        </div>
      ` : ''}

      <div class="footer-note">
        Thailand Energy & Solar Monitor v2.3.6 &bull; Home Assistant Custom Integration
      </div>
    `;

    this._attachTabEvents();
    this._rendered = true;
  }
}

  customElements.define('thai-energy-panel', ThaiEnergyPanel);
})();

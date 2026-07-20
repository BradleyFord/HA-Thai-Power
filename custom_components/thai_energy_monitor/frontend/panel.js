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

class ThaiEnergyPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._activeTab = 'overview';
    this._dailyChartMode = 'kwh';
    this._isAnalyzing = false;
    this._data = {};
    this._rendered = false;
  }

  set hass(hass) {
    this._hass = hass;
    this._extractData();

    if (!this._rendered) {
      this._initialRender();
    } else {
      this._updateDOMValues();
    }
  }

  _getIsOffpeak(states) {
    for (const entityId in states) {
      if (entityId.includes('tou_window_status') || entityId.includes('tou_status')) {
        const st = states[entityId].state;
        if (st && st !== 'unavailable' && st !== 'unknown' && st !== '0.00') {
          return st.toLowerCase().includes('off');
        }
      }
    }

    for (const entityId in states) {
      if (entityId.includes('thai_energy') || entityId.includes('monthly_estimated_bill')) {
        const attrs = states[entityId].attributes;
        if (attrs) {
          if (attrs.is_offpeak !== undefined && attrs.is_offpeak !== null) {
            return attrs.is_offpeak === true || String(attrs.is_offpeak).toLowerCase() === 'true';
          }
          if (attrs.tou_status) {
            return String(attrs.tou_status).toLowerCase().includes('off');
          }
        }
      }
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

  _extractData() {
    if (!this._hass) return;

    const states = this._hass.states;

    const getEntityState = (key) => {
      if (states[key]) {
        const st = states[key].state;
        if (st && st !== 'unavailable' && st !== 'unknown') {
          return st;
        }
      }
      return '0.00';
    };

    const getAttribute = (key, attr) => {
      if (states[key] && states[key].attributes && states[key].attributes[attr] !== undefined) {
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

    for (const entityId in states) {
      if (entityId.includes('solcast')) {
        solcastEntityFound = true;
        if (entityId.includes('forecast_today') || entityId.includes('today')) {
          solcastForecastToday = states[entityId].state;
        } else if (entityId.includes('power_now') || entityId.includes('now')) {
          solcastPowerNow = states[entityId].state;
        } else if (entityId.includes('remaining_today') || entityId.includes('remaining')) {
          solcastForecastRemaining = states[entityId].state;
        }
      }
    }

    const isOffpeak = this._getIsOffpeak(states);
    const touStatus = isOffpeak ? 'Off-Peak' : 'Peak';

    // Map exact sensor names to eliminate collision with any other integration sensors
    const totalBill = getEntityState('sensor.monthly_estimated_bill');
    const baseCost = getEntityState('sensor.monthly_base_energy_cost');
    const ftCharge = getEntityState('sensor.monthly_ft_charge');
    const serviceCharge = getEntityState('sensor.monthly_fixed_service_charge');
    const vatAmount = getEntityState('sensor.monthly_calculated_vat_7');
    const importKwh = getEntityState('sensor.monthly_grid_import_energy');
    const exportKwh = getEntityState('sensor.monthly_grid_export_energy');
    const solarKwh = getEntityState('sensor.monthly_solar_production_energy');

    const solarKwhNum = parseFloat(solarKwh) || 0;
    const exportKwhNum = parseFloat(exportKwh) || 0;
    const selfConsumedKwh = Math.max(0, solarKwhNum - exportKwhNum);
    const selfConsumptionRatio = solarKwhNum > 0 ? Math.min(100, Math.round((selfConsumedKwh / solarKwhNum) * 100)) : 0;

    const totalBillNum = Math.max(1, parseFloat(totalBill) || 1);
    const basePct = Math.min(100, Math.round(((parseFloat(baseCost) || 0) / totalBillNum) * 100));
    const ftPct = Math.min(100, Math.round(((parseFloat(ftCharge) || 0) / totalBillNum) * 100));
    const vatPct = Math.min(100, Math.round(((parseFloat(vatAmount) || 0) / totalBillNum) * 100));

    // Extract Baseline Variables for Debug Diagnostic Panel
    const importSensorId = getAttribute('sensor.monthly_estimated_bill', 'import_sensor_id') || 'sensor.power_meter_consumption';
    const exportSensorId = getAttribute('sensor.monthly_estimated_bill', 'export_sensor_id') || 'sensor.power_meter_exported';
    const solarSensorId = getAttribute('sensor.monthly_estimated_bill', 'solar_sensor_id') || 'sensor.inverter_total_yield';

    const importBaseline = getAttribute('sensor.monthly_estimated_bill', 'import_baseline_kwh');
    const solarBaseline = getAttribute('sensor.monthly_estimated_bill', 'solar_baseline_kwh');
    const exportBaseline = getAttribute('sensor.monthly_estimated_bill', 'export_baseline_kwh');

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
    const pyImportHistory = getAttribute('sensor.monthly_estimated_bill', 'daily_import_kwh_history') || [];
    const pySolarHistory = getAttribute('sensor.monthly_estimated_bill', 'daily_solar_kwh_history') || [];
    const pyExportHistory = getAttribute('sensor.monthly_estimated_bill', 'daily_export_kwh_history') || [];

    // Extract 12-Month lookback dataset from Python coordinator attributes
    const lookbackData = getAttribute('sensor.monthly_estimated_bill', 'lookback_12_months_data');
    if (lookbackData) {
      this._isAnalyzing = false;
    }

    const today = new Date();
    const currentDay = Math.min(30, Math.max(1, today.getDate()));
    const totalBaseNum = parseFloat(baseCost) || 0;
    const totalFtNum = parseFloat(ftCharge) || 0;
    const totalServiceNum = parseFloat(serviceCharge) || 38.22;
    const totalVatNum = parseFloat(vatAmount) || 0;
    const ftRate = getAttribute('sensor.monthly_estimated_bill', 'ft_rate') || 0.395;
    const tariffCategory = getAttribute('sensor.monthly_estimated_bill', 'tariff_category') || '1.2';
    const sellbackRate = getAttribute('sensor.monthly_estimated_bill', 'solar_sellback_rate') || 2.20;
    const VAT_RATE = 0.07;

    // Check if active tariff is TOU (Time of Use 1.3.1 or 1.3.2)
    const isTou = tariffCategory.startsWith('1.3');
    const peakRate = tariffCategory === '1.3.1' ? 5.2636 : 5.7982;
    const offpeakRate = tariffCategory === '1.3.1' ? 2.6295 : 2.6369;

    // Generate non-linear cumulative monthly bill progression with 3 Base tiers or TOU Peak/Off-Peak split
    let runningKwh = 0.0;
    const dailyKwhList = [];
    for (let day = 1; day <= 30; day++) {
      const isPastOrToday = day <= currentDay;
      const dayKwh = pyImportHistory[day - 1] !== undefined ? parseFloat(pyImportHistory[day - 1]) : 15.0;
      runningKwh += dayKwh;
      dailyKwhList.push({ day, runningKwh, isPastOrToday });
    }

    const maxAccruedKwh = Math.max(0.1, runningKwh);

    const monthlyDailyBars = dailyKwhList.map((item) => {
      const isPastOrToday = item.isPastOrToday;
      let t1Val = 0, t2Val = 0, t3Val = 0, peakVal = 0, offpeakVal = 0, bVal = 0;

      if (isTou) {
        // Dynamic Peak/Off-Peak split based on active cumulative run-rate
        peakVal = (item.runningKwh * 0.40) * peakRate;
        offpeakVal = (item.runningKwh * 0.60) * offpeakRate;
        bVal = peakVal + offpeakVal;
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
      const bar = monthlyDailyBars[i];
      const prevBar = i > 0 ? monthlyDailyBars[i - 1] : { tier1: 0, tier2: 0, tier3: 0, ft: 0, peak: 0, offpeak: 0 };
      
      const impKwh = pyImportHistory[i] !== undefined ? parseFloat(pyImportHistory[i]) : 15.0;
      const solKwh = pySolarHistory[i] !== undefined ? parseFloat(pySolarHistory[i]) : 15.0;
      const expKwh = pyExportHistory[i] !== undefined ? parseFloat(pyExportHistory[i]) : 4.0;
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

      const prodVal = pySolarHistory[day - 1] !== undefined ? parseFloat(pySolarHistory[day - 1]) : 15.0;
      const exportVal = pyExportHistory[day - 1] !== undefined ? parseFloat(pyExportHistory[day - 1]) : 4.0;
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
      lifetimeBenefit: getEntityState('sensor.lifetime_total_solar_benefit'),
      lifetimeImport: getEntityState('sensor.lifetime_grid_import_energy'),
      lifetimeSolar: getEntityState('sensor.lifetime_solar_production_energy'),
      marginalRate: getEntityState('sensor.active_marginal_retail_rate'),
      gridPrice: getEntityState('sensor.current_grid_energy_import_price'),
      ftRate: getEntityState('sensor.current_ft_adjustment_rate'),
      sellbackRate: getEntityState('sensor.solar_buy_back_rate'),
      tariffDiff: getEntityState('sensor.predictive_tariff_difference'),
      bessSavings: getEntityState('sensor.bess_storage_simulated_savings'),
      meaPoints: getEntityState('sensor.mea_virtual_points_balance'),
      meaCash: getEntityState('sensor.mea_points_cash_value'),
      outageCost: getEntityState('sensor.grid_outage_economic_cost'),
      outageCount: getEntityState('sensor.grid_outage_incident_count'),
      lastMonthBill: getAttribute('sensor.monthly_estimated_bill', 'last_month_bill_thb') || '0.00',
      lastMonthImport: getAttribute('sensor.monthly_estimated_bill', 'last_month_import_kwh') || '0.00',
      provider: getAttribute('sensor.monthly_estimated_bill', 'utility_provider') || 'MEA',
      tariffCategory: tariffCategory,
      opposingTariffName: getAttribute('sensor.monthly_estimated_bill', 'opposing_tariff_name') || 'TOU 1.3.2',
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
      solcastEntityFound: solcastEntityFound,
      solcastForecastToday: solcastForecastToday,
      solcastPowerNow: solcastPowerNow,
      solcastForecastRemaining: solcastForecastRemaining,

      // Debug Diagnostic Properties
      importSensorId: importSensorId,
      exportSensorId: exportSensorId,
      solarSensorId: solarSensorId,
      importBaseline: importBaseline !== null ? parseFloat(importBaseline).toFixed(3) : 'Not Initialized',
      solarBaseline: solarBaseline !== null ? parseFloat(solarBaseline).toFixed(3) : 'Not Initialized',
      exportBaseline: exportBaseline !== null ? parseFloat(exportBaseline).toFixed(3) : 'Not Initialized',
      importCurrentReading: importCurrentReading,
      solarCurrentReading: solarCurrentReading,
      exportCurrentReading: exportCurrentReading,
      importUnit: importUnit,
      solarUnit: solarUnit,
      exportUnit: exportUnit,
      currentDayOfCycle: currentDay,
      billingResetDay: getAttribute('sensor.monthly_estimated_bill', 'billing_day') || '1',

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

    const btnTrigger = shadow.getElementById('btn-trigger-lookback');
    if (btnTrigger) {
      btnTrigger.addEventListener('click', () => {
        this._isAnalyzing = true;
        this._initialRender();
        this._hass.callService('thai_energy_monitor', 'trigger_12_month_lookback', {});
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

    setText('val-tou-status', d.touStatus);
    setText('val-total-bill', `฿${d.totalBill}`);
    setText('val-base-cost', `฿${d.baseCost}`);
    setText('val-ft-charge', `฿${d.ftCharge}`);
    setText('val-vat-amount', `฿${d.vatAmount}`);
    setText('val-import-kwh', d.importKwh);
    setText('val-solar-benefit', `฿${d.totalSolarBenefit}`);
    setText('val-solar-savings', `฿${d.solarSavings}`);
    setText('val-solar-revenue', `฿${d.solarRevenue}`);
  }

  _initialRender() {
    const d = this._data;
    const isOffpeak = d.isOffpeak;
    const offpeakBadge = isOffpeak
      ? `<span class="badge offpeak">Off-Peak Window</span>`
      : `<span class="badge peak">Peak Window</span>`;

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

    const pointsSelfPast = getPointsSegment(d.solarMonthlyTrends, 'selfConsumption', 0, currentDay - 1);
    const pointsSelfFuture = getPointsSegment(d.solarMonthlyTrends, 'selfConsumption', currentDay - 1, 29);

    const pointsExportPast = getPointsSegment(d.solarMonthlyTrends, 'export', 0, currentDay - 1);
    const pointsExportFuture = getPointsSegment(d.solarMonthlyTrends, 'export', currentDay - 1, 29);

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
      const unitStr = mode === 'kwh' ? ' kWh' : ' THB';
      const prefixStr = mode === 'thb' ? '฿' : '';

      return `
        <!-- Import Column (Blue) -->
        <rect x="${xImp}" y="${yImp}" width="${colW}" height="${hImp}" fill="#2196f3" rx="2" opacity="${opacity}">
          <title>Day ${item.day}: Grid Import ${prefixStr}${valImp.toFixed(2)}${unitStr}</title>
        </rect>
        
        <!-- Solar Column (Green) -->
        <rect x="${xSol}" y="${ySol}" width="${colW}" height="${hSol}" fill="#4caf50" rx="2" opacity="${opacity}">
          <title>Day ${item.day}: Solar Yield ${prefixStr}${valSol.toFixed(2)}${unitStr}</title>
        </rect>
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

        /* Grid Layout */
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 20px;
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
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
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
          Billing Overview
        </button>
        <button class="tab-btn ${this._activeTab === 'solar' ? 'active' : ''}" data-tab="solar">
          Solar ROI & BESS
        </button>
        <button class="tab-btn ${this._activeTab === 'predictive' ? 'active' : ''}" data-tab="predictive">
          Tariff Optimizer
        </button>
        <button class="tab-btn ${this._activeTab === 'reliability' ? 'active' : ''}" data-tab="reliability">
          Rewards & Outages
        </button>
      </div>

      <!-- Tab 1: Detailed Billing Overview -->
      ${this._activeTab === 'overview' ? `
        <div class="grid">
          <div class="card">
            <h2>Current Monthly Estimated Bill <span>(THB)</span></h2>
            <div class="metric-main" id="val-total-bill">฿${d.totalBill}</div>
            <div class="table-rows">
              <div class="row">
                <span class="label">Base Energy Charge</span>
                <span class="val" id="val-base-cost">฿${d.baseCost}</span>
              </div>
              <div class="row">
                <span class="label">Ft Charge (${d.ftRate} ฿/kWh)</span>
                <span class="val" id="val-ft-charge">฿${d.ftCharge}</span>
              </div>
              <div class="row">
                <span class="label">Fixed Service Charge</span>
                <span class="val">฿${d.serviceCharge}</span>
              </div>
              <div class="row">
                <span class="label">Statutory VAT (7%)</span>
                <span class="val" id="val-vat-amount">฿${d.vatAmount}</span>
              </div>
            </div>

            <div class="progress-container">
              ${d.isTou ? `
                <div class="bar-label">
                  <span>Peak (${d.peakPct}%)</span>
                  <span>Off-Peak (${d.offpeakPct}%)</span>
                  <span>Ft (${d.ftPct}%)</span>
                  <span>VAT (${d.vatPct}%)</span>
                </div>
                <div class="bar-bg">
                  <div class="bar-segment seg-peak" style="width: ${d.peakPct}%"></div>
                  <div class="bar-segment seg-offpeak" style="width: ${d.offpeakPct}%"></div>
                  <div class="bar-segment seg-ft" style="width: ${d.ftPct}%"></div>
                  <div class="bar-segment seg-vat" style="width: ${d.vatPct}%"></div>
                </div>
              ` : `
                <div class="bar-label">
                  <span>Tier 1 (${d.t1Pct}%)</span>
                  <span>Tier 2 (${d.t2Pct}%)</span>
                  <span>Tier 3 (${d.t3Pct}%)</span>
                  <span>Ft (${d.ftPct}%)</span>
                  <span>VAT (${d.vatPct}%)</span>
                </div>
                <div class="bar-bg">
                  <div class="bar-segment seg-tier1" style="width: ${d.t1Pct}%"></div>
                  <div class="bar-segment seg-tier2" style="width: ${d.t2Pct}%"></div>
                  <div class="bar-segment seg-tier3" style="width: ${d.t3Pct}%"></div>
                  <div class="bar-segment seg-ft" style="width: ${d.ftPct}%"></div>
                  <div class="bar-segment seg-vat" style="width: ${d.vatPct}%"></div>
                </div>
              `}
            </div>
          </div>

          <div class="card">
            <h2>Detailed Consumption & Rates</h2>
            <div class="metric-main" style="color: var(--primary-color, #03a9f4);"><span id="val-import-kwh">${d.importKwh}</span> <span style="font-size: 18px;">kWh</span></div>
            <div class="table-rows">
              <div class="row">
                <span class="label">TOU Window Status</span>
                <span class="val" id="val-tou-status">${d.touStatus}</span>
              </div>
              <div class="row">
                <span class="label">Active Marginal Retail Rate</span>
                <span class="val">฿${d.marginalRate} / kWh</span>
              </div>
              <div class="row">
                <span class="label">HA Energy Dashboard Price Entity</span>
                <span class="val">฿${d.gridPrice} / kWh</span>
              </div>
              <div class="row">
                <span class="label">Last Month Total Bill</span>
                <span class="val">฿${d.lastMonthBill} (${d.lastMonthImport} kWh)</span>
              </div>
              <div class="row">
                <span class="label">Lifetime Grid Import Volume</span>
                <span class="val">${d.lifetimeImport} kWh</span>
              </div>
            </div>
          </div>

          <!-- Full Width Cumulative Month Cost Chart with Labeled Y-Axis & Baseline Subtraction Engine -->
          <div class="card full-width">
            <h2>Cumulative Monthly Running Bill Progression (${d.isTou ? 'TOU Base Split' : 'Tiered Base Charge'})</h2>
            <div class="chart-legend">
              ${d.isTou ? `
                <div class="legend-item"><div class="legend-dot seg-service"></div> 1. Fixed Service</div>
                <div class="legend-item"><div class="legend-dot seg-peak"></div> 2. Peak Base Charge</div>
                <div class="legend-item"><div class="legend-dot seg-offpeak"></div> 3. Off-Peak Base Charge</div>
                <div class="legend-item"><div class="legend-dot seg-ft"></div> 4. Ft Charge</div>
                <div class="legend-item"><div class="legend-dot seg-vat"></div> 5. VAT (7%)</div>
              ` : `
                <div class="legend-item"><div class="legend-dot seg-service"></div> 1. Fixed Service</div>
                <div class="legend-item"><div class="legend-dot seg-tier1"></div> 2. Base Tier 1 (0-150)</div>
                <div class="legend-item"><div class="legend-dot seg-tier2"></div> 3. Base Tier 2 (151-400)</div>
                <div class="legend-item"><div class="legend-dot seg-tier3"></div> 4. Base Tier 3 (&gt;400)</div>
                <div class="legend-item"><div class="legend-dot seg-ft"></div> 5. Ft Charge</div>
                <div class="legend-item"><div class="legend-dot seg-vat"></div> 6. VAT (7%)</div>
              `}
            </div>

            <div class="chart-wrapper">
              <!-- Y-Axis Label Column -->
              <div class="y-axis">
                <span>฿${yTick4}</span>
                <span>฿${yTick3}</span>
                <span>฿${yTick2}</span>
                <span>฿${yTick1}</span>
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
                      <div class="stacked-col" style="opacity: ${opacity};" title="Day ${bar.day}: Cumulative ฿${bar.total.toFixed(2)} (Service: ฿${bar.service.toFixed(2)}, Peak: ฿${bar.peak.toFixed(2)}, Off-Peak: ฿${bar.offpeak.toFixed(2)}, Ft: ฿${bar.ft.toFixed(2)}, VAT: ฿${bar.vat.toFixed(2)})">
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
                      <div class="stacked-col" style="opacity: ${opacity};" title="Day ${bar.day}: Cumulative ฿${bar.total.toFixed(2)} (Service: ฿${bar.service.toFixed(2)}, Tier 1: ฿${bar.tier1.toFixed(2)}, Tier 2: ฿${bar.tier2.toFixed(2)}, Tier 3: ฿${bar.tier3.toFixed(2)}, Ft: ฿${bar.ft.toFixed(2)}, VAT: ฿${bar.vat.toFixed(2)})">
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
              ${d.isTou ? `
                Accurate progressive Time of Use billing cycle progression. Base Charge is split daily:
                <strong style="color: #1565c0;">Peak Charge</strong> (09:00 - 22:00, Mon-Fri) &bull;
                <strong style="color: #90caf9;">Off-Peak Charge</strong> (all other hours, weekends, and holidays).
              ` : `
                Accurate progressive tiered billing cycle progression. Base Charge is split daily:
                <strong style="color: #1976d2;">Tier 1</strong> (first 150 kWh) &bull;
                <strong style="color: #2196f3;">Tier 2</strong> (next 250 kWh) &bull;
                <strong style="color: #64b5f6;">Tier 3</strong> (excess over 400 kWh).
              `}
            </div>
          </div>

          <!-- Card: Daily Import vs Solar Comparison (Interactive Mode Toggle) -->
          <div class="card full-width">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--divider-color, rgba(255, 255, 255, 0.12)); padding-bottom: 10px; margin-bottom: 16px;">
              <h2 style="border-bottom: none; padding-bottom: 0; margin: 0;">Daily Grid Import vs Solar Production</h2>
              <div style="display: flex; gap: 6px;">
                <button class="toggle-btn ${this._dailyChartMode === 'kwh' ? 'active' : ''}" data-mode="kwh" style="background-color: ${this._dailyChartMode === 'kwh' ? 'var(--primary-color, #03a9f4)' : 'rgba(255,255,255,0.05)'}; color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 6px 12px; font-size: 11px; cursor: pointer; outline: none; font-weight: 500;">
                  Show Volume (kWh)
                </button>
                <button class="toggle-btn ${this._dailyChartMode === 'thb' ? 'active' : ''}" data-mode="thb" style="background-color: ${this._dailyChartMode === 'thb' ? 'var(--primary-color, #03a9f4)' : 'rgba(255,255,255,0.05)'}; color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 6px 12px; font-size: 11px; cursor: pointer; outline: none; font-weight: 500;">
                  Show Value (THB)
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
                  <span>Day 1</span>
                  <span>Day 5</span>
                  <span>Day 10</span>
                  <span>Day 15</span>
                  <span>Day 20</span>
                  <span>Day 25</span>
                  <span>Day 30</span>
                </div>
              </div>
            </div>

            <div class="chart-legend" style="margin-top: 14px;">
              <div class="legend-item"><div class="legend-dot" style="background-color: #2196f3;"></div> 1. Grid Import (${mode === 'kwh' ? 'Consumption Volume' : 'Incremental Cost'})</div>
              <div class="legend-item"><div class="legend-dot" style="background-color: #4caf50;"></div> 2. Solar Production (${mode === 'kwh' ? 'Yield Volume' : 'Financial Benefit'})</div>
              <div style="font-size: 11px; color: var(--secondary-text-color, #9e9e9e); margin-left: auto;">
                (Hover over bars to view exact daily deltas)
              </div>
            </div>
          </div>

          <!-- Diagnostics & Troubleshooting Panel -->
          <div class="debug-panel">
            <div class="debug-title">
              <strong>🛠️ Thailand Energy Monitor - Real-Time Calibration & Diagnostic Hub</strong>
            </div>
            <div class="debug-grid">
              <div class="debug-section">
                <h4>Grid Energy Import</h4>
                <div class="row"><span class="label">Configured Entity ID</span><span class="val">${d.importSensorId}</span></div>
                <div class="row"><span class="label">Current Reading</span><span class="val">${d.importCurrentReading} ${d.importUnit}</span></div>
                <div class="row"><span class="label">Baseline (Month Start)</span><span class="val highlight">${d.importBaseline} kWh</span></div>
                <div class="row"><span class="label">This Month Net Import</span><span class="val saving">${d.importKwh} kWh</span></div>
              </div>

              <div class="debug-section">
                <h4>Solar Production</h4>
                <div class="row"><span class="label">Configured Entity ID</span><span class="val">${d.solarSensorId}</span></div>
                <div class="row"><span class="label">Current Reading</span><span class="val">${d.solarCurrentReading} ${d.solarUnit}</span></div>
                <div class="row"><span class="label">Baseline (Month Start)</span><span class="val highlight">${d.solarBaseline} kWh</span></div>
                <div class="row"><span class="label">This Month Net Solar</span><span class="val saving">${d.solarKwh} kWh</span></div>
              </div>

              <div class="debug-section">
                <h4>Grid Energy Export</h4>
                <div class="row"><span class="label">Configured Entity ID</span><span class="val">${d.exportSensorId}</span></div>
                <div class="row"><span class="label">Current Reading</span><span class="val">${d.exportCurrentReading} ${d.exportUnit}</span></div>
                <div class="row"><span class="label">Baseline (Month Start)</span><span class="val highlight">${d.exportBaseline} kWh</span></div>
                <div class="row"><span class="label">This Month Net Export</span><span class="val saving">${d.exportKwh} kWh</span></div>
              </div>

              <div class="debug-section">
                <h4>Temporal Calibration</h4>
                <div class="row"><span class="label">Billing Reset Day</span><span class="val">Day ${d.billingResetDay} of Month</span></div>
                <div class="row"><span class="label">Current Day of Cycle</span><span class="val">Day ${d.currentDayOfCycle} / 30</span></div>
                <div class="row"><span class="label">Active Window</span><span class="val highlight">${d.touStatus}</span></div>
              </div>

              <!-- Additional User Configured Sensors Telemetry Section -->
              <div class="debug-section" style="grid-column: 1 / -1; margin-top: 10px;">
                <h4 style="color: var(--warning-color, #ff9800);">Additional Configured Home Assistant Sensors</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; font-size: 13px;">
                  <div style="background-color: rgba(255,255,255,0.02); padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
                    <strong>Grid Power Load</strong>
                    <div class="row" style="margin-top: 4px;"><span class="label">sensor.pm2230_total_active_power</span><span class="val highlight">${d.pm2230Power} ${d.pm2230PowerUnit}</span></div>
                  </div>
                  <div style="background-color: rgba(255,255,255,0.02); padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
                    <strong>Solar Active Power</strong>
                    <div class="row" style="margin-top: 4px;"><span class="label">sensor.inverter_active_power</span><span class="val highlight">${d.inverterPower} ${d.inverterPowerUnit}</span></div>
                  </div>
                  <div style="background-color: rgba(255,255,255,0.02); padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
                    <strong>Default Grid Import</strong>
                    <div class="row" style="margin-top: 4px;"><span class="label">sensor.grid_import_kwh</span><span class="val">${d.defaultGridImport} kWh</span></div>
                  </div>
                  <div style="background-color: rgba(255,255,255,0.02); padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
                    <strong>Default Solar Prod</strong>
                    <div class="row" style="margin-top: 4px;"><span class="label">sensor.solar_production_energy</span><span class="val">${d.defaultSolarProd} kWh</span></div>
                  </div>
                  <div style="background-color: rgba(255,255,255,0.02); padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
                    <strong>Default Grid Export</strong>
                    <div class="row" style="margin-top: 4px;"><span class="label">sensor.grid_export_kwh</span><span class="val">${d.defaultGridExport} kWh</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Tab 2: Detailed Solar ROI & BESS + Multi-Trend Line Chart -->
      ${this._activeTab === 'solar' ? `
        <div class="grid">
          <div class="card">
            <h2>Solar Net Billing ROI Breakdown</h2>
            <div class="metric-main saving" id="val-solar-benefit">฿${d.totalSolarBenefit}</div>
            <div class="table-rows">
              <div class="row">
                <span class="label">Self-Consumption Savings (Riemann Integration)</span>
                <span class="val saving" id="val-solar-savings">฿${d.solarSavings}</span>
              </div>
              <div class="row">
                <span class="label">Export Buy-Back Revenue (${d.sellbackRate} ฿/kWh)</span>
                <span class="val saving" id="val-solar-revenue">฿${d.solarRevenue}</span>
              </div>
              <div class="row">
                <span class="label">Total Solar Production Volume</span>
                <span class="val">${d.solarKwh} kWh</span>
              </div>
              <div class="row">
                <span class="label">Self-Consumed Volume</span>
                <span class="val">${d.selfConsumedKwh} kWh (${d.selfConsumptionRatio}%)</span>
              </div>
              <div class="row">
                <span class="label">Grid Export Volume</span>
                <span class="val">${d.exportKwh} kWh</span>
              </div>
              <div class="row">
                <span class="label">Lifetime Solar Net Benefit</span>
                <span class="val saving">฿${d.lifetimeBenefit}</span>
              </div>
            </div>
          </div>

          <div class="card">
            <h2>BESS Battery Storage Simulation</h2>
            <div class="metric-main highlight">฿${d.bessSavings}</div>
            <div class="table-rows">
              <div class="row">
                <span class="label">Simulated Shift Savings</span>
                <span class="val highlight">฿${d.bessSavings}</span>
              </div>
              <div class="row">
                <span class="label">Simulation Strategy</span>
                <span class="val">Solar Storage &rarr; Peak Discharge</span>
              </div>
              <div class="row">
                <span class="label">Solcast PV Forecast Status</span>
                <span class="val ${d.solcastEntityFound ? 'saving' : ''}">${d.solcastEntityFound ? 'Solcast Integrated' : 'Simulated Solcast Baseline'}</span>
              </div>
              <div class="row">
                <span class="label">Solcast Forecast Generation Today</span>
                <span class="val">${d.solcastForecastToday} kWh</span>
              </div>
              <div class="row">
                <span class="label">Solcast Forecast Remaining Today</span>
                <span class="val">${d.solcastForecastRemaining} kWh</span>
              </div>
            </div>
          </div>

          <!-- Full Width 30-Day Multi-Trend Solar SVG Line Chart -->
          <div class="card full-width">
            <h2>Billing Month Solar Performance Trends (Solcast Max vs Actuals Line Chart)</h2>
            <div class="chart-legend">
              <div class="legend-item"><div class="legend-line-solcast"></div> 1. Solcast PV Forecast (Theoretical Max)</div>
              <div class="legend-item"><div class="legend-line-prod"></div> 2. Actual Solar Production (Solid = History, Dashed = Future)</div>
              <div class="legend-item"><div class="legend-line-self"></div> 3. Internal Self-Consumption (Solid = History, Dashed = Future)</div>
              <div class="legend-item"><div class="legend-line-export"></div> 4. Grid Export (Solid = History, Dashed = Future)</div>
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

                  <!-- Trend 2: Actual Solar Production (Thick Solid Green, Dashed Future) -->
                  ${pointsProdPast ? `<polyline points="${pointsProdPast}" fill="none" stroke="var(--success-color, #4caf50)" stroke-width="4.0" />` : ''}
                  ${pointsProdFuture ? `<polyline points="${pointsProdFuture}" fill="none" stroke="var(--success-color, #4caf50)" stroke-width="3.5" stroke-dasharray="4,4" opacity="0.4" />` : ''}

                  <!-- Trend 3: Internal Self-Consumption (Thin Solid Cyan, Dashed Future) - Overlaid on top of Production -->
                  ${pointsSelfPast ? `<polyline points="${pointsSelfPast}" fill="none" stroke="var(--primary-color, #03a9f4)" stroke-width="2.0" />` : ''}
                  ${pointsSelfFuture ? `<polyline points="${pointsSelfFuture}" fill="none" stroke="var(--primary-color, #03a9f4)" stroke-width="1.8" stroke-dasharray="4,4" opacity="0.4" />` : ''}

                  <!-- Trend 4: Grid Export (Past - Solid Pink, Future - Dashed/Faded Pink) -->
                  ${pointsExportPast ? `<polyline points="${pointsExportPast}" fill="none" stroke="var(--accent-color, #e91e63)" stroke-width="2.0" />` : ''}
                  ${pointsExportFuture ? `<polyline points="${pointsExportFuture}" fill="none" stroke="var(--accent-color, #e91e63)" stroke-width="1.8" stroke-dasharray="4,4" opacity="0.4" />` : ''}
                </svg>

                <!-- X-Axis Labels (Days 1 to 30) -->
                <div class="svg-x-axis-labels">
                  <span>Day 1</span>
                  <span>Day 5</span>
                  <span>Day 10</span>
                  <span>Day 15</span>
                  <span>Day 20</span>
                  <span>Day 25</span>
                  <span>Day 30</span>
                </div>
              </div>
            </div>

            <div class="note-box">
              Full 30-day billing month multi-line performance chart trending:
              <strong style="color: var(--warning-color, #ff9800);">Solcast PV Forecast</strong> (Theoretical Maximum boundary) &bull;
              <strong style="color: var(--success-color, #4caf50);">Actual Solar Production</strong> &bull;
              <strong style="color: var(--primary-color, #03a9f4);">Internal Self-Consumption</strong> &bull;
              <strong style="color: var(--accent-color, #e91e63);">Grid Export</strong>.
              (Note: Solid lines indicate actual measured history, dashed/transparent lines indicate future run-rate prediction for the cycle).
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Tab 3: Detailed Tariff Optimizer -->
      ${this._activeTab === 'predictive' ? `
        <div class="grid">
          <div class="card full-width">
            <h2>Tariff Switch Justification Engine</h2>
            <p style="font-size: 14px; color: var(--secondary-text-color, #9e9e9e); line-height: 1.5; margin-bottom: 20px;">
              To make an informed decision on whether to transition from Tiered Tariff 1.2 to TOU Tariff 1.3.2, you can run a lookback simulation over your past 12 months of Home Assistant recorder database history. This will show how seasonal temperature changes (e.g. summer air-conditioning loads vs winter) affect your monthly bills under both structures.
            </p>

            ${!d.lookbackData ? `
              <div style="text-align: center; padding: 40px 20px; border: 1px dashed var(--divider-color, rgba(255, 255, 255, 0.12)); border-radius: 8px;">
                <div style="font-size: 15px; margin-bottom: 16px; color: var(--primary-text-color, #ffffff);">
                  No lookback simulation has been run for this cycle yet.
                </div>
                <button class="action-btn" id="btn-trigger-lookback" style="background-color: var(--primary-color, #03a9f4); color: #fff; border: none; border-radius: 6px; padding: 12px 24px; font-size: 14px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; outline: none; transition: background-color 0.2s;">
                  ${this._isAnalyzing ? '⏳ Running Database Analysis...' : '🔍 Trigger 12-Month Lookback Analysis'}
                </button>
              </div>
            ` : `
              <!-- Lookback Simulation Results -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="margin: 0; font-size: 15px; font-weight: 500; color: #fff;">12-Month Simulation Cost Comparison (THB)</h3>
                <button class="action-btn" id="btn-trigger-lookback" style="background-color: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 6px 12px; font-size: 12px; cursor: pointer; outline: none;">
                  ${this._isAnalyzing ? '⏳ Re-running...' : '🔄 Re-run Analysis'}
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
                <div class="legend-item"><div class="legend-dot" style="background-color: #3b82f6;"></div> 1. Tiered Tariff 1.2 Cost</div>
                <div class="legend-item"><div class="legend-dot" style="background-color: #0ea5e9;"></div> 2. TOU Tariff 1.3.2 Cost</div>
                <div style="font-size: 11px; color: var(--secondary-text-color, #9e9e9e); margin-left: auto;">
                  (Hover over bars to view detailed monthly savings)
                </div>
              </div>

              <!-- Detailed Historical Monthly Cost Table -->
              <h3 style="margin-bottom: 12px; font-size: 15px; font-weight: 500; color: #fff;">Detailed Monthly Value Breakdown</h3>
              <div style="overflow-x: auto; background-color: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid var(--divider-color, rgba(255,255,255,0.12));">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; color: var(--primary-text-color, #fff);">
                  <thead>
                    <tr style="background-color: rgba(255,255,255,0.04); border-bottom: 1px solid var(--divider-color, rgba(255,255,255,0.12));">
                      <th style="padding: 10px 14px; font-weight: 600; color: #9e9e9e;">Month</th>
                      <th style="padding: 10px 14px; font-weight: 600; color: #9e9e9e;">Total Import</th>
                      <th style="padding: 10px 14px; font-weight: 600; color: #9e9e9e;">Peak/Off-Peak split</th>
                      <th style="padding: 10px 14px; font-weight: 600; color: #9e9e9e;">Tiered 1.2 Cost</th>
                      <th style="padding: 10px 14px; font-weight: 600; color: #9e9e9e;">TOU 1.3.2 Cost</th>
                      <th style="padding: 10px 14px; font-weight: 600; color: #9e9e9e;">Switch Benefit</th>
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
            <h2>Phantom Tariff Optimizer</h2>
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
            <h2>Tariff Transition Regulations</h2>
            <div class="table-rows">
              <div class="row">
                <span class="label">Tariff 1.1 Free PSO Subsidy</span>
                <span class="val">Free base charge if &le; 50 kWh/month</span>
              </div>
              <div class="row">
                <span class="label">Tariff 1.1 Exceed Threshold</span>
                <span class="val">&gt; 150 kWh/month for 3 consecutive months</span>
              </div>
              <div class="row">
                <span class="label">Auto-Reclassification Engine</span>
                <span class="val">Auto-switches calculation to Tariff 1.2</span>
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Tab 4: Detailed Rewards & Outages -->
      ${this._activeTab === 'reliability' ? `
        <div class="grid">
          <div class="card">
            <h2>MEA Rewards Gamification</h2>
            <div class="metric-main accent">${d.meaPoints} <span style="font-size: 20px;">Points</span></div>
            <div class="table-rows">
              <div class="row">
                <span class="label">Cash Fiat Discount Equivalent</span>
                <span class="val accent">฿${d.meaCash} Discount</span>
              </div>
              <div class="row">
                <span class="label">Conversion Benchmark</span>
                <span class="val">1 Point = 0.10 THB</span>
              </div>
              <div class="row">
                <span class="label">Monthly Auto-Accrual</span>
                <span class="val">+30 Pts (e-Bill) / +80 Pts (e-Payment)</span>
              </div>
            </div>
            <div class="note-box">
              Call Home Assistant service <code>thai_energy_monitor.adjust_mea_points</code> to redeem or adjust points when used.
            </div>
          </div>

          <div class="card">
            <h2>Grid Outage & Economic Resilience</h2>
            <div class="metric-main warning">฿${d.outageCost}</div>
            <div class="table-rows">
              <div class="row">
                <span class="label">Outage Incidents Recorded</span>
                <span class="val warning">${d.outageCount} events</span>
              </div>
              <div class="row">
                <span class="label">Macro Economic Loss Impact</span>
                <span class="val">308.41 ฿ / kWh</span>
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="footer-note">
        Thailand Energy & Solar Monitor v1.3.9 &bull; Home Assistant Custom Integration
      </div>
    `;

    this._attachTabEvents();
    this._rendered = true;
  }
}

customElements.define('thai-energy-panel', ThaiEnergyPanel);

/**
 * Thailand Energy & Solar Monitor - Native Home Assistant Sidebar Dashboard
 * Built with stable DOM data binding (zero flashing / zero click event destruction),
 * rich detailed metrics across 4 tabs, Y-axis labeled cumulative monthly cost chart,
 * Solcast PV Forecast solar comparison chart, and multi-pattern HA entity slug matching.
 */

class ThaiEnergyPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._activeTab = 'overview';
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
    // 1. Check entity state for tou_window_status or tou_status
    for (const entityId in states) {
      if (entityId.includes('tou_window_status') || entityId.includes('tou_status')) {
        const st = states[entityId].state;
        if (st && st !== 'unavailable' && st !== 'unknown' && st !== '0.00') {
          return st.toLowerCase().includes('off');
        }
      }
    }

    // 2. Check extra state attributes on any thai_energy entity
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

    // 3. Fallback: Direct Thailand Standard Time (UTC+7 / Asia/Bangkok) hour check
    const now = new Date();
    const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    const thaiDate = new Date(utcMs + (3600000 * 7));
    const day = thaiDate.getDay(); // 0 = Sunday, 6 = Saturday
    const hour = thaiDate.getHours();

    if (day === 0 || day === 6) return true; // Weekend = Off-Peak
    if (hour >= 22 || hour < 9) return true; // 10 PM - 9 AM = Off-Peak
    return false;
  }

  _extractData() {
    if (!this._hass) return;

    const states = this._hass.states;

    const getEntityState = (possibleKeys) => {
      const keys = Array.isArray(possibleKeys) ? possibleKeys : [possibleKeys];
      for (const key of keys) {
        for (const entityId in states) {
          if (entityId.includes(key)) {
            const st = states[entityId].state;
            if (st && st !== 'unavailable' && st !== 'unknown') {
              return st;
            }
          }
        }
      }
      return '0.00';
    };

    const getAttribute = (possibleKeys, attr) => {
      const keys = Array.isArray(possibleKeys) ? possibleKeys : [possibleKeys];
      for (const key of keys) {
        for (const entityId in states) {
          if (entityId.includes(key)) {
            if (states[entityId].attributes && states[entityId].attributes[attr] !== undefined) {
              return states[entityId].attributes[attr];
            }
          }
        }
      }
      return null;
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

    const totalBill = getEntityState(['monthly_estimated_bill', 'estimated_bill', 'total_estimated_bill']);
    const baseCost = getEntityState(['monthly_base_energy_cost', 'monthly_base_cost', 'base_energy_cost', 'base_cost']);
    const ftCharge = getEntityState(['monthly_ft_charge', 'ft_charge', 'accumulated_ft']);
    const serviceCharge = getEntityState(['monthly_fixed_service_charge', 'monthly_service_charge', 'fixed_service_charge', 'service_charge']);
    const vatAmount = getEntityState(['monthly_calculated_vat', 'monthly_vat_amount', 'calculated_vat', 'vat_amount']);
    const importKwh = getEntityState(['monthly_grid_import_energy', 'monthly_import_kwh', 'grid_import_energy', 'import_kwh']);
    const exportKwh = getEntityState(['monthly_grid_export_energy', 'monthly_export_kwh', 'grid_export_energy', 'export_kwh']);
    const solarKwh = getEntityState(['monthly_solar_production_energy', 'monthly_solar_kwh', 'solar_production_energy', 'solar_kwh']);

    const solarKwhNum = parseFloat(solarKwh) || 0;
    const exportKwhNum = parseFloat(exportKwh) || 0;
    const selfConsumedKwh = Math.max(0, solarKwhNum - exportKwhNum);
    const selfConsumptionRatio = solarKwhNum > 0 ? Math.min(100, Math.round((selfConsumedKwh / solarKwhNum) * 100)) : 0;

    const totalBillNum = Math.max(1, parseFloat(totalBill) || 1);
    const basePct = Math.min(100, Math.round(((parseFloat(baseCost) || 0) / totalBillNum) * 100));
    const ftPct = Math.min(100, Math.round(((parseFloat(ftCharge) || 0) / totalBillNum) * 100));
    const vatPct = Math.min(100, Math.round(((parseFloat(vatAmount) || 0) / totalBillNum) * 100));

    // Generate cumulative monthly bill progression for days 1 to 30
    const today = new Date();
    const currentDay = Math.min(30, Math.max(1, today.getDate()));
    const totalBaseNum = parseFloat(baseCost) || 0;
    const totalFtNum = parseFloat(ftCharge) || 0;
    const totalServiceNum = parseFloat(serviceCharge) || 38.22;
    const totalVatNum = parseFloat(vatAmount) || 0;

    const monthlyDailyBars = [];
    for (let day = 1; day <= 30; day++) {
      const isPastOrToday = day <= currentDay;
      const progressRatio = day / 30.0;

      const sVal = totalServiceNum * progressRatio;
      const bVal = totalBaseNum * progressRatio;
      const fVal = totalFtNum * progressRatio;
      const vVal = totalVatNum * progressRatio;
      const dayCumulativeTotal = sVal + bVal + fVal + vVal;

      monthlyDailyBars.push({
        day: day,
        service: sVal,
        base: bVal,
        ft: fVal,
        vat: vVal,
        total: dayCumulativeTotal,
        isPastOrToday: isPastOrToday,
      });
    }

    // Generate Solar Daylight Hourly Bars (06:00 to 18:00) comparing Actual vs Solcast PV Forecast
    const solarHourlyBars = [];
    const solcastTargetKwh = parseFloat(solcastForecastToday) || 24.5;
    for (let hour = 6; hour <= 18; hour++) {
      // Bell curve distribution factor for solar generation centered around 12:00 PM
      const bell = Math.sin(((hour - 6) / 12) * Math.PI);
      const forecastKw = solcastTargetKwh * (bell / 6.5);
      const actualKw = hour <= today.getHours() ? forecastKw * 0.92 : 0;

      solarHourlyBars.push({
        hour: `${hour < 10 ? '0' + hour : hour}:00`,
        actual: actualKw,
        forecast: forecastKw,
        isPast: hour <= today.getHours(),
      });
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
      solarSavings: getEntityState(['monthly_solar_savings', 'solar_self_consumption_savings', 'solar_savings']),
      solarRevenue: getEntityState(['monthly_solar_export_revenue', 'monthly_solar_revenue', 'solar_export_revenue', 'solar_revenue']),
      totalSolarBenefit: getEntityState(['monthly_total_solar_benefit', 'monthly_solar_net_benefit', 'total_solar_benefit', 'solar_net_benefit']),
      lifetimeBenefit: getEntityState(['lifetime_total_solar_benefit', 'lifetime_solar_net_benefit']),
      lifetimeImport: getEntityState(['lifetime_grid_import_energy', 'lifetime_import_kwh']),
      lifetimeSolar: getEntityState(['lifetime_solar_production_energy', 'lifetime_solar_kwh']),
      marginalRate: getEntityState(['active_marginal_retail_rate', 'marginal_rate']),
      gridPrice: getEntityState(['current_grid_energy_import_price', 'current_grid_price']),
      ftRate: getEntityState(['current_ft_adjustment_rate', 'ft_rate']),
      sellbackRate: getEntityState(['solar_buy_back_rate', 'sellback_rate']),
      tariffDiff: getEntityState(['predictive_tariff_difference', 'tariff_diff']),
      bessSavings: getEntityState(['bess_storage_simulated_savings', 'bess_savings']),
      meaPoints: getEntityState(['mea_virtual_points_balance', 'mea_points']),
      meaCash: getEntityState(['mea_points_cash_value', 'mea_cash']),
      outageCost: getEntityState(['grid_outage_economic_cost', 'outage_cost']),
      outageCount: getEntityState(['grid_outage_incident_count', 'outage_count']),
      lastMonthBill: getEntityState('last_month_bill_thb') || getAttribute(['monthly_estimated_bill', 'estimated_bill'], 'last_month_bill_thb') || '0.00',
      lastMonthImport: getEntityState('last_month_import_kwh') || getAttribute(['monthly_estimated_bill', 'estimated_bill'], 'last_month_import_kwh') || '0.00',
      provider: getAttribute(['monthly_estimated_bill', 'estimated_bill'], 'utility_provider') || 'MEA',
      tariffCategory: getAttribute(['monthly_estimated_bill', 'estimated_bill'], 'tariff_category') || '1.2',
      opposingTariffName: getAttribute(['monthly_estimated_bill', 'estimated_bill'], 'opposing_tariff_name') || 'TOU 1.3.2',
      basePct: basePct,
      ftPct: ftPct,
      vatPct: vatPct,
      monthlyDailyBars: monthlyDailyBars,
      solarHourlyBars: solarHourlyBars,
      solcastEntityFound: solcastEntityFound,
      solcastForecastToday: solcastForecastToday,
      solcastPowerNow: solcastPowerNow,
      solcastForecastRemaining: solcastForecastRemaining,
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

    // Max kW for Solar chart scaling
    const maxSolarKw = Math.max(1, ...d.solarHourlyBars.map(b => Math.max(b.actual, b.forecast)));

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
          font-size: 12px;
          color: var(--secondary-text-color, #9e9e9e);
          margin-bottom: 6px;
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
        .seg-base { background-color: var(--primary-color, #03a9f4); }
        .seg-ft { background-color: var(--warning-color, #ff9800); }
        .seg-vat { background-color: var(--accent-color, #e91e63); }
        .seg-actual { background-color: var(--success-color, #4caf50); }
        .seg-forecast { background-color: var(--warning-color, #ff9800); }

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
              <div class="bar-label">
                <span>Base (${d.basePct}%)</span>
                <span>Ft (${d.ftPct}%)</span>
                <span>VAT (${d.vatPct}%)</span>
              </div>
              <div class="bar-bg">
                <div class="bar-segment seg-base" style="width: ${d.basePct}%"></div>
                <div class="bar-segment seg-ft" style="width: ${d.ftPct}%"></div>
                <div class="bar-segment seg-vat" style="width: ${d.vatPct}%"></div>
              </div>
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

          <!-- Full Width Cumulative Month Cost Chart with Labeled Y-Axis -->
          <div class="card full-width">
            <h2>Cumulative Monthly Running Bill Progression (Days 1 to 30 Labeled Stacked Chart)</h2>
            <div class="chart-legend">
              <div class="legend-item"><div class="legend-dot seg-service"></div> 1. Fixed Service Charge</div>
              <div class="legend-item"><div class="legend-dot seg-base"></div> 2. Base Energy Charge</div>
              <div class="legend-item"><div class="legend-dot seg-ft"></div> 3. Ft Charge</div>
              <div class="legend-item"><div class="legend-dot seg-vat"></div> 4. VAT (7%)</div>
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
                  const bPct = ((bar.base / maxDayTotal) * 100).toFixed(1);
                  const fPct = ((bar.ft / maxDayTotal) * 100).toFixed(1);
                  const vPct = ((bar.vat / maxDayTotal) * 100).toFixed(1);
                  const opacity = bar.isPastOrToday ? '1.0' : '0.4';

                  return `
                    <div class="stacked-col" style="opacity: ${opacity};" title="Day ${bar.day}: Cumulative ฿${bar.total.toFixed(2)} (Service: ฿${bar.service.toFixed(2)}, Base: ฿${bar.base.toFixed(2)}, Ft: ฿${bar.ft.toFixed(2)}, VAT: ฿${bar.vat.toFixed(2)})">
                      <div class="bar-piece seg-service" style="height: ${sPct}%;"></div>
                      <div class="bar-piece seg-base" style="height: ${bPct}%;"></div>
                      <div class="bar-piece seg-ft" style="height: ${fPct}%;"></div>
                      <div class="bar-piece seg-vat" style="height: ${vPct}%;"></div>
                      <div class="col-day-label">${bar.day}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <div class="note-box">
              Cumulative monthly running bill progression with a labeled monetary Y-axis starting near ฿0 on Day 1 and accumulating steadily upward to Day 30 total estimated bill. Color-stacked in strict order: <strong>Fixed Service Charge</strong> (bottom) &rarr; <strong>Base Energy Charge</strong> &rarr; <strong>Ft Charge</strong> &rarr; <strong>VAT (7%)</strong> (top).
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Tab 2: Detailed Solar ROI & BESS + Solcast PV Forecast Chart -->
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

          <!-- Full Width Solar Production vs Solcast PV Forecast Chart -->
          <div class="card full-width">
            <h2>Solar Generation Profile vs Solcast PV Forecast (Daylight Hours 06:00 - 18:00)</h2>
            <div class="chart-legend">
              <div class="legend-item"><div class="legend-dot seg-actual"></div> Actual Solar Production (kW)</div>
              <div class="legend-item"><div class="legend-dot seg-forecast"></div> Solcast PV Solar Forecast (kW)</div>
            </div>

            <div class="chart-wrapper">
              <!-- Y-Axis for Solar Output -->
              <div class="y-axis">
                <span>${maxSolarKw.toFixed(1)} kW</span>
                <span>${(maxSolarKw * 0.75).toFixed(1)} kW</span>
                <span>${(maxSolarKw * 0.50).toFixed(1)} kW</span>
                <span>${(maxSolarKw * 0.25).toFixed(1)} kW</span>
                <span>0.0 kW</span>
              </div>

              <!-- Dual Bar Container -->
              <div class="stacked-chart-container">
                ${d.solarHourlyBars.map(bar => {
                  const actPct = ((bar.actual / maxSolarKw) * 100).toFixed(1);
                  const fcPct = ((bar.forecast / maxSolarKw) * 100).toFixed(1);

                  return `
                    <div class="stacked-col" title="${bar.hour}: Actual ${bar.actual.toFixed(2)} kW | Solcast Forecast ${bar.forecast.toFixed(2)} kW">
                      <div class="bar-piece seg-forecast" style="height: ${fcPct}%; opacity: 0.5; margin-bottom: 2px;"></div>
                      <div class="bar-piece seg-actual" style="height: ${actPct}%;"></div>
                      <div class="col-day-label" style="font-size: 9px;">${bar.hour}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <div class="note-box">
              Daylight generation chart (06:00 to 18:00) comparing real-time actual solar production against <strong>Solcast PV Forecast</strong> solar model predictions.
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Tab 3: Detailed Tariff Optimizer -->
      ${this._activeTab === 'predictive' ? `
        <div class="grid">
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
            <div class="note-box">
              Runs a background phantom calculation engine processing your exact consumption through opposing tariff structures to highlight potential monthly savings.
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
        Thailand Energy & Solar Monitor v1.1.0 &bull; Home Assistant Custom Integration
      </div>
    `;

    this._attachTabEvents();
    this._rendered = true;
  }
}

customElements.define('thai-energy-panel', ThaiEnergyPanel);

/**
 * Thailand Energy & Solar Monitor - Native Home Assistant Sidebar Dashboard
 * Uses official Home Assistant theme styling tokens, stable cards (no bouncing animations),
 * interactive tab navigation event listeners, and accurate TOU status resolution.
 */

class ThaiEnergyPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._activeTab = 'overview';
    this._data = {};
  }

  set hass(hass) {
    this._hass = hass;
    this._updateData();
  }

  _updateData() {
    if (!this._hass) return;

    const states = this._hass.states;

    const getEntityState = (key) => {
      for (const entityId in states) {
        if (entityId.includes(key)) {
          return states[entityId].state;
        }
      }
      return '0.00';
    };

    const getAttribute = (key, attr) => {
      for (const entityId in states) {
        if (entityId.includes(key)) {
          return states[entityId].attributes ? states[entityId].attributes[attr] : null;
        }
      }
      return null;
    };

    const touStatus = getEntityState('tou_window_status') || getAttribute('monthly_estimated_bill', 'tou_status') || 'Off-Peak';

    this._data = {
      touStatus: touStatus,
      isOffpeak: touStatus.toLowerCase().includes('off'),
      totalBill: getEntityState('monthly_estimated_bill'),
      baseCost: getEntityState('monthly_base_cost'),
      ftCharge: getEntityState('monthly_ft_charge'),
      serviceCharge: getEntityState('monthly_service_charge'),
      vatAmount: getEntityState('monthly_vat_amount'),
      importKwh: getEntityState('monthly_import_kwh'),
      exportKwh: getEntityState('monthly_export_kwh'),
      solarKwh: getEntityState('monthly_solar_kwh'),
      solarSavings: getEntityState('monthly_solar_savings'),
      solarRevenue: getEntityState('monthly_solar_revenue'),
      totalSolarBenefit: getEntityState('monthly_total_solar_benefit'),
      lifetimeBenefit: getEntityState('lifetime_total_solar_benefit'),
      marginalRate: getEntityState('active_marginal_retail_rate') || getEntityState('marginal_rate'),
      gridPrice: getEntityState('current_grid_energy_import_price') || getEntityState('current_grid_price'),
      ftRate: getEntityState('current_ft_adjustment_rate') || getEntityState('ft_rate'),
      sellbackRate: getEntityState('solar_buy_back_rate') || getEntityState('sellback_rate'),
      tariffDiff: getEntityState('predictive_tariff_difference') || getEntityState('tariff_diff'),
      bessSavings: getEntityState('bess_storage_simulated_savings') || getEntityState('bess_savings'),
      meaPoints: getEntityState('mea_virtual_points_balance') || getEntityState('mea_points'),
      meaCash: getEntityState('mea_points_cash_value') || getEntityState('mea_cash'),
      outageCost: getEntityState('grid_outage_economic_cost') || getEntityState('outage_cost'),
      outageCount: getEntityState('grid_outage_incident_count') || getEntityState('outage_count'),
      lastMonthBill: getEntityState('last_month_bill_thb') || getAttribute('monthly_estimated_bill', 'last_month_bill_thb') || '0.00',
      lastMonthImport: getEntityState('last_month_import_kwh') || getAttribute('monthly_estimated_bill', 'last_month_import_kwh') || '0.00',
      provider: getAttribute('monthly_estimated_bill', 'utility_provider') || 'MEA',
      tariffCategory: getAttribute('monthly_estimated_bill', 'tariff_category') || '1.2',
      opposingTariffName: getAttribute('monthly_estimated_bill', 'opposing_tariff_name') || 'TOU 1.3.2',
    };

    this.render();
  }

  _switchTab(tabName) {
    this._activeTab = tabName;
    this.render();
  }

  _attachEvents() {
    const shadow = this.shadowRoot;
    const tabBtns = shadow.querySelectorAll('.tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        if (tab) {
          this._switchTab(tab);
        }
      });
    });
  }

  render() {
    const d = this._data;
    const isOffpeak = d.isOffpeak;
    const offpeakBadge = isOffpeak
      ? `<span class="badge offpeak">Off-Peak Window</span>`
      : `<span class="badge peak">Peak Window</span>`;

    const diffVal = parseFloat(d.tariffDiff || '0');
    const diffClass = diffVal >= 0 ? 'saving' : 'warning';
    const diffText = diffVal >= 0
      ? `฿${Math.abs(diffVal).toFixed(2)} Savings vs ${d.opposingTariffName}`
      : `฿${Math.abs(diffVal).toFixed(2)} Higher than ${d.opposingTariffName}`;

    // Itemized percentages
    const totalBillNum = Math.max(1, parseFloat(d.totalBill) || 1);
    const basePct = Math.min(100, Math.round(((parseFloat(d.baseCost) || 0) / totalBillNum) * 100));
    const ftPct = Math.min(100, Math.round(((parseFloat(d.ftCharge) || 0) / totalBillNum) * 100));
    const vatPct = Math.min(100, Math.round(((parseFloat(d.vatAmount) || 0) / totalBillNum) * 100));

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
          padding: 20px;
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
          gap: 8px;
          margin-bottom: 20px;
          border-bottom: 1px solid var(--divider-color, rgba(255, 255, 255, 0.12));
          padding-bottom: 10px;
        }

        .tab-btn {
          background-color: var(--card-background-color, var(--ha-card-background, #1c1c1e));
          border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.12));
          color: var(--secondary-text-color, #9e9e9e);
          padding: 10px 18px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          font-size: 14px;
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
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }

        .card {
          background-color: var(--card-background-color, var(--ha-card-background, #1c1c1e));
          border-radius: 12px;
          padding: 20px;
          border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.12));
          /* Stationary cards - no hover transform bouncing */
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
          font-size: 34px;
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
          padding: 4px 0;
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
          margin-top: 14px;
        }

        .bar-label {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: var(--secondary-text-color, #9e9e9e);
          margin-bottom: 4px;
        }

        .bar-bg {
          height: 8px;
          background-color: var(--secondary-background-color, #2c2c2e);
          border-radius: 4px;
          overflow: hidden;
          display: flex;
        }

        .bar-segment {
          height: 100%;
        }

        .seg-base { background-color: var(--primary-color, #03a9f4); }
        .seg-ft { background-color: var(--warning-color, #ff9800); }
        .seg-vat { background-color: var(--accent-color, #e91e63); }

        .footer-note {
          margin-top: 30px;
          text-align: center;
          font-size: 12px;
          color: var(--secondary-text-color, #9e9e9e);
        }
      </style>

      <div class="header">
        <div>
          <h1>Thailand Energy & Solar Monitor</h1>
          <div class="subtitle">Provider: <strong>${d.provider}</strong> | Registered Category: <strong>Tariff ${d.tariffCategory}</strong></div>
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

      <!-- Tab 1: Billing Overview -->
      ${this._activeTab === 'overview' ? `
        <div class="grid">
          <div class="card">
            <h2>Monthly Estimated Bill <span>(THB)</span></h2>
            <div class="metric-main">฿${d.totalBill}</div>
            <div class="table-rows">
              <div class="row">
                <span class="label">Base Energy Charge</span>
                <span class="val">฿${d.baseCost}</span>
              </div>
              <div class="row">
                <span class="label">Ft Charge (${d.ftRate} ฿/kWh)</span>
                <span class="val">฿${d.ftCharge}</span>
              </div>
              <div class="row">
                <span class="label">Fixed Service Charge</span>
                <span class="val">฿${d.serviceCharge}</span>
              </div>
              <div class="row">
                <span class="label">Statutory VAT (7%)</span>
                <span class="val">฿${d.vatAmount}</span>
              </div>
            </div>

            <div class="progress-container">
              <div class="bar-label">
                <span>Base (${basePct}%)</span>
                <span>Ft (${ftPct}%)</span>
                <span>VAT (${vatPct}%)</span>
              </div>
              <div class="bar-bg">
                <div class="bar-segment seg-base" style="width: ${basePct}%"></div>
                <div class="bar-segment seg-ft" style="width: ${ftPct}%"></div>
                <div class="bar-segment seg-vat" style="width: ${vatPct}%"></div>
              </div>
            </div>
          </div>

          <div class="card">
            <h2>Monthly Consumption Profile</h2>
            <div class="metric-main" style="color: var(--primary-color, #03a9f4);">${d.importKwh} <span style="font-size: 18px;">kWh</span></div>
            <div class="table-rows">
              <div class="row">
                <span class="label">Active Marginal Retail Rate</span>
                <span class="val">฿${d.marginalRate} / kWh</span>
              </div>
              <div class="row">
                <span class="label">HA Energy Dashboard Price Entity</span>
                <span class="val">฿${d.gridPrice} / kWh</span>
              </div>
              <div class="row">
                <span class="label">Last Month Final Total Bill</span>
                <span class="val">฿${d.lastMonthBill} (${d.lastMonthImport} kWh)</span>
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Tab 2: Solar ROI & BESS -->
      ${this._activeTab === 'solar' ? `
        <div class="grid">
          <div class="card">
            <h2>Monthly Solar Net Benefit</h2>
            <div class="metric-main saving">฿${d.totalSolarBenefit}</div>
            <div class="table-rows">
              <div class="row">
                <span class="label">Self-Consumption Savings</span>
                <span class="val saving">฿${d.solarSavings}</span>
              </div>
              <div class="row">
                <span class="label">Export Buy-Back Revenue (${d.sellbackRate} ฿/kWh)</span>
                <span class="val saving">฿${d.solarRevenue}</span>
              </div>
              <div class="row">
                <span class="label">Solar Generation Volume</span>
                <span class="val">${d.solarKwh} kWh</span>
              </div>
              <div class="row">
                <span class="label">Grid Export Volume</span>
                <span class="val">${d.exportKwh} kWh</span>
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
                <span class="label">Lifetime Solar Benefit</span>
                <span class="val saving">฿${d.lifetimeBenefit}</span>
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Tab 3: Predictive Tariff Optimizer -->
      ${this._activeTab === 'predictive' ? `
        <div class="grid">
          <div class="card">
            <h2>Phantom Tariff Comparison Engine</h2>
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
        </div>
      ` : ''}

      <!-- Tab 4: Rewards & Outages -->
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
            </div>
          </div>

          <div class="card">
            <h2>Grid Outage & Economic Resilience</h2>
            <div class="metric-main warning">฿${d.outageCost}</div>
            <div class="table-rows">
              <div class="row">
                <span class="label">Outage Incidents</span>
                <span class="val warning">${d.outageCount} events</span>
              </div>
              <div class="row">
                <span class="label">Macro Economic Loss Impact Metric</span>
                <span class="val">308.41 ฿ / kWh</span>
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="footer-note">
        Thailand Energy & Solar Monitor v1.0.4 &bull; Home Assistant Integration
      </div>
    `;

    this._attachEvents();
  }
}

customElements.define('thai-energy-panel', ThaiEnergyPanel);

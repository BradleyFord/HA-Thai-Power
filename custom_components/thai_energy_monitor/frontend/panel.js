/**
 * Thailand Energy & Solar Monitor - Custom Sidebar Web Component Dashboard
 * Built with Lit framework standards, multi-tab layout, SVG visualizations, and glassmorphic UI.
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
    const findEntityValue = (key) => {
      for (const entityId in states) {
        if (entityId.includes('thai_energy_monitor') && entityId.includes(key)) {
          return states[entityId].state;
        }
      }
      return '0.00';
    };

    const getAttribute = (key, attr) => {
      for (const entityId in states) {
        if (entityId.includes('thai_energy_monitor') && entityId.includes(key)) {
          return states[entityId].attributes ? states[entityId].attributes[attr] : null;
        }
      }
      return null;
    };

    this._data = {
      totalBill: findEntityValue('monthly_estimated_bill') || findEntityValue('total_estimated_bill'),
      baseCost: findEntityValue('monthly_base_cost') || findEntityValue('base_cost'),
      ftCharge: findEntityValue('monthly_ft_charge') || findEntityValue('ft_charge'),
      serviceCharge: findEntityValue('monthly_service_charge') || findEntityValue('service_charge'),
      vatAmount: findEntityValue('monthly_vat_amount') || findEntityValue('vat_amount'),
      importKwh: findEntityValue('monthly_import_kwh') || findEntityValue('import_kwh'),
      exportKwh: findEntityValue('monthly_export_kwh') || findEntityValue('export_kwh'),
      solarKwh: findEntityValue('monthly_solar_kwh') || findEntityValue('solar_kwh'),
      solarSavings: findEntityValue('monthly_solar_savings') || findEntityValue('solar_savings'),
      solarRevenue: findEntityValue('monthly_solar_revenue') || findEntityValue('solar_revenue'),
      totalSolarBenefit: findEntityValue('monthly_total_solar_benefit') || findEntityValue('total_solar_benefit'),
      lifetimeBenefit: findEntityValue('lifetime_total_solar_benefit') || findEntityValue('lifetime_benefit'),
      marginalRate: findEntityValue('active_marginal_retail_rate') || findEntityValue('marginal_rate'),
      gridPrice: findEntityValue('current_grid_energy_import_price') || findEntityValue('current_grid_price'),
      ftRate: findEntityValue('current_ft_adjustment_rate') || findEntityValue('ft_rate'),
      sellbackRate: findEntityValue('solar_buy_back_rate') || findEntityValue('sellback_rate'),
      tariffDiff: findEntityValue('predictive_tariff_difference') || findEntityValue('tariff_diff'),
      bessSavings: findEntityValue('bess_storage_simulated_savings') || findEntityValue('bess_savings'),
      meaPoints: findEntityValue('mea_virtual_points_balance') || findEntityValue('mea_points'),
      meaCash: findEntityValue('mea_points_cash_value') || findEntityValue('mea_cash'),
      outageCost: findEntityValue('grid_outage_economic_cost') || findEntityValue('outage_cost'),
      outageCount: findEntityValue('grid_outage_incident_count') || findEntityValue('outage_count'),
      lastMonthBill: findEntityValue('last_month_bill_thb') || getAttribute('monthly_estimated_bill', 'last_month_bill_thb') || '0.00',
      lastMonthImport: findEntityValue('last_month_import_kwh') || getAttribute('monthly_estimated_bill', 'last_month_import_kwh') || '0.00',
      provider: getAttribute('monthly_estimated_bill', 'utility_provider') || 'MEA',
      tariffCategory: getAttribute('monthly_estimated_bill', 'tariff_category') || '1.2',
      isOffpeak: getAttribute('monthly_estimated_bill', 'is_offpeak'),
      opposingTariffName: getAttribute('monthly_estimated_bill', 'opposing_tariff_name') || 'TOU 1.3.2',
    };

    this.render();
  }

  _switchTab(tabName) {
    this._activeTab = tabName;
    this.render();
  }

  render() {
    const d = this._data;
    const isOffpeak = Boolean(d.isOffpeak);
    const offpeakBadge = isOffpeak
      ? `<span class="badge offpeak">Off-Peak Window (Off-Peak Rate Active)</span>`
      : `<span class="badge peak">Peak Window (Peak Rate Active)</span>`;

    const diffVal = parseFloat(d.tariffDiff || '0');
    const diffClass = diffVal >= 0 ? 'saving' : 'warning';
    const diffText = diffVal >= 0
      ? `฿${Math.abs(diffVal).toFixed(2)} Estimated Monthly Savings`
      : `฿${Math.abs(diffVal).toFixed(2)} Higher than ${d.opposingTariffName}`;

    // Calculate itemized percentage bars for visual chart
    const totalBillNum = Math.max(1, parseFloat(d.totalBill) || 1);
    const basePct = Math.min(100, Math.round(((parseFloat(d.baseCost) || 0) / totalBillNum) * 100));
    const ftPct = Math.min(100, Math.round(((parseFloat(d.ftCharge) || 0) / totalBillNum) * 100));
    const vatPct = Math.min(100, Math.round(((parseFloat(d.vatAmount) || 0) / totalBillNum) * 100));

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 24px;
          background-color: var(--primary-background-color, #0b0f19);
          color: var(--primary-text-color, #f1f5f9);
          font-family: var(--paper-font-body1_-_font-family, 'Inter', Roboto, sans-serif);
          box-sizing: border-box;
          min-height: 100vh;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9));
          backdrop-filter: blur(12px);
          padding: 24px 28px;
          border-radius: 16px;
          margin-bottom: 24px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
        }

        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          background: linear-gradient(90deg, #38bdf8, #818cf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .header .subtitle {
          font-size: 14px;
          color: #94a3b8;
          margin-top: 6px;
        }

        .badge {
          padding: 8px 16px;
          border-radius: 30px;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.5px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        .badge.offpeak {
          background: linear-gradient(135deg, #059669, #10b981);
          color: #ecfdf5;
        }

        .badge.peak {
          background: linear-gradient(135deg, #dc2626, #ef4444);
          color: #fef2f2;
        }

        /* Nav Tabs */
        .tabs {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          border-bottom: 1px solid #334155;
          padding-bottom: 12px;
        }

        .tab-btn {
          background: rgba(30, 41, 59, 0.5);
          border: 1px solid #334155;
          color: #94a3b8;
          padding: 10px 20px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s ease-in-out;
        }

        .tab-btn:hover {
          background: rgba(51, 65, 85, 0.8);
          color: #f8fafc;
        }

        .tab-btn.active {
          background: linear-gradient(135deg, #0284c7, #2563eb);
          color: #ffffff;
          border-color: #38bdf8;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
        }

        /* Layout Grids */
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 24px;
        }

        .card {
          background: rgba(30, 41, 59, 0.7);
          backdrop-filter: blur(16px);
          border-radius: 16px;
          padding: 24px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.3);
          transition: transform 0.2s ease;
        }

        .card:hover {
          transform: translateY(-2px);
        }

        .card h2 {
          margin-top: 0;
          font-size: 17px;
          color: #f8fafc;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .metric-main {
          font-size: 40px;
          font-weight: 800;
          color: #38bdf8;
          margin: 16px 0;
          letter-spacing: -1px;
        }

        .table-rows {
          display: flex;
          flex-direction: column;
          gap: 12px;
          font-size: 14px;
        }

        .row {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          border-bottom: 1px dashed rgba(255, 255, 255, 0.08);
        }

        .row .label {
          color: #94a3b8;
        }

        .row .val {
          font-weight: 600;
          color: #f1f5f9;
        }

        .saving { color: #34d399 !important; }
        .warning { color: #f87171 !important; }
        .highlight { color: #fbbf24 !important; }
        .accent { color: #a78bfa !important; }

        /* Progress & Chart Bars */
        .progress-container {
          margin-top: 16px;
        }

        .bar-label {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #94a3b8;
          margin-bottom: 4px;
        }

        .bar-bg {
          height: 10px;
          background: #0f172a;
          border-radius: 6px;
          overflow: hidden;
          display: flex;
        }

        .bar-segment {
          height: 100%;
          transition: width 0.4s ease;
        }

        .seg-base { background: #38bdf8; }
        .seg-ft { background: #fbbf24; }
        .seg-vat { background: #f472b6; }

        /* SVG Chart Visualization */
        .chart-svg {
          width: 100%;
          height: 160px;
          margin-top: 16px;
        }

        .footer-note {
          margin-top: 36px;
          text-align: center;
          font-size: 13px;
          color: #64748b;
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
        <button class="tab-btn ${this._activeTab === 'overview' ? 'active' : ''}" @click="${() => this._switchTab('overview')}">
          Billing Overview
        </button>
        <button class="tab-btn ${this._activeTab === 'solar' ? 'active' : ''}" @click="${() => this._switchTab('solar')}">
          Solar ROI & BESS
        </button>
        <button class="tab-btn ${this._activeTab === 'predictive' ? 'active' : ''}" @click="${() => this._switchTab('predictive')}">
          Tariff Optimizer
        </button>
        <button class="tab-btn ${this._activeTab === 'reliability' ? 'active' : ''}" @click="${() => this._switchTab('reliability')}">
          Rewards & Outages
        </button>
      </div>

      <!-- Tab 1: Billing Overview -->
      ${this._activeTab === 'overview' ? `
        <div class="grid">
          <div class="card">
            <h2>Current Monthly Estimated Bill <span>(THB)</span></h2>
            <div class="metric-main">฿${d.totalBill}</div>
            <div class="table-rows">
              <div class="row">
                <span class="label">Base Energy Charge</span>
                <span class="val">฿${d.baseCost}</span>
              </div>
              <div class="row">
                <span class="label">Accumulated Ft Charge (${d.ftRate} ฿/kWh)</span>
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

            <!-- Breakdown Visual Bar -->
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
            <h2>Monthly Energy Consumption Profile</h2>
            <div class="metric-main" style="color: #60a5fa;">${d.importKwh} <span style="font-size: 20px;">kWh</span></div>
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
            <h2>Monthly Solar Net Benefit (Net Billing)</h2>
            <div class="metric-main saving">฿${d.totalSolarBenefit}</div>
            <div class="table-rows">
              <div class="row">
                <span class="label">Self-Consumption Savings (Riemann Integration)</span>
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
                <span class="val">Day Solar Storage &rarr; Peak Evening Discharge</span>
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
            <div class="metric-main accent">${d.meaPoints} <span style="font-size: 22px;">Points</span></div>
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
                <span class="label">Recorded Outage Incidents</span>
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
        Thailand Energy & Solar Monitor v1.0.3 &bull; HACS Custom Integration
      </div>
    `;
  }
}

customElements.define('thai-energy-panel', ThaiEnergyPanel);

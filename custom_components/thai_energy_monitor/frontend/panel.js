/**
 * Thailand Energy & Solar Monitor - Custom Sidebar Web Component
 * Built with Lit framework standards for modern Home Assistant UI integration.
 */

class ThaiEnergyPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
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
      solarSavings: findEntityValue('monthly_solar_savings') || findEntityValue('solar_savings'),
      solarRevenue: findEntityValue('monthly_solar_revenue') || findEntityValue('solar_revenue'),
      totalSolarBenefit: findEntityValue('monthly_total_solar_benefit') || findEntityValue('total_solar_benefit'),
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
      provider: getAttribute('monthly_estimated_bill', 'utility_provider') || 'MEA',
      tariffCategory: getAttribute('monthly_estimated_bill', 'tariff_category') || '1.2',
      isOffpeak: getAttribute('monthly_estimated_bill', 'is_offpeak'),
      opposingTariffName: getAttribute('monthly_estimated_bill', 'opposing_tariff_name') || 'TOU 1.3.2',
    };

    this.render();
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
      ? `Cheaper by ฿${Math.abs(diffVal).toFixed(2)} vs ${d.opposingTariffName}`
      : `More expensive by ฿${Math.abs(diffVal).toFixed(2)} vs ${d.opposingTariffName}`;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 16px;
          background-color: var(--primary-background-color, #111116);
          color: var(--primary-text-color, #e1e1e6);
          font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
          box-sizing: border-box;
          min-height: 100vh;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, #1e293b, #0f172a);
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 20px;
          border: 1px solid #334155;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
        }

        .header h1 {
          margin: 0;
          font-size: 22px;
          font-weight: 600;
          color: #38bdf8;
        }

        .header .subtitle {
          font-size: 13px;
          color: #94a3b8;
          margin-top: 4px;
        }

        .badge {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .badge.offpeak {
          background-color: #15803d;
          color: #dcfce7;
        }

        .badge.peak {
          background-color: #b91c1c;
          color: #fee2e2;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }

        .card {
          background: #1e293b;
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #334155;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
        }

        .card h2 {
          margin-top: 0;
          font-size: 16px;
          color: #f8fafc;
          border-bottom: 1px solid #334155;
          padding-bottom: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .metric-main {
          font-size: 36px;
          font-weight: 700;
          color: #38bdf8;
          margin: 15px 0;
        }

        .table-rows {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 14px;
        }

        .row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          border-bottom: 1px dashed #334155;
        }

        .row .label {
          color: #94a3b8;
        }

        .row .val {
          font-weight: 500;
          color: #f1f5f9;
        }

        .saving { color: #4ade80 !important; }
        .warning { color: #f87171 !important; }
        .highlight { color: #fbbf24 !important; }

        .footer-note {
          margin-top: 25px;
          text-align: center;
          font-size: 12px;
          color: #64748b;
        }
      </style>

      <div class="header">
        <div>
          <h1>Thailand Energy & Solar Monitor</h1>
          <div class="subtitle">Provider: ${d.provider} | Active Tariff: ${d.tariffCategory}</div>
        </div>
        <div>
          ${offpeakBadge}
        </div>
      </div>

      <div class="grid">
        <!-- Monthly Bill Overview -->
        <div class="card">
          <h2>Monthly Bill Overview <span>(THB)</span></h2>
          <div class="metric-main">฿${d.totalBill}</div>
          <div class="table-rows">
            <div class="row">
              <span class="label">Base Energy Cost</span>
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
              <span class="label">Calculated VAT (7%)</span>
              <span class="val">฿${d.vatAmount}</span>
            </div>
          </div>
        </div>

        <!-- Solar ROI Card -->
        <div class="card">
          <h2>Monthly Solar Net Benefit</h2>
          <div class="metric-main saving">฿${d.totalSolarBenefit}</div>
          <div class="table-rows">
            <div class="row">
              <span class="label">Self-Consumption Savings</span>
              <span class="val saving">฿${d.solarSavings}</span>
            </div>
            <div class="row">
              <span class="label">Export Revenue (${d.sellbackRate} ฿/kWh)</span>
              <span class="val saving">฿${d.solarRevenue}</span>
            </div>
            <div class="row">
              <span class="label">HA Energy Dashboard Price</span>
              <span class="val">฿${d.gridPrice} / kWh</span>
            </div>
          </div>
        </div>

        <!-- Predictive Tariff Comparison Card -->
        <div class="card">
          <h2>Predictive Tariff Comparison</h2>
          <div class="metric-main ${diffClass}">${diffText}</div>
          <div class="table-rows">
            <div class="row">
              <span class="label">Opposing Model</span>
              <span class="val">${d.opposingTariffName}</span>
            </div>
            <div class="row">
              <span class="label">Calculated Difference</span>
              <span class="val">฿${d.tariffDiff}</span>
            </div>
          </div>
        </div>

        <!-- BESS Storage Simulation Card -->
        <div class="card">
          <h2>BESS Storage Simulation</h2>
          <div class="metric-main highlight">฿${d.bessSavings}</div>
          <div class="table-rows">
            <div class="row">
              <span class="label">Simulated Shift Savings</span>
              <span class="val highlight">฿${d.bessSavings}</span>
            </div>
            <div class="row">
              <span class="label">Strategy</span>
              <span class="val">Solar Charge &rarr; Peak Discharge</span>
            </div>
          </div>
        </div>

        <!-- MEA Gamification Card -->
        <div class="card">
          <h2>MEA Rewards & Discount</h2>
          <div class="metric-main" style="color: #a78bfa;">${d.meaPoints} Pts</div>
          <div class="table-rows">
            <div class="row">
              <span class="label">Cash Fiat Discount</span>
              <span class="val" style="color: #a78bfa;">฿${d.meaCash}</span>
            </div>
            <div class="row">
              <span class="label">Conversion Baseline</span>
              <span class="val">1 Point = 0.10 THB</span>
            </div>
          </div>
        </div>

        <!-- Outage Cost & Resilience Card -->
        <div class="card">
          <h2>Grid Outages & Resilience</h2>
          <div class="metric-main warning">฿${d.outageCost}</div>
          <div class="table-rows">
            <div class="row">
              <span class="label">Outage Incidents</span>
              <span class="val warning">${d.outageCount} events</span>
            </div>
            <div class="row">
              <span class="label">Economic Impact Rate</span>
              <span class="val">308.41 ฿ / kWh</span>
            </div>
          </div>
        </div>
      </div>

      <div class="footer-note">
        Thailand Energy & Solar Monitor v1.0.0 &bull; HACS Custom Integration
      </div>
    `;
  }
}

customElements.define('thai-energy-panel', ThaiEnergyPanel);

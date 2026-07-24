# Thailand Energy & Solar Monitor (`thai_energy_monitor`)

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/default)

A custom Home Assistant integration designed to monitor, calculate, and forecast electricity costs, solar Return on Investment (ROI), and grid resilience for residential power users in Thailand under both the **Metropolitan Electricity Authority (MEA)** and **Provincial Electricity Authority (PEA)**.

---

## Key Features

- **Full Tariff Coverage**:
  - **Tariff 1.1**: Progressive 7-tier rate (<= 150 kWh/mo) with Public Service Obligation (PSO) 50 kWh free electricity subsidy & 150 kWh reclassification warning tracking.
  - **Tariff 1.2**: Progressive 3-tier rate (> 150 kWh/mo).
  - **Tariff 1.3**: Time of Use (TOU) rates (1.3.1 12-24 kV and 1.3.2 < 12 kV) with dynamic Thai National Holiday resolution via `holidays.TH()`.
- **Solar Prachachon (Net Billing)**:
  - Riemann sum numerical integration for instantaneous self-consumption savings.
  - Monetization of grid export at wholesale rate (2.20 THB/kWh).
- **Statutory Surcharges & Taxes**:
  - Configurable Fuel Adjustment Charge (Ft).
  - Statutory 7% Value Added Tax (VAT) applied at the aggregate stage.
- **Predictive Analytics**:
  - **Phantom Tariff Comparison Engine**: Concurrently processes consumption through opposing tariffs to highlight potential savings or loss.
  - **BESS Simulation Engine**: Models financial benefit of adding battery energy storage to shift daytime solar.
  - **MEA Point Gamification**: Tracks virtual MEA reward points and cash fiat discount value.
  - **Grid Reliability & Outage Cost Tracking**: Logs grid outages and estimates macroeconomic loss.
- **Modern Sidebar UI Panel**: Built with Lit Web Components (`panel.js`) adapting to Home Assistant active dark/light theme.

---

## Installation & Setup

### HACS Installation
1. Open HACS in Home Assistant -> **Integrations** -> **Custom Repositories**.
2. Add this repository URL and select category **Integration**.
3. Click **Install**.
4. Restart Home Assistant.

### Configuration
1. Go to **Settings** -> **Devices & Services** -> **Add Integration**.
2. Search for **Thailand Energy & Solar Monitor**.
3. Select your utility provider (MEA / PEA), tariff category, billing day, and select your grid import, export, and solar production sensors.

---

## License
GNU GPLv3 License

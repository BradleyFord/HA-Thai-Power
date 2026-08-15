# Thailand Energy & Solar Monitor (`thai_energy_monitor`)

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/default)
[![GitHub Release](https://img.shields.io/github/v/release/BradleyFord/HA-Thai-Power?style=flat-square)](https://github.com/BradleyFord/HA-Thai-Power/releases)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

A comprehensive custom Home Assistant integration designed to monitor, calculate, and forecast electricity bills, solar Return on Investment (ROI), and battery storage economics for residential power users in Thailand under both the **Metropolitan Electricity Authority (MEA)** and **Provincial Electricity Authority (PEA)**.

---

## ⚡ Key Features

- **Full Thai Tariff Schedules**:
  - **Tariff 1.1**: Progressive 7-tier rate (≤ 150 kWh/month) with Public Service Obligation (PSO) free electricity tracking and reclassification warnings.
  - **Tariff 1.2**: Progressive 3-tier rate (> 150 kWh/month).
  - **Tariff 1.3**: Time of Use (TOU) rates (1.3.1 12–24 kV and 1.3.2 < 12 kV) with dynamic Thai National Holiday resolution via `holidays.TH()`.
- **Exact 2-Pass Daily TOU Calculation**:
  - Automatically splits past and present days into Peak and Off-Peak windows based on calendar dates (Weekdays vs Weekends/Holidays) and daytime solar production.
  - Independently computes and combines Peak and Off-Peak consumption and savings for 100% mathematical transparency and stability.
- **Automated Daily Ft Rate Sync (3:00 AM)**:
  - Connects to the official **MEA Open Data CKAN API** to dynamically update your Fuel Adjustment Charge (Ft) every morning at 3:00 AM.
- **Solar Prachachon (Net Billing)**:
  - High-precision numerical integration for instantaneous self-consumption savings.
  - Solar buy-back grid export monetization at the statutory wholesale rate (2.20 THB/kWh).
- **Predictive Analytics & Simulations**:
  - **Phantom Tariff Comparison Engine**: Evaluates your active usage against opposing tariffs to identify whether switching tariffs saves you money.
  - **BESS Battery Storage Simulation Engine**: Simulates financial payback and bill reduction for adding Home Battery Storage (e.g. 5–20 kWh).
  - **MEA Reward Points Gamification**: Virtual points accumulation and cash discount conversion.
  - **Grid Outage & Economic Resilience**: Real-time outage logging and macroeconomic loss estimation.
- **Dedicated High-Performance Dashboard Panel**:
  - Built with custom Web Components (`panel.js`), seamlessly integrating into Home Assistant with full Dark/Light theme responsiveness.

---

## 📦 Installation via HACS

### Method 1: Add as Custom Repository in HACS (Recommended)
1. Open **HACS** in your Home Assistant sidebar.
2. Click the three dots in the top right corner and select **Custom repositories**.
3. In the **Repository** field, enter:
   ```text
   https://github.com/BradleyFord/HA-Thai-Power
   ```
4. In the **Type** dropdown, select **Integration**.
5. Click **Add**, then find **Thailand Energy & Solar Monitor** and click **Download**.
6. **Restart Home Assistant**.

---

## ⚙️ Configuration

1. In Home Assistant, navigate to **Settings** -> **Devices & Services** -> **Add Integration**.
2. Search for **Thailand Energy & Solar Monitor**.
3. Complete the setup dialog:
   - **Utility Provider**: MEA (Metropolitan) or PEA (Provincial).
   - **Tariff Category**: Tariff 1.1, Tariff 1.2, or Tariff 1.3 (TOU).
   - **Billing Cycle Start Day**: Day of the month your utility meter resets (1–28).
   - **Grid Import Sensor**: Your grid import power/energy entity ID.
   - **Solar Production Sensor**: Your solar inverter yield entity ID.
   - **Grid Export Sensor (Optional)**: Your grid feed-in export sensor ID.
4. Click **Submit**.

---

## 📄 License
This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.


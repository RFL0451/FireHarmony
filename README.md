# FireHarmony 🔥🛰️

**Harmonizing MODIS and VIIRS for Global Fire Monitoring**
*Built for the NASA Space Apps Challenge 2026.*

## 📖 Overview
MODIS and VIIRS are two satellite sensors that detect thermal anomalies (hot spots). Because they have different spatial resolutions and operational periods, their data cannot be simply merged. 

**FireHarmony** is a web application that harmonizes these two datasets into a single, unified record. It matches detections of the same fire within a configurable distance and time window, revealing fires that a single sensor would miss.

## ✨ Features
- **Interactive Map:** Compare MODIS, VIIRS, and Harmonized data layers.
- **Adjustable Matching Rules:** Tune the maximum distance (km) and time gap (hours) to see how the harmonization changes in real-time.
- **False-Positive Filter:** Automatically flags and hides persistent hot spots (like industrial flares or volcanoes).
- **Anomaly Watch:** Statistical analysis (Z-score) to identify days with unusually high fire activity.
- **CSV Export:** Download raw points or harmonized clusters for further analysis.
- **Live Data:** Connects directly to the NASA FIRMS API (with a synthetic fallback for offline demos).

## 🛠️ Tech Stack
- **Frontend:** Vanilla JavaScript, Leaflet.js (Maps), Chart.js (Analytics), CSS3.
- **Backend (BFF):** Node.js, Express.js, Dotenv.
- **Data Source:** NASA FIRMS API.

---

## 🚀 How to Run Locally (Detailed Guide)

This project consists of two parts: **Frontend** (UI, map, charts) and **Backend / BFF** (server that securely requests data from NASA and serves it to the frontend). 

### 📋 Prerequisites
1. **Node.js** (version 18 or higher). 
   - Download: [https://nodejs.org/](https://nodejs.org/) (LTS version recommended). Make sure "Add to PATH" is checked during installation.
2. **NASA FIRMS API Key**.
   - Get your free `MAP_KEY` here: [https://firms.modaps.eosdis.nasa.gov/api/map_key/](https://firms.modaps.eosdis.nasa.gov/api/map_key/).
3. **Terminal** (PowerShell or CMD on Windows).

### 🗂️ Project Structure
- `js/`, `css/`, `index.html`, `dashboard.html` — **Frontend** (browser files).
- `server/` — **Backend** (Node.js server).
- `package.json` (in the root) — Scripts to easily run the whole project.

### 🛠️ Step-by-Step Setup

#### Step 1. Configure the Backend (API Key)
The server needs your NASA key. It is stored in a `.env` file.

1. Open PowerShell or CMD and navigate to the `server` folder:
   ```cmd
   cd path/to/your/project/server
   ```
2. Copy the example environment file:
   ```cmd
   copy .env.example .env
   ```
3. Open the newly created `.env` file in any text editor (Notepad, VS Code, etc.).
4. Paste your NASA key after the `=` sign:
   ```env
   FIRMS_MAP_KEY=your_actual_nasa_key_here
   PORT=3000
   ```
5. Save and close the file.

#### Step 2. Install Dependencies
1. Go back to the **root** directory of the project (where the main `index.html` is located):
   ```cmd
   cd ..
   ```
2. Run the installation script:
   ```cmd
   npm run install-all
   ```
   *This will automatically go into the `server` folder, download the required packages (Express, Dotenv), and create the `node_modules` folder.*

#### Step 3. Start the Server
1. While in the root directory, run:
   ```cmd
   npm start
   ```
2. You should see this message in the console: `App + API on http://localhost:3000`
3. **Keep this terminal window open!** The server must be running for the site to work.

#### Step 4. Open the App
Go to [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🖱️ How to Use the Dashboard

- **Live Data vs. Demo Data:** By default, "Last 30 days" is selected. **NASA API does not allow requesting more than 5 days at once.** If you request 30 days, the server will return a `FIRMS 400` error, and the frontend will automatically fall back to synthetic mock data so the app doesn't look broken. The status will say `Showing demo data (synthetic)`.
- **To see real NASA data:** Select `Custom range`, pick a period of **5 days or less**, and click `Apply / Refresh`. The status will change to `Live FIRMS data`.
- **Harmonization:** Move the `Max distance` and `Max time gap` sliders to see how the number of matched points changes in real-time.
- **Export:** Click `Download points as CSV` or `Download clusters as CSV` to get the data. They are perfectly formatted for Excel.

---

## 🆘 Troubleshooting (Windows)

**Error: `npm error Missing script: "start"`**
- You are in the wrong folder. The `npm start` command must be run in the root directory (where the main `package.json` is), not inside the `server` folder.

**Error: `EADDRINUSE: address already in use :::3000`**
- Port 3000 is already used by another program. Open `server/.env`, change `PORT=3000` to `PORT=3001`, save, and restart the server (`Ctrl+C`, then `npm start`).

**Error: `FIRMS 400` in the server logs**
- You are requesting data from NASA for too long a period. The NASA API allows a maximum of 5 days at a time. Reduce the date range.

**Map is gray or not loading**
- Make sure you have an active internet connection (the map uses external OpenStreetMap tiles).

## 👥 Team kikoriki

- Vlada Kim, Komila Nurullaeva, Stepan Lomonosov, Pavel Mishin, Bekzat Serikbayev
```
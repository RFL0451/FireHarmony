# Research notes: roadmap items 5–10

Findings from literature review (November 2026) for the next development phases of
FireHarmony. Each section answers one roadmap question, assesses feasibility for this
codebase, and lists concrete next steps.

---

## 5. Can we explain WHY there are more fires in some areas / periods?

**Short answer: yes, and the drivers are well-studied. Fire activity is not random —
it follows a "fire calendar" set by climate, fuel and people.**

Main drivers established in the literature:

- **Climate/weather**: temperature, precipitation deficits, and fuel moisture are the
  dominant controls. Anthropogenic warming accounted for ~55% of increased fuel
  dryness in the western US (1979–2015) and roughly doubled burned forest area
  (1984–2015). A +1 °C anomaly can raise median annual burned area by up to 600%
  in some forest types. [NOAA](https://www.noaa.gov/noaa-wildfire/wildfire-climate-connection),
  [Jones et al. 2022, Rev. Geophysics](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2020RG000726)
- **Seasonality**: fire seasons shift regularly with latitude (temperature gradients);
  in the western US, interannual variability tracks temperature, in the southeast it
  tracks precipitation; drought indices (PDSI) reflect total biomass burned.
  [Zhang et al. 2014, JGR](https://agupubs.onlinelibrary.wiley.com/doi/10.1002/2013JG002518)
- **Ignitions**: humans cause the majority of ignitions globally (84% in the US);
  lightning dominates in remote boreal/wildland areas. Agricultural burning creates
  strong, predictable seasonal peaks (e.g. early-dry-season burns in northern Africa
  deliberately precede the dangerous late-season fires).
  [NOAA review](https://repository.library.noaa.gov/view/noaa/67728/noaa_67728_DS1.pdf)
- **Land use**: agricultural expansion suppresses large wildfires (irrigation,
  fragmentation) but adds many small managed burns; deforestation frontiers
  (Amazon arc) concentrate fire along disturbance edges.

**Feasible implementations for FireHarmony:**

1. *Context panel* (cheap, no new data): when a region/period is selected, show a
   "Why here?" card with the region's known fire regime (fire season months,
   dominant cause: agricultural / lightning / drought) from a small static knowledge
   base we author.
2. *Overlay weather drivers* (medium): pull ERA5/Open-Meteo reanalysis for the
   selected bbox — precipitation deficit, temperature anomaly, relative humidity —
   and correlate with daily fire counts. Open-Meteo has a free historical API, no key.
3. *Fire season calendar* (medium): compute per-region fire seasonality (start, peak,
   end of season) from multi-year FIRMS archive data and display it next to the
   current selection, so users can see "this spike is early/late for this region".

---

## 6. Can we add an "intensity" metric for fires?

**Short answer: yes — we already have the data. FRP (Fire Radiative Power, MW) is
the standard scientific proxy for fire intensity, and it is already in every
detection record; we just don't surface it as a classification.**

- FRP is the instantaneous rate of radiative energy release, physically proportional
  to the rate of biomass consumption; integrated over time it gives FRE (Fire
  Radiative Energy, MJ), tied to total fuel consumed and smoke emissions.
  [Wooster approach, NOAA](https://repository.library.noaa.gov/view/noaa/24117/noaa_24117_DS1.pdf),
  [MIT thesis](https://dspace.mit.edu/bitstream/handle/1722.1/115784/1036987800-MIT.pdf?sequence=1&isAllowed=y)
- Operational studies classify events by peak FRP, e.g.: **Low < 15 MW,
  Moderate 15–50, High 50–150, Extreme ≥ 150 MW** (thresholds derived empirically
  per region from 13-year VIIRS data). [Research Square, Nepal study](https://www.researchsquare.com/article/rs-9716417/v1.pdf)
- **Caveat for our harmonized dataset**: MODIS pixel-level FRP runs systematically
  higher than VIIRS for the same fire (1 km aggregation vs 375 m), so absolute FRP
  values are NOT directly interchangeable between sensors. Options: show intensity
  per sensor, or normalize before merging.
  [MDPI Remote Sensing 2020](https://www.mdpi.com/2072-4292/12/18/2870)

**Feasible implementations:**

1. *Intensity class per point* (cheap): add FRP class (Low/Moderate/High/Extreme) to
   popups, CSV export, and optionally color/size points by FRP class.
2. *Intensity layers in charts* (cheap): add cumulative FRP per day to the time
   series chart alongside counts — distinguishes "many small fires" from
   "few extreme fires".
3. *Regional intensity profile* (medium): FRP class histogram per region, revealing
   fire-regime differences (savanna vs boreal vs agricultural).

---

## 7. Can we predict fire movement with wind, elevation and humidity?

**Short answer: yes, this is a solved problem at the engineering level — the
Rothermel (1972) surface-fire spread model plus terrain/weather data. But it is a
major build, and accuracy breaks down in extreme conditions.**

- **Rothermel model**: `R = IR·ξ·(1+φw+φs) / (ρb·ε·Qig)` — rate of spread from fuel
  properties, moisture damping, wind factor and slope factor. It underpins
  operational tools (BehavePlus, FARSITE, FlamMap, WRF-Fire) in the US, Canada,
  Australia, parts of Europe. Byram's fireline intensity `I = H·w·R` then gives
  flame length and suppression difficulty. [USDA Forest Service](https://research.fs.usda.gov/treesearch/23261),
  [Your Air Test comparison](https://yourairtest.com/science-fire-spread-physical-models-2026-2-en/)
- **Data we would need**: wind speed/direction (Open-Meteo / GFS), slope & aspect
  (NASA SRTM elevation), fuel models (Anderson 13 / Scott & Burgan 40 land cover
  classification), fuel moisture (from humidity/temperature or FWI).
  [FIRI-RISK project](https://fireurisk.eu/wp-content/uploads/2024/05/FIFDF31.pdf)
- **Accuracy**: within a factor of ~2 under moderate conditions; fails for crown
  fires, spotting, wind > 30–40 km/h, or very dry fine fuels. Commercial products
  (e.g. OroraTech Fire Spread) already do exactly this from FIRMS-like hotspots.
  [OroraTech](https://ororatech.com/resources/news-blog/fire-spread-product-for-enhanced-wildfire-predictions)
- **Modern alternative**: ML/hybrid models (U-Net, cellular automata + Rothermel)
  trained on simulated spread; higher ceiling, much higher complexity.
  [MDPI Fire 2024 review](https://www.mdpi.com/2571-6255/7/12/482)

**Feasible phased approach:**

1. *Directional cone* (cheap demo): for a selected point, fetch current wind from
   Open-Meteo and draw a spread direction cone — illustrative, not a real model.
2. *Simplified Rothermel on a grid* (big): grass fuel model only, SRTM slope,
   Open-Meteo wind+humidity; simulate 6–12 h front. This is a project in itself.
3. Recommend treating this as a **separate module/service**, not part of the
   harmonization dashboard.

---

## 8. Trend analysis by comparing periodic data — is it useful?

**Short answer: yes, and it is one of the most scientifically established uses of
active-fire archives — but it requires historical data, which the current NRT-only
pipeline lacks.**

- Active-fire products are "particularly well suited for characterizing fire seasons"
  — start, peak, end, duration — and FRP/count time series reveal regime shifts
  linked to climate and land-use change. [NOAA review](https://repository.library.noaa.gov/view/noaa/67728/noaa_67728_DS1.pdf)
- FIRMS provides a continuous archive back to 2000 (MODIS) / 2012 (VIIRS) via
  standard (non-NRT) products — usable for baselines. [Atlas data guide](https://atlas.co/data-sources/firms/)
- Long-term studies show real, detectable trends: US biomass burned +2.87 Tg/yr,
  fire seasons shifting 1.5–5 days/yr earlier in some states.
  [Zhang et al. 2014](https://agupubs.onlinelibrary.wiley.com/doi/10.1002/2013JG002518)

**Usefulness check — where it adds value vs. where it misleads:**

- ✅ Fire-season baseline ("is this July normal for this region?") — directly
  actionable for fire managers.
- ✅ Year-over-year anomaly detection — a better-calibrated version of our current
  z-score (which only compares within the selected window).
- ⚠ Sensor bias trap: pre-2012 is MODIS-only, post-2012 adds VIIRS (which detects
  ~6× more small fires). Naive count trends mix a real trend with an instrument
  change — must compare per sensor or use our harmonized record.
- ⚠ NRT data can't do this; needs archive downloads (FIRMS archive CSV / API with
  longer ranges, stored server-side).

**Proposed feature**: "Baseline mode" — server pre-fetches several years of archive
data for the selected region, computes the climatological daily mean ± std band, and
the current period is drawn against that band.

---

## 9. Would clustering heat points by country be more convenient?

**Assessment: useful as an aggregation/reporting view, not as a replacement for the
current clustering.**

- Emergency management and reporting are organized along national boundaries, so
  per-country counts/FRP are genuinely the unit decision-makers ask for.
- Technically easy: load a world country boundaries GeoJSON (~1–5 MB simplified)
  and do point-in-polygon in the browser (e.g. with turf.js) or on the server.
  ~250 polygons, thousands of points — fine performance-wise.
- **Edge cases**: offshore detections (oil platforms — exactly our persistent
  sources!) fall outside country polygons → need an "EEZ / offshore / unassigned"
  bucket; points near borders need no special handling with proper pip.
- **Caveat**: countries are very uneven in size, so per-country raw counts mostly
  reflect area — normalize by area (detections per 10,000 km²) or show counts
  alongside density. Continents (current view) remain better for pattern-spotting;
  countries are better for accountability.

**Recommendation**: add a "By country" table/tab alongside the existing regional
table (not instead of it), with columns: country, detections, per-area density,
persistent-source share, top FRP. Choropleth coloring of the map is a nice phase 2.

---

## 10. API for a situational center: new points in a controlled zone

**Short answer: yes — the current Express BFF is 80% of the way there. Design:**

- **Watch registration**: `POST /api/watch` — { name, geometry (bbox or polygon),
  sensors, minConfidence, callbackUrl (optional webhook), contact }. Stored in a
  small DB or JSON file.
- **Polling loop**: server-side scheduler (e.g. every 30–60 min) queries FIRMS NRT
  for each watch zone (FIRMS updates ~hourly after overpasses; 5-day request cap
  doesn't matter here since we only need the last 1–2 days).
- **Deduplication**: hash of (lat, lon, acq_time, sensor) against a seen-store —
  only *new* points trigger alerts.
- **Delivery**: 
  - `GET /api/watch/:id/events?since=...` — pull API for the situational center;
  - webhook POST to `callbackUrl` — push;
  - optional SSE stream for a live dashboard wall.
- **Alert payload**: normalized point fields + fire-likelihood score + persistence
  flag + distance to zone centroid / nearest settlement.
- **Operational caveats** (from practitioner guidance): satellite detections lag
  reality by hours, clouds/smoke hide fires, "no detection ≠ no fire" — the API
  contract should carry these as explicit metadata fields (`latencyHours`,
  `coverageNote`). [NASA Lifelines](https://nasalifelines.org/hfs-data-series/wildfire-early-warning-and-rapid-response/)

**Build order**: (1) seen-store + `/api/watch` CRUD, (2) poll loop, (3) webhook,
(4) confidence enrichment (reuse `js/confidence.js` logic server-side).

// Full-page map. Two modes:
//  - regular: full-page map + 3 sensor buttons (Only MODIS / Only VIIRS / Combined),
//    time-bracket presets, "hide persistent hot spots", collapsible legend.
//  - advanced: unlocked with a password; exposes every other map setting
//    (custom dates, region, matching rule, persistence detection, CSV export).
(() => {
'use strict';
const { C, REGIONS, DAY, iso, hav, harmonize, DataStore } = window.Core;
const $ = id => document.getElementById(id);
const fmt = t => new Date(t).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
let view = { m: [], v: [], pairs: [] };

// ---- status line
const status = (t, err, busy) => { $('statusText').textContent = t; $('status').className = 'status' + (err ? ' err' : '') + (busy ? ' loading' : ''); };

// ---- time bracket
const setDates = () => { const n = +$('preset').value; if (!n) return; $('to').value = iso(new Date()); $('from').value = iso(new Date(Date.now() - (n - 1) * DAY)); };
setDates();
$('preset').onchange = () => { setDates(); apply(); };
$('from').onchange = $('to').onchange = () => { $('preset').value = 'custom'; };

// ---- advanced mode lock
const ADV_PASSWORD = '0000';
const unlocked = () => sessionStorage.getItem('fh_adv') === '1';
function setMode(adv) {
  document.body.classList.toggle('adv-mode', adv);
  $('advLock').hidden = adv;
  $('advBody').hidden = !adv;
  $('advToggle').textContent = adv ? 'Lock advanced' : 'Advanced';
  $('advToggle').setAttribute('aria-expanded', String(adv));
}
$('advToggle').addEventListener('click', () => {
  if (unlocked()) { sessionStorage.removeItem('fh_adv'); setMode(false); return; }
  $('advLock').hidden = false; $('advBody').hidden = true; $('advPass').focus();
});
$('advUnlock').addEventListener('click', tryUnlock);
$('advPass').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); tryUnlock(); } });
function tryUnlock() {
  if ($('advPass').value === ADV_PASSWORD) {
    sessionStorage.setItem('fh_adv', '1');
    $('advPass').value = ''; $('advErr').hidden = true;
    setMode(true);
  } else {
    $('advErr').hidden = false; $('advPass').select();
  }
}
setMode(unlocked());

// ---- map
const map = L.map('map', { preferCanvas: true, worldCopyJump: true, zoomControl: false }).setView([15, 20], 2);
L.control.zoom({ position: 'topright' }).addTo(map);
// Base layers double as the label-language switcher:
// CARTO Voyager renders English place names, OSM standard renders local names.
// OSM note: the canonical host tile.openstreetmap.org is used (the a-/b-/c-
// subdomains are retired and can answer 403), the layer is NOT the default,
// and proper attribution is attached — per the OSM Tile Usage Policy.
const baseEn = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
  attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ',
  maxZoom: 19,
}).addTo(map);
const baseLocal = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19, maxNativeZoom: 19,
});
const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Esri World Imagery', maxZoom: 18 });
L.control.layers({
  'Map labels: English': baseEn,
  'Map labels: local language': baseLocal,
  'Satellite (no labels)': sat,
}, null, { collapsed: true }).addTo(map);
const cluster = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 45 }).addTo(map);

// ---- collapsible in-map legend (available and hideable in both modes)
const lg = L.control({ position: 'bottomright' });
lg.onAdd = () => {
  const d = L.DomUtil.create('div', 'legend');
  // rows sit ABOVE the button, so the button stays in the same corner spot whether the legend is open or closed
  d.innerHTML = `<div class="lg-rows" id="lgRows" hidden>
      <span class="lg-dot" style="background:${C.M}"></span> MODIS (1 km)<br>
      <span class="lg-dot" style="background:${C.V}"></span> VIIRS (375 m)<br>
      <span class="lg-dot big" style="background:${C.B}"></span> Both sensors<br>
      <span class="lg-ring"></span> Persistent hot spot
      <div class="lg-sub">Clusters (detections grouped)</div>
      <div class="lg-cl-row">
        <span class="lg-cl" style="background:rgba(181,226,140,.75)"><i style="background:rgba(110,204,57,.8)"></i></span>&lt;10
        <span class="lg-cl" style="background:rgba(241,211,87,.75)"><i style="background:rgba(240,194,12,.8)"></i></span>10–100
        <span class="lg-cl" style="background:rgba(253,156,115,.75)"><i style="background:rgba(241,128,23,.8)"></i></span>&gt;100
      </div>
    </div>
    <button type="button" class="lg-toggle" aria-expanded="false" aria-controls="lgRows">Legend <span class="lg-chev" aria-hidden="true"></span></button>`;
  const btn = d.querySelector('.lg-toggle'), rows = d.querySelector('.lg-rows');
  btn.addEventListener('click', () => {
    const open = rows.hidden;            // currently hidden -> will open
    rows.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    d.classList.toggle('open', open);
  });
  L.DomEvent.disableClickPropagation(d);
  return d;
};
lg.addTo(map);

// ---- markers
function marker(p, type) {
  const big = type === 'B', col = C[type];
  const persistent = big ? (p.m.persistent || p.v.persistent) : p.persistent;
  const m = L.circleMarker([p.lat, p.lon], {
    radius: big ? 8 : 5,
    color: persistent ? '#6b6f76' : '#1b2540',
    weight: persistent ? 2.5 : (big ? 2 : .6),
    dashArray: persistent ? '3 2' : null,
    fillColor: col, fillOpacity: persistent ? .45 : .9,
  });
  const confHtml = (pt, matched) => {
    const cf = Confidence.assess(pt, { matched });
    return `<hr><b>Fire likelihood: <span class="cf cf-${cf.cls}">${cf.level}</span> (${cf.score}/100)</b><br>
      <span class="cf-why">${cf.why || ''}</span><br><span class="cf-note">${cf.note}</span>`;
  };
  let h;
  if (big) {
    const dKm = hav(p.m, p.v), dH = (Math.abs(p.m.t - p.v.t) / 36e5).toFixed(2);
    h = `<b>Harmonized (both sensors)</b><br>${fmt(p.m.t)}<br>${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}<br>
      Δ distance: <b>${dKm.toFixed(2)} km</b> · Δ time: <b>${dH} h</b><hr>
      MODIS: FRP ${p.m.frp} MW · BT ${p.m.bt} K · conf ${p.m.c}<br>
      VIIRS: FRP ${p.v.frp} MW · BT ${p.v.bt} K · conf ${p.v.c}` +
      confHtml({ c: Math.max(p.m.c, p.v.c), frp: Math.max(p.m.frp, p.v.frp), persistent }, true);
  } else {
    h = `<b>${type === 'M' ? 'MODIS' : 'VIIRS'}</b>${persistent ? ' · <i>persistent</i>' : ''}<br>
      ${fmt(p.t)}<br>${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}<br>
      Satellite: ${p.sat || '—'} · ${p.dn === 'N' ? 'night' : 'day'}<br>
      FRP: <b>${p.frp} MW</b><br>BT: ${p.bt} K · confidence ${p.c}` +
      confHtml(p, false);
  }
  return m.bindPopup(h);
}

function sensorMode() { return document.querySelector('[name=sensor]:checked').value; }

function drawMap() {
  const mode = sensorMode(), { m, v, pairs } = view;
  const hide = $('hidePersist').checked;
  const pass = p => !hide || !p.persistent;
  const um = new Set(pairs.map(x => x.m)), uv = new Set(pairs.map(x => x.v)), out = [];
  if (mode === 'MODIS') m.filter(pass).forEach(p => out.push(marker(p, 'M')));
  else if (mode === 'VIIRS') v.filter(pass).forEach(p => out.push(marker(p, 'V')));
  else {
    m.filter(p => !um.has(p) && pass(p)).forEach(p => out.push(marker(p, 'M')));
    v.filter(p => !uv.has(p) && pass(p)).forEach(p => out.push(marker(p, 'V')));
    pairs.filter(x => pass(x.m) && pass(x.v)).forEach(x =>
      out.push(marker({ m: x.m, v: x.v, lat: (x.m.lat + x.v.lat) / 2, lon: (x.m.lon + x.v.lon) / 2 }, 'B')));
  }
  cluster.clearLayers(); cluster.addLayers(out);
}

// ---- filtering + apply
function filtered() {
  const [s, w, n, e] = REGIONS[$('region').value];
  const pts = DataStore.query({ bbox: [w, s, e, n], from: $('from').value, to: $('to').value });
  const m = pts.filter(p => p.s === 'M'), v = pts.filter(p => p.s === 'V');
  return { m, v, pairs: harmonize(m, v, +$('dist').value, +$('hours').value) };
}
function regionBbox() { const [s, w, n, e] = REGIONS[$('region').value]; return [w, s, e, n]; }
function syncOut() {
  $('distOut').textContent = (+$('dist').value) + ' km';
  $('hoursOut').textContent = $('hours').value + ' h';
  $('persistDaysOut').textContent = $('persistDays').value;
  $('persistKmOut').textContent = (+$('persistKm').value);
}

async function apply() {
  syncOut();
  status('Loading…', false, true);
  try {
    const { fresh } = await DataStore.ensure({
      bbox: regionBbox(), from: $('from').value, to: $('to').value,
    });
    view = filtered();
    Persistent.markPersistent(view.m.concat(view.v), {
      days: +$('persistDays').value || 3,
      km: +$('persistKm').value || 1,
    });
    drawMap();
    const n = view.m.length + view.v.length;
    const src = DataStore.demo ? 'demo data (synthetic)' : (fresh ? 'live FIRMS data' : 'cached data');
    const ds = DataStore.meta && DataStore.meta.downsampled ? ` · evenly sampled from ${DataStore.meta.totalRaw.toLocaleString()}` : '';
    status(`${src} · ${n} detections in view${ds}`);
    UrlState.write(collectUrlState());
  } catch (e) { status('Could not load data: ' + e.message, true); }
}

function collectUrlState() {
  return {
    region: $('region').value,
    from: $('from').value, to: $('to').value,
    dist: $('dist').value, hours: $('hours').value,
    sensor: sensorMode(),
    persistDays: $('persistDays').value, persistKm: $('persistKm').value,
    hidePersist: $('hidePersist').checked ? '1' : '',
  };
}
function applyUrlState(s) {
  if (s.region) $('region').value = s.region;
  if (s.from) $('from').value = s.from;
  if (s.to) $('to').value = s.to;
  if (s.dist) $('dist').value = s.dist;
  if (s.hours) $('hours').value = s.hours;
  if (s.sensor) { const r = document.querySelector(`[name=sensor][value="${s.sensor}"]`); if (r) r.checked = true; }
  if (s.persistDays) $('persistDays').value = s.persistDays;
  if (s.persistKm) $('persistKm').value = s.persistKm;
  if (s.hidePersist === '1') $('hidePersist').checked = true;
}

// ---- wiring
$('region').innerHTML = Object.keys(REGIONS).map(r => `<option>${r}</option>`).join('');
$('controls').addEventListener('submit', e => { e.preventDefault(); apply(); });
document.querySelectorAll('[name=sensor]').forEach(r => r.addEventListener('change', () => { if (DataStore.points.length) { view = filtered(); drawMap(); UrlState.write(collectUrlState()); } }));
$('hidePersist').addEventListener('change', () => { drawMap(); UrlState.write(collectUrlState()); });
['dist', 'hours'].forEach(id => $(id).addEventListener('input', () => { syncOut(); if (DataStore.points.length) { view = filtered(); drawMap(); } }));
['persistDays', 'persistKm'].forEach(id => $(id).addEventListener('input', () => {
  syncOut();
  if (DataStore.points.length) {
    view = filtered();
    Persistent.markPersistent(view.m.concat(view.v), { days: +$('persistDays').value, km: +$('persistKm').value });
    drawMap();
  }
}));
$('reset').addEventListener('click', () => setTimeout(() => {
  $('preset').value = '30'; setDates();
  $('persistDays').value = 3; $('persistKm').value = 1; $('hidePersist').checked = false;
  history.replaceState(null, '', location.pathname);
  apply();
}));
$('region').addEventListener('change', () => { const [s, w, n, e] = REGIONS[$('region').value]; map.fitBounds([[s, w], [n, e]]); });
$('csv').addEventListener('click', () => Exporter.exportPoints({ m: view.m, v: view.v, pairs: view.pairs, hidePersistent: $('hidePersist').checked }));
$('csvClusters').addEventListener('click', () => Exporter.exportClusters({ pairs: view.pairs, hidePersistent: $('hidePersist').checked }));

// init with URL state
const initState = UrlState.read();
if (Object.keys(initState).length) { applyUrlState(initState); }
apply().catch(e => status('Init failed: ' + e.message, true));
})();

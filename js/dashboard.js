// Dashboard page: metrics, charts, anomaly watch — and a "data loaded from
// FIRMS API" metric block. The interactive map lives on map.html now.
(() => {
'use strict';
const { C, REGIONS, DAY, iso, harmonize, DataStore } = window.Core;
const $ = id => document.getElementById(id);
let view = { m: [], v: [], pairs: [] }, charts = {};

// ---- UI helpers
const status = (t, err, busy) => { $('statusText').textContent = t; $('status').className = 'status' + (err ? ' err' : '') + (busy ? ' loading' : ''); };
$('region').innerHTML = Object.keys(REGIONS).map(r => `<option>${r}</option>`).join('');
const setDates = () => { const n = +$('preset').value; if (!n) return; $('to').value = iso(new Date()); $('from').value = iso(new Date(Date.now() - (n - 1) * DAY)); };
setDates();
$('preset').onchange = setDates;
$('from').onchange = $('to').onchange = () => $('preset').value = 'custom';

// ---- Filtering + stats
function filtered() {
  const [s, w, n, e] = REGIONS[$('region').value];
  const pts = DataStore.query({ bbox: [w, s, e, n], from: $('from').value, to: $('to').value });
  const m = pts.filter(p => p.s === 'M'), v = pts.filter(p => p.s === 'V');
  return { m, v, pairs: harmonize(m, v, +$('dist').value, +$('hours').value) };
}
const pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : 0;

// ---- Charts
const grid = 'rgba(11,23,54,.1)', tick = '#46557a';
Chart.defaults.color = tick; Chart.defaults.font.family = 'Inter, sans-serif';
const mk = (id, cfg) => { cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false }, cfg.options); return new Chart($(id), cfg); };
const axes = { x: { grid: { color: grid } }, y: { grid: { color: grid }, beginAtZero: true } };
charts.time = mk('cTime', { type: 'line', data: { labels: [], datasets: [] }, options: { scales: axes, interaction: { mode: 'index', intersect: false } } });
charts.conf = mk('cConf', { type: 'bar', data: { labels: ['0-19', '20-39', '40-59', '60-79', '80-100'], datasets: [] }, options: { scales: axes } });
charts.over = mk('cOver', { type: 'doughnut', data: { labels: ['MODIS only', 'VIIRS only', 'Both'], datasets: [{ data: [], backgroundColor: [C.M, C.V, C.B], borderColor: '#ffffff' }] } });

function rangeDays() {
  const out = []; let t = Date.parse($('from').value + 'T00:00:00Z'); const end = Date.parse($('to').value + 'T00:00:00Z');
  while (t <= end && out.length < 120) { out.push(iso(new Date(t))); t += DAY; } return out;
}
function anomalies(s) {
  const n = s.length, mean = s.reduce((a, b) => a + b, 0) / (n || 1), sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / (n || 1));
  const z = s.map(x => sd ? (x - mean) / sd : 0); return { mean, sd, z, ok: n >= 7, flag: z.map(v => n >= 7 && v >= 2) };
}
function unified() {
  const { m, v, pairs } = view, um = new Set(pairs.map(x => x.m)), uv = new Set(pairs.map(x => x.v));
  return [...pairs.map(x => ({ lat: (x.m.lat + x.v.lat) / 2, lon: (x.m.lon + x.v.lon) / 2, t: x.m.t })), ...m.filter(p => !um.has(p)), ...v.filter(p => !uv.has(p))];
}
function drawAnomalies(days, an) {
  const u = unified(), uni = days.map(d => 0); u.forEach(p => { const i = days.indexOf(iso(new Date(p.t))); if (i >= 0) uni[i]++; });
  const list = days.map((d, i) => an.flag[i] ? `${d} (${uni[i]} hot spots)` : null).filter(Boolean);
  $('anom').textContent = !an.ok ? 'Choose at least 7 days to check for anomalies' : list.length ? 'Anomalous days: ' + list.join(', ') : 'No anomalous days. Activity stays within the normal range for this period and region';
  const rows = Object.entries(REGIONS).filter(([k]) => k !== 'World').map(([name, [s, w, n, e]]) => {
    const pts = u.filter(p => p.lat >= s && p.lat <= n && p.lon >= w && p.lon <= e), ser = days.map(() => 0);
    pts.forEach(p => { const i = days.indexOf(iso(new Date(p.t))); if (i >= 0) ser[i]++; });
    const a = anomalies(ser), pk = ser.indexOf(Math.max(...ser)), alert = a.ok && a.flag[pk] && ser[pk] >= 5;
    return { name, total: pts.length, mean: a.mean, day: days[pk], peak: ser[pk], alert };
  }).filter(r => r.total).sort((a, b) => b.total - a.total).slice(0, 7);
  $('regions').innerHTML = rows.map(r => `<tr><th scope="row">${r.name}</th><td>${r.total}</td><td>${r.mean.toFixed(1)}</td><td>${r.day}</td><td>${r.peak}</td><td>${r.alert ? '<b style="color:#c6613f">Anomalously high</b>' : 'Normal'}</td></tr>`).join('') || '<tr><td colspan="6">No detections</td></tr>';
}

function syncOut() {
  $('distOut').textContent = (+$('dist').value) + ' km';
  $('hoursOut').textContent = $('hours').value + ' h';
  $('persistDaysOut').textContent = $('persistDays').value;
  $('persistKmOut').textContent = (+$('persistKm').value);
}

// ---- "Data loaded from FIRMS API" metric
function kb(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB'; }
function drawDataMeta() {
  const meta = DataStore.meta;
  if (!meta) { $('dataMeta').innerHTML = ''; return; }
  const cacheLabel = { full: 'yes — 0 API calls', partial: 'partial', none: 'no', 'n/a': '—' }[meta.cache] || meta.cache;
  const src = meta.demo ? 'Demo (synthetic)' : 'FIRMS API (live)';
  const rows = [
    [meta.count != null ? meta.count.toLocaleString() : '—', 'Detections in last load'],
    [meta.perSensor ? 'M ' + (meta.perSensor.MODIS || 0).toLocaleString() + ' · V ' + (meta.perSensor.VIIRS || 0).toLocaleString() : '—', 'MODIS · VIIRS split'],
    [meta.demo ? '—' : kb(meta.bytes || 0), 'Downloaded from FIRMS'],
    [meta.demo ? '—' : String(meta.apiCalls), 'API calls (last load)'],
    [meta.demo ? '—' : cacheLabel, 'Served from server cache'],
    [new Date(meta.fetchedAt).toLocaleString(), 'Last load time'],
  ];
  if (meta.downsampled) rows.push([meta.totalRaw.toLocaleString(), 'Total in FIRMS (evenly sampled to the shown count)']);
  if (meta.sources && !meta.demo) rows.push([Object.values(meta.sources).flat().join(', '), 'FIRMS products used']);
  $('dataMeta').innerHTML = rows.map(([a, b]) => `<div class="metric"><b>${a}</b><span>${b}</span></div>`).join('');
}

function drawStats() {
  const { m, v, pairs } = view, n = pairs.length, uniq = m.length + v.length - n, mo = m.length - n, vo = v.length - n;
  const inc = pct(uniq - m.length, m.length);
  const pctM = pct(n, m.length), pctV = pct(n, v.length);
  $('metrics').innerHTML = [
    [uniq, 'Total unique hot spots (harmonized)'],
    [pct(n, uniq) + '%', 'Seen by both sensors'],
    [mo, 'MODIS-only'],
    [vo, 'VIIRS-only'],
    [pctM + '%', '% of MODIS matched'],
    [pctV + '%', '% of VIIRS matched'],
    ['+' + inc + '%', 'Increase vs MODIS alone'],
  ].map(([a, b]) => `<div class="metric"><b>${a}</b><span>${b}</span></div>`).join('');

  $('summary').textContent = uniq ? `For the selected period and region, MODIS detected ${m.length} hot spots and VIIRS detected ${v.length}. ${n} were detected by both sensors. Harmonization revealed ${inc}% more unique fires than MODIS alone` : 'No detections match these filters. Widen the time range or choose another region';
  const day = t => iso(new Date(t)), days = rangeDays(), idx = new Map(days.map((d, i) => [d, i]));
  const count = arr => { const a = days.map(() => 0); arr.forEach(p => { const i = idx.get(day(p.t)); if (i !== undefined) a[i]++; }); return a; };
  const cm = count(m), cv = count(v), cn = count(pairs.map(x => x.m)), uni = cm.map((x, i) => x + cv[i] - cn[i]), an = anomalies(uni);
  const ds = (l, d, c) => ({ label: l, data: d, borderColor: c, backgroundColor: c, tension: .25, pointRadius: 2 });
  const hd = ds('Harmonized (unique)', uni, C.B); hd.pointRadius = uni.map((_, i) => an.flag[i] ? 7 : 2); hd.pointBackgroundColor = uni.map((_, i) => an.flag[i] ? '#141413' : C.B);
  Object.assign(charts.time.data, { labels: days, datasets: [ds('MODIS', cm, C.M), ds('VIIRS', cv, C.V), hd] }); charts.time.update();
  drawAnomalies(days, an);

  const bin = arr => { const b = [0, 0, 0, 0, 0]; arr.forEach(c => b[Math.min(4, Math.floor(c / 20))]++); return b; };
  charts.conf.data.datasets = [{ label: 'MODIS', data: bin(m.map(p => p.c)), backgroundColor: C.M }, { label: 'VIIRS', data: bin(v.map(p => p.c)), backgroundColor: C.V }]; charts.conf.update();
  charts.over.data.datasets[0].data = [mo, vo, n]; charts.over.update();
}

// ---- Apply
function regionBbox() { const [s, w, n, e] = REGIONS[$('region').value]; return [w, s, e, n]; }

async function apply() {
  syncOut();
  status('Loading…', false, true);
  try {
    await DataStore.ensure({ bbox: regionBbox(), from: $('from').value, to: $('to').value });
    view = filtered();
    Persistent.markPersistent(view.m.concat(view.v), {
      days: +$('persistDays').value || 3,
      km: +$('persistKm').value || 1,
    });
    drawStats(); drawDataMeta();
    const src = DataStore.demo ? 'demo data (synthetic)' : 'FIRMS data';
    status(`Showing ${view.m.length + view.v.length} detections · ${src}`);
    UrlState.write(collectUrlState());
  } catch (e) { status('Could not load data: ' + e.message, true); }
}

function collectUrlState() {
  const sr = document.querySelector('[name=sensor]:checked');
  return {
    region: $('region').value,
    from: $('from').value, to: $('to').value,
    dist: $('dist').value, hours: $('hours').value,
    sensor: sr ? sr.value : '',
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
$('controls').addEventListener('submit', e => { e.preventDefault(); apply(); });
['dist', 'hours'].forEach(id => $(id).addEventListener('input', () => { syncOut(); if (DataStore.points.length) { view = filtered(); drawStats(); } }));
$('reset').addEventListener('click', () => setTimeout(() => {
  $('preset').value = '30'; setDates();
  $('persistDays').value = 3; $('persistKm').value = 1; $('hidePersist').checked = false;
  history.replaceState(null, '', location.pathname);
  apply();
}));
$('csv').addEventListener('click', () => {
  Exporter.exportPoints({ m: view.m, v: view.v, pairs: view.pairs, hidePersistent: $('hidePersist').checked });
});
$('csvClusters').addEventListener('click', () => {
  Exporter.exportClusters({ pairs: view.pairs, hidePersistent: $('hidePersist').checked });
});
['persistDays', 'persistKm'].forEach(id => $(id).addEventListener('input', () => {
  syncOut();
  if (DataStore.points.length) { view = filtered();
    Persistent.markPersistent(view.m.concat(view.v), { days: +$('persistDays').value, km: +$('persistKm').value });
    drawStats(); }
}));
$('hidePersist').addEventListener('change', drawStats);

// ---- FIRMS API key field: shows current state, tests a new key against the
// live FIRMS service, applies it only if valid, reloads the data afterwards.
const keyStatus = (t, err, busy) => { $('keyStatus').textContent = t; $('keyStatus').className = 'status' + (err ? ' err' : '') + (busy ? ' loading' : ''); };
async function initKeyField() {
  try {
    const r = await fetch('/api/key');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    keyStatus(j.configured ? `Key configured (${j.masked})` : 'No key set — running on demo data', !j.configured);
  } catch {
    keyStatus('Key is managed by the hosting platform (set FIRMS_MAP_KEY in its env settings)', false);
    $('apiKey').disabled = true; $('apiKeyApply').disabled = true;
  }
}
async function applyKey() {
  const key = $('apiKey').value.trim();
  if (!key) { keyStatus('Paste a key first', true); return; }
  keyStatus('Testing key against FIRMS…', false, true);
  try {
    const r = await fetch('/api/key', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.ok) {
      keyStatus(`Key works — applied (${j.masked}). Reloading data…`);
      $('apiKey').value = '';
      DataStore.reset();
      await apply();
      keyStatus(`Key works — applied (${j.masked})`);
    } else {
      const code = j.status || r.status;
      keyStatus(`Not applied — ${j.error || 'key rejected'} (code ${code})`, true);
    }
  } catch (e) {
    keyStatus('Could not reach the local server: ' + e.message, true);
  }
}
$('apiKeyApply').addEventListener('click', applyKey);
$('apiKey').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyKey(); } });
initKeyField();

// init with URL state
const initState = UrlState.read();
if (Object.keys(initState).length) { applyUrlState(initState); }
apply().catch(e => status('Init failed: ' + e.message, true));
})();

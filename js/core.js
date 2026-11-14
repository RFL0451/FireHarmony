// Shared core for the Map and Dashboard pages:
// constants, geometry, harmonization, demo data and the range-aware data store.
(() => {
'use strict';
const C = { M: '#D55E00', V: '#0072B2', B: '#E69F00' };
const REGIONS = { World:[-90,-180,90,180], 'North America':[7,-170,72,-50], 'South America':[-56,-82,13,-34], Europe:[35,-25,72,45], Africa:[-35,-20,37,52], Asia:[-10,45,78,180], Oceania:[-50,110,0,180] };
const DAY = 864e5;
const iso = d => d.toISOString().slice(0, 10);

// ---- Geometry / harmonization
const hav = (a, b) => { const r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lon - a.lon) * r; const x = Math.sin(dl/2)**2 + Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)**2; return 12742 * Math.asin(Math.sqrt(x)); };
function harmonize(m, v, maxKm, maxH) {
  const G = .05, key = (la, lo) => Math.floor(la / G) + ':' + Math.floor(lo / G), grid = new Map();
  v.forEach(p => { const k = key(p.lat, p.lon); (grid.get(k) || grid.set(k, []).get(k)).push(p); });
  const used = new Set(), pairs = [];
  m.forEach(a => { let best, bd = 1e9; const gi = Math.floor(a.lat / G), gj = Math.floor(a.lon / G);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const b of grid.get((gi+i) + ':' + (gj+j)) || []) {
      if (used.has(b) || Math.abs(a.t - b.t) > maxH * 36e5) continue; const d = hav(a, b); if (d <= maxKm && d < bd) { bd = d; best = b; } }
    if (best) { used.add(best); pairs.push({ m: a, v: best }); } });
  return pairs;
}

// ---- Demo data (synthetic, used when the API is unreachable or empty)
function loadDemo() {
  const now = Date.now();
  return window.MOCK_FIRES.records.map(([s, lat, lon, d, bt, c]) => {
    const t = now - d * DAY;
    const hUTC = new Date(t).getUTCHours();
    return {
      s, lat, lon, t, bt, c,
      frp: +((Math.max(0, bt - 290) * 0.15) * (0.4 + c / 100)).toFixed(2),
      sat: s === 'M' ? (d % 2 < 1 ? 'Terra' : 'Aqua') : (d % 2 < 1 ? 'NPP' : 'NOAA-20'),
      inst: s === 'M' ? 'MODIS' : 'VIIRS',
      dn: hUTC >= 6 && hUTC < 18 ? 'D' : 'N',
      persistent: false,
    };
  });
}

// ---- Range-aware data store.
// Keeps everything ever loaded plus the covered {bbox, from, to} extent.
// A request fully inside the loaded extent makes NO network call — so switching
// "last 30 days" to "last 7 days" (same region) is served from memory, and the
// server additionally serves it from its chunk cache if a fetch does happen.
const DataStore = {
  points: [],
  extent: null,                 // { bboxKey, from, to }
  demo: false,
  meta: null,                   // last load info for the dashboard "data loaded" metric
  _loads: [],                   // history of load events (API or cache)

  /** Forget everything (e.g. after a new FIRMS key was applied). */
  reset() { this.points = []; this.extent = null; this.demo = false; this.meta = null; this._loads = []; },

  _covered(bboxKey, fromMs, toMs) {
    const e = this.extent;
    return !!(e && e.bboxKey === bboxKey && fromMs >= e.from && toMs <= e.to);
  },

  /**
   * Make sure data for bbox/from/to is available.
   * from/to: 'YYYY-MM-DD'. Returns { fresh: boolean } — fresh=true if a network fetch happened.
   */
  async ensure({ bbox, from, to, sensors = ['MODIS', 'VIIRS'] }) {
    const fromMs = Date.parse(from + 'T00:00:00Z'), toMs = Date.parse(to + 'T23:59:59Z');
    const bboxKey = bbox.join(',');
    if (this._covered(bboxKey, fromMs, toMs)) return { fresh: false };

    const cfg = window.APP_CONFIG || {};
    if (cfg.apiUrl) {
      try {
        const r = await API.getHotspots({ bbox, from, to, sensors });
        if (r && r.hotspots) {
          if (!this.extent || this.extent.bboxKey !== bboxKey) { this.points = []; this.extent = null; }
          const seen = new Set(this.points.map(p => p.s + '|' + p.t + '|' + p.lat + '|' + p.lon));
          r.hotspots.forEach(p => { const k = p.s + '|' + p.t + '|' + p.lat + '|' + p.lon; if (!seen.has(k)) { seen.add(k); this.points.push(p); } });
          const e = this.extent;
          this.extent = e
            ? { bboxKey, from: Math.min(e.from, fromMs), to: Math.max(e.to, toMs) }
            : { bboxKey, from: fromMs, to: toMs };
          this.demo = false;
          this.meta = Object.assign({}, r.meta, { demo: false });
          this._loads.push({ at: Date.now(), from, to, meta: r.meta });
          return { fresh: true };
        }
      } catch (err) {
        this._lastError = err;
        /* fall through to demo if we have nothing */
      }
    }
    if (!this.points.length) {
      this.points = loadDemo();
      this.extent = { bboxKey: '-180,-90,180,90', from: Date.now() - 31 * DAY, to: Date.now() };
      this.demo = true;
      const per = { MODIS: 0, VIIRS: 0 };
      this.points.forEach(p => per[p.s === 'M' ? 'MODIS' : 'VIIRS']++);
      this.meta = { source: 'demo', demo: true, count: this.points.length, perSensor: per, bytes: 0, apiCalls: 0, cache: 'n/a', fetchedAt: new Date().toISOString() };
      this._loads.push({ at: Date.now(), from, to, meta: this.meta });
      return { fresh: true };
    }
    return { fresh: false };
  },

  /** Points within the given date range and bbox. */
  query({ bbox, from, to }) {
    const fromMs = Date.parse(from + 'T00:00:00Z'), toMs = Date.parse(to + 'T23:59:59Z');
    const [w, s, e, n] = bbox;
    return this.points.filter(p => p.t >= fromMs && p.t <= toMs && p.lat >= s && p.lat <= n && p.lon >= w && p.lon <= e);
  },
};

window.Core = { C, REGIONS, DAY, iso, hav, harmonize, loadDemo, DataStore };
})();

import dotenv from 'dotenv';
import fs from 'node:fs';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchFirmsRange } from './firms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// load .env from the server folder regardless of where node was started from
dotenv.config({ path: path.join(__dirname, '.env') });
const app = express();
const cliPort = (process.argv.find(a => a.startsWith('--port=')) || '').split('=')[1];
const PORT = process.env.PORT || cliPort || 3000;

// CORS для локальной разработки фронтенда
app.use((req, res, next) => { res.setHeader('Access-Control-Allow-Origin', '*'); next(); });
app.use(express.json());

// ---- FIRMS API key management (local server only; on Netlify the key is an env var)
const ENV_PATH = path.join(__dirname, '.env');
const maskKey = k => (k && k.length > 8) ? k.slice(0, 6) + '…' + k.slice(-2) : '(set)';

app.get('/api/key', (req, res) => {
  const k = process.env.FIRMS_MAP_KEY || '';
  res.json({ configured: !!k, masked: k ? maskKey(k) : null });
});

app.post('/api/key', async (req, res) => {
  try {
    const key = String((req.body || {}).key || '').trim();
    if (!key) return res.status(400).json({ ok: false, status: 400, error: 'empty key' });
    // cheap real test: the data-availability table answers 401 for bad keys
    const r = await fetch(`https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/${key}/all`);
    if (!r.ok) {
      const detail = (await r.text()).trim().slice(0, 120);
      return res.status(400).json({ ok: false, status: r.status, error: detail || `FIRMS HTTP ${r.status}` });
    }
    const text = await r.text();
    if (!text.includes('data_id')) {
      return res.status(400).json({ ok: false, status: 200, error: 'unexpected FIRMS response — key not applied' });
    }
    process.env.FIRMS_MAP_KEY = key;
    // persist to server/.env (create or replace the FIRMS_MAP_KEY line)
    let env = '';
    try { env = fs.readFileSync(ENV_PATH, 'utf8'); } catch { /* no .env yet */ }
    if (/^FIRMS_MAP_KEY=.*$/m.test(env)) env = env.replace(/^FIRMS_MAP_KEY=.*$/m, 'FIRMS_MAP_KEY=' + key);
    else env = env.replace(/\s*$/, '') + '\nFIRMS_MAP_KEY=' + key + '\n';
    if (!/^PORT=/m.test(env)) env += 'PORT=3000\n';
    fs.writeFileSync(ENV_PATH, env);
    res.json({ ok: true, masked: maskKey(key) });
  } catch (e) {
    console.error('[key]', e.message);
    res.status(502).json({ ok: false, status: 502, error: e.message });
  }
});

app.get('/api/hotspots', async (req, res) => {
  try {
    const { bbox, dateFrom, dateTo, sensors = 'MODIS,VIIRS' } = req.query;
    if (!bbox || !dateFrom || !dateTo) return res.status(400).json({ error: 'bbox, dateFrom, dateTo required' });
    const [w, s, e, n] = bbox.split(',').map(Number);
    if ([w, s, e, n].some(x => !Number.isFinite(x))) return res.status(400).json({ error: 'bad bbox' });

    const valid = ['MODIS', 'VIIRS'];
    const list = String(sensors).split(',').map(x => x.trim().toUpperCase()).filter(x => valid.includes(x));
    if (!list.length) return res.status(400).json({ error: 'no valid sensors' });

    let hotspots = [];
    const meta = {
      source: 'FIRMS',
      fetchedAt: new Date().toISOString(),
      apiCalls: 0, cacheHits: 0, bytes: 0, chunks: 0,
      perSensor: {}, sources: {},
    };
    for (const sensor of list) {
      const { records, meta: m } = await fetchFirmsRange({
        sensor, bbox: [w, s, e, n], dateFrom, dateTo,
      });
      meta.apiCalls += m.apiCalls; meta.cacheHits += m.cacheHits;
      meta.bytes += m.bytes; meta.chunks += m.chunks;
      meta.perSensor[sensor] = records.length;
      meta.sources[sensor] = m.sources;
      hotspots = hotspots.concat(records);
    }
    const fromMs = Date.parse(dateFrom), toMs = Date.parse(dateTo) + 86399999;
    hotspots = hotspots.filter(p => p.t >= fromMs && p.t <= toMs);

    // A full month of world-wide data is ~2M detections / ~300 MB — too much
    // for any browser. Above the cap we keep an even stride sample (sorted by
    // time) and say so in meta, so the client can tell the user.
    const MAX_RETURN = 60000;
    meta.totalRaw = hotspots.length;
    if (hotspots.length > MAX_RETURN) {
      const step = hotspots.length / MAX_RETURN, sampled = [];
      hotspots.sort((a, b) => a.t - b.t);
      for (let i = 0; i < MAX_RETURN; i++) sampled.push(hotspots[Math.floor(i * step)]);
      hotspots = sampled;
      meta.downsampled = true;
    }

    const days = new Map();
    hotspots.forEach(p => {
      const d = new Date(p.t).toISOString().slice(0, 10);
      const cur = days.get(d) || { date: d, count: 0, sumFrp: 0 };
      cur.count++; cur.sumFrp += p.frp || 0;
      days.set(d, cur);
    });
    const timeline = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));

    meta.count = hotspots.length;
    // cache: 'full' = no API calls at all, 'partial' = some chunks cached, 'none' = all fetched
    meta.cache = meta.apiCalls === 0 ? 'full' : (meta.cacheHits ? 'partial' : 'none');
    res.json({ meta, hotspots, timeline });
  } catch (e) {
    console.error('[hotspots]', e.message);
    res.status(502).json({ error: e.message });
  }
});

app.use(express.static(path.join(__dirname, '..'), {
  index: 'index.html',
  dotfiles: 'deny',        // не отдавать .env и прочие dotfiles
}));

app.listen(PORT, () => console.log(`App + API on http://localhost:${PORT}`));

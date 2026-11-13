#!/usr/bin/env bash
# Repo ildizidagi eng oxirgi yuklangan .zip ni ochadi va dist/ papkaga sayt sifatida qo'yadi.
# Bu faylga tegmang.
set -euo pipefail
shopt -s nullglob

# 1) Eng yangi zipni topish (git'ga oxirgi yuklangan vaqti bo'yicha)
newest=""; newest_t=-1
for f in *.zip; do
  t=$(git log -1 --format=%ct -- "$f" 2>/dev/null || true)
  t=${t:-0}
  if [ "$t" -ge "$newest_t" ]; then newest_t=$t; newest=$f; fi
done
if [ -z "$newest" ]; then
  echo "XATO: repo ildizida .zip fayl topilmadi. GitLab'ga zip yuklang."; exit 1
fi
echo ">>> Ishlatilayotgan zip: $newest"

# 2) Zipni ochish
rm -rf _unzipped dist
mkdir _unzipped
unzip -q -o "$newest" -d _unzipped -x '__MACOSX/*' 2>/dev/null \
  || python3 -m zipfile -e "$newest" _unzipped
rm -rf _unzipped/__MACOSX

# 3) index.html turgan papkani topish (zip ichida papka bo'lsa ham, bo'lmasa ham ishlaydi)
index=$(find _unzipped -name index.html -not -path '*/node_modules/*' -not -path '*/.git/*' -printf '%d\t%p\n' | sort -n | head -1 | cut -f2-)
if [ -z "$index" ]; then
  echo "XATO: zip ichida index.html topilmadi."; exit 1
fi
root=$(dirname "$index")
echo ">>> Sayt ildizi: $root"

# 4) Faqat sayt fayllarini dist/ ga ko'chirish (server kodi va kalitlar public bo'lmaydi)
mkdir dist
cp -R "$root"/. dist/
rm -rf dist/server dist/.git dist/node_modules dist/netlify
find dist -name '.env*' -delete
find dist -name '*.env' -delete
find dist -name '.DS_Store' -delete

# 5) /api/hotspots uchun Netlify Function yaratish (NASA FIRMS'dan jonli ma'lumot)
mkdir -p netlify/functions
cat > netlify/functions/hotspots.mjs <<'FUNC'
const BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
const SOURCES = { MODIS: 'MODIS_NRT', VIIRS: 'VIIRS_SNPP_NRT' };
const json = (body, status = 200) => Response.json(body, { status });

async function fetchFirms({ source, bbox, dateFrom, dateTo }) {
  const KEY = process.env.FIRMS_MAP_KEY;
  if (!KEY) throw new Error('FIRMS_MAP_KEY is not set');
  const days = Math.min(10, Math.max(1,
    Math.ceil((Date.parse(dateTo) - Date.parse(dateFrom)) / 864e5) + 1));
  const res = await fetch(`${BASE}/${KEY}/${source}/${bbox.join(',')}/${days}`);
  if (!res.ok) throw new Error(`FIRMS ${res.status}`);
  const text = await res.text();
  if (text.startsWith('<')) throw new Error('FIRMS returned HTML — bad key or bbox too large');
  return text;
}

function normalize(csv, sensor) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const head = lines[0].split(',').map(s => s.trim().toLowerCase());
  const idx = n => head.indexOf(n);
  const iLat = idx('latitude'), iLon = idx('longitude');
  const iDate = idx('acq_date'), iTime = idx('acq_time');
  const iConf = idx('confidence'), iFrp = idx('frp');
  const iSat = idx('satellite'), iDn = idx('daynight');
  const iBt = head.includes('bright_ti4') ? idx('bright_ti4') : idx('brightness');
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (c.length < head.length) continue;
    const acqTime = String(c[iTime] || '0000').padStart(4, '0');
    const t = Date.parse(`${c[iDate]}T${acqTime.slice(0, 2)}:${acqTime.slice(2)}:00Z`);
    if (!Number.isFinite(t)) continue;
    let conf = c[iConf];
    if (sensor === 'VIIRS') conf = ({ l: 20, n: 60, h: 90 })[String(conf).toLowerCase()] ?? Number(conf);
    out.push({
      s: sensor === 'MODIS' ? 'M' : 'V',
      lat: +c[iLat], lon: +c[iLon], t,
      bt: +(c[iBt] || 0), c: +conf || 0, frp: +(c[iFrp] || 0),
      sat: c[iSat] || sensor, inst: sensor, dn: c[iDn] || 'D', persistent: false,
    });
  }
  return out;
}

export default async (req) => {
  try {
    const q = new URL(req.url).searchParams;
    const bbox = q.get('bbox'), dateFrom = q.get('dateFrom'), dateTo = q.get('dateTo');
    const sensors = q.get('sensors') || 'MODIS,VIIRS';
    if (!bbox || !dateFrom || !dateTo) return json({ error: 'bbox, dateFrom, dateTo required' }, 400);
    const box = bbox.split(',').map(Number);
    if (box.length !== 4 || box.some(x => !Number.isFinite(x))) return json({ error: 'bad bbox' }, 400);
    const list = sensors.split(',').map(x => x.trim().toUpperCase()).filter(x => SOURCES[x]);
    if (!list.length) return json({ error: 'no valid sensors' }, 400);

    const parts = await Promise.all(list.map(async sensor =>
      normalize(await fetchFirms({ source: SOURCES[sensor], bbox: box, dateFrom, dateTo }), sensor)));
    const fromMs = Date.parse(dateFrom), toMs = Date.parse(dateTo) + 86399999;
    const hotspots = parts.flat().filter(p => p.t >= fromMs && p.t <= toMs);

    const days = new Map();
    for (const p of hotspots) {
      const d = new Date(p.t).toISOString().slice(0, 10);
      const cur = days.get(d) || { date: d, count: 0, sumFrp: 0 };
      cur.count++; cur.sumFrp += p.frp || 0;
      days.set(d, cur);
    }
    const timeline = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
    return json({ meta: { count: hotspots.length, source: 'FIRMS' }, hotspots, timeline });
  } catch (e) {
    console.error('[hotspots]', e.message);
    return json({ error: e.message }, 502);
  }
};

export const config = { path: '/api/hotspots' };
FUNC

echo ">>> Tayyor. dist/ ichida:"; ls dist

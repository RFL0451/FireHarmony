// FIRMS area API client with calendar-aligned chunk caching and
// availability-aware source selection.
//
// Fixes vs the old version:
//  1. The request URL now carries an explicit start date
//     (.../area/csv/KEY/SOURCE/bbox/DAY_RANGE/YYYY-MM-DD). Without it FIRMS
//     always returns "the most recent N days" and silently ignores the
//     requested range.
//  2. Long ranges are split into 5-day chunks. FIRMS allows day_range up to
//     10, but only up to 5 for very large bboxes (e.g. the whole world) —
//     asking for 10 there returns HTTP 400.
//  3. Chunk boundaries are aligned to fixed 5-day blocks counted from the
//     epoch, so ANY requested range decomposes into the same cached chunks.
//     Asking for "last 30 days" and then "last 7 days" reuses the cached
//     chunks and makes ZERO new API calls.
//  4. Sources are chosen per chunk against the FIRMS data-availability table:
//     e.g. VIIRS_SNPP_NRT stopped updating on 2026-11-02, so newer chunks
//     automatically fall back to VIIRS_NOAA20_NRT, and older-than-NRT history
//     falls back to the standard-processing (SP) products.
import { cache } from './cache.js';
import { normalize } from './normalize.js';

// read lazily: index.js loads .env after this module is evaluated
const KEY = () => process.env.FIRMS_MAP_KEY;
const BASE = 'https://firms.modaps.eosdis.nasa.gov/api';
const DAY = 864e5;
const CHUNK_DAYS = 5;                    // safe for every bbox size, incl. whole world
const CHUNK = CHUNK_DAYS * DAY;
const MAX_CHUNKS_PER_REQUEST = 26;       // ~130 days of data per request, abuse guard
const TTL_RECENT = 10 * 60 * 1000;       // NRT data for "today" keeps changing
const TTL_HISTORIC = 24 * 3600 * 1000;   // historic chunks never change

// Preferred source order per sensor. First product whose published
// [min_date, max_date] covers the chunk wins.
const CANDIDATES = {
  MODIS: ['MODIS_NRT', 'MODIS_SP'],
  VIIRS: ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'VIIRS_SNPP_SP'],
};

const isoDay = ms => new Date(ms).toISOString().slice(0, 10);

// ---- data availability (refreshed every 6 h)
let avail = null, availAt = 0;
async function availability() {
  if (avail && Date.now() - availAt < 6 * 3600e3) return avail;
  const res = await fetch(`${BASE}/data_availability/csv/${KEY()}/all`);
  if (!res.ok) throw new Error(`FIRMS availability HTTP ${res.status}`);
  const text = await res.text();
  const map = {};
  text.trim().split(/\r?\n/).slice(1).forEach(line => {
    const [id, min, max] = line.split(',');
    if (id) map[id] = { min: Date.parse(min + 'T00:00:00Z'), max: Date.parse(max + 'T23:59:59Z') };
  });
  avail = map; availAt = Date.now();
  return avail;
}

function pickSource(sensor, chunkStartMs, table) {
  // overlap test, not midpoint: a chunk whose tail extends past a product's
  // max_date (e.g. today, mid-way through a 5-day block) must still be fetched
  const chunkEnd = chunkStartMs + CHUNK;
  for (const id of CANDIDATES[sensor] || []) {
    const a = table[id];
    if (a && chunkStartMs <= a.max && chunkEnd > a.min) return id;
  }
  return null;                         // no product covers this chunk
}

async function fetchChunk({ source, bbox, chunkStartMs }) {
  const url = `${BASE}/area/csv/${KEY()}/${source}/${bbox.join(',')}/${CHUNK_DAYS}/${isoDay(chunkStartMs)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FIRMS HTTP ${res.status} for ${source} ${isoDay(chunkStartMs)}`);
  const text = await res.text();
  if (text.startsWith('<')) throw new Error('FIRMS returned HTML — bad key or bbox too large');
  return text;
}

/**
 * Fetch normalized FIRMS records for [dateFrom, dateTo] (inclusive, UTC dates).
 * Returns { records, meta } where meta describes how much was downloaded.
 */
export async function fetchFirmsRange({ sensor, bbox, dateFrom, dateTo }) {
  if (!KEY()) throw new Error('FIRMS_MAP_KEY is not set');
  const fromMs = Date.parse(dateFrom + 'T00:00:00Z');
  const toMs = Date.parse(dateTo + 'T23:59:59Z');
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) throw new Error('bad dates');
  if (toMs < fromMs) throw new Error('dateTo before dateFrom');

  const i0 = Math.floor(fromMs / CHUNK), i1 = Math.floor(Math.min(toMs, Date.now()) / CHUNK);
  if (i1 - i0 + 1 > MAX_CHUNKS_PER_REQUEST) {
    throw new Error(`range too large: ${i1 - i0 + 1} chunks (max ${MAX_CHUNKS_PER_REQUEST})`);
  }
  const table = await availability();

  const records = [];
  const meta = { apiCalls: 0, cacheHits: 0, bytes: 0, chunks: 0, sources: [], skipped: 0 };
  for (let i = i0; i <= i1; i++) {
    const chunkStart = i * CHUNK;
    const source = pickSource(sensor, chunkStart, table);
    if (!source) { meta.skipped++; continue; }       // outside every product's coverage
    meta.chunks++;
    if (!meta.sources.includes(source)) meta.sources.push(source);
    const cacheKey = `${source}|${bbox.join(',')}|${i}`;
    let recs = cache.get(cacheKey);
    if (recs) {
      meta.cacheHits++;
    } else {
      const csv = await fetchChunk({ source, bbox, chunkStartMs: chunkStart });
      recs = normalize(csv, sensor);
      meta.apiCalls++;
      meta.bytes += csv.length;
      const ttl = (chunkStart + CHUNK) > Date.now() - DAY ? TTL_RECENT : TTL_HISTORIC;
      cache.set(cacheKey, recs, ttl);
    }
    for (const p of recs) if (p.t >= fromMs && p.t <= toMs) records.push(p);
  }
  return { records, meta };
}

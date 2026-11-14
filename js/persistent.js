(() => {
  'use strict';
  // Flag a detection as persistent when the same ~location (within `km`)
  // has hits on at least `days` distinct calendar days (UTC).
  function markPersistent(hotspots, { days = 3, km = 1 } = {}) {
    if (!hotspots || !hotspots.length) return hotspots;
    const bucketDeg = Math.max(km, 0.25) / 111;        // ~degrees per cell
    const key = (la, lo) => Math.floor(la / bucketDeg) + ':' + Math.floor(lo / bucketDeg);
    const dayCount = new Map();                          // bucket → Set<YYYY-MM-DD>
    const seen = new Map();                              // bucket → Set<dayKey> (for dedupe)
    hotspots.forEach(p => {
      const bk = key(p.lat, p.lon);
      const day = new Date(p.t).toISOString().slice(0, 10);
      if (!dayCount.has(bk)) dayCount.set(bk, new Set());
      dayCount.get(bk).add(day);
    });
    hotspots.forEach(p => {
      const bk = key(p.lat, p.lon);
      p.persistent = (dayCount.get(bk)?.size || 0) >= days;
    });
    return hotspots;
  }
  window.Persistent = { markPersistent };
})();
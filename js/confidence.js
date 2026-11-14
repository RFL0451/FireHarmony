(() => {
  'use strict';
  // Composite "fire likelihood" assessment for a single detection.
  // Combines the sensor's own confidence with what we know from the
  // harmonization pipeline (dual-sensor agreement, persistence, FRP).
  // Result is a 0-100 score plus a human-readable level.
  //
  // Inputs (point p): p.c = sensor confidence 0-100, p.frp = MW,
  // p.persistent = flagged by the static-source filter.
  // opts.matched = detection was seen by BOTH MODIS and VIIRS.
  function assess(p, { matched = false } = {}) {
    if (p.persistent) {
      return {
        score: 5, level: 'Static heat source', cls: 'static',
        note: 'Recurs at nearly the same place on many days — typical of gas flares, industrial sites or volcanoes, not a vegetation fire.',
      };
    }
    let score = Math.max(0, Math.min(100, +p.c || 0));
    const why = [];
    why.push(`sensor confidence ${Math.round(+p.c || 0)}/100`);
    if (matched) { score = Math.min(100, score + 15); why.push('seen by both sensors (+15)'); }
    if ((+p.frp || 0) >= 50) { score = Math.min(100, score + 5); why.push('high FRP (+5)'); }
    score = Math.round(score);
    const level = score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low';
    const cls = level.toLowerCase();
    const note = level === 'High'
      ? 'Very likely a real active fire.'
      : level === 'Medium'
        ? 'Probably a fire, but could be a small or short-lived heat source — worth cross-checking.'
        : 'Uncertain — low algorithm confidence; may be a false alarm, hot ground or a very small fire.';
    return { score, level, cls, note, why: why.join(' · ') };
  }
  window.Confidence = { assess };
})();

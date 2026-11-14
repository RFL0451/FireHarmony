(() => {
  'use strict';
  async function getHotspots({ bbox, from, to, sensors }) {
    const cfg = window.APP_CONFIG || {};
    if (!cfg.apiUrl) throw new Error('APP_CONFIG.apiUrl is empty');
    const qs = new URLSearchParams({
      bbox: bbox.join(','), dateFrom: from, dateTo: to,
      sensors: sensors.join(','),
    });
    const res = await fetch(cfg.apiUrl + '?' + qs.toString());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    return j;
  }
  window.API = { getHotspots };
})();
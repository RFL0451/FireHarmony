(() => {
  'use strict';
  const KEYS = ['region','from','to','dist','hours','sensor','persistDays','persistKm','hidePersist'];
  function read() {
    const q = new URLSearchParams(location.search), out = {};
    KEYS.forEach(k => { if (q.has(k)) out[k] = q.get(k); });
    return out;
  }
  function write(state) {
    const q = new URLSearchParams();
    KEYS.forEach(k => { const v = state[k]; if (v != null && v !== '') q.set(k, v); });
    const s = q.toString();
    history.replaceState(null, '', s ? '?' + s : location.pathname);
  }
  window.UrlState = { read, write };
})();
const store = new Map();
const MAX = 500;
export const cache = {
  get(k) {
    const e = store.get(k);
    if (!e) return null;
    if (e.exp < Date.now()) { store.delete(k); return null; }
    return e.v;
  },
  set(k, v, ttlMs = 10 * 60 * 1000) {
    if (store.size >= MAX) store.delete(store.keys().next().value);
    store.set(k, { v, exp: Date.now() + ttlMs });
  },
  stats() { return { entries: store.size }; },
};

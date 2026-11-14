(() => {
  const svg = document.getElementById('pxSvg'); if (!svg) return;
  const NS = 'http://www.w3.org/2000/svg', S = 120, KM = 3, T = 0.03;
  let fx = 1.45, fy = 1.55;
  const el = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); (p || svg).appendChild(e); return e; };
  const mk = size => { const n = Math.round(KM / size), a = []; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) a.push({ x: i * size, y: j * size, s: size }); return a; };
  const fire = el('circle', { fill: '#E69F00', 'fill-opacity': '.85', stroke: '#141413', 'stroke-width': 1.5 });
  const gV = el('g', {}), gM = el('g', {});
  const V = mk(.375), M = mk(1);
  V.forEach(c => c.e = el('rect', { x: c.x * S, y: c.y * S, width: c.s * S, height: c.s * S, fill: 'none', stroke: '#0072B2', 'stroke-width': 1 }, gV));
  M.forEach(c => c.e = el('rect', { x: c.x * S, y: c.y * S, width: c.s * S, height: c.s * S, fill: 'none', stroke: '#D55E00', 'stroke-width': 2.5 }, gM));
  const cover = (c, r) => { let k = 0; const n = 8; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const x = c.x + (i + .5) / n * c.s, y = c.y + (j + .5) / n * c.s; if ((x - fx) ** 2 + (y - fy) ** 2 <= r * r) k++; } return k / (n * n); };
  const $ = id => document.getElementById(id);
  function render() {
    const r = +$('pxR').value / 1000, mode = document.querySelector('[name=pxMode]:checked').value;
    $('pxROut').textContent = Math.round(r * 1000) + ' m';
    fire.setAttribute('cx', fx * S); fire.setAttribute('cy', fy * S); fire.setAttribute('r', r * S);
    let nm = 0, nv = 0;
    M.forEach(c => { const on = cover(c, r) >= T; if (on) nm++; c.e.setAttribute('fill', on ? 'rgba(213,94,0,.35)' : 'none'); });
    V.forEach(c => { const on = cover(c, r) >= T; if (on) nv++; c.e.setAttribute('fill', on ? 'rgba(0,114,178,.5)' : 'none'); });
    gM.style.display = mode === 'VIIRS' ? 'none' : ''; gV.style.display = mode === 'MODIS' ? 'none' : '';
    const t = `MODIS flags ${nm} of ${M.length} pixels, VIIRS flags ${nv} of ${V.length}`;
    $('pxRes').textContent = t; svg.setAttribute('aria-label', 'Fire of radius ' + Math.round(r * 1000) + ' m over MODIS and VIIRS pixel grids. ' + t);
  }
  const move = (x, y) => { fx = Math.min(KM, Math.max(0, x)); fy = Math.min(KM, Math.max(0, y)); render(); };
  svg.addEventListener('click', e => { const b = svg.getBoundingClientRect(); move((e.clientX - b.left) / b.width * KM, (e.clientY - b.top) / b.height * KM); });
  svg.addEventListener('keydown', e => { const d = { ArrowLeft: [-.125, 0], ArrowRight: [.125, 0], ArrowUp: [0, -.125], ArrowDown: [0, .125] }[e.key]; if (d) { e.preventDefault(); e.stopPropagation(); move(fx + d[0], fy + d[1]); } });
  $('pxR').addEventListener('input', render);
  document.querySelectorAll('[name=pxMode]').forEach(r => r.addEventListener('change', render));
  render();
})();

(() => {
  const slides = [...document.querySelectorAll('.slide')], n = slides.length;
  const bar = document.getElementById('bar'), cnt = document.getElementById('count'), prev = document.getElementById('prev'), next = document.getElementById('next'), dots = document.getElementById('dots');
  let cur = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  slides.forEach((s, i) => { const b = document.createElement('button'); b.setAttribute('aria-label', `Go to slide ${i + 1}: ${s.dataset.title}`); b.onclick = () => go(i); dots.appendChild(b); });
  function go(i) { i = Math.max(0, Math.min(n - 1, i)); slides[i].scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
  function show(i) { cur = i; cnt.textContent = `${i + 1} / ${n}`; bar.style.width = ((i + 1) / n * 100) + '%'; prev.disabled = i === 0; next.disabled = i === n - 1;
    [...dots.children].forEach((b, k) => b.setAttribute('aria-current', k === i)); }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) show(slides.indexOf(e.target)); }), { rootMargin: '-45% 0px -45% 0px' });
  slides.forEach(s => io.observe(s)); show(0);
  prev.onclick = () => go(cur - 1); next.onclick = () => go(cur + 1);
  addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey || /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName) && e.key === ' ') return;
    const k = e.key;
    if (['ArrowDown', 'ArrowRight', 'PageDown'].includes(k)) { e.preventDefault(); go(cur + 1); }
    else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(k)) { e.preventDefault(); go(cur - 1); }
    else if (k === 'f' || k === 'F') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); }
    else if (k === 'Home') { e.preventDefault(); go(0); } else if (k === 'End') { e.preventDefault(); go(n - 1); }
  });
})();

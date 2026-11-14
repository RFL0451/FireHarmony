// Positions the "?" tooltips with fixed coordinates so they are never clipped by the scrolling filter panel
// and never run off the edge of the screen. Without this script the CSS falls back to the old absolute layout.
(function () {
  document.documentElement.classList.add('tip-fixed');
  let active = null;
  function place(tip) {
    const btn = tip.querySelector('button'), box = tip.querySelector('[role=tooltip]');
    if (!btn || !box) return;
    const r = btn.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight, m = 8;
    const w = Math.min(250, vw - 2 * m);
    box.style.width = w + 'px';
    let left = Math.min(Math.max(r.left, m), vw - w - m);
    let top = r.bottom + 6;
    const h = box.offsetHeight;                       // tooltip is already displayed by :hover / :focus
    if (top + h > vh - m) top = Math.max(m, r.top - h - 6);   // not enough room below: open above the button
    box.style.setProperty('--tx', left + 'px');
    box.style.setProperty('--ty', top + 'px');
  }
  document.querySelectorAll('.tip').forEach(tip => {
    const on = () => { active = tip; place(tip); };
    const off = () => { if (active === tip) active = null; };
    tip.addEventListener('mouseenter', on);
    tip.addEventListener('focusin', on);
    tip.addEventListener('mouseleave', off);
    tip.addEventListener('focusout', off);
  });
  const refresh = () => { if (active) place(active); };
  window.addEventListener('scroll', refresh, { passive: true });
  window.addEventListener('resize', refresh);
  document.addEventListener('scroll', refresh, { passive: true, capture: true });   // also the panel's own scroll
})();

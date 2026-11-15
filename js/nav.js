// Mobile menu: the header links collapse into a "three bars" button on narrow screens (see css/styles.css).
(function () {
  const header = document.querySelector('header.nav');
  const btn = header && header.querySelector('.nav-toggle');
  if (!btn) return;
  const set = (open) => {
    header.classList.toggle('open', open);
    document.documentElement.classList.toggle('nav-open', open);   // lets the CSS hide the slide-progress bar under the menu
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
  };
  btn.addEventListener('click', () => set(!header.classList.contains('open')));
  header.querySelectorAll('nav a').forEach(a => a.addEventListener('click', () => set(false)));
  document.addEventListener('click', (e) => { if (!header.contains(e.target)) set(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('open')) { set(false); btn.focus(); }
  });
  // back to a wide screen: make sure the menu state is reset
  window.matchMedia('(min-width: 761px)').addEventListener('change', (e) => { if (e.matches) set(false); });
})();

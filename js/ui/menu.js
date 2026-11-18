// menu.js: the small menu in the top bar, for narrow windows and the mobile page.
//
// When the links don't fit in one row (under 640 px wide, or always on the mobile page), they fold
// into a panel below the bar and a "Menu" button opens and closes it. It works the same with a
// thumb, a mouse, a keyboard and a screen reader:
//  - the button says whether the menu is open (aria-expanded), so screen readers announce it,
//  - Escape closes it and puts focus back on the button,
//  - tapping a link, or anywhere outside the menu, closes it,
//  - while it's closed its links can't be reached with Tab (they're hidden, not just invisible).

export function initMenu() {
  const nav = document.getElementById('site-nav');
  const button = document.getElementById('menu-button');
  const panel = document.getElementById('site-links');
  if (!nav || !button || !panel || nav.dataset.menu) return;
  nav.dataset.menu = 'on';   // (only set up once, even if called twice)

  const mobilePage = document.documentElement.classList.contains('mobile-site');
  const narrow = window.matchMedia('(max-width: 640px)');

  function setOpen(open, { focusButton = false } = {}) {
    nav.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.querySelector('.site-nav__menu-label').textContent = open ? 'Close' : 'Menu';
    if (open) panel.querySelector('a')?.focus({ preventScroll: true });
    else if (focusButton) button.focus({ preventScroll: true });
  }

  // Folded (a menu) or in one row, depending on the space.
  function fit() {
    const folded = mobilePage || narrow.matches;
    nav.classList.toggle('has-menu', folded);
    if (!folded) setOpen(false);
  }
  narrow.addEventListener('change', fit);
  fit();

  button.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  // A link was chosen: close, and let the page move there.
  panel.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) setOpen(false, { focusButton: true });
  });
  // A tap anywhere outside the bar closes it.
  document.addEventListener('pointerdown', (e) => {
    if (nav.classList.contains('is-open') && !nav.contains(e.target)) setOpen(false);
  });
  // Tabbing out of the open menu closes it too.
  nav.addEventListener('focusout', (e) => {
    if (nav.classList.contains('is-open') && e.relatedTarget && !nav.contains(e.relatedTarget)) setOpen(false);
  });
}

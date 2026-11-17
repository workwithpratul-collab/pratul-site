// cursor.js: a subtle custom cursor. A small dot sits exactly at the pointer, and a thin
// ring follows a moment behind, opening up over links and buttons.
//
// Only for a real mouse or trackpad: on touch screens (no hovering pointer) nothing changes.
// The dot never lags (so aiming always feels precise); only the decorative ring eases.

export function createCursor() {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!fine.matches) return null;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Build the two pieces once and add them to the page.
  const el = document.createElement('div');
  el.className = 'cursor';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<div class="cursor__ring"></div><div class="cursor__dot"></div>';
  document.body.appendChild(el);
  const dot = el.querySelector('.cursor__dot');
  const ring = el.querySelector('.cursor__ring');
  document.documentElement.classList.add('has-cursor');

  const pointer = { x: -100, y: -100 };
  const ringPos = { x: -100, y: -100 };
  let moving = false;

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    dot.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
    if (!el.classList.contains('is-visible')) {
      // First move: put the ring straight under the pointer instead of flying in from a corner.
      ringPos.x = pointer.x;
      ringPos.y = pointer.y;
      el.classList.add('is-visible');
    }
    if (!moving) { moving = true; requestAnimationFrame(follow); }
  }, { passive: true });

  // Hide when the pointer leaves the window, show again when it comes back.
  document.documentElement.addEventListener('pointerleave', () => el.classList.remove('is-visible'));
  window.addEventListener('pointerdown', () => el.classList.add('is-down'));
  window.addEventListener('pointerup', () => el.classList.remove('is-down'));

  // Over anything clickable, the ring opens up.
  const clickable = 'a, button, [role="button"], label, summary, .btn';
  document.addEventListener('pointerover', (e) => {
    el.classList.toggle('is-link', !!e.target.closest?.(clickable));
  });

  // The ring eases towards the pointer each frame, and stops updating once it has caught up
  // (so the cursor costs nothing while the mouse is still).
  function follow() {
    const k = reduceMotion ? 1 : 0.2;
    ringPos.x += (pointer.x - ringPos.x) * k;
    ringPos.y += (pointer.y - ringPos.y) * k;
    ring.style.transform = `translate3d(${ringPos.x.toFixed(2)}px, ${ringPos.y.toFixed(2)}px, 0)`;
    if (Math.abs(pointer.x - ringPos.x) + Math.abs(pointer.y - ringPos.y) > 0.1) requestAnimationFrame(follow);
    else moving = false;
  }

  return el;
}

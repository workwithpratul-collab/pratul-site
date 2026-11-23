// tools.js: the Tools section, "the lanterns I carry" (references/round2/Tools.dc.html).
//
// A ribbon of tall cards drifting slowly and endlessly along the inside of a gentle curve.
// The technique is the King's Garden photo carousel's (F:/Kings-Garden/js/strip3d.js):
//   - the cards stand on a real cylinder in CSS 3D: each is turned by its angle (rotateY) and pushed
//     out by the radius (translateZ). King's Garden looks at its cylinder from outside, so its front
//     photo is nearest; here we stand inside it, so the cards at the edges are nearer, larger and
//     turned towards you, and the middle one sits back at its natural size;
//   - the speed is set in pixels per second at the front, so it feels the same on any screen, and a
//     long frame (a hitch) is clamped so the ribbon never jumps;
//   - the speed eases softly towards its target, so hovering glides it to a stop and leaving lets it
//     drift on again, instead of snapping;
//   - it rests while off screen (IntersectionObserver) and while the tab is hidden, and rebuilds only
//     when the window's width changes (a phone's address bar changes just the height).
// Two sets of the seven tools make one loop; each card wraps round once it is far out of sight.
// Only transforms change each frame, so the browser just moves layers it has already painted.
// Logos are only ever turned a little (well under 90 degrees), so they always face you, upright and
// never mirrored. Under "reduce motion" it is a still, flat row.

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPEED = 38;   // px per second at the front of the curve: a calm drift

export function initTools() {
  const root = document.querySelector('[data-ribbon]');
  if (!root) return;
  const track = root.querySelector('.ribbon__track');
  const pauseBtn = document.querySelector('[data-ribbon-pause]');
  const originals = [...track.children];
  if (reduceMotion) {
    root.classList.add('is-still');
    pauseBtn.closest('.ribbon__hint').hidden = true;
    return;
  }
  // The second set: copies, for the loop.
  for (const li of originals) track.appendChild(li.cloneNode(true));
  const cards = [...track.children];
  const n = cards.length;

  let radius = 1000, step = 0, limit = 0, angle = 0;
  function build() {
    const w = root.clientWidth;
    const card = cards[0].offsetWidth;
    const gap = Math.max(14, card * 0.12);
    // A wide, gentle curve: the radius follows the window, so the edge cards turn about 34 degrees
    // where they meet the faded edges, as in the mockup.
    radius = Math.max(w * 0.7, card * 3);
    // (the eye sits just inside the curve: close enough that the edge cards come clearly nearer)
    root.style.setProperty('--perspective', `${Math.round(radius * 0.9)}px`);
    step = (card + gap) / radius;                       // the angle between two cards (radians)
    limit = Math.min(Math.PI * 0.3, (n * step) / 2);    // past this angle a card is far off screen
    render();
  }

  const shown = new Array(n).fill(null);
  function render() {
    const span = n * step;
    for (let i = 0; i < n; i++) {
      // Each card's angle round the curve, wrapped into one loop centred on the front.
      let a = (i * step + angle) % span;
      if (a < 0) a += span;
      if (a > span / 2) a -= span;
      const visible = Math.abs(a) < limit;
      if (visible !== shown[i]) { shown[i] = visible; cards[i].classList.toggle('is-away', !visible); }
      if (!visible) continue;
      // Turned to its place on the curve, then pushed out to the curve (we stand inside it).
      cards[i].style.transform = `translateZ(${radius.toFixed(0)}px) rotateY(${(-a * 180 / Math.PI).toFixed(3)}deg) translateZ(${(-radius).toFixed(0)}px)`;
    }
  }

  // The drift: one step per frame, the speed easing towards 0 (paused) or 1 (drifting).
  let running = false, last = 0, speed = 1, want = 1, raf = 0;
  function tick(t) {
    raf = 0;
    if (!running) return;
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    speed += (want - speed) * (1 - Math.exp(-dt / 0.35));
    if (want === 0 && speed < 0.02) speed = 0;   // (the ease only nears zero: settle to a true stop)
    if (speed > 0.001) {
      angle -= (SPEED / radius) * speed * dt;   // right to left
      if (angle < -n * step) angle += n * step;
      render();
    }
    raf = requestAnimationFrame(tick);
  }
  let onScreen = false;
  const setRunning = () => {
    const go = onScreen && !document.hidden;
    if (go && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(tick); }
    else if (!go) { running = false; cancelAnimationFrame(raf); raf = 0; }
  };
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; setRunning(); }, { rootMargin: '10% 0px' }).observe(root);
  document.addEventListener('visibilitychange', setRunning);

  // Pausing: while the pointer is over it, or with the button (which keyboard and touch can use too).
  let hovering = false, held = false;
  const update = () => { want = hovering || held ? 0 : 1; };
  root.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hovering = true; update(); } });
  root.addEventListener('pointerleave', () => { hovering = false; update(); });
  pauseBtn.addEventListener('click', () => {
    held = !held;
    pauseBtn.setAttribute('aria-pressed', String(held));
    pauseBtn.querySelector('use').setAttribute('href', held ? '#i-play' : '#i-pause');
    pauseBtn.querySelector('.ribbon__pause-label').textContent = held ? 'Play the tools' : 'Pause the tools';
    update();
  });

  root.classList.add('is-live');
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    build();
  });
  build();
}

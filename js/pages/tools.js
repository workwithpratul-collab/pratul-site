// tools.js: the Tools section, "the lanterns I carry": one tool at a time in the light.
//
// The tool logos stand on a wide, tilted oval (an ellipse seen from slightly above). Every few
// seconds the loop glides one step, so the next tool comes round to the front: large, bright, and
// named, while the rest recede, smaller and dimmer, towards the back of the oval.
//
// Each logo is only ever moved and scaled (never turned), so it always faces you and is never
// mirrored. Only transform and opacity change, which the browser can do without repainting.
// It runs only while the section is on screen, pauses while the pointer or keyboard focus is on it,
// and under "reduce motion" the logos simply sit in a row.

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const HOLD = 2.4;   // seconds a tool rests in the light
const GLIDE = 1.2;  // seconds to glide to the next one

export function initTools() {
  const root = document.querySelector('[data-loop]');
  if (!root) return;
  const items = [...root.querySelectorAll('.loop__item')];
  const n = items.length;
  if (reduceMotion || n < 3) { root.classList.add('is-still'); return; }
  root.classList.add('is-live');

  // The oval's size follows the box it sits in (measured once, and again on resize).
  let rx = 0, ry = 0;
  const measure = () => {
    const w = root.clientWidth, h = root.clientHeight;
    rx = w * 0.42;   // half its width
    ry = h * 0.17;   // how far the back of the oval rises (the tilt)
  };
  measure();
  window.addEventListener('resize', () => { measure(); draw(); });

  // A smooth glide (slow start, slow finish), like a camera dolly.
  const glide = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

  let clock = 0;       // seconds of loop time (it stops while paused)
  let phase = 0;       // which tool is at the front, with a fraction while gliding
  let front = -1;
  function draw() {
    items.forEach((item, i) => {
      const a = ((i - phase) / n) * Math.PI * 2;
      const depth = (Math.cos(a) + 1) / 2;          // 1 at the front, 0 at the back
      const x = Math.sin(a) * rx;
      const y = -(1 - depth) * ry * 2 + ry * 0.4;   // the back of the oval sits higher
      const scale = 0.42 + 0.58 * Math.pow(depth, 1.6);
      item.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
      item.style.opacity = (0.26 + 0.74 * Math.pow(depth, 2)).toFixed(3);
      item.style.zIndex = String(Math.round(depth * 100));
    });
    const now = ((Math.round(phase) % n) + n) % n;
    if (now !== front) {
      front = now;
      items.forEach((item, i) => item.classList.toggle('is-front', i === front));
    }
  }

  let running = false, last = 0, paused = false, onScreen = false;
  function tick(t) {
    if (!running) return;
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    if (!paused) {
      clock += dt;
      const step = Math.floor(clock / (HOLD + GLIDE));
      const into = clock - step * (HOLD + GLIDE);
      phase = step + (into < HOLD ? 0 : glide((into - HOLD) / GLIDE));
      draw();
    }
    requestAnimationFrame(tick);
  }
  const setRunning = () => {
    const want = onScreen && !document.hidden;
    if (want && !running) { running = true; last = performance.now(); requestAnimationFrame(tick); }
    else if (!want) running = false;
  };
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; setRunning(); }, { rootMargin: '10% 0px' }).observe(root);
  document.addEventListener('visibilitychange', setRunning);

  // Pause while someone is looking closely (pointer over it, or keyboard focus inside it).
  const hold = (on) => { paused = on; root.classList.toggle('is-paused', on); };
  root.addEventListener('pointerenter', () => hold(true));
  root.addEventListener('pointerleave', () => hold(false));
  root.addEventListener('focusin', () => hold(true));
  root.addEventListener('focusout', () => hold(false));
  // A touch pauses it for a moment, then it carries on.
  let resume = 0;
  root.addEventListener('touchstart', () => { clearTimeout(resume); hold(true); resume = setTimeout(() => hold(false), 2600); }, { passive: true });

  draw();
}

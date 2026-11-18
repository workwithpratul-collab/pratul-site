// demos.js: the small live demos on the "What I can build" cards. Each one is plain JavaScript,
// and only starts when its card scrolls into view (and stops again when it leaves).

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Run `start` the first time an element comes into view; `onView(visible)` on every change.
function whenVisible(el, start, onView) {
  let started = false;
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !started) { started = true; start(); }
    onView?.(entry.isIntersecting);
  }, { rootMargin: '10% 0px' }).observe(el);
}

// ---------- 1. Cinematic websites: a tiny scroll film ----------
// As the card travels up the screen, each painted layer slides sideways at its own speed
// (near layers faster than far ones) and a small trekker walks along the front ridge.
function filmsDemo(el, lenis) {
  const layers = [...el.querySelectorAll('.demo-films__layer')].map((l) => ({ l, depth: Number(l.dataset.depth) }));
  const walker = el.querySelector('.demo-films__walker');
  let visible = false;
  function draw() {
    if (!visible) return;
    const r = el.getBoundingClientRect();
    // 0 when the card enters at the bottom of the screen, 1 when it leaves at the top.
    const t = Math.min(Math.max(1 - (r.top + r.height) / (window.innerHeight + r.height), 0), 1);
    for (const { l, depth } of layers) l.style.transform = `translate3d(${(-(t - 0.5) * 8 * depth).toFixed(2)}%, 0, 0)`;
    walker.style.transform = `translate3d(${(t * 2600).toFixed(0)}%, ${(Math.sin(t * 60) * 6).toFixed(1)}%, 0)`;
  }
  whenVisible(el, draw, (v) => { visible = v; draw(); });
  if (!reduceMotion) lenis.on('scroll', draw);
}

// ---------- 3. Design that converts: before / after slider ----------
// The real control is an invisible range input across the demo, so mouse, touch and the
// keyboard (arrow keys) all work; the visible handle just follows it.
function sliderDemo(el) {
  const range = el.querySelector('.demo-slider__range');
  const set = () => el.style.setProperty('--split', `${range.value}%`);
  range.addEventListener('input', set);
  set();
  // A gentle hint the first time it's seen: the line drifts to show both sides, then rests.
  whenVisible(el, () => {
    if (reduceMotion) return;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min((now - t0) / 2200, 1);
      if (range.dataset.touched) return;
      range.value = 50 + Math.sin(k * Math.PI * 2) * 22 * (1 - k);
      set();
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  range.addEventListener('pointerdown', () => { range.dataset.touched = '1'; });
  range.addEventListener('keydown', () => { range.dataset.touched = '1'; });
}

// ---------- 4. Online stores and booking: three calm steps ----------
function bookingDemo(el) {
  const steps = [...el.querySelectorAll('.demo-booking__step')];
  const marks = [...el.querySelectorAll('.demo-booking__steps li')];
  const summary = el.querySelector('#bk-summary');
  const picked = [];
  function show(i) {
    steps.forEach((s, k) => { s.hidden = k !== i; });
    marks.forEach((m, k) => m.classList.toggle('is-on', k <= Math.min(i, 2)));
    // Move keyboard focus to the new step's first button, so keyboard users follow along.
    steps[i].querySelector('button')?.focus({ preventScroll: true });
  }
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const i = steps.findIndex((s) => !s.hidden);
    if (b.dataset.pick) {
      picked[i] = b.dataset.pick;
      if (i === 1) summary.textContent = `${picked[0]}, ${picked[1]}`;
      show(i + 1);
    } else if (b.dataset.confirm !== undefined) {
      show(3);
    } else if (b.dataset.restart !== undefined) {
      picked.length = 0;
      show(0);
    }
  });
}

// ---------- 5. Found and fast: score rings that fill when they come into view ----------
function scoreDemo(el) {
  const rings = [...el.querySelectorAll('.demo-score__ring')].map((r) => ({
    score: Number(r.dataset.score), fill: r.querySelector('.demo-score__fill'), num: r.querySelector('.demo-score__num'),
  }));
  const LENGTH = 2 * Math.PI * 52;
  const setAt = (k) => rings.forEach((r) => {
    const v = r.score * k;
    r.fill.style.strokeDashoffset = (LENGTH * (1 - v / 100)).toFixed(1);
    r.num.textContent = Math.round(v);
  });
  whenVisible(el, () => {
    if (reduceMotion) return setAt(1);
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min((now - t0) / 1800, 1);
      setAt(1 - Math.pow(1 - t, 3));   // ease out: fast at first, settling gently
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

export function initDemos({ lenis }) {
  for (const el of document.querySelectorAll('[data-demo]')) {
    const kind = el.dataset.demo;
    if (kind === 'films') filmsDemo(el, lenis);
    else if (kind === 'slider') sliderDemo(el);
    else if (kind === 'booking') bookingDemo(el);
    else if (kind === 'score') scoreDemo(el);
    else if (kind === 'three') {
      // The 3D demo pulls in three.js scene code: load it only when its card is near.
      whenVisible(el, () => import('./lantern.js').then((m) => m.initLantern(el)));
    }
  }
}

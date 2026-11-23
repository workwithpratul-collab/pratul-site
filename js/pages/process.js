// process.js: the Process section, a night trail you walk by scrolling.
//
// The section is several screens tall; inside it, one screen-sized box sticks to the top of the
// window (css position: sticky) while you scroll through. Its "progress" (0 at the start, 1 at the
// end) is worked out from where the section is, once per frame while it's on screen, and sets:
//   - how much of the amber trail is drawn, and where its lantern is,
//   - how far each painted layer has drifted (the near slope more than the far peaks: depth),
//   - which stage is current (its words rise into the reading column).
// No animation library is needed, so phones get exactly the same moment as desktop.
// Under "reduce motion" the section is one ordinary screen: the trail drawn, every stage listed.

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Where along the trail (0..1) each of the five stages sits, and how much of the section's scroll
// comes before the first one (so the first stage is lit the moment you arrive).
const WAYPOINTS = [0.04, 0.27, 0.5, 0.73, 0.97];

export function initProcess() {
  const section = document.getElementById('process');
  if (!section) return;
  const stages = [...section.querySelectorAll('.process__stage')];
  const glow = section.querySelector('.trail-glow');
  const lantern = section.querySelector('.trail-lantern');
  const pointsG = section.querySelector('.trail-points');
  const layers = [...section.querySelectorAll('[data-depth]')].map((el) => ({ el, depth: Number(el.dataset.depth) }));

  // On a tall, narrow screen (a phone) the wide drawing would be cropped to its middle: frame the
  // trail itself instead, fitted to the width, so the whole climb is in view.
  const mid = section.querySelector('.process__layer--mid');
  const frameFor = () => {
    const tall = window.innerWidth / window.innerHeight < 0.8;
    mid.setAttribute('viewBox', tall ? '560 180 960 720' : '0 0 1600 900');
    mid.setAttribute('preserveAspectRatio', tall ? 'xMidYMax meet' : 'xMidYMax slice');
  };
  frameFor();
  window.addEventListener('resize', frameFor);

  // The waypoints: one small ring on the trail per stage, placed by measuring the path once.
  const len = glow.getTotalLength();
  const ns = 'http://www.w3.org/2000/svg';
  const points = WAYPOINTS.map((at) => {
    const pt = glow.getPointAtLength(at * len);
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', pt.x.toFixed(1));
    c.setAttribute('cy', pt.y.toFixed(1));
    c.setAttribute('r', '7');
    c.setAttribute('class', 'trail-point');
    pointsG.appendChild(c);
    return c;
  });

  let current = -1;
  function setStage(i) {
    if (i === current) return;
    current = i;
    stages.forEach((s, n) => {
      s.classList.toggle('is-current', n === i);
      s.classList.toggle('is-past', n < i);
    });
  }

  if (reduceMotion) {
    section.classList.add('is-still');
    glow.style.strokeDashoffset = '0';
    points.forEach((p) => p.classList.add('is-lit'));
    lantern.setAttribute('transform', placeAt(1));
    setStage(-1);
    return;
  }

  function placeAt(t) {
    const pt = glow.getPointAtLength(Math.min(Math.max(t, 0), 1) * len);
    return `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`;
  }

  let shown = -1;
  function update() {
    raf = 0;
    const r = section.getBoundingClientRect();
    const run = r.height - window.innerHeight;          // the scroll the sticky screen holds for
    const p = Math.min(Math.max(-r.top / run, 0), 1);
    if (Math.abs(p - shown) < 0.0005) return;
    shown = p;
    // The trail is drawn a touch ahead of the scroll, so the first stage is lit on arrival and the
    // pass is reached just before the section lets go.
    const t = Math.min(1, 0.04 + p * 0.97);
    glow.style.strokeDashoffset = (1 - t).toFixed(4);
    lantern.setAttribute('transform', placeAt(t));
    let at = 0;
    WAYPOINTS.forEach((w, i) => {
      const lit = t >= w - 0.005;
      points[i].classList.toggle('is-lit', lit);
      if (lit) at = i;
    });
    setStage(at);
    // Depth: each layer drifts up (and the far painting settles from a slight zoom) at its own
    // pace. transform only, so the browser just moves already-painted layers.
    for (const { el, depth } of layers) {
      const y = -(p - 0.5) * 70 * depth;
      const scale = depth < 0.5 ? 1.08 - p * 0.06 : 1;
      el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(4)})`;
    }
  }

  // Only while the section is (nearly) on screen: one read and a few writes per frame.
  let raf = 0, near = false;
  const ask = () => { if (near && !raf) raf = requestAnimationFrame(update); };
  new IntersectionObserver(([e]) => { near = e.isIntersecting; ask(); }, { rootMargin: '25% 0px' }).observe(section);
  window.addEventListener('scroll', ask, { passive: true });
  window.addEventListener('resize', () => { shown = -1; ask(); });
  // Start in place (the lantern at the trail's foot), before the first scroll.
  update();
}

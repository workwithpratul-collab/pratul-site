// process.js: the Process section, an evening trail you walk by scrolling
// (references/round2/Main.dc.html).
//
// The section is several screens tall; inside it, one screen-sized box sticks to the top of the
// window (css position: sticky) while you scroll through. Its "progress" (0 at the start, 1 at the
// end) sets:
//   - how much of the amber trail is drawn,
//   - which step is current (filled amber, "Step N of 5" and its full description), which are done
//     (an amber ring, the title and a short line) and which are still ahead (dim, title only),
//   - how far each painted layer has drifted (the near slope more than the far ridge: depth).
// Each step's words are positioned beside its own checkpoint, so they move with the trail.
//
// Desktop: GSAP's ScrollTrigger reports the progress (it already runs the page's smooth scroll), and
// the current step's words rise in with GSAP. Phones load no animation library: the same update runs
// from the browser's own scroll events, and CSS does the small reveal.
//
// Two layouts, chosen by the screen's shape:
//   wide (laptops)   a 16:9 box as large as fits the window; the checkpoints keep the mockup's places
//                    and each step's words sit on the side of its checkpoint away from the trail.
//   tall (phones)    the trail zig-zags up the left of the screen under the heading, and the words sit
//                    beside each checkpoint in one reading column on the right.

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SVG = 'http://www.w3.org/2000/svg';

export function initProcess({ core = null } = {}) {
  const section = document.getElementById('process');
  if (!section) return;
  const box = section.querySelector('[data-trail]');
  const svg = box.querySelector('.trail__svg');
  const base = svg.querySelector('.trail__base');
  const glow = svg.querySelector('.trail__glow');
  const head = section.querySelector('.process__head');
  const steps = [...box.querySelectorAll('.step')].map((el) => ({
    el,
    at: el.dataset.at.split(',').map(Number),   // its place in the wide layout (fractions of the box)
    label: el.querySelector('.step__label'),
  }));
  const layers = [...section.querySelectorAll('[data-depth]')].map((el) => ({ el, depth: Number(el.dataset.depth) }));

  // Which step is current is decided by the scroll alone: five equal stretches of the section. The
  // glow's head is drawn to arrive at each checkpoint exactly as its stretch begins, wherever the
  // checkpoints happen to be (on phones they move apart around the current step, see below).
  const STRETCH = [0, 0.2, 0.4, 0.6, 0.8];
  let marks = [];      // how far along the trail (0..1) each checkpoint sits
  let tall = false;
  let w = 0, h = 0, tallX = [];
  let ys = null;       // the checkpoints' heights on a tall screen (they glide when the step changes)
  let trailPoints = [];

  // ---------- Layout: the box, and where the checkpoints go ----------
  function layout() {
    tall = window.innerWidth <= 900 || window.innerWidth / window.innerHeight < 1.1;
    box.classList.toggle('is-tall', tall);
    if (tall) {
      // The trail fills the space under the heading.
      const top = head.getBoundingClientRect().bottom - section.querySelector('.process__pin').getBoundingClientRect().top + 24;
      const bottom = Math.max(28, window.innerHeight * 0.04);
      box.style.setProperty('--trail-top', `${top}px`);
      box.style.setProperty('--trail-h', `${Math.max(240, window.innerHeight - top - bottom)}px`);
    } else {
      box.style.removeProperty('--trail-top');
      box.style.removeProperty('--trail-h');
    }
    w = box.clientWidth;
    h = box.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    if (!tall) {
      place(steps.map((s) => [s.at[0] * w, s.at[1] * h]));
      return;
    }
    // Zig-zag up the left: the first step at the bottom, the last at the top, and one reading column
    // on the right that starts past the widest checkpoint.
    const left = Math.max(16, w * 0.05);
    tallX = steps.map((s, i) => left + 20 + [0.1, 0.24][i % 2] * Math.min(w, 430) * 0.6);
    const col = Math.max(...tallX) + 20 + 18;
    steps.forEach((s, i) => {
      s.el.style.setProperty('--col-x', `${col - tallX[i]}px`);
      s.el.style.setProperty('--col-w', `${w - col - left}px`);
    });
    ys = tallYs(Math.max(current, 0));
    place(steps.map((s, i) => [tallX[i], ys[i]]));
  }

  // Tall screens: the gaps either side of the current step open up to fit its full description;
  // the other gaps share what's left.
  function tallYs(cur) {
    const half = steps[cur].label.offsetHeight / 2;   // (the current step's label, centred on it)
    const n = steps.length;
    const lo = h - (cur === 0 ? half + 6 : 22);        // the first step (bottom)
    const hi = cur === n - 1 ? half + 6 : 22;          // the last step (top)
    const need = [];
    for (let j = 0; j < n - 1; j++) need[j] = j === cur || j + 1 === cur ? half + 30 : 46;
    const spare = (lo - hi) - need.reduce((a, b) => a + b, 0);
    const gaps = need.map((g) => Math.max(26, g + spare / (n - 1)));
    const out = [lo];
    for (let j = 0; j < n - 1; j++) out.push(out[j] - gaps[j]);
    return out;
  }

  // Put the checkpoints at these points, draw the trail through them, and (unless measure is false,
  // as on the frames of a phone's glide, whose end points were measured once at its start) measure
  // where each one falls along it.
  function place(pts, measure = true) {
    if (measure) {
      steps.forEach((s, i) => {
        s.el.style.setProperty('--x', (pts[i][0] / w).toFixed(4));
        s.el.style.setProperty('--y', (pts[i][1] / h).toFixed(4));
      });
    }
    // The trail rises into the first checkpoint from below, then passes smoothly through every one
    // (a Catmull-Rom curve, turned into the cubic curves SVG draws).
    const first = pts[0];
    const all = [tall ? [first[0], h + 40] : [first[0] - w * 0.08, h * 1.06], ...pts];
    const d = smoothPath(all);
    base.setAttribute('d', d);
    glow.setAttribute('d', d);
    if (!measure) { draw(); return; }
    const total = glow.getTotalLength();
    const probe = document.createElementNS(SVG, 'path');
    svg.appendChild(probe);
    marks = pts.map((p, i) => {
      probe.setAttribute('d', smoothPath(all, i + 1));
      return probe.getTotalLength() / total;
    });
    probe.remove();
    // Points along the trail, for keeping the labels clear of it (measured once per layout, not on
    // every step change: sampling a path is slow enough to cost a frame).
    if (!tall) {
      trailPoints = [];
      for (let k = 0; k <= 160; k++) { const q = glow.getPointAtLength((total * k) / 160); trailPoints.push([q.x, q.y]); }
    }
    draw();
    if (!tall) nudge();
  }

  // Desktop: keep every label clear of the line and of its neighbours. Each label is measured
  // against points along the real trail and moved off it if it comes within 14 px: labels on the
  // right of their checkpoint move down (the trail climbs away above them), labels on the left move
  // up. Then, from the top down, a label that would touch the one above it moves down.
  const CLEAR = 14;
  function nudge() {
    const trail = trailPoints;
    // Where a label's visible words sit in the box, from layout positions (offsetLeft/Top ignore
    // transforms, so a slide still in progress can't fool the measurement). The hidden-from-sight
    // lines are 1 px boxes and are skipped.
    const rect = (s) => {
      const x0 = s.el.offsetLeft + s.label.offsetLeft, y0 = s.el.offsetTop + s.label.offsetTop;
      const kids = [...s.label.children].filter((k) => k.offsetWidth > 1);
      return {
        l: x0 + Math.min(...kids.map((k) => k.offsetLeft)),
        r: x0 + Math.max(...kids.map((k) => k.offsetLeft + k.offsetWidth)),
        t: y0 + Math.min(...kids.map((k) => k.offsetTop)) + shift[steps.indexOf(s)],
        b: y0 + Math.max(...kids.map((k) => k.offsetTop + k.offsetHeight)) + shift[steps.indexOf(s)],
      };
    };
    const shift = steps.map(() => 0);
    steps.forEach((s, i) => {
      const r = rect(s);
      const right = s.el.dataset.side === 'right';
      let dy = 0;
      for (const [x, y] of trail) {
        if (x < r.l - CLEAR || x > r.r + CLEAR || y < r.t - CLEAR || y > r.b + CLEAR) continue;
        dy = right ? Math.max(dy, y + CLEAR - r.t) : Math.min(dy, y - CLEAR - r.b);
      }
      shift[i] = dy;
    });
    for (let i = steps.length - 2; i >= 0; i--) {
      const lower = rect(steps[i]), upper = rect(steps[i + 1]);
      const overlapX = lower.l < upper.r + CLEAR && lower.r > upper.l - CLEAR;
      if (overlapX && lower.t < upper.b + CLEAR) shift[i] += upper.b + CLEAR - lower.t;
    }
    steps.forEach((s, i) => s.label.style.setProperty('--nudge', `${shift[i].toFixed(1)}px`));
  }

  // ---------- State: which step is current, done, or still ahead ----------
  let current = -1;
  let glide = 0;
  function setCurrent(i) {
    if (i === current) return;
    const before = current;
    current = i;
    steps.forEach((s, n) => {
      s.el.classList.toggle('is-current', n === i);
      s.el.classList.toggle('is-done', n < i);
    });
    if (!tall && marks.length) nudge();   // (the labels changed size)
    // Phones: the checkpoints glide apart around the new current step (and the trail with them).
    if (tall && ys) {
      const from = ys.slice(), to = tallYs(i);
      cancelAnimationFrame(glide);
      if (reduceMotion) { ys = to; place(steps.map((s, k) => [tallX[k], ys[k]])); }
      else {
        // The checkpoints and their words go to their new places at once, then a transform carries
        // them there from where they were (CSS, on the compositor: nothing is laid out or repainted
        // per frame). The trail was measured once, as it will be at the end; each frame only
        // redraws the thin line, on the same ease-out curve as the CSS.
        place(steps.map((s, n) => [tallX[n], to[n]]));
        steps.forEach((s, n) => { s.el.style.transition = 'none'; s.el.style.transform = `translate3d(0, ${(from[n] - to[n]).toFixed(1)}px, 0)`; });
        void box.offsetWidth;   // (apply the starting offset before the transition begins)
        steps.forEach((s) => { s.el.style.transition = ''; s.el.style.transform = ''; });
        place(steps.map((s, n) => [tallX[n], from[n]]), false);
        const t0 = performance.now(), dur = 650;
        const step = (now) => {
          const k = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - k, 4);   // ease out (quartic)
          ys = from.map((y, n) => y + (to[n] - y) * e);
          place(steps.map((s, n) => [tallX[n], ys[n]]), false);
          if (k < 1) glide = requestAnimationFrame(step);
        };
        glide = requestAnimationFrame(step);
      }
    }
    // Desktop: the new step's words rise in, one line after another (GSAP).
    if (core && !reduceMotion && before !== -1) {
      const parts = steps[i].label.querySelectorAll('.step__count, .step__name, .step__text');
      core.gsap.fromTo(parts, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: core.EASE.arrive, stagger: 0.08, overwrite: true });
    }
  }

  // The drawn trail for scroll progress p: its head reaches checkpoint i as stretch i begins, then
  // moves on towards the next one; past the last checkpoint it runs on to the end of the line.
  let p = 0;
  function draw() {
    if (!marks.length) return;
    let t;
    const n = marks.length;
    const i = Math.min(n - 1, Math.floor(p / 0.2));
    const into = (p - STRETCH[i]) / 0.2;
    if (i < n - 1) t = marks[i] + (marks[i + 1] - marks[i]) * Math.min(into * 1.15, 1);
    else t = marks[i] + (1 - marks[i]) * Math.min(into * 1.4, 1);
    glow.style.strokeDashoffset = (1 - t).toFixed(4);
  }

  let shown = -1;
  function render(progressNow) {
    if (Math.abs(progressNow - shown) < 0.0004) return;
    shown = progressNow;
    p = progressNow;
    setCurrent(Math.min(steps.length - 1, Math.floor(p / 0.2)));
    draw();
    if (reduceMotion) return;
    // Depth: each layer drifts at its own pace (transform only: the browser just moves layers).
    for (const { el, depth } of layers) el.style.transform = `translate3d(0, ${(-(p - 0.5) * 60 * depth).toFixed(1)}px, 0)`;
  }

  const progress = () => {
    const r = section.getBoundingClientRect();
    const run = r.height - window.innerHeight;   // the scroll the sticky screen holds for
    return Math.min(Math.max(-r.top / run, 0), 1);
  };

  const relayout = () => { layout(); shown = -1; render(progress()); };
  document.fonts.ready.then(relayout);
  layout();
  render(progress());

  if (core) {
    // Desktop: ScrollTrigger reports the progress while the section is held on screen.
    // (Its range is the whole time the section is near the screen, and the progress itself is read
    // from where the section really is, so a pinned section above it that grows its length later
    // (the 3D work ridge, loaded at idle) can never put the trail out of step with the page.)
    core.ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',
      end: 'bottom top',
      refreshPriority: -1,   // measured after the sections above it
      onUpdate: () => render(progress()),
      onRefresh: relayout,
    });
    return;
  }
  // Phones: one read and a few writes per frame, only while the section is (nearly) on screen.
  let raf = 0, near = false;
  const ask = () => { if (near && !raf) raf = requestAnimationFrame(() => { raf = 0; render(progress()); }); };
  new IntersectionObserver(([e]) => { near = e.isIntersecting; ask(); }, { rootMargin: '25% 0px' }).observe(section);
  window.addEventListener('scroll', ask, { passive: true });
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastW && box.classList.contains('is-tall')) return;   // (a phone's address bar)
    lastW = window.innerWidth;
    relayout();
  });
}

// A smooth curve through points (Catmull-Rom), as SVG cubic curves. `upTo` stops at that point, so
// the same curve can be measured part of the way.
function smoothPath(pts, upTo = pts.length - 1) {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < upTo; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

// services.js: "the exploded website", the desktop Services section.
//
// The approved design (references/services-explode/Explode.dc.html) describes every frame of the
// sequence as a function of one number, `p`: how far you've scrolled through the section, 0 to 1.
// This file is that function, rebuilt for the real page:
//
//   0.00-0.10  the heading, and a small tilted website (the made-up "Aurel" studio)
//   0.10-0.25  the heading leaves; the website comes to the middle, grows, and splits into 5 layers
//   0.25-0.85  one layer at a time (0.12 each) flies to the front and turns to face you, with its
//              service beside it (Film left, Interaction right, Layout left, Commerce right, Code left)
//   0.85-1.00  the layers fold back into one website: "All of this. One website."
//
// GSAP ScrollTrigger turns the scroll into `p` (scrub: it eases gently after the scroll), and
// render(p) places everything. It only ever changes transforms and opacity (plus a soft blur on the
// layers at the back), so the browser never has to re-lay out the page while you scroll.
//
// Phones never get this (they keep the service cards), and "reduce motion" gets a calm static list
// (css/home.css): in both cases this file does nothing.

import { collapseWhenStill, collapsing } from '../once.js';

export function initServices({ core, lenis }) {
  const root = document.querySelector('[data-svx]');
  if (!root || !core || core.reduceMotion) return;
  const { gsap, ScrollTrigger, SplitText } = core;
  const narrow = window.matchMedia('(max-width: 1099px)');   // (see "A desktop window narrower..." below)

  const q = (sel) => root.querySelector(sel);
  const qa = (sel) => [...root.querySelectorAll(sel)];
  const pin = q('.svx__pin');
  const scene = q('[data-svx-scene]');
  const shadow = q('[data-svx-shadow]');
  // In the page the layers are written bottom (Code) to top (Film), so the stack paints the right
  // way round even before 3D sorting; here they're numbered like the design: 0 = Film ... 4 = Code.
  const layers = qa('[data-svx-layer]').reverse();
  const rims = layers.map((l) => l.querySelector('[data-svx-rim]'));
  const focus = qa('[data-svx-focus]');
  const head = q('[data-svx-head]');
  const end = q('[data-svx-end]');
  const skip = q('[data-svx-skip]');
  const bits = {
    film: q('[data-svx-film]'),
    product: q('[data-svx-product]'),
    before: q('[data-svx-before]'),
    beforeImg: q('[data-svx-before-img]'),
    knob: q('[data-svx-knob]'),
    grid: q('[data-svx-grid]'),
    glow: q('[data-svx-glow]'),
    pick: q('[data-svx-pick]'),
    cart: q('[data-svx-cart]'),
    typed: q('[data-svx-typed]'),
    serp: q('[data-svx-serp]'),
  };

  // Write a style only when it actually changes (most values hold still most of the time).
  const written = new Map();
  const put = (el, prop, value) => {
    let seen = written.get(el);
    if (!seen) written.set(el, (seen = {}));
    if (seen[prop] === value) return;
    seen[prop] = value;
    el.style[prop] = value;
  };
  const flag = (el, name, on) => el.classList.toggle(name, on);

  // The design's helpers: a soft in-out curve, a clamp to 0..1, and a blend from a to b.
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const cl = (t) => Math.max(0, Math.min(1, t));
  const mix = (a, b, t) => a + (b - a) * t;
  const r = (n) => Math.round(n * 1000) / 1000;   // (fewer digits: fewer "changed" styles)

  // Lines of the service titles and the closing line, split once the real fonts are in (so the lines
  // break where they will on screen). Each line rises out of its own mask as its words fade in,
  // like the site's other headings.
  let titleLines = focus.map(() => []);
  let endLines = [];
  document.fonts.ready.then(() => {
    const split = (el) => SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line', aria: 'auto' }).lines;
    titleLines = focus.map((f) => split(f.querySelector('.svx__title')));
    endLines = split(q('[data-svx-end-title]'));
    render(state.p);
  });
  const rise = (lines, op) => lines.forEach((line, i) => {
    put(line, 'transform', `translateY(${r(110 * (1 - ease(cl(op * 1.25 - i * 0.25))))}%)`);
  });

  // Fit the design's 1440 x 810 frame to the window. On short windows the heading would slide under
  // the top bar, so it's nudged down just enough to clear it.
  let nudge = 0;
  const layout = () => {
    const w = pin.clientWidth, h = pin.clientHeight;
    const k = Math.min(w / 1440, h / 810);
    root.style.setProperty('--svx-k', k.toFixed(4));
    const headTop = (h - 810 * k) / 2 + 78 * k;
    nudge = Math.max(0, (76 + 14 - headTop) / k);
  };

  const W_SHIFT = 169, SIN = 0.848, FRONT_Z = 700;

  function render(p) {
    if (narrow.matches) return;   // (the calm list: nothing to place)
    // e: how far apart the layers are. c: how close the stack is to its centred, full-size pose.
    let e, c;
    if (p < 0.1) { e = 0; c = 0; }
    else if (p < 0.25) { e = c = ease((p - 0.1) / 0.15); }
    else if (p < 0.85) { e = c = 1; }
    else { e = c = 1 - ease((p - 0.85) / 0.15); }

    // k: the layer in front (-1 for none). t: how far through its turn. f: how far forward it is
    // (comes forward over the first 22%, holds, goes back over the last 20%).
    let k = -1, t = 0, f = 0;
    if (p >= 0.25 && p < 0.85) {
      k = Math.min(4, Math.floor((p - 0.25) / 0.12));
      t = cl((p - 0.25 - k * 0.12) / 0.12);
      f = t < 0.22 ? ease(t / 0.22) : t < 0.8 ? 1 : 1 - ease((t - 0.8) / 0.2);
    }
    const sideLeft = k % 2 === 0;
    const ss = mix(0.66, 1, c), sy = mix(150, 40, c);

    put(scene, 'transform', `translateY(${r(sy)}px) scale(${r(ss)}) rotateX(58deg) rotateZ(-36deg)`);
    put(shadow, 'transform', `translateZ(-4px) scale(${r(1 + 0.15 * e)})`);
    put(shadow, 'opacity', r((0.9 - 0.4 * e) * (k >= 0 ? 1 - 0.8 * f : 1)));

    layers.forEach((layer, idx) => {
      const s = 4 - idx;
      const ff = idx === k ? f : 0;
      // The front layer travels to the same spot in front of the whole stack wherever it starts
      // (even the bottom one, Code), turning flat to face you and leaning away from its words.
      const z = mix(s * (e * 115 + 1.5), FRONT_Z, ff);
      const tx = ((sideLeft ? W_SHIFT : -W_SHIFT) * ff) / ss;
      const ty = ((FRONT_Z * SIN - 120) * ff) / ss;
      put(layer, 'transform', `translateZ(${r(z)}px) rotateZ(${r(36 * ff)}deg) rotateX(${r(-58 * ff)}deg) translate(${r(tx)}px, ${r(ty)}px) scale(${r(1 - 0.04 * ff)})`);
      // The others step back: almost gone (6%) and softly out of focus. Layers are solid, so the one
      // in front never has another showing through it.
      const others = k >= 0 && idx !== k;
      put(layer, 'opacity', others ? r(1 - 0.94 * f) : '1');
      const blur = others ? Math.round(12 * f) / 2 : 0;   // (half-pixel steps)
      put(layer, 'filter', blur ? `blur(${blur}px)` : 'none');
      put(rims[idx], 'opacity', e > 0.05 && !others ? r(Math.min(1, 0.35 * e + 0.3 * ff)) : '0');
    });

    // The small things inside each layer, played as it arrives (and left done once it's passed).
    const lt = (idx) => (idx === k ? cl((t - 0.15) / 0.6) : k > idx || p >= 0.85 ? 1 : 0);
    put(bits.film, 'transform', `scale(${r(1.02 + 0.1 * lt(0))})`);
    put(bits.product, 'transform', `rotateY(${r(-25 + 50 * lt(1))}deg)`);
    const ba = 85 - 70 * lt(1);   // where the before / after line is, in % from the left
    put(bits.before, 'transform', `translateX(${r(ba - 100)}%)`);
    put(bits.beforeImg, 'transform', `translateX(${r(100 - ba)}%)`);
    put(bits.knob, 'transform', `translateX(${r(ba * 3.46)}px)`);
    put(bits.grid, 'opacity', r((0.06 + 0.2 * lt(2)) / 0.26));
    put(bits.glow, 'opacity', r(lt(2)));
    flag(bits.pick, 'is-on', lt(3) > 0.4);
    flag(bits.cart, 'is-on', lt(3) > 0.6);
    const tc = lt(4);
    flag(bits.typed, 'is-on', tc > 0.2);
    const serp = cl((tc - 0.3) / 0.3);
    put(bits.serp, 'opacity', r(serp));
    put(bits.serp, 'transform', `translateY(${r((1 - serp) * 10)}px)`);

    // The words.
    const headOp = p < 0.1 ? 1 : 1 - cl((p - 0.1) / 0.06);
    put(head, 'opacity', r(headOp));
    put(head, 'transform', `translateY(${r(nudge - (1 - headOp) * 20)}px)`);
    const focusOp = k >= 0 ? cl((f - 0.55) / 0.45) : 0;
    focus.forEach((el, idx) => {
      const op = idx === k ? focusOp : 0;
      const dir = el.dataset.side === 'left' ? -1 : 1;
      put(el, 'opacity', r(op));
      put(el, 'transform', `translateY(-50%) translateX(${r(dir * (1 - op) * 24)}px)`);
      rise(titleLines[idx], op);
    });
    const endOp = cl((p - 0.93) / 0.05);
    put(end, 'opacity', r(endOp));
    put(end, 'transform', `translateY(${r(nudge + (1 - endOp) * 16)}px)`);
    rise(endLines, endOp);
    flag(skip, 'is-done', p >= 0.97);
  }

  // With the film, the section first holds for the hand-over's forming stretch (--form screens,
  // js/site.js), so the sequence starts once the heading has formed. (css/home.css adds the same
  // stretch to the section's height.)
  const html = document.documentElement;
  const formLength = () => (html.dataset.mode === 'film' && !html.classList.contains('no-film')
    ? (parseFloat(getComputedStyle(html).getPropertyValue('--form')) || 0) * window.innerHeight : 0);

  // The scroll drives `p`. (scrub 0.5: it follows the scroll with half a second of give, so a
  // flick of the wheel still moves the layers gently.) GPU layers are only kept while it's on hold.
  const state = { p: 0 };
  let finished = false;   // (see "Once played, it stays played" below)
  layout();
  render(0);
  const tween = gsap.to(state, {
    p: 1,
    ease: 'none',
    onUpdate: () => { render(state.p); if (state.p >= 0.999 && !finished && !collapsing()) requestAnimationFrame(finish); },   // (next frame: never while the tween is still being created)
    scrollTrigger: {
      trigger: root,
      // (after the film's hand-over, which forms the heading while the section already holds)
      start: () => `top+=${formLength()} top`,
      end: 'bottom bottom',
      scrub: 0.5,
      onToggle: (self) => root.classList.toggle('is-live', self.isActive),
      onRefresh: () => { layout(); render(state.p); },
    },
  });

  // A desktop window narrower than 1100 px gets the calm list instead (css/home.css), because the
  // scaled stage's words would be too small to read. Resizing across that width switches cleanly:
  // the scroll stops driving the stage, and every style this file wrote is handed back to the CSS.
  const fit = () => {
    if (narrow.matches) {
      tween.scrollTrigger.disable(false);
      // (only the properties written here: SplitText's own styles on the title lines stay)
      for (const [el, props] of written) for (const prop in props) el.style.removeProperty(prop);
      written.clear();
      root.classList.remove('is-live');
    } else if (!tween.scrollTrigger.enabled) {
      tween.scrollTrigger.enable();
      layout();
      render(state.p);
    }
  };
  narrow.addEventListener('change', () => { if (!finished) fit(); });
  fit();

  // ---------- Once played, it stays played (js/once.js) ----------
  // Reaching the last frame going down finishes the sequence for this visit: it stays on "All of this.
  // One website." with the website back together, and scrolling back up never takes it apart again.
  // When the scroll is next at rest, its 7 held screens are removed (css: .is-collapsed), keeping
  // only the hand-over's forming stretch and one screen for the finished site.
  function finish() {
    if (finished || narrow.matches) return;
    finished = true;
    tween.scrollTrigger.kill();
    tween.kill();
    state.p = 1;
    render(1);
    root.classList.remove('is-live');
    root.classList.add('is-finished');
    // (anchored on whatever follows the whole Services section: .svx is its last child)
    collapseWhenStill('services', () => root.classList.add('is-collapsed'), root.closest('section').nextElementSibling);
  }

  // ---------- Ready before it's needed (the first visit) ----------
  // The very first time a browser draws these layers (turned in 3D, with rounded photo clips and the
  // soft blur), its graphics driver has to prepare that kind of drawing, which stalled the sequence
  // mid-scroll: about 8 frames, one of them over half a second. So that work is done at a calm moment
  // instead: once the visitor has settled on the summit hero (js/site.js sends 'ascent:hero-rest'),
  // the stage is drawn for a few frames, almost fully see-through (0.5%, css .svx.is-warming: nothing
  // you can see), stepping through its key poses. Once per visit; later visits find the driver's work
  // already saved, so it costs them almost nothing.
  let warmed = false;
  async function warmUp() {
    if (warmed || finished || narrow.matches || root.classList.contains('is-live')) return;
    warmed = true;
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
    root.classList.add('is-warming', 'is-live');
    // (every pose kind once, and the first layer's whole step forward, frame by frame: the blur behind it
    // passes through each half-pixel strength, and each strength is prepared separately)
    const ramp = Array.from({ length: 28 }, (_, i) => 0.25 + (0.12 * 0.24 * i) / 27);
    for (const p of [0.05, 0.2, ...ramp, 0.31, 0.43, 0.55, 0.67, 0.79, 0.93, 1]) {
      // (a scroll into the section meanwhile takes over at once)
      if (tween.scrollTrigger?.isActive) break;
      render(p);
      await frame();
      if (p < 0.25 || p > 0.28) await frame();
    }
    root.classList.remove('is-warming');
    root.classList.toggle('is-live', !!tween.scrollTrigger?.isActive);
    render(state.p);
  }
  window.addEventListener('ascent:hero-rest', () => warmUp());
  // (this file can start after the visitor reached the hero: then the moment has already come)
  if (document.documentElement.classList.contains('hero-in')) setTimeout(() => { if (!document.hidden) warmUp(); }, 2600);

  // Skip: straight to the last frame (a cut, not a fast-forward through every layer), and the
  // keyboard carries on from there.
  skip.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();   // (or Lenis's own handler for # links, on the window, glides on to #process)
    if (finished) return;   // (already on the last frame)
    lenis.scrollTo(tween.scrollTrigger.end, { immediate: true, force: true });
    ScrollTrigger.update();
    tween.scrollTrigger.getTween()?.progress(1);
    state.p = 1;
    render(1);
    finish();
    end.setAttribute('tabindex', '-1');
    end.focus({ preventScroll: true });
  });
}

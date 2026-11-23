// story.js: the text beats along the climb (index.html, .moment).
//
// Each beat has data-from / data-to: the stretch of the film (0..1) where it's on screen, and
// data-place: where in the frame it sits (css/style.css), chosen for its shot so it never covers
// the trekker, a landmark or the sun.
// As the film reaches a beat, its main line is set line by line (each line rises out of a mask,
// SplitText), then the smaller text fades up beneath it. Walking on, the beat fades away.

import { gsap, lineReveal, reduceMotion, EASE } from '../core.js';

// shade (optional): the scene's soft darkening behind words (js/world/shade.js); each beat tells it
// where it is and how visible it is right now.
export function createStory({ shade = null } = {}) {
  const moments = [...document.querySelectorAll('.moment')].map((el) => ({
    el, from: Number(el.dataset.from), to: Number(el.dataset.to), on: false, tl: null,
  }));

  function build(m) {
    const line = m.el.querySelector('.moment__line');
    const text = m.el.querySelector('.moment__text');
    const tl = lineReveal(line, { stagger: 0.1 });
    if (text) {
      tl.fromTo(text, { opacity: 0, y: reduceMotion ? 0 : 12 },
        { opacity: 1, y: 0, duration: 1.1, ease: EASE.arrive }, reduceMotion ? 0 : 0.5);
    }
    return tl;
  }
  function show(m) {
    m.on = true;
    gsap.killTweensOf(m.el);
    gsap.set(m.el, { opacity: 1, visibility: 'visible' });
    m.tl ??= build(m);
    m.tl.restart();
  }
  function hide(m) {
    m.on = false;
    gsap.to(m.el, {
      opacity: 0, duration: 0.6, ease: 'sine.out',
      onComplete: () => { if (!m.on) m.el.style.visibility = 'hidden'; },
    });
  }

  // p = film progress. Only acts when a beat enters or leaves its stretch.
  function update(p) {
    moments.forEach((m, i) => {
      const inside = p >= m.from && p <= m.to;
      if (inside && !m.on) show(m);
      else if (!inside && m.on) hide(m);
      // (opacity is read from GSAP's own record of it: no layout work)
      if (shade) shade.set('moment' + i, m.el, Number(gsap.getProperty(m.el, 'opacity')) || 0);
    });
  }
  return { update };
}

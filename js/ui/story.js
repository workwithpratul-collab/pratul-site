// story.js: the short text moments along the climb (index.html, .moment).
// Each has data-from / data-to: the stretch of the film (0..1) where it's on screen. It fades in
// at the start of its stretch, rising a few pixels, and fades out again as we walk on.

const FADE = 0.012;   // how much of the film each fade takes (about a sixth of a screen)

const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

export function createStory({ reduceMotion }) {
  const moments = [...document.querySelectorAll('.moment')].map((el) => ({
    el, from: Number(el.dataset.from), to: Number(el.dataset.to), shown: -1,
  }));
  // p = film progress. Only touches the page when a moment's look actually changes.
  function update(p) {
    for (const m of moments) {
      const a = smooth(m.from, m.from + FADE, p) * (1 - smooth(m.to - FADE, m.to, p));
      const rounded = Math.round(a * 200) / 200;
      if (rounded === m.shown) continue;
      m.shown = rounded;
      m.el.style.opacity = rounded;
      m.el.style.visibility = rounded > 0 ? 'visible' : 'hidden';
      if (!reduceMotion) m.el.style.transform = `translateY(${((1 - rounded) * 14).toFixed(1)}px)`;
    }
  }
  return { update };
}

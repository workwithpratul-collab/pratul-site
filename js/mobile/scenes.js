// scenes.js: the painted scenes between the sections of the mobile page (the ridge, the meadow,
// the summit). As one passes through the screen, its picture drifts a little slower than the
// page and its band of mist a little faster: simple parallax, three layers at most.
//
// Each scene gets one number, --shift (-1 as it enters at the bottom of the screen, 0 in the
// middle, 1 as it leaves at the top); css/mobile.css turns it into gentle transforms. Only
// scenes on screen are updated, at most once per frame, and only with transforms (no layout),
// so scrolling stays smooth.

export function initScenes({ reduceMotion }) {
  if (reduceMotion) return;   // (with "reduce motion" the pictures simply sit still)
  const scenes = [...document.querySelectorAll('.m-chapter, .m-summit')];
  const visible = new Set();
  let queued = false;

  function update() {
    queued = false;
    const vh = window.innerHeight;
    for (const el of visible) {
      const r = el.getBoundingClientRect();
      // Where the scene's middle is, from the bottom of the screen (-1) to the top (1).
      const shift = ((vh / 2) - (r.top + r.height / 2)) / ((vh + r.height) / 2);
      el.style.setProperty('--shift', Math.max(-1, Math.min(1, shift)).toFixed(4));
    }
  }
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.isIntersecting ? visible.add(e.target) : visible.delete(e.target);
    queue();
  }, { rootMargin: '10% 0px' });
  scenes.forEach((el) => io.observe(el));
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
}

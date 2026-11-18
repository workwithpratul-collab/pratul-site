// finale.js: the summit. As the sun breaks, the closing line rises in beside the flag, then
// "Book a call" and "See all work". Scrolling back down the mountain hides them again.

import { gsap } from 'gsap';

export function createFinale({ reduceMotion }) {
  const root = document.getElementById('finale');
  const parts = [...root.children];
  let shown = false;

  function show() {
    if (shown) return;
    shown = true;
    root.hidden = false;
    gsap.killTweensOf(parts);
    if (reduceMotion) {
      gsap.to(parts, { opacity: 1, duration: 1, stagger: 0.2, ease: 'power1.out' });
      return;
    }
    gsap.fromTo(parts,
      { opacity: 0, y: 16, filter: 'blur(5px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.8, stagger: 0.45, ease: 'power2.out' });
  }
  function hide() {
    if (!shown) return;
    shown = false;
    gsap.killTweensOf(parts);
    gsap.to(parts, { opacity: 0, duration: 0.6, ease: 'power1.out', onComplete: () => { if (!shown) root.hidden = true; } });
  }
  return { show, hide, get shown() { return shown; } };
}

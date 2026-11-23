// core.js: the few things every part of the desktop site shares, created once.
//
//   - GSAP with the only two plugins we use (ScrollTrigger and SplitText)
//   - Lenis, the smooth scroller, driven by GSAP's clock so scrolling, scroll-linked animation
//     and the 3D views all update in the same frame (nothing lags a frame behind)
//   - the motion settings from DESIGN.md §5, so JS animations use the same curves as the CSS
//
// It's small (no three.js): the page can paint and respond before any 3D code arrives.

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);

export { gsap, ScrollTrigger, SplitText };

// "Reduce motion" (a system setting): plain scrolling, and every reveal becomes a short fade.
export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// The same two curves as css/tokens.css (--ease-arrive, --ease-flow).
export const EASE = { arrive: 'expo.out', flow: 'sine.inOut' };
export const TIME = { fast: 0.32, base: 0.7, slow: 1.4 };

// Lenis smooths the wheel and trackpad, so scrolling glides instead of jumping in steps.
// Links to places on the page (#contact, #work...) glide there too.
export const lenis = new Lenis({
  lerp: 0.075,
  wheelMultiplier: 0.8,
  smoothWheel: !reduceMotion,
  // (offset: leave room for the top bar)
  anchors: reduceMotion ? { immediate: true, offset: -72 } : { duration: 2, offset: -72 },
});
lenis.on('scroll', ScrollTrigger.update);
// GSAP's clock drives Lenis first; anything added to the ticker later (the 3D loop in gl.js)
// runs after it in the same frame and sees this frame's scroll position.
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

// Reveal lines of a heading one by one: each line rises out of a mask, like a film title.
// Returns the timeline (paused) so the caller decides when it plays.
export function lineReveal(el, { delay = 0, stagger = 0.09, duration = TIME.slow } = {}) {
  if (reduceMotion) {
    return gsap.timeline({ paused: true, delay }).fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'none' });
  }
  // mask: 'lines' wraps every line in a clipping box, so it can rise from nothing.
  const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line', aria: 'auto' });
  return gsap.timeline({ paused: true, delay })
    .set(el, { opacity: 1 })
    // (125%, not 100%: the mask has extra room below for descenders, so the line starts lower)
    .fromTo(split.lines, { yPercent: 125 }, { yPercent: 0, duration, ease: EASE.arrive, stagger });
}

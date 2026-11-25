// once.js: every reveal plays once, going down only (desktop).
//
// The film, Services, Work and Process each hold the page while their scroll animation plays. Once a
// visitor has scrolled down through one, it is "finished": its animation stays at its last frame for
// the rest of the visit, and the extra scroll length it held is removed ("collapsed"), so scrolling
// back up past it is quick and never rewinds it. A reload starts everything fresh.
//
// Collapsing shortens the page above where the visitor is, so the scroll position has to shift by
// exactly that much in the same moment, or the page would jump. We do it like this:
//   1. wait until the scroll is at rest (never mid-glide: changing the scroll under a moving wheel
//      would stop it dead or jerk it), checked once per frame;
//   2. note where an "anchor" (an element below the section, in the normal flow) sits on screen;
//   3. shorten the section, and scroll by however far the anchor moved, so it's back where it was;
//   4. only then let ScrollTrigger re-measure every section (so none of them ever sees the old, now
//      too-large scroll position and thinks it has been scrolled past), and correct once more if
//      re-measuring moved the anchor again.
// All of this happens between two frames, so nothing on screen moves.

import { gsap, ScrollTrigger, lenis } from './core.js';

const queue = [];
let busy = false;

// name: for the log. apply: the function that shortens the section. anchor: an element (or a
// function returning one) below it, in the normal flow (not pinned), whose place on screen must not
// change.
export function collapseWhenStill(name, apply, anchor) {
  queue.push({ name, apply, anchor });
}

// True while a collapse is being made: the sections' "finished" checks ignore what they see then.
export const collapsing = () => busy || ScrollTrigger.isRefreshing;

// Move the scroll so the anchor is back where it was (returns how far it had moved).
function hold(anchor, before) {
  const moved = anchor.getBoundingClientRect().top - before;
  if (Math.abs(moved) > 0.5) lenis.scrollTo(window.scrollY + moved, { immediate: true, force: true });
  return moved;
}

gsap.ticker.add(() => {
  if (!queue.length || lenis.isScrolling || lenis.isStopped) return;
  busy = true;
  // (The browser has its own "scroll anchoring", which sometimes shifts the scroll by itself when
  // content above the screen changes. Off for this moment, so only one thing moves it: us.)
  const html = document.documentElement;
  html.style.overflowAnchor = 'none';
  for (const job of queue.splice(0)) {
    const anchor = typeof job.anchor === 'function' ? job.anchor() : job.anchor;
    if (!anchor) { console.warn('[once] no anchor for', job.name); continue; }
    const t0 = performance.now();
    const before = anchor.getBoundingClientRect().top;
    if (job.apply() === false) continue;   // (nothing to do any more)
    lenis.resize();   // (Lenis measures the page's new, shorter length)
    const removed = -hold(anchor, before);
    ScrollTrigger.refresh();
    hold(anchor, before);
    ScrollTrigger.update();
    // (for checking: how much was removed, how far the anchor ended up from where it was (0 = no jump),
    // and how long it took)
    log.push({ name: job.name, removed: Math.round(removed), off: Math.round((anchor.getBoundingClientRect().top - before) * 10) / 10, ms: Math.round(performance.now() - t0) });
  }
  html.style.overflowAnchor = '';
  busy = false;
});
const log = (window.__collapses = []);

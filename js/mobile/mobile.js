// mobile.js: starts the mobile page (phones and portrait tablets). main.js loads it instead of
// the film when js/device.js chose the "mobile" or "calm" version.
//
// The page is a normal, fast-scrolling page (the browser's own scrolling: no smooth-scroll
// library, nothing pinned). In order:
//  1. the page's own parts start at once: the menu, the painted scenes, the work cards, the gear
//     check, the demos and the contact form. None of them needs any 3D.
//  2. then, on the "mobile" version only, once the text and the button are on screen and the
//     browser has a quiet moment, the live 3D base camp loads and fades in behind the headline.

import { initPages } from '../pages/pages.js';
import { initScenes } from './scenes.js';
import { initWorkCards } from './work.js';
import { initGear } from './gear.js';

const mode = document.documentElement.dataset.mode;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// The pages' scripts were written for the film's smooth scroller (Lenis). This small stand-in
// gives them the same two things they use, but with the browser's own scrolling.
const nativeScroll = {
  on(event, fn) { if (event === 'scroll') window.addEventListener('scroll', fn, { passive: true }); },
  scrollTo(target, { offset = 0, duration } = {}) {
    const el = typeof target === 'string' ? document.querySelector(target) : null;
    const top = el ? el.getBoundingClientRect().top + window.scrollY + offset : Number(target) || 0;
    window.scrollTo({ top, behavior: reduceMotion || duration === 0 ? 'auto' : 'smooth' });
  },
};

// ---------- 1. The page ----------
initPages({ lenis: nativeScroll, mobile: true });
initScenes({ reduceMotion });
initWorkCards({ reduceMotion });
initGear();

// Back from a project page ("Back to the trail", ?return=dermae): open at that project's card.
const back = new URLSearchParams(location.search).get('return');
if (back) {
  history.replaceState(null, '', location.pathname);
  const card = document.querySelector(`.work-card__scene[href*="${CSS.escape(back)}"]`)?.closest('.work-card');
  if (card) requestAnimationFrame(() => card.scrollIntoView({ block: 'start', behavior: 'instant' }));
}

// ---------- 2. The live base camp (mobile version only) ----------
const hero = document.getElementById('top');
const canvas = document.getElementById('hero-canvas');

// Show the painted still instead (calm look): used if the 3D can't start, or can't keep up.
function useStill(reason) {
  console.info('[hero] using the painted still:', reason);
  hero.classList.remove('is-live');
  hero.classList.add('is-still');
}

// How long the live scene may take: if the trekker hasn't arrived 8 s after the page opened, the
// painted still stays. On a connection the browser already knows is slow (2G, 3G or "save data"),
// the 3D isn't even downloaded.
const HERO_DEADLINE_MS = 8000;
const net = navigator.connection;
const slowNet = !!net && (net.saveData || /(^|-)2g|3g/.test(net.effectiveType || ''));

if (mode === 'mobile' && slowNet) useStill('slow connection');
else if (mode === 'mobile') {
  // Wait until the page has painted its text and button, then for a quiet moment, so the 3D
  // download never competes with what the visitor sees first.
  const whenQuiet = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 300));
  // The 8 s promise, kept even if the 3D code itself is still on its way: by then the trekker must
  // be here, or the still stays (and the 3D isn't started at all).
  let gaveUp = false;
  setTimeout(() => {
    if (window.__hero?.arrived) return;
    gaveUp = true;
    useStill('the trekker took longer than 8 s to load');
  }, Math.max(HERO_DEADLINE_MS - performance.now(), 0));
  const start = () => whenQuiet(() => {
    if (gaveUp) return;
    import('./hero.js')
      .then((m) => m.startHero({ canvas, section: hero, onSlow: (ms) => useStill(`too slow (${Math.round(ms)} ms a frame)`), onFail: useStill, deadline: HERO_DEADLINE_MS }))
      .catch((err) => useStill(err?.message || err));
  });
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
  // If the graphics chip resets (it can happen on phones under memory pressure), keep it calm.
  canvas.addEventListener('webglcontextlost', () => { window.__hero?.stop(); useStill('graphics context lost'); });
}

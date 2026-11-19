// mobile.js: starts the phone page (phones and portrait tablets). main.js loads it instead of the
// film when js/device.js chose the "mobile" or "calm" version.
//
// There is no film and no 3D here: the page opens on the summit hero (a painting with a slow CSS
// cloud drift) and scrolls with the browser's own scrolling. This file only hands the shared page
// script (js/pages/pages.js) a small stand-in for the film's smooth scroller.

import { initPages } from '../pages/pages.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// The pages' script was written for the film's smooth scroller (Lenis). This gives it the one
// thing it uses, scrollTo(), with the browser's own scrolling.
const nativeScroll = {
  scrollTo(target, { offset = 0, duration } = {}) {
    const el = typeof target === 'string' ? document.querySelector(target) : null;
    const top = el ? el.getBoundingClientRect().top + window.scrollY + offset : Number(target) || 0;
    window.scrollTo({ top, behavior: reduceMotion || duration === 0 ? 'auto' : 'smooth' });
  },
};

initPages({ lenis: nativeScroll });

// Back from a case study ("Back to the trail", ?return=dermae): open at the work slider.
if (new URLSearchParams(location.search).get('return')) {
  requestAnimationFrame(() => {
    document.getElementById('work').scrollIntoView({ block: 'start', behavior: 'instant' });
    history.replaceState(null, '', location.pathname);
  });
}

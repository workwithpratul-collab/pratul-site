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

// A thin progress line along the top edge while scrolling (the mockup's "scroll progress"), and a
// gentle parallax on the hero's painting (it drifts slower than the page). One read and two writes
// per frame, only while scrolling; nothing under "reduce motion".
if (!reduceMotion) {
  const bar = document.createElement('div');
  bar.className = 'm-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  const poster = document.querySelector('.hero__poster');
  let raf = 0;
  const update = () => {
    raf = 0;
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : '0');
    if (y < window.innerHeight * 1.2) poster.style.transform = `translate3d(0, ${(y * 0.28).toFixed(1)}px, 0)`;
  };
  window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
  update();
}

// Back from a case study ("Back to the trail", ?return=dermae): open at the work slider.
if (new URLSearchParams(location.search).get('return')) {
  requestAnimationFrame(() => {
    document.getElementById('work').scrollIntoView({ block: 'start', behavior: 'instant' });
    history.replaceState(null, '', location.pathname);
  });
}

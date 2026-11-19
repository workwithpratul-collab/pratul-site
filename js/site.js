// site.js: the desktop page, before and around the 3D film.
//
// The order things happen in (DESIGN.md §8, "load in order"):
//   1. The page paints at once: the opening poster (a picture of the film's first frame) and
//      the real HTML text over it. Only this small file, GSAP and Lenis are needed for that.
//   2. Once the browser is idle after loading, film.js (three.js and the whole world) is fetched
//      and built in short steps, so the page never freezes.
//   3. When the world and the trekker are ready, the live scene cross-fades in over the poster
//      and scrolling the film begins.
// The sections below the film get their scripts (pages.js) while the visitor is still up the
// mountain, and the 3D carousels only when they come near.

import { gsap, lenis, reduceMotion, lineReveal, EASE, TIME } from './core.js';

const root = document.documentElement;
const film = document.getElementById('film');
const hint = document.querySelector('[data-hint]');
const opening = document.getElementById('opening');
const heroEl = document.getElementById('hero');
const nav = document.getElementById('site-nav');

// The film is FILM_SCREENS screens of scrolling (js/world/journey.js), then one screen holding
// the summit hero. (css/style.css sets the section's height to match: 13 + 1 + 1 screens.)
const FILM_SCREENS = 13;
let vh = window.innerHeight;
let filmTop = film.offsetTop;
const filmEnd = () => filmTop + FILM_SCREENS * vh;               // the last shot is reached
const heroScroll = () => filmTop + film.offsetHeight - vh;      // the hero fully settled
window.addEventListener('resize', () => { vh = window.innerHeight; filmTop = film.offsetTop; onScroll(); });

// ---------- 1. Until the world is ready: the poster, and a quiet progress line ----------
root.classList.add('is-loading');
lenis.stop();   // the film can't be scrolled before it exists (Skip still works)
let api = null; // the film's controls, once it's ready (jump, glideToEnd...)
let shownPercent = -1;
window.addEventListener('ascent:progress', (e) => {
  const pct = Math.round(Math.min(e.detail, 1) * 100);
  if (pct === shownPercent || api) return;
  shownPercent = pct;
  hint.textContent = `Preparing the climb · ${pct}%`;
});
window.addEventListener('ascent:ready', (e) => {
  api = e.detail;
  root.classList.remove('is-loading');
  root.classList.add('is-live');   // the posters fade away; the live scene shows through
  hint.textContent = 'Scroll to begin the climb';
  lenis.start();
  onScroll();
}, { once: true });

// ---------- 2. Load the film after the page has painted ----------
// requestIdleCallback waits for a quiet moment, so the first paint and the first interactions are
// never held up by the 3D download.
function loadFilm() {
  import('./film.js').catch((err) => {
    // No 3D after all (an old graphics chip, a blocked CDN): keep the posters, let the page scroll.
    console.error('[film] could not start', err);
    root.classList.remove('is-loading');
    root.classList.add('no-film');
    hint.textContent = 'Scroll down';
    lenis.start();
  });
}
const whenIdle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 200));
if (document.readyState === 'complete') whenIdle(loadFilm);
else window.addEventListener('load', () => whenIdle(loadFilm), { once: true });

// The sections' own script: fetched early but quietly, so it's there long before anyone scrolls down.
whenIdle(() => import('./pages/pages.js').then((m) => m.initPages({ lenis, desktop: true })));

// ---------- 3. "Skip the film" ----------
document.getElementById('skip').addEventListener('click', (e) => {
  e.preventDefault();
  if (api) { api.glideToEnd(); return; }
  // Not ready yet: go straight to the hero, shown on its poster until the live scene arrives
  // (film.js then starts at the summit, because the page is already there).
  lenis.start();
  lenis.scrollTo(heroScroll(), { immediate: true, force: true });
  heroEl.focus({ preventScroll: true });
});

// ---------- 4. The opening: lines rise in on load (CSS), and fade away as the climb begins ----------
let openingShown = 1;
function updateOpening(y) {
  const fade = Math.min(Math.max((y - filmTop) / (0.035 * FILM_SCREENS * vh), 0), 1);
  const v = 1 - fade;
  if (Math.abs(v - openingShown) < 0.002) return;
  openingShown = v;
  opening.style.opacity = v.toFixed(3);
  opening.style.transform = reduceMotion ? '' : `translate3d(0, ${(-36 * fade).toFixed(1)}px, 0)`;
  opening.style.visibility = v <= 0 ? 'hidden' : '';
  root.classList.toggle('has-climbed', fade > 0.05);
}

// ---------- 5. The summit hero: revealed as the last shot settles ----------
// The headline rises line by line out of masks, then the words beneath it. Scrolling back down the
// mountain hides it again (quickly), and the film's own text returns.
let heroTl = null;
let heroIn = false;
function buildHeroReveal() {
  const tl = gsap.timeline({ paused: true });
  tl.add(lineReveal(heroEl.querySelector('.hero__title'), { stagger: 0.12 }).play(), 0);
  tl.fromTo(heroEl.querySelectorAll('.hero__sub, .hero__actions, .hero__place, .hero__scroll'),
    { opacity: 0, y: reduceMotion ? 0 : 14 },
    { opacity: 1, y: 0, duration: TIME.slow, ease: EASE.arrive, stagger: 0.12 }, reduceMotion ? 0 : 0.55);
  return tl;
}
function setHero(on) {
  if (on === heroIn) return;
  heroIn = on;
  root.classList.toggle('hero-in', on);
  heroEl.inert = !on;
  if (on) {
    heroTl ??= buildHeroReveal();
    heroTl.timeScale(1).play();
  } else if (heroTl) {
    heroTl.timeScale(2.5).reverse();
  }
}
heroEl.inert = true;

// ---------- 6. The top bar ----------
// Hidden during the film; it appears with the hero (see-through over it), and turns into a soft
// blurred bar once the hero has scrolled away.
function updateNav(y) {
  const below = y > heroScroll() + vh * 0.55;
  nav.classList.toggle('is-shown', heroIn || y > filmEnd());
  nav.classList.toggle('is-solid', below);
}
// "Pratul" goes back to the summit hero.
nav.querySelector('[data-to-top]').addEventListener('click', (e) => {
  e.preventDefault();
  lenis.scrollTo(heroScroll(), { duration: reduceMotion ? 0 : 1.6 });
});
// The hero's own "Scroll" link: glide to the next section.
heroEl.querySelector('.hero__scroll').addEventListener('click', (e) => {
  e.preventDefault();
  lenis.scrollTo('#services', { duration: reduceMotion ? 0 : 1.6 });
});

// ---------- One scroll listener for all of it ----------
// It only reads numbers it already knows (the scroll position and cached sizes), so it never
// forces the browser to recalculate the layout.
function onScroll() {
  const y = lenis.scroll;
  updateOpening(y);
  // The hero shows once the film has (almost) reached its last shot; it hides a little further
  // back up, so it doesn't flicker at the boundary.
  if (!heroIn && y > filmEnd() - vh * 0.08) setHero(true);
  else if (heroIn && y < filmEnd() - vh * 0.35) setHero(false);
  updateNav(y);
}
lenis.on('scroll', onScroll);
onScroll();

// Coming back from a case study (?return=...) the film puts us back on the trail; a hash link
// (#work, #contact) from another page should still land in the right place.
if (location.hash && location.hash !== '#hero' && !new URLSearchParams(location.search).get('return')) {
  const target = document.querySelector(location.hash);
  if (target) requestAnimationFrame(() => { lenis.start(); lenis.scrollTo(target, { immediate: true, offset: -72 }); });
}

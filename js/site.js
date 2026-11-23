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

import { gsap, ScrollTrigger, SplitText, lenis, reduceMotion, lineReveal, EASE, TIME } from './core.js';

const root = document.documentElement;
const film = document.getElementById('film');
const hint = document.querySelector('[data-hint]');
const opening = document.getElementById('opening');
const heroEl = document.getElementById('hero');
const nav = document.getElementById('site-nav');

// How the scroll is shared out, in screen heights (set once, in css/style.css): the film, then the
// hero holding, then the summit darkening, then the work forming over it (the hand-over, part 7).
const cssNumber = (name) => parseFloat(getComputedStyle(root).getPropertyValue(name));
const FILM_SCREENS = cssNumber('--film') || 13;
const HOLD = cssNumber('--hold') || 0.6;
const DARKEN = cssNumber('--darken') || 1;
const FORM = cssNumber('--form') || 0.9;
let vh = window.innerHeight;
let filmTop = film.offsetTop;
const filmEnd = () => filmTop + FILM_SCREENS * vh;                     // the last shot is reached
const heroScroll = () => filmTop + (FILM_SCREENS + HOLD * 0.5) * vh;   // the hero, settled
const handoverStart = () => filmTop + (FILM_SCREENS + HOLD) * vh;      // the summit starts to darken
const workFormed = () => handoverStart() + (DARKEN + FORM) * vh;       // the work is fully formed
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
  document.fonts.ready.then(buildHandover);
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
    ScrollTrigger.refresh();   // (the page is no longer pulled up under the film: css .no-film)
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
  const below = y > handoverStart() + vh * 0.5;
  nav.classList.toggle('is-shown', heroIn || y > filmEnd());
  nav.classList.toggle('is-solid', below);
}
// "Pratul" goes back to the summit hero.
// ("Pratul" in the top bar, "Back to the summit" in the footer.)
for (const a of document.querySelectorAll('[data-to-top]')) {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    lenis.scrollTo(heroScroll(), { duration: reduceMotion ? 0 : 2.2 });
  });
}
// Links to the work (the hero's "Explore my work", the top bar) land where the work has fully formed,
// not at the top of its section (where it is still forming over the summit).
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href="#work"]');
  if (!a || !root.classList.contains('handover')) return;
  e.preventDefault();
  e.stopPropagation();
  lenis.scrollTo(workFormed(), { duration: reduceMotion ? 0 : 1.8 });
}, true);

// ---------- 7. The hand-over: from the film to the page ----------
// Like the last shot of a film: the screen holds while the summit softly blurs and darkens into the
// page's colour, the hero's words lift away, and the work forms in its place, line by line. Nothing
// scrolls in. Everything is scrubbed by the scroll, so scrolling back up plays it in reverse.
//   0 → DARKEN          (the stage is pinned) words lift, the summit blurs and dims; meanwhile the
//                       work section rises behind it, still empty (css: .page is pulled up)
//   DARKEN → +FORM      (the work is pinned too: js/carousels/ridge.js) its heading forms over the
//                       dimmed summit; the summit sinks fully into the page colour, the film stops
//                       drawing, and the ridge fades in
function buildHandover() {
  const blur = document.querySelector('.handover__blur');
  const dim = document.querySelector('.handover__dim');
  const work = document.getElementById('work');
  const head = work.querySelector('.work__head');
  const title = head.querySelector('.heading');
  const lead = head.querySelector('.lead');
  const ridgeParts = [work.querySelector('.ridge__track'), work.querySelector('.ridge__controls')];
  root.classList.add('handover');
  // The heading's lines, each in its own mask, ready to rise (the same reveal as every heading).
  const lines = reduceMotion ? [] : SplitText.create(title, { type: 'lines', mask: 'lines', linesClass: 'split-line', aria: 'auto' }).lines;

  const D = DARKEN, F = FORM;
  const STOP = D + F * 0.78;   // the summit is fully covered: the film can stop drawing
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  // The hero's words lift and go first; the altitude label with them.
  tl.fromTo(heroEl.querySelector('.hero__inner'), { y: 0, autoAlpha: 1 }, { y: reduceMotion ? 0 : -40, autoAlpha: 0, duration: D * 0.55, ease: 'power1.in', immediateRender: false }, 0);
  tl.fromTo(heroEl.querySelector('.hero__place'), { autoAlpha: 1 }, { autoAlpha: 0, duration: D * 0.3, immediateRender: false }, 0);
  // The summit softens (the blurred picture fades in) and dims towards the page colour.
  if (!reduceMotion) tl.fromTo(blur, { autoAlpha: 0 }, { autoAlpha: 1, duration: D * 0.9, ease: 'power2.out' }, 0);
  tl.fromTo(dim, { autoAlpha: 0 }, { autoAlpha: 0.55, duration: D, ease: 'power1.inOut' }, 0);
  // The work forms: the head appears, its heading rises line by line, then the rest.
  tl.fromTo(head, { opacity: 0 }, { opacity: 1, duration: 0.01 }, D);
  if (lines.length) tl.fromTo(lines, { yPercent: 125 }, { yPercent: 0, duration: F * 0.45, ease: 'power3.out', stagger: F * 0.07 }, D);
  else tl.fromTo(title, { autoAlpha: 0 }, { autoAlpha: 1, duration: F * 0.3 }, D);
  tl.fromTo(lead, { autoAlpha: 0, y: reduceMotion ? 0 : 14 }, { autoAlpha: 1, y: 0, duration: F * 0.35, ease: 'power2.out' }, D + F * 0.22);
  // The summit sinks fully into the page colour, then the colour lifts off the ridge behind it.
  tl.to(dim, { autoAlpha: 1, duration: STOP - (D + F * 0.4), ease: 'power1.inOut' }, D + F * 0.4);
  tl.to(dim, { autoAlpha: 0, duration: D + F - STOP, ease: 'power1.out' }, STOP);
  tl.set(blur, { autoAlpha: 0 }, STOP);   // (hidden under the full colour by then)
  tl.fromTo(ridgeParts, { autoAlpha: 0, y: reduceMotion ? 0 : 14 }, { autoAlpha: 1, y: 0, duration: D + F - STOP, ease: 'power2.out' }, STOP);
  tl.set({}, {}, D + F);

  // On every frame (cheap: two comparisons), from where the timeline actually is. Not in a callback:
  // after a jump and a re-measure, GSAP can re-render the timeline without calling it.
  let snapped = false, covered = null;
  gsap.ticker.add(() => {
    const t = tl.time();
    // Take the blurred picture as the hand-over begins (the summit, as it looks right now).
    if (t > 0 && t < 0.25 && !snapped) { api?.snapshot(blur); snapped = true; }
    if (t === 0) snapped = false;
    // Once the summit is covered, the film stops drawing and the ridge may start (ridge.js).
    const now = t >= STOP;
    if (now !== covered) {
      covered = now;
      api?.pause(now);
      root.classList.toggle('work-ready', now);
    }
  });
  ScrollTrigger.create({
    start: () => handoverStart(),
    end: () => handoverStart() + (DARKEN + FORM) * vh,
    // A soft catch-up (as in King's Garden), so the hand-over glides rather than ticks.
    scrub: reduceMotion ? true : 1,
    animation: tl,
  });
  // The ridge's pin now starts with the forming stretch: measure everything again.
  ScrollTrigger.refresh();
}

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

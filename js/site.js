// site.js: the desktop page, before and around the 3D film.
//
// The order things happen in (DESIGN.md §8, "load in order"):
//   1. The page paints at once, under the loading screen (index.html, js/loader.js), which shows
//      how far the film has really loaded. Only this small file, GSAP and Lenis are needed here.
//   2. Once the browser is idle after loading, film.js (three.js and the whole world) is fetched
//      and built in short steps, so the page never freezes.
//   3. When the world and the trekker are ready, the loading screen reaches 100% and fades into
//      the live scene, and scrolling the film begins.
// The sections below the film get their scripts (pages.js) while the visitor is still up the
// mountain, and the 3D carousels only when they come near.

import { gsap, ScrollTrigger, SplitText, lenis, reduceMotion, lineReveal, EASE, TIME } from './core.js';
import { collapseWhenStill, collapsing } from './once.js';

const root = document.documentElement;
const film = document.getElementById('film');
const hint = document.querySelector('[data-hint]');
const opening = document.getElementById('opening');
const heroEl = document.getElementById('hero');
const nav = document.getElementById('site-nav');

// How the scroll is shared out, in screen heights (set once, in css/style.css): the film, then the
// hero holding, then the summit darkening, then Services forming over it (the hand-over, part 7).
const cssNumber = (name) => parseFloat(getComputedStyle(root).getPropertyValue(name));
const FILM_SCREENS = cssNumber('--film') || 13;
const HOLD = cssNumber('--hold') || 0.6;
const DARKEN = cssNumber('--darken') || 1;
const FORM = cssNumber('--form') || 0.9;
let vh = window.innerHeight;
let filmTop = film.offsetTop;
// The climb's length: FILM_SCREENS until it's finished, then 0 (see 8, "The climb plays once").
let filmScreens = FILM_SCREENS;
let filmFinished = false;
const filmEnd = () => filmTop + filmScreens * vh;                     // the last shot is reached
const heroScroll = () => filmTop + (filmScreens + HOLD * 0.5) * vh;   // the hero, settled
const handoverStart = () => filmTop + (filmScreens + HOLD) * vh;      // the summit starts to darken
const servicesFormed = () => handoverStart() + (DARKEN + FORM) * vh;   // Services has fully formed
window.addEventListener('resize', () => { vh = window.innerHeight; filmTop = film.offsetTop; onScroll(); });

// ---------- 1. Until the world is ready: the loading screen ----------
// (index.html and js/loader.js: snow spreads down a mountain as the film loads, then fades into it)
root.classList.add('is-loading');
lenis.stop();   // the film can't be scrolled before it exists
let api = null; // the film's controls, once it's ready (jump, glideToEnd...)
window.addEventListener('ascent:ready', (e) => {
  // (Arrived after we'd already given up on it, see withoutFilm: keep the page as it is, and stop
  // the film drawing under the picture.)
  if (root.classList.contains('no-film')) { e.detail.pause(true); return; }
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
  import('./film.js').catch((err) => withoutFilm('could not start', err));
}
// No 3D after all (an old graphics chip, a blocked CDN, a download that never finishes): keep the
// picture of the film's first frame, and let the page scroll.
function withoutFilm(why, err) {
  if (api || root.classList.contains('no-film')) return;
  console.error('[film] ' + why, err ?? '');
  root.classList.remove('is-loading');
  root.classList.add('no-film');
  hint.textContent = 'Scroll down';
  window.dispatchEvent(new CustomEvent('ascent:failed'));   // (the loading screen steps aside)
  lenis.start();
  ScrollTrigger.refresh();   // (the page is no longer pulled up under the film: css .no-film)
}
// The last safety net: if the film still isn't live 20 s after the page opened, the page carries on
// without it (normally it's live in about 3 s; the loading screen itself hands over after 8 s at most).
setTimeout(() => { if (!api) withoutFilm('took too long (over 20 s)'); }, Math.max(0, 20000 - performance.now()));
const whenIdle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 200));
// The poster has already painted by the time this file runs, and device.js fetched the film's files
// in the background, so start the film straight after the next frame: no waiting for every last
// picture on the page to load (the 'load' event) or for an idle moment.
requestAnimationFrame(() => setTimeout(loadFilm, 0));

// The sections' own script: fetched early but quietly, so it's there long before anyone scrolls down.
whenIdle(() => import('./pages/pages.js').then((m) => m.initPages({ lenis, desktop: true })));

// ---------- 3. "Skip the film" ----------
document.getElementById('skip').addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();   // (the same reason as the "Pratul" links below)
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
  // (Once the climb is finished, the opening never comes back: the top of the page is the summit.)
  const fade = filmFinished ? 1 : Math.min(Math.max((y - filmTop) / (0.035 * FILM_SCREENS * vh), 0), 1);
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
  tl.fromTo(heroEl.querySelectorAll('.hero__sub, .hero__actions, .hero__place, .hero__replay, .hero__scroll'),
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

// ---------- 6. The top bar: it steps aside while you read, and comes back when you ask ----------
// (references/round4/NavHero.dc.html)
//   - At the very top of the page it's always there, see-through over base camp.
//   - With the summit hero it's there too, see-through (the hero is the film's resting place).
//   - Scrolling down anywhere else: it slides away, so the film and the sections have the screen.
//   - Small or gentle upward scrolls change nothing. Only a deliberate scroll up brings it back:
//     NAV_UP px of continuous upward scrolling, or a quick upward flick. It then slides in as a soft
//     blurred bar.
//   - Pressing Tab into it (keyboard) always brings it back, and it stays while it has the focus.
// (Phones keep their own bar: js/pages/pages.js.)
const NAV_UP = 120;         // px of continuous upward scrolling that counts as "deliberate"
const NAV_FLICK = 18;       // a flick: the smooth scroll moving up faster than this (px per frame)
const NAV_UP_PAUSE = 600;   // ms: a pause longer than this starts the upward count again
let navShown = true;
let navUp = 0;              // how far we've scrolled up without stopping or turning back
let lastUpAt = 0;
let lastY = lenis.scroll;
let navFocused = false;
function updateNav(y) {
  const dy = y - lastY;
  lastY = y;
  const now = performance.now();
  if (dy > 0) navUp = 0;
  else if (dy < 0) {
    if (now - lastUpAt > NAV_UP_PAUSE) navUp = 0;   // (a fresh scroll up after a pause starts from zero)
    navUp -= dy;
    lastUpAt = now;
  }
  const atTop = y < 8;
  const atHero = heroIn && y < handoverStart();   // the hero is showing, not yet handing over
  let show = navShown;
  if (atTop || atHero || navFocused) show = true;
  else if (dy > 0.5) show = false;
  else if (navUp >= NAV_UP || lenis.velocity < -NAV_FLICK) show = true;
  navShown = show;
  nav.classList.toggle('is-shown', show);
  // See-through at the top and over the hero; a soft blurred bar everywhere else.
  // (It stays solid while it slides away, so it leaves as it arrived.)
  nav.classList.toggle('is-solid', !atTop && !atHero);
  // ("Skip the film" steps down out of its way while it's showing over the film: css/style.css)
  root.classList.toggle('nav-shown', show);
}
nav.addEventListener('focusin', () => { navFocused = true; updateNav(lenis.scroll); });
nav.addEventListener('focusout', (e) => {
  navFocused = nav.contains(e.relatedTarget);
  updateNav(lenis.scroll);
});
// "Pratul" goes back to the summit hero: the live last shot of the film, settled, with its words.
// ("Pratul" in the top bar, "Back to the summit" in the footer.) stopPropagation matters: Lenis
// has its own handler for # links on the window, and would otherwise replace this scroll with one to
// the #hero element, which sits inside the pinned stage and resolves to the end of the hand-over,
// where "Work that speaks for itself" has formed over the summit.
for (const a of document.querySelectorAll('[data-to-top]')) {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    lenis.scrollTo(heroScroll(), { duration: reduceMotion ? 0 : 2.2, force: true });
  });
}
// Links to Services (the top bar, the footer) land where its heading has fully formed: the first
// frame of its sequence. Links to the work (the hero's "Explore my work", the top bar, the footer)
// land at the start of its pinned ridge, where its heading and first project show. (Numbers, not the
// elements: Lenis would also subtract the page's scroll-padding, and a pinned section's own top
// moves while it's pinned.) stopPropagation: Lenis's own # link handler, on the window, would
// otherwise replace these scrolls.
function landingFor(hash) {
  if (hash === '#services') return servicesFormed();
  if (hash === '#work') {
    const work = document.getElementById('work');
    const pin = ScrollTrigger.getAll().find((t) => t.pin === work);
    return pin ? pin.start : work.getBoundingClientRect().top + lenis.scroll;
  }
  return null;
}
document.addEventListener('click', (e) => {
  // (not Services' own Skip link, which points at #work only as its no-script fallback)
  const a = e.target.closest('a[href="#services"], a[href="#work"]:not([data-svx-skip])');
  if (!a || !root.classList.contains('handover')) return;
  const y = landingFor(a.getAttribute('href'));
  e.preventDefault();
  e.stopPropagation();
  lenis.scrollTo(y, { duration: reduceMotion ? 0 : 1.8 });
}, true);

// ---------- 7. The hand-over: from the film to the page ----------
// Like the last shot of a film: the screen holds while the summit softly blurs and darkens into the
// page's colour, the hero's words lift away, and Services forms in its place: its heading rises line
// by line, then its stage comes up around it. Nothing scrolls in. Everything is scrubbed by the
// scroll, so scrolling back up plays it in reverse.
//   0 → DARKEN          (the film's stage is pinned) words lift, the summit blurs and dims; meanwhile
//                       the Services section rises over it, still unseen (css: .page is pulled up)
//   DARKEN → +FORM      (Services holds too: its stage is sticky, and its own sequence waits for this
//                       stretch, js/pages/services.js) its heading forms over the dimmed summit; the
//                       summit sinks fully into the page colour, the film stops drawing, and the
//                       Services stage (its colour, the small website, the intro) fades in around it
function buildHandover() {
  const blur = document.querySelector('.handover__blur');
  const dim = document.querySelector('.handover__dim');
  const services = document.querySelector('[data-svx]');
  const title = document.getElementById('services-title');
  const intro = services.querySelector('.svx__intro');
  root.classList.add('handover');
  // The heading's lines, each in its own mask, ready to rise (the same reveal as every heading).
  const lines = reduceMotion ? [] : SplitText.create(title, { type: 'lines', mask: 'lines', linesClass: 'split-line', aria: 'auto' }).lines;

  const D = DARKEN, F = FORM;
  const STOP = D + F * 0.78;   // the summit is fully covered: the film can stop drawing
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  // The hero's words lift and go first; the altitude label with them.
  tl.fromTo(heroEl.querySelector('.hero__inner'), { y: 0, autoAlpha: 1 }, { y: reduceMotion ? 0 : -40, autoAlpha: 0, duration: D * 0.55, ease: 'power1.in', immediateRender: false }, 0);
  // (The altitude label fades through a CSS variable, not its own opacity: the hero's reveal owns its
  // opacity, and a scrubbed fromTo would write "visible" onto it from the very start of the film,
  // where it sat on top of the film's altitude meter.)
  tl.fromTo(heroEl, { '--lift': 0 }, { '--lift': 1, duration: D * 0.3, immediateRender: false }, 0);
  // The summit softens (the blurred picture fades in) and dims towards the page colour.
  if (!reduceMotion) tl.fromTo(blur, { autoAlpha: 0 }, { autoAlpha: 1, duration: D * 0.9, ease: 'power2.out' }, 0);
  tl.fromTo(dim, { autoAlpha: 0 }, { autoAlpha: 0.55, duration: D, ease: 'power1.inOut' }, 0);
  // Services forms: its heading rises line by line over the dimmed summit, then the line beneath.
  tl.fromTo(title, { opacity: 0 }, { opacity: 1, duration: 0.01 }, D);
  if (lines.length) tl.fromTo(lines, { yPercent: 125 }, { yPercent: 0, duration: F * 0.45, ease: 'power3.out', stagger: F * 0.07 }, D);
  else tl.fromTo(title, { autoAlpha: 0 }, { autoAlpha: 1, duration: F * 0.3 }, D);
  tl.fromTo(intro, { autoAlpha: 0, y: reduceMotion ? 0 : 14 }, { autoAlpha: 1, y: 0, duration: F * 0.35, ease: 'power2.out' }, D + F * 0.22);
  // The summit sinks fully into the page colour, and stays covered.
  tl.to(dim, { autoAlpha: 1, duration: STOP - (D + F * 0.4), ease: 'power1.inOut' }, D + F * 0.4);
  tl.set(blur, { autoAlpha: 0 }, STOP);   // (hidden under the full colour by then)
  // Then the Services stage comes up around the heading: its glow, the small website and Skip.
  tl.fromTo(services, { '--svx-in': 0 }, { '--svx-in': 1, duration: D + F - STOP, ease: 'power2.out' }, STOP);
  tl.set({}, {}, D + F);

  // On every frame (cheap: two comparisons), from where the timeline actually is. Not in a callback:
  // after a jump and a re-measure, GSAP can re-render the timeline without calling it.
  let snapped = false, covered = null;
  gsap.ticker.add(() => {
    const t = tl.time();
    // Take the blurred picture as the hand-over begins (the summit, as it looks right now).
    if (t > 0 && t < 0.25 && !snapped) { api?.snapshot(blur); snapped = true; }
    if (t === 0) snapped = false;
    // Once the summit is covered, the film stops drawing, and the work's 3D ridge may use the
    // shared canvas when it's reached (.work-ready, js/carousels/ridge.js).
    const now = t >= STOP;
    if (now !== covered) {
      covered = now;
      api?.pause(now);
      root.classList.toggle('work-ready', now);
    }
  });
  ScrollTrigger.create({
    start: () => handoverStart(),
    end: () => servicesFormed(),
    // A soft catch-up (as in King's Garden), so the hand-over glides rather than ticks.
    scrub: reduceMotion ? true : 1,
    animation: tl,
  });
  ScrollTrigger.refresh();
}

// ---------- 8. The climb plays once (going down only), and "Replay the climb" ----------
// Once the visitor reaches the summit hero, the climb is finished: the film holds its last shot, and
// scrolling back up never plays it in reverse. When the scroll is next at rest, the climb's 13
// screens are removed (css: html.film-done), with the scroll shifted by the same amount in the same
// moment, so nothing moves on screen and the top of the page is now the summit hero (js/once.js).
// The hand-over from the summit into Services stays as it is, so scrolling up still comes back to
// the summit. "Replay the climb" (in the hero) puts the climb back and plays it from base camp.
function finishClimb() {
  filmFinished = true;
  api.finish();
  root.classList.add('climb-done');   // (shows "Replay the climb", css/home.css)
  collapseWhenStill('the climb', () => {
    if (!filmFinished) return false;   // (replayed before the scroll came to rest)
    filmScreens = 0;
    root.classList.add('film-done');
    filmTop = film.offsetTop;
  }, document.querySelector('.page'));
}
async function replayClimb() {
  if (!api || !filmFinished) return;
  await api.replay(() => {
    filmFinished = false;
    filmScreens = FILM_SCREENS;
    root.classList.remove('film-done', 'climb-done');
    setHero(false);
    ScrollTrigger.refresh();
    lenis.resize();
    lenis.scrollTo(0, { immediate: true, force: true });
    onScroll();
  });
}
document.querySelector('[data-replay]')?.addEventListener('click', replayClimb);

// ---------- One scroll listener for all of it ----------
// It only reads numbers it already knows (the scroll position and cached sizes), so it never
// forces the browser to recalculate the layout.
function onScroll() {
  const y = lenis.scroll;
  updateOpening(y);
  // The hero shows once the film has (almost) reached its last shot; it hides a little further
  // back up, so it doesn't flicker at the boundary.
  if (!heroIn && (filmFinished || y > filmEnd() - vh * 0.08)) setHero(true);
  else if (heroIn && !filmFinished && y < filmEnd() - vh * 0.35) setHero(false);
  // The summit hero reached, with the film really there: the climb is finished for this visit.
  if (heroIn && !filmFinished && api && api.progress > 0.995 && !collapsing()) finishClimb();
  updateNav(y);
}
lenis.on('scroll', onScroll);
onScroll();

// Coming back from a case study (?return=...) the film puts us back on the trail; a hash link
// (#work, #contact) from another page should still land in the right place.
if (location.hash && location.hash !== '#hero' && !new URLSearchParams(location.search).get('return')) {
  const target = document.querySelector(location.hash);
  // (#services and #work: the same landing points as the links above)
  // (lenis.resize: Lenis measures the page length itself, a moment late; without it the last sections
  // would be clamped to the old, shorter page)
  const land = () => { lenis.resize(); lenis.scrollTo(landingFor(location.hash) ?? target, { immediate: true, force: true, offset: landingFor(location.hash) === null ? -72 : 0 }); };
  if (target) {
    requestAnimationFrame(() => { lenis.start(); land(); });
    // The work's 3D ridge arrives a little later and its pin adds scroll length above the sections
    // after it, which would leave us short of #process, #about or #contact. So each time the page is
    // re-measured, land again, until the visitor moves for themselves.
    let waiting = true;
    const stop = () => { waiting = false; };
    for (const type of ['wheel', 'pointerdown', 'keydown', 'touchstart']) window.addEventListener(type, stop, { once: true, passive: true });
    setTimeout(stop, 20000);
    ScrollTrigger.addEventListener('refresh', () => { if (waiting) land(); });
    // (and whenever the page's height changes for any other reason: fonts, pictures, the Tools ribbon)
    new ResizeObserver(() => { if (waiting) requestAnimationFrame(land); }).observe(document.querySelector('.page'));
  }
}

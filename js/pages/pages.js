// pages.js: everything below the film: the top bar, services (services.js), the work ridge (or slider), the
// process trail, about, the tools, the contact form and the showreel.
//
// Desktop (site.js) and the phone page (mobile/mobile.js) both use it. Phones get no animation
// library and no 3D: everything here works with plain CSS transitions and the browser's own
// scrolling. On desktop, the two 3D carousels are fetched only when their section comes near.

import { initProcess } from './process.js';
import { initTools } from './tools.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isFilm = !document.documentElement.classList.contains('mobile-site');

// lenis: the smooth scroller on desktop, or on the phone page a small stand-in with the same
// scrollTo() that uses the browser's own scrolling (js/mobile/mobile.js).
// pause (desktop, optional): an async function called between the steps below. Desktop sets the
// sections up while the film is already playing, and all at once they held it for ~60 ms (a visible
// stutter); with a quiet moment between the steps, each piece is short. (Phones don't pass one, so
// for them everything runs at once, exactly as before.)
export async function initPages({ lenis, desktop = false, pause = null }) {
  // Desktop already has GSAP loaded (core.js); phones never load it.
  const core = desktop ? await import('../core.js') : null;
  const steps = [
    initNav,
    initMenu,
    // (the exploded-website Services is desktop only: phones never download it)
    () => { if (core) import('./services.js').then((m) => m.initServices({ core, lenis })); },
    () => initServiceCards({ lenis }),
    () => initWork({ core }),
    initWorkFilter,
    () => initProcess({ core }),
    initAbout,
    initFooter,
    initTestimonial,
    initTools,
    () => initContact({ lenis }),
    () => initPlaceholders({ lenis }),
    initShowreel,
    () => initReveal({ core }),
  ];
  for (const run of steps) {
    if (pause) await pause();
    run();
  }
}

// Run fn once, when el comes within `margin` of the screen.
function whenNear(el, fn, margin = '100% 0px') {
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    fn();
  }, { rootMargin: margin });
  io.observe(el);
}
// Toggle .is-in on el while it's (mostly) on screen; once only, unless `again`.
function markIn(el, { margin = '0px 0px -20% 0px', again = false } = {}) {
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { el.classList.add('is-in'); if (!again) io.disconnect(); }
    else if (again) el.classList.remove('is-in');
  }, { rootMargin: margin });
  io.observe(el);
}

// ---------- The top bar ----------
// Desktop: site.js slides it away as you scroll down and back on a clear scroll up. Phones: it's always there, and turns into a
// soft bar once the hero has scrolled away. Both: the link of the section being read is marked.
function initNav() {
  const nav = document.getElementById('site-nav');
  if (!isFilm) {
    const hero = document.getElementById('hero');
    new IntersectionObserver(([e]) => nav.classList.toggle('is-solid', !e.isIntersecting), { rootMargin: '-80px 0px 0px' }).observe(hero);
    for (const a of document.querySelectorAll('[data-to-top]')) {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    }
  }
  const links = [...nav.querySelectorAll('.nav__links > a[href^="#"]:not(.btn)')];   // (in-page links only)
  const sections = links.map((a) => document.querySelector(a.getAttribute('href')));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach((a, i) => (sections[i] === e.target ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => s && io.observe(s));
}

// ---------- The phone menu ----------
// Escape, choosing a link, or tapping anywhere outside closes it again.
function initMenu() {
  const nav = document.getElementById('site-nav');
  const button = nav.querySelector('.nav__menu');
  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
  };
  button.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  nav.querySelector('.nav__links').addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); button.focus(); }
  });
  document.addEventListener('pointerdown', (e) => { if (!nav.contains(e.target)) setOpen(false); });
}

// ---------- Phones: the three service cards ----------
// Tapping one opens the contact form with that need already chosen in the "What do you need?" menu.
function initServiceCards({ lenis }) {
  for (const card of document.querySelectorAll('.scard')) {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      const menu = document.getElementById('f-need');
      if (menu && !menu.disabled) menu.value = card.dataset.need;
      lenis.scrollTo('#contact', { duration: reduceMotion ? 0 : 1.2 });
    });
  }
}

// ---------- Phones: the work filter chips ----------
// Each chip shows only the projects with that tag (data-tags); "All" shows them all. The pressed
// chip says so to screen readers (aria-pressed).
function initWorkFilter() {
  const chips = [...document.querySelectorAll('.wchip')];
  const cards = [...document.querySelectorAll('.wcard')];
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      const want = chip.dataset.filter;
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      cards.forEach((card) => { card.hidden = want !== 'all' && !card.dataset.tags.split(' ').includes(want); });
    });
  }
}

// ---------- Work: the 3D ridge (desktop) or the swipe slider ----------
function initWork({ core }) {
  const root = document.querySelector('[data-ridge]');
  const track = root.querySelector('[data-track]');
  const slides = [...track.querySelectorAll('.slide')];
  const current = root.querySelector('[data-current]');
  const prev = root.querySelector('[data-prev]');
  const next = root.querySelector('[data-next]');
  let index = -1;
  let ridge = null;   // the 3D ridge, once loaded

  // Show project i: the counter, the buttons, and (with 3D) which words are shown.
  function show(i) {
    if (i === index) return;
    index = i;
    current.textContent = String(i + 1).padStart(2, '0');
    prev.disabled = i === 0;
    next.disabled = i === slides.length - 1;
    slides.forEach((s, n) => {
      s.classList.toggle('is-current', n === i);
      if (ridge) s.inert = n !== i;   // only the front project's link can be reached
    });
  }
  function go(i) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    if (ridge) { ridge.goTo(i); return; }
    const s = slides[i];
    track.scrollTo({ left: s.offsetLeft - track.offsetLeft - parseFloat(getComputedStyle(track).paddingLeft), behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  prev.addEventListener('click', () => go(index - 1));
  next.addEventListener('click', () => go(index + 1));
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
  });
  // The slider: whichever slide is nearest its resting place is the current one.
  let ticking = false;
  track.addEventListener('scroll', () => {
    if (ticking || ridge) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      let best = 0, dist = Infinity;
      slides.forEach((s, n) => {
        const d = Math.abs(s.offsetLeft - track.offsetLeft - parseFloat(getComputedStyle(track).paddingLeft) - track.scrollLeft);
        if (d < dist) { dist = d; best = n; }
      });
      show(best);
    });
  }, { passive: true });
  show(0);

  // Back from a case study on the phone page (?return=dermae): open the slider on that project.
  const back = new URLSearchParams(location.search).get('return');
  const at = slides.findIndex((s) => s.dataset.slug === back);
  if (at > 0 && !isFilm) requestAnimationFrame(() => { go(at); show(at); });

  // Desktop with 3D: load the ridge once the film is ready and the browser is idle (or sooner, if
  // the section comes near). Its pinned walk adds scroll length to the page, so it must exist before
  // anyone jumps further down (a nav link), or the jump would be measured on the old page length.
  if (core && !document.documentElement.classList.contains('no-film')) {
    let started = false;
    const load = async () => {
      if (started) return;
      started = true;
      try {
        const { createRidge } = await import('../carousels/ridge.js');
        ridge = await createRidge({ root, slides, core, onChange: show });
        index = -1;
        show(ridge.index);
      } catch (err) {
        console.error('[ridge] staying with the slider', err);
      }
    };
    whenNear(root, load, '150% 0px');
    // (Not the moment the film appears: building the ridge then made the film's first frames stutter.
    // A few seconds later, at the next quiet moment, while the visitor is still reading the opening.)
    const soon = () => setTimeout(() => ('requestIdleCallback' in window ? requestIdleCallback(load, { timeout: 2500 }) : load()), 3000);
    if (window.__ascent?.ready) soon();
    else window.addEventListener('ascent:ready', soon, { once: true });
  }
}

// ---------- About: the portrait's mask opens as the section arrives ----------
function initAbout() {
  markIn(document.getElementById('about'), { margin: '0px 0px -25% 0px' });
  initSignature();
}

// ---------- About: my signature writes itself, once ----------
// The pen strokes are in index.html and css/home.css. Here we only say when: once most of the signature
// is on screen, it writes itself (about 2 s), then the mask comes off so the finished signature is
// exactly the real one. It plays once per visit. Under "reduce motion" it is simply there, already written.
function initSignature() {
  const sig = document.querySelector('.about__signature');
  if (!sig || !sig.getClientRects().length) return;   // (hidden on phones)
  // The picture itself is fetched only once About is near (about a screen away).
  const image = sig.querySelector('image[data-href]');
  // (an observer can deliver several updates at once after a quick jump: the newest one counts)
  const latest = (entries) => entries[entries.length - 1];
  new IntersectionObserver((entries, io) => {
    if (!latest(entries).isIntersecting) return;
    image.setAttribute('href', image.dataset.href);
    io.disconnect();
  }, { rootMargin: '100% 0px' }).observe(sig);
  if (reduceMotion) return;   // (simply shown, already written)
  sig.classList.add('is-ready');   // out of sight, waiting for its moment
  const io = new IntersectionObserver((entries) => {
    if (!latest(entries).isIntersecting) return;
    io.disconnect();
    sig.classList.add('is-writing');
    // (the last stroke ends at 2.0 s; a moment later the mask is lifted)
    setTimeout(() => sig.classList.add('is-signed'), 2300);
  }, { threshold: 0.75 });
  io.observe(sig);
}

// ---------- The footer: its picture settles softly into place as it arrives ----------
function initFooter() {
  const footer = document.querySelector('.footer');
  if (reduceMotion) footer.classList.add('is-in');
  else markIn(footer, { margin: '0px 0px -10% 0px' });
}

// ---------- The testimonial: shown only once a real quote has been written in ----------
function initTestimonial() {
  const section = document.getElementById('testimonial');
  section.hidden = section.querySelector('[data-quote]').textContent.trim() === '';
}

// ---------- Contact ----------
// The lantern brightens as the section arrives. On the film, "Send a message" opens the form in
// place. The fields are checked kindly before sending. Until the Formspree form is connected (the
// action still says FORMSPREE_ENDPOINT), it says so plainly instead of pretending to send.
function openForm(focus = true) {
  const form = document.getElementById('contact-form');
  form.classList.add('is-open');
  document.getElementById('contact').classList.add('has-form');   // (desktop: the form takes the right column)
  document.querySelector('[data-open-form]')?.setAttribute('aria-expanded', 'true');
  if (focus) form.elements.name.focus({ preventScroll: true });
}
// Desktop: the form card is taller than the words beside it, so centred in the row it hung below the
// "Book a 20-min call" button, and on shorter windows down to the foot of the section. This moves the
// card (only the card) up so its bottom lines up with the bottom of the left column; never so far that
// its top comes closer than 16 px to the top of the section. (Measured, because both heights change
// with the window's size; it sets one CSS variable on the two-column container, read by the card's rule
// in css/home.css, and by the left column's, which starts at the card's top.)
function liftFormCard(card) {
  const section = document.getElementById('contact');
  const words = section.querySelector('.contact__words');
  const row = card.parentElement;   // (the two columns)
  const place = () => {
    row.style.setProperty('--card-lift', '0px');
    const c = card.getBoundingClientRect();
    // How far below the button the card would end with the words centred beside it, from the two heights
    // alone (so it doesn't depend on where the left column is placed). (The left column is measured without
    // the headline's small negative margin, which lines its capitals up with the card's top: that margin
    // must not move the card. Switched off and back on at once, so nothing is ever drawn without it.)
    const head = words.firstElementChild;
    head.style.marginTop = '0px';
    const wordsHeight = words.getBoundingClientRect().height;
    head.style.marginTop = '';
    const hang = (c.height - wordsHeight) / 2;
    const room = c.top - section.getBoundingClientRect().top - 16;  // how far it can go up
    row.style.setProperty('--card-lift', `${Math.max(0, Math.min(hang, room)).toFixed(1)}px`);
  };
  // Again whenever the words or the section change size (the fonts arriving, the headline's lines being
  // split for their reveal, the window being resized). Moving the card changes no sizes, so this settles.
  let raf = 0;
  const later = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); };
  const watch = new ResizeObserver(later);
  watch.observe(words);
  watch.observe(section);
  document.fonts.ready.then(later);
}

function initContact({ lenis }) {
  markIn(document.getElementById('contact'), { margin: '0px 0px -30% 0px' });
  const form = document.getElementById('contact-form');
  if (isFilm) liftFormCard(form);
  // Each version shows its own way of choosing a need (desktop: chips; phones: one menu, and no
  // "business" field). Whatever isn't shown is switched off, so it's never sent with the form.
  const menu = document.getElementById('f-need');
  if (isFilm) menu.disabled = true;
  else {
    form.querySelector('.form__needs').disabled = true;
    // Phones: the label sits inside each field, as a placeholder (the real label is still there,
    // hidden, for screen readers).
    const hints = { 'f-name': 'Your name', 'f-email': 'Your email', 'f-message': 'Your message' };
    for (const [id, text] of Object.entries(hints)) document.getElementById(id).placeholder = text;
  }
  const status = document.getElementById('form-status');
  const button = form.querySelector('button[type="submit"]');
  document.querySelector('[data-open-form]')?.addEventListener('click', () => {
    openForm();
    lenis.scrollTo('#contact-form', { offset: -140, duration: reduceMotion ? 0 : 1.2 });
  });
  const say = (text, isError = false) => {
    status.textContent = text;
    status.classList.toggle('is-error', isError);
  };
  const fieldError = (input, message) => {
    input.closest('.field').classList.toggle('has-error', !!message);
    document.getElementById(`${input.id}-err`).textContent = message || '';
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  };
  function check() {
    const problems = [];
    const { name, email, message } = form.elements;
    fieldError(name, name.value.trim() ? '' : 'Please tell me your name.');
    if (!name.value.trim()) problems.push(name);
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
    fieldError(email, emailOk ? '' : email.value.trim() ? 'That email doesn\'t look quite right: check for a typo?' : 'Please add your email, so I can reply.');
    if (!emailOk) problems.push(email);
    fieldError(message, message.value.trim().length >= 10 ? '' : 'A sentence or two about your project helps me reply properly.');
    if (message.value.trim().length < 10) problems.push(message);
    return problems;
  }
  form.addEventListener('input', (e) => { if (e.target.closest('.field.has-error')) check(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const problems = check();
    if (problems.length) {
      say('A few details need a look before this can be sent.', true);
      problems[0].focus();
      return;
    }
    if (form.action.includes('FORMSPREE_ENDPOINT')) {
      say('Sorry: this form isn\'t switched on yet, so your message wasn\'t sent. Your message is still here, ready to copy.', true);
      return;
    }
    button.disabled = true;
    say('Sending…');
    try {
      const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const done = document.createElement('div');
      done.className = 'form-done';
      done.setAttribute('role', 'status');
      done.tabIndex = -1;
      done.innerHTML = '<h3>Thank you. Your message is on its way.</h3><p>I\'ll read it properly and reply to the email you gave.</p>';
      form.replaceWith(done);
      done.focus();
    } catch {
      button.disabled = false;
      say('Sorry, the message couldn\'t be sent just now. Please try again in a moment.', true);
    }
  });
}

// ---------- Links that are still placeholders ----------
// Until Pratul fills in the real booking link, email and social links, these lead to the contact
// form with a short note instead of a broken page.
function initPlaceholders({ lenis }) {
  for (const a of document.querySelectorAll('[data-placeholder]')) {
    if (!a.getAttribute('href').includes(a.dataset.placeholder)) continue;
    a.removeAttribute('target');
    a.addEventListener('click', (e) => {
      e.preventDefault();
      openForm(false);
      document.getElementById('form-status').textContent = 'That link isn\'t set up yet. This form reaches me just as well.';
      lenis.scrollTo('#contact-form', { offset: -140, duration: reduceMotion ? 0 : 1.2 });
      document.getElementById('f-name').focus({ preventScroll: true });
    });
  }
}

// ---------- The showreel ----------
// A <dialog> (the browser's own lightbox: it traps focus and closes with Escape). The video is only
// fetched when it's opened, and it stops when it's closed.
function initShowreel() {
  const dialog = document.getElementById('showreel');
  const video = dialog.querySelector('video');
  const length = document.querySelector('[data-reel-length]');
  video.addEventListener('loadedmetadata', () => {
    const s = Math.round(video.duration);
    if (length && s) length.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });
  for (const b of document.querySelectorAll('[data-showreel]')) {
    b.addEventListener('click', () => {
      dialog.showModal();
      requestAnimationFrame(() => dialog.classList.add('is-open'));
      video.play().catch(() => {});
    });
  }
  const close = () => {
    dialog.classList.remove('is-open');
    video.pause();
    setTimeout(() => dialog.close(), reduceMotion ? 0 : 350);
  };
  dialog.querySelector('[data-close-reel]').addEventListener('click', close);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
}

// ---------- Arrivals ----------
// Desktop: each section heading is set line by line as it arrives (the same reveal as the film's
// words). Everywhere: the blocks beneath fade up softly, once, a beat after one another.
function initReveal({ core }) {
  if (reduceMotion) return;
  if (core) {
    // (The Services heading is formed by the film's hand-over instead: js/site.js. Without the live
    // film, .no-film, there is no hand-over, so it arrives like every other heading.)
    const formed = !document.documentElement.classList.contains('no-film');
    const headings = [...document.querySelectorAll('.page .heading')].filter((h) => !(formed && h.id === 'services-title'));
    headings.forEach((h) => { h.style.opacity = '0'; });
    // Split into lines only once the real fonts have arrived: lines measured in the fallback font
    // break in the wrong places (and a too-small mask cuts the letters).
    document.fonts.ready.then(() => {
      for (const h of headings) {
        const tl = core.lineReveal(h, { stagger: 0.1 });
        core.ScrollTrigger.create({ trigger: h, start: 'top 82%', once: true, onEnter: () => tl.play() });
      }
    });
  }
  // (Desktop: the contact section's words and button don't slide up into place: they sit still where they
  // are, so nothing in that section moves while scrolling towards the footer.)
  const items = document.querySelectorAll((core ? '.page section:not(.contact) .lead' : '.page section .lead, .contact__actions') + ', .scards__list li, .wcard, .about__short, .about__photo, .about__standfirst, .about__story, .about__values, .about__promises, .quote__fig, .footer__call, .footer__col' + (core ? '' : ', .page .heading, .ridge__controls, .work .lead'));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
      // Once arrived, hand the element back to its own styles (so later hovers aren't delayed).
      e.target.addEventListener('transitionend', () => { e.target.classList.remove('reveal', 'is-in'); e.target.style.transitionDelay = ''; }, { once: true });
    }
  }, { rootMargin: '0px 0px -10% 0px' });
  const count = new Map();
  items.forEach((el) => {
    const group = el.closest('section, footer');
    const n = count.get(group) || 0;
    count.set(group, n + 1);
    el.classList.add('reveal');
    el.style.transitionDelay = `${Math.min(n, 5) * 0.08}s`;
    io.observe(el);
  });
}

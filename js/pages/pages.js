// pages.js: everything after the film's summit hero: the top bar, the work slider, the showreel,
// the About toggle, the testimonial, the tools carousel and the contact form.
// The film (js/film.js) loads it once the visitor nears the end of the film; the phone page
// (js/mobile/mobile.js) loads it straight away. Nothing here needs 3D or an animation library.

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isFilm = !document.documentElement.classList.contains('mobile-site');

// lenis: the film's smooth scroller, or on the phone page a small stand-in with the same
// scrollTo() that uses the browser's own scrolling (js/mobile/mobile.js).
export function initPages({ lenis }) {
  initNav({ lenis });
  initSlider();
  initShowreel();
  initAbout();
  initTestimonial();
  initCarousel();
  initContact({ lenis });
  initPlaceholders({ lenis });
  if (isFilm) initReveal();
}

// ---------- The top bar ----------
// Film: hidden during the film; it appears (see-through) as the hero fades in (film.js puts
// .hero-in on <html>), and turns into soft glass once the hero has scrolled away.
// Phone: always there; glass once you've scrolled past the hero.
function initNav({ lenis }) {
  const nav = document.getElementById('site-nav');
  const hero = document.getElementById('hero');
  const film = document.getElementById('film');
  const root = document.documentElement;
  const update = () => {
    const past = hero.getBoundingClientRect().bottom < 90;
    nav.classList.toggle('is-shown', !isFilm || root.classList.contains('hero-in') || film.getBoundingClientRect().bottom < window.innerHeight * 0.5);
    nav.classList.toggle('is-solid', past);
  };
  window.addEventListener('scroll', update, { passive: true });
  // (.hero-in changes while the film plays, so also check it a few times a second.)
  if (isFilm) setInterval(update, 250);
  update();

  // "Pratul" goes back to the summit hero: on the film that's the end of the film section (the
  // hero fully faded in), on the phone page it's the top.
  nav.querySelector('[data-to-top]').addEventListener('click', (e) => {
    e.preventDefault();
    const top = isFilm ? film.offsetTop + film.offsetHeight - window.innerHeight : 0;
    lenis.scrollTo(top, { duration: reduceMotion ? 0 : 1.6 });
  });

  // Mark the link of the section we're reading (the one crossing the middle of the screen).
  const links = [...nav.querySelectorAll('.h-nav__links a')];
  const sections = links.map((a) => document.querySelector(a.getAttribute('href')));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach((a, i) => (sections[i] === e.target ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => s && io.observe(s));
}

// ---------- The work slider ----------
// The track scrolls sideways by itself (a swipe, a trackpad, the keyboard). The arrows move it one
// slide at a time; "01 / 03" and the progress line follow whichever slide is in the middle.
function initSlider() {
  const root = document.querySelector('[data-slider]');
  const track = root.querySelector('.slider__track');
  const slides = [...track.querySelectorAll('.slide')];
  const current = root.querySelector('[data-current]');
  const bar = root.querySelector('[data-progress]');
  const prev = root.querySelector('[data-prev]');
  const next = root.querySelector('[data-next]');
  let index = 0;

  // Which slide's middle is closest to the track's middle.
  function nearest() {
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0, dist = Infinity;
    slides.forEach((s, i) => {
      const d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - mid);
      if (d < dist) { dist = d; best = i; }
    });
    return best;
  }
  function show(i) {
    index = i;
    current.textContent = String(i + 1).padStart(2, '0');
    bar.style.transform = `scaleX(${(i + 1) / slides.length})`;
    prev.disabled = i === 0;
    next.disabled = i === slides.length - 1;
    slides.forEach((s, n) => s.classList.toggle('is-current', n === i));
  }
  function go(i) {
    const s = slides[Math.max(0, Math.min(slides.length - 1, i))];
    track.scrollTo({ left: s.offsetLeft - (track.clientWidth - s.offsetWidth) / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  prev.addEventListener('click', () => go(index - 1));
  next.addEventListener('click', () => go(index + 1));
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
  });
  let ticking = false;
  track.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; const i = nearest(); if (i !== index) show(i); });
  }, { passive: true });
  show(0);

  // Back from a case study on the phone page (?return=dermae): open the slider on that project.
  const back = new URLSearchParams(location.search).get('return');
  const at = slides.findIndex((s) => s.dataset.slug === back);
  if (at > 0 && !isFilm) requestAnimationFrame(() => { track.scrollLeft = slides[at].offsetLeft - (track.clientWidth - slides[at].offsetWidth) / 2; show(at); });
}

// ---------- The showreel ----------
// A <dialog> (the browser's own lightbox: it traps focus and closes with Escape). The video is only
// fetched when it's opened, and it stops when it's closed.
function initShowreel() {
  const dialog = document.getElementById('showreel');
  const video = dialog.querySelector('video');
  const length = document.querySelector('[data-reel-length]');
  // Show the real length, read from the file itself once it's known.
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
    // Let the soft fade finish, then close for real.
    setTimeout(() => dialog.close(), reduceMotion ? 0 : 350);
  };
  dialog.querySelector('[data-close-reel]').addEventListener('click', close);
  // A click on the dark backdrop (outside the video) closes it too.
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
}

// ---------- About: "More about me" opens the rest of the story in place ----------
function initAbout() {
  const button = document.querySelector('[data-about-more]');
  const more = document.getElementById('about-more');
  button.addEventListener('click', () => {
    const open = more.hidden;
    more.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.querySelector('[data-label]').textContent = open ? 'Show less' : 'More about me';
  });
}

// ---------- The testimonial: shown only once a real quote has been written in ----------
function initTestimonial() {
  const section = document.getElementById('testimonial');
  const quote = section.querySelector('[data-quote]');
  section.hidden = quote.textContent.trim() === '';
}

// ---------- The tools carousel: a touch pauses it (a mouse pauses it with CSS :hover) ----------
function initCarousel() {
  const c = document.querySelector('[data-carousel]');
  let resume;
  c.addEventListener('touchstart', () => { clearTimeout(resume); c.classList.add('is-paused'); }, { passive: true });
  c.addEventListener('touchend', () => { resume = setTimeout(() => c.classList.remove('is-paused'), 1500); });
}

// ---------- Sections rise in gently as they arrive (film only: the phone page stays still) ----------
function initReveal() {
  if (reduceMotion) return;
  const items = document.querySelectorAll('.h-head, .card, .slider, .step, .about__main, .about__stats, .carousel, .contact__inner, .h-footer__grid');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -12% 0px' });
  items.forEach((el, i) => {
    el.classList.add('reveal');
    // Cards in one row arrive one after another.
    if (el.matches('.card, .step')) el.style.transitionDelay = `${(i % 4) * 0.08}s`;
    io.observe(el);
  });
}

// ---------- Contact form ----------
// On the film, "Send a message" opens the form in place. The fields are checked kindly before
// sending. Until the Formspree form is connected (the action still says FORMSPREE_ENDPOINT), it
// says so plainly instead of pretending to send.
function openForm(focus = true) {
  const form = document.getElementById('contact-form');
  form.classList.add('is-open');
  document.querySelector('[data-open-form]')?.setAttribute('aria-expanded', 'true');
  if (focus) form.elements.name.focus({ preventScroll: true });
}
function initContact({ lenis }) {
  const form = document.getElementById('contact-form');
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
  // Clear a field's error as soon as it's fixed.
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
      done.className = 'h-form-done';
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
    a.addEventListener('click', (e) => {
      e.preventDefault();
      openForm(false);
      document.getElementById('form-status').textContent = 'That link isn\'t set up yet. This form reaches me just as well.';
      lenis.scrollTo('#contact-form', { offset: -140, duration: reduceMotion ? 0 : 1.2 });
      document.getElementById('f-name').focus({ preventScroll: true });
    });
  }
}

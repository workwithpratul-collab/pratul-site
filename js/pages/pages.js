// pages.js: everything below the film (loaded by main.js only once the visitor nears the end of
// the film, so none of it slows the film down).

import { initDemos } from './demos.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initPages({ lenis }) {
  initNav();
  initDemos({ lenis });
  initWork();
  initSteps();
  initContact({ lenis });
  initPlaceholders({ lenis });
}

// ---------- The top navigation: only once the film has scrolled away ----------
function initNav() {
  const nav = document.getElementById('site-nav');
  const film = document.getElementById('film');
  const links = [...nav.querySelectorAll('.site-nav__links a:not(.btn)')];
  const update = () => {
    // Once the film has mostly left the screen (its bottom edge above the middle).
    nav.classList.toggle('is-shown', film.getBoundingClientRect().bottom < window.innerHeight * 0.5);
  };
  window.addEventListener('scroll', update, { passive: true });
  update();
  // Mark the link of the section we're reading (the one crossing the middle of the screen).
  const sections = links.map((a) => document.querySelector(a.getAttribute('href')));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach((a, i) => {
        if (sections[i] === e.target) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => s && io.observe(s));
}

// ---------- Work cards: the still gently gives way to the muted, looping video ----------
// The video file is only fetched the first time someone hovers (or focuses) a card.
function initWork() {
  for (const card of document.querySelectorAll('.work-card')) {
    const media = card.querySelector('.work-card__media');
    let video = null;
    const play = () => {
      if (reduceMotion) return;
      if (!video) {
        video = document.createElement('video');
        Object.assign(video, { muted: true, loop: true, playsInline: true, preload: 'auto' });
        video.setAttribute('aria-hidden', 'true');
        video.src = card.dataset.video;
        media.appendChild(video);
      }
      video.play().then(() => card.classList.add('is-playing')).catch(() => {});
    };
    const pause = () => {
      card.classList.remove('is-playing');
      // Pause once the still has faded back in.
      setTimeout(() => { if (video && !card.classList.contains('is-playing')) video.pause(); }, 900);
    };
    card.addEventListener('pointerenter', play);
    card.addEventListener('pointerleave', pause);
    card.addEventListener('focusin', play);
    card.addEventListener('focusout', pause);
  }
}

// ---------- How I work: the four waypoints light up one by one as you scroll ----------
function initSteps() {
  const list = document.querySelector('.steps');
  const steps = [...list.querySelectorAll('.step')];
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) e.target.classList.add('is-lit');
    const lit = steps.filter((s) => s.classList.contains('is-lit')).length;
    // The trail line reaches the last lit waypoint.
    list.style.setProperty('--trail', lit <= 1 ? 0 : (lit - 1) / (steps.length - 1));
  }, { rootMargin: '0px 0px -35% 0px' });
  steps.forEach((s, i) => {
    // Waypoints further along the trail light a little later, even if they arrive on screen
    // together (on a wide screen all four sit in one row).
    s.style.transitionDelay = reduceMotion ? '0s' : `${i * 0.35}s`;
    io.observe(s);
  });
}

// ---------- Contact form ----------
// Checks the fields kindly before sending. Until the Formspree form is connected (the action
// still says FORMSPREE_ENDPOINT), it says so plainly and points to the other ways to get in touch.
function initContact() {
  const form = document.getElementById('contact-form');
  const status = document.getElementById('form-status');
  const button = form.querySelector('button[type="submit"]');
  const say = (text, isError = false) => {
    status.textContent = text;
    status.classList.toggle('is-error', isError);
  };
  const fieldError = (input, message) => {
    const field = input.closest('.field');
    field.classList.toggle('has-error', !!message);
    const err = document.getElementById(`${input.id || 'f-need'}-err`) || field.querySelector('.field__error');
    if (err) err.textContent = message || '';
    input.setAttribute?.('aria-invalid', message ? 'true' : 'false');
  };
  function check() {
    const problems = [];
    const name = form.elements.name, email = form.elements.email, message = form.elements.message;
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
  form.addEventListener('input', (e) => {
    if (e.target.closest('.field.has-error')) check();
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const problems = check();
    if (problems.length) {
      say('A few details need a look before this can be sent.', true);
      problems[0].focus();
      return;
    }
    if (form.action.includes('FORMSPREE_ENDPOINT')) {
      say('Sorry: this form isn\'t switched on yet, so your message wasn\'t sent. Please use one of the other ways to reach me, beside it. Your message is still here, ready to copy.', true);
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
      say('Sorry, the message couldn\'t be sent just now (the connection or the form service had a problem). Please try again in a moment, or use one of the other ways to reach me.', true);
    }
  });
}

// ---------- Links that are still placeholders ----------
// Until Pratul fills in the real booking link, email and WhatsApp number, these links lead to
// the contact form with a short note instead of a broken page.
function initPlaceholders({ lenis }) {
  for (const a of document.querySelectorAll('[data-placeholder]')) {
    if (!a.getAttribute('href').includes(a.dataset.placeholder)) continue;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const status = document.getElementById('form-status');
      if (status) status.textContent = 'That link isn\'t set up yet. The form here reaches me just as well.';
      lenis.scrollTo('#contact-form', { offset: -120, duration: reduceMotion ? 0 : 1.2 });
      document.getElementById('f-name')?.focus({ preventScroll: true });
    });
  }
}

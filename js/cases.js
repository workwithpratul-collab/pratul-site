// cases.js: the combined case study page (case-studies/index.html). Small and plain: no libraries.
//
//   1. Gentle fade-ins: each block marked data-fade rises softly into place the first time it comes
//      into view (the hidden starting state is in css/cases.css, switched on in the page's <head>).
//   2. The recordings: each video downloads only when it comes near the screen (its picture first,
//      then the video), plays (muted, looping) only while you can see it, and pauses when you can't.
//      Under "reduce motion" nothing plays by itself: you see the still, with a play button.
//   3. The phone menu of the top bar (the same behaviour as on the home page).

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
window.__casesReady = true;   // (the page's <head> checks this: see the fade-ins' safety net there)

// ---------- 1. Fade-ins ----------
const fades = document.querySelectorAll('[data-fade]');
if (document.documentElement.classList.contains('cases-fade')) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -12% 0px' });
  // (the opening's blocks arrive one after another, a beat apart)
  document.querySelectorAll('.cases-open [data-fade]').forEach((el, i) => { el.style.transitionDelay = `${i * 0.12}s`; });
  fades.forEach((el) => io.observe(el));
}

// ---------- 2. The recordings ----------
for (const video of document.querySelectorAll('.recording__video')) {
  const figure = video.closest('.recording');
  const toggle = figure.querySelector('.recording__toggle');
  let loaded = false;
  let wanted = false;   // (is it meant to be playing right now?)
  // Swap in the real addresses (kept in data- attributes so nothing downloads with the page).
  const load = () => {
    if (loaded) return;
    loaded = true;
    for (const source of video.querySelectorAll('source[data-src]')) source.src = source.dataset.src;
    video.load();
  };
  const play = () => { wanted = true; load(); video.play().then(() => figure.classList.add('is-playing')).catch(() => {}); };
  const pause = () => { wanted = false; video.pause(); figure.classList.remove('is-playing'); };
  // Some graphics chips can't decode a WebM mid-play ("decode error"): then this video carries on
  // with its MP4 copy instead.
  video.addEventListener('error', () => {
    const webm = video.querySelector('source[type="video/webm"]');
    if (!webm || !video.currentSrc.endsWith('.webm')) return;
    webm.remove();
    video.load();
    if (wanted) play();
  });

  // Its still picture, once it's within a screen or so of being seen.
  // (each observer can deliver several updates at once after a quick jump: the newest one counts)
  const latest = (entries) => entries[entries.length - 1];
  new IntersectionObserver((entries, io) => {
    if (!latest(entries).isIntersecting) return;
    video.poster = video.dataset.poster;
    if (!reduceMotion) load();
    io.disconnect();
  }, { rootMargin: '120% 0px' }).observe(video);

  if (reduceMotion) {
    // The still and a play button; pressing it plays the recording (and pressing again pauses it).
    toggle.hidden = false;
    const label = toggle.getAttribute('aria-label');
    const icon = toggle.querySelector('use');
    toggle.addEventListener('click', () => {
      if (video.paused) { play(); toggle.setAttribute('aria-label', label.replace('Play', 'Pause')); icon.setAttribute('href', '#i-pause'); }
      else { pause(); toggle.setAttribute('aria-label', label); icon.setAttribute('href', '#i-play'); }
    });
  } else {
    // Plays while at least a third of it is on screen; pauses as soon as it leaves.
    new IntersectionObserver((entries) => (latest(entries).isIntersecting ? play() : pause()), { threshold: 0.35 }).observe(video);
  }
}

// ---------- Arriving at a chapter (case-studies/#agency, a link from the home page) ----------
// The browser jumps to the chapter at once, but the page grows a little as its fonts arrive, which
// left the chapter short of the top. So once the fonts are in, we put it exactly in place. Only after
// that do jumps glide (the index at the top), unless the visitor prefers less motion.
document.fonts.ready.then(() => {
  const target = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target) target.scrollIntoView({ behavior: 'instant' });
  if (!reduceMotion) document.documentElement.style.scrollBehavior = 'smooth';
});

// ---------- 3. The phone menu ----------
const nav = document.getElementById('site-nav');
const menuButton = nav.querySelector('.nav__menu');
const setOpen = (open) => {
  nav.classList.toggle('is-open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
};
menuButton.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
nav.querySelector('.nav__links').addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); menuButton.focus(); } });
document.addEventListener('pointerdown', (e) => { if (!nav.contains(e.target)) setOpen(false); });

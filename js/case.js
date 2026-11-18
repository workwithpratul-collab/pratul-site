// case.js: the case study pages.
//  - The page rises out of the same mist the film dissolved into, and "Back to the trail"
//    dissolves back into it before returning to that project's camp (main.js reads ?return).
//  - The recording plays (muted, looping) only while it's on screen, with a calm Play / Pause
//    button. Without JavaScript the video simply keeps its normal controls.
//  - Placeholder links (the live site address, until Pratul fills it in) explain themselves.

const veil = document.getElementById('veil');
const colour = sessionStorage.getItem('ascent:veil');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Arrive inside the mist (if we came from the film), then let it clear ----------
if (colour) {
  veil.style.setProperty('--veil', colour);
  veil.style.transitionDuration = '0ms';
  veil.classList.add('is-on');
  void veil.offsetWidth;
  veil.style.transitionDuration = reduceMotion ? '700ms' : '1600ms';
  requestAnimationFrame(() => requestAnimationFrame(() => veil.classList.remove('is-on')));
}

// ---------- Going back to the trail: mist first, then the film ----------
for (const back of document.querySelectorAll('[data-back]')) {
  back.addEventListener('click', (e) => {
    e.preventDefault();
    const href = back.getAttribute('href');
    if (!colour) { location.href = href; return; }   // no mist colour known: just go
    veil.style.setProperty('--veil', colour);
    veil.style.transitionDuration = reduceMotion ? '600ms' : '1000ms';
    veil.classList.add('is-on');
    setTimeout(() => { location.href = href; }, reduceMotion ? 600 : 1000);
  });
}
// Coming back here with the browser's back button: clear any leftover mist.
window.addEventListener('pageshow', (e) => { if (e.persisted) veil.classList.remove('is-on'); });

// ---------- The recording ----------
const video = document.querySelector('.browser video');
const button = document.querySelector('.browser__play');
if (video && button) {
  video.removeAttribute('controls');
  button.hidden = false;
  let wanted = !reduceMotion;   // with "reduce motion", it waits for the visitor to press Play
  const sync = () => { button.textContent = video.paused ? 'Play' : 'Pause'; };
  button.addEventListener('click', () => {
    wanted = video.paused;
    if (wanted) video.play().catch(() => {}); else video.pause();
  });
  video.addEventListener('play', sync);
  video.addEventListener('pause', sync);
  sync();
  // Play while on screen (if the visitor wants it playing), pause when scrolled away.
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && wanted) {
      video.preload = 'auto';
      video.play().catch(() => {});
    } else if (!entry.isIntersecting) {
      video.pause();
    }
  }, { threshold: 0.35 }).observe(video);
}

// ---------- Placeholder links ----------
for (const a of document.querySelectorAll('[data-placeholder]')) {
  if (!a.getAttribute('href').includes(a.dataset.placeholder)) continue;
  a.addEventListener('click', (e) => {
    e.preventDefault();
    a.textContent = 'Live link coming soon';
  });
}

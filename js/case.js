// case.js: the (placeholder) case study pages.
// The page rises out of the same mist the film dissolved into, and "Back to the trail" dissolves
// back into it before returning to the exact spot on the trail (main.js reads ?return).

const veil = document.getElementById('veil');
const colour = sessionStorage.getItem('ascent:veil');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Arrive inside the mist (if we came from the film), then let it clear.
if (colour) {
  veil.style.setProperty('--veil', colour);
  veil.style.transitionDuration = '0ms';
  veil.classList.add('is-on');
  void veil.offsetWidth;
  veil.style.transitionDuration = reduceMotion ? '700ms' : '1600ms';
  requestAnimationFrame(() => requestAnimationFrame(() => veil.classList.remove('is-on')));
}

// Going back: mist first, then the trail.
document.querySelector('[data-back]').addEventListener('click', (e) => {
  e.preventDefault();
  const href = e.currentTarget.getAttribute('href');
  if (colour) veil.style.setProperty('--veil', colour);
  veil.style.transitionDuration = reduceMotion ? '600ms' : '1000ms';
  veil.classList.add('is-on');
  setTimeout(() => { location.href = href; }, reduceMotion ? 600 : 1000);
});

// Coming back here with the browser's back button: clear any leftover mist.
window.addEventListener('pageshow', (e) => { if (e.persisted) veil.classList.remove('is-on'); });

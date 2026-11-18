// veil.js: the soft mist that rolls in for transitions (opening a project, skipping the film,
// coming back from a project). The scene dissolves into mist instead of cutting to black.
// Its colour is the world's mist colour at this moment (palette.js), so at night it's a
// moonlit blue-grey and at sunrise a warm peach haze.

import { mood } from '../world/palette.js';

const el = document.getElementById('veil');
const KEY = 'ascent:veil';   // remembered between pages, so the next page rises out of the same mist

// The mist's colour right now, as CSS hex.
export function mistColour() {
  return `#${mood.mist.air.getHexString()}`;
}

// Fade the mist in (or out). Resolves when the fade has finished.
export function veil(on, { duration = 1000 } = {}) {
  // The colour is chosen as the mist rolls in, and kept while it clears (no colour jump).
  if (on) el.style.setProperty('--veil', mistColour());
  el.style.transitionDuration = `${duration}ms`;
  el.classList.toggle('is-on', on);
  if (on) sessionStorage.setItem(KEY, mistColour());
  return new Promise((resolve) => setTimeout(resolve, duration));
}

// Start with the mist fully in place (no fade), e.g. when arriving back from a project.
export function veilInstantly() {
  el.style.setProperty('--veil', sessionStorage.getItem(KEY) || mistColour());
  el.style.transitionDuration = '0ms';
  el.classList.add('is-on');
  void el.offsetWidth;   // apply it now, before any later fade starts
}

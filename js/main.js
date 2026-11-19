// main.js: starts everything.
//
// js/device.js has already decided (before the page was drawn) which version this device gets,
// and written it on <html data-mode="...">. Here we load only that version's code, so a phone
// never downloads the full film's world, and a desktop never downloads the mobile page's code.
//   film           → film.js         (the full 3D film, unchanged)
//   mobile / calm  → mobile/mobile.js (the light phone page: no film, no 3D, no animation library)

const mode = document.documentElement.dataset.mode || 'film';

if (mode === 'film') import('./film.js');
else import('./mobile/mobile.js');

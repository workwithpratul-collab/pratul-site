// main.js: starts everything.
//
// js/device.js has already decided (before the page was drawn) which version this device gets,
// and written it on <html data-mode="...">. Here we load only that version's code:
//   film           → site.js         (desktop: the page, then the 3D film once the page has painted)
//   mobile / calm  → mobile/mobile.js (phones: no film, no 3D, no animation library)

const mode = document.documentElement.dataset.mode || 'film';

if (mode === 'film') import('./site.js');
else import('./mobile/mobile.js');

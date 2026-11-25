// main.js: starts everything.
//
// js/device.js has already decided (before the page was drawn) which version this device gets,
// and written it on <html data-mode="...">. Here we load only that version's code:
//   film           → loader.js + site.js (desktop: the loading screen moves at once; then the page,
//                    and the 3D film once the page has painted)
//   mobile / calm  → mobile/mobile.js (phones: no film, no 3D, no animation library)

const mode = document.documentElement.dataset.mode || 'film';

if (mode === 'film') {
  // The loading screen first: it is tiny and needs nothing else, so the snow starts at once.
  import('./loader.js');
  import('./site.js').catch((err) => {
    // The page's own code couldn't start (a library that failed to download, say): never leave the
    // visitor on the loading screen. Show the page without the film, as an old graphics chip would.
    console.error('[site] could not start', err);
    document.documentElement.classList.add('no-film');
    window.dispatchEvent(new CustomEvent('ascent:failed'));
  });
}
else import('./mobile/mobile.js');

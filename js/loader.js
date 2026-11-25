// loader.js: the loading screen (desktop film only). Snow spreads down the mountain as the film loads.
//
// The screen itself is plain HTML with its styles written inline in index.html, so it shows on the
// very first frame, before any script. This small file only makes it move: it works out how far
// the film has really got, and glides the snow, the bar and the percentage towards that.
//
// "How far" is real, made of four parts, each 0..1 (they can overlap, and each only ever grows):
//   files  the film's files downloading (everything device.js asked for: code, the trekker, his moves)
//   build  the world being built, step by step (film.js reports each step)
//   gpu    the opening shot being prepared on the graphics card (shaders, textures, first draws)
//   final  the last checks before the film goes live (film.js), and then "ascent:ready"
//
// Smoothing: the shown value only ever rises. It chases the real value, and while the real value
// waits (the graphics card working on a big shader, say) it keeps creeping a little way ahead, so
// it never looks stuck, but it never reaches 100% before the film is really ready.
//
// The snow, the bar and the snowfall are moved by CSS transitions on transform and opacity, which the
// browser runs on its own (on the compositor). So they keep gliding even in the moments when building
// the 3D world keeps the page's script busy.

const loader = document.getElementById('loader');
const pctEl = document.getElementById('loader-pct');
const root = document.documentElement;

// How much each part counts towards 100%.
const WEIGHT = { files: 0.3, build: 0.3, gpu: 0.32, final: 0.08 };
const parts = { files: 0, build: 0, gpu: 0, final: 0 };
const real = () => Object.keys(WEIGHT).reduce((sum, k) => sum + WEIGHT[k] * parts[k], 0);

let shown = 0;          // what the screen shows (0..1)
let goal = 0;           // where the shown value is heading
let written = -1;       // the last value shown as a number (so we only touch it when it changes)
let aimed = -1;         // the last value the snow and the bar were sent towards
let lastReal = 0;       // the real value last time it moved...
let realSince = performance.now();   // ...and when that was
let ready = false;      // the film is live: glide to 100% and fade
let done = false;

function setPart(name, value) {
  if (!(name in parts)) return;
  parts[name] = Math.max(parts[name], Math.min(value, 1));   // (never backwards)
}

// ---------- Part 1: files downloaded ----------
// Every file device.js asked for early (the film's code, three.js, the trekker and his moves). Big
// files count for more, so the bar doesn't race to 90% and then wait on the character.
const BIG = [[/pratul-trekker-film\.vrm/, 10], [/clips\.json/, 3], [/three\.(module\.min|core)\.js/, 4]];
const wanted = new Map();
for (const link of document.querySelectorAll('link[rel="modulepreload"], link[rel="preload"]')) {
  if (/\.(webp|woff2)$/.test(link.href)) continue;   // (pictures and fonts: not the film)
  wanted.set(link.href, BIG.find(([re]) => re.test(link.href))?.[1] ?? 1);
}
const totalFiles = [...wanted.values()].reduce((a, b) => a + b, 0) || 1;
let filesDone = 0;
function fileFinished(url) {
  const w = wanted.get(url);
  if (!w) return;
  wanted.delete(url);
  filesDone += w;
  setPart('files', filesDone / totalFiles);
}
if ('PerformanceObserver' in window) {
  // (buffered: also the files that finished before this script ran)
  new PerformanceObserver((list) => list.getEntries().forEach((e) => fileFinished(e.name)))
    .observe({ type: 'resource', buffered: true });
} else setPart('files', 1);

// ---------- Parts 2-4: the film reports how it's getting on (js/film.js) ----------
window.addEventListener('ascent:progress', (e) => {
  const d = e.detail || {};
  setPart(d.part, d.value);
});
window.addEventListener('ascent:ready', () => { ready = true; }, { once: true });
// The film couldn't start (no 3D after all): get out of the way at once.
window.addEventListener('ascent:failed', () => finish(true), { once: true });

// ---------- The loop: glide the shown value, write it to the page ----------
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let last = performance.now();
function tick(now) {
  if (done) return;
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  const r = real();
  if (r > lastReal + 1e-4) { lastReal = r; realSince = now; }

  if (ready) {
    // The film is live: finish the climb to 100% in about half a second.
    shown += Math.max((1 - shown) * (1 - Math.exp(-dt * 6)), dt * 0.5);
    if (shown >= 0.999) shown = 1;
  } else {
    // Creep up to 6% beyond the real value while it waits, more slowly the longer it waits,
    // but never past 97% (the last few percent belong to the film actually being ready).
    const waited = (now - realSince) / 1000;
    goal = Math.max(goal, Math.min(r + 0.06 * (1 - Math.exp(-waited / 1.6)), 0.97));
    if (goal > shown) shown += (goal - shown) * (1 - Math.exp(-dt * 2.6));
  }
  write();
  if (shown >= 1) { setTimeout(() => finish(false), 250); return; }
  requestAnimationFrame(tick);
}

function write() {
  // The percentage: whole numbers only.
  const pct = Math.floor(shown * 100);
  if (pct !== Math.floor(written * 100)) {
    pctEl.textContent = pct;
    loader.setAttribute('aria-valuenow', pct);
  }
  // The snow, the bar and the snowfall read --p (css in index.html). They are aimed a little ahead,
  // at where the number is heading (goal), and glide there by themselves: so if building the world
  // keeps this script busy for a moment, they carry on moving smoothly meanwhile.
  const aim = ready ? 1 : Math.max(shown, goal);
  if (Math.abs(aim - aimed) >= 0.004 || (aim === 1 && aimed !== 1)) {
    loader.style.setProperty('--p', aim.toFixed(3));
    aimed = aim;
  }
  written = shown;
}

// ---------- At 100%: fade into the film ----------
function finish(fast) {
  if (done) return;
  done = true;
  root.classList.remove('film-veiled');   // the film's opening words begin to rise (css/style.css)
  loader.classList.add('is-done');
  // Tell the film the curtain is up (the trekker waves, js/film.js).
  window.dispatchEvent(new CustomEvent('ascent:revealed'));
  const gone = () => { loader.hidden = true; };
  if (fast || reduceMotion) setTimeout(gone, 700);
  else loader.addEventListener('transitionend', (e) => { if (e.target === loader) gone(); });
  setTimeout(gone, 2000);   // (in case the transition never reports its end)
}

// Still pictures (?still=...) are for posters: no loading screen in them.
if (new URLSearchParams(location.search).has('still')) finish(true);
else requestAnimationFrame(tick);

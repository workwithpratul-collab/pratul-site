// gl.js: the ONE WebGL renderer and canvas for the whole site.
//
// The film, the summit hero and both 3D carousels (work and tools) all draw into this single
// canvas, which is fixed behind the page. Each of them is a "view": an element on the page plus a
// function that draws its scene. Every frame, each view that is on screen draws into exactly the
// part of the canvas where its element is (a "viewport" and "scissor" box), so a 3D view scrolls
// with the page like any other element. Everything else on the canvas is see-through.
//
// Why one canvas: every WebGL canvas is a separate graphics context with its own copy of shaders
// and textures, and browsers limit how many can exist. One shared context is lighter and smoother.
//
// The loop only runs while at least one view is on screen and the tab is visible.

import * as THREE from 'three';
import { gsap } from './core.js';

// Above 1.75x pixels the eye barely sees a difference, but the graphics chip pays for every pixel.
const MAX_PIXEL_RATIO = 1.75;

const canvas = document.getElementById('gl');
export const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,                       // see-through wherever no view draws
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
// No tone mapping: for a painted look we want our chosen colours shown exactly.
renderer.toneMapping = THREE.NoToneMapping;
renderer.setClearColor(0x000000, 0);
renderer.autoClear = false;          // we clear once per frame, then each view draws its box

const views = new Set();
const timer = new THREE.Timer();
let running = false;
let cleared = true;

// Is a view's element on screen? An IntersectionObserver tells us without measuring every frame.
const watcher = new IntersectionObserver((entries) => {
  for (const e of entries) {
    for (const v of views) if (v.el === e.target) v.onScreen = e.isIntersecting;
  }
  wake();
}, { rootMargin: '0px' });

// Add a view. el: the page element it draws over. frame(dt, time, rect): update and draw (call
// renderer.render inside it). It starts drawing once `ready` is set (view.ready = true).
// Returns the view, so its owner can set .ready, .paused (stop drawing) or remove it.
export function addView({ el, frame, ready = true, name = '' }) {
  const view = { el, frame, ready, name, onScreen: false, paused: false };
  views.add(view);
  watcher.observe(el);
  return view;
}
export function removeView(view) {
  views.delete(view);
  watcher.unobserve(view.el);
  wake();
}

// Start or stop the loop, depending on whether anything needs drawing.
export function wake() {
  const needed = !document.hidden && [...views].some((v) => v.onScreen && v.ready && !v.paused);
  if (needed && !running) {
    running = true;
    timer.reset?.();
    gsap.ticker.add(loop);
  } else if (!needed && running) {
    running = false;
    gsap.ticker.remove(loop);
    clearAll();
  }
}
// A hidden tab draws nothing at all.
document.addEventListener('visibilitychange', wake);

function clearAll() {
  if (cleared) return;
  renderer.setScissorTest(false);
  renderer.clear();
  cleared = true;
}

const H = () => window.innerHeight;
function loop() {
  timer.update(performance.now());
  const dt = Math.min(timer.getDelta(), 0.1);   // cap, so a hiccup never causes a big jump
  const time = timer.getElapsed();
  renderer.setScissorTest(false);
  renderer.clear();
  cleared = false;
  for (const v of views) {
    if (!v.onScreen || !v.ready || v.paused) continue;
    const r = v.el.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= H() || r.width < 1 || r.height < 1) continue;
    // WebGL counts y from the bottom of the canvas; three.js takes CSS pixels.
    const y = H() - r.bottom;
    renderer.setViewport(r.left, y, r.width, r.height);
    renderer.setScissor(r.left, y, r.width, r.height);
    renderer.setScissorTest(true);
    v.frame(dt, time, r);
  }
}

window.addEventListener('resize', () => {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// A glow that adds light to whatever is behind it, without touching the canvas's see-through
// amount (alpha). Plain additive blending also adds to alpha, which on this see-through canvas
// darkens the page behind a glow into a grey halo.
export function glowBlending(material) {
  material.blending = THREE.CustomBlending;
  material.blendEquation = THREE.AddEquation;
  material.blendSrc = THREE.SrcAlphaFactor;
  material.blendDst = THREE.OneFactor;
  material.blendSrcAlpha = THREE.ZeroFactor;
  material.blendDstAlpha = THREE.OneFactor;
  return material;
}

// Free a removed object's GPU memory (geometry, materials and their textures).
export function dispose(object) {
  object.traverse((o) => {
    o.geometry?.dispose();
    for (const m of [].concat(o.material || [])) {
      for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
      m.dispose();
    }
  });
}

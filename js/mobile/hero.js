// hero.js: the mobile opening. A small, live 3D base camp at night, framed for a tall phone screen.
//
// It is built from the same pieces as the film (sky, land, tent, lantern, trees, mist, trekker),
// so it looks like the film's first shot, but only the corner of the world around base camp:
//  - a smaller patch of ground and a short stretch of path,
//  - a few soft trees and one band of painted far trees (the film plants about 8,000),
//  - one low band of mist, and the trekker with just two animations (Idle and LookAround),
//  - drawn at no more than 1.5x the screen's pixels.
// The camera doesn't travel: it only drifts a few centimetres, very slowly, like a held breath.
// Drawing stops whenever the scene is off screen or the tab is hidden, to save the battery.

import * as THREE from 'three';
import { createSky } from '../world/sky.js';
import { createMountains, createGround, groundHeight, nearestTrail, noise2, seededRandom } from '../world/terrain.js';
import { createSmallForest } from '../world/forest.js';
import { createBaseCamp } from '../world/camp.js';
import { makeMistMaterial } from '../world/mist.js';
import { createTrekker } from '../world/trekker.js';
import { WIND } from '../world/glsl.js';
import { setClimb } from '../world/palette.js';

// ---------- Settings you may want to change ----------
// Never draw at more than 1.5x the screen's pixels on a phone: sharp enough for a soft painted
// scene, and much lighter for the graphics chip than 3x.
const MAX_PIXEL_RATIO = 1.5;
// The shot, for a tall screen: the camera stands on the trail below the camp, looking up past the
// tent towards the ridge, with the open night sky above for the headline.
const SHOT = {
  fov: 48,                                  // a little wider than the film's 40°: a phone is narrow
  pos: new THREE.Vector3(2.6, 2.3, 16),
  look: new THREE.Vector3(-8.2, 4.0, -14),
};
// On a phone held sideways the screen is wide and short: step back and look a little lower.
const SHOT_WIDE = {
  fov: 38,
  pos: new THREE.Vector3(1.2, 1.7, 11.5),
  look: new THREE.Vector3(-2.4, 2.1, -6),
};
// Where the trekker stands (beside the path, a few steps from the lantern), and which way he faces
// (radians; he looks up the trail towards the ridge, three-quarters away from us).
const TREKKER = { x: -0.5, z: 0, heading: Math.PI * 1.1 };
// How often he looks around (seconds between glances), and for how long.
const LOOK_EVERY = [9, 16];
const LOOK_FOR = 5.5;
// If the phone can't keep up (slower than this many milliseconds a frame, on average, over the
// first seconds), the scene is swapped for the painted still: a smooth still beats a juddering scene.
const TOO_SLOW_MS = 42;

// For tuning the framing in the browser: ?shot=x,y,z,lookX,lookY,lookZ,fov (and &trek=x,z,heading).
const tune = new URLSearchParams(location.search);
if (tune.has('shot')) {
  const v = tune.get('shot').split(',').map(Number);
  SHOT.pos.set(v[0], v[1], v[2]); SHOT.look.set(v[3], v[4], v[5]); if (v[6]) SHOT.fov = v[6];
}
// (&dpr=2 renders sharper, for making the calm version's painted still.)
const MAX_DPR = tune.has('dpr') ? Number(tune.get('dpr')) : MAX_PIXEL_RATIO;
if (tune.has('trek')) { const v = tune.get('trek').split(',').map(Number); Object.assign(TREKKER, { x: v[0], z: v[1], heading: v[2] ?? TREKKER.heading }); }

export function startHero({ canvas, section, onSlow }) {
  // ---------- Renderer, scene, camera ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'default' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;   // our painted colours, shown exactly
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(SHOT.fov, 1, 0.1, 6000);

  // ---------- The world around base camp, at night ----------
  setClimb(0);                                       // night (palette.js): sky, fog, light, mist together
  const sky = createSky(scene);
  const mountains = createMountains(scene);
  mountains.userData.applyMood();
  // Only the land the camera can see from the camp, and the first stretch of the path.
  createGround(scene, { region: { minX: -150, maxX: 120, minZ: -230, maxZ: 40 }, trailMetres: 90 });
  createSmallForest(scene, { ...plantTrees(), facePoint: [SHOT.pos.x, SHOT.pos.z], sky });
  const camp = createBaseCamp(scene);
  const mist = createLowMist(scene);
  const trekker = createTrekker(scene, renderer, camera, { clips: ['idle', 'look'] });
  trekker.place(TREKKER.x, TREKKER.z, TREKKER.heading);

  // ---------- Size and framing ----------
  const base = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  function resize() {
    const w = section.clientWidth, h = section.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const shot = camera.aspect > 1.2 ? SHOT_WIDE : SHOT;
    camera.fov = shot.fov;
    camera.updateProjectionMatrix();
    base.pos.copy(shot.pos);
    base.look.copy(shot.look);
  }
  resize();
  window.addEventListener('resize', resize);

  // ---------- The loop ----------
  const timer = new THREE.Timer();
  const look = new THREE.Vector3();
  let nextLook = 6, lookUntil = 0;
  const frameTimes = [];
  let judged = false, shown = false;

  function tick(now) {
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.1);
    const time = timer.getElapsed();

    // The held breath: the camera drifts a few centimetres, over twenty seconds or more.
    camera.position.set(
      base.pos.x + Math.sin(time * 0.07) * 0.22,
      base.pos.y + Math.sin(time * 0.05 + 1.3) * 0.06,
      base.pos.z + Math.sin(time * 0.04 + 0.4) * 0.15,
    );
    look.copy(base.look);
    camera.lookAt(look);

    // Now and then he glances around (LookAround), then settles back into breathing (Idle).
    if (time > nextLook && trekker.hasMixamo) {
      trekker.setLoop('look');
      lookUntil = time + LOOK_FOR;
      nextLook = time + LOOK_FOR + LOOK_EVERY[0] + Math.random() * (LOOK_EVERY[1] - LOOK_EVERY[0]);
    }
    if (lookUntil && time > lookUntil) { trekker.setLoop(null); lookUntil = 0; }

    WIND.time.value = time;          // the breeze in the trees
    sky.update(time, camera, renderer.getPixelRatio());
    camp.update(time);               // the lantern's gentle flicker
    mist.update(time);
    trekker.update(dt, time);
    renderer.render(scene, camera);

    // Once it's running smoothly, fade it in; if it can't keep up, hand over to the still.
    if (!judged) {
      frameTimes.push(dt * 1000);
      if (frameTimes.length === 8 && !shown) { shown = true; section.classList.add('is-live'); }
      if (frameTimes.length >= 90) {
        judged = true;
        const sorted = frameTimes.slice(20).sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        if (median > TOO_SLOW_MS) { stop(); onSlow?.(median); }
      }
    }
    if (window.__hero) window.__hero.frame(dt);
  }

  // ---------- Pausing: off screen, or the tab is hidden ----------
  let onScreen = true, running = false, stopped = false;
  function run() {
    const want = onScreen && !document.hidden && !stopped;
    if (want === running) return;
    running = want;
    renderer.setAnimationLoop(want ? tick : null);
    if (want) timer.update(performance.now());   // (don't count the paused time as one long frame)
  }
  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; run(); }).observe(section);
  document.addEventListener('visibilitychange', run);
  function stop() { stopped = true; run(); }

  // Build every shader now, then start once the trekker is in (so he doesn't pop in later).
  renderer.compile(scene, camera);
  const ready = trekker.ready.catch((e) => console.warn('[hero] trekker failed to load', e));
  Promise.race([ready, new Promise((r) => setTimeout(r, 9000))]).then(() => {
    if (!stopped) renderer.compile(scene, camera);
    run();
  });

  // A small hook for testing in the console and in the device tests.
  window.__hero = {
    fps: 0,
    frames: 0,
    ready,
    info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio() }),
    get running() { return running; },
    _t: 0, _n: 0,
    frame(dt) { this.frames++; this._t += dt; this._n++; if (this._t >= 1) { this.fps = Math.round(this._n / this._t); this._t = 0; this._n = 0; } },
    stop,
    camera,
    trekker,
  };
  return { stop };
}

// ---------- The trees around base camp ----------
// The film's six hand-placed trees that frame its opening (forest.js), a few more soft trees
// beside them, and a band of painted card trees on the slopes behind, all from one seeded
// random sequence, so the picture is the same on every visit.
function plantTrees() {
  const rand = seededRandom(2031);
  const near = {
    pine: [
      { x: -12.5, z: 1.5, scale: 9.5 }, { x: -16, z: -8, scale: 10.5 }, { x: 16, z: -15, scale: 10 },
      { x: 10, z: -22, scale: 8 }, { x: -9, z: -30, scale: 9 }, { x: 22, z: -4, scale: 9 },
    ],
    oak: [{ x: 13.5, z: -5, scale: 6.5 }, { x: -21, z: -16, scale: 6 }, { x: -19, z: 6, scale: 5.5 }],
  };
  for (const kind of ['pine', 'oak']) {
    for (const t of near[kind]) { t.rot = rand() * 6.28; t.tint = 0.92 + rand() * 0.1; }
  }
  // The painted card trees: thick groves on the slopes behind the camp, never on the path.
  const cards = [];
  for (let i = 0; i < 2600 && cards.length < 900; i++) {
    const x = -120 + rand() * 230;
    const z = -26 - rand() * 170;
    if (nearestTrail(x, z).distance < 6 + rand() * 3) continue;
    const grove = noise2(x * 0.045, z * 0.045, 21);
    if (rand() > 0.25 + smooth(0.3, 0.6, grove) * 0.75) continue;
    const isOak = rand() < 0.18;
    cards.push({
      x, z, y: groundHeight(x, z),
      height: isOak ? 6 + rand() * 4 : 8 + rand() * 9,
      tint: 0.88 + rand() * 0.22,
      variant: isOak ? 6 + Math.floor(rand() * 2) : Math.floor(rand() * 6),
    });
  }
  return { near, cards };
}
function smooth(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

// ---------- One low band of mist, lying between the camp and the trees behind ----------
// (The film has three bands plus a valley sheet and a distant ring; one is plenty here.)
function createLowMist(scene) {
  const width = 170, height = 10, z = -34, x0 = -8;
  const geo = new THREE.PlaneGeometry(width, height, 48, 1);
  const pos = geo.attributes.position;
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k) + x0;
    const localY = pos.getY(k) + height / 2;
    pos.setXYZ(k, x, groundHeight(x, z) + localY - 1.2, z);
  }
  const mat = makeMistMaterial({ opacity: 0.55, scale: [9, 1.4], speed: 0.018, softness: [0.36, 0.62], seed: 1.7 });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  return { update: (time) => { mat.uniforms.uTime.value = time; } };
}

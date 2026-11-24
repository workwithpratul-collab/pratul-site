// film.js: the 3D film ("The Ascent") for desktops, laptops and big tablets.
//
// site.js loads this AFTER the page has painted (the opening is first shown as a poster image of
// this exact first frame, with real HTML text over it). Here we build the world in short steps,
// then register the film as a view of the one shared renderer (gl.js), and cross-fade from the
// poster to the live scene. The film's last shot is the summit hero, live.

import * as THREE from 'three';
import { gsap, lenis, reduceMotion, ScrollTrigger } from './core.js';
import { renderer, addView, wake } from './gl.js';

import { createSky } from './world/sky.js';
import { createMountains, createGround, trailPointAt, trailDirectionAt, smoothstep, SUMMIT_HEIGHT, TRAIL_LENGTH } from './world/terrain.js';
import { createForest } from './world/forest.js';
import { createBaseCamp, createCampLights } from './world/camp.js';
import { createLandmark } from './world/landmarks.js';
import { createRidge } from './world/ridge.js';
import { createMeadowZone } from './world/meadow.js';
import { createSummitZone } from './world/summit.js';
import { createMist } from './world/mist.js';
import { createMotes } from './world/motes.js';
import { createTrekker } from './world/trekker.js';
import { createCameraPath } from './world/cameraPath.js';
import { ZONES, LIGHT, ALTITUDE, FILM_SCREENS, MAX_WALK_SPEED, CATCH_UP_SECONDS, CATCH_UP_MIN_SPEED, CATCH_UP_MAX_SPEED, MIST_SKIP_METRES, CAMPS, MEADOW } from './world/journey.js';
import { mood, setClimb } from './world/palette.js';
import { createAltitudeMeter } from './ui/altitude.js';
import { WIND } from './world/glsl.js';
import { createGear } from './world/gear.js';
import { createStory } from './ui/story.js';
import { createShade } from './world/shade.js';
import { createCampUI } from './ui/camp-ui.js';
import { createGearUI } from './ui/gear-ui.js';
import { veil, mistColour } from './ui/veil.js';

// The progress the page shows while this loads (0..1): the code has arrived by now.
const reportProgress = (value) => window.dispatchEvent(new CustomEvent('ascent:progress', { detail: value }));
reportProgress(0.2);

// ---------- Settings you may want to change ----------
// Show the FPS counter? Add ?fps to the address, or press F to toggle it.
const params = new URLSearchParams(location.search);
const SHOW_FPS = params.has('fps');
// Still mode, for posters and style frames: ?still=0 is base camp, ?still=1 the summit hero
// (any point of the film, 0..1), as a clean picture with no text.
const STILL_POINTS = { 0: 0, 1: 1 };
const stillParam = params.has('still') ? Number(params.get('still')) || 0 : null;
const STILL = stillParam === null ? null : (STILL_POINTS[stillParam] ?? Math.min(Math.max(stillParam, 0), 1));
if (STILL !== null) document.documentElement.classList.add('is-still');
// Coming back from a project page (?return=dermae): start at the same spot on the trail.
const RETURN_KEY = 'ascent:return';
const returning = params.get('return');

// ---------- Building in small steps ----------
// Building the whole world at once used to freeze the page for almost a second. Instead each part
// is built in its own short task, and between parts we hand the browser a moment back, so the
// page stays responsive (scrolls and clicks are answered) while the world comes together.
const yieldToBrowser = () => new Promise((resolve) => {
  if (globalThis.scheduler?.yield) scheduler.yield().then(resolve);
  else setTimeout(resolve, 0);
});
const buildTimes = {};
const warmTimes = [];   // (for measuring: how long each warm-up piece took)
const LATER_LAYER = 1;      // (see 'The later zones' below)
let buildingLater = false;
async function step(name, build) {
  await yieldToBrowser();
  const before = new Set(scene.children);
  const t = performance.now();
  let result = build();
  buildTimes[name] = Math.round(performance.now() - t);
  if (result?.then) result = await result;
  // A later zone goes straight onto the layer the camera doesn't see (until its shaders are ready).
  if (buildingLater) for (const c of scene.children) if (!before.has(c)) c.traverse((o) => o.layers.set(LATER_LAYER));
  return result;
}

// Wait until the graphics card has really finished everything asked of it so far (compiling and
// first uploads), checking every few milliseconds, so the page stays free meanwhile. Without this,
// that work would land in the first frames of the live film as a visible stutter.
async function gpuSettled(maxMs = 2000) {
  const gl = renderer.getContext();
  if (!gl.fenceSync) return;
  const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  const t0 = performance.now();
  while (performance.now() - t0 < maxMs) {
    const status = gl.clientWaitSync(fence, 0, 0);
    if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) break;
    await new Promise((resolve) => setTimeout(resolve, 6));
  }
  gl.deleteSync(fence);
  buildTimes.gpu = Math.round(performance.now() - t0);
}

// ---------- 1. The scene and the camera ----------
const scene = new THREE.Scene();
// 40° is a calm, slightly "telephoto" view; wide angles feel dizzying when moving.
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 6000);

// ---------- 2. Light and sky ----------
// sky.js owns the sky dome, stars, moonlight, fill light and fog, so they can change together.
// The sun's light comes from a little higher than the sun itself (a painter's cheat), so the
// low morning light still lays warm gold on the meadow and the snow instead of only grazing them.
const sky = createSky(scene, { sunLightDir: new THREE.Vector3(0.62, 0.32, -0.78) });
// The camp lights (the warm glow that follows the nearest landmark) are added now, before anything is
// built: every shader is built for a set number of lights, so adding lights later would mean
// compiling every shader a second time. They're moved to their landmark once it exists.
const campLights = createCampLights(scene);

// ---------- 3. The world ----------
// The camera path is worked out first, so the forest can keep trees off the camera's route.
const cameraPath = await step('cameraPath', () => createCameraPath());
// Base camp first: its tent and lantern lights are the last lights the world adds, and every shader is
// built for a set number of lights, so from here on each shader is compiled once, correctly.
const baseCamp = await step('baseCamp', () => createBaseCamp(scene));
// Then the trekker: his file is already downloaded (device.js), and his shaders are by far the slowest
// for the graphics card to prepare (~0.6 s), so we let him finish setting up on his own first (a few
// hundred ms; with the world being built at the same time it took three times as long), then start
// his first draw so the graphics card works on it while the forest and the terrain are built.
// His eleven animations come ready-made in one small file (assets/animations/clips.json, baked
// from the Mixamo FBX files and already fitted to this character), instead of eleven FBX files the
// browser had to download and decode (about 2 MB and half a second of work).
const CLIPS = ['idle', 'walk', 'jog', 'wave', 'sit', 'sitToStand', 'point', 'look', 'stretch', 'turnLeft', 'turnRight'];
const trekker = await step('trekker', () => createTrekker(scene, renderer, camera, { onProgress: (f) => reportProgress(0.3 + f * 0.68), clips: CLIPS, clipFile: 'assets/animations/clips.json' }));
await trekker.ready.catch((e) => console.error('[trekker] failed to load', e));
buildTimes.trekkerAt = Math.round(performance.now());   // (for measuring: when he was ready)
const trekkerFirstDraw = drawTrekkerEarly();
const mountains = await step('mountains', () => createMountains(scene));
await step('ground', () => createGround(scene, { pause: yieldToBrowser }));
const forest = await step('forest', () => createForest(scene, {
  routeDistance: cameraPath.routeDistance,
  legacyRouteDistance: cameraPath.legacyRouteDistance,
  sky,
  pause: yieldToBrowser,
}));
const mist = await step('mist', () => createMist(scene));
// Everything the opening shot needs now exists (sky, trekker, mountains, ground, forest, base camp,
// mist). Hand just these shaders to the graphics driver, and start getting the opening ready on the
// graphics card (warmOpening) WHILE the rest of the mountain is built below: the two run side by side.
// The driver works through shaders in order, so the later zones' shaders are only handed over once
// the film is live (compileTheRest), never ahead of the opening's.
const openingParts = new Set(scene.children);
const openingReady = warmOpening();
buildingLater = true;

// Scene 2: the ridge (grass, stones, trees, valley mist) and the three project landmarks along
// the trail: a still lake, a stone hut and a trail signboard (journey.js, landmarks.js).
await step('ridge', () => createRidge(scene));
const camps = await step('landmarks', () => CAMPS.map((c) => createLandmark(scene, c, { renderer })));
campLights.update(camps, camera);
// Scene 3: the meadow and the gear check: the kit laid out on a canvas mat beside the trail.
await step('meadow', () => createMeadowZone(scene));
const matDir = trailDirectionAt(cameraPath.stops.find((st) => st.at === 'meadow').s);
const gear = await step('gear', () => createGear(scene, { position: MEADOW.mat, facing: Math.atan2(-matDir.z, matDir.x), renderer }));
// Scene 4: the summit (the rising sea of clouds, snow peaks, rocks and the flag), and the hero's
// ambience: slow motes of light drifting in the summit air.
const summit = await step('summit', () => createSummitZone(scene, { sunDir: sky.sunDir }));
const motes = await step('motes', () => createMotes(scene));

reportProgress(0.3);   // the world is built

// The later zones (ridge, landmarks, meadow, gear, summit) are kept off camera for now, on a render
// layer the camera doesn't look at, until their shaders are ready (compileTheRest). The film can then
// go live as soon as the OPENING is ready, instead of waiting for the whole mountain. They carry no
// lights, so hiding them doesn't change any other shader.
// (each one was put on that layer as it was built: see step())
const laterParts = scene.children.filter((c) => !openingParts.has(c));

// Every part's shaders were handed to the graphics driver as that part was built (step(), above),
// so they are compiling in the background already. The film doesn't wait for all of them: only for
// what the opening shot draws (warmUp and gpuSettled, below). The ridge, meadow and summit, minutes of
// scrolling away, finish compiling while the visitor reads the opening.
// (The sea of clouds and the far peaks start hidden, so they're compiled once the film is live:
// see compileTheRest.)
async function compileTheRest() {
  const t0 = performance.now();
  // One part at a time, each finished on the graphics card before the next starts, with a frame's
  // pause between: done all at once, this work made the first frames of the live film stutter.
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
  for (const part of laterParts) {
    summit.update(0, 1);
    const done = renderer.compileAsync(part, camera, scene);   // (it collects what to compile right away...)
    summit.update(0, 0);                                       // (...so they can be hidden again at once)
    await done;
    for (const t of texturesOf([part])) renderer.initTexture(t);
    await gpuSettled();
    await frame();
  }
  // Then back on camera.
  laterParts.forEach((part) => part.traverse((o) => o.layers.set(0)));
  buildTimes.rest = Math.round(performance.now() - t0);
}
let restReady = null;
const readyTheRest = () => (restReady ??= compileTheRest());

// Every texture used by these objects (pictures and painted maps; videos upload themselves).
function texturesOf(objects) {
  const textures = new Set();
  for (const obj of objects) obj.traverse((o) => {
    for (const m of [].concat(o.material || [])) {
      for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) textures.add(u.value);
    }
  });
  return [...textures].filter((t) => !t.isVideoTexture && t.image);
}

// The first frame also has to send every texture and mesh to the graphics card, which used to take
// half a second in one go. Do it piece by piece instead, with a pause between pieces.
// Get the opening ready on the graphics card, without ever freezing the page: wait for the trekker,
// wait (asynchronously) until the opening's shaders are compiled, draw the opening once, piece by
// piece, then wait until the graphics card has really finished.
async function warmOpening() {
  // (one thing at a time for the graphics card: his shaders first, then the rest of the opening's,
  // or he would wait in the same queue and hold the page up)
  await trekkerFirstDraw;
  const t0 = performance.now();
  for (const part of openingParts) renderer.compile(part, camera, scene);
  await Promise.all([...openingParts].map((part) => renderer.compileAsync(part, camera, scene)));
  await warmUp();
  await gpuSettled();
  buildTimes.opening = Math.round(performance.now() - t0);
}

// The trekker's first draw, on his own (everything else hidden for that one draw), as soon as his
// shaders are compiled. The page isn't held up: the graphics card does the slow part in the
// background while we carry on building.
async function drawTrekkerEarly() {
  const root = scene.getObjectByName('trekker');
  if (!root || !trekker.debug.vrm) return;
  await renderer.compileAsync(root, camera, scene);
  cameraPath.update(camera, 0, 0, true);
  const others = scene.children.filter((c) => c !== root && c.visible && !hasLight(c));
  others.forEach((c) => { c.visible = false; });
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  renderer.render(scene, camera);
  others.forEach((c) => { c.visible = true; });
}
function hasLight(o) { let found = false; o.traverse((x) => { if (x.isLight) found = true; }); return found; }

async function warmUp() {
  // (only the opening's: the later zones send theirs once the film is live, compileTheRest)
  for (const t of texturesOf([...openingParts])) {
    const t0 = performance.now();
    renderer.initTexture(t);
    warmTimes.push(['tex ' + (t.image.width || '?') + 'x' + (t.image.height || '?'), Math.round(performance.now() - t0)]);
    await yieldToBrowser();
  }
  // Then draw the opening shot one part at a time (each draw uploads only that part's shapes).
  // Lights stay on: hiding one changes every shader's light count, forcing them all to rebuild.
  cameraPath.update(camera, 0, 0, true);
  const parts = [...openingParts].filter((c) => c.visible && !hasLight(c));
  parts.forEach((c) => { c.visible = false; });
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  for (const c of parts) {
    c.visible = true;
    const t0 = performance.now();
    renderer.render(scene, camera);
    warmTimes.push(['draw ' + (c.name || c.type), Math.round(performance.now() - t0)]);
    await yieldToBrowser();
  }
  renderer.clear();
}

// ---------- 4. Scrolling → progress (0 at the top of the film, 1 at its end) ----------
// The film section is FILM_SCREENS screen-heights of scrolling (site.js sets its height). After the
// film, one more screen holds the summit hero before the page carries on below.
const film = document.getElementById('film');
const stage = document.getElementById('stage');
const scroll = { target: 0, progress: 0 };
const trigger = ScrollTrigger.create({
  trigger: '#film',
  start: 'top top',
  end: () => `+=${FILM_SCREENS * window.innerHeight}`,
  invalidateOnRefresh: true,
  onUpdate: (self) => { scroll.target = self.progress; },
});
scroll.target = trigger.progress;

// ---------- The light: how far through the dawn we are at a point of the scroll ----------
function lightAt(p) {
  for (let i = 0; i < LIGHT.length - 1; i++) {
    const [p0, c0] = LIGHT[i], [p1, c1] = LIGHT[i + 1];
    if (p <= p1) return c0 + (c1 - c0) * smoothstep(p0, p1, p);
  }
  return LIGHT[LIGHT.length - 1][1];
}

// ---------- The walking speed limit (and catching up) ----------
// From film progress "from", move towards "to", but never so far that the trekker would cover
// more than his allowed speed x dt metres this frame. If the film has fallen behind the scroll
// ("gap", in metres), the allowed speed rises so the gap closes in about CATCH_UP_SECONDS.
const STAND_UP_WAIT = 1.2;
let standUpWait = 0;
let catchingUp = false;
function limitWalk(from, to, dt, gap) {
  const s0 = cameraPath.trekkerS(from);
  if (gap > 4) catchingUp = true;
  else if (gap < 0.3) catchingUp = false;
  const floor = catchingUp ? CATCH_UP_MIN_SPEED : MAX_WALK_SPEED;
  const speed = Math.min(Math.max(floor, gap / CATCH_UP_SECONDS), CATCH_UP_MAX_SPEED);
  const stepLen = speed * dt;
  if (Math.abs(cameraPath.trekkerS(to) - s0) <= stepLen) return to;
  let lo = from, hi = to;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (Math.abs(cameraPath.trekkerS(mid) - s0) <= stepLen) lo = mid; else hi = mid;
  }
  return lo;
}

// ---------- The interface on the film ----------
// The altitude meter: one stacked label (the place we're in, the live altitude worked out from how
// high the trekker is on the trail, and how far is left to the summit) beside the progress line.
const altitude = createAltitudeMeter(document.getElementById('altitude'), {
  stations: ZONES.map((z, i) => ({ progress: z.from, name: z.name, metres: i === ZONES.length - 1 ? ALTITUDE.summit : 0 })),
});
// The trail's height, smoothed so it only ever rises: the meter never counts down on a dip.
const ALT_STEPS = 500;
const altTable = new Float32Array(ALT_STEPS + 1);
for (let i = 0, top = 0; i <= ALT_STEPS; i++) {
  top = Math.max(top, trailPointAt((i / ALT_STEPS) * TRAIL_LENGTH).y);
  altTable[i] = top;
}
function metresAt(u) {
  const f = Math.min(Math.max(u, 0), 1) * ALT_STEPS;
  const i = Math.min(Math.floor(f), ALT_STEPS - 1);
  const y = altTable[i] + (altTable[i + 1] - altTable[i]) * (f - i);
  return ALTITUDE.base + (ALTITUDE.summit - ALTITUDE.base) * Math.min(y / SUMMIT_HEIGHT, 1);
}
const zoneName = (p) => (ZONES.find((z) => p < z.to) || ZONES[ZONES.length - 1]).name;

// ---------- FPS counter ----------
const fpsEl = document.getElementById('fps');
fpsEl.hidden = !SHOW_FPS;
let frames = 0, fpsTime = performance.now(), fps = 0;
window.addEventListener('keydown', (e) => {
  if ((e.key === 'f' || e.key === 'F') && !e.target.closest('input, textarea')) fpsEl.hidden = !fpsEl.hidden;
});
function countFps(now) {
  frames++;
  if (now - fpsTime >= 1000) {
    fps = Math.round((frames * 1000) / (now - fpsTime));
    frames = 0;
    fpsTime = now;
    if (!fpsEl.hidden) fpsEl.textContent = `${fps} fps`;
  }
}

// ---------- Moving the trekker along the trail ----------
const trekPos = new THREE.Vector3();
let summitBeat = 'arrive';   // the summit: he arrives, stretches, then stands looking at the sunrise
const pointed = CAMPS.map(() => false);
const trekDir = new THREE.Vector3();
let heading = null;
function placeTrekker(s, dt, stops) {
  trailPointAt(s, trekPos);
  trailDirectionAt(s, trekDir);
  let target = Math.atan2(trekDir.x, trekDir.z);
  // At a landmark he steps off the trail to his viewing spot beside the project, and back on as
  // we leave. The walk animation follows his movement, so he walks there.
  for (const { stop, here } of stops) {
    if (!stop.camp?.spot || here <= 0) continue;
    const w = smoothstep(0.25, 0.9, here);
    trekPos.x += (stop.camp.spot[0] - trekPos.x) * w;
    trekPos.z += (stop.camp.spot[1] - trekPos.z) * w;
  }
  // At a camp, turn to face its screen; at the gear check, towards the mat; at the summit, turn
  // to face the sunrise (the hero: he stands with his back three-quarters to us, looking at it).
  for (const { stop, here } of stops) {
    if (here <= 0) continue;
    let look = null, amount = 0.85;
    if (stop.camp) look = stop.camp.screen;
    else if (stop.at === 'meadow') { look = MEADOW.mat; amount = 0.9; }
    else if (stop.at === 'summit') { look = [trekPos.x + sky.sunDir.x * 60, trekPos.z + sky.sunDir.z * 60]; amount = 1; }
    if (!look) continue;
    let d = Math.atan2(look[0] - trekPos.x, look[1] - trekPos.z) - target;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    target += d * here * amount;
  }
  if (heading === null) heading = target;
  let diff = target - heading;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  heading += diff * (1 - Math.exp(-dt * 3.2));   // a slow, calm turn
  trekker.place(trekPos.x, trekPos.z, heading);
}

// ---------- Story, camps, gear check ----------
// The words' soft shade: the scene darkens a little right behind whatever text is showing.
const shade = createShade();
const story = createStory({ reduceMotion, shade });
const openingEl = document.getElementById('opening');
const gearTitle = document.querySelector('.gear-ui__title');
const campUI = createCampUI({ camps, defs: CAMPS, camera, cameraPath, reduceMotion, getProgress: () => scroll.progress });
const gearUI = createGearUI({ gear, camera, onHover: (id) => trekker.lookAt(id ? gear.centres[id] : null) });

// ---------- Where the film ends and the hero holds ----------
const filmEndScroll = () => film.offsetTop + FILM_SCREENS * window.innerHeight;
// The hero holds for a stretch after the film (css/style.css --hold); "skip" lands in its middle.
const HOLD = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hold')) || 0.6;
const heroScroll = () => film.offsetTop + (FILM_SCREENS + HOLD * 0.5) * window.innerHeight;

// ---------- "Skip film": glide to the summit hero through a soft mist ----------
// The page glides down while the world dissolves into mist; under the mist the film jumps to its
// last shot; the mist clears on the summit and the camera drifts gently into the final frame.
let gliding = false;
async function glideToEnd() {
  if (gliding) return;
  gliding = true;
  if (!reduceMotion) lenis.scrollTo(heroScroll(), { duration: 2.2, easing: (t) => 1 - Math.pow(1 - t, 3) });
  await veil(true, { duration: reduceMotion ? 500 : 1000 });
  await readyTheRest();   // (the summit must be ready before the mist clears onto it)
  jumpTo(1, { moveScroll: false });
  lenis.scrollTo(heroScroll(), { immediate: true, force: true });
  summitBeat = 'look';   // straight to the final pose: no stretch on a skip
  if (!reduceMotion) {
    // Start a little back down the slope from the final shot, then settle into it.
    const shot = cameraPath.stops[cameraPath.stops.length - 1].shot;
    const f = cameraPath.focus;
    f.look.copy(shot.look);
    f.pos.copy(shot.pos).lerp(shot.look, -0.25);
    f.pos.y += 3;
    f.w = 1;
    gsap.to(f, { w: 0, duration: 3.2, ease: 'power2.out', delay: 0.2 });
  }
  await new Promise((r) => setTimeout(r, 250));
  await veil(false, { duration: reduceMotion ? 600 : 1800 });
  gliding = false;
}

// ---------- Skipping ahead through the mist (a scrollbar drag, a long flick) ----------
let skipping = false;
async function mistSkip() {
  skipping = true;
  await veil(true, { duration: reduceMotion ? 400 : 450 });
  let last = -1, still = 0;
  while (still < 3) {
    await new Promise((r) => setTimeout(r, 80));
    const now = Math.round(lenis.scroll);
    still = now === last ? still + 1 : 0;
    last = now;
  }
  await readyTheRest();   // (wherever we land must be ready before the mist clears)
  jumpTo(scroll.target, { moveScroll: false });
  skipping = false;
  await veil(false, { duration: reduceMotion ? 500 : 650 });
}

// ---------- The film's frame: update, then draw ----------
let snapNextFrame = true;   // the first frame puts the camera exactly in place
let shownMist = '';
let live = false;           // true once the poster has handed over to the live scene

function frame(dt, time, rect) {
  // Keep the camera's shape matched to the stage box it draws into.
  const aspect = rect.width / rect.height;
  if (Math.abs(camera.aspect - aspect) > 1e-4) { camera.aspect = aspect; camera.updateProjectionMatrix(); }

  // Visitors who jump far below the film (a nav link) while the trekker is far behind: finish
  // the film quietly, so it's at the summit if they scroll back up.
  if (lenis.targetScroll > filmEndScroll() + window.innerHeight && scroll.progress < 0.999 && !gliding) jumpTo(1, { moveScroll: false });

  // A second, gentle smoothing on top of Lenis, so the film never lurches.
  if (snapNextFrame) scroll.progress = scroll.target;
  const eased = scroll.progress + (scroll.target - scroll.progress) * (1 - Math.exp(-dt * 4));
  const gap = Math.abs(cameraPath.trekkerS(scroll.target) - cameraPath.trekkerS(scroll.progress));
  if (skipping) jumpTo(scroll.target, { moveScroll: false });
  else if (gap > MIST_SKIP_METRES && !gliding && !campUI.opening && live) mistSkip();
  // Leaving the gear check, he stands up before walking on (but never waits long).
  standUpWait = trekker.sitting === 'up' ? standUpWait + dt : 0;
  if (!(standUpWait > 0 && standUpWait < STAND_UP_WAIT && !skipping && !gliding)) {
    scroll.progress = snapNextFrame ? eased : limitWalk(scroll.progress, eased, dt, gap);
  }
  const p = scroll.progress;

  const s = cameraPath.update(camera, p, dt, snapNextFrame);   // metres along the trail
  const stops = cameraPath.stopInfo(p);
  placeTrekker(s, dt, stops);
  snapNextFrame = false;

  // Light: one "climb" number (0 = night ... 1 = sunrise) sets the palette's mood. Sky, fog,
  // lights, mist, trees, mountains and the trekker all read from it, so they change together.
  setClimb(lightAt(p));
  sky.applyMood();
  mountains.userData.applyMood();
  stage.classList.toggle('is-day', mood.climb > 0.56);
  const mistHex = mistColour();
  if (mistHex !== shownMist) { shownMist = mistHex; stage.style.setProperty('--mist', mistHex); }
  mountains.userData.setRise(smoothstep(62, 118, camera.position.y));
  trekker.setLightLevel(mood.character.level, mood.character.tint);
  altitude.update(p, metresAt(s / TRAIL_LENGTH), zoneName(p));
  story.update(p);

  // Each project camp "wakes up" (projector on, video playing) as we arrive. Its video is only
  // loaded while we're within reach of it, and let go once we're well past it.
  const nears = camps.map((camp, i) => {
    const { arrive, leave } = stops.find((st) => st.stop.camp === CAMPS[i]).stop;
    const near = smoothstep(arrive - 0.08, arrive, p) * (1 - smoothstep(leave, leave + 0.06, p));
    // The first camp's video starts loading once the climb has begun (not during the opening,
    // where it used to compete with the world for the network).
    const wanted = p > (i === 0 ? 0.02 : arrive - 0.12) && p < leave + 0.1;
    camp.update(dt, camera, near, wanted, time);
    return near;
  });
  campLights.update(camps, camera);
  campUI.update(nears);

  // The gear check: explorable once we've arrived and the camera has settled.
  const atMeadow = stops.find((st) => st.stop.at === 'meadow');
  const settled = atMeadow.here * smoothstep(atMeadow.stop.arrive, atMeadow.stop.arrive + 0.012, p) * (1 - smoothstep(atMeadow.stop.leave - 0.03, atMeadow.stop.leave, p));
  if (p > 0.4) gear.prepare();
  gearUI.update(settled);
  trekker.setSitting(settled > 0.9);
  gear.update(dt, time);

  // The summit: he stretches as the sun breaks, then turns to stand looking at the sunrise,
  // breathing (his idle). Scrolling back down resets it.
  const atTop = stops[stops.length - 1];
  if (atTop.here > 0.98 && atTop.shot > 0.9 && trekker.walking < 0.08 && !gliding) {
    if (summitBeat === 'arrive') summitBeat = trekker.play('stretch') ? 'stretch' : 'look';
    else if (summitBeat === 'stretch' && !trekker.playing('stretch')) summitBeat = 'look';
  }
  if (atTop.here < 0.6) summitBeat = 'arrive';

  // At each landmark: he points at it as the camera arrives, then looks around while we watch.
  camps.forEach((_, i) => {
    const at = stops.find((st) => st.stop.camp === CAMPS[i]);
    if (at.here > 0.9 && at.shot > 0.5 && !pointed[i]) { pointed[i] = true; trekker.play('point'); }
    if (at.here < 0.5) pointed[i] = false;
  });
  trekker.setLoop(stops.some((st) => st.stop.camp && st.here > 0.95) ? 'look' : null);

  summit.update(time, mood.climb);
  motes.update(time, smoothstep(0.86, 0.98, mood.climb), camera);

  sky.update(time, camera, renderer.getPixelRatio());
  // Only draw what the camera can see: once we're up on the meadow, base camp's forest is far
  // behind us and sinking under the clouds, so its ~8,000 trees are skipped entirely.
  forest.setVisible(p < 0.66);
  WIND.time.value = time;
  baseCamp.update(time);
  mist.update(time);
  trekker.update(dt, time);

  renderer.render(scene, camera);
  // Then the shade behind the words on screen (the opening title, a story beat, the gear check).
  shade.set('opening', openingEl, openingEl.style.visibility === 'hidden' ? 0 : Number(openingEl.style.opacity || 1));
  shade.set('gear', gearTitle, settled > 0.92 ? 1 : 0);
  shade.render(renderer, rect);
  // The hand-over asked for a picture of this frame: copy it now, while it's still in the canvas.
  if (snapshotTo) { takeSnapshot(snapshotTo); snapshotTo = null; }
  countFps(performance.now());
}

// ---------- A blurred picture of the last frame, for the hand-over to the page (site.js) ----------
// Drawn once into a small canvas (a quarter of the screen's size) with a blur, then shown scaled up:
// it looks like a soft focus pull, and costs nothing while it's on screen (no live blur filter).
let snapshotTo = null;
function takeSnapshot(target) {
  const w = Math.max(2, Math.round(window.innerWidth / 4));
  const h = Math.max(2, Math.round(window.innerHeight / 4));
  if (target.width !== w || target.height !== h) { target.width = w; target.height = h; }
  const ctx = target.getContext('2d');
  ctx.filter = 'blur(5px)';
  // A little larger than the box, so the blur never pulls in see-through edges.
  ctx.drawImage(renderer.domElement, -6, -6, w + 12, h + 12);
}

// The film becomes a view of the shared renderer: it draws into the pinned stage's box.
const view = addView({ el: stage, frame, ready: false, name: 'film' });

// Jump straight to a point in the film (0..1): the page scroll, the film and the camera.
function jumpTo(p, { moveScroll = true } = {}) {
  if (moveScroll) lenis.scrollTo(film.offsetTop + p * FILM_SCREENS * window.innerHeight, { immediate: true, force: true });
  scroll.target = p;
  scroll.progress = p;
  snapNextFrame = true;
  heading = null;
  trekker.teleport();
}

// A small hook so tests (and you, in the console) can peek at the state.
window.__ascent = {
  ready: false,
  get fps() { return fps; },
  get progress() { return scroll.progress; },
  info: () => ({ trees: forest.counts, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries, build: buildTimes, warm: warmTimes.filter((w) => w[1] > 8) }),
  jump: jumpTo,
  // (tests: wait until the whole mountain, not just the opening, is ready to be shown)
  whenComplete: () => readyTheRest(),
  glideToEnd,
  // The hand-over: copy the next frame (blurred) into a canvas, and stop or restart drawing the
  // film once the page has covered it (no point drawing what nobody can see).
  snapshot: (canvas) => { snapshotTo = canvas; },
  pause: (on) => { if (view.paused !== on) { view.paused = on; wake(); } },
  lenis,
  scene,
  camera,
  cameraPath,
  trekker,
  renderer,
  landmarks: camps,
  videos: () => camps.map((c, i) => `${CAMPS[i].id}:${c.videoElement ? (c.videoElement.paused ? 'loaded' : 'playing') : '-'}`).join(' '),
};

// ---------- 5. Handing over from the poster to the live scene ----------
// The opening has been getting ready on the graphics card while the rest was built (warmOpening).
await openingReady;
// (and the soft shade behind the opening words, drawn from the very first frame)
await shade.compile(renderer);
// Opening somewhere further up (back from a project page, a poster still, a page that was already
// scrolled, or "Skip the film" pressed while loading): that part of the mountain must be ready too.
if (returning || STILL !== null || scroll.target > 0.05) await readyTheRest();
reportProgress(1);
if (returning) comeBack();
else jumpTo(STILL ?? scroll.target, { moveScroll: STILL !== null });
if (STILL !== null) summitBeat = 'look';
// One real frame, drawn exactly as the live loop will draw it (gl.js), while the poster still covers
// the canvas: the first live frames draw a few things the warm-up doesn't (the shade behind the
// words, the exact stage box), and preparing those used to make the film stutter as it appeared.
{
  const r = stage.getBoundingClientRect();
  const y = window.innerHeight - r.bottom;
  renderer.setViewport(r.left, y, r.width, r.height);
  renderer.setScissor(r.left, y, r.width, r.height);
  renderer.setScissorTest(true);
  frame(1 / 60, 0, r);
  renderer.setScissorTest(false);
  await gpuSettled();
}
view.ready = true;
wake();
live = true;
window.__ascent.ready = true;
// site.js listens for this: it fades the poster away and turns on the film's text.
window.dispatchEvent(new CustomEvent('ascent:ready', { detail: window.__ascent }));
// Now the rest of the mountain, in the background, while the visitor reads the opening.
readyTheRest().catch((e) => console.error('[film] later zones', e));

// Back from a project page: same spot on the trail, rising out of the mist (camp-ui.js).
function comeBack() {
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(RETURN_KEY)); } catch { /* nothing saved */ }
  const stop = cameraPath.stops.find((st) => st.at === returning);
  const progress = saved?.camp === returning ? saved.progress : stop?.arrive ?? 0;
  history.replaceState(null, '', location.pathname);
  jumpTo(progress);
  campUI.returnFrom(returning);
}

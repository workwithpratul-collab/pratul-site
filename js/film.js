// film.js: the full film ("The Ascent") for desktops, laptops and big tablets. main.js loads it.
// It creates the 3D basics (scene, camera, renderer), builds the world, connects scrolling
// to the camera, then runs one loop that redraws the world about 60 times per second.

import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { createSky } from './world/sky.js';
import { createMountains, createGround, trailPointAt, trailDirectionAt, smoothstep, SUMMIT_HEIGHT, TRAIL_LENGTH } from './world/terrain.js';
import { createForest } from './world/forest.js';
import { createBaseCamp, createCampLights } from './world/camp.js';
import { createLandmark } from './world/landmarks.js';
import { createRidge } from './world/ridge.js';
import { createMeadowZone } from './world/meadow.js';
import { createSummitZone } from './world/summit.js';
import { createMist } from './world/mist.js';
import { createTrekker } from './world/trekker.js';
import { createCameraPath } from './world/cameraPath.js';
import { ZONES, LIGHT, ALTITUDE, FILM_SCREENS, MAX_WALK_SPEED, CATCH_UP_SECONDS, CATCH_UP_MIN_SPEED, CATCH_UP_MAX_SPEED, MIST_SKIP_METRES, CAMPS, MEADOW } from './world/journey.js';
import { mood, setClimb } from './world/palette.js';
import { createAltitudeMeter } from './ui/altitude.js';
import { createCursor } from './ui/cursor.js';
import { WIND } from './world/glsl.js';
import { createGear } from './world/gear.js';
import { createIntro } from './ui/intro.js';
import { createStory } from './ui/story.js';
import { createCampUI } from './ui/camp-ui.js';
import { createGearUI } from './ui/gear-ui.js';
import { createFinale } from './ui/finale.js';
import { veil, veilInstantly, mistColour } from './ui/veil.js';

// ---------- Settings you may want to change ----------
// Show the FPS counter? You can also add ?fps to the address, or press F to toggle it.
const SHOW_FPS = new URLSearchParams(location.search).has('fps');
// Never render at more than 2x pixels: above that the eye can't tell, but the GPU pays.
const MAX_PIXEL_RATIO = 2;
// Still mode, for the style frames: ?still=0 shows base camp, ?still=0.215 the first ridge camp
// (any point of the film, 0..1), as a clean picture with no text. Add &pause to stop drawing
// once it has settled (saves the GPU when several frames sit on one page).
// The loading screen (index.html) shows this progress, 0..1. The code has arrived by now: 20%.
// Building the world takes it to 30%, and the trekker's download fills the rest.
const reportProgress = (value) => window.dispatchEvent(new CustomEvent('ascent:progress', { detail: value }));
reportProgress(0.2);

const params = new URLSearchParams(location.search);
const STILL_POINTS = { 0: 0, 1: 0.215 };   // the old ?still=1 meant "the ridge camp"
const stillParam = params.has('still') ? Number(params.get('still')) || 0 : null;
const STILL = stillParam === null ? null : (STILL_POINTS[stillParam] ?? Math.min(Math.max(stillParam, 0), 1));
if (STILL !== null) document.documentElement.classList.add('is-still');
// "Reduce motion" (a system setting): a calm version with gentle fades instead of camera
// flights and no drifting text. Everything stays available.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Coming back from a project page (?return=dermae): start in the mist, at the same spot.
const RETURN_KEY = 'ascent:return';
const returning = params.get('return');
if (returning) veilInstantly();

// ---------- 1. The renderer: turns the 3D scene into pixels on the canvas ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,                  // smooth edges on shapes
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
renderer.setSize(window.innerWidth, window.innerHeight);
// sRGB output means the colours we pick in code look the same on screen.
renderer.outputColorSpace = THREE.SRGBColorSpace;
// No tone mapping: for a painted look we want our chosen colours shown exactly.
renderer.toneMapping = THREE.NoToneMapping;

// ---------- 2. The scene: the container that holds every 3D object ----------
const scene = new THREE.Scene();

// ---------- 3. The camera: our eye in the world ----------
// 40° is a calm, slightly "telephoto" view; wide angles feel dizzying when moving.
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 6000);

// ---------- 4. Light and sky ----------
// sky.js owns the sky dome, stars, moonlight, fill light and fog, so they can change together.
// The sun's light comes from a little higher than the sun itself (a painter's cheat), so the
// low morning light still lays warm gold on the meadow and the snow instead of only grazing them.
const sky = createSky(scene, { sunLightDir: new THREE.Vector3(0.62, 0.32, -0.78) });

// ---------- 5. The world ----------
// The camera path is worked out first, so the forest can keep trees off the camera's route.
const cameraPath = createCameraPath();
const mountains = createMountains(scene);
createGround(scene);
const forest = createForest(scene, {
  routeDistance: cameraPath.routeDistance,
  legacyRouteDistance: cameraPath.legacyRouteDistance,
  sky,
});
const baseCamp = createBaseCamp(scene);
const mist = createMist(scene);
const trekker = createTrekker(scene, renderer, camera, { onProgress: (f) => reportProgress(0.3 + f * 0.68) });

// Scene 2: the ridge (grass, stones, trees, valley mist) and the three project landmarks along
// the trail: a still lake, a stone hut and a trail signboard (journey.js, landmarks.js).
createRidge(scene);
const camps = CAMPS.map((c) => createLandmark(scene, c, { renderer }));
const campLights = createCampLights(scene);
campLights.update(camps, camera);
// Scene 3: the meadow (grass, wildflowers, trees, stones, mist) and the gear check: the kit laid
// out on a canvas mat beside the trail, its long side running along the path.
createMeadowZone(scene);
const matDir = trailDirectionAt(cameraPath.stops.find((st) => st.at === 'meadow').s);
const gear = createGear(scene, { position: MEADOW.mat, facing: Math.atan2(-matDir.z, matDir.x), renderer });
// Scene 4: the summit (the rising sea of clouds, snow peaks, rocks and the flag).
const summit = createSummitZone(scene, { sunDir: sky.sunDir });

reportProgress(0.3);   // the world is built

// Build every shader now, while the curtain is still down. Otherwise three.js compiles each
// one the first time its object comes into view, which causes a small stutter mid-scroll.
// (The sea of clouds and the far peaks start hidden, so show them for this one moment.)
summit.update(0, 1);
renderer.compile(scene, camera);
summit.update(0, 0);

// ---------- 6. Scrolling → progress (0 at the top of the film, 1 at its end) ----------
// The film section is FILM_SCREENS screen-heights of scrolling (journey.js); below it the page
// continues with the sections (placeholders for now).
const film = document.getElementById('film');
const stage = document.getElementById('stage');
film.style.height = `${(FILM_SCREENS + 1) * 100}vh`;
// Lenis smooths the wheel/trackpad so scrolling glides instead of jumping in steps. Links to
// places on the page (#contact, #work...) glide there too. With "reduce motion" it's plain scrolling.
const lenis = new Lenis({
  lerp: 0.07,
  wheelMultiplier: 0.8,
  smoothWheel: !reduceMotion,
  // (offset: leave room for the top navigation bar below the film)
  anchors: reduceMotion ? { immediate: true, offset: -72 } : { duration: 2.4, offset: -72 },
});

// ---------- The pages below the film ----------
// Their scripts (demos, work cards, contact form...) are only fetched once the visitor comes
// within two screens of them, so they never slow down the film.
let pagesLoaded = false;
new IntersectionObserver(([entry]) => {
  if (!entry.isIntersecting || pagesLoaded) return;
  pagesLoaded = true;
  import('./pages/pages.js').then((m) => m.initPages({ lenis }));
}, { rootMargin: '200% 0px' }).observe(document.getElementById('content'));
gsap.registerPlugin(ScrollTrigger);
// Let GSAP's clock drive Lenis, and tell ScrollTrigger whenever Lenis scrolls.
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

const scroll = { target: 0, progress: 0 };
ScrollTrigger.create({
  trigger: '#film',
  start: 'top top',
  end: 'bottom bottom',
  onUpdate: (self) => { scroll.target = self.progress; },
});

// ---------- The light: how far through the dawn we are at a point of the scroll ----------
// journey.js lists a few points (LIGHT); in between, the light eases from one to the next.
function lightAt(p) {
  for (let i = 0; i < LIGHT.length - 1; i++) {
    const [p0, c0] = LIGHT[i], [p1, c1] = LIGHT[i + 1];
    if (p <= p1) return c0 + (c1 - c0) * smoothstep(p0, p1, p);
  }
  return LIGHT[LIGHT.length - 1][1];
}

// ---------- The walking speed limit (and catching up) ----------
// From film progress "from", move towards "to", but never so far that the trekker would cover
// more than his allowed speed x dt metres this frame. Normally that's MAX_WALK_SPEED (his feet
// match the ground). If the film has fallen behind the scroll ("gap", in metres), the allowed
// speed rises so the gap closes in about CATCH_UP_SECONDS: he speeds up into a jog, the camera
// with him. trekkerS() always rises with progress, so a short halving search finds the
// furthest allowed point.
const STAND_UP_WAIT = 1.2;
let standUpWait = 0;
let catchingUp = false;   // true from when he falls a few metres behind until he's caught up
function limitWalk(from, to, dt, gap) {
  const s0 = cameraPath.trekkerS(from);
  if (gap > 4) catchingUp = true;
  else if (gap < 0.3) catchingUp = false;
  const floor = catchingUp ? CATCH_UP_MIN_SPEED : MAX_WALK_SPEED;
  const speed = Math.min(Math.max(floor, gap / CATCH_UP_SECONDS), CATCH_UP_MAX_SPEED);
  const step = speed * dt;
  if (Math.abs(cameraPath.trekkerS(to) - s0) <= step) return to;
  let lo = from, hi = to;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (Math.abs(cameraPath.trekkerS(mid) - s0) <= step) lo = mid; else hi = mid;
  }
  return lo;
}

// ---------- The interface on top of the film ----------
// The altitude meter: a tick at each place (the first stop of each zone), and the live altitude
// worked out from how high the trekker is on the trail.
const stopOf = (id) => cameraPath.stops.find((st) => st.at === id);
const altitude = createAltitudeMeter(document.getElementById('altitude'), {
  stations: ['start', 'dermae', 'meadow', 'summit'].map((id) => ({ progress: id === 'start' ? 0 : stopOf(id).arrive })),
});
// The trail's height, measured every metre or so and smoothed so it only ever rises:
// the meter never counts down on a small dip in the path.
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

// A subtle custom cursor (only with a mouse or trackpad; not in the style-frame stills).
if (STILL === null) createCursor();

// ---------- Resize: keep the picture sharp and undistorted when the window changes ----------
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

// ---------- FPS counter: counts frames drawn each second ----------
const fpsEl = document.getElementById('fps');
fpsEl.hidden = !SHOW_FPS;
let frames = 0;
let fpsTime = performance.now();
let fps = 0;
window.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') fpsEl.hidden = !fpsEl.hidden;
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
let summitBeat = 'arrive';         // the summit's three beats: arrive, stretch, turn, wave
let facingCamera = false;          // has he finished turning to where he wants to face?
const pointed = CAMPS.map(() => false);   // has he pointed at this landmark yet, this visit?
const trekDir = new THREE.Vector3();
let heading = null;
function placeTrekker(s, dt, stops) {
  trailPointAt(s, trekPos);
  trailDirectionAt(s, trekDir);
  let target = Math.atan2(trekDir.x, trekDir.z);
  // At a landmark he steps off the trail to his viewing spot beside the project (journey.js,
  // "spot") as the camera arrives, and back onto the trail as we leave. The walk animation
  // follows his movement, so he walks there.
  for (const { stop, here } of stops) {
    if (!stop.camp?.spot || here <= 0) continue;
    const w = smoothstep(0.25, 0.9, here);
    trekPos.x += (stop.camp.spot[0] - trekPos.x) * w;
    trekPos.z += (stop.camp.spot[1] - trekPos.z) * w;
  }
  // At a camp, turn to face its screen. At the gear check, turn a little towards the mat.
  // At the summit, turn right round to face the camera (to wave goodbye).
  for (const { stop, here } of stops) {
    if (here <= 0) continue;
    let look = null, amount = 0.85;
    if (stop.camp) look = stop.camp.screen;
    else if (stop.at === 'meadow') { look = MEADOW.mat; amount = 0.9; }
    else if (stop.at === 'summit' && (summitBeat === 'turn' || summitBeat === 'wave')) { look = [camera.position.x, camera.position.z]; amount = 1; }
    if (!look) continue;
    let d = Math.atan2(look[0] - trekPos.x, look[1] - trekPos.z) - target;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    target += d * here * amount;
  }
  // Turn smoothly towards the target (taking the short way round the circle).
  if (heading === null) heading = target;
  let diff = target - heading;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  facingCamera = Math.abs(diff) < 0.2;
  heading += diff * (1 - Math.exp(-dt * 5));
  trekker.place(trekPos.x, trekPos.z, heading);
}

// ---------- The interface on the film: story, camps, gear check, finale ----------
const intro = createIntro({ reduceMotion });
const story = createStory({ reduceMotion });
const finale = createFinale({ reduceMotion });
const campUI = createCampUI({ camps, defs: CAMPS, camera, cameraPath, reduceMotion, getProgress: () => scroll.progress });
// While an item is hovered, the seated trekker looks at it.
const gearUI = createGearUI({ gear, camera, lenis, reduceMotion, onHover: (id) => trekker.lookAt(id ? gear.centres[id] : null) });

// ---------- "Skip film", and finishing the film for impatient scrollers ----------
// The page glides down to the end of the film while the world dissolves into mist; the mist
// clears on the summit and the camera drifts gently into the final shot. No fast-forward rush.
let gliding = false;
const filmEndScroll = () => film.offsetTop + film.offsetHeight - window.innerHeight;
async function glideToEnd({ moveScroll = true } = {}) {
  if (gliding) return;
  gliding = true;
  if (moveScroll && !reduceMotion) lenis.scrollTo(filmEndScroll(), { duration: 2.2, easing: (t) => 1 - Math.pow(1 - t, 3) });
  await veil(true, { duration: reduceMotion ? 600 : 1000 });
  jumpTo(1, { moveScroll });
  if (!reduceMotion) {
    // Start a little back down the ridge from the final shot, then settle into it.
    const shot = cameraPath.stops[cameraPath.stops.length - 1].shot;
    const f = cameraPath.focus;
    f.look.copy(shot.look);
    f.pos.copy(shot.pos).lerp(shot.look, -0.25);
    f.pos.y += 3;
    f.w = 1;
    gsap.to(f, { w: 0, duration: 3.2, ease: 'power2.out', delay: 0.2 });
  }
  await new Promise((r) => setTimeout(r, 250));
  await veil(false, { duration: reduceMotion ? 700 : 1800 });
  gliding = false;
}
document.getElementById('skip').addEventListener('click', (e) => {
  e.preventDefault();
  glideToEnd();
});

// ---------- Skipping ahead through the mist (a very large jump: a scrollbar drag, a long flick) ----------
// A short, soft dissolve: the mist rolls in, the film jumps to wherever the scroll is (and keeps
// following it while the visitor is still dragging), then the mist clears.
let skipping = false;
async function mistSkip() {
  skipping = true;
  await veil(true, { duration: reduceMotion ? 400 : 450 });
  // Wait until the scroll has settled (stopped moving for a moment), then clear.
  let last = -1, still = 0;
  while (still < 3) {
    await new Promise((r) => setTimeout(r, 80));
    const now = Math.round(lenis.scroll);
    still = now === last ? still + 1 : 0;
    last = now;
  }
  jumpTo(scroll.target, { moveScroll: false });
  skipping = false;
  await veil(false, { duration: reduceMotion ? 500 : 650 });
}

// ---------- The loop: update, then draw, every frame ----------
// Timer measures how much time passed since the last frame ("delta time").
const timer = new THREE.Timer();
let snapNextFrame = true;   // the first frame puts the camera exactly in place
let shownMist = '';

function tick(timestamp) {
  timer.update(timestamp);
  const dt = Math.min(timer.getDelta(), 0.1); // cap, so a hiccup never causes a big jump
  const time = timer.getElapsed();

  // The visitor is heading (or already is) below the film while the trekker is still far behind:
  // finish the film quietly in the background, so it's at the summit if they scroll back up.
  if (lenis.targetScroll > filmEndScroll() + 20 && scroll.progress < 0.999) jumpTo(1, { moveScroll: false });
  // Once the film has scrolled off the top of the screen (reading the sections below), stop
  // drawing it: nobody can see it, and it saves the battery.
  if (film.getBoundingClientRect().bottom < -50) return;

  // A second, gentle smoothing on top of Lenis, so the film never lurches.
  if (snapNextFrame) scroll.progress = scroll.target;
  const eased = scroll.progress + (scroll.target - scroll.progress) * (1 - Math.exp(-dt * 4));
  // The walking speed limit: the film may only move as fast as the trekker can really walk
  // (MAX_WALK_SPEED). Through the pauses at each place he isn't walking, so there it follows
  // the scroll freely.
  // How far behind the scroll the trekker is, in metres of trail.
  const gap = Math.abs(cameraPath.trekkerS(scroll.target) - cameraPath.trekkerS(scroll.progress));
  if (skipping) {
    // Under the mist: follow the scroll directly (no walking), until it's settled.
    jumpTo(scroll.target, { moveScroll: false });
  } else if (gap > MIST_SKIP_METRES && !gliding && !campUI.opening && lifted) {
    mistSkip();
  }
  // Leaving the gear check, he stands up before walking on: the film waits for him, but never
  // for more than STAND_UP_WAIT seconds (then the walk blends in as he finishes getting up).
  standUpWait = trekker.sitting === 'up' ? standUpWait + dt : 0;
  if (standUpWait > 0 && standUpWait < STAND_UP_WAIT && !skipping && !gliding) { /* hold still */ }
  else scroll.progress = snapNextFrame ? eased : limitWalk(scroll.progress, eased, dt, gap);
  const p = scroll.progress;

  const s = cameraPath.update(camera, p, dt, snapNextFrame);   // metres along the trail
  const stops = cameraPath.stopInfo(p);
  placeTrekker(s, dt, stops);
  snapNextFrame = false;

  // Light: one "climb" number (0 = night at base camp ... 1 = sunrise at the summit) sets the
  // palette's mood. Sky, fog, lights, mist, trees, mountains and the trekker all read from it,
  // so they change together. The text on top switches to the day ink as first light breaks.
  setClimb(lightAt(p));
  sky.applyMood();
  mountains.userData.applyMood();
  stage.classList.toggle('is-day', mood.climb > 0.56);
  // The world's mist colour, for the soft pane behind story text by day (style.css).
  const mistHex = mistColour();
  if (mistHex !== shownMist) { shownMist = mistHex; stage.style.setProperty('--mist', mistHex); }
  // As the camera climbs the summit, the nearer ranges sink below the sea of clouds.
  mountains.userData.setRise(smoothstep(62, 118, camera.position.y));
  trekker.setLightLevel(mood.character.level, mood.character.tint);
  altitude.update(p, metresAt(s / TRAIL_LENGTH), zoneName(p));
  intro.update(p);
  story.update(p);

  // Each project camp "wakes up" (projector on, video playing) as we arrive, and goes quiet
  // once we've walked on. Its video is only loaded while we're within reach of it in the
  // scroll ("wanted"), and let go again once we're well past it or back down the trail.
  const nears = camps.map((camp, i) => {
    const { arrive, leave } = stops.find((st) => st.stop.camp === CAMPS[i]).stop;
    const near = smoothstep(arrive - 0.08, arrive, p) * (1 - smoothstep(leave, leave + 0.06, p));
    // The first camp's video loads during the opening instead: the browser's very first video
    // start costs one long frame, and it's better spent while the curtain is still down.
    const wanted = p > (i === 0 ? -1 : arrive - 0.12) && p < leave + 0.1;
    camp.update(dt, camera, near, wanted, time);
    return near;
  });
  campLights.update(camps, camera);
  campUI.update(nears);

  // The gear check: the kit can be explored once we've arrived and the camera has settled.
  // If there's a sitting animation, the trekker sits down beside the mat meanwhile.
  const atMeadow = stops.find((st) => st.stop.at === 'meadow');
  const settled = atMeadow.here * smoothstep(atMeadow.stop.arrive, atMeadow.stop.arrive + 0.012, p) * (1 - smoothstep(atMeadow.stop.leave - 0.03, atMeadow.stop.leave, p));
  if (p > 0.4) gear.prepare();   // the paintings load once we're well on the way (not at base camp)
  gearUI.update(settled);
  trekker.setSitting(settled > 0.9);
  gear.update(dt, time);

  // The summit: as the sun breaks and the trekker has turned round, the closing words rise in
  // beside the flag, and he waves (once) at the same moment. Scrolling back down hides them.
  // The summit, in three beats: he stretches as the sun breaks, turns round to face the camera,
  // then waves just as the closing words rise in. Scrolling back down resets it all.
  const atTop = stops[stops.length - 1];
  if (atTop.here > 0.98 && atTop.shot > 0.9 && trekker.walking < 0.08 && !gliding) {
    if (summitBeat === 'arrive') {
      summitBeat = trekker.play('stretch') ? 'stretch' : 'turn';
    } else if (summitBeat === 'stretch' && !trekker.playing('stretch')) {
      summitBeat = 'turn';
    } else if (summitBeat === 'turn' && facingCamera) {
      summitBeat = 'wave';
      finale.show();
      trekker.wave();
    }
  }
  if (atTop.here < 0.6) {
    summitBeat = 'arrive';
    finale.hide();
    trekker.resetWave();
  }

  // At each landmark: he points at it as the camera arrives, then looks around while we watch.
  camps.forEach((_, i) => {
    const at = stops.find((st) => st.stop.camp === CAMPS[i]);
    if (at.here > 0.9 && at.shot > 0.5 && !pointed[i]) {
      pointed[i] = true;
      trekker.play('point');
    }
    if (at.here < 0.5) pointed[i] = false;
  });
  const watching = stops.some((st) => st.stop.camp && st.here > 0.95);
  trekker.setLoop(watching ? 'look' : null);

  // The sea of clouds rises with the light; the flag ripples.
  summit.update(time, mood.climb);

  sky.update(time, camera, renderer.getPixelRatio());
  // Only draw what the camera can see: once we're up on the meadow, base camp's forest is far
  // behind us and sinking under the clouds, so its ~8,000 trees are skipped entirely.
  forest.setVisible(p < 0.66);
  WIND.time.value = time;   // the one breeze that moves grass, flowers, trees (glsl.js)
  baseCamp.update(time);
  mist.update(time);
  trekker.update(dt, time);

  renderer.render(scene, camera);
  countFps(performance.now());
}
renderer.setAnimationLoop(tick);

// Jump straight to a point in the film (0..1): the page scroll, the film and the camera.
function jumpTo(p, { moveScroll = true } = {}) {
  if (moveScroll) lenis.scrollTo(film.offsetTop + p * (film.offsetHeight - window.innerHeight), { immediate: true, force: true });
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
  info: () => ({ trees: forest.counts, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
  jump: jumpTo,
  lenis,
  scene,   // handy in the console: e.g. __ascent.scene.getObjectByName("stones")
  camera,
  cameraPath,
  trekker,
  // Which project videos are loaded right now (for testing the lazy loading).
  landmarks: camps,   // (tests: the landmark objects, e.g. for framing checks)
  videos: () => camps.map((c, i) => `${CAMPS[i].id}:${c.videoElement ? (c.videoElement.paused ? 'loaded' : 'playing') : '-'}`).join(' '),
};

// ---------- 7. The curtain, the opening, and coming back from a project ----------
const curtain = document.getElementById('curtain');
let lifted = false;
function liftCurtain() {
  if (lifted) return;
  lifted = true;
  // Let the count reach 100 for a moment, then dissolve into base camp.
  reportProgress(1);
  setTimeout(() => {
    curtain.classList.add('is-lifted');
    if (!returning) intro.reveal();
    curtain.addEventListener('transitionend', () => curtain.classList.add('is-gone'), { once: true });
    setTimeout(() => curtain.classList.add('is-gone'), 2500);   // (in case no transition runs)
  }, 450);
}
setTimeout(liftCurtain, 6000);

// Tell tests the world is ready once the character has loaded (or failed to).
trekker.ready
  .catch((e) => console.error('[trekker] failed to load', e))
  .finally(() => {
    window.__ascent.ready = true;
    if (STILL !== null) showStill();
    if (returning) comeBack();
    liftCurtain();
  });

// Back from a project page: same spot on the trail, rising out of the mist (camp-ui.js).
function comeBack() {
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(RETURN_KEY)); } catch { /* nothing saved */ }
  const stop = cameraPath.stops.find((st) => st.at === returning);
  const progress = saved?.camp === returning ? saved.progress : stop?.arrive ?? 0;
  history.replaceState(null, '', location.pathname);
  intro.skip();
  jumpTo(progress);
  campUI.returnFrom(returning);
}

// Still mode: jump to the chosen moment, and (with &pause) stop drawing a few seconds later.
function showStill() {
  jumpTo(STILL);
  if (!params.has('pause')) return;
  setTimeout(() => {
    renderer.setAnimationLoop(null);
    // If the frame is resized while paused, draw it once more at the new size.
    window.addEventListener('resize', () => renderer.render(scene, camera));
  }, 4000);
}

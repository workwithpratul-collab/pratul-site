// camp.js: the camps along the trail.
//  - Base camp: a glowing orange dome tent, a lantern with a warm pool of light, rocks.
//  - Project camps (step 11): tents whose side works like a screen.

import * as THREE from 'three';
import { groundHeight, seededRandom } from './terrain.js';

// Where base camp sits (the clearing in terrain.js is centred near here).
export const BASE_CAMP = {
  tent: { x: -3.8, z: -2.2, facing: 0.75 },    // facing: turn (radians) so the door looks towards the trail
  lantern: { x: -1.75, z: 0.35 },
};

// Where the first project camp (DERMAÉ) stands, on the ridge crest at the end of the trail.
export const RIDGE_CAMP = { x: 6.2, z: -147.2 };
// Where the camera stands when we arrive there (cameraPath.js uses this for the arrival shot).
export const RIDGE_VIEWPOINT = { x: -4.8, z: -135.5 };

const WARM = new THREE.Color('#ffae5c');

// ---------- A soft round glow texture, drawn once on a canvas ----------
// Used for halos around lights: bright middle, fading to nothing at the edge.
let glowTexture = null;
export function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.15)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

// A halo: a flat glow that always faces the camera. Additive = it brightens what's behind.
export function makeHalo(color, size, opacity) {
  const mat = new THREE.SpriteMaterial({
    map: getGlowTexture(),
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size, 1);
  return sprite;
}

// =====================================================================
// BASE CAMP
// =====================================================================
export function createBaseCamp(scene) {
  const group = new THREE.Group();
  group.name = 'base-camp';

  // ---------- The tent ----------
  const tent = buildDomeTent();
  const { x: tx, z: tz, facing } = BASE_CAMP.tent;
  tent.position.set(tx, groundHeight(tx, tz) - 0.05, tz);
  tent.rotation.y = facing;
  group.add(tent);

  // Warm light inside the tent: lights the ground around it (no shadows, so it shines "through" the fabric).
  const tentLight = new THREE.PointLight(WARM, 28, 16, 2);
  tentLight.position.set(tx, tent.position.y + 0.7, tz);
  group.add(tentLight);
  // A big soft glow around the tent, like light scattering in the night air.
  const tentHalo = makeHalo('#ff7a2a', 7, 0.26);
  tentHalo.position.set(tx, tent.position.y + 0.7, tz);
  group.add(tentHalo);

  // ---------- The lantern ----------
  const lantern = buildLantern();
  const { x: lx, z: lz } = BASE_CAMP.lantern;
  lantern.position.set(lx, groundHeight(lx, lz), lz);
  group.add(lantern);

  const lanternLight = new THREE.PointLight('#ffa552', 12, 10, 2);
  lanternLight.position.set(lx, lantern.position.y + 0.32, lz);
  group.add(lanternLight);
  const lanternHalo = makeHalo('#ff9642', 1.5, 0.5);
  lanternHalo.position.copy(lanternLight.position);
  group.add(lanternHalo);

  // ---------- Rocks ----------
  const rocks = [
    { x: -5.6, z: -0.4, s: 0.55 }, { x: -6.1, z: 0.4, s: 0.32 }, { x: -1.2, z: 0.75, s: 0.26 },
    { x: 2.2, z: -3.5, s: 0.7 }, { x: 2.9, z: -2.8, s: 0.36 }, { x: -2.4, z: -5.8, s: 0.45 },
    { x: 3.4, z: 4.5, s: 0.5 }, { x: -4.4, z: 3.6, s: 0.4 },
  ];
  const rand = seededRandom(77);
  const rockMat = new THREE.MeshLambertMaterial({ color: '#8e958b', flatShading: true });
  for (const r of rocks) {
    const rock = new THREE.Mesh(buildRockGeometry(rand), rockMat);
    rock.position.set(r.x, groundHeight(r.x, r.z) - r.s * 0.25, r.z);
    rock.scale.set(r.s * 1.3, r.s * 0.8, r.s);
    rock.rotation.y = rand() * Math.PI;
    group.add(rock);
  }

  scene.add(group);

  // ---------- update: the lantern flickers very gently (calm, not a disco) ----------
  function update(time) {
    const flicker = 1 + Math.sin(time * 7.3) * 0.03 + Math.sin(time * 13.1 + 1.7) * 0.02 + Math.sin(time * 2.1) * 0.03;
    lanternLight.intensity = 12 * flicker;
    lanternHalo.material.opacity = 0.5 * flicker;
    tentLight.intensity = 28 * (1 + Math.sin(time * 1.3) * 0.02);
  }

  return { group, update, tentLight, lanternLight, lanternPosition: lanternLight.position.clone() };
}

// =====================================================================
// PROJECT CAMPS: a cabin tent whose front wall is a video screen
// =====================================================================
// options: { x, z, facing, video, label } where label is the HTML element to float near the tent.
export function createProjectCamp(scene, { x, z, facing, video: videoSrc, label, renderer }) {
  const group = new THREE.Group();
  group.name = 'project-camp';
  const y = groundHeight(x, z);
  group.position.set(x, y - 0.05, z);
  group.rotation.y = facing;          // the screen (front wall) faces this way

  // ---------- Tent body: walls + a pitched roof ----------
  const W = 4.8, D = 3.0, wallH = 2.25, roofH = 0.9;
  const fabric = new THREE.MeshLambertMaterial({ color: '#d8c5a2', emissive: '#2a1a0c' });
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, wallH, D), fabric);
  body.position.y = wallH / 2;
  group.add(body);

  // The roof: a triangle shape pushed out along the tent's length (a "prism").
  const tri = new THREE.Shape();
  tri.moveTo(-D / 2 - 0.15, 0);
  tri.lineTo(D / 2 + 0.15, 0);
  tri.lineTo(0, roofH);
  tri.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(tri, { depth: W + 0.3, bevelEnabled: false });
  roofGeo.translate(0, 0, -(W + 0.3) / 2);
  roofGeo.rotateY(Math.PI / 2);
  const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: '#b96d3c' }));
  roof.position.y = wallH;
  group.add(roof);

  // Poles at the corners and guy ropes down to the ground, for a real campsite feel.
  const poleMat = new THREE.MeshLambertMaterial({ color: '#3d3530' });
  const ropeMat = new THREE.LineBasicMaterial({ color: '#8a8478', transparent: true, opacity: 0.6 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, wallH + 0.15, 6), poleMat);
      pole.position.set((sx * W) / 2, (wallH + 0.15) / 2, (sz * D) / 2);
      group.add(pole);
      const rope = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3((sx * W) / 2, wallH, (sz * D) / 2),
        new THREE.Vector3((sx * (W / 2 + 1.1)), 0.02, sz * (D / 2 + 0.9)),
      ]);
      group.add(new THREE.Line(rope, ropeMat));
    }
  }

  // ---------- The screen: the front wall plays the project video ----------
  // 4.2 x 2.02 m matches the video's shape (1888 x 908), so nothing is stretched.
  const screenW = 4.2, screenH = 4.2 * (908 / 1888);
  // Start with a tiny 1x1 placeholder picture. When the video arrives we only swap the picture,
  // so three.js never has to build a new shader mid-scroll (that would cause a small stutter).
  const placeholder = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  placeholder.needsUpdate = true;
  const screenMat = new THREE.MeshBasicMaterial({ map: placeholder, color: '#2a2630', toneMapped: false, fog: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), screenMat);
  screen.position.set(0, 0.12 + screenH / 2, D / 2 + 0.012);
  group.add(screen);

  // Soft light spilling from the screen onto the ground in front of it.
  const screenLight = new THREE.PointLight('#f5ddd4', 0, 11, 2);
  screenLight.position.set(0, 1.2, D / 2 + 1.4);
  group.add(screenLight);

  // A small lantern by the tent, so the camp feels lived-in (and echoes base camp).
  const lantern = buildLantern();
  lantern.position.set(-W / 2 - 0.6, 0, D / 2 + 0.5);
  group.add(lantern);
  const lanternLight = new THREE.PointLight('#ffa552', 6, 7, 2);
  lanternLight.position.set(-W / 2 - 0.6, 0.35, D / 2 + 0.5);
  group.add(lanternLight);
  const lanternHalo = makeHalo('#ff9642', 1.3, 0.45);
  lanternHalo.position.copy(lanternLight.position);
  group.add(lanternHalo);

  scene.add(group);

  // ---------- The video ----------
  // At load we only fetch the first frame ("metadata"), and send it to the graphics card
  // straight away, while the curtain is still down. The full file (it's large) is only
  // downloaded later, once we're part-way up the trail (see loadVideo).
  let videoReady = false;
  const video = document.createElement('video');
  video.muted = true;          // muted videos are allowed to autoplay
  video.loop = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.addEventListener('loadeddata', () => {
    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    renderer?.initTexture(texture); // upload now, not in the middle of the film
    screenMat.map = texture;        // same kind of material, just a new picture: no shader rebuild
    videoReady = true;
    // Warm up the video decoder: play for a moment, then pause. Starting a decoder takes
    // a little time, so we do it now instead of when the camp comes into view.
    video.play().then(() => {
      video.pause();
      video.currentTime = 0;
    }).catch(() => {});
  }, { once: true });
  video.src = videoSrc;

  let fullLoadStarted = false;
  function loadVideo() {
    if (fullLoadStarted) return;
    fullLoadStarted = true;
    video.preload = 'auto';         // now download the rest of the file in the background
  }

  // Where the label floats: just above the top-left corner of the screen.
  const labelAnchor = new THREE.Vector3(-screenW / 2, wallH + 0.55, D / 2);
  const projected = new THREE.Vector3();
  let screenOn = 0;   // 0..1, fades the screen in once the video is ready

  // ---------- update: called every frame with the film's progress ----------
  // near: 0 when far away, 1 when we've arrived at this camp.
  // preload: true once we're far enough up the trail to start fetching the video quietly.
  function update(dt, camera, near, preload) {
    if (preload || near > 0.01) loadVideo();
    // Only play when close: decoding video costs power.
    if (near > 0.25 && video.paused) video.play().catch(() => {});
    if (near < 0.15 && !video.paused) video.pause();
    // Fade the screen up from a dim fabric colour to the full video picture.
    const target = videoReady && near > 0.25 ? 1 : 0;
    screenOn += (target - screenOn) * (1 - Math.exp(-dt * 2));
    const level = 0.16 + screenOn * 0.72;   // never full white: it's night, keep it gentle
    screenMat.color.setRGB(level, level, level);
    if (!videoReady) screenMat.color.set('#2a2630');
    screenLight.intensity = screenOn * 7;

    // Float the HTML label: turn the 3D anchor into a screen position.
    if (label) {
      projected.copy(labelAnchor);
      group.localToWorld(projected);
      projected.project(camera);    // now x,y are -1..1 across the screen
      const inFront = projected.z < 1;
      const px = (projected.x * 0.5 + 0.5) * window.innerWidth;
      const py = (-projected.y * 0.5 + 0.5) * window.innerHeight;
      label.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(0, -100%)`;
      const show = inFront ? THREE.MathUtils.clamp((near - 0.55) / 0.35, 0, 1) : 0;
      // Never fully 0: keeping the label "barely there" means the browser has already drawn it,
      // so it fades in without a stutter.
      label.style.opacity = Math.max(show, 0.001).toFixed(3);
    }
  }

  return { group, update, screen, get videoElement() { return video; } };
}

// ---------- The dome tent ----------
function buildDomeTent() {
  const group = new THREE.Group();
  const width = 2.5, depth = 2.1, height = 1.25;

  // The dome: the top half of a sphere, stretched into a tent shape.
  const domeGeo = new THREE.SphereGeometry(1, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  domeGeo.scale(width / 2, height, depth / 2);

  const fabric = new THREE.MeshLambertMaterial({
    color: '#c9772f',
    emissive: '#ff8a2e',
    emissiveIntensity: 1,
  });
  // A small shader addition: the fabric glows as if lit from inside.
  // - brighter low down and towards the open door,
  // - darker lines where the poles cross over the dome.
  fabric.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTentPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTentPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTentPos;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        vec3 tp = vTentPos / vec3(${(width / 2).toFixed(3)}, ${height.toFixed(3)}, ${(depth / 2).toFixed(3)});
        // Light inside the tent shows through the fabric: strongest in the lower middle.
        float inner = 0.42 + 0.35 * (1.0 - tp.y);
        // The open door: a rounded "D" arch on the front (+z) side, like a zipped flap.
        float doorH = clamp(tp.y / 0.8, 0.0, 1.0);
        float doorWidth = 0.34 * sqrt(max(1.0 - doorH * doorH, 0.0));
        float door = step(0.25, tp.z) * (1.0 - smoothstep(doorWidth - 0.04, doorWidth, abs(tp.x)));
        // Pole seams: two crossing arcs seen from above form an X.
        float seamA = 1.0 - smoothstep(0.0, 0.05, abs(tp.x - tp.z));
        float seamB = 1.0 - smoothstep(0.0, 0.05, abs(tp.x + tp.z));
        float seams = max(seamA, seamB) * (1.0 - door);
        totalEmissiveRadiance *= inner * (1.0 - seams * 0.65);
        // Inside is brightest low in the middle, where the sleeping bags catch the lamp.
        vec3 insideCol = mix(vec3(1.0, 0.8, 0.48), vec3(0.95, 0.55, 0.25), smoothstep(0.0, 0.8, tp.y));
        totalEmissiveRadiance = mix(totalEmissiveRadiance, insideCol, door * 0.9);
        // The bottom edge of the tent is a little darker (it touches the ground).
        totalEmissiveRadiance *= mix(0.55, 1.0, smoothstep(0.0, 0.12, tp.y));`
      );
  };
  const dome = new THREE.Mesh(domeGeo, fabric);
  group.add(dome);

  // A flat dark groundsheet just under the tent, so it doesn't look like it floats.
  const sheet = new THREE.Mesh(
    new THREE.CircleGeometry(1, 32),
    new THREE.MeshLambertMaterial({ color: '#3b3330' })
  );
  sheet.rotation.x = -Math.PI / 2;
  sheet.scale.set(width / 2 + 0.15, depth / 2 + 0.15, 1);
  sheet.position.y = 0.02;
  group.add(sheet);

  return group;
}

// ---------- The lantern: a small metal base, glowing glass, a cap and a handle ----------
function buildLantern() {
  const group = new THREE.Group();
  const metal = new THREE.MeshLambertMaterial({ color: '#3a3a40' });
  const glass = new THREE.MeshBasicMaterial({ color: '#ffd59a' }); // "Basic" ignores lights: it IS the light

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.06, 12), metal);
  base.position.y = 0.03;
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.19, 12), glass);
  glow.position.y = 0.155;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.08, 12), metal);
  cap.position.y = 0.29;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 16, Math.PI), metal);
  handle.position.y = 0.33;
  group.add(base, glow, cap, handle);
  return group;
}

// ---------- A lumpy rock: a 12-sided shape with its corners pushed in and out ----------
function buildRockGeometry(rand) {
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const pos = geo.attributes.position;
  // Corners are duplicated per face; move identical corners the same way so there are no gaps.
  const offsets = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!offsets.has(key)) offsets.set(key, 0.75 + rand() * 0.45);
    const k = offsets.get(key);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return geo;
}

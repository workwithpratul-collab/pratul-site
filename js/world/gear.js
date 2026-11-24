// gear.js: the gear check on the meadow. Six pieces of trekking kit laid out flat on a canvas
// mat (a top-down "flat-lay", like a photo of kit before a climb). Each one stands for a skill
// (content/site-copy.md, "Gear check"):
//   camera → cinematic scroll films      lantern → 3D and lighting effects
//   compass → design that guides         map → SEO
//   rope → forms, booking and WhatsApp   watch → fast loading
//
// Every item is one of Pratul's painted images (assets/gear) on a flat card lying on the mat.
// Under each one sits a soft shadow made from the item's own outline, blurred, in a cool colour
// (never black). On hover an item lifts a little: it grows slightly, its shadow spreads further
// away, and it glows softly in its own colours.
//
// The images are only needed at the meadow, so they load later (prepare()), not at base camp.

import * as THREE from 'three';
import { groundHeight } from './terrain.js';
import { makeHalo } from './camp.js';
import { MATERIALS } from './palette.js';

const G = MATERIALS.gear;
const FOLDER = 'assets/gear/';
const EXT = '.webp';   // (the full-size PNG paintings are kept in assets/originals/gear)

// The mat: 1.9 m by 0.95 m (the same 2:1 shape as its painting).
const MAT = { length: 1.9, width: 0.95 };
// Each item: where it lies on the mat (x along, z across; -z is the far side, away from the
// camera), how big its painting is (metres, edge to edge) and how it's turned. A flat-lay is a
// little loose, so the items are turned slightly and some overhang the mat's edge.
const LAYOUT = {
  camera:  { x: -0.6, z: -0.17, size: 0.5, turn: 0.1 },
  map:     { x: 0.0, z: -0.16, size: 0.48, turn: -0.06 },
  lantern: { x: 0.6, z: -0.16, size: 0.46, turn: -0.12 },
  compass: { x: -0.6, z: 0.2, size: 0.4, turn: 0.08 },
  rope:    { x: 0.0, z: 0.21, size: 0.46, turn: 0.15 },
  watch:   { x: 0.6, z: 0.2, size: 0.42, turn: -0.2 },
};

// position: [x, z] on the map. facing: which way the mat's long side runs (radians).
export function createGear(scene, { position, facing, renderer }) {
  const [px, pz] = position;
  const group = new THREE.Group();
  group.name = 'gear-check';
  group.position.set(px, groundHeight(px, pz), pz);
  group.rotation.y = facing;
  scene.add(group);
  const anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;

  // A flat card lying on the ground, with the image's top pointing to the mat's far side.
  const card = (w, h) => new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2);
  // Until the paintings arrive, every material holds a 1-pixel stand-in texture and is fully
  // transparent. That way their shaders are already the final ones (built behind the loading
  // screen with everything else), and swapping in the real paintings later costs no stutter.
  const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  blank.colorSpace = THREE.SRGBColorSpace;   // (the same as the paintings, so the shader is identical)
  blank.needsUpdate = true;

  // The mat. (Everything here is drawn in a fixed order, bottom layer first, so the thin flat
  // layers never flicker against each other.)
  const matMaterial = new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false, map: blank, opacity: 0 });
  const mat = new THREE.Mesh(card(MAT.length, MAT.width), matMaterial);
  mat.position.y = 0.01;
  mat.renderOrder = 1;
  group.add(mat);

  const items = {};
  for (const [id, spot] of Object.entries(LAYOUT)) {
    const holder = new THREE.Group();
    holder.position.set(spot.x, 0, spot.z);
    holder.rotation.y = spot.turn;
    group.add(holder);
    // The shadow: the item's own shape, blurred, a little offset (as if the light is behind us).
    const shadowMaterial = new THREE.MeshBasicMaterial({ color: G.shadow, transparent: true, opacity: 0, depthWrite: false, map: blank, fog: true });
    const shadow = new THREE.Mesh(card(spot.size * 1.08, spot.size * 1.08), shadowMaterial);
    shadow.position.y = 0.012;
    shadow.renderOrder = 2;
    // The painted item. Lambert so the meadow's morning light falls on it like everything else;
    // the emissive glow (its own colours, brightened) is the hover glow.
    const material = new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false, map: blank, emissive: 0xffffff, emissiveMap: blank, emissiveIntensity: 0, opacity: 0 });
    const object = new THREE.Mesh(card(spot.size, spot.size), material);
    object.position.y = 0.016;
    object.renderOrder = 3;
    holder.add(shadow, object);
    items[id] = { holder, object, shadow, material, shadowMaterial, size: spot.size, glow: 0, target: 0 };
  }
  group.updateMatrixWorld(true);

  // Each item's centre in the world, and how big it is (gear-ui.js lays a target over each one).
  const centres = {}, radii = {}, near = {};
  for (const [id, item] of Object.entries(items)) {
    centres[id] = item.holder.localToWorld(new THREE.Vector3(0, 0.03, 0));
    radii[id] = item.size * 0.36;
    near[id] = LAYOUT[id].z > 0;   // the row nearer the camera (its label opens below it)
  }

  // The lantern is lit, like every lantern in the film: a warm halo over its glass, which
  // brightens on hover. (It's the one warm light in the flat-lay.)
  const halo = makeHalo(MATERIALS.lights.lanternHalo, 0.7, 0);
  halo.position.copy(items.lantern.holder.localToWorld(new THREE.Vector3(0.0, 0.08, -0.01)));
  scene.add(halo);

  // ---------- Loading the paintings (only when we're on the way to the meadow) ----------
  // The images are decoded off the main thread (image bitmaps, where the browser supports them),
  // then handed to the graphics card one per frame, so loading never interrupts the film.
  let started = false, loaded = false;
  const ua = navigator.userAgent;
  const useBitmaps = typeof createImageBitmap !== 'undefined' && !/^((?!chrome|android).)*safari/i.test(ua)
    && !(/firefox\/(\d+)/i.test(ua) && Number(ua.match(/firefox\/(\d+)/i)[1]) < 98);
  const loader = useBitmaps
    ? new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' })
    : new THREE.TextureLoader();
  const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
  function loadPainting(name) {
    return new Promise((resolve) => loader.load(FOLDER + name + EXT, (result) => {
      const tex = useBitmaps ? new THREE.Texture(result) : result;
      if (useBitmaps) tex.flipY = false;   // (the bitmap was already flipped while decoding)
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = anisotropy;          // keeps them crisp seen at a slant
      tex.needsUpdate = true;
      resolve(tex);
    }, undefined, () => resolve(null)));
  }
  async function prepare() {
    if (started) return;
    started = true;
    const names = ['mat', ...Object.keys(items)];
    const textures = await Promise.all(names.map(loadPainting));
    for (let i = 0; i < names.length; i++) {
      const tex = textures[i];
      if (!tex) continue;
      if (renderer) renderer.initTexture(tex);   // upload now, one painting per frame
      if (names[i] === 'mat') {
        matMaterial.map = tex;
        matMaterial.opacity = 1;
      } else {
        const item = items[names[i]];
        item.material.map = item.material.emissiveMap = tex;
        item.material.opacity = 1;
        item.shadowMaterial.map = shadowFrom(tex.image, tex.flipY);
        if (renderer) renderer.initTexture(item.shadowMaterial.map);
      }
      await nextFrame();
    }
    loaded = true;
  }

  function setGlow(id, on) {
    if (items[id]) items[id].target = on ? 1 : 0;
  }
  function update(dt, time) {
    if (!loaded) return;
    const k = 1 - Math.exp(-dt * 5);   // eases out over about half a second
    for (const [id, item] of Object.entries(items)) {
      item.glow += (item.target - item.glow) * k;
      const g = item.glow;
      // Lift: a touch bigger and higher, the shadow spreads and slides further away.
      item.object.scale.setScalar(1 + g * 0.07);
      item.object.position.y = 0.016 + g * 0.03;
      item.shadow.scale.setScalar(1 + g * 0.1);
      item.shadow.position.set(0.012 + g * 0.03, 0.012, 0.016 + g * 0.04);
      item.shadowMaterial.opacity = 0.5 - g * 0.12;
      // Glow: the painting brightens softly in its own colours.
      item.material.emissiveIntensity = (id === 'lantern' ? 0.12 : 0) + g * 0.28;
      if (id === 'lantern') halo.material.opacity = (0.22 + g * 0.25) * (1 + Math.sin(time * 7.3) * 0.03);
    }
  }
  return { group, centres, radii, near, setGlow, update, prepare };
}

// A soft shadow shape from a painting: its outline as a white silhouette, blurred. Used as the
// shadow's texture, so the shadow takes its colour from the palette and its softness from here.
// The blur is free: the outline is drawn tiny (24 px) and smoothly scaled back up, which softens
// every edge. (No blur filter and no pixel-by-pixel work: it takes well under a millisecond.)
function shadowFrom(image, flipY = true) {
  const tiny = document.createElement('canvas');
  tiny.width = tiny.height = 24;
  const t = tiny.getContext('2d');
  t.drawImage(image, 1, 1, 22, 22);              // a 1-pixel margin, so the blur fades out inside
  t.globalCompositeOperation = 'source-in';       // keep the shape, paint it white
  t.fillStyle = '#fff';
  t.fillRect(0, 0, 24, 24);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tiny, 0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = flipY;   // the same way up as the painting it came from
  return tex;
}

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

  // The mat. (Everything here is drawn in a fixed order, bottom layer first, so the thin flat
  // layers never flicker against each other.)
  const matMaterial = new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false, visible: false });
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
    const shadowMaterial = new THREE.MeshBasicMaterial({ color: G.shadow, transparent: true, opacity: 0.5, depthWrite: false, visible: false, fog: true });
    const shadow = new THREE.Mesh(card(spot.size * 1.08, spot.size * 1.08), shadowMaterial);
    shadow.position.y = 0.012;
    shadow.renderOrder = 2;
    // The painted item. Lambert so the meadow's morning light falls on it like everything else;
    // the emissive glow (its own colours, brightened) is the hover glow.
    const material = new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false, visible: false, emissive: 0xffffff, emissiveIntensity: 0 });
    const object = new THREE.Mesh(card(spot.size, spot.size), material);
    object.position.y = 0.016;
    object.renderOrder = 3;
    holder.add(shadow, object);
    items[id] = { holder, object, shadow, material, shadowMaterial, size: spot.size, glow: 0, target: 0 };
  }
  group.updateMatrixWorld(true);

  // Each item's centre in the world, and how big it is (gear-ui.js lays a link over each one).
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
  let started = false, loaded = false;
  function prepare() {
    if (started) return;
    started = true;
    const loader = new THREE.TextureLoader();
    const load = (name) => new Promise((resolve) => loader.load(FOLDER + name + EXT, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = anisotropy;   // keeps them crisp seen at a slant
      resolve(t);
    }, undefined, () => resolve(null)));
    Promise.all(['mat', ...Object.keys(items)].map(async (name) => [name, await load(name)])).then((list) => {
      for (const [name, tex] of list) {
        if (!tex) continue;
        if (name === 'mat') {
          matMaterial.map = tex;
          matMaterial.visible = true;
          matMaterial.needsUpdate = true;
          continue;
        }
        const item = items[name];
        item.material.map = tex;
        item.material.emissiveMap = tex;
        item.material.visible = true;
        item.material.needsUpdate = true;
        item.shadowMaterial.alphaMap = shadowFrom(tex.image);
        item.shadowMaterial.visible = true;
        item.shadowMaterial.needsUpdate = true;
      }
      loaded = true;
    });
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

// A soft shadow shape from a painting: its outline (alpha), blurred, on a small canvas.
// Only the alpha is used, so the shadow takes its colour from the palette.
function shadowFrom(image) {
  const size = 256, pad = 14;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.filter = 'blur(9px)';
  // Drawn slightly smaller than the card, so the blur fades out before the card's edge.
  ctx.drawImage(image, pad, pad, size - pad * 2, size - pad * 2);
  // alphaMap reads the green channel: turn the blurred alpha into white-on-black.
  const data = ctx.getImageData(0, 0, size, size);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3];
    px[i] = px[i + 1] = px[i + 2] = a;
    px[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

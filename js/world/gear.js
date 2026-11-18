// gear.js: the gear check on the meadow. Six pieces of trekking kit laid out on a canvas mat,
// each one standing for a skill (content/site-copy.md, "Gear check"):
//   camera → cinematic scroll films      lantern → 3D and lighting effects
//   compass → design that guides         map → SEO
//   rope → forms, booking and WhatsApp   watch → fast loading
//
// Everything is built from simple soft shapes in palette colours (no textures except the map's
// hand-drawn contours), lit by the same morning light as the meadow. On hover, an item "glows"
// gently: its colours lift towards a pale warm light (setGlow), never a hard outline.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { groundHeight, seededRandom } from './terrain.js';
import { buildLantern, makeHalo } from './camp.js';
import { MATERIALS } from './palette.js';

const G = MATERIALS.gear;
const GLOW = new THREE.Color(MATERIALS.lights.lanternGlass);   // the soft light an item glows with

// The mat: 1.7 m long, 1.05 m wide. Item spots are in mat coordinates (x along, z across).
const MAT = { length: 1.7, width: 1.05 };
const LAYOUT = {
  camera: { x: -0.5, z: -0.22, turn: 0.18 },
  map: { x: 0.02, z: -0.2, turn: -0.08 },
  lantern: { x: 0.52, z: -0.22, turn: 0 },
  compass: { x: -0.5, z: 0.24, turn: 0 },
  rope: { x: 0.02, z: 0.24, turn: 0.4 },
  watch: { x: 0.52, z: 0.25, turn: -0.3 },
};

// position: [x, z] on the map. facing: which way the mat's long side runs (radians).
export function createGear(scene, { position, facing }) {
  const [px, pz] = position;
  const group = new THREE.Group();
  group.name = 'gear-check';
  group.position.set(px, groundHeight(px, pz), pz);
  group.rotation.y = facing;
  scene.add(group);

  group.add(buildMat());

  const items = {};
  const builders = { camera: buildCamera, map: buildMap, lantern: buildLanternItem, compass: buildCompass, rope: buildRope, watch: buildWatch };
  for (const [id, spot] of Object.entries(LAYOUT)) {
    const { object, materials, height } = builders[id]();
    object.position.set(spot.x, 0.012, spot.z);
    object.rotation.y = spot.turn;
    group.add(object);
    items[id] = { object, materials, height, glow: 0, target: 0 };
  }
  group.updateMatrixWorld(true);

  // Each item's centre in the world (gear-ui.js projects these onto the screen).
  const centres = {};
  for (const [id, item] of Object.entries(items)) {
    centres[id] = item.object.localToWorld(new THREE.Vector3(0, item.height * 0.5, 0));
  }

  // The lantern's warm halo (it's lit, like every lantern in the film; it brightens on hover).
  const halo = makeHalo(MATERIALS.lights.lanternHalo, 0.9, 0.35);
  halo.position.copy(items.lantern.object.localToWorld(new THREE.Vector3(0, 0.16, 0)));
  scene.add(halo);

  // Remember each material's own colour, so the glow can lift it and return exactly.
  for (const item of Object.values(items)) {
    for (const m of item.materials) m.userData.base = m.color.clone();
  }

  function setGlow(id, on) {
    if (items[id]) items[id].target = on ? 1 : 0;
  }
  function update(dt, time) {
    for (const [id, item] of Object.entries(items)) {
      item.glow += (item.target - item.glow) * (1 - Math.exp(-dt * 6));
      for (const m of item.materials) m.color.copy(m.userData.base).lerp(GLOW, item.glow * 0.32);
      // A gentle lift, as if the item is being picked up for a look.
      item.object.position.y = 0.012 + item.glow * 0.02;
      if (id === 'lantern') halo.material.opacity = (0.35 + item.glow * 0.25) * (1 + Math.sin(time * 7.3) * 0.03);
    }
  }
  return { group, centres, setGlow, update };
}

// ---------- Small helpers ----------
const lambert = (color) => new THREE.MeshLambertMaterial({ color });
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

// The canvas mat: a thin slab with a darker stitched border, draped slightly over the grass.
function buildMat() {
  const group = new THREE.Group();
  const top = new THREE.Mesh(new RoundedBoxGeometry(MAT.length, 0.012, MAT.width, 2, 0.006), lambert(G.canvas));
  top.position.y = 0.006;
  const edge = new THREE.Mesh(new RoundedBoxGeometry(MAT.length + 0.05, 0.008, MAT.width + 0.05, 2, 0.004), lambert(G.canvasEdge));
  edge.position.y = 0.002;
  group.add(edge, top);
  return group;
}

// Camera: a rounded body, a grip, a lens and a little viewfinder bump.
function buildCamera() {
  const body = lambert(G.body), trim = lambert(G.trim), glass = lambert(G.glass);
  const o = new THREE.Group();
  o.add(mesh(new RoundedBoxGeometry(0.2, 0.12, 0.075, 3, 0.018), body, 0, 0.06, 0));
  o.add(mesh(new RoundedBoxGeometry(0.05, 0.11, 0.085, 3, 0.016), trim, -0.08, 0.057, 0.004));
  o.add(mesh(new THREE.CylinderGeometry(0.042, 0.046, 0.05, 24).rotateX(Math.PI / 2), trim, 0.02, 0.06, 0.06));
  o.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 24).rotateX(Math.PI / 2), glass, 0.02, 0.06, 0.087));
  o.add(mesh(new RoundedBoxGeometry(0.06, 0.03, 0.05, 2, 0.01), body, 0.02, 0.13, -0.005));
  // Lying on its back, lens to the sky, as kit is laid out for a check.
  o.rotation.x = -Math.PI / 2;
  const holder = new THREE.Group();
  o.position.y = 0.0375;
  holder.add(o);
  return { object: holder, materials: [body, trim, glass], height: 0.1 };
}

// Lantern: the same lantern as the camps, its glass glowing.
function buildLanternItem() {
  const lantern = buildLantern();
  lantern.scale.setScalar(1.25);
  const materials = [];
  lantern.traverse((m) => { if (m.isMesh && m.material.isMeshLambertMaterial && !materials.includes(m.material)) materials.push(m.material); });
  return { object: lantern, materials, height: 0.4 };
}

// Compass: a round steel case with a pale face, a needle and a lanyard ring.
function buildCompass() {
  const steel = lambert(G.steel), face = lambert(G.face), needle = lambert(G.needle);
  const o = new THREE.Group();
  o.add(mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.024, 32), steel, 0, 0.012, 0));
  o.add(mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.004, 32), face, 0, 0.025, 0));
  const n = mesh(new THREE.ConeGeometry(0.012, 0.11, 4).rotateZ(Math.PI / 2).scale(1, 0.25, 1), needle, 0, 0.029, 0);
  n.rotation.y = 0.6;
  o.add(n);
  o.add(mesh(new THREE.TorusGeometry(0.018, 0.004, 8, 20).rotateX(Math.PI / 2), steel, 0, 0.012, -0.092));
  return { object: o, materials: [steel, face, needle], height: 0.03 };
}

// Map: a folded paper map with soft contour lines and a marked route (drawn once on a canvas).
function buildMap() {
  const W = 0.38, D = 0.27;
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 364;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = G.paper;
  ctx.fillRect(0, 0, 512, 364);
  // Contour lines: wobbly rings around two hills.
  const rand = seededRandom(7);
  ctx.strokeStyle = G.ink;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  for (const [cx, cy, rings] of [[180, 170, 6], [380, 120, 4]]) {
    for (let r = 1; r <= rings; r++) {
      ctx.beginPath();
      for (let a = 0; a <= 64; a++) {
        const t = (a / 64) * Math.PI * 2;
        const rr = r * 22 * (1 + 0.15 * Math.sin(t * 3 + r) + (rand() - 0.5) * 0.03);
        const x = cx + Math.cos(t) * rr * 1.3, y = cy + Math.sin(t) * rr;
        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  // The route, dashed, up to a little summit mark.
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = G.route;
  ctx.lineWidth = 4;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(40, 330); ctx.bezierCurveTo(120, 280, 140, 220, 180, 170); ctx.bezierCurveTo(240, 110, 320, 150, 380, 120);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // The paper, gently folded into three panels (a zigzag across its width).
  const geo = new THREE.PlaneGeometry(W, D, 6, 1).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / W + 0.5;
    pos.setY(i, 0.004 + Math.abs(Math.sin(u * Math.PI * 1.5)) * 0.012);
  }
  geo.computeVertexNormals();
  const paper = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });   // (white: the map's own colours show)
  const o = new THREE.Group();
  o.add(new THREE.Mesh(geo, paper));
  return { object: o, materials: [paper], height: 0.02 };
}

// Rope: a neat flat coil (a tube following a spiral), with a loose end.
function buildRope() {
  const points = [];
  const turns = 3.6;
  for (let i = 0; i <= 220; i++) {
    const t = i / 220;
    const a = t * turns * Math.PI * 2;
    const r = 0.13 - t * 0.075;
    points.push(new THREE.Vector3(Math.cos(a) * r, 0.014 + Math.sin(a * 3) * 0.002, Math.sin(a) * r));
  }
  // The loose end trails out across the mat.
  const last = points[points.length - 1];
  points.unshift(new THREE.Vector3(0.24, 0.012, -0.05), new THREE.Vector3(0.18, 0.013, -0.02));
  points.push(last.clone());
  const rope = lambert(G.rope);
  const o = new THREE.Group();
  o.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 400, 0.012, 8, false), rope));
  return { object: o, materials: [rope], height: 0.03 };
}

// Watch: a round face with two hands, on a soft strap laid out flat.
function buildWatch() {
  const strap = lambert(G.body), steel = lambert(G.steel), face = lambert(G.face), hands = lambert(G.needle);
  const o = new THREE.Group();
  o.add(mesh(new RoundedBoxGeometry(0.03, 0.008, 0.24, 2, 0.004), strap, 0, 0.004, 0));
  o.add(mesh(new THREE.CylinderGeometry(0.036, 0.038, 0.016, 32), steel, 0, 0.012, 0));
  o.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.004, 32), face, 0, 0.021, 0));
  const hour = mesh(new THREE.BoxGeometry(0.003, 0.002, 0.018), hands, 0.004, 0.024, -0.006);
  hour.rotation.y = 0.7;
  const minute = mesh(new THREE.BoxGeometry(0.002, 0.002, 0.026), hands, -0.006, 0.024, -0.008);
  minute.rotation.y = -0.9;
  o.add(hour, minute);
  return { object: o, materials: [strap, steel, face, hands], height: 0.025 };
}

// lanterns.js: "lanterns at the summit", the tools carousel (desktop only). DESIGN.md §6.
//
// Seven tool logos glow as paper lanterns on a slow, tilted orbit, like lanterns carried round a
// summit at night. Every logo always faces you (sprites: flat pictures that turn to the camera, so
// they're never seen from behind or mirrored) and they're spaced evenly. The lantern at the front
// is the largest and brightest, with a soft glow; the ones behind are smaller and dimmer.
// It pauses while hovered or focused. The names are a real HTML list for screen readers.
//
// Cheap by design: 7 small textures and 14 sprites (logo + glow), drawn by the shared renderer
// only while the section is on screen. The glow is a sprite, not post-processing.

import * as THREE from 'three';
import { renderer, addView, glowBlending } from '../gl.js';
import { MATERIALS } from '../world/palette.js';

const C = MATERIALS.lanterns;
const RADIUS = 3.4;
const TILT = 0.34;        // the orbit leans towards us, so the back of it shows above the front
const SPEED = 0.16;       // radians a second: a slow walk round the summit

export async function createLanterns({ root, core }) {
  const { reduceMotion } = core;
  const stageEl = root.querySelector('.lanterns__stage');
  const frontLabel = root.querySelector('[data-front]');
  const items = [...root.querySelectorAll('.lanterns__list li')].map((li) => ({
    name: li.querySelector('span').textContent,
    src: li.querySelector('img').getAttribute('src'),
  }));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 2, 0.1, 50);
  camera.position.set(0, 1.1, 11);
  camera.lookAt(0, 0.1, 0);

  // The orbit's path: a faint ring, so the lanterns read as travelling round something.
  const ring = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(Array.from({ length: 96 }, (_, i) => {
      const a = (i / 96) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * RADIUS, -0.55, Math.sin(a) * RADIUS);
    })),
    new THREE.LineBasicMaterial({ color: C.orbit, transparent: true, opacity: 0.45 }),
  );
  const orbit = new THREE.Group();
  orbit.rotation.x = TILT;
  orbit.add(ring);
  scene.add(orbit);

  // One lantern per tool: a glow (behind) and the lantern itself (paper disc + logo).
  const glowMap = glowTexture();
  const lanterns = await Promise.all(items.map(async (item) => {
    const map = await lanternTexture(item.src);
    const lantern = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }));
    const glow = new THREE.Sprite(glowBlending(new THREE.SpriteMaterial({ map: glowMap, color: C.glow, transparent: true, depthWrite: false })));
    scene.add(glow, lantern);
    return { ...item, lantern, glow };
  }));

  // Pause while hovered or focused; carry on afterwards.
  let paused = false;
  root.addEventListener('pointerenter', () => { paused = true; });
  root.addEventListener('pointerleave', () => { paused = false; });
  root.addEventListener('focusin', () => { paused = true; });
  root.addEventListener('focusout', () => { paused = false; });

  let angle = 0, speed = reduceMotion ? 0 : SPEED, front = '';
  const p = new THREE.Vector3();
  const n = lanterns.length;
  function frame(dt, time, rect) {
    // Ease in and out of the pause, rather than stopping dead.
    const want = paused || reduceMotion ? 0 : SPEED;
    speed += (want - speed) * (1 - Math.exp(-dt * 3));
    angle += speed * dt;
    const aspect = rect.width / rect.height;
    if (Math.abs(camera.aspect - aspect) > 1e-4) { camera.aspect = aspect; camera.updateProjectionMatrix(); }
    let best = -Infinity, bestName = '';
    lanterns.forEach((l, i) => {
      const a = angle + (i / n) * Math.PI * 2;
      // Place on the circle, then tilt the circle (the same tilt as the ring).
      p.set(Math.sin(a) * RADIUS, 0, Math.cos(a) * RADIUS).applyAxisAngle(new THREE.Vector3(1, 0, 0), TILT);
      // depth: 1 at the very front, 0 at the back.
      const depth = (Math.cos(a) + 1) / 2;
      const size = 0.82 + 0.5 * depth * depth;
      // A gentle bob, each lantern in its own rhythm (paper lanterns are never perfectly still).
      const bob = reduceMotion ? 0 : Math.sin(time * 0.8 + i * 1.7) * 0.06;
      l.lantern.position.set(p.x, p.y + bob, p.z);
      l.lantern.scale.setScalar(size);
      l.lantern.material.opacity = 0.62 + 0.38 * depth;
      l.glow.position.set(p.x, p.y + bob, p.z - 0.05);
      l.glow.scale.setScalar(size * (2.4 + 0.5 * depth));
      l.glow.material.opacity = 0.12 + 0.55 * Math.pow(depth, 3);
      l.lantern.renderOrder = l.glow.renderOrder = Math.round(depth * 100);
      if (depth > best) { best = depth; bestName = l.name; }
    });
    if (bestName !== front) { front = bestName; frontLabel.textContent = front; }
    renderer.render(scene, camera);
  }
  root.classList.add('is-3d');
  addView({ el: stageEl, frame, name: 'lanterns' });
}

// ---------- Textures ----------

// A paper lantern: a warm cream disc, brighter in the middle (lit from inside), with the tool's
// logo on it. The cream behind every logo keeps dark marks (Next.js) and light ones equally clear.
async function lanternTexture(src) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2 - 10, 10, S / 2, S / 2, S / 2 - 8);
  grad.addColorStop(0, '#fff8ee');
  grad.addColorStop(0.7, C.paper);
  grad.addColorStop(1, C.paperEdge);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(S / 2, S / 2, S / 2 - 8, 0, Math.PI * 2);
  g.fill();
  // The logo, whole and upright, fitted into the middle of the disc.
  const box = S * 0.48;
  const ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1);
  const w = ratio >= 1 ? box : box * ratio, h = ratio >= 1 ? box / ratio : box;
  g.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

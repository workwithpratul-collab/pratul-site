// lantern.js: the "Interactive experiences" demo. The trekking lantern from the camps, in a small
// 3D view of its own. Drag (or use the arrow keys) to spin it; let go and it slows gently.
// It only draws while its card is on screen.

import * as THREE from 'three';
import { buildLantern, makeHalo } from '../world/camp.js';
import { PRESETS, MATERIALS } from '../world/palette.js';

export function initLantern(el) {
  const canvas = el.querySelector('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 10);
  camera.position.set(0, 0.32, 1.25);
  camera.lookAt(0, 0.2, 0);

  // Lit like base camp: cool moonlight and sky, and the lantern's own warm glow.
  const night = PRESETS.night;
  scene.add(new THREE.HemisphereLight(night.ambient.sky, night.ambient.ground, 2.4));
  const moon = new THREE.DirectionalLight(night.key.color, 1.6);
  moon.position.set(-1, 1.2, 1);
  scene.add(moon);
  const glow = new THREE.PointLight(MATERIALS.lights.lanternLight, 0.9, 2, 2);
  glow.position.set(0, 0.2, 0);
  scene.add(glow);

  const lantern = buildLantern();
  lantern.scale.setScalar(1.15);
  const pivot = new THREE.Group();
  pivot.add(lantern);
  scene.add(pivot);
  const halo = makeHalo(MATERIALS.lights.lanternHalo, 0.7, 0.4);
  halo.position.set(0, 0.2, 0);
  scene.add(halo);

  function size() {
    const r = canvas.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / Math.max(r.height, 1);
    camera.updateProjectionMatrix();
  }
  size();
  new ResizeObserver(size).observe(canvas);

  // ---------- Spinning: drag, momentum, keyboard ----------
  let angle = 0.6, tilt = 0, velocity = 0.25, dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    el.classList.add('is-used');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    velocity = dx * 0.012 / (1 / 60);
    angle += dx * 0.012;
    tilt = Math.max(-0.5, Math.min(0.5, tilt + dy * 0.006));
  });
  const stop = () => { dragging = false; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') velocity -= 1.5;
    else if (e.key === 'ArrowRight') velocity += 1.5;
    else return;
    e.preventDefault();
    el.classList.add('is-used');
  });

  // ---------- Draw only while on screen ----------
  let visible = false, last = performance.now();
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) { last = performance.now(); requestAnimationFrame(frame); }
  }).observe(el);
  function frame(now) {
    if (!visible) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!dragging) {
      angle += velocity * dt;
      // Momentum fades out slowly towards a gentle idle turn.
      velocity += (0.25 - velocity) * (1 - Math.exp(-dt * 1.4));
      tilt *= Math.exp(-dt * 2);
    }
    pivot.rotation.set(tilt, angle, 0);
    const flicker = 1 + Math.sin(now * 0.0073) * 0.03 + Math.sin(now * 0.0131) * 0.02;
    glow.intensity = 0.9 * flicker;
    halo.material.opacity = 0.4 * flicker;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
}

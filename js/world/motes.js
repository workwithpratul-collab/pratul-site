// motes.js: the summit hero's ambience (DESIGN.md §6). A few hundred tiny motes of light drift
// slowly through the air in front of the camera, like dust and ice crystals catching the sunrise.
//
// It's built to cost almost nothing: ONE draw call (all motes are points in a single geometry),
// and every bit of movement is worked out on the graphics chip from the time (a vertex shader),
// so the main thread does no per-mote work at all. The motes live in the camera's own space, so
// they always fill the view, wherever the camera is.
//
// They stay faint on the left of the screen, where the hero's words sit, so text contrast never
// drops; most of the warm ones float on the right, near the sun.

import * as THREE from 'three';
import { MATERIALS } from './palette.js';

const COUNT = 220;

export function createMotes(scene) {
  const pos = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT * 4);   // speed, phase, size, warmth
  let r = 7;
  const rand = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  for (let i = 0; i < COUNT; i++) {
    // A box in front of the camera: 4 to 34 m away, wider than the view.
    const z = -4 - rand() * 30;
    pos.set([(rand() - 0.5) * -z * 1.6, (rand() - 0.35) * -z * 0.8, z], i * 3);
    seed.set([0.4 + rand() * 0.8, rand() * 6.283, 0.6 + rand() * 1.2, rand() < 0.22 ? 1 : 0], i * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -20), 60);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uShow: { value: 0 },
      uPixelRatio: { value: 1 },
      uCool: { value: new THREE.Color(MATERIALS.motes.cool) },
      uWarm: { value: new THREE.Color(MATERIALS.motes.warm) },
    },
    vertexShader: /* glsl */`
      attribute vec4 seed;
      uniform float uTime, uPixelRatio;
      varying float vWarm, vFade;
      void main() {
        float t = uTime * 0.05 * seed.x;
        vec3 p = position;
        // A slow wandering drift, mostly sideways (the morning breeze) and gently rising.
        p.x += sin(t * 2.0 + seed.y) * 1.6 + t * 3.0 * seed.x;
        p.y += sin(t * 1.3 + seed.y * 1.7) * 0.8 + fract(t * 0.15 + seed.y) * 3.0;
        p.x = mod(p.x + 30.0, 60.0) - 30.0;   // wrap round, so the drift never runs out
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = seed.z * 26.0 * uPixelRatio / -mv.z;
        vWarm = seed.w;
        // Screen x from -1 (left) to 1 (right): faint on the left, where the words are.
        float sx = gl_Position.x / gl_Position.w;
        vFade = mix(0.22, 1.0, smoothstep(-0.25, 0.35, sx)) * (0.55 + 0.45 * sin(uTime * 0.6 + seed.y * 3.0));
      }`,
    fragmentShader: /* glsl */`
      uniform float uShow;
      uniform vec3 uCool, uWarm;
      varying float vWarm, vFade;
      void main() {
        // A soft round dot: bright in the middle, fading to nothing at the edge (no hard rim).
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = (1.0 - smoothstep(0.0, 1.0, d)) * vFade * uShow * 0.55;
        if (a < 0.01) discard;
        gl_FragColor = vec4(mix(uCool, uWarm, vWarm), a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, material);
  points.name = 'motes';
  points.frustumCulled = false;
  points.renderOrder = 10;
  points.visible = false;
  scene.add(points);

  // show: 0..1 (only near the summit). The motes ride with the camera.
  function update(time, show, camera) {
    points.visible = show > 0.001;
    if (!points.visible) return;
    material.uniforms.uTime.value = time;
    material.uniforms.uShow.value = show;
    material.uniforms.uPixelRatio.value = window.devicePixelRatio > 1.75 ? 1.75 : window.devicePixelRatio;
    points.position.copy(camera.position);
    points.quaternion.copy(camera.quaternion);
  }
  return { update };
}

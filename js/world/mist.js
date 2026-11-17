// mist.js: soft, painterly mist that drifts slowly sideways.
// Three layers, all using ONE shader:
//  A. low forest mist: strips that hug the ground between the trees along the climb
//  B. valley mist: a flat sheet filling the valley beyond the ridge (you look down on it)
//  C. distant band: a ring of mist resting between the far mountain ranges

import * as THREE from 'three';
import { NOISE_GLSL } from './glsl.js';
import { groundHeight } from './terrain.js';
import { mood } from './palette.js';

// Shared values every mist layer reads, so one update moves them all.
const shared = {
  uTime: { value: 0 },
  uColor: { value: mood.mist.air },   // the palette's live mist colour: follows the time of day
};

function makeMistMaterial({ opacity, scale, speed, softness = [0.42, 0.68], nearFade = [6, 22], seed = 0 }) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,          // mist never hides things behind it from the depth test
    side: THREE.DoubleSide,
    uniforms: {
      uTime: shared.uTime,
      uColor: shared.uColor,
      uOpacity: { value: opacity },
      uScale: { value: new THREE.Vector2(scale[0], scale[1]) },
      uSpeed: { value: speed },
      uSoft: { value: new THREE.Vector2(softness[0], softness[1]) },
      uNear: { value: new THREE.Vector2(nearFade[0], nearFade[1]) },
      uSeed: { value: seed },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vDepth;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mv.z;            // distance in front of the camera
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime, uOpacity, uSpeed, uSeed;
      uniform vec2 uScale, uSoft, uNear;
      varying vec2 vUv;
      varying float vDepth;
      ${NOISE_GLSL}

      void main() {
        vec2 p = vUv * uScale + uSeed;
        // Two noise patterns drifting sideways at different speeds: the mist slowly changes shape.
        float a = fbm(p + vec2(uTime * uSpeed, 0.0));
        float b = fbm(p * 0.55 + vec2(-uTime * uSpeed * 0.6, 4.7));
        float n = a * 0.6 + b * 0.4;
        // A fairly tight threshold gives soft-but-defined shapes, like brush strokes, not smoke.
        float alpha = smoothstep(uSoft.x, uSoft.y, n);
        // Fade out at every edge of the sheet, so there are no hard lines.
        alpha *= smoothstep(0.0, 0.3, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
        alpha *= smoothstep(0.0, 0.12, vUv.x) * (1.0 - smoothstep(0.88, 1.0, vUv.x));
        // Fade out when the camera gets close, so we never "hit" a flat sheet.
        alpha *= smoothstep(uNear.x, uNear.y, vDepth);
        gl_FragColor = vec4(uColor, alpha * uOpacity);
        #include <colorspace_fragment>
      }
    `,
  });
}

export function createMist(scene) {
  const group = new THREE.Group();
  group.name = 'mist';

  // ---------- A. Low forest mist: strips that follow the ground ----------
  const strips = [
    { z: -30, width: 150, height: 9, x: -10 },
    { z: -68, width: 170, height: 10, x: 12 },
    { z: -104, width: 170, height: 11, x: -6 },
  ];
  strips.forEach((s, i) => {
    const geo = new THREE.PlaneGeometry(s.width, s.height, 60, 1);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k) + s.x;
      const localY = pos.getY(k) + s.height / 2;   // 0 at the bottom, height at the top
      pos.setXYZ(k, x, groundHeight(x, s.z) + localY - 1.2, s.z);
    }
    const mat = makeMistMaterial({ opacity: 0.62, scale: [9, 1.4], speed: 0.018, softness: [0.36, 0.62], seed: i * 7.3 });
    group.add(new THREE.Mesh(geo, mat));
  });

  // ---------- B. Valley mist: a flat sheet below the ridge ----------
  const valleyGeo = new THREE.PlaneGeometry(1300, 420, 1, 1);
  valleyGeo.rotateX(-Math.PI / 2);
  const valleyMat = makeMistMaterial({
    opacity: 0.9, scale: [7, 3], speed: 0.006, softness: [0.34, 0.64], nearFade: [20, 60], seed: 3.1,
  });
  const valley = new THREE.Mesh(valleyGeo, valleyMat);
  valley.position.set(0, -20, -350);   // fills the valley from below the ridge out to the mountains
  group.add(valley);

  // ---------- C. Distant band: a curved ring of mist between the far ranges ----------
  const ringGeo = new THREE.CylinderGeometry(620, 620, 150, 96, 1, true, -Math.PI * 0.75, Math.PI * 1.5);
  const ringMat = makeMistMaterial({
    opacity: 0.7, scale: [26, 1.2], speed: 0.004, softness: [0.34, 0.66], nearFade: [0, 1], seed: 9.4,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(0, 30, -80);
  ring.rotation.y = Math.PI;       // open side behind the start, so the band wraps around the view ahead
  group.add(ring);

  scene.add(group);

  // The mist colour comes from the palette (mood.mist.air), so only time needs updating.
  function update(time) {
    shared.uTime.value = time;
  }
  update(0);

  return { group, update };
}

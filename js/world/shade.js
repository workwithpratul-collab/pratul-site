// shade.js: keeps the film's words readable by darkening the scene softly, right behind them.
//
// There are no boxes or panels behind the text. Instead, after the world is drawn, one flat
// rectangle covering the screen is drawn on top with a tiny shader: it is see-through everywhere
// except in a soft oval behind each block of words, where it lays a little of the scene's own deep
// colour over the picture (palette.js textShade: navy at night, lilac by sunrise; never black).
// The oval fades out gradually, so the darkening reads as dusk in that part of the sky, not a shape.
//
// The words (their position on screen and how visible they are) come from the HTML layer: each
// text block is a "spot". It costs one tiny draw per frame, and nothing at all when no words show.

import * as THREE from 'three';
import { mood } from './palette.js';

const MAX_SPOTS = 3;

export function createShade() {
  const spots = new Map();   // key -> { el, rect, alpha }
  const uniforms = {
    uSpot: { value: Array.from({ length: MAX_SPOTS }, () => new THREE.Vector4()) },   // centre x, y, radius x, y (0..1 of the screen)
    uAlpha: { value: new Array(MAX_SPOTS).fill(0) },
    uColor: { value: mood.textShade.color },     // a live colour: it follows the light (setClimb)
    uStrength: { value: mood.textShade.strength },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec4 uSpot[${MAX_SPOTS}];
      uniform float uAlpha[${MAX_SPOTS}];
      uniform vec3 uColor;
      uniform float uStrength;
      varying vec2 vUv;
      void main() {
        float a = 0.0;
        for (int i = 0; i < ${MAX_SPOTS}; i++) {
          vec2 d = (vUv - uSpot[i].xy) / uSpot[i].zw;
          // A soft bell curve: full at the centre, fading to nothing well past the words' edges.
          a = max(a, uAlpha[i] * exp(-dot(d, d) * 1.6));
        }
        gl_FragColor = vec4(uColor, a * uStrength);
      }
    `,
  });
  // A flat square that fills the screen (the vertex shader ignores the camera).
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const camera = new THREE.Camera();

  // Measure where a block of words sits. Done when it appears and on resize, never every frame
  // (reading the layout every frame would slow the page down).
  function measure(s) {
    const r = s.el.getBoundingClientRect();
    // Ignore the reveal's small upward slide: measure the block where it will settle.
    s.rect = { x: r.left, y: r.top, w: r.width, h: r.height };
  }
  window.addEventListener('resize', () => spots.forEach(measure));
  document.fonts?.ready.then(() => spots.forEach((s) => s.rect && measure(s)));

  return {
    // Words appear (or update): key names the block, alpha (0..1) is how visible it is now.
    set(key, el, alpha) {
      let s = spots.get(key);
      if (!s) { s = { el, rect: null, alpha: 0, target: 0 }; spots.set(key, s); }
      if (!s.rect && alpha > 0) measure(s);
      s.target = alpha;
    },
    remeasure(key) { const s = spots.get(key); if (s) measure(s); },
    // Draw the shade over the scene (call right after the scene is drawn). rect = the stage box.
    render(renderer, rect) {
      let i = 0;
      for (const s of spots.values()) {
        // Ease towards the wanted amount, so the shade gathers and lifts as gently as the words.
        s.alpha += (s.target - s.alpha) * 0.06;
        if (s.alpha <= 0.001 || !s.rect || i >= MAX_SPOTS) continue;
        const { x, y, w, h } = s.rect;
        uniforms.uSpot.value[i].set(
          (x + w / 2 - rect.left) / rect.width,
          1 - (y + h / 2 - rect.top) / rect.height,
          (w / 2 + 90) / rect.width,     // the oval reaches well past the words...
          (h / 2 + 80) / rect.height,    // ...so its edge is long gone before anything else
        );
        uniforms.uAlpha.value[i] = s.alpha;
        i++;
      }
      if (i === 0) return;               // no words on screen: nothing to draw
      for (let j = i; j < MAX_SPOTS; j++) uniforms.uAlpha.value[j] = 0;
      uniforms.uStrength.value = mood.textShade.strength;
      renderer.render(scene, camera);
    },
  };
}

// heroword.js: the summit hero's big word, "move", painted INSIDE the 3D scene.
//
// The approved hero (references/round5/) has "move" standing far off in the sky, with the bottom of
// its letters hidden behind the distant snow range. To make that real (not a picture laid on top),
// the word is drawn into the 3D canvas as if it stood about 4.2 km away: beyond the far range (about
// 3.7-3.8 km from the summit) and in front of the sky dome (4.5 km). The graphics card then hides
// the parts of the letters that the peaks stand in front of, exactly where the peaks really are.
//
// Two flat shapes, drawn right after the world, each one tested against the world's depth:
//   1. a soft shade over the left of the SKY (the mock-up's darkening behind the words). Because it
//      is also "4.2 km away", the mountains, clouds and the knoll in front stay untouched, as in the
//      approved design, and the word on top of it keeps its pure amber.
//   2. the word itself, painted once into a small picture (a canvas) in the self-hosted Gloock font.
//
// Where the word sits, how big it is, and when it shows all come from its HTML twin (.hero__move in
// index.html). The twin is laid out, scaled and revealed by CSS and site.js like every other word,
// but painted see-through while the live scene shows. Each frame we copy its box and its opacity,
// so the 3D word always lands exactly where the HTML says it is. (If the 3D scene isn't running,
// the twin simply shows itself, in amber.)
//
// Colours: the word's amber is an interface colour (tokens.css --amber, read from the twin); the
// sky shade is the scene's own deep colour from palette.js (textShade). Nothing is typed in here.

import * as THREE from 'three';
import { mood } from './palette.js';

const DISTANCE = 4200;   // metres: behind the far range, in front of the sky (see above)

// The mock-up's shade (references/round5/MoveHero.dc.html): strongest at the left edge, gone by just
// past the middle, so the words always read against the sky. [where across the screen, how much]
const SHADE_STOPS = [[0, 0.45], [0.38, 0.15], [0.55, 0]];
// The top bar's soft band at the top of the screen (unchanged from the hero's earlier HTML shade).
const TOP_BAND = [0.45, 0.22];   // [how much at the very top, how far down it fades out]
// A soft pool of dusk right behind the word. In the mock-up the sky behind "move" was a deep violet;
// the live summit's sky there is a warm peach, almost as bright as the amber, so the word would lose
// its edge. This deepens the sky (only the sky: it's behind the peaks too) in a soft oval around the
// letters. [how much at the centre, how far past the letters' box it reaches (mock-up px: x, y)]
const WORD_POOL = [0.55, 170, 120];

export function createHeroWord({ el, inner }) {
  // ---------- The picture of the word ----------
  const canvas = document.createElement('canvas');
  const texture = new THREE.CanvasTexture(canvas);
  // (no colour conversion: the canvas already holds the exact screen colours, so they pass straight
  // through, and the amber on screen is exactly tokens.css's amber)
  texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = false;           // it's shown at exactly its own size: no blurring
  texture.minFilter = THREE.LinearFilter;
  texture.premultiplyAlpha = true;           // clean, soft letter edges over the sky
  let painted = null;   // what the picture was painted for: "width x height @ pixel ratio"
  let pad = 0;          // room around the letters' box (a "v" reaches a little past it)

  // Both shapes are drawn straight in screen space (no camera maths): the vertex shader places them
  // where we say, and gives them the depth of something DISTANCE metres away.
  const vertexShader = /* glsl */ `
    uniform vec4 uRect;     // left, bottom, right, top, in -1..1 screen units
    uniform float uDepth;   // the depth of something DISTANCE metres in front of the camera
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec2 p = mix(uRect.xy, uRect.zw, uv);
      gl_Position = vec4(p, uDepth, 1.0);
    }
  `;
  const common = { transparent: true, depthTest: true, depthWrite: false };

  const wordMaterial = new THREE.ShaderMaterial({
    ...common,
    premultipliedAlpha: true,
    uniforms: {
      uRect: { value: new THREE.Vector4() },
      uDepth: { value: 0 },
      uMap: { value: texture },
      uAlpha: { value: 0 },
    },
    vertexShader,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uAlpha;
      varying vec2 vUv;
      void main() {
        // (the picture is already in screen colours with its edges premultiplied: shown as it is)
        gl_FragColor = texture2D(uMap, vUv) * uAlpha;
      }
    `,
  });
  wordMaterial.toneMapped = false;

  const shadeMaterial = new THREE.ShaderMaterial({
    ...common,
    uniforms: {
      uRect: { value: new THREE.Vector4(-1, -1, 1, 1) },
      uDepth: { value: 0 },
      uColor: { value: mood.textShade.color },   // a live palette colour (it follows setClimb)
      uAlpha: { value: 0 },
      uStops: { value: new THREE.Vector3(SHADE_STOPS[1][0], SHADE_STOPS[2][0], 0) },
      uAmounts: { value: new THREE.Vector3(SHADE_STOPS[0][1], SHADE_STOPS[1][1], SHADE_STOPS[2][1]) },
      uTop: { value: new THREE.Vector2(...TOP_BAND) },
      uPool: { value: new THREE.Vector4() },   // centre x, y, radius x, y (0..1 of the screen)
      uPoolAmount: { value: WORD_POOL[0] },
    },
    vertexShader,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uAlpha;
      uniform vec3 uStops, uAmounts;
      uniform vec2 uTop;
      uniform vec4 uPool;
      uniform float uPoolAmount;
      varying vec2 vUv;
      void main() {
        float x = vUv.x;
        // Left to right: full, then softer by uStops.x, then nothing by uStops.y.
        float a = x < uStops.x
          ? mix(uAmounts.x, uAmounts.y, x / uStops.x)
          : mix(uAmounts.y, uAmounts.z, clamp((x - uStops.x) / (uStops.y - uStops.x), 0.0, 1.0));
        // The top band, under the top bar (vUv.y is 1 at the top of the screen).
        float top = uTop.x * clamp((vUv.y - (1.0 - uTop.y)) / uTop.y, 0.0, 1.0);
        // The pool behind the word: a soft bell curve, full at the centre (as in shade.js).
        vec2 d = (vUv - uPool.xy) / uPool.zw;
        float pool = uPoolAmount * exp(-dot(d, d) * 1.6);
        a = 1.0 - (1.0 - a) * (1.0 - top) * (1.0 - pool);
        gl_FragColor = vec4(uColor, a * uAlpha);
        #include <colorspace_fragment>
      }
    `,
  });

  const geometry = new THREE.PlaneGeometry(1, 1).translate(0.5, 0.5, 0);   // uv = 0..1 across it
  const shade = new THREE.Mesh(geometry, shadeMaterial);
  const word = new THREE.Mesh(geometry, wordMaterial);
  shade.frustumCulled = word.frustumCulled = false;
  shade.renderOrder = 0;
  word.renderOrder = 1;   // (the word over the shade)
  const scene = new THREE.Scene();
  scene.add(shade, word);
  const flat = new THREE.Camera();   // (unused by the shaders, but render() needs one)

  // ---------- Paint the word into the picture (once, and again only if its size changes) ----------
  function paint(dpr) {
    const w = el.offsetWidth, h = el.offsetHeight;
    const key = `${w}x${h}@${dpr}`;
    if (key === painted || !w || !h) return;
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize);
    pad = Math.ceil(size * 0.12);
    canvas.width = Math.ceil((w + pad * 2) * dpr);
    canvas.height = Math.ceil((h + pad * 2) * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w + pad * 2, h + pad * 2);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`;
    ctx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
    // The amber of the interface (tokens.css), read from the twin's own CSS.
    ctx.fillStyle = cs.getPropertyValue('--word-color').trim() || cs.color;
    ctx.textBaseline = 'alphabetic';
    // Put the baseline exactly where CSS puts it in the twin's box: half the spare line height
    // above the font's own top, then the font's ascent.
    const m = ctx.measureText(el.textContent);
    const lineHeight = parseFloat(cs.lineHeight) || size;
    const baseline = (lineHeight - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
    ctx.fillText(el.textContent, pad + (parseFloat(cs.paddingLeft) || 0), pad + baseline);
    texture.needsUpdate = true;
    painted = key;
  }

  let fontReady = false;
  const font = getComputedStyle(el);
  document.fonts.load(`${font.fontSize} ${font.fontFamily}`, el.textContent).then(() => { fontReady = true; painted = null; });
  window.addEventListener('resize', () => { painted = null; });

  // How much of the sky's shade shows: it gathers gently when the hero arrives and lifts when it
  // leaves (like the HTML shade it replaces, which faded over ~1.4 s).
  let shadeShown = 0;
  let wordShown = 0;
  const root = document.documentElement;

  return {
    // Its shaders are prepared while the film loads (film.js), so its first appearance never waits.
    compile(renderer) { return renderer.compileAsync(scene, flat); },
    // Call right after the world (and the film's text shade) is drawn. rect = the stage box.
    render(renderer, camera, rect) {
      if (!fontReady) return;
      const heroIn = root.classList.contains('hero-in');
      // Only while the hero shows, or its shade and word are still fading out: otherwise nothing at all.
      if (!heroIn && shadeShown <= 0.001 && wordShown <= 0.001) return;
      // How visible the words are: the twin's own reveal (opacity) times the hand-over's fade of the
      // hero's words (on their box, .hero__inner).
      const innerAlpha = Number(getComputedStyle(inner).opacity);
      wordShown = Number(getComputedStyle(el).opacity) * innerAlpha;
      shadeShown += ((heroIn ? innerAlpha : 0) - shadeShown) * 0.05;
      if (wordShown <= 0.001 && shadeShown <= 0.001) return;
      const dpr = renderer.getPixelRatio();
      paint(dpr);
      // The twin's box on screen (with its reveal's rise and the hand-over's lift), plus the padding.
      const b = el.getBoundingClientRect();
      const toX = (x) => ((x - rect.left) / rect.width) * 2 - 1;
      const toY = (y) => 1 - ((y - rect.top) / rect.height) * 2;
      wordMaterial.uniforms.uRect.value.set(toX(b.left - pad), toY(b.bottom + pad), toX(b.right + pad), toY(b.top - pad));
      // (the pool follows the word; its reach is in mock-up pixels, so it scales with the composition)
      const u = rect.width / 1440;
      shadeMaterial.uniforms.uPool.value.set(
        (b.left + b.width / 2 - rect.left) / rect.width,
        1 - (b.top + b.height * 0.55 - rect.top) / rect.height,
        (b.width / 2 + WORD_POOL[1] * u) / rect.width,
        (b.height * 0.3 + WORD_POOL[2] * u) / rect.height,
      );
      // The depth of a point DISTANCE metres straight ahead, in the camera's own depth scale.
      const e = camera.projectionMatrix.elements;
      const depth = (e[10] * -DISTANCE + e[14]) / DISTANCE;
      wordMaterial.uniforms.uDepth.value = depth;
      shadeMaterial.uniforms.uDepth.value = depth;
      wordMaterial.uniforms.uAlpha.value = wordShown;
      shadeMaterial.uniforms.uAlpha.value = shadeShown;
      word.visible = wordShown > 0.001;
      renderer.render(scene, flat);
    },
  };
}

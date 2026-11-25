// ridge.js: "the prayer-flag ridge", the selected-work carousel (desktop only). DESIGN.md §6.
//
// The projects hang as framed browser panels along a curved mountain ridge at dusk, with
// strings of prayer flags between them. Scrolling walks the camera along the ridge (the section is
// held on screen while you scroll, GSAP ScrollTrigger). The panel in front is sharp and lit by a
// warm lantern; the others fall back into soft focus and the evening haze, like a film camera
// racking focus. The project's words and its "View case study" link are real HTML beside it.
//
// Cheap by design:
//   - drawn by the one shared renderer (gl.js), only while the section is on screen
//   - the "out of focus" look is a small pre-blurred copy of each screenshot, mixed in by a tiny
//     shader, not a full-screen blur
//   - all the flags are ONE instanced mesh (one draw call), swaying in the vertex shader
//
// Never cropped, never mirrored: each screenshot is drawn whole ("contain") into its frame, on a
// plane that always shows its front to the camera.

import * as THREE from 'three';
import { renderer, addView, glowBlending } from '../gl.js';
import { MATERIALS } from '../world/palette.js';
import { collapseWhenStill, collapsing } from '../once.js';

const C = MATERIALS.ridge;
const PANEL_W = 3.2;                         // world units
const FRAME = { w: 1024, bar: 44, pad: 18 }; // the panel texture, in pixels
const IMG_RATIO = 10 / 16;                   // the screenshots are 16:10

export async function createRidge({ root, slides, core, onChange }) {
  const { gsap, ScrollTrigger, lenis, reduceMotion } = core;
  const stageEl = root.querySelector('.ridge__stage');

  // ---------- Scene, camera, haze ----------
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(C.fog, 9, 26);
  const camera = new THREE.PerspectiveCamera(34, 1.6, 0.1, 80);

  // The ridge line the panels hang along: a gentle curve, rising to the right.
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-9, -0.4, -2.5),
    new THREE.Vector3(-4.5, 0.1, 0.4),
    new THREE.Vector3(0, 0.45, -0.6),
    new THREE.Vector3(4.6, 0.9, 0.5),
    new THREE.Vector3(9.5, 1.5, -2.2),
  ]);
  // Where the panels hang on it: spread evenly around the middle of the curve. Three panels sat
  // 0.23 apart; with more, they move a little closer so the walk stays the same calm length per panel.
  const gap = Math.min(0.23, 0.6 / Math.max(slides.length - 1, 1));
  const AT = slides.map((_, i) => 0.5 + (i - (slides.length - 1) / 2) * gap);

  // ---------- The painted ridges: three soft layers, paler with distance ----------
  scene.add(ridgeLayer({ y: -1.6, z: -12, amp: 2.4, colour: C.layers[0], snow: true, seed: 3 }));
  scene.add(ridgeLayer({ y: -2.0, z: -6.5, amp: 1.4, colour: C.layers[1], seed: 7 }));
  scene.add(ridgeLayer({ y: -2.25, z: -1.2, amp: 0.7, colour: C.layers[2], seed: 11, wide: 30 }));

  // ---------- The panels ----------
  const panelGeo = new THREE.PlaneGeometry(PANEL_W, PANEL_W * (FRAME.bar + FRAME.pad * 2 + FRAME.w * IMG_RATIO) / FRAME.w);
  const panels = await Promise.all(slides.map(async (slide, i) => {
    const src = slide.querySelector('.frame__shot').getAttribute('src').replace('-720', '-1200');
    const img = await loadImage(src);
    const { sharp, soft } = paintPanel(img);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uSharp: { value: sharp },
        uSoft: { value: soft },
        uFocus: { value: 0 },
        uFade: { value: 1 },
        uWarm: { value: new THREE.Color(C.lantern) },
        uFog: { value: new THREE.Color(C.fog) },
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        varying float vDepth;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uSharp, uSoft;
        uniform float uFocus, uFade;
        uniform vec3 uWarm, uFog;
        varying vec2 vUv;
        varying float vDepth;
        void main() {
          vec4 sharp = texture2D(uSharp, vUv);
          vec4 soft = texture2D(uSoft, vUv);
          vec4 c = mix(soft, sharp, uFocus);          // rack focus
          // Lit by the lantern above it: a warm wash from the top, stronger in front.
          float lamp = smoothstep(0.35, 1.0, vUv.y) * 0.16 * uFocus;
          c.rgb = c.rgb * mix(0.62, 1.0, uFocus) + uWarm * lamp;
          // The evening haze: further panels lean into the page colour.
          float haze = smoothstep(6.0, 18.0, vDepth) * 0.85 + (1.0 - uFocus) * 0.22;
          c.rgb = mix(c.rgb, uFog, clamp(haze, 0.0, 0.9));
          gl_FragColor = vec4(c.rgb, c.a * uFade);
          #include <colorspace_fragment>
        }`,
      transparent: true,
    });
    const mesh = new THREE.Mesh(panelGeo, material);
    const p = curve.getPointAt(AT[i]);
    mesh.position.set(p.x, p.y + 1.25, p.z);
    scene.add(mesh);
    // A warm lantern glow hanging above the frame (only bright on the front panel).
    const glow = new THREE.Sprite(glowBlending(new THREE.SpriteMaterial({ map: glowTexture(), color: C.lantern, transparent: true, depthWrite: false, opacity: 0 })));
    glow.scale.set(0.9, 0.9, 1);
    glow.position.set(p.x, p.y + 2.5, p.z + 0.05);
    scene.add(glow);
    return { mesh, glow, material, base: p.clone() };
  }));

  // Two poles beside each panel (they fade with it), and the flag strings running from one
  // panel's poles to the next: never across the face of a panel.
  const poleGeo = new THREE.CylinderGeometry(0.022, 0.032, 2.9, 6);
  const tops = [];
  panels.forEach((panel) => {
    const { base } = panel;
    panel.poleMat = new THREE.MeshBasicMaterial({ color: C.pole, fog: true, transparent: true });
    for (const side of [-1, 1]) {
      const x = base.x + side * (PANEL_W / 2 + 0.22);
      const pole = new THREE.Mesh(poleGeo, panel.poleMat);
      pole.position.set(x, base.y + 1.5, base.z);
      scene.add(pole);
      tops.push(new THREE.Vector3(x, base.y + 2.9, base.z));
    }
  });
  // (pairs: the right pole of one panel to the left pole of the next)
  const spans = [];
  for (let i = 1; i + 1 < tops.length; i += 2) spans.push([tops[i], tops[i + 1]]);
  // and a short run off each end, into the haze
  spans.push([tops[tops.length - 1], tops[tops.length - 1].clone().add(new THREE.Vector3(3.5, 0.4, -1))]);
  const { strings, flags } = buildFlags(spans);
  scene.add(strings, flags);

  // ---------- Where the camera stands for each panel ----------
  // In front of the panel, a little to its left and below, looking slightly up at it: a gentle
  // dolly between these as the scroll moves.
  const shots = panels.map(({ mesh }) => ({
    pos: mesh.position.clone().add(new THREE.Vector3(-2.2, -0.15, 8.2)),
    look: mesh.position.clone().add(new THREE.Vector3(-2.3, -0.1, 0)),
  }));
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  function shotAt(t) {
    const i = Math.min(Math.floor(t), shots.length - 2);
    const f = THREE.MathUtils.smootherstep(t - i, 0, 1);
    camPos.lerpVectors(shots[i].pos, shots[i + 1].pos, f);
    camLook.lerpVectors(shots[i].look, shots[i + 1].look, f);
    // A slight arc out over the valley between panels, so the move feels like a dolly, not a slide.
    camPos.z += Math.sin(f * Math.PI) * 0.9;
  }

  // ---------- Scroll walks the ridge ----------
  // The whole work section (heading and ridge, one screen) is pinned while you scroll: 0.85 of a
  // screen per panel, 0 = first panel, last = the last one.
  let target = 0, shown = 0, index = 0;
  let finished = false;   // (see "Once walked, it stays walked" below)
  const last = panels.length - 1;
  const section = root.closest('.work');
  const html = document.documentElement;
  const walkLength = () => window.innerHeight * 0.85 * last;
  root.classList.add('is-3d');
  section.classList.add('is-pinned');
  const st = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => `+=${walkLength()}`,
    pin: true,
    pinSpacing: true,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      if (finished || collapsing()) return;   // (ignore what it sees while another section collapses)
      const walked = self.progress * (self.end - self.start);
      target = Math.min(Math.max(walked / walkLength(), 0), 1) * last;
      // Walked to the last panel, going down: the walk is finished for this visit (js/once.js).
      if (self.progress >= 0.999) finish();
    },
  });
  ScrollTrigger.refresh();

  // ---------- Once walked, it stays walked ----------
  // The camera stays at the last panel; scrolling back up never walks it backwards. When the scroll is
  // next at rest the pin is removed (with its walking length), so the section is one screen again and
  // scrolling up past it is quick. The arrows and keys still move between panels, without scrolling.
  function finish() {
    finished = true;
    target = last;
    const spacer = section.parentElement;   // (ScrollTrigger's pin-spacer, in the page's flow)
    const after = spacer.nextElementSibling;
    collapseWhenStill('work', () => st.kill(true), after);
  }

  // Arrows, keys and the counter move the page to the matching point of the walk.
  function goTo(i) {
    i = Math.max(0, Math.min(last, i));
    if (finished) { target = i; return; }   // (no walking length any more: just glide the camera there)
    const y = st.start + (i / last) * walkLength();
    lenis.scrollTo(y, { duration: reduceMotion ? 0 : 1.3, easing: (t) => 1 - Math.pow(1 - t, 3) });
  }

  // ---------- Idle life, paused on hover ----------
  let paused = false;
  root.addEventListener('pointerenter', () => { paused = true; });
  root.addEventListener('pointerleave', () => { paused = false; });
  root.addEventListener('focusin', () => { paused = true; });
  root.addEventListener('focusout', () => { paused = false; });
  let idle = 0;

  // ---------- Every frame (only while on screen) ----------
  function frame(dt, time, rect) {
    // While the film is still drawing (the hand-over hasn't covered the summit yet), the ridge waits:
    // they share the canvas.
    if (html.classList.contains('handover') && !html.classList.contains('work-ready')) return;
    if (!paused && !reduceMotion) idle += dt;
    flags.material.uniforms.uTime.value = idle;
    // Follow the scroll softly (the camera never jerks, even with a fast flick).
    shown += (target - shown) * (1 - Math.exp(-dt * (reduceMotion ? 30 : 4.5)));
    shotAt(Math.min(Math.max(shown, 0), last));
    camPos.x += Math.sin(idle * 0.25) * 0.06;   // the camera breathes a little, like a hand-held lens
    camPos.y += Math.sin(idle * 0.31) * 0.03;
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    const aspect = rect.width / rect.height;
    if (Math.abs(camera.aspect - aspect) > 1e-4) { camera.aspect = aspect; camera.updateProjectionMatrix(); }
    // Rack focus: the panel nearest the camera's position along the walk is sharp and lit.
    panels.forEach((p, i) => {
      const focus = 1 - THREE.MathUtils.smoothstep(Math.abs(shown - i), 0.08, 0.7);
      p.material.uniforms.uFocus.value = focus;
      // A panel we've walked past fades into the haze, so it never drifts across the words on
      // the left; the next one waits, soft, on the right.
      const fade = 1 - THREE.MathUtils.smoothstep(shown - i, 0.25, 0.85);
      p.material.uniforms.uFade.value = fade;
      p.poleMat.opacity = fade;
      p.mesh.visible = fade > 0.01;
      p.glow.material.opacity = focus * (0.75 + 0.08 * Math.sin(idle * 1.7 + i));
      // Each panel turns a touch towards the camera, so it's never seen edge-on (or from behind).
      p.mesh.lookAt(camera.position.x * 0.35 + p.mesh.position.x * 0.65, p.mesh.position.y, camera.position.z);
    });
    const near = Math.round(shown);
    if (near !== index) { index = near; onChange(index); }
    renderer.render(scene, camera);
  }
  // Its shaders are prepared in the background before its first frame: drawing it straight away
  // compiled them on the spot, a ~90 ms stutter just as Work came on screen.
  await renderer.compileAsync(scene, camera).catch(() => {});
  addView({ el: stageEl, frame, name: 'ridge' });
  onChange(0);

  return { goTo, get index() { return index; } };
}

// ---------- Helpers ----------

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Draw the browser frame and the whole screenshot into a canvas (sharp), plus a small blurred copy
// for the out-of-focus look.
function paintPanel(img) {
  const { w, bar, pad } = FRAME;
  const ih = Math.round((w - pad * 2) * IMG_RATIO);
  const h = bar + pad * 2 + ih;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  // The frame: a rounded dusk panel with a slim top bar and three dots.
  g.fillStyle = C.frame;
  roundRect(g, 0, 0, w, h, 22); g.fill();
  g.fillStyle = C.bar;
  roundRect(g, 0, 0, w, bar + 6, 22); g.fill();
  g.fillRect(0, bar - 10, w, 16);
  g.fillStyle = C.dot;
  [0, 1, 2].forEach((k) => { g.beginPath(); g.arc(28 + k * 22, bar / 2 + 2, 6, 0, Math.PI * 2); g.fill(); });
  // The screenshot, whole: scaled to fit ("contain"), centred, never cropped or flipped.
  const box = { x: pad, y: bar + pad, w: w - pad * 2, h: ih };
  const s = Math.min(box.w / img.naturalWidth, box.h / img.naturalHeight);
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  g.save();
  roundRect(g, box.x, box.y, box.w, box.h, 10); g.clip();
  g.fillStyle = C.bar; g.fillRect(box.x, box.y, box.w, box.h);
  g.drawImage(img, box.x + (box.w - dw) / 2, box.y + (box.h - dh) / 2, dw, dh);
  g.restore();
  const sharp = new THREE.CanvasTexture(c);
  sharp.colorSpace = THREE.SRGBColorSpace;
  sharp.anisotropy = 4;
  // The soft copy: a quarter of the size, blurred. Small, so it costs little memory.
  const sc = document.createElement('canvas');
  sc.width = w / 4; sc.height = Math.round(h / 4);
  const sg = sc.getContext('2d');
  sg.filter = 'blur(5px)';
  sg.drawImage(c, 0, 0, sc.width, sc.height);
  const soft = new THREE.CanvasTexture(sc);
  soft.colorSpace = THREE.SRGBColorSpace;
  return { sharp, soft };
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

// A painted ridge silhouette: a wide shape with a soft, irregular top edge.
function ridgeLayer({ y, z, amp, colour, snow = false, seed = 1, wide = 40 }) {
  const steps = 120;
  const pos = [], col = [], idx = [];
  const base = new THREE.Color(colour), top = new THREE.Color(snow ? C.snow : colour).lerp(base, snow ? 0.4 : 0.6);
  const n = (x) => Math.sin(x * 0.55 + seed) * 0.5 + Math.sin(x * 1.3 + seed * 2.1) * 0.3 + Math.sin(x * 2.9 + seed * 0.7) * 0.12;
  for (let i = 0; i <= steps; i++) {
    const x = -wide / 2 + (wide * i) / steps;
    const h = y + amp * (0.55 + 0.45 * n(x));
    pos.push(x, h, z, x, y - 2.2, z);
    col.push(top.r, top.g, top.b, 1, base.r, base.g, base.b, 0);
    if (i < steps) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geo.setIndex(idx);
  // (Each layer's colour fades to nothing towards its foot: the painting dissolves into the page.)
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, fog: true }));
}

// Fade by where a point lands on screen: -1 is the left edge of the view, 1 the right.
// Gone over the left third (the words), fully there from the middle onwards.
const SCREEN_FADE = 'vFade = smoothstep(-0.42, 0.02, gl_Position.x / gl_Position.w);';

// Strings of small flags hung between the pole tops, sagging gently. One instanced mesh.
function buildFlags(spans) {
  const pts = [];
  const flagsAt = [];
  for (const [a, b] of spans) {
    const span = a.distanceTo(b);
    const count = Math.max(4, Math.round(span / 0.32));
    const sag = 0.18 + span * 0.04;
    let prev = null;
    for (let k = 0; k <= count; k++) {
      const t = k / count;
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * sag;
      if (prev) pts.push(prev, p);
      prev = p;
      if (k > 0 && k < count) flagsAt.push(p);
    }
  }
  // The strings and flags fade away towards the left of the view, where the project's words
  // sit, so they never run through the text (SCREEN_FADE, worked out on the graphics chip).
  const strings = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(C.string) } },
    vertexShader: /* glsl */`
      varying float vFade;
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        ${SCREEN_FADE}
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      varying float vFade;
      void main() {
        gl_FragColor = vec4(uColor, 0.7 * vFade);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
  }));
  // Each flag hangs from the string: its top edge stays put, its bottom edge sways.
  const geo = new THREE.PlaneGeometry(0.2, 0.26, 1, 3);
  geo.translate(0, -0.13, 0);
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, fogColor: { value: new THREE.Color(C.fog) }, fogNear: { value: 9 }, fogFar: { value: 26 } },
    vertexShader: /* glsl */`
      attribute vec3 tint;
      attribute float phase;
      uniform float uTime;
      varying vec3 vTint;
      varying float vDepth, vFade;
      void main() {
        vTint = tint;
        vec3 p = position;
        float hang = -p.y / 0.26;                       // 0 at the string, 1 at the bottom edge
        p.z += sin(uTime * 1.6 + phase) * 0.05 * hang;
        p.x += sin(uTime * 1.1 + phase * 1.3) * 0.025 * hang;
        vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
        ${SCREEN_FADE}
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 fogColor;
      uniform float fogNear, fogFar;
      varying vec3 vTint;
      varying float vDepth, vFade;
      void main() {
        vec3 c = mix(vTint, fogColor, smoothstep(fogNear, fogFar, vDepth) * 0.9 + 0.12);
        if (vFade < 0.01) discard;
        gl_FragColor = vec4(c, vFade);
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const flags = new THREE.InstancedMesh(geo, material, flagsAt.length);
  const tint = new Float32Array(flagsAt.length * 3), phase = new Float32Array(flagsAt.length);
  const m = new THREE.Matrix4(), col = new THREE.Color();
  flagsAt.forEach((p, i) => {
    m.makeTranslation(p.x, p.y, p.z);
    flags.setMatrixAt(i, m);
    col.set(C.flags[i % C.flags.length]);
    tint.set([col.r, col.g, col.b], i * 3);
    phase[i] = i * 0.7;
  });
  geo.setAttribute('tint', new THREE.InstancedBufferAttribute(tint, 3));
  geo.setAttribute('phase', new THREE.InstancedBufferAttribute(phase, 1));
  return { strings, flags };
}

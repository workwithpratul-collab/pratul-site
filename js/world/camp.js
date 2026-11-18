// camp.js: the camps along the trail.
//  - Base camp: a glowing orange dome tent, a lantern with a warm pool of light, rocks.
//  - Project camps: an outdoor camp cinema (a canvas sheet between trekking poles).

import * as THREE from 'three';
import { groundHeight, seededRandom } from './terrain.js';
import { makePaintedMaterial, createStones, createStoneVariety, setSecondWarmLight } from './forest.js';
import { NOISE_GLSL } from './glsl.js';
import { mood, MATERIALS } from './palette.js';

const L = MATERIALS.lights;   // light-source colours (the only strong warm colours in the world)
const GEAR = MATERIALS.camp;

// Where base camp sits (the clearing in terrain.js is centred near here).
export const BASE_CAMP = {
  tent: { x: -3.8, z: -2.2, facing: 0.75 },    // facing: turn (radians) so the door looks towards the trail
  lantern: { x: -1.75, z: 0.35 },
};

// Where the first project camp (DERMAÉ) stands, on the ridge crest at the end of the trail.
export const RIDGE_CAMP = { x: 6.2, z: -147.2 };
// Where the camera stands when we arrive there (cameraPath.js uses this for the arrival shot).
export const RIDGE_VIEWPOINT = { x: -4.8, z: -135.5 };

const WARM = new THREE.Color(L.tentLight);

// ---------- A soft round glow texture, drawn once on a canvas ----------
// Used for halos around lights: bright middle, fading to nothing at the edge.
let glowTexture = null;
export function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.15)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

// A halo: a flat glow that always faces the camera. Additive = it brightens what's behind.
export function makeHalo(color, size, opacity) {
  const mat = new THREE.SpriteMaterial({
    map: getGlowTexture(),
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(size, size, 1);
  return sprite;
}

// =====================================================================
// BASE CAMP
// =====================================================================
export function createBaseCamp(scene) {
  const group = new THREE.Group();
  group.name = 'base-camp';

  // ---------- The tent ----------
  const tent = buildDomeTent();
  const { x: tx, z: tz, facing } = BASE_CAMP.tent;
  tent.position.set(tx, groundHeight(tx, tz) - 0.05, tz);
  tent.rotation.y = facing;
  group.add(tent);

  // Warm light inside the tent: lights the ground around it (no shadows, so it shines "through" the fabric).
  const tentLight = new THREE.PointLight(WARM, 28, 16, 2);
  tentLight.position.set(tx, tent.position.y + 0.7, tz);
  group.add(tentLight);
  // A big soft glow around the tent, like light scattering in the night air.
  const tentHalo = makeHalo(L.tentHalo, 7, 0.26);
  tentHalo.position.set(tx, tent.position.y + 0.7, tz);
  group.add(tentHalo);

  // ---------- The lantern ----------
  const lantern = buildLantern();
  const { x: lx, z: lz } = BASE_CAMP.lantern;
  lantern.position.set(lx, groundHeight(lx, lz), lz);
  group.add(lantern);

  const lanternLight = new THREE.PointLight(L.lanternLight, 12, 10, 2);
  lanternLight.position.set(lx, lantern.position.y + 0.32, lz);
  group.add(lanternLight);
  const lanternHalo = makeHalo(L.lanternHalo, 1.5, 0.5);
  lanternHalo.position.copy(lanternLight.position);
  group.add(lanternHalo);

  // ---------- Rocks ----------
  const rocks = [
    { x: -5.6, z: -0.4, s: 0.55 }, { x: -6.1, z: 0.4, s: 0.32 }, { x: -1.2, z: 0.75, s: 0.26 },
    { x: 2.2, z: -3.5, s: 0.7 }, { x: 2.9, z: -2.8, s: 0.36 }, { x: -2.4, z: -5.8, s: 0.45 },
    { x: 3.4, z: 4.5, s: 0.5 }, { x: -4.4, z: 3.6, s: 0.4 },
  ];
  // Soft, rounded painted stones (same painted style as the trees; see forest.js).
  createStones(scene, rocks.map((r) => ({ x: r.x, z: r.z, s: r.s * 1.35 })), seededRandom(77));

  scene.add(group);

  // ---------- update: the lantern flickers very gently (calm, not a disco) ----------
  function update(time) {
    const flicker = 1 + Math.sin(time * 7.3) * 0.03 + Math.sin(time * 13.1 + 1.7) * 0.02 + Math.sin(time * 2.1) * 0.03;
    lanternLight.intensity = 12 * flicker;
    lanternHalo.material.opacity = 0.5 * flicker;
    tentLight.intensity = 28 * (1 + Math.sin(time * 1.3) * 0.02);
  }

  return { group, update, tentLight, lanternLight, lanternPosition: lanternLight.position.clone() };
}

// =====================================================================
// PROJECT CAMPS: an outdoor camp cinema
// =====================================================================
// A pale canvas sheet stretched between two wooden trekking poles and tied down with guy
// ropes. It billows gently in the wind. The project video is "projected" onto it: warm,
// slightly soft, with its light spilling onto the grass. A small orange tent and a lantern
// sit beside it, so it feels like part of a trek camp.
//
// options: { x, z, facing, video, renderer, tent, tentTurn, lanternSide, variety }
//   tent:        which side of the sheet the tent sits on (1 = right, -1 = left, seen from the front)
//   tentTurn:    extra turn of the tent (radians), so no two camps are pitched alike
//   lanternSide: which side the lantern stands on (defaults to the tent's side)
//   variety:     true = use the four mixed stone shapes (the new camps); false = Phase 1's pebbles
//
// Lights: the three camps share ONE set of point lights (see createCampLights below), moved
// to whichever camp is nearest. Every light costs time on every pixel of the screen, so
// sharing keeps the film fast however many camps there are.
export function createProjectCamp(scene, {
  x, z, facing, video: videoSrc, renderer,
  tent: tentSide = 1, tentTurn = 0, lanternSide = tentSide, variety = false,
}) {
  const group = new THREE.Group();
  group.name = 'project-camp';
  group.position.set(x, groundHeight(x, z), z);
  group.rotation.y = facing;          // the front of the sheet faces this way
  group.updateMatrixWorld(true);

  // Height of the ground at a point given in this camp's own (local) coordinates.
  const tmp = new THREE.Vector3();
  function localGround(lx, lz) {
    tmp.set(lx, 0, lz);
    group.localToWorld(tmp);
    return groundHeight(tmp.x, tmp.z) - group.position.y;
  }

  // ---------- Sizes ----------
  // The picture area matches the video's shape (1888 x 908), with a canvas margin around it.
  const vidW = 4.0, vidH = vidW * (908 / 1888);
  const sheetW = vidW + 0.5, sheetH = vidH + 0.55;
  const sheetBottom = 0.5;                     // the sheet hangs this far above the grass
  const sheetCentreY = sheetBottom + sheetH / 2;
  const poleX = sheetW / 2 + 0.07;
  const poleH = sheetBottom + sheetH + 0.3;

  // ---------- The two wooden trekking poles ----------
  const poleMat = makePaintedMaterial({ colors: mood.wood, wind: false, roundness: 0, rim: 0.6 });
  const poleGeo = new THREE.CylinderGeometry(0.028, 0.038, 1, 8);
  poleGeo.translate(0, 0.5, 0);
  poleGeo.setAttribute('aTrunk', new THREE.Float32BufferAttribute(new Array(poleGeo.attributes.position.count).fill(0), 1));
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, 2);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  [-1, 1].forEach((side, i) => {
    // Each pole leans out very slightly, pulled by its guy ropes.
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -side * 0.035);
    m.compose(new THREE.Vector3(side * poleX, localGround(side * poleX, 0) - 0.15, 0), q, new THREE.Vector3(1, poleH, 1));
    poles.setMatrixAt(i, m);
  });
  poles.instanceMatrix.needsUpdate = true;
  group.add(poles);

  // ---------- Guy ropes: thin lines from the pole tops and sheet corners down to stakes ----------
  const ropeMat = new THREE.LineBasicMaterial({ color: GEAR.rope, transparent: true, opacity: 0.5 });
  const ropes = [];
  for (const side of [-1, 1]) {
    const top = new THREE.Vector3(side * (poleX + side * 0.08), poleH - 0.15, 0);
    for (const [ox, oz] of [[1.5, -1.3], [1.2, 1.0]]) {
      const sx = side * (poleX + ox), sz = oz;
      ropes.push(top, new THREE.Vector3(sx, localGround(sx, sz), sz));
    }
    // The sheet's bottom corners are tied down to small stakes just in front.
    const bx = side * (sheetW / 2 - 0.05);
    ropes.push(new THREE.Vector3(bx, sheetBottom, 0.02), new THREE.Vector3(side * (sheetW / 2 + 0.4), localGround(side * (sheetW / 2 + 0.4), 0.55), 0.55));
  }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ropes), ropeMat));

  // ---------- The canvas sheet, with the video projected onto it ----------
  // Start with a tiny 1x1 placeholder picture. When the video arrives we only swap the picture,
  // so three.js never has to build a new shader mid-scroll (that would cause a small stutter).
  const placeholder = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  placeholder.needsUpdate = true;
  const sheetUniforms = {
    uVideo: { value: placeholder },
    uOn: { value: 0 },                                     // 0 = projector off, 1 = on
    uHover: { value: 0 },                                  // 0..1: the pointer (or keyboard focus) is on this screen
    uTime: { value: 0 },
    uCanvas: { value: new THREE.Color(GEAR.canvas) },        // pale canvas in moonlight
    uSize: { value: new THREE.Vector2(sheetW, sheetH) },
    uVid: { value: new THREE.Vector2(vidW, vidH) },
  };
  const sheetMat = new THREE.ShaderMaterial({
    fog: true,
    side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform vec2 uSize;
      varying vec2 vUv;
      varying float vShade;

      // How far the sheet bulges forward at a point: pinned at the poles (left/right edges),
      // held a little at the top and bottom by the ropes, freest in the middle.
      float billow(vec2 p) {
        vec2 h = uSize * 0.5;
        float pinX = 1.0 - pow(p.x / h.x, 2.0);
        float pinY = 0.55 + 0.45 * (1.0 - pow(p.y / h.y, 2.0));
        float wind = 0.17 + 0.06 * sin(uTime * 0.55 + p.x * 0.8) + 0.03 * sin(uTime * 1.1 + p.y * 2.0 + p.x);
        return pinX * pinY * wind;
      }

      void main() {
        vUv = uv;
        vec3 p = position;
        // The cloth sags between the poles: the top edge dips in the middle, the bottom edge
        // is pulled up a little by its ropes. So the outline is curved, not a perfect rectangle.
        float across = 1.0 - pow(p.x / (uSize.x * 0.5), 2.0);
        float yN = p.y / (uSize.y * 0.5);
        p.y += across * (-0.09 * smoothstep(0.0, 1.0, yN) + 0.05 * smoothstep(0.0, 1.0, -yN));
        p.z += billow(position.xy);
        // Shade the folds: compare with the bulge a little to the side, like light on cloth.
        float slope = (billow(p.xy + vec2(0.15, 0.0)) - billow(p.xy - vec2(0.15, 0.0))) / 0.3;
        vShade = clamp(1.0 + slope * 2.2, 0.74, 1.15);
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform sampler2D uVideo;
      uniform float uOn, uHover;
      uniform vec3 uCanvas;
      uniform vec2 uSize, uVid;
      varying vec2 vUv;
      varying float vShade;
      ${NOISE_GLSL}

      void main() {
        // Where on the video this point of the sheet is (the video sits in the middle).
        vec2 vuv = (vUv - 0.5) * (uSize / uVid) + 0.5;
        // Soft edges, like a projector that's slightly out of focus at the borders.
        float edge = smoothstep(0.0, 0.025, vuv.x) * smoothstep(1.0, 0.975, vuv.x)
                   * smoothstep(0.0, 0.04, vuv.y) * smoothstep(1.0, 0.96, vuv.y);
        // The projector shines on the front; from behind you only see a faint glow through
        // the cloth (and never a mirror-image picture).
        float on = gl_FrontFacing ? uOn : 0.0;
        float through = gl_FrontFacing ? 0.0 : uOn;

        // A gentle 5-tap blur: a projected image is never razor sharp.
        vec2 px = vec2(1.3 / 1888.0, 1.3 / 908.0);
        vec2 cuv = clamp(vuv, 0.0, 1.0);
        vec3 pic = texture2D(uVideo, cuv).rgb * 0.4
                 + texture2D(uVideo, cuv + vec2(px.x, 0.0)).rgb * 0.15
                 + texture2D(uVideo, cuv - vec2(px.x, 0.0)).rgb * 0.15
                 + texture2D(uVideo, cuv + vec2(0.0, px.y)).rgb * 0.15
                 + texture2D(uVideo, cuv - vec2(0.0, px.y)).rgb * 0.15;
        // Warm it, soften the contrast and lift the blacks: it's light on canvas, not a screen.
        float lum = dot(pic, vec3(0.299, 0.587, 0.114));
        pic = mix(pic, vec3(lum), 0.06) * vec3(1.0, 0.94, 0.84);
        pic = pic * 0.9 + 0.03;

        // The canvas itself, with a faint woven texture and the folds of the fabric.
        float weave = 0.96 + 0.06 * vnoise(vUv * vec2(260.0, 150.0));
        vec3 col = uCanvas * weave;
        // A stitched hem along the edges of the cloth, a little darker.
        float hem = min(min(vUv.x, 1.0 - vUv.x) * uSize.x, min(vUv.y, 1.0 - vUv.y) * uSize.y);
        col *= mix(0.78, 1.0, smoothstep(0.03, 0.06, hem));
        // A little projector light also spills past the picture onto the canvas margin.
        float spill = (1.0 - edge) * exp(-6.0 * length(max(abs(vuv - 0.5) - 0.5, 0.0))) * 0.35;
        col += vec3(1.0, 0.86, 0.7) * spill * on * 0.35;
        col = mix(col, pic * weave, edge * on);
        col += vec3(1.0, 0.86, 0.7) * edge * through * 0.12;
        col *= vShade;
        // On hover the projection brightens a touch, like the projector turned up (and the
        // canvas around it catches a little more of its warm light).
        col *= 1.0 + uHover * 0.14 * (edge * on + 0.4);

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  Object.assign(sheetMat.uniforms, sheetUniforms);
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(sheetW, sheetH, 48, 24), sheetMat);
  sheet.position.set(0, sheetCentreY, 0);
  group.add(sheet);

  // ---------- Light from the projection, spilling onto the grass in front ----------
  // (The real point lights are shared between camps; these are where they sit for this one.)
  const spillAnchor = new THREE.Vector3(0, 1.0, 1.6);
  // A soft painted glow on the grass (cheaper and softer than a real light alone).
  const glowMat = new THREE.MeshBasicMaterial({
    map: getGlowTexture(), color: L.projectorGlow, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  const groundGlow = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 4), glowMat);
  groundGlow.rotation.x = -Math.PI / 2;
  groundGlow.position.set(0, localGround(0, 1.6) + 0.04, 1.6);
  group.add(groundGlow);

  // ---------- A small orange tent and the lantern beside the sheet ----------
  const tentX = tentSide * (sheetW / 2 + 2.3), tentZ = -0.5;
  const tent = buildDomeTent();
  tent.scale.setScalar(0.9);
  tent.position.set(tentX, localGround(tentX, tentZ) - 0.05, tentZ);
  tent.rotation.y = -0.45 * tentSide + tentTurn;    // door turned towards the viewer
  group.add(tent);
  const tentAnchor = new THREE.Vector3(tentX, tent.position.y + 0.6, tentZ);
  const tentHalo = makeHalo(L.tentHalo, 5, 0.22);
  tentHalo.position.copy(tentAnchor);
  group.add(tentHalo);

  const lanternX = lanternSide * (sheetW / 2 + 0.95), lanternZ = 0.9;
  const lantern = buildLantern();
  lantern.position.set(lanternX, localGround(lanternX, lanternZ), lanternZ);
  group.add(lantern);
  const lanternAnchor = new THREE.Vector3(lanternX, lantern.position.y + 0.33, lanternZ);
  const lanternHalo = makeHalo(L.lanternHalo, 1.3, 0.45);
  lanternHalo.position.copy(lanternAnchor);
  group.add(lanternHalo);

  scene.add(group);
  group.updateMatrixWorld(true);
  // The light positions in the world, for the shared lights.
  const anchors = {
    spill: group.localToWorld(spillAnchor.clone()),
    tent: group.localToWorld(tentAnchor.clone()),
    lantern: group.localToWorld(lanternAnchor.clone()),
  };

  // A few soft stones around the camp (given in camp coordinates, placed in the world).
  // Two stones on the far side from the tent, two by the tent, two out in front.
  // (DERMAÉ keeps exactly its Phase 1 stones: same places, same random seed.)
  const rand = seededRandom(variety ? 303 + Math.round(x * 7) : 303);
  const away = -tentSide;
  const stones = [[3.1 * away, 0.9, 0.5], [3.6 * away, 0.3, 0.3], [tentX + 1.4 * tentSide, 0.6, 0.55], [tentX - 0.9 * tentSide, 1.5, 0.3], [1.2, 2.6, 0.35], [-1.6, 2.2, 0.25]]
    .map(([lx, lz, s]) => {
      const w = group.localToWorld(new THREE.Vector3(lx, 0, lz));
      return { x: w.x, z: w.z, s };
    });
  if (variety) createStoneVariety(scene, stones, rand);
  else createStones(scene, stones, rand);

  // ---------- The video ----------
  // Nothing is downloaded until we approach this camp (see update: `wanted`). Then the file
  // streams in, its first frame goes to the graphics card, and it plays while we're here.
  // Once we've walked well past, the video is let go, so the memory is freed again.
  let video = null;
  let texture = null;
  let videoReady = false;
  function loadVideo() {
    if (video) return;
    video = document.createElement('video');
    video.muted = true;          // muted videos are allowed to autoplay
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.addEventListener('loadeddata', () => {
      texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      renderer?.initTexture(texture); // upload the first frame now, not in the middle of a shot
      sheetUniforms.uVideo.value = texture;
      videoReady = true;
    }, { once: true });
    video.src = videoSrc;
  }
  function unloadVideo() {
    if (!video) return;
    video.pause();
    video.removeAttribute('src');
    video.load();                // tells the browser to drop the file and its decoder
    video = null;
    texture?.dispose();
    texture = null;
    videoReady = false;
    sheetUniforms.uVideo.value = placeholder;
  }

  let on = 0;      // 0..1, fades the projection in once the video is ready
  let hover = 0;   // 0..1, eases towards the hover target
  let hoverTarget = 0;
  const levels = { spill: 0, tent: 14, lantern: 6 };   // what the shared lights should be here

  // The sheet's four corners and the point under its middle (for the caption), in the world.
  // camp-ui.js projects them onto the screen to lay the HTML link exactly over the sheet.
  const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([sx, sy]) =>
    group.localToWorld(new THREE.Vector3(sx * sheetW / 2, sheetCentreY + sy * sheetH / 2, 0.15)));
  const captionPoint = group.localToWorld(new THREE.Vector3(0, sheetBottom - 0.12, 0.2));
  const centre = group.localToWorld(new THREE.Vector3(0, sheetCentreY, 0.1));
  // A spot straight in front of the sheet, for the camera to glide to when the project opens.
  const front = group.localToWorld(new THREE.Vector3(0, sheetCentreY + 0.05, 2.6));

  // ---------- update: called every frame ----------
  // near: 0 when far away, 1 when we've arrived at this camp.
  // wanted: true while we're close enough (in the scroll) that the video should be loaded.
  function update(dt, camera, near, wanted, time) {
    if (wanted) loadVideo();
    else if (on < 0.01) unloadVideo();
    // Only play when close: decoding video costs power.
    if (video) {
      if (near > 0.25 && video.paused) video.play().catch(() => {});
      if (near < 0.15 && !video.paused) video.pause();
    }

    // Fade the projection up gently, and the light it spills with it.
    const target = videoReady && near > 0.25 ? 1 : 0;
    on += (target - on) * (1 - Math.exp(-dt * 1.6));
    hover += (hoverTarget - hover) * (1 - Math.exp(-dt * 6));
    sheetUniforms.uOn.value = on * 0.92;
    sheetUniforms.uHover.value = hover;
    sheetUniforms.uTime.value = time;
    glowMat.opacity = on * (0.16 + hover * 0.06);

    const flicker = 1 + Math.sin(time * 7.7 + x) * 0.03 + Math.sin(time * 12.3 + 0.4) * 0.02;
    lanternHalo.material.opacity = 0.45 * flicker;
    levels.spill = on * (5 + hover * 1.5);
    levels.lantern = 6 * flicker;
  }

  return {
    group, update, sheet, anchors, levels, corners, captionPoint, centre, front,
    setHover(v) { hoverTarget = v ? 1 : 0; },
    get videoElement() { return video; },
  };
}

// ---------- The shared camp lights ----------
// One projector spill, one tent glow and one lantern light, moved to whichever project camp
// is nearest the camera. The camps are 60 m or more apart and these lights reach under 10 m,
// so the move always happens out of sight. The painted trees and stones get the same tent
// glow position (setSecondWarmLight), so they light up at whichever camp we're at.
export function createCampLights(scene) {
  const spill = new THREE.PointLight(L.projector, 0, 10, 2);
  const tent = new THREE.PointLight(WARM, 14, 10, 2);
  const lantern = new THREE.PointLight(L.lanternLight, 6, 7, 2);
  scene.add(spill, tent, lantern);
  let current = null;
  // camps: the camp objects; camera: to find the nearest one.
  function update(camps, camera) {
    let best = null, bestD = Infinity;
    for (const c of camps) {
      const d = c.anchors.tent.distanceToSquared(camera.position);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best !== current) {
      current = best;
      spill.position.copy(best.anchors.spill);
      tent.position.copy(best.anchors.tent);
      lantern.position.copy(best.anchors.lantern);
      setSecondWarmLight(best.anchors.tent);
    }
    spill.intensity = current.levels.spill;
    tent.intensity = current.levels.tent;
    lantern.intensity = current.levels.lantern;
  }
  return { update };
}

// ---------- The dome tent ----------
function buildDomeTent() {
  const group = new THREE.Group();
  const width = 2.5, depth = 2.1, height = 1.25;

  // The dome: the top half of a sphere, stretched into a tent shape.
  const domeGeo = new THREE.SphereGeometry(1, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  domeGeo.scale(width / 2, height, depth / 2);

  const fabric = new THREE.MeshLambertMaterial({
    color: L.tentFabric,
    emissive: L.tentGlow,
    emissiveIntensity: 1,
  });
  // A small shader addition: the fabric glows as if lit from inside.
  // - brighter low down and towards the open door,
  // - darker lines where the poles cross over the dome.
  fabric.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTentPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTentPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTentPos;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        vec3 tp = vTentPos / vec3(${(width / 2).toFixed(3)}, ${height.toFixed(3)}, ${(depth / 2).toFixed(3)});
        // Light inside the tent shows through the fabric: strongest in the lower middle.
        float inner = 0.42 + 0.35 * (1.0 - tp.y);
        // The open door: a rounded "D" arch on the front (+z) side, like a zipped flap.
        float doorH = clamp(tp.y / 0.8, 0.0, 1.0);
        float doorWidth = 0.34 * sqrt(max(1.0 - doorH * doorH, 0.0));
        float door = step(0.25, tp.z) * (1.0 - smoothstep(doorWidth - 0.04, doorWidth, abs(tp.x)));
        // Pole seams: two crossing arcs seen from above form an X.
        float seamA = 1.0 - smoothstep(0.0, 0.05, abs(tp.x - tp.z));
        float seamB = 1.0 - smoothstep(0.0, 0.05, abs(tp.x + tp.z));
        float seams = max(seamA, seamB) * (1.0 - door);
        totalEmissiveRadiance *= inner * (1.0 - seams * 0.65);
        // Inside is brightest low in the middle, where the sleeping bags catch the lamp.
        vec3 insideCol = mix(vec3(1.0, 0.8, 0.48), vec3(0.95, 0.55, 0.25), smoothstep(0.0, 0.8, tp.y));
        totalEmissiveRadiance = mix(totalEmissiveRadiance, insideCol, door * 0.9);
        // The bottom edge of the tent is a little darker (it touches the ground).
        totalEmissiveRadiance *= mix(0.55, 1.0, smoothstep(0.0, 0.12, tp.y));`
      );
  };
  const dome = new THREE.Mesh(domeGeo, fabric);
  group.add(dome);

  // A flat dark groundsheet just under the tent, so it doesn't look like it floats.
  const sheet = new THREE.Mesh(
    new THREE.CircleGeometry(1, 32),
    new THREE.MeshLambertMaterial({ color: GEAR.groundsheet })
  );
  sheet.rotation.x = -Math.PI / 2;
  sheet.scale.set(width / 2 + 0.15, depth / 2 + 0.15, 1);
  sheet.position.y = 0.02;
  group.add(sheet);

  return group;
}

// ---------- The lantern: a small metal base, glowing glass, a cap and a handle ----------
export function buildLantern() {
  const group = new THREE.Group();
  const metal = new THREE.MeshLambertMaterial({ color: GEAR.metal });
  const glass = new THREE.MeshBasicMaterial({ color: L.lanternGlass }); // "Basic" ignores lights: it IS the light

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.06, 12), metal);
  base.position.y = 0.03;
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.19, 12), glass);
  glow.position.y = 0.155;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.08, 12), metal);
  cap.position.y = 0.29;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 16, Math.PI), metal);
  handle.position.y = 0.33;
  group.add(base, glow, cap, handle);
  return group;
}

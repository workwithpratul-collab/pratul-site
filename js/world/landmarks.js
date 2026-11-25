// landmarks.js: the three project landmarks along the trail. Each plays its project's video on a
// surface of its own, and each is built to stand firmly on the land (every post, wall and stone
// samples the ground beneath it and sinks a little into it).
//
//   lake  (DERMAÉ)            a still mountain lake: the film is a reflection on the water,
//                             settling mirror-clear as the camera arrives; hover drops a single drop
//   hut   (The King's Garden) a stone shepherd's hut: the film glows through its big window;
//                             hover creaks the door open and warm light spills onto the grass
//   sign  (Trinetra)          a weathered trail signboard at a fork: the film plays on the board;
//                             hover swings the board gently on its posts
//
// They all return the same interface as the Phase 4 camps, so the interface (camp-ui.js), the
// shared lights (createCampLights in camp.js) and the camera all work with them unchanged:
//   { group, update(dt, camera, near, wanted, time), setHover(on), corners, captionPoint, centre,
//     front, anchors: { spill, tent, lantern }, levels, videoElement }

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { groundHeight, seededRandom, noise2, smoothstep, LAKE_LEVEL } from './terrain.js';
import { makePaintedMaterial, createStoneVariety } from './forest.js';
import { buildLantern, makeHalo, getGlowTexture } from './camp.js';
import { makeMistMaterial } from './mist.js';
import { NOISE_GLSL } from './glsl.js';
import { mood, MATERIALS } from './palette.js';
import { createGrassPatch, RIDGE_GRASS } from './grass.js';

const L = MATERIALS.lights;
const VIDEO_ASPECT = 1888 / 908;

export function createLandmark(scene, def, { renderer }) {
  const build = { lake: buildLake, hut: buildHut, sign: buildSign }[def.kind];
  return build(scene, def, renderer);
}

// =====================================================================
// Shared pieces
// =====================================================================

// The video: nothing is downloaded until we approach (wanted), it plays while we're there
// (near), and once we've walked well past it is let go, so its memory is freed.
// Sharpness: full-resolution frames, no mipmaps (they would blur the text in the video), plain
// linear filtering and the best anisotropic filtering the graphics card offers.
function videoSource(src, renderer) {
  const placeholder = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  placeholder.needsUpdate = true;
  const uniform = { value: placeholder };
  let video = null, texture = null, ready = false, starting = false, warmed = false;
  function load() {
    if (video) return;
    video = document.createElement('video');
    Object.assign(video, { muted: true, loop: true, playsInline: true, preload: 'auto' });
    video.addEventListener('loadeddata', () => {
      texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = renderer?.capabilities.getMaxAnisotropy() ?? 1;
      renderer?.initTexture(texture);   // upload the first frame now, not in the middle of a shot
      uniform.value = texture;
      ready = true;
    }, { once: true });
    video.src = src;
  }
  function unload() {
    if (!video) return;
    video.pause();
    video.removeAttribute('src');
    video.load();                 // tells the browser to drop the file and its decoder
    video = null;
    texture?.dispose();
    texture = null;
    ready = false;
    warmed = false;
    uniform.value = placeholder;
  }
  // near: 0..1 (1 = arrived). wanted: within loading distance. on: how lit the picture is now.
  // The video starts playing (muted, quietly) as soon as it has loaded, while the camera is still
  // well away, and keeps playing until it is let go. Starting it only on arrival used to cost a
  // stutter just as the landmark came into view (the browser starting its video decoder).
  function update(near, wanted, on) {
    if (wanted) load();
    else if (on < 0.01) unload();
    if (video && ready && video.paused && !starting) {
      starting = true;
      const playing = video;
      video.play().catch(() => {}).finally(() => { starting = false; });
      // And its first moving frame goes up to the graphics card now, while the landmark is still out of
      // sight: the first upload of a playing video is the slow one (later frames just replace it).
      if (!warmed && 'requestVideoFrameCallback' in playing) {
        playing.requestVideoFrameCallback(() => {
          if (playing !== video || !texture) return;
          warmed = true;
          renderer?.initTexture(texture);
        });
      }
    }
  }
  return { uniform, update, get ready() { return ready; }, get element() { return video; } };
}

// The picture on a flat surface (the board's face, the hut's window): sharp, true to the video,
// with only a whisper of warmth and a soft edge so it sits in the painted world.
function makeScreenMaterial(videoUniform, { off, edge = 0.012 }) {
  const material = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uOn: { value: 0 }, uHover: { value: 0 }, uEdge: { value: edge } }]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform sampler2D uVideo;
      uniform vec3 uOff;
      uniform float uOn, uHover, uEdge;
      varying vec2 vUv;
      void main() {
        vec3 pic = texture2D(uVideo, vUv).rgb;
        // A whisper of warmth and slightly lifted blacks: lit, not a cold screen. Text stays crisp.
        pic = pic * vec3(1.0, 0.985, 0.95) * 0.96 + 0.015;
        float frame = smoothstep(0.0, uEdge, vUv.x) * smoothstep(0.0, uEdge, 1.0 - vUv.x)
                    * smoothstep(0.0, uEdge * 2.0, vUv.y) * smoothstep(0.0, uEdge * 2.0, 1.0 - vUv.y);
        vec3 col = mix(uOff, pic, uOn * frame);
        col *= 1.0 + uHover * 0.07 * uOn;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  material.uniforms.uVideo = videoUniform;
  material.uniforms.uOff = { value: off };
  return material;
}

// A painted solid (wood, stone, slate...): the same soft painted shader as the trees and stones,
// coloured by one of the palette's live colour pairs (so it follows the time of day), with a tint.
// The painted shader is written for instancing, so each solid is an instanced mesh of one.
function painted(geometry, colors, { tint = 1, roundness = 0.25, rim = 0.6 } = {}) {
  if (!geometry.attributes.aTrunk) {
    geometry.setAttribute('aTrunk', new THREE.Float32BufferAttribute(new Array(geometry.attributes.position.count).fill(0), 1));
  }
  const mesh = new THREE.InstancedMesh(geometry, makePaintedMaterial({ colors, wind: false, roundness, rim }), 1);
  mesh.setMatrixAt(0, new THREE.Matrix4());
  const c = Array.isArray(tint) ? new THREE.Color(...tint) : new THREE.Color(tint, tint, tint);
  mesh.setColorAt(0, c);
  return mesh;
}
// The painted shader shades from dark (y = 0) to light (y = 1) in the shape's own height, so
// shapes are built 1 unit tall, sitting on y = 0, and scaled to size.
function unitBox(w, d, segments = 1, radius = 0) {
  const g = radius > 0 ? new RoundedBoxGeometry(w, 1, d, 2, radius) : new THREE.BoxGeometry(w, 1, d, segments, segments, segments);
  g.translate(0, 0.5, 0);
  return g;
}
// Push a shape's surface in and out a little with noise: rough hewn stone or weathered wood.
function roughen(geometry, amount, scale, seed) {
  const pos = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = noise2(v.x * scale + v.y * 0.7 * scale + seed, v.z * scale - v.y * 0.4 * scale, 17) - 0.5;
    pos.setXYZ(i, v.x * (1 + n * amount), v.y, v.z * (1 + n * amount));
  }
  geometry.computeVertexNormals();
  return geometry;
}

// Places the group on the map, facing the camera spot, and gives a helper for the ground height
// at a point in the group's own coordinates.
function placeGroup(def) {
  const [x, z] = def.screen;
  const group = new THREE.Group();
  group.name = `landmark-${def.id}`;
  group.position.set(x, groundHeight(x, z), z);
  group.rotation.y = Math.atan2(def.view[0] - x, def.view[1] - z);   // +z faces the camera spot
  group.updateMatrixWorld(true);
  const tmp = new THREE.Vector3();
  const localGround = (lx, lz) => {
    tmp.set(lx, 0, lz);
    group.localToWorld(tmp);
    return groundHeight(tmp.x, tmp.z) - group.position.y;
  };
  // The lowest ground under a rectangle (for walls and footings that must reach the slope).
  const lowestUnder = (x0, x1, z0, z1) => {
    let low = Infinity;
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) low = Math.min(low, localGround(x0 + (x1 - x0) * i / 4, z0 + (z1 - z0) * j / 4));
    return low;
  };
  return { group, localGround, lowestUnder };
}

// The lantern every landmark keeps (so visitors know it's a project), with its warm halo.
function addLantern(group, localGround, lx, lz, { lift = 0, scale = 1 } = {}) {
  const lantern = buildLantern();
  lantern.scale.setScalar(scale);
  const y = (lift ? lift : localGround(lx, lz) - 0.01);
  lantern.position.set(lx, y, lz);
  group.add(lantern);
  const anchor = new THREE.Vector3(lx, y + 0.33 * scale, lz);
  const halo = makeHalo(L.lanternHalo, 1.3, 0.45);
  halo.position.copy(anchor);
  group.add(halo);
  return { anchor, halo };
}

// A soft warm glow lying on the grass (cheaper and softer than a real light on its own).
function groundGlow(group, localGround, lx, lz, w, d, color) {
  const mat = new THREE.MeshBasicMaterial({
    map: getGlowTexture(), color, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(lx, localGround(lx, lz) + 0.05, lz);
  group.add(glow);
  return mat;
}

// What every landmark hands back (see the top of this file).
function finish(scene, group, { video, corners, caption, centre, front, anchors, levels, update, setHover }) {
  scene.add(group);
  group.updateMatrixWorld(true);
  const toWorld = (v) => group.localToWorld(v.clone());
  return {
    group,
    update,
    setHover,
    levels,
    corners: corners.map(toWorld),
    captionPoint: toWorld(caption),
    centre: toWorld(centre),
    front: toWorld(front),
    anchors: { spill: toWorld(anchors.spill), tent: toWorld(anchors.tent), lantern: toWorld(anchors.lantern) },
    get videoElement() { return video.element; },
  };
}

// =====================================================================
// TRINETRA: a weathered trail signboard at a fork in the path
// =====================================================================
function buildSign(scene, def, renderer) {
  const { group, localGround } = placeGroup(def);
  const rand = seededRandom(51);
  const video = videoSource(def.video, renderer);
  const wood = mood.wood;

  // Sizes. The film fills the middle of the board, framed by carved edges.
  const vidW = 4.2, vidH = vidW / VIDEO_ASPECT;
  const boardW = vidW + 0.6, boardH = vidH + 0.55;
  const postX = boardW / 2 + 0.22;
  const hingeY = Math.max(localGround(-postX, 0), localGround(postX, 0)) + 3.35;   // where the board hangs from
  const boardCentreY = hingeY - 0.18 - boardH / 2;

  // Two sturdy posts, each sunk half a metre into the ground under it.
  for (const side of [-1, 1]) {
    const gy = localGround(side * postX, 0);
    const h = hingeY + 0.35 - (gy - 0.5);
    const post = painted(roughen(unitBox(0.22, 0.22, 4, 0.04), 0.08, 3, side * 7), wood, { tint: 0.92 });
    post.position.set(side * postX, gy - 0.5, 0);
    post.scale.set(1, h, 1);
    post.rotation.y = rand() * 0.2;
    group.add(post);
    // A rounded cap on top of each post.
    const cap = painted(new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), wood, { tint: 0.8 });
    cap.position.set(side * postX, hingeY + 0.35, 0);
    group.add(cap);
  }
  // The crossbeam the board hangs from.
  const beam = painted(unitBox(postX * 2 + 0.5, 0.2, 1, 0.03), wood, { tint: 0.85 });
  beam.position.set(0, hingeY, 0);
  beam.scale.y = 0.18;
  group.add(beam);

  // The board, hung from the beam by two short ropes: it swings from this pivot.
  const pivot = new THREE.Group();
  pivot.position.set(0, hingeY, 0.04);
  group.add(pivot);
  const board = painted(roughen(unitBox(boardW, 0.1, 8, 0.03), 0.015, 1.2, 3), wood, { tint: 1.0 });
  board.position.set(0, boardCentreY - hingeY - boardH / 2, 0);
  board.scale.y = boardH;
  pivot.add(board);
  // Carved edges: a raised, darker frame around the picture.
  const frameT = 0.13;
  const frameParts = [
    [0, vidH / 2 + frameT / 2, vidW + frameT * 2, frameT],
    [0, -vidH / 2 - frameT / 2, vidW + frameT * 2, frameT],
    [-vidW / 2 - frameT / 2, 0, frameT, vidH],
    [vidW / 2 + frameT / 2, 0, frameT, vidH],
  ];
  for (const [fx, fy, fw, fh] of frameParts) {
    const f = painted(unitBox(fw, 0.06, 1, 0.02), wood, { tint: 0.72 });
    f.position.set(fx, boardCentreY - hingeY + fy - fh / 2, 0.07);
    f.scale.y = fh;
    pivot.add(f);
  }
  // Two ropes from the beam to the board.
  const ropeMat = new THREE.LineBasicMaterial({ color: MATERIALS.camp.rope, transparent: true, opacity: 0.7 });
  pivot.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-boardW / 2 + 0.3, 0, 0), new THREE.Vector3(-boardW / 2 + 0.3, boardCentreY - hingeY + boardH / 2, 0),
    new THREE.Vector3(boardW / 2 - 0.3, 0, 0), new THREE.Vector3(boardW / 2 - 0.3, boardCentreY - hingeY + boardH / 2, 0),
  ]), ropeMat));

  // The picture.
  const screenMat = makeScreenMaterial(video.uniform, { off: new THREE.Color(MATERIALS.camp.canvas) });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(vidW, vidH), screenMat);
  screen.position.set(0, boardCentreY - hingeY, 0.111);
  pivot.add(screen);

  // Small arrow signs on the posts, pointing other ways along the fork.
  const arrowShape = (len) => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.11); s.lineTo(len - 0.18, -0.11); s.lineTo(len, 0); s.lineTo(len - 0.18, 0.11); s.lineTo(0, 0.11); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1 });
    g.translate(0, 0.5, 0);   // (the painted shader shades by height: keep it in 0..1)
    return g;
  };
  for (const [side, y, turn, len] of [[-1, 0.55, Math.PI + 0.35, 1.1], [-1, 0.9, Math.PI - 0.5, 0.9], [1, 0.75, -0.3, 1.0]]) {
    const gy = localGround(side * postX, 0);
    const arrow = painted(arrowShape(len), wood, { tint: 0.95 });
    arrow.position.set(side * postX, gy + 1.15 + y - 0.5, 0);
    arrow.rotation.y = turn;
    group.add(arrow);
  }

  // The lantern hangs from a hook on the right post.
  const lx = postX + 0.25;
  const lantern = addLantern(group, localGround, lx, 0.15, { lift: localGround(postX, 0) + 1.55 });
  // A few stones at the posts' feet and a little side path forking away through the grass.
  const stones = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const w = group.localToWorld(new THREE.Vector3(side * (postX + (rand() - 0.5) * 0.8), 0, (rand() - 0.5) * 0.8));
      stones.push({ x: w.x, z: w.z, s: 0.18 + rand() * 0.22 });
    }
  }
  createStoneVariety(scene, stones, rand);
  group.add(sidePath(group, localGround));

  // Light: the board's glow spills onto the grass in front; the lantern is the warm note.
  const glowMat = groundGlow(group, localGround, 0, 1.6, 6, 3.4, L.projectorGlow);
  const levels = { spill: 0, tent: 0, lantern: 6 };
  let on = 0, hover = 0, hoverTarget = 0, swing = 0, swingV = 0;

  function update(dt, camera, near, wanted, time) {
    video.update(near, wanted, on);
    on += ((video.ready && near > 0.25 ? 1 : 0) - on) * (1 - Math.exp(-dt * 1.6));
    hover += (hoverTarget - hover) * (1 - Math.exp(-dt * 6));
    screenMat.uniforms.uOn.value = on;
    screenMat.uniforms.uHover.value = hover;
    glowMat.opacity = on * (0.14 + hover * 0.05);
    // The board swings on its ropes: a gentle push on hover, then a slow, damped settle.
    // (A tiny breeze keeps it from ever being perfectly frozen.)
    const target = hover * 0.07 + Math.sin(time * 0.6) * 0.006;
    swingV += ((target - swing) * 7 - swingV * 1.6) * dt;
    swing += swingV * dt;
    pivot.rotation.x = -swing;
    const flicker = 1 + Math.sin(time * 7.7 + 3) * 0.03 + Math.sin(time * 12.3) * 0.02;
    lantern.halo.material.opacity = 0.45 * flicker;
    levels.spill = on * 4.5;
    levels.lantern = 6 * flicker;
  }

  const sy = boardCentreY;
  return finish(scene, group, {
    video,
    corners: [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([cx, cy]) => new THREE.Vector3(cx * vidW / 2, sy + cy * vidH / 2, 0.12)),
    caption: new THREE.Vector3(0, sy - boardH / 2 - 0.12, 0.2),
    centre: new THREE.Vector3(0, sy, 0.1),
    front: new THREE.Vector3(0, sy + 0.05, 3.0),
    anchors: { spill: new THREE.Vector3(0, 1.1, 1.6), tent: lantern.anchor.clone(), lantern: lantern.anchor },
    levels,
    update,
    setHover: (v) => { hoverTarget = v ? 1 : 0; },
  });
}

// A faint side path forking off the main trail behind the signboard and fading into the grass.
function sidePath(group, localGround) {
  const curve = new THREE.CatmullRomCurve3([[-3.4, 1.6], [-4.6, -0.6], [-5.2, -3.4], [-4.8, -6.6], [-3.6, -9.6]].map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const steps = 60, across = [-1, -0.5, 0, 0.5, 1], alpha = [0, 0.7, 0.85, 0.7, 0];
  const positions = [], colors = [], indices = [];
  const p = new THREE.Vector3(), t = new THREE.Vector3();
  const col = new THREE.Color(MATERIALS.ground.path);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    curve.getPointAt(u, p);
    curve.getTangentAt(u, t);
    const w = 0.55 * (1 - u * 0.4);
    across.forEach((a, k) => {
      const x = p.x - t.z * a * w, z = p.z + t.x * a * w;
      positions.push(x, localGround(x, z) + 0.03, z);
      colors.push(col.r, col.g, col.b, alpha[k] * smoothstep(0, 0.1, u) * (1 - smoothstep(0.55, 1, u)) * 0.8);
    });
    if (i < steps) {
      const a = i * 5, b = (i + 1) * 5;
      for (let k = 0; k < 4; k++) indices.push(a + k, b + k, a + k + 1, a + k + 1, b + k, b + k + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  mat.color = mood.ground;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  return mesh;
}

// Many small painted blocks in one instanced mesh: the stones of a dry-stone wall, the slates of
// a roof. blocks: [{ position, rotationY, rotationX, scale: [x, y, z], tint }].
function blockMesh(blocks, colors, { radius = 0.12, roundness = 0.3 } = {}) {
  const geo = new RoundedBoxGeometry(1, 1, 1, 2, radius);
  geo.translate(0, 0.5, 0);
  geo.setAttribute('aTrunk', new THREE.Float32BufferAttribute(new Array(geo.attributes.position.count).fill(0), 1));
  const mesh = new THREE.InstancedMesh(geo, makePaintedMaterial({ colors, wind: false, roundness, rim: 0.5 }), blocks.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  blocks.forEach((b, i) => {
    q.setFromEuler(e.set(b.rotationX ?? 0, b.rotationY ?? 0, 0));
    m.compose(b.position, q, new THREE.Vector3(...b.scale));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.setScalar(b.tint ?? 1));
  });
  mesh.computeBoundingSphere();
  return mesh;
}

// The stones of a dry-stone wall face, laid in courses (rows), each course offset from the one
// below, skipping the openings. face: { origin, along (unit vector), normal (unit vector),
// length, bottom, top, holes: [[a0, a1, y0, y1]] } in the hut's own coordinates.
function courses(face, rand) {
  const blocks = [];
  const courseH = 0.3;
  const yaw = Math.atan2(-face.along.z, face.along.x);   // turns a block's x axis along the wall
  for (let y = face.bottom, row = 0; y < face.top - 0.08; y += courseH, row++) {
    const h = Math.min(courseH, face.top - y);
    let a = row % 2 ? -rand() * 0.35 : 0;
    while (a < face.length) {
      const len = 0.38 + rand() * 0.42;
      const mid = Math.min(a + len / 2, face.length);
      const inHole = face.holes.some(([a0, a1, y0, y1]) => mid > a0 && mid < a1 && y + h / 2 > y0 && y + h / 2 < y1);
      if (!inHole && mid > 0.05) {
        const pos = face.origin.clone().addScaledVector(face.along, mid).addScaledVector(face.normal, 0.025 + rand() * 0.03);
        pos.y = y + 0.012;
        blocks.push({ position: pos, rotationY: yaw, scale: [len - 0.035, h - 0.035, 0.16], tint: 0.8 + rand() * 0.32 });
      }
      a += len;
    }
  }
  return blocks;
}

// =====================================================================
// THE KING'S GARDEN: a stone shepherd's hut
// =====================================================================
function buildHut(scene, def, renderer) {
  const { group, localGround, lowestUnder } = placeGroup(def);
  const rand = seededRandom(77);
  const video = videoSource(def.video, renderer);
  const stone = mood.stones, wood = mood.wood;

  // Layout (the hut's own coordinates): x along the front wall, the front wall's face at z = 0,
  // the hut extending back to z = -D. The window holds the film; the door is to its left.
  const W = 5.6, D = 4.2, T = 0.42;              // width, depth, wall thickness
  const winW = 3.1, winH = winW / VIDEO_ASPECT;   // the window = the film's shape
  const winX = 0.7, sill = 0.62;                 // window centre (x) and its bottom edge (height)
  const doorX = -2.0, doorW = 0.95, doorH = 1.85;
  const g0 = localGround(0, 0.2);                // the ground at the foot of the front wall
  const eave = g0 + 2.45;                         // the top of the walls
  const ridge = eave + 1.45;                      // the roof's ridge
  const winY = g0 + sill;

  // Stone walls, built as rough blocks reaching down below the lowest ground under each one.
  // (bottom: where the wall starts; by default, sunk below the lowest ground under it)
  const wall = (x0, x1, z0, z1, top, bottom) => {
    const low = bottom ?? lowestUnder(x0, x1, z0, z1) - 0.35;
    const m = painted(roughen(unitBox(x1 - x0, z1 - z0, 6, 0.05), 0.05, 2.2, x0 + z0), stone, { tint: 0.95 + rand() * 0.1, roundness: 0.15 });
    m.position.set((x0 + x1) / 2, low, (z0 + z1) / 2);
    m.scale.y = top - low;
    group.add(m);
  };
  const front = [-T, 0];
  wall(-W / 2, doorX - doorW / 2, ...front, eave);                         // left pier
  wall(doorX + doorW / 2, winX - winW / 2, ...front, eave);                // between door and window
  wall(winX + winW / 2, W / 2, ...front, eave);                            // right pier
  wall(doorX - doorW / 2, doorX + doorW / 2, ...front, eave, g0 + doorH);  // above the door
  wall(winX - winW / 2, winX + winW / 2, ...front, winY);                  // below the window
  wall(-W / 2, W / 2, -D, -D + T, eave);                                    // back wall
  wall(-W / 2, -W / 2 + T, -D + T, -T, eave);                               // side walls
  wall(W / 2 - T, W / 2, -D + T, -T, eave);
  // Above the window: a heavy wooden lintel.
  const lintel = painted(unitBox(winW + 0.5, T + 0.06, 1, 0.03), wood, { tint: 0.8 });
  lintel.position.set(winX, winY + winH, -T / 2);
  lintel.scale.y = eave - (winY + winH);
  group.add(lintel);
  // The gable ends: triangles of stone under the roof.
  for (const side of [-1, 1]) {
    const s = new THREE.Shape();
    s.moveTo(-D / 2 - 0.02, 0); s.lineTo(D / 2 + 0.02, 0); s.lineTo(0, ridge - eave); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false });
    g.scale(1, 1 / (ridge - eave), 1);
    const m = painted(g, stone, { tint: 0.95, roundness: 0.1 });
    m.rotation.y = Math.PI / 2;
    m.position.set(side * W / 2 - (side > 0 ? T : 0), eave, -D / 2);
    m.scale.set(1, ridge - eave, 1);
    group.add(m);
  }

  // The slate roof: two thick slabs meeting at the ridge, with a little overhang, and a ridge cap.
  const pitch = Math.atan2(ridge - eave, D / 2 + 0.3);
  const slabLen = Math.hypot(ridge - eave, D / 2 + 0.3) + 0.25;
  // Each slab hangs from the ridge and is tilted down by the roof's pitch: towards the front
  // (side 1, +z) or the back (side -1).
  for (const side of [1, -1]) {
    const holder = new THREE.Group();
    holder.position.set(0, ridge + 0.04, -D / 2);
    holder.rotation.x = side * pitch;
    const slab = painted(roughen(unitBox(W + 0.7, slabLen, 10, 0.02), 0.012, 4, side * 3), stone, { tint: [0.62, 0.66, 0.82], roundness: 0.1 });
    slab.position.set(0, -0.16, side * slabLen / 2);
    slab.scale.y = 0.16;
    holder.add(slab);
    group.add(holder);
  }
  const cap = painted(new THREE.CylinderGeometry(0.12, 0.12, W + 0.75, 10, 1).rotateZ(Math.PI / 2).translate(0, 0.5, 0), stone, { tint: [0.55, 0.58, 0.72] });
  cap.position.set(0, ridge - 0.42, -D / 2);
  group.add(cap);
  // A stone chimney on the back slope.
  const chimney = painted(roughen(unitBox(0.6, 0.6, 3, 0.04), 0.06, 3, 9), stone, { tint: 0.9 });
  chimney.position.set(W / 2 - 1.1, eave + 0.3, -D + 1.1);
  chimney.scale.y = ridge - eave + 0.6;
  group.add(chimney);

  // The walls' faces, laid stone by stone (front and both sides: the faces the camera sees).
  const footLow = lowestUnder(-W / 2, W / 2, -D, 0) - 0.05;
  const faceStones = [
    courses({ origin: new THREE.Vector3(-W / 2, 0, 0.0), along: new THREE.Vector3(1, 0, 0), normal: new THREE.Vector3(0, 0, 1), length: W, bottom: footLow, top: eave,
      holes: [[doorX - doorW / 2 + W / 2 - 0.04, doorX + doorW / 2 + W / 2 + 0.04, -99, g0 + doorH + 0.04], [winX - winW / 2 + W / 2 - 0.16, winX + winW / 2 + W / 2 + 0.16, winY - 0.14, 99]] }, rand),
    courses({ origin: new THREE.Vector3(-W / 2, 0, 0), along: new THREE.Vector3(0, 0, -1), normal: new THREE.Vector3(-1, 0, 0), length: D, bottom: footLow, top: eave, holes: [] }, rand),
    courses({ origin: new THREE.Vector3(W / 2, 0, 0), along: new THREE.Vector3(0, 0, -1), normal: new THREE.Vector3(1, 0, 0), length: D, bottom: footLow, top: eave, holes: [] }, rand),
  ].flat();
  group.add(blockMesh(faceStones, stone, { radius: 0.06 }));

  // Slates on both slopes of the roof, in overlapping rows from the eaves up to the ridge.
  for (const side of [1, -1]) {
    const slates = [];
    for (let row = 0, d = slabLen - 0.05; d > 0.1; row++, d -= 0.24) {
      for (let a = -(W + 0.7) / 2 + (row % 2) * 0.2; a < (W + 0.7) / 2 - 0.1; a += 0.42) {
        slates.push({ position: new THREE.Vector3(a + 0.21, -0.005 - (slabLen - d) * 0.0, side * d), rotationX: side * 0.07, scale: [0.39, 0.045, 0.34], tint: 0.82 + rand() * 0.3 });
      }
    }
    const holder = new THREE.Group();
    holder.position.set(0, ridge + 0.04, -D / 2);
    holder.rotation.x = side * pitch;
    holder.add(blockMesh(slates, stone, { radius: 0.015, roundness: 0.15 }));
    holder.children[0].material.uniforms.uRimAmount.value = 0.3;
    holder.children[0].instanceColor.array.forEach((v, i, arr) => { arr[i] = v * (i % 3 === 2 ? 0.95 : 0.7); });
    group.add(holder);
  }

  // The window: the film itself, set in a deep wooden frame with a sill.
  const screenMat = makeScreenMaterial(video.uniform, { off: new THREE.Color(L.tentFabric).multiplyScalar(0.35), edge: 0.008 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), screenMat);
  screen.position.set(winX, winY + winH / 2, -T * 0.55);
  group.add(screen);
  for (const [fx, fy, fw, fh] of [
    [winX, winY - 0.05, winW + 0.24, 0.1], [winX, winY + winH + 0.05, winW + 0.24, 0.1],
    [winX - winW / 2 - 0.06, winY + winH / 2, 0.12, winH], [winX + winW / 2 + 0.06, winY + winH / 2, 0.12, winH],
  ]) {
    const f = painted(unitBox(fw, T * 0.5, 1, 0.02), wood, { tint: 0.85 });
    f.position.set(fx, fy - fh / 2, -T * 0.32);
    f.scale.y = fh;
    group.add(f);
  }
  const sillBox = painted(unitBox(winW + 0.5, 0.36, 1, 0.03), stone, { tint: 0.85 });
  sillBox.position.set(winX, winY - 0.12, 0.08);
  sillBox.scale.y = 0.1;
  group.add(sillBox);

  // The door: planks on a hinge at its left edge. Behind it, the warm glow of the room.
  // (a dim warm wall, with the lamplight glowing brightest low in the middle of the doorway)
  const room = new THREE.Mesh(new THREE.PlaneGeometry(doorW, doorH), new THREE.MeshBasicMaterial({ color: new THREE.Color(L.tentFabric).multiplyScalar(0.45), fog: true }));
  room.position.set(doorX, g0 + doorH / 2, -T * 0.95);
  group.add(room);
  const lamp = new THREE.Mesh(new THREE.PlaneGeometry(doorW * 1.6, doorH * 1.1), new THREE.MeshBasicMaterial({ map: getGlowTexture(), color: L.tentLight, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
  lamp.position.set(doorX, g0 + doorH * 0.42, -T * 0.9);
  group.add(lamp);
  const hinge = new THREE.Group();
  hinge.position.set(doorX - doorW / 2 + 0.02, g0, -T * 0.25);
  group.add(hinge);
  const door = painted(roughen(unitBox(doorW - 0.04, 0.07, 4, 0.01), 0.02, 3, 4), wood, { tint: 0.9 });
  door.position.set(doorW / 2 - 0.02, 0, 0);
  door.scale.y = doorH - 0.02;
  hinge.add(door);
  // A wooden door frame: two posts and a lintel round the opening.
  for (const [fx, fw, fy, fh] of [[doorX - doorW / 2 - 0.05, 0.1, g0 - 0.1, doorH + 0.1], [doorX + doorW / 2 + 0.05, 0.1, g0 - 0.1, doorH + 0.1], [doorX, doorW + 0.2, g0 + doorH, 0.14]]) {
    const f = painted(unitBox(fw, T * 0.6, 1, 0.02), wood, { tint: 0.75 });
    f.position.set(fx, fy, -T * 0.2);
    f.scale.y = fh;
    group.add(f);
  }
  // Two iron straps across the planks.
  for (const sy of [0.35, 1.45]) {
    const strap = painted(unitBox(doorW - 0.1, 0.09, 1), mood.stones, { tint: 0.45 });
    strap.position.set(doorW / 2, sy, 0.01);
    strap.scale.y = 0.06;
    hinge.add(strap);
  }

  // Clay pots with plants by the door (the nursery, of course).
  for (const [px, pz, s] of [[doorX - 0.85, 0.55, 0.42], [doorX - 0.35, 0.85, 0.3], [doorX + 0.8, 0.6, 0.34], [W / 2 + 0.3, 0.4, 0.38]]) {
    const gy = localGround(px, pz);
    const pot = painted(new THREE.CylinderGeometry(0.5, 0.36, 1, 16).translate(0, 0.5, 0), wood, { tint: [1.25, 0.95, 0.82], roundness: 0.4 });
    pot.position.set(px, gy - 0.04, pz);
    pot.scale.set(s, s * 1.05, s);
    group.add(pot);
    for (let k = 0; k < 4; k++) {
      const leaf = painted(new THREE.SphereGeometry(0.5, 12, 8).translate(0, 0.5, 0), mood.trees, { tint: 0.95 + rand() * 0.2, roundness: 0.6 });
      const r = s * 0.55;
      leaf.position.set(px + (rand() - 0.5) * r, gy + s * 0.95 + rand() * s * 0.4, pz + (rand() - 0.5) * r);
      leaf.scale.setScalar(s * (0.8 + rand() * 0.5));
      group.add(leaf);
    }
  }

  // Stones gathered at the foot of the walls, and a flat stone step at the door.
  const stones = [];
  for (let i = 0; i < 16; i++) {
    const along = rand();
    const side = rand() < 0.5;
    const lx = side ? (rand() < 0.5 ? -1 : 1) * (W / 2 + 0.15) : -W / 2 + along * W;
    const lz = side ? -along * D : (rand() < 0.5 ? 0.25 : -D - 0.2);
    if (!side && lz > 0 && Math.abs(lx - doorX) < 0.8) continue;
    const w = group.localToWorld(new THREE.Vector3(lx, 0, lz));
    stones.push({ x: w.x, z: w.z, s: 0.2 + rand() * 0.35 });
  }
  const step = group.localToWorld(new THREE.Vector3(doorX, 0, 0.45));
  stones.push({ x: step.x, z: step.z, s: 0.55, shape: 1 });
  createStoneVariety(scene, stones, rand);

  // The lantern stands on the sill's end, by the window.
  const lantern = addLantern(group, localGround, winX + winW / 2 + 0.05, 0.12, { lift: winY - 0.02, scale: 0.9 });
  // Warm light from the room, spilling out of the door as it opens.
  const doorGlow = groundGlow(group, localGround, doorX + 0.2, 1.6, 2.6, 3.4, L.tentLight);
  const windowGlow = groundGlow(group, localGround, winX, 1.5, 5, 3, L.projectorGlow);
  const levels = { spill: 0, tent: 3, lantern: 5 };
  let on = 0, hover = 0, hoverTarget = 0, door01 = 0, doorV = 0;

  function update(dt, camera, near, wanted, time) {
    video.update(near, wanted, on);
    on += ((video.ready && near > 0.25 ? 1 : 0) - on) * (1 - Math.exp(-dt * 1.6));
    hover += (hoverTarget - hover) * (1 - Math.exp(-dt * 5));
    screenMat.uniforms.uOn.value = on;
    screenMat.uniforms.uHover.value = hover;
    // The door creaks open a little: a slow swing that overshoots a touch and settles.
    doorV += ((hover * 0.75 - door01) * 9 - doorV * 3.2) * dt;
    door01 += doorV * dt;
    hinge.rotation.y = door01 * 0.95;
    doorGlow.opacity = 0.05 + Math.max(door01, 0) * 0.3;
    windowGlow.opacity = on * 0.12;
    const flicker = 1 + Math.sin(time * 7.3 + 1) * 0.03 + Math.sin(time * 13.1) * 0.02;
    lantern.halo.material.opacity = 0.4 * flicker;
    levels.spill = on * 3.5;
    levels.tent = 3 + Math.max(door01, 0) * 16;
    levels.lantern = 5 * flicker;
  }

  const cy = winY + winH / 2;
  return finish(scene, group, {
    video,
    corners: [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([sx, sy]) => new THREE.Vector3(winX + sx * winW / 2, cy + sy * winH / 2, 0)),
    caption: new THREE.Vector3(winX, winY - 0.25, 0.4),
    centre: new THREE.Vector3(winX, cy, 0),
    front: new THREE.Vector3(winX, cy + 0.05, 2.8),
    anchors: { spill: new THREE.Vector3(winX, 1.2, 1.4), tent: new THREE.Vector3(doorX + 0.3, g0 + 1.0, 0.4), lantern: lantern.anchor },
    levels,
    update,
    setHover: (v) => { hoverTarget = v ? 1 : 0; },
  });
}

// =====================================================================
// DERMAÉ: a still mountain lake
// =====================================================================
function buildLake(scene, def, renderer) {
  const [x, z] = def.screen;
  const group = new THREE.Group();
  group.name = `landmark-${def.id}`;
  group.position.set(x, LAKE_LEVEL, z);
  group.rotation.y = Math.atan2(def.view[0] - x, def.view[1] - z);   // +z: towards the camera spot
  group.updateMatrixWorld(true);
  const localGround = (lx, lz) => {
    const w = group.localToWorld(new THREE.Vector3(lx, 0, lz));
    return groundHeight(w.x, w.z) - LAKE_LEVEL;
  };
  const rand = seededRandom(19);
  const video = videoSource(def.video, renderer);
  const R = def.radius;
  // The film lies on the water as a reflection: wide side along the shore facing the camera,
  // its top towards the far bank (so it reads upright from the camera spot).
  const vidW = R * 1.32, vidH = vidW / VIDEO_ASPECT;

  const uniforms = {
    uVideo: video.uniform,
    uOn: { value: 0 },
    uHover: { value: 0 },
    uStill: { value: 0 },             // 1 = perfectly still, mirror-clear
    uTime: { value: 0 },
    uDrop: { value: new THREE.Vector3(0, 0, -100) },   // x, z of the drop, and when it landed
    uVid: { value: new THREE.Vector2(vidW, vidH) },
    uRadius: { value: R },
    uSkyTop: { value: mood.sky.mid },
    uSkyLow: { value: mood.sky.horizon },
    uDeep: { value: mood.mountains.layers[2] },
    uBank: { value: mood.trees.cardBottom },          // the far bank and its trees, reflected
    uHaze: { value: mood.fog.color },
    uStars: { value: 1 },
    uShore: { value: mood.stones.bottom },
    uMist: { value: mood.mist.air },
  };
  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
    vertexShader: /* glsl */ `
      #include <common>
      #include <fog_pars_vertex>
      varying vec2 vLocal;
      varying vec3 vWorld;
      void main() {
        // The circle is laid flat, so the water's own coordinates are x and z. Facing the camera
        // spot is +z; "away" (the far bank, the top of the film) is -z.
        vLocal = vec2(position.x, -position.z);
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <fog_pars_fragment>
      uniform sampler2D uVideo;
      uniform float uOn, uHover, uStill, uTime, uRadius, uStars;
      uniform vec3 uDrop, uSkyTop, uSkyLow, uDeep, uShore, uMist, uBank, uHaze;
      uniform vec2 uVid;
      varying vec2 vLocal;
      varying vec3 vWorld;
      ${NOISE_GLSL}
      void main() {
        // Local water coordinates: x across, y away from the camera (the far bank).
        vec2 p = vLocal;
        float r = length(p) / uRadius;
        // Ripples: a soft breeze ruffle that dies away as the water stills...
        vec2 wobble = vec2(vnoise(p * 1.7 + uTime * 0.25), vnoise(p * 1.7 - uTime * 0.21 + 7.0)) - 0.5;
        wobble *= 0.05 * (1.0 - uStill);
        // ...and the rings from a single falling drop, spreading and fading.
        float age = uTime - uDrop.z;
        float d = length(p - uDrop.xy);
        float ring = sin((d - age * 0.9) * 14.0) * exp(-d * 0.9) * exp(-age * 1.1) * step(0.0, age) * smoothstep(age * 0.9 + 0.3, age * 0.9 - 0.3, d);
        vec2 q = p + wobble + normalize(p - uDrop.xy + 1e-4) * ring * 0.035;

        // The water itself: the sky reflected, deeper towards the middle, paler at the edges.
        vec3 view = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - clamp(view.y, 0.0, 1.0), 3.0);
        // The sky in the water: brighter towards the far bank (where it reflects the horizon),
        // deeper near us, with faint long streaks like a breath of wind far out.
        // A still lake is a mirror of the sky: the open sky overhead near us, paling to the
        // horizon's glow towards the far bank, where the dark bank and its trees are mirrored
        // as a soft band along the shore.
        float farness = clamp(p.y / uRadius * 0.5 + 0.5, 0.0, 1.0);
        vec3 water = mix(mix(uSkyTop, uHaze, 0.45), uSkyLow, pow(farness, 1.4) * 0.75 + fres * 0.2);
        water = mix(water, uDeep, (1.0 - farness) * 0.35);
        float bank = smoothstep(0.6, 0.93, r) * smoothstep(0.25, 0.75, farness);
        bank *= 0.75 + 0.25 * vnoise(vec2(p.x * 1.3, 3.0));   // the bank's uneven skyline
        water = mix(water, uBank, bank * 0.7);
        // Long faint streaks where a breath of air touches the surface, gone when it stills.
        water *= 1.0 + (vnoise(vec2(p.x * 0.35, p.y * 4.0 + 11.0)) - 0.5) * 0.08 * (1.0 - uStill * 0.6);
        // A few reflected stars, fading as the dawn comes.
        vec2 cell = floor(p * 9.0);
        float star = step(0.985, hash12(cell)) * smoothstep(0.2, 0.0, length(fract(p * 9.0) - 0.5)) * uStars * (1.0 - bank);
        water += vec3(0.75, 0.8, 1.0) * star * 0.5;
        water = mix(water, uShore, smoothstep(0.78, 1.0, r) * 0.55);

        // The film, lying on the water like a reflection: clear when still.
        vec2 vuv = q / uVid + 0.5;
        // A reflection has no hard frame: the picture's edges dissolve softly into the water.
        float inside = smoothstep(0.0, 0.05, vuv.x) * smoothstep(1.0, 0.95, vuv.x) * smoothstep(0.0, 0.09, vuv.y) * smoothstep(1.0, 0.91, vuv.y);
        vec3 pic = texture2D(uVideo, clamp(vuv, 0.0, 1.0)).rgb;
        // Reflected light is a little darker and takes on the water's colour, like a real mirror lake.
        pic = mix(pic * 0.9, water, 0.08);
        vec3 col = mix(water, pic, inside * uOn * mix(0.75, 0.97, uStill));
        // Light glints on the ripple crests.
        col += uSkyLow * ring * 0.25;
        col *= 1.0 + uHover * 0.05 * uOn;
        // A thin pale line of mist where the water meets the shore.
        col = mix(col, uMist, smoothstep(0.9, 1.0, r) * 0.25);
        float alpha = 1.0 - smoothstep(0.95, 1.0, r);
        gl_FragColor = vec4(col + dither(gl_FragCoord.xy), alpha);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  Object.assign(waterMat.uniforms, uniforms);
  const water = new THREE.Mesh(new THREE.CircleGeometry(R + 0.4, 96).rotateX(-Math.PI / 2), waterMat);
  water.position.y = 0.0;
  water.renderOrder = 2;
  group.add(water);

  // Mist lying on the water, gathered round the edges (the middle stays clear for the film).
  const mist = new THREE.Mesh(
    new THREE.RingGeometry(R * 0.72, R * 1.25, 64, 1).rotateX(-Math.PI / 2),
    makeMistMaterial({ opacity: 0.5, scale: [6, 6], speed: 0.01, softness: [0.38, 0.66], nearFade: [3, 8], seed: 4.2 }),
  );
  mist.position.y = 0.35;
  group.add(mist);

  // Stones gathered where a real lake collects them: a cluster of boulders on the far bank, a few
  // half-sunk at the water's edge on one side, small pebbles here and there. Not an even ring.
  const stones = [];
  const at = (angle, rr, s, shape) => {
    const w = group.localToWorld(new THREE.Vector3(Math.sin(angle) * rr, 0, Math.cos(angle) * rr));
    // Sunk well into the bank, so they sit in it rather than on it.
    stones.push({ x: w.x, z: w.z, y: groundHeight(w.x, w.z) - s * 0.2, s, shape });
  };
  at(Math.PI + 0.5, R + 0.6, 0.95, 0); at(Math.PI + 0.75, R + 0.2, 0.5, 3); at(Math.PI + 0.3, R + 1.3, 0.6, 1);
  at(Math.PI - 0.9, R - 0.1, 0.4, 1); at(Math.PI - 1.05, R + 0.5, 0.28, 0);
  at(1.9, R + 0.1, 0.32, 3); at(2.1, R + 0.7, 0.22, 0);
  for (let i = 0; i < 6; i++) at(rand() * Math.PI * 2, R + 0.4 + rand() * 1.5, 0.12 + rand() * 0.12);
  createStoneVariety(scene, stones, rand);
  const lanternSpot = group.localToWorld(new THREE.Vector3(-R * 0.62, 0, R * 0.92));
  const lanternStone = { x: lanternSpot.x, z: lanternSpot.z, s: 0.55, shape: 1 };
  createStoneVariety(scene, [lanternStone], rand);
  const lantern = addLantern(group, localGround, R * 0.86, R * 0.62, { lift: localGround(R * 0.86, R * 0.62) + 0.22 });
  // Grass and a few pale flowers round the shore, thicker on the far bank.
  createGrassPatch(scene, { centre: def.screen, inner: R + 0.15, outer: R + 6, count: 1400, colors: RIDGE_GRASS, flowers: 140, seed: 8 });

  // The falling drop (a small bright bead) for the hover.
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: L.projector, transparent: true, opacity: 0 }));
  group.add(bead);

  const levels = { spill: 0, tent: 3, lantern: 6 };
  let on = 0, still = 0, hover = 0, hoverTarget = 0, dropT = -100, lastHover = 0;
  const camPrev = new THREE.Vector3();

  function update(dt, camera, near, wanted, time) {
    video.update(near, wanted, on);
    on += ((video.ready && near > 0.25 ? 1 : 0) - on) * (1 - Math.exp(-dt * 1.6));
    hover += (hoverTarget - hover) * (1 - Math.exp(-dt * 6));
    // The surface stills once we've arrived and the camera has (almost) stopped moving.
    const camSpeed = camera.position.distanceTo(camPrev) / Math.max(dt, 1e-3);
    camPrev.copy(camera.position);
    const settled = near > 0.9 && camSpeed < 0.6 ? 1 : 0;
    still += (settled - still) * (1 - Math.exp(-dt * (settled ? 0.9 : 3)));
    // Hover: one drop falls, lands in front of the picture and rings out, then the water settles.
    if (hoverTarget && !lastHover && time - dropT > 2.5) dropT = time + 0.45;
    lastHover = hoverTarget;
    const fall = 1 - Math.min(Math.max((dropT - time) / 0.45, 0), 1);
    bead.material.opacity = time < dropT ? 0.9 : 0;
    bead.position.set(-vidW * 0.18, 1.6 * (1 - fall * fall), vidH * 0.1);
    uniforms.uDrop.value.set(-vidW * 0.18, -vidH * 0.1, dropT);
    uniforms.uOn.value = on;
    uniforms.uStill.value = still;
    uniforms.uHover.value = hover;
    uniforms.uTime.value = time;
    uniforms.uStars.value = mood.sky.stars;
    const flicker = 1 + Math.sin(time * 7.1 + 5) * 0.03 + Math.sin(time * 12.9) * 0.02;
    lantern.halo.material.opacity = 0.45 * flicker;
    levels.spill = on * 2;
    levels.lantern = 6 * flicker;
  }

  return finish(scene, group, {
    video,
    // The film's corners on the water (far edge first), in the lake's own coordinates.
    corners: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => new THREE.Vector3(sx * vidW / 2, 0, sz * vidH / 2)),
    caption: new THREE.Vector3(0, 0.05, vidH / 2 + 0.35),
    centre: new THREE.Vector3(0, 0, 0),
    front: new THREE.Vector3(0, 4.2, 2.6),
    anchors: { spill: new THREE.Vector3(0, 1.2, 0), tent: lantern.anchor.clone(), lantern: lantern.anchor },
    levels,
    update,
    setHover: (v) => { hoverTarget = v ? 1 : 0; },
  });
}

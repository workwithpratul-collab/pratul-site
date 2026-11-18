// trekker.js: my anime-style character (a VRM model) who walks the trail.
//
// VRM is a 3D-avatar format (VRoid Studio exports it). The three-vrm library loads it and
// gives every model the same set of "normalized" bones (hips, leftUpperArm, ...), so a pose
// or animation written once works on any VRM character.
//
// Two ways to animate:
//  1. Mixamo animations (Walking / Idle / Waving FBX files in assets/animations/), retargeted
//     onto the VRM. Used automatically once the files exist.
//  2. A built-in stand-in: relaxed arms, gentle breathing and a simple procedural walk.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { groundHeight } from './terrain.js';
import { PRESETS, MATERIALS } from './palette.js';

const MODEL_URL = 'assets/pratul-trekker.vrm';
const ANIMATION_URLS = {
  walk: 'assets/animations/Walking.fbx',
  idle: 'assets/animations/Idle.fbx',
  wave: 'assets/animations/Waving.fbx',
  // A light jog, for catching up when the visitor scrolls fast (blended in from the walk).
  jog: 'assets/animations/Jogging.fbx',
  // The moments of the climb (Phase 6): sitting at the gear check, pointing at a landmark,
  // looking around while watching it, stretching at the summit, and stepping round on the spot.
  sit: 'assets/animations/Sitting.fbx',
  sitToStand: 'assets/animations/SitToStand.fbx',
  point: 'assets/animations/Pointing.fbx',
  look: 'assets/animations/LookAround.fbx',
  stretch: 'assets/animations/Stretch.fbx',
  turnLeft: 'assets/animations/TurnLeft.fbx',
  turnRight: 'assets/animations/TurnRight.fbx',
};
// Clips that play once (the rest loop).
const ONE_SHOTS = ['wave', 'point', 'stretch', 'sitToStand'];
// For the turning clips we keep only the stepping legs: the film turns him itself, so the clip's
// own turn of the hips is dropped (otherwise he would turn twice as far).
const DROP_HIP_TURN = ['turnLeft', 'turnRight'];
// The bigger wave: which arm waves in the Waving clip, and how much higher it is lifted (radians).
// Sitting down and standing up use SitToStand.fbx: he's fully up by 4.4 s into it (the rest is
// standing still), and it plays a little faster than recorded, so it takes about 3 seconds.
// Getting up again starts 0.6 s in (he's already shifting his weight) and plays twice as fast:
// the visitor wants to move on, so it takes under two seconds.
const SIT_UP_END = 4.4;
const SIT_SPEED = 1.4;
const SIT_UP_START = 0.6;
const STAND_SPEED = 2.0;
const WAVE_ARM = 'rightUpperArm';
const WAVE_LIFT = 1.0;    // (positive for this VRM 0.x model, which faces the other way)
const STRIDE = 0.72;           // metres per step, used to keep feet and ground in sync
// The ground speed each Mixamo clip naturally covers (metres per second), measured from how
// fast a planted foot moves back under the hips. Each clip is played faster or slower so his
// feet always match the ground.
// (Measured from the clips: tools in the Phase 4 notes.)
const MIXAMO_WALK_SPEED = 1.6;
const MIXAMO_JOG_SPEED = 1.75;
// The Jogging clip holds three strides; we play one stride's worth, looping.
const JOG_STRIDES = 3;
// Between these speeds the walk hands over to the jog (and back again as he slows down).
const JOG_FROM = 2.4, JOG_TO = 3.6;
// The jog's left foot is forward a touch later in its stride than the walk's (0.24 vs 0.22).
const JOG_PHASE = 0.02;
// The fastest his legs will go: about 2.6x the jog's own pace (roughly 4.5 m/s). Faster than
// that only happens for a moment while catching up after a hard flick.
const MAX_CADENCE = 2.6;
// How bright the character's colours are at night, and the cool moonlight tint (palette.js).
const NIGHT_LEVEL = PRESETS.night.character.level;
const NIGHT_TINT = new THREE.Color(PRESETS.night.character.tint);

export function createTrekker(scene, renderer, camera) {
  // `root` is what we move around the world; the VRM sits inside it.
  const root = new THREE.Group();
  root.name = 'trekker';
  root.visible = false;        // hidden until the model has loaded
  scene.add(root);

  // A soft dark shadow under the feet, so the character feels grounded.
  const shadow = makeBlobShadow();
  scene.add(shadow);

  const state = {
    vrm: null,
    mixer: null,
    actions: null,       // Mixamo actions, if the files exist
    walkAmount: 0,       // 0 = standing, 1 = walking (smoothly blended)
    speed: 0,            // metres per second, measured from movement
    phase: 0,            // where we are in the walk cycle
    blinkTimer: 2,
    waved: false,
    stride: 0,           // walk / jog cycle position, 0..1 (shared by both, so they stay in step)
    // The "moment" layer on top of walking and idling (see updateMoments):
    shot: null,          // the one-shot clip playing now ('point', 'stretch', 'wave'), if any
    loop: null,          // a looping pose to hold while standing ('look'), if any
    sitPhase: 'stand',   // 'stand' -> 'down' -> 'sit' -> 'up' -> 'stand'
    sitWanted: false,
    weights: {},         // the smoothed weight of every moment clip
    turnRate: 0,         // how fast he's turning on the spot (radians per second, smoothed)
    lastHeading: null,
    lookTarget: null,    // a point to turn his head towards (or null)
    look: { yaw: 0, pitch: 0 },
    sink: 0,             // how far the hips drop to reach the lower foot on a slope
  };

  // ---------- Load the VRM ----------
  const ready = (async () => {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    const gltf = await loader.loadAsync(MODEL_URL);
    const vrm = gltf.userData.vrm;

    // Clean-ups recommended by three-vrm: drop unused data, merge skeletons (faster).
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    // Skinned meshes can be wrongly hidden by "frustum culling" when they animate; turn it off.
    vrm.scene.traverse((obj) => { obj.frustumCulled = false; });

    tuneMaterialsForNight(vrm);
    setLightLevel(NIGHT_LEVEL, NIGHT_TINT);
    root.add(vrm.scene);
    state.vrm = vrm;

    applyStandInPose(vrm, 0, 0, 0);
    vrm.update(0);
    root.visible = true;
    // Build the character's shaders right away (while the curtain is down), not mid-scroll.
    if (renderer && camera) renderer.compile(scene, camera);

    // Try to load Mixamo animations in the background. Missing files are fine.
    loadMixamoClips(vrm).then((clips) => {
      if (!clips) return;
      state.mixer = new THREE.AnimationMixer(vrm.scene);
      state.actions = {};
      for (const [name, clip] of Object.entries(clips)) {
        const action = state.mixer.clipAction(clip);
        if (ONE_SHOTS.includes(name)) {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;   // hold the last pose; its weight fades it out
        }
        action.play();
        action.setEffectiveWeight(name === 'idle' ? 1 : 0);
        state.actions[name] = action;
      }
      console.info('[trekker] Mixamo animations loaded:', Object.keys(clips).join(', '));
    });
    return vrm;
  })();

  // ---------- Place the trekker: position on the ground and the direction to face ----------
  const lastPos = new THREE.Vector3();
  let hasLast = false;
  // y is optional: other scenes (the style frames) pass their own ground height.
  function place(x, z, heading, y = groundHeight(x, z)) {
    root.position.set(x, y, z);
    root.rotation.y = heading;            // VRM models face +Z; heading turns them
    shadow.position.set(x, y + 0.02, z);
  }
  let groundAt = groundHeight;           // style frames pass their own ground (see setGround)

  // ---------- update: called every frame ----------
  function update(dt, time) {
    // Measure how fast we actually moved, then smooth it (no jerky starts and stops).
    if (hasLast) {
      const moved = Math.hypot(root.position.x - lastPos.x, root.position.z - lastPos.z);
      const rawSpeed = dt > 0 ? moved / dt : 0;
      state.speed += (Math.min(rawSpeed, 60) - state.speed) * (1 - Math.exp(-dt * 6));
      state.phase += moved * (Math.PI / STRIDE); // one full leg cycle every two strides
    }
    lastPos.copy(root.position);
    hasLast = true;
    // How fast he's turning on the spot (for the stepping-round clips).
    if (state.lastHeading !== null && dt > 0) {
      let d = root.rotation.y - state.lastHeading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      state.turnRate += (d / dt - state.turnRate) * (1 - Math.exp(-dt * 5));
    }
    state.lastHeading = root.rotation.y;

    const targetWalk = THREE.MathUtils.clamp(state.speed / 0.6, 0, 1);
    state.walkAmount += (targetWalk - state.walkAmount) * (1 - Math.exp(-dt * 4));

    const vrm = state.vrm;
    if (!vrm) return;

    if (state.actions) {
      // Mixamo: blend between idle and walk, and match the walk speed to our real speed.
      const { walk, idle, wave, jog } = state.actions;
      // Walk or jog? Above a brisk walk he eases into the jog; slowing down, back into the walk.
      const jogMix = jog ? smoothstepJS(JOG_FROM, JOG_TO, state.speed) : 0;
      // Both clips share one stride rhythm ("phase", 0..1 per two steps), so their legs are always
      // in step with each other while they blend. The rhythm follows the real ground speed.
      if (walk) {
        const walkLen = walk.getClip().duration, jogLen = jog ? jog.getClip().duration / JOG_STRIDES : walkLen;
        // How far one full stride cycle carries him: walk and jog cycles, blended.
        const cycleMetres = MIXAMO_WALK_SPEED * walkLen * (1 - jogMix) + MIXAMO_JOG_SPEED * jogLen * jogMix;
        // At very high speeds the stride can't keep up any more (a sprint would look silly):
        // the rhythm is capped at MAX_CADENCE (a brisk run).
        const rate = Math.min(state.speed / cycleMetres, MAX_CADENCE / jogLen);
        state.stride = (state.stride + Math.max(rate, 0.6 / walkLen) * dt) % 1;
        walk.setEffectiveTimeScale(0);
        walk.time = state.stride * walkLen;
        walk.setEffectiveWeight(state.walkAmount * (1 - jogMix));
        if (jog) {
          jog.setEffectiveTimeScale(0);
          jog.time = ((state.stride + JOG_PHASE) % 1) * jogLen;
          jog.setEffectiveWeight(state.walkAmount * jogMix);
        }
      }
      updateMoments(dt);
      state.mixer.update(dt);
      afterClips(dt);
    } else {
      applyStandInPose(vrm, time, state.walkAmount, state.phase);
    }

    // Blink every few seconds (small detail, makes the character feel alive).
    state.blinkTimer -= dt;
    const blink = state.blinkTimer < 0.12 && state.blinkTimer > 0 ? Math.sin((state.blinkTimer / 0.12) * Math.PI) : 0;
    if (state.blinkTimer <= 0) state.blinkTimer = 2.5 + Math.random() * 3;
    vrm.expressionManager?.setValue('blink', blink);

    vrm.update(dt);  // applies the bones, springy hair/clothes, and expressions
  }

  // ---------- The moment layer ----------
  // Every moment clip has a weight that eases towards its target, so nothing ever snaps:
  // one-shots fade in over their first 15% and out over their last 15%, loops ease in and out,
  // and all of them only show while he's standing (they fade as soon as he walks).
  const MOMENTS = ['wave', 'point', 'stretch', 'look', 'sit', 'sitToStand', 'turnLeft', 'turnRight'];
  function updateMoments(dt) {
    const A = state.actions;
    const standing = 1 - state.walkAmount;
    const target = {};
    // A one-shot playing now.
    if (state.shot) {
      const act = A[state.shot];
      const t = act ? act.time / act.getClip().duration : 1;
      if (!act || t >= 0.999 || !act.isRunning()) state.shot = null;
      else target[state.shot] = smoothstepJS(0, 0.15, t) * (1 - smoothstepJS(0.85, 1, t));
    }
    // Sitting down, sitting, and standing up again (SitToStand played backwards, then forwards).
    const sts = A.sitToStand, sit = A.sit;
    if (sts && sit) {
      // (Getting up is decided by sitWanted alone: main.js keeps him still until he's up.)
      const want = state.sitWanted && (standing > 0.9 || state.sitPhase !== 'stand');
      // Only the part of the clip where he actually gets up is used (the rest is standing still).
      const len = Math.min(SIT_UP_END, sts.getClip().duration);
      if (state.sitPhase === 'stand' && want) {
        state.sitPhase = 'down';
        sts.reset();
        sts.setEffectiveTimeScale(-SIT_SPEED);
        sts.time = len;
        sts.play();
      } else if (state.sitPhase === 'down' && !want) {
        // Changed our mind halfway down: stand back up from where we are.
        const from = sts.time;
        state.sitPhase = 'up';
        sts.reset();
        sts.setEffectiveTimeScale(STAND_SPEED);
        sts.time = from;
        sts.play();
      } else if (state.sitPhase === 'down' && sts.time <= 0.02) {
        state.sitPhase = 'sit';
      } else if (state.sitPhase === 'sit' && !want) {
        state.sitPhase = 'up';
        sts.reset();
        sts.setEffectiveTimeScale(STAND_SPEED);
        sts.time = SIT_UP_START;
        sts.play();
      } else if (state.sitPhase === 'up' && sts.time >= len - 0.02) {
        state.sitPhase = 'stand';
      }
      if (state.sitPhase === 'down' || state.sitPhase === 'up') target.sitToStand = 1;
      if (state.sitPhase === 'sit') target.sit = 1;
    }
    // A looping pose (looking around), mixed with the idle.
    if (state.loop && state.sitPhase === 'stand') target[state.loop] = 0.6;
    // Turning on the spot: the stepping clip for the way he's turning.
    const turning = Math.min(Math.abs(state.turnRate) / 1.4, 1) * (state.sitPhase === 'stand' ? 1 : 0);
    if (turning > 0.05) target[state.turnRate > 0 ? 'turnLeft' : 'turnRight'] = turning * 0.85;

    let sum = 0;
    for (const name of MOMENTS) {
      if (!A[name]) continue;
      const before = state.weights[name] ?? 0;
      // Sitting transitions are quicker to take over (the clip carries the whole body).
      const rate = name === 'sitToStand' || name === 'sit' ? 9 : 6;
      const w = before + ((target[name] ?? 0) - before) * (1 - Math.exp(-dt * rate));
      state.weights[name] = w;
      const shown = w * standing;
      A[name].setEffectiveWeight(shown);
      sum += shown;
    }
    // The idle fills whatever the walk and the moments leave.
    A.idle?.setEffectiveWeight(Math.max(standing - sum, 0));
  }

  // ---------- Touches on top of the clips (before the VRM takes the pose) ----------
  const qa = new THREE.Quaternion();
  const axisX = new THREE.Vector3(1, 0, 0), axisY = new THREE.Vector3(0, 1, 0), axisZ = new THREE.Vector3(0, 0, 1);
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  let legLength = 0;
  function afterClips(dt) {
    const vrm = state.vrm;
    const bone = (n) => vrm.humanoid.getNormalizedBoneNode(n);
    const k = 1 - Math.exp(-dt * 4);

    // 1. A bigger, more open wave: lift the waving arm well above the head.
    const waveW = (state.weights.wave ?? 0) * (1 - state.walkAmount);
    // (premultiply: turn the arm round the shoulder's own forward axis, so it rises straight up
    // whatever pose the clip has it in)
    if (waveW > 0.001) bone(WAVE_ARM)?.quaternion.premultiply(qa.setFromAxisAngle(axisZ, WAVE_LIFT * waveW));

    // 2. The head turns towards whatever he's looking at (a hovered gear item, say).
    let yaw = 0, pitch = 0;
    if (state.lookTarget) {
      vrm.humanoid.getRawBoneNode('head').getWorldPosition(v1);
      v2.copy(state.lookTarget).sub(v1);
      yaw = Math.atan2(v2.x, v2.z) - root.rotation.y;
      yaw = THREE.MathUtils.clamp(Math.atan2(Math.sin(yaw), Math.cos(yaw)), -1.1, 1.1);
      pitch = THREE.MathUtils.clamp(-Math.atan2(v2.y, Math.hypot(v2.x, v2.z)), -0.4, 0.75);
    }
    state.look.yaw += (yaw - state.look.yaw) * k;
    state.look.pitch += (pitch - state.look.pitch) * k;
    if (Math.abs(state.look.yaw) + Math.abs(state.look.pitch) > 0.002) {
      bone('neck')?.quaternion.multiply(qa.setFromAxisAngle(axisY, state.look.yaw * 0.4)).multiply(qa.setFromAxisAngle(axisX, state.look.pitch * 0.4));
      bone('head')?.quaternion.multiply(qa.setFromAxisAngle(axisY, state.look.yaw * 0.6)).multiply(qa.setFromAxisAngle(axisX, state.look.pitch * 0.6));
    }

    // 3. Feet on the ground on slopes. The hips drop to whichever foot's ground is lower, then
    //    the other knee bends just enough to put that foot on its (higher) ground.
    //    (It uses where the feet were last frame: a frame's delay is invisible.)
    if (!legLength) {
      const h = vrm.humanoid.getRawBoneNode('leftUpperLeg').getWorldPosition(new THREE.Vector3());
      const kn = vrm.humanoid.getRawBoneNode('leftLowerLeg').getWorldPosition(new THREE.Vector3());
      legLength = h.distanceTo(kn);
    }
    if (state.sitPhase !== 'stand') {
      state.sink += (0 - state.sink) * k;
      vrm.scene.position.y = state.sink;
      return;
    }
    const ground0 = root.position.y;
    const feet = ['left', 'right'].map((side) => {
      vrm.humanoid.getRawBoneNode(side + 'Foot').getWorldPosition(v1);
      return { side, g: groundAt(v1.x, v1.z) - ground0 };
    });
    const low = Math.max(Math.min(feet[0].g, feet[1].g, 0), -0.35);
    state.sink += (low - state.sink) * (1 - Math.exp(-dt * 10));
    vrm.scene.position.y = state.sink;
    for (const f of feet) {
      const lift = THREE.MathUtils.clamp(f.g - state.sink, 0, 0.35);
      if (lift < 0.005) continue;
      const thigh = bone(f.side + 'UpperLeg'), shin = bone(f.side + 'LowerLeg');
      if (!thigh || !shin) continue;
      // Thigh and shin as two equal sides of a triangle: bending the knee shortens the leg.
      const bend0 = 2 * Math.acos(Math.min(Math.abs(shin.quaternion.w), 1));
      const reach = 2 * legLength * Math.cos(bend0 / 2) - lift;
      const bend1 = 2 * Math.acos(THREE.MathUtils.clamp(reach / (2 * legLength), 0.35, 1));
      const extra = Math.max(bend1 - bend0, 0);
      thigh.quaternion.multiply(qa.setFromAxisAngle(axisX, -extra / 2));
      shin.quaternion.multiply(qa.setFromAxisAngle(axisX, extra));
    }
    // ...and each foot tilts to the slope under it (toes up going uphill), so the toes never
    // dig into the ground and the heel never hangs in the air.
    const fx = Math.sin(root.rotation.y), fz = Math.cos(root.rotation.y);
    for (const f of feet) {
      const foot = bone(f.side + 'Foot');
      if (!foot) continue;
      vrm.humanoid.getRawBoneNode(f.side + 'Foot').getWorldPosition(v1);
      const slope = Math.atan2(groundAt(v1.x + fx * 0.15, v1.z + fz * 0.15) - groundAt(v1.x - fx * 0.1, v1.z - fz * 0.1), 0.25);
      foot.quaternion.multiply(qa.setFromAxisAngle(axisX, -THREE.MathUtils.clamp(slope, -0.6, 0.6)));
    }
  }

  // ---------- What main.js can ask for ----------
  // Play a one-shot moment ('point', 'stretch', 'wave'). Returns false if the clip is missing.
  function play(name) {
    const act = state.actions?.[name];
    if (!act) return false;
    act.reset().setEffectiveTimeScale(1).play();
    state.shot = name;
    return true;
  }
  // Is a one-shot playing right now?
  const playing = (name) => state.shot === name;
  // Hold a looping pose while standing ('look'), or null for plain idle.
  function setLoop(name) { state.loop = name; }
  // Turn the head towards a point in the world (or null to look ahead again).
  // The head turns (afterClips) and the VRM's own look-at moves the eyes to the same point.
  const eyeTarget = new THREE.Object3D();
  function lookAt(point) {
    state.lookTarget = point;
    const look = state.vrm?.lookAt;
    if (!look) return;
    if (point) {
      eyeTarget.position.copy(point);
      look.target = eyeTarget;
      look.autoUpdate = true;
    } else {
      look.target = null;
      look.autoUpdate = false;
      look.reset?.();
    }
  }

  // The summit wave (once per arrival).
  function wave() {
    if (state.waved || !state.actions?.wave) return;
    state.waved = true;
    play('wave');
  }

  // Allow the wave to play again (after scrolling back down from the summit).
  // Sit down (true) or stand up (false). Does nothing if there's no sitting animation.
  function setSitting(on) {
    state.sitWanted = !!on;
  }

  function resetWave() {
    state.waved = false;
  }

  // After a jump (e.g. "Skip film"), forget the old position so we don't think we sprinted there.
  function teleport() {
    hasLast = false;
    state.lastHeading = null;
    state.turnRate = 0;
    state.speed = 0;
    state.walkAmount = 0;
  }

  return {
    root,
    ready,
    place,
    teleport,
    update,
    wave,
    resetWave,
    setSitting,
    play,
    playing,
    setLoop,
    lookAt,
    get sitting() { return state.sitPhase; },
    // Other scenes (the style frames) have their own ground.
    setGround(fn) { groundAt = fn; },
    get canSit() { return !!state.actions?.sit; },
    // For testing: the measured speed and how much of the jog is showing.
    get debug() { return { speed: state.speed, walk: state.walkAmount, jog: state.actions?.jog ? smoothstepJS(JOG_FROM, JOG_TO, state.speed) : 0, actions: state.actions, vrm: state.vrm }; },
    setLightLevel,
    get walking() { return state.walkAmount; },
    get hasMixamo() { return !!state.actions; },
  };
}

// =====================================================================
// Night-friendly materials
// =====================================================================
// VRoid models use "MToon", a toon (anime) material. Out of the box it is tuned for bright
// daylight. At night we want: soft shading, a faint cool rim of moonlight on the silhouette
// so the character reads against the dark forest, and no self-glow.
// MToon also reacts to light more strongly than our painted world, so we keep each
// material's original colours and scale them with a "light level" (see setLightLevel).
const toonMaterials = [];
function tuneMaterialsForNight(vrm) {
  const moonRim = new THREE.Color(MATERIALS.characterRim);
  vrm.scene.traverse((obj) => {
    if (!obj.isMesh) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of materials) {
      if (!m.isMToonMaterial) continue;
      toonMaterials.push({
        material: m,
        color: m.color.clone(),
        shade: m.shadeColorFactor ? m.shadeColorFactor.clone() : null,
      });
      // A gentle cool rim light around the edges (like moonlight catching the outline).
      m.parametricRimColorFactor?.copy(moonRim);
      if ('parametricRimFresnelPowerFactor' in m) m.parametricRimFresnelPowerFactor = 6;
      if ('parametricRimLiftFactor' in m) m.parametricRimLiftFactor = 0.0;
      if ('rimLightingMixFactor' in m) m.rimLightingMixFactor = 0.15;
      // No drawn outline round the body either (it read as a sticker edge).
      if ('outlineWidthFactor' in m) m.outlineWidthFactor = 0;
      // Let the soft sky light fill the shadows a bit, so the toon shade isn't harsh black.
      if ('giEqualizationFactor' in m) m.giEqualizationFactor = 0.6;
      // Make sure nothing on the model glows by itself in the dark.
      if (m.emissive) m.emissive.setRGB(0, 0, 0);
    }
  });
}

// level: 1 = original daylight colours. tint: the colour of the ambient light.
// At night we use about 0.4 and a cool blue tint; towards dawn it rises.
function setLightLevel(level, tint) {
  for (const t of toonMaterials) {
    t.material.color.copy(t.color).multiplyScalar(level).multiply(tint);
    if (t.shade) t.material.shadeColorFactor.copy(t.shade).multiplyScalar(level * 0.8).multiply(tint);
  }
}

// =====================================================================
// Stand-in animation: relaxed pose + breathing + simple walk cycle
// =====================================================================
// Bone rotations are in radians (about 0.1 rad = 6°). The rest pose of a VRM is a T-pose
// (arms straight out to the sides); we rotate bones away from it.
function applyStandInPose(vrm, time, walk, phase) {
  const bone = (name) => vrm.humanoid?.getNormalizedBoneNode(name);
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const breathe = Math.sin(time * 1.6);

  // Arms down by the sides, elbows slightly bent, swinging opposite to the legs when walking.
  const armSwing = 0.32 * walk * s;
  setRot(bone('leftUpperArm'), -0.06 + armSwing, 0, -1.33 + breathe * 0.01);
  setRot(bone('rightUpperArm'), -0.06 - armSwing, 0, 1.33 - breathe * 0.01);
  setRot(bone('leftLowerArm'), 0, -0.22 - 0.18 * walk * Math.max(0, s), 0);
  setRot(bone('rightLowerArm'), 0, 0.22 + 0.18 * walk * Math.max(0, -s), 0);
  setRot(bone('leftHand'), 0, 0, -0.1);
  setRot(bone('rightHand'), 0, 0, 0.1);
  setRot(bone('leftShoulder'), 0, 0, -0.05);
  setRot(bone('rightShoulder'), 0, 0, 0.05);

  // Legs: hip swing forward/back; knees bend while the leg swings forward.
  const legSwing = 0.42 * walk;
  setRot(bone('leftUpperLeg'), -legSwing * s, 0, 0);
  setRot(bone('rightUpperLeg'), legSwing * s, 0, 0);
  setRot(bone('leftLowerLeg'), walk * (0.08 + 0.75 * Math.max(0, c)), 0, 0);
  setRot(bone('rightLowerLeg'), walk * (0.08 + 0.75 * Math.max(0, -c)), 0, 0);
  setRot(bone('leftFoot'), -walk * 0.2 * Math.max(0, c), 0, 0);
  setRot(bone('rightFoot'), -walk * 0.2 * Math.max(0, -c), 0, 0);

  // Body: lean into the climb, a little twist with each step, gentle breathing when still.
  setRot(bone('spine'), 0.08 * walk + breathe * 0.012 * (1 - walk), 0.07 * walk * s, 0);
  setRot(bone('chest'), breathe * 0.018 * (1 - walk), -0.04 * walk * s, 0);
  setRot(bone('neck'), -0.04 * walk, 0, 0);
  setRot(bone('head'), Math.sin(time * 0.5) * 0.02 * (1 - walk) - 0.04 * walk, Math.sin(time * 0.31) * 0.06 * (1 - walk), 0);

  // Bob the hips down slightly twice per stride (each foot landing).
  const hips = bone('hips');
  if (hips) {
    if (hips.userData.restY === undefined) hips.userData.restY = hips.position.y;
    hips.position.y = hips.userData.restY - walk * (0.02 + 0.025 * Math.abs(c));
    hips.rotation.y = -0.06 * walk * s;
  }
}

function smoothstepJS(e0, e1, x) {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
}

function setRot(node, x, y, z) {
  if (node) node.rotation.set(x, y, z);
}

// =====================================================================
// Mixamo animations → VRM (the official three-vrm retargeting approach)
// =====================================================================

// Which Mixamo bone drives which VRM bone.
const MIXAMO_TO_VRM = {
  mixamorigHips: 'hips', mixamorigSpine: 'spine', mixamorigSpine1: 'chest', mixamorigSpine2: 'upperChest',
  mixamorigNeck: 'neck', mixamorigHead: 'head',
  mixamorigLeftShoulder: 'leftShoulder', mixamorigLeftArm: 'leftUpperArm', mixamorigLeftForeArm: 'leftLowerArm', mixamorigLeftHand: 'leftHand',
  mixamorigLeftHandThumb1: 'leftThumbMetacarpal', mixamorigLeftHandThumb2: 'leftThumbProximal', mixamorigLeftHandThumb3: 'leftThumbDistal',
  mixamorigLeftHandIndex1: 'leftIndexProximal', mixamorigLeftHandIndex2: 'leftIndexIntermediate', mixamorigLeftHandIndex3: 'leftIndexDistal',
  mixamorigLeftHandMiddle1: 'leftMiddleProximal', mixamorigLeftHandMiddle2: 'leftMiddleIntermediate', mixamorigLeftHandMiddle3: 'leftMiddleDistal',
  mixamorigLeftHandRing1: 'leftRingProximal', mixamorigLeftHandRing2: 'leftRingIntermediate', mixamorigLeftHandRing3: 'leftRingDistal',
  mixamorigLeftHandPinky1: 'leftLittleProximal', mixamorigLeftHandPinky2: 'leftLittleIntermediate', mixamorigLeftHandPinky3: 'leftLittleDistal',
  mixamorigRightShoulder: 'rightShoulder', mixamorigRightArm: 'rightUpperArm', mixamorigRightForeArm: 'rightLowerArm', mixamorigRightHand: 'rightHand',
  mixamorigRightHandThumb1: 'rightThumbMetacarpal', mixamorigRightHandThumb2: 'rightThumbProximal', mixamorigRightHandThumb3: 'rightThumbDistal',
  mixamorigRightHandIndex1: 'rightIndexProximal', mixamorigRightHandIndex2: 'rightIndexIntermediate', mixamorigRightHandIndex3: 'rightIndexDistal',
  mixamorigRightHandMiddle1: 'rightMiddleProximal', mixamorigRightHandMiddle2: 'rightMiddleIntermediate', mixamorigRightHandMiddle3: 'rightMiddleDistal',
  mixamorigRightHandRing1: 'rightRingProximal', mixamorigRightHandRing2: 'rightRingIntermediate', mixamorigRightHandRing3: 'rightRingDistal',
  mixamorigRightHandPinky1: 'rightLittleProximal', mixamorigRightHandPinky2: 'rightLittleIntermediate', mixamorigRightHandPinky3: 'rightLittleDistal',
  mixamorigLeftUpLeg: 'leftUpperLeg', mixamorigLeftLeg: 'leftLowerLeg', mixamorigLeftFoot: 'leftFoot', mixamorigLeftToeBase: 'leftToes',
  mixamorigRightUpLeg: 'rightUpperLeg', mixamorigRightLeg: 'rightLowerLeg', mixamorigRightFoot: 'rightFoot', mixamorigRightToeBase: 'rightToes',
};

// Load every animation file that exists. Returns null if none were found.
async function loadMixamoClips(vrm) {
  const results = await Promise.all(
    Object.entries(ANIMATION_URLS).map(async ([name, url]) => {
      try {
        return [name, await loadMixamoAnimation(url, vrm, { dropHipTurn: DROP_HIP_TURN.includes(name) })];
      } catch (err) {
        // A missing file is normal (stay quiet). A file that exists but can't be read is worth a warning.
        if (!/404/.test(String(err?.message ?? err))) console.warn(`[trekker] Could not use ${url}:`, err);
        return [name, null];
      }
    })
  );
  const clips = Object.fromEntries(results.filter(([, clip]) => clip));
  if (!clips.walk && !clips.idle) {
    console.info('[trekker] No Mixamo animations in assets/animations/ yet, using the stand-in pose.');
    return null;
  }
  return clips;
}

// Convert one Mixamo FBX animation into a clip for this VRM.
// Mixamo bones have different "rest" orientations from VRM bones, so each rotation is
// corrected: rotate into world space using the Mixamo rest pose, then back into VRM space.
async function loadMixamoAnimation(url, vrm, { dropHipTurn = false } = {}) {
  const asset = await new FBXLoader().loadAsync(url);
  const clip = THREE.AnimationClip.findByName(asset.animations, 'mixamo.com') || asset.animations[0];
  if (!clip) throw new Error('no animation in ' + url);

  const tracks = [];
  const restRotationInverse = new THREE.Quaternion();
  const parentRestWorldRotation = new THREE.Quaternion();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();

  // Scale hip movement from Mixamo's character size to ours.
  const motionHipsHeight = asset.getObjectByName('mixamorigHips').position.y;
  const vrmHipsY = vrm.humanoid.getNormalizedBoneNode('hips').getWorldPosition(v).y;
  const vrmRootY = vrm.scene.getWorldPosition(v).y;
  const hipsPositionScale = Math.abs(vrmHipsY - vrmRootY) / motionHipsHeight;

  for (const track of clip.tracks) {
    const [mixamoRigName, propertyName] = track.name.split('.');
    const vrmBoneName = MIXAMO_TO_VRM[mixamoRigName];
    const vrmNodeName = vrmBoneName && vrm.humanoid.getNormalizedBoneNode(vrmBoneName)?.name;
    const mixamoRigNode = asset.getObjectByName(mixamoRigName);
    if (!vrmNodeName || !mixamoRigNode) continue;

    mixamoRigNode.getWorldQuaternion(restRotationInverse).invert();
    mixamoRigNode.parent.getWorldQuaternion(parentRestWorldRotation);

    if (dropHipTurn && vrmBoneName === 'hips' && track instanceof THREE.QuaternionKeyframeTrack) continue;
    if (track instanceof THREE.QuaternionKeyframeTrack) {
      const values = track.values.slice();
      for (let i = 0; i < values.length; i += 4) {
        q.fromArray(values, i);
        q.premultiply(parentRestWorldRotation).multiply(restRotationInverse);
        q.toArray(values, i);
      }
      // VRM 0.x models face the other way, so they need two axes flipped.
      const isVrm0 = vrm.meta?.metaVersion === '0';
      tracks.push(new THREE.QuaternionKeyframeTrack(
        `${vrmNodeName}.${propertyName}`, track.times,
        values.map((val, i) => (isVrm0 && i % 2 === 0 ? -val : val))
      ));
    } else if (track instanceof THREE.VectorKeyframeTrack && vrmBoneName === 'hips') {
      // Keep the hips' up/down bob (y), but drop forward/sideways drift (x, z):
      // the trail moves the trekker, not the clip. Tick "In Place" on Mixamo too.
      const values = track.values.map((val, i) => (i % 3 === 1 ? val * hipsPositionScale : 0));
      tracks.push(new THREE.VectorKeyframeTrack(`${vrmNodeName}.${propertyName}`, track.times, values));
    }
  }
  return new THREE.AnimationClip(url, clip.duration, tracks);
}

// ---------- A soft round shadow under the feet ----------
function makeBlobShadow() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.2)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.1),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  return mesh;
}

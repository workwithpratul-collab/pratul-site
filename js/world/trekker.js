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

const MODEL_URL = 'assets/pratul-trekker.vrm';
const ANIMATION_URLS = {
  walk: 'assets/animations/Walking.fbx',
  idle: 'assets/animations/Idle.fbx',
  wave: 'assets/animations/Waving.fbx',
};
const STRIDE = 0.72;           // metres per step, used to keep feet and ground in sync
const MIXAMO_WALK_SPEED = 1.3; // metres per second the Mixamo "Walking" clip naturally covers
const NIGHT_LEVEL = 0.42;            // how bright the character's colours are at night
const NIGHT_TINT = new THREE.Color('#c4cdf2'); // cool moonlight tint

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
        if (name === 'wave') {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = false;
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
  function place(x, z, heading) {
    const y = groundHeight(x, z);
    root.position.set(x, y, z);
    root.rotation.y = heading;            // VRM models face +Z; heading turns them
    shadow.position.set(x, y + 0.02, z);
  }

  // ---------- update: called every frame ----------
  function update(dt, time) {
    // Measure how fast we actually moved, then smooth it (no jerky starts and stops).
    if (hasLast) {
      const moved = Math.hypot(root.position.x - lastPos.x, root.position.z - lastPos.z);
      const rawSpeed = dt > 0 ? moved / dt : 0;
      state.speed += (Math.min(rawSpeed, 4) - state.speed) * (1 - Math.exp(-dt * 6));
      state.phase += moved * (Math.PI / STRIDE); // one full leg cycle every two strides
    }
    lastPos.copy(root.position);
    hasLast = true;

    const targetWalk = THREE.MathUtils.clamp(state.speed / 0.6, 0, 1);
    state.walkAmount += (targetWalk - state.walkAmount) * (1 - Math.exp(-dt * 4));

    const vrm = state.vrm;
    if (!vrm) return;

    if (state.actions) {
      // Mixamo: blend between idle and walk, and match the walk speed to our real speed.
      const { walk, idle, wave } = state.actions;
      if (walk) {
        walk.setEffectiveWeight(state.walkAmount);
        walk.setEffectiveTimeScale(THREE.MathUtils.clamp(state.speed / MIXAMO_WALK_SPEED, 0.6, 1.8));
      }
      if (idle) idle.setEffectiveWeight(1 - state.walkAmount);
      if (wave && wave.isRunning()) {
        const w = Math.sin(Math.min(wave.time / wave.getClip().duration, 1) * Math.PI);
        wave.setEffectiveWeight(w);
      }
      state.mixer.update(dt);
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

  // Play the Mixamo wave once (only if that file exists).
  function wave() {
    const action = state.actions?.wave;
    if (!action || state.waved) return;
    state.waved = true;
    action.reset().play();
  }

  // After a jump (e.g. "Skip film"), forget the old position so we don't think we sprinted there.
  function teleport() {
    hasLast = false;
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
  const moonRim = new THREE.Color('#5a6ec8');
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
      if ('parametricRimFresnelPowerFactor' in m) m.parametricRimFresnelPowerFactor = 3.5;
      if ('parametricRimLiftFactor' in m) m.parametricRimLiftFactor = 0.0;
      if ('rimLightingMixFactor' in m) m.rimLightingMixFactor = 0.6;
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
        return [name, await loadMixamoAnimation(url, vrm)];
      } catch {
        return [name, null];   // file missing or unreadable: just skip it
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
async function loadMixamoAnimation(url, vrm) {
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

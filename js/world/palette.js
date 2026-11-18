// palette.js: every colour of the world, in one place.
//
// The film climbs from night to sunrise. Instead of each file keeping its own colours,
// they all read from here, so sky, fog, mist, light, trees and ground can never drift apart.
//
// Two kinds of colour live in this file:
//  1. PRESETS: four "times of day". Each one lists the colour of everything that changes
//     with the light (sky, fog, mist, sun or moon, trees...). setClimb() blends between them.
//  2. MATERIALS: colours that stay the same all day (the tent fabric, the lantern glass,
//     the ground's painted patches...). The light colours them, the palette doesn't.
//
// All colours are written as normal web hex (sRGB), the same as in CSS.
// three.js converts them to "linear" numbers for its lighting maths behind the scenes.

import * as THREE from 'three';

// =====================================================================
// 1. THE FOUR TIMES OF DAY
// =====================================================================
// Fields every preset has (same names in all four, so they can be blended):
//   sky       top / mid / horizon gradient, glow (the warm band where the sun will rise),
//             and how visible the stars, moon and sun are (0..1)
//   fog       colour and density (how fast distant things melt into the sky)
//   ambient   the soft light from everywhere: sky colour from above, ground colour from below
//   key       the main light: the moon at night, the sun by day. `fromSun` 0 = it comes from
//             the moon's direction, 1 = from the sun's direction
//   mist      air (drifting mist layers), treeFeet (mist at the foot of the trees),
//             valley (the haze that fills the valleys between mountain ranges)
//   clouds    the lit tops and shaded undersides of clouds (the summit's sea of clouds)
//   ground    a tint multiplied over the painted ground (white = no change)
//   warm      the warm accent: the colour that light from tents and lanterns casts
//   trees / stones / wood   painted gradients (bottom → top) for the world's objects
//   mountains the four distant ranges' rock colours (nearest first), snow, and how much
//             the lit snow catches the warm glow
//   character how bright and what tint the trekker's colours are in this light
export const PRESETS = {
  // ---------- 1. NIGHT: base camp. Deep navy and indigo, cool moonlight, a warm orange tent. ----------
  night: {
    label: 'Night',
    place: 'Base camp',
    sky: { top: '#03061a', mid: '#0e1747', horizon: '#25336a', glow: '#1c2a62', glowStrength: 0, stars: 1, moon: 1, sun: 0 },
    fog: { color: '#25336a', density: 0.0095 },
    ambient: { sky: '#5166b8', ground: '#141a36', intensity: 2.2 },
    key: { color: '#9ab0f5', intensity: 1.9, fromSun: 0 },
    mist: { air: '#757c9c', treeFeet: '#6b7294', valley: '#7d829c' },
    clouds: { lit: '#4a5688', shade: '#1c2550' },
    ground: '#ffffff',
    warm: '#ffa257',
    trees: {
      bottom: '#172a3d', top: '#2f4b62',           // near trees: deep slate blue low, lighter high
      cardBottom: '#172b3f', cardTop: '#223d52',   // far card trees: flatter, the fog adds depth
      rim: '#a3adc8',                              // faint cool silver on the moon side
      trunk: '#26242e',
    },
    stones: { bottom: '#1b2230', top: '#465066' },
    wood: { bottom: '#2a2421', top: '#5b4a3d' },
    mountains: {
      layers: ['#0a1130', '#111a46', '#1a2660', '#283676'],
      snowLit: '#9eaee4', snowShade: '#4a5898', snowWarmth: 0,
    },
    character: { level: 0.42, tint: '#c4cdf2' },
  },

  // ---------- 2. PRE-DAWN: the ridge. Indigo fading to violet, the first hint of rose. ----------
  predawn: {
    label: 'Pre-dawn',
    place: 'The ridge',
    sky: { top: '#0a1440', mid: '#2a3a86', horizon: '#6b6fa8', glow: '#f2a17c', glowStrength: 0.9, stars: 0.25, moon: 1, sun: 0 },
    fog: { color: '#6b6fa8', density: 0.0095 },
    ambient: { sky: '#7f89cc', ground: '#221d38', intensity: 2.6 },
    key: { color: '#b4bdf0', intensity: 1.7, fromSun: 0 },
    mist: { air: '#9094c0', treeFeet: '#8a8fbc', valley: '#969ac0' },
    clouds: { lit: '#a49fc8', shade: '#4a4f86' },
    ground: '#ffffff',
    warm: '#ffa257',
    trees: {
      bottom: '#252f4a', top: '#4a5878',
      cardBottom: '#232c46', cardTop: '#343f5e',
      rim: '#c9c0d8',
      trunk: '#332d3a',
    },
    stones: { bottom: '#262a3e', top: '#5b5f7c' },
    wood: { bottom: '#352c2a', top: '#6e5a4b' },
    mountains: {
      layers: ['#0a1130', '#111a46', '#1a2660', '#283676'],
      snowLit: '#9eaee4', snowShade: '#4a5898', snowWarmth: 0,
    },
    character: { level: 0.52, tint: '#ddd2ea' },
  },

  // ---------- 3. FIRST LIGHT: the meadow. Soft lilac and peach sky, pale gold light on the grass. ----------
  firstLight: {
    label: 'First light',
    place: 'The meadow',
    sky: { top: '#5a6aa8', mid: '#a59ccc', horizon: '#efc6b4', glow: '#ffd2a0', glowStrength: 0.85, stars: 0, moon: 0.12, sun: 0.75 },
    fog: { color: '#cfc0d4', density: 0.0042 },   // lilac haze: distant hills turn soft violet, not beige
    ambient: { sky: '#c4bce6', ground: '#5c5a4a', intensity: 2.5 },
    key: { color: '#ffe0ae', intensity: 2.6, fromSun: 1 },
    mist: { air: '#f2dcd6', treeFeet: '#e9d2d0', valley: '#f0d8d2' },
    clouds: { lit: '#fbe3d6', shade: '#aea6d0' },
    ground: '#fff2dc',
    warm: '#ffc27a',
    trees: {
      bottom: '#2d4446', top: '#5f7d6a',
      cardBottom: '#4d5f6c', cardTop: '#6a7b84',
      rim: '#ffdcae',
      trunk: '#3f3536',
    },
    stones: { bottom: '#4a4856', top: '#8e868e' },
    wood: { bottom: '#4a3a30', top: '#8a6f58' },
    mountains: {
      layers: ['#647c84', '#7c87a6', '#8f8fb8', '#a8a6cc'],
      snowLit: '#fff0dd', snowShade: '#a7aad2', snowWarmth: 0.55,
    },
    character: { level: 0.82, tint: '#fbe9e2' },
  },

  // ---------- 4. SUNRISE: the summit. Warm gold and rose, a sea of clouds glowing below. ----------
  sunrise: {
    label: 'Sunrise',
    place: 'The summit',
    sky: { top: '#36508f', mid: '#c995ad', horizon: '#ffcf96', glow: '#ffb46e', glowStrength: 1, stars: 0, moon: 0, sun: 1 },
    fog: { color: '#f6c6a8', density: 0.0032 },
    ambient: { sky: '#c2bce2', ground: '#6e5258', intensity: 2.6 },   // lilac: shaded snow goes cool, the sun side gold
    key: { color: '#ffd09a', intensity: 3.1, fromSun: 1 },
    mist: { air: '#ffe4cc', treeFeet: '#f6d8c6', valley: '#ffdcc2' },
    clouds: { lit: '#ffe6c8', shade: '#b7a6c8' },
    ground: '#ffe8d2',
    warm: '#ffb46a',
    trees: {
      bottom: '#3c3a54', top: '#7d6c84',
      cardBottom: '#5d5674', cardTop: '#7c7290',
      rim: '#ffd09c',
      trunk: '#4a3a3c',
    },
    stones: { bottom: '#5a4a5a', top: '#c09ea2' },
    wood: { bottom: '#5a4038', top: '#a07a5e' },
    mountains: {
      layers: ['#4c4268', '#6c5c88', '#927ca2', '#b69cba'],
      snowLit: '#fff2de', snowShade: '#ab9cc6', snowWarmth: 1,
    },
    character: { level: 0.95, tint: '#fff0e4' },
  },
};

// Where each preset sits on the climb (0 = base camp at night, 1 = the summit at sunrise).
export const CLIMB = {
  night: 0,
  predawn: 1 / 3,
  firstLight: 2 / 3,
  sunrise: 1,
};
const ORDER = ['night', 'predawn', 'firstLight', 'sunrise'];

// =====================================================================
// 2. COLOURS THAT DON'T CHANGE WITH THE TIME OF DAY
// =====================================================================
export const MATERIALS = {
  // Light sources: the only strongly saturated warm colours in the world.
  lights: {
    tentLight: '#ffae5c',      // the light a tent throws onto the ground
    tentHalo: '#ff7a2a',       // the soft glow in the air around a tent
    tentFabric: '#c9772f',     // tent fabric, and the colour it glows from inside
    tentGlow: '#ff8a2e',
    lanternLight: '#ffa552',
    lanternHalo: '#ff9642',
    lanternGlass: '#ffd59a',
    projector: '#ffd6bd',      // light spilling from a project screen
    projectorGlow: '#ffc9a0',
  },
  // Camp gear.
  camp: {
    canvas: '#5f6173',         // a project screen's cloth margin (pale canvas in moonlight)
    rope: '#9a9484',
    groundsheet: '#3b3330',
    metal: '#3a3a40',
  },
  // The gear check: trekking kit laid out on a canvas mat. Soft, cool and slightly faded, like
  // well-used gear; only the lantern glows warm (it is a light source).
  gear: {
    canvas: '#c3b9a8',         // the canvas mat
    canvasEdge: '#9f9585',     // its folded, stitched border
    body: '#4b5274',           // camera body, watch strap: dusky indigo
    trim: '#323850',           // camera grip, lens ring
    glass: '#8fa3c4',          // camera lens: cool glass
    steel: '#9aa0b2',          // compass case, buckles
    face: '#efe8dc',           // compass and watch faces
    needle: '#5f678f',         // compass needle, watch hands
    paper: '#e4dac6',          // the map
    ink: '#8e9ab3',            // contour lines on the map
    route: '#b88a8a',          // the route marked on the map (a faded rose, not a warm accent)
    rope: '#7e9b90',           // coiled rope: weathered sage
    ropeFleck: '#c9d3cc',      // its pale woven fleck
    shadow: '#3f4a66',         // the soft shadow under each painted item: a cool dusk blue, never black
  },
  // Painted ground colours. These are "surface" colours: the light tints them.
  ground: {
    forest: '#4f6e6a',         // blue-green forest floor
    moss: '#5f8172',           // slightly lighter mossy patches
    grass: '#71927c',          // open grassy slopes higher up
    grassLit: '#87a88a',       // lighter grass patches
    valley: '#3e5464',         // the deep valley beyond the ridge
    earth: '#857865',          // trodden earth at the camps (turns orange in lamplight)
    path: '#9b9a9f',           // the trail: pale dusty earth
    pathLit: '#b3ad9f',
  },
  // The alpine meadow (scene 3): sunlit grass and soft wildflowers.
  meadow: {
    grass: '#6f8a5c',
    grassLit: '#a3ad6c',
    grassDeep: '#4e6a52',
    flowers: ['#f0d488', '#ecb4c6', '#c4b6e6', '#f6efe6'],  // gold, rose, lilac, white: pastel, never neon
  },
  // The summit (scene 4): snow and rock.
  summit: {
    snow: '#f4ecef',
    snowShade: '#b5aacb',
    rock: '#5e5068',
    flagCloth: '#e46a3c',      // the "Book a call" flag: one warm note, like a tent
    flagPole: '#4a3e3a',
  },
  // The trekker's moonlit rim (the outline of the character catching light).
  characterRim: '#5a6ec8',
  // Mist is made lighter towards this colour (moonlit vapour).
  mistLift: '#dfe6ff',
};

// =====================================================================
// 3. THE LIVE MOOD: the blended colours for the current point of the climb
// =====================================================================
// Every part of the world reads from `mood`. Its colours are THREE.Color objects that are
// updated in place, so a shader can hold a reference to one and always see the latest value.

// Turn a preset (nested hex strings and numbers) into the same shape with THREE.Color objects.
function toLive(preset) {
  if (typeof preset === 'string') return new THREE.Color(preset);
  if (typeof preset === 'number') return preset;
  if (Array.isArray(preset)) return preset.map(toLive);
  const out = {};
  for (const key of Object.keys(preset)) {
    if (key === 'label' || key === 'place') continue;   // names, not colours
    out[key] = toLive(preset[key]);
  }
  return out;
}

// The presets as colour objects (made once, never changed), and the live mood.
const LIVE_PRESETS = Object.fromEntries(ORDER.map((k) => [k, toLive(PRESETS[k])]));
export const mood = toLive(PRESETS.night);
mood.climb = 0;

// Blend a → b by t (0..1) into `out`, walking the nested objects side by side.
function blendInto(out, a, b, t) {
  for (const key of Object.keys(a)) {
    const va = a[key], vb = b[key];
    if (va instanceof THREE.Color) out[key].lerpColors(va, vb, t);
    else if (typeof va === 'number') out[key] = va + (vb - va) * t;
    else blendInto(out[key], va, vb, t);
  }
}

// setClimb(climb): set the time of day from how far up the mountain we are (0..1).
// 0 = night, 1/3 = pre-dawn, 2/3 = first light, 1 = sunrise; anything between is a blend
// of the two nearest presets, so sky, fog, mist and light always change together.
export function setClimb(climb) {
  const c = Math.min(Math.max(climb, 0), 1);
  // Find the two presets either side of this point of the climb.
  let i = 0;
  while (i < ORDER.length - 2 && c > CLIMB[ORDER[i + 1]]) i++;
  const from = ORDER[i], to = ORDER[i + 1];
  const t = (c - CLIMB[from]) / (CLIMB[to] - CLIMB[from]);
  blendInto(mood, LIVE_PRESETS[from], LIVE_PRESETS[to], t);
  mood.climb = c;
  return mood;
}

// A one-off blended copy (used by the style guide to draw swatches and the blend strip).
export function sampleClimb(climb) {
  const saved = mood.climb;
  setClimb(climb);
  const copy = cloneLive(mood);
  setClimb(saved);
  return copy;
}
function cloneLive(v) {
  if (v instanceof THREE.Color) return v.clone();
  if (typeof v === 'number') return v;
  if (Array.isArray(v)) return v.map(cloneLive);
  const out = {};
  for (const key of Object.keys(v)) out[key] = cloneLive(v[key]);
  return out;
}

setClimb(0);

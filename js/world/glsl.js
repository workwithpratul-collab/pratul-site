// glsl.js: small shader helpers shared by the sky, mountains and mist.
// "Noise" is a smooth random pattern. Painters use soft, uneven strokes;
// noise gives our shaders that same unevenness so nothing looks machine-perfect.

export const NOISE_GLSL = /* glsl */ `
  // A quick pseudo-random number from a 2D position (same input -> same output).
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  // Value noise: random values on a grid, smoothly blended in between.
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // fbm = several layers of noise, big + small, like broad and fine brush strokes.
  float fbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      sum += amp * vnoise(p);
      p = p * 2.03 + vec2(17.1, 9.7);
      amp *= 0.5;
    }
    return sum;
  }

  // Tiny per-pixel noise added to dark gradients so they don't show "bands" of colour.
  float dither(vec2 fragCoord) {
    return (hash12(fragCoord) - 0.5) / 255.0;
  }
`;

// =====================================================================
// Wind: one breeze for the whole world.
// =====================================================================
// Gusts roll across the land as broad, soft waves (one takes about six seconds to cross 40 m),
// with a small, quicker flutter on top. Grass, flowers and trees all ask windGust() at their own
// position, so they lean together and you can watch each gust travel through the meadow.
// It all happens on the graphics card, inside the shaders the objects already use, so the
// wind costs no extra drawing.
export const WIND = { time: { value: 0 } };   // seconds; main.js moves it on every frame

export const WIND_GLSL = /* glsl */ `
  const vec2 WIND_DIR = vec2(0.8, 0.6);   // the way the breeze blows (across the valley)
  // How strong the wind is at a spot right now: 0 (a lull) to 1 (the top of a gust).
  float windGust(vec2 xz, float t) {
    float along = dot(xz, WIND_DIR);
    float across = dot(xz, vec2(-WIND_DIR.y, WIND_DIR.x));
    float wave = 0.5 + 0.5 * sin(along * 0.16 - t * 1.0 + sin(across * 0.07) * 1.5);
    float flutter = 0.5 + 0.5 * sin(along * 0.9 - t * 2.6 + across * 0.4);
    return wave * wave * 0.8 + flutter * 0.2;
  }
`;

// Teach a standard (Lambert) material to bend in the wind. Blades bend from the root (the tip
// moves most); blooms (flowers, held above the grass) sway as a whole.
export function addWind(material, { bloom = false } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = WIND.time;
    shader.vertexShader = 'uniform float uWindTime;\n' + WIND_GLSL + shader.vertexShader.replace('#include <project_vertex>', /* glsl */ `
      vec4 mvPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      vec4 windWorld = modelMatrix * mvPosition;
      float windG = windGust(windWorld.xz, uWindTime);
      float windBend = ${bloom ? '0.6' : 'position.y * position.y'};
      windWorld.xz += WIND_DIR * (0.02 + windG * 0.07) * windBend;
      windWorld.y -= windG * windG * 0.015 * windBend;   // a bent blade is a little lower
      mvPosition = viewMatrix * windWorld;
      gl_Position = projectionMatrix * mvPosition;
    `);
  };
  material.customProgramCacheKey = () => (bloom ? 'wind-bloom' : 'wind-blade');
  return material;
}

// The same breeze in JavaScript (for things moved on the CPU, like the trekker's hair).
// Keep it identical to windGust() above.
export const WIND_DIR = [0.8, 0.6];
export function windGustAt(x, z, t) {
  const along = x * WIND_DIR[0] + z * WIND_DIR[1];
  const across = -x * WIND_DIR[1] + z * WIND_DIR[0];
  const wave = 0.5 + 0.5 * Math.sin(along * 0.16 - t * 1.0 + Math.sin(across * 0.07) * 1.5);
  const flutter = 0.5 + 0.5 * Math.sin(along * 0.9 - t * 2.6 + across * 0.4);
  return wave * wave * 0.8 + flutter * 0.2;
}

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

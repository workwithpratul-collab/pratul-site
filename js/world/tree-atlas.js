// tree-atlas.js: paints the far trees' silhouettes (forest.js uses them as one texture).
//
// It has no 'three' in it on purpose, so it can run in a background worker
// (tree-atlas-worker.js): painting the ~1 million pixels takes about a tenth of a second, which
// used to freeze the page while the film was loading. forest.js asks the worker for it, and paints
// it here on the page itself only when a worker can't (an old browser).

import { seededRandom, noise2 } from './noise.js';

export const VARIANTS = 8;              // 6 pine shapes + 2 broadleaf shapes in one texture
export const CELL_W = 256, CELL_H = 512;

// Draw 8 tree silhouettes side by side on `canvas` (a page canvas, or an OffscreenCanvas in a worker).
// Channels: A = the silhouette, R = soft brush variation, G = moonlit left edge.
// Returns the finished pixels (RGBA, CELL_W * VARIANTS wide, CELL_H tall). The caller puts them
// onto the canvas it turns into a texture (putTreeAtlas, below).
export function paintTreeAtlasPixels(canvas) {
  canvas.width = CELL_W * VARIANTS;
  canvas.height = CELL_H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  const rand = seededRandom(99);
  // A slight blur gives the mask soft edges, which the shader turns into smooth outlines.
  ctx.filter = 'blur(1.2px)';
  for (let v = 0; v < VARIANTS; v++) {
    if (v < 6) drawPine(ctx, v * CELL_W, rand);
    else drawBroadleaf(ctx, v * CELL_W, rand);
  }
  ctx.filter = 'none';

  // Second pass, pixel by pixel: add brush variation (R) and a moonlit edge (G).
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const W = canvas.width;
  const alphaAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= CELL_H ? 0 : d[(y * W + x) * 4 + 3] / 255);
  const out = new Uint8ClampedArray(d.length);
  for (let y = 0; y < CELL_H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const a = d[i + 3] / 255;
      // Light comes from the upper left (the moon): edges with empty space up-left catch it.
      const rim = a * (1 - alphaAt(x - 3, y - 2));
      const brush = noise2(x * 0.045, y * 0.02, 5) * 0.7 + noise2(x * 0.15, y * 0.08, 6) * 0.3;
      out[i] = brush * 255;
      out[i + 1] = rim * 255;
      out[i + 2] = 0;
      out[i + 3] = d[i + 3];
    }
  }
  return out;
}

// Put the finished pixels onto a page canvas (ready to become the texture).
export function putTreeAtlas(pixels) {
  const canvas = document.createElement('canvas');
  canvas.width = CELL_W * VARIANTS;
  canvas.height = CELL_H;
  canvas.getContext('2d').putImageData(new ImageData(pixels, canvas.width, CELL_H), 0, 0);
  return canvas;
}

// The atlas, painted in a background worker. Resolves with the finished pixels, or with null if
// the browser can't (then forest.js paints it on the page instead).
export function paintTreeAtlasInWorker() {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const worker = new Worker(new URL('./tree-atlas-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => { resolve(e.data); worker.terminate(); };
      worker.onerror = () => { resolve(null); worker.terminate(); };
    } catch {
      resolve(null);
    }
  });
}

// A pine: one outline with drooping branch tips down both sides, each side jittered separately.
function drawPine(ctx, ox, rand) {
  const cx = ox + CELL_W / 2 + (rand() - 0.5) * 8;
  const top = 10 + rand() * 18;
  const base = CELL_H - 40;
  const maxHalf = CELL_W * (0.36 + rand() * 0.1);
  const tiers = 7 + Math.floor(rand() * 4);
  const half = (y) => maxHalf * Math.pow((y - top) / (base - top), 0.92);

  const side = (dir) => {
    const pts = [];
    for (let k = 1; k <= tiers; k++) {
      const yTip = top + ((base - top) * k) / tiers + (rand() - 0.5) * 8;
      const yNotch = yTip - ((base - top) / tiers) * (0.45 + rand() * 0.2);
      pts.push([cx + dir * half(yNotch) * (0.58 + rand() * 0.2), yNotch]);
      pts.push([cx + dir * half(yTip) * (0.9 + rand() * 0.25), yTip + 6 + rand() * 6]);   // drooping tip
    }
    return pts;
  };
  const left = side(-1);
  const right = side(1);

  ctx.beginPath();
  ctx.moveTo(cx, top);
  for (const [x, y] of left) ctx.lineTo(x, y);
  ctx.lineTo(cx - maxHalf * 0.2, base + 2);
  ctx.lineTo(cx + maxHalf * 0.2, base + 2);
  for (const [x, y] of right.reverse()) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  // A short trunk peeking out underneath.
  ctx.fillRect(cx - 5, base - 4, 10, CELL_H - base);
}

// A broadleaf tree: a cloud of overlapping round clumps on a short trunk.
function drawBroadleaf(ctx, ox, rand) {
  const cx = ox + CELL_W / 2;
  const base = CELL_H - 30;
  ctx.fillRect(cx - 7, base - 140, 14, 170);
  const clumps = 11;
  for (let i = 0; i < clumps; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * 48;
    const x = cx + Math.cos(a) * r;
    const y = base - 220 + Math.sin(a) * r * 1.3 - (i === 0 ? 30 : 0);
    ctx.beginPath();
    ctx.arc(x, y, 36 + rand() * 30, 0, Math.PI * 2);   // stays inside the 256 px cell
    ctx.fill();
  }
}

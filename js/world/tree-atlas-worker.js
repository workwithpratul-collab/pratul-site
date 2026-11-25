// tree-atlas-worker.js: paints the far trees' silhouettes in the background (tree-atlas.js), so the
// page stays free while the film loads. It sends back the finished pixels (moved, not copied).
import { paintTreeAtlasPixels } from './tree-atlas.js';

const pixels = paintTreeAtlasPixels(new OffscreenCanvas(1, 1));
postMessage(pixels, [pixels.buffer]);

# Performance

How fast the site is, measured the same way before and after the premium redesign.

## How it was measured

- **Server:** a small local Node server that gzips text files, like a real host does
  (scratchpad tool, not part of the site).
- **Lighthouse 12** in headless Chrome 157, desktop preset and phone preset (Moto G Power, slow 4G,
  4x slower CPU).
- **Film run:** Chrome with the real graphics card (RTX 3050 laptop, 144 Hz screen), 1440 x 900,
  scrolling through the whole film in 120 steps, then down every section. Frame times come from
  `requestAnimationFrame`; draw calls and triangles from three.js `renderer.info`.
- **Long tasks:** the browser's `longtask` and `long-animation-frame` observers.

"Before" is commit `db473aa`. "After" is filled in at the end of Part 9/10.

## Numbers

| What | Budget | Before | After |
|---|---|---|---|
| Lighthouse Performance, desktop | 95+ | **63** | |
| Lighthouse Performance, phone | 90+ | 97 | |
| LCP, desktop | < 1.8 s | 0.7 s (the loading screen's "0%") | |
| LCP, phone | < 2.5 s | 2.1 s | |
| CLS, desktop / phone | < 0.05 | 0.001 / 0.005 | |
| Total Blocking Time, desktop (stands in for INP in a lab test) | < 200 ms | **920 ms** | |
| Total Blocking Time, phone | < 200 ms | 0 ms | |
| JS on first load (gzipped), desktop | < 180 KB before 3D | **654 KB** (three.js, GSAP, Lenis, all world code, all at once) | |
| JS on first load (gzipped), phone | < 120 KB | 10 KB | |
| Total download, desktop first load | | **7.4 MB** | |
| Images, desktop / phone | | 145 KB / 244 KB | |
| Fonts | max 4 woff2, subset | **7 files, 347 KB**, from Google (render-blocking CSS) | |
| WebGL contexts | 1 | 1 (film) | |
| Draw calls (film, worst moment) | | 174 | |
| Triangles (film, worst moment) | | **2.7 million** | |
| Texture memory (estimate) | | 66 MB, 24 textures | |
| Film frame time on this PC | 60 fps steady | 6.9 ms avg (144 fps, screen-limited), 0 slow samples | |
| Film CPU per frame (median / p95) | | 1.7 ms / 2.7 ms | |
| Boot: longest main-thread block | | **852 ms** (building the world) + **672 ms** (first frame: shaders and uploads) | |
| Boot: long tasks in total | | 10 tasks, **2.3 s** | |
| Long frames below the film | 0 | 2 (67-69 ms, painting, no script) | |

## Why it feels slow (before)

In order of how much each one hurts:

1. **The page freezes for about 2.5 s after it appears.** `film.js` builds the whole world in one go
   (forest of ~8,000 trees, terrain, ridge, meadow, summit): an 852 ms block. The first frame then
   compiles every shader and uploads every mesh in one 672 ms block, and the eleven FBX animations are
   parsed one after another (100-200 ms each). Scroll and clicks can't be answered during this.
2. **Everything downloads at once.** three.js, GSAP, ScrollTrigger, Lenis and all world code (654 KB
   gzipped) load before anything can move, plus 1.2 MB of character and 2 MB (gzipped; 7.4 MB raw)
   of FBX animation, plus the 2.9 MB HD DERMAÉ video, which starts during the opening.
3. **Fonts block the first paint.** Seven Google Font files (347 KB) behind a render-blocking stylesheet
   from another server (Lighthouse: ~530 ms desktop, ~1,060 ms phone of render-blocking).
4. **Heavy geometry for weaker graphics chips.** Up to 2.7 M triangles and 174 draw calls: fine on this
   RTX 3050, but this is what makes integrated laptop graphics drop frames.
5. **Jank below the film.** Two 67-69 ms paint frames while scrolling the sections (large painted
   backgrounds, the CSS 3D tools ring), plus a top-bar check that runs four times a second forever
   (`setInterval` in pages.js).

## What was fixed

(Filled in as the parts land.)

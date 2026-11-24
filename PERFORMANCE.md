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

## Feedback round (Nov 23): before and after

Measured the same way on both versions (local gzip server, Chrome 157 with the real graphics card,
1440 x 900, one scroll step per frame), two runs each. "Before" is commit `4432539` (Part 9).

| What | Before | After |
|---|---|---|
| Film frame time, median / p95 | 7.2-7.3 ms / 12.1-12.9 ms | 7.1-7.2 ms / 11.6-12.2 ms |
| Sections below the film, median / p95 | 6.9-7.0 ms / 8.1-8.2 ms | 6.9 ms / 8.2-8.3 ms |
| Sections below the film, worst frame | 164-173 ms | 113-116 ms (the WebGL lanterns are gone) |
| Boot to the live film | 4.4-4.8 s, 819-1008 ms blocking | 4.8-5.0 s, 973-983 ms blocking (within run-to-run noise) |
| JS on desktop (after the film is ready) | 595 KB | 611 KB (process.js, tools.js; the ridge now loads at idle) |
| Phone page: JS / fonts / images | 11 / 65 / 65 KB | 16 / 67 / 134 KB (the project cards' screenshots, lazy) |

New costs, all small: the film's text shade is one see-through quad, drawn only while words show; the
hand-over's blur is one quarter-size snapshot taken once; the film stops drawing once the page covers
it. The Process trail and the Tools loop are plain HTML/CSS transforms that run only on screen.

## Feedback round 2 (Nov 23): before and after

Measured the same way on both versions: "before" is commit `7411a46` (the end of round 1), served from
an exported copy next to the current site on the same local gzip server, Chrome with the real
graphics card. Desktop at 1440 x 900 (one scroll step per frame, two runs each, alternating). Phone at
390 x 844, 3x pixel density, processor slowed 4x.

| What | Before | After |
|---|---|---|
| Boot to the live film | 5.7-6.5 s, 1030-1135 ms blocking | 4.3-5.5 s, 976-1128 ms blocking |
| Film frame time, median / p95 | 7.1-7.2 ms / 11.6-12.4 ms | 7.2-7.5 ms / 12.1-13.2 ms (run-to-run noise) |
| Sections below the film, median / p95 | 6.9 ms / 8.3-8.8 ms | 6.9-7.0 ms / 8.7-9.1 ms |
| JS on desktop / everything loaded at boot | 612 KB / 4,172 KB | 615 KB / 4,189 KB |
| Tools ribbon while drifting | (the old loop) | 7.0 ms median frame, transforms only, rests off screen |
| Phone: first paint | 1.02-1.04 s | 0.21-0.26 s |
| Phone: JS / fonts / images / total | 16 / 67 / 134 / 243 KB | 20 / 85 / 143 / 279 KB |
| Phone scroll, median / p95 / frames over 25 ms | 10.2-10.4 ms / 17.8-18.2 ms / 13 | 11.0-11.8 ms / 20.2-20.5 ms / 8-10 |

What changed, and why the numbers are where they are:
- **Process** no longer downloads a painted background (the range is SVG), so its arrival is lighter.
  A first version of the phone trail moved its checkpoints by changing their position every frame
  (layout and repaint on each frame: 60 slow frames). They now glide with a CSS transform on the
  compositor, the trail is measured once per glide, and the desktop trail is sampled once per layout.
- **Phones load one more font file** (JetBrains Mono, 18 KB): the approved designs use it for the
  small capital labels (the summit label, "Off the clock", the step count, the footer labels).
- **The phone's typical frame is about 1 ms longer**, from the two things that now move on their own:
  the snow (two transform-only layers) and the Tools ribbon (transforms only, only while on screen).
  Both stop under "reduce motion". Slow frames are fewer than before.
- The 3D Work ridge is unchanged; the Work section stays see-through so the canvas shows through it.

## Services: the exploded website (Nov 24)

The desktop Services section is now an 8-screen held sequence (references/services-explode/). Measured
in Chrome 158 with the real graphics card (RTX 3050 laptop, 144 Hz screen), a windowed browser, gliding
through the whole section in 12 s with Lenis (like a slow wheel). Frame times from `requestAnimationFrame`.

| What | 1440 x 900 | 1366 x 768 |
|---|---|---|
| Median / p95 / p99 frame | 6.9 / 7.0 / 7.1 ms | 6.9 / 7.0 / 7.1 ms |
| Average | 144 fps (screen-limited) | 144 fps |
| Worst frame, Chrome that has drawn it before | 14 ms, 0 frames over 20 ms | 14 ms, 0 frames over 20 ms |
| Worst frame, brand-new Chrome profile (first pass) | 229 ms, 7 frames over 33 ms | 236 ms, 7 frames over 33 ms |
| Phone page | unchanged: same Services cards (pixel-identical), no new file downloaded | |

What the first-pass stutter is: a Chrome trace shows the long jobs are all on the graphics process
(`DoEndRasterCHROMIUM::Flush`, `FinishPaintRenderPass`): the driver compiling the shaders that draw these
layers (rounded photo clips, 3D surfaces, the blur) for the first time. They happen as the section enters,
at the split (0.14) and when the first layer turns forward (0.28). Chrome keeps compiled shaders on disk, so
with the same profile reopened the worst frame fell to 97 ms on the second run and 21 ms on the third, then
14 ms. Decoding the photos early and pre-drawing a tiny blurred square were both tried and made no
difference, so they were not kept.

How it stays light: only `transform` and `opacity` change while you scroll (plus `filter: blur` on the
layers stepping back, in half-pixel steps); every style is written only when its value changes;
`will-change` is on only while the section is held; the photos load lazily; services.js (11 KB before compression) is
fetched on desktop only.

## Polish round: faster film start (Nov 24)

**How it was measured.** A small local Node server that gzips like a real host (scratchpad tool, not part of
the site); the libraries still come from the real jsDelivr CDN over the internet. Chrome 158 headless with the
real graphics card (RTX 3050 laptop, ANGLE on Direct3D 11), 1440 x 900, the browser's shader cache switched off
(a first visit), and the browser warmed on the same server first (a new test browser spends ~0.7 s starting its
network layer, which a visitor's browser never does). "Live" = the moment the film can be scrolled
(`ascent:ready`). Smoothness = every frame for 2 s after that, scrolling gently. "Before" (commit `765f1d3`)
and "after" were served side by side and run alternately, because this laptop's speed drifts as it warms up.

| What | Before | After |
|---|---|---|
| Page open → live film (5 alternating runs, laptop warm) | 3.60-4.62 s, median **3.82 s** | 3.01-3.21 s, median **3.10 s** (one 4.49 s outlier) |
| Same, earlier rounds with the laptop cool | 3.25-3.46 s (3.15-3.23 s at the start of the session) | **2.71-2.85 s** |
| First paint (the poster and the opening words) | 0.52-0.57 s | 0.54-0.60 s (unchanged) |
| Stutter as the film appears (frames over 33 ms / worst) | 3-5 / 69-117 ms | 1-3 / 50-61 ms |
| All files the film needs, finished downloading | ~2.9 s (the trekker's two files started at 1.5 s and 2.0 s) | **~0.5 s** (all started at once) |
| Trekker file | 2.77 MB (1.26 MB gzipped), 21.8 MB shape texture | 2.13 MB (0.93 MB gzipped), < 0.5 MB shape texture |
| Shaders the graphics card prepares before the film appears | 42 | 27 (the later zones' 15 follow once it's live) |
| Longest freeze while loading (under the poster) | 0.44-0.87 s | 0.62-0.80 s (see below) |

**What was slow (measured, in order):**
1. **The trekker's first draw: ~0.5-0.6 s of graphics-card work.** three.js read back every shader's error log
   (`checkShaderErrors`), which made the page wait for the driver one shader at a time; and his face carried 57
   shape keys × 3 parts, packed into a 21.8 MB texture on his first frame, although the film only uses *blink*.
2. **A chain of downloads.** site.js → GSAP → gsap-core, film.js → three → three.core, and the trekker's two
   files only once the world was half built: each step waited for the one before.
3. **Waiting for the whole mountain.** The film waited for all four zones to be built *and* for all 42 shaders
   to compile, though the opening only shows base camp.
4. **The Work ridge was built the moment the film appeared**, and that is what made its first frames stutter.

**What changed:**
- `js/device.js` (film only): every file the film needs is requested at once, right at the start (modulepreload
  for the code, preload for the trekker and his animations at low priority so the poster still comes first).
  Phones download none of it (checked: 0 film files on the phone page).
- `js/site.js`: the film starts right after the first paint, not after the page's `load` event plus an idle wait.
- `assets/pratul-trekker-film.vrm`: a trimmed copy of the character with only the blink shape (made by a script
  from `assets/pratul-trekker.vrm`, which stays as the source). Same model, textures and materials.
- `js/gl.js`: shader error checks off for visitors (`?debug` turns them back on while developing).
- `js/film.js`: base camp first (its lights are the last ones, so every shader is built once), then the trekker,
  whose first draw starts straight away so the graphics card prepares him *while* the forest and terrain are
  built; then the rest of the opening. The later zones (ridge, landmarks, meadow, gear, summit) are built before
  the film appears but kept off camera (a render layer) until their shaders are ready, which happens in the
  background, one zone at a time, right after the film goes live. "Skip the film", a fast drag down the film,
  coming back from a case study and pages that open further down all wait for them, under the mist, first. One
  real frame is drawn under the poster before the hand-over, and the GPU is given time to finish (a fence),
  so that work doesn't land in the first live frames.
- `js/pages/pages.js`: the Work ridge is built at the first quiet moment 3 s after the film appears (or as soon
  as the visitor heads towards Work), not at the same moment.

**Unchanged on purpose:** the look. Frames from before and after at four points of the film (base camp, the
nursery hut, the meadow, the summit) differ only where things move (the trekker's idle sway, stars, grass,
treetops in the wind): 0.14-1.04% of pixels. Landmark videos already loaded only near each landmark.

**Not reached:** the 2.5 s target on this laptop (2.7-3.1 s). What's left is real work: ~0.8 s of building the
base-camp world on the main thread and ~0.6 s for the graphics driver to prepare the trekker's cel-shaded
shaders, plus three.js from the CDN. The trekker's preparation now holds the page for up to ~0.6-0.8 s in one go
while the poster is showing (the page can't be scrolled yet, but the "Skip" button and the menu don't answer
during it). Chrome keeps prepared shaders on disk, so a second visit is faster than these first-visit numbers.

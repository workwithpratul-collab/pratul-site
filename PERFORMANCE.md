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

## New ideas round: loader, footer, wordmark, hiding top bar, trekker greetings (Nov 25)

**How it was measured.** The same way as the polish round: the local gzip server (scratchpad tool), libraries
from the real jsDelivr CDN, Chrome with the real graphics card (RTX 3050 laptop, ANGLE on Direct3D 11), 1440 x 900,
the shader cache switched off (a first visit). "Before" is commit `190e80a` (the end of the polish round), served
side by side with the new version and run alternately, 5 runs each. "Live" = the film can be scrolled
(`ascent:ready`); "shown" = the loading screen starts to dissolve into it (new). Smoothness right after going
live = every frame for 2 s, scrolling gently. The climb = the whole film dragged through in ~950 frames.

| What | Before | After |
|---|---|---|
| Page open -> live film (median of 5) | 2.67 s (2.66-2.73) | **2.59 s** (2.57-2.67) |
| Main-thread blocking before live (median) | 1.27 s | 1.17 s |
| Longest single block before live | 0.49-0.54 s | 0.49-0.52 s |
| First paint | 0.57-0.63 s (the poster) | 0.59-0.70 s (the loading screen, 0% and the bare mountain) |
| Film shown to the visitor | poster cross-fades from "live" (1.2 s fade) | live + 0.65 s (the loader glides to 100%), then a 1.1 s dissolve |
| 2 s after live: p95 frame / worst / frames over 33 ms | 8.5-8.9 ms / 41-43 ms / 1 | 8.6-8.9 ms / 45-69 ms / 1 |
| Climbing the whole film: median / p95 frame | 6.9-7.2 ms / 8.8-11.7 ms | 7.1-7.3 ms / 11.6-12.6 ms (run-to-run noise) |
| Top bar sliding in and out over the film (3 cycles) | (it never showed during the film) | 7 ms worst after the first scroll |
| Desktop download before live | 2,302 KB | 2,312 KB (the loader's two small pictures; the poster is no longer fetched) |
| Phone first load: total / first paint | 241 KB / 1.44 s | 245 KB / 1.39 s (+3 KB of HTML; no loader, footer or brand files) |

**Three stutters the check found, and fixed before committing** (all only visible on a first visit, when the
graphics card prepares something for the first time over the live 3D scene):
1. **The top bar's background blur over the moving film: 90-290 ms on every slide** (not only the first). Over
   the film the bar now has a denser night tint and no blur; it gets its blur back once the summit has sunk into
   the page, where sliding it in and out with the blur costs nothing (measured over Work's 3D ridge and Process:
   7-14 ms worst).
2. **"Skip the film"'s background blur: ~200 ms** the first time it appeared over the live scene (it used to
   appear over the poster while loading). A denser tint, no blur. This also saves a little on every frame of the
   film, since a blur over the moving scene is redone every frame.
3. **The loader's first dissolve frame: 40-160 ms.** Fading the sliding snow window (with its mask), the full bar
   and the mist over the live film was the cost, together with the later zones' shaders being prepared at the
   same moment. As the dissolve starts, the snow window becomes a plain copy of the same painting (it is fully
   revealed by then, so it looks identical), the full bar and the mist step out, and the later zones are
   prepared 1.2 s after the dissolve starts instead of at "live".

**What the loader costs and doesn't:** it is drawn by the compositor (transforms and opacity only), so it
doesn't hold up the world being built; its script is 7 KB (3 KB compressed) and does almost nothing per frame; once it has faded
it is removed (`hidden`), so the film draws exactly as before. The film reaches "live" slightly sooner than
before, because the poster image is no longer fetched and the later zones' shader work no longer competes with
the first live frames.

**Not changed:** the remaining slow frames on the climb are the ones from before (mist skips on a fast drag, each
project video starting its decoder), and the ~80-110 ms frame ~3 s after live is the Work ridge being built
(as before).

## Fix: loading screen stuck on the live site, and reveals that play once (Nov 25)

**The stuck loading screen.** On GitHub Pages the film loaded on a first visit but the loading screen froze at
~35% on every reload or return visit. Cause: `device.js` (top of `<head>`) asks the browser to preload the film's
code before the import map had been read. With a warm cache that code arrives instantly, its `import 'gsap'` /
`'three'` can't be resolved yet ("Failed to resolve module specifier"), `site.js` fails, and the film never starts.
The import map now comes first. Measured on the live site after the fix (Chrome, real graphics card, 1440 x 900):

| Visit | Film live | Loading screen gone |
|---|---|---|
| Empty cache, 5 fresh browsers | 5.2-8.2 s (5.2, 5.3, 5.3, 7.3, 8.2; the slow ones are GitHub's CDN warming up) | 0.1-0.3 s after live |
| Reload, normal cache | 2.0 s | 2.3 s |
| Coming back, normal cache | 1.8 s | 2.1 s |

(Before the fix, both normal-cache visits never reached the film.) Locally, film live 2.8-3.1 s vs 3.1-3.3 s for
the version before (alternating runs): the loader now reaches 100% ~0.3 s after "live" instead of ~0.65 s.
Safety net (no effect on a normal load): hand over after 4 s with no progress or 8 s in all (tested with a hung and
a slow download: handed over at 5.9 s, the live film cross-faded in at 14 s when it arrived), Skip after 3 s, and
the page carries on without the film if it isn't live after 20 s.

**Reveals play once.** Each held section (the climb, Services, Work, Process) is collapsed once it has been
scrolled through, while the page is at rest: one ScrollTrigger re-measure, **12-26 ms** each (logged in
`window.__collapses`), with the scroll shifted in the same moment (anchor offset 0-0.4 px, measured at 1440 x 900
and 1366 x 768). Afterwards the page is shorter (at 1440 x 900: from ~31,400 px to ~8,200 px), so scrolling back up
is quick and the hand-over is the only scroll animation left above the sections. No cost per frame beyond one
check of an empty queue.

## Laptop round (Nov 25): 19 items

**How it was measured.** As in the polish round: the local gzip server (scratchpad tool), libraries from the real
jsDelivr CDN, Chrome 158 headless with the real graphics card (RTX 3050 laptop, ANGLE on Direct3D 11), 1440 x 900,
shader cache off (a first visit). "Before" is commit `d913035` (the last commit before this round), served side by
side and run alternately. Film start: 5 alternating runs against `d913035`, then 9 more of the current version
against `d6a27ed` (the start of the second session), which showed the same spread.

| What | Before (`d913035`) | After |
|---|---|---|
| Page open -> live film | 2.65-2.90 s, median **2.70 s** | 1.93-2.35 s in 11 of 14 runs, 3.04-3.12 s in 3; median **2.08 s** (the ~3.1 s runs happen on `d6a27ed` too: noise) |
| Download before the film is live | **2,320 KB** | **2,056 KB** (the trekker's animations: 189 KB binary instead of 554 KB JSON) |
| Main-thread blocking before live | 1.10-1.22 s | 0.43-0.57 s |
| Longest single block before live | 0.49-0.53 s | 0.15-0.17 s |
| First paint (the loading screen) | 0.59-0.69 s | 0.68-0.72 s (the full-size loader paintings) |
| 2 s right after live: p95 / worst / frames over 33 ms | 8.6-9.3 ms / 29-38 ms / 0-1 | 16.9-24.6 ms / 97-122 ms / 2-5 (see below) |
| Climbing the whole film (950 frames): median / p95 / worst | 7.0 / 8.7-8.8 / 102-104 ms (`d6a27ed`) | 7.0 / 8.8 / 100-105 ms, same single mist skip |
| Services, first visit, gliding through (1440 x 900) | 8-9 frames over 33 ms, worst 570-595 ms | 2 frames, worst 42-49 ms |
| Services, first visit (1366 x 768) | 8 frames, worst 599 ms | 3 frames, worst 56 ms |
| Services warm-up while resting on the summit hero | (none) | first visit: ~6 slow frames, worst ~0.7 s, on the still hero; later visits: 0 over 33 ms (worst 29-31 ms) |
| Film lag behind the scroll, worst (3 starts x 12 speeds) | 1.37-1.40 s (a steady 5-6 px/frame jog) | **1.10 s**, then the mist covers the jump; 1-4 px/frame unchanged, no new mist skips |
| Fonts | 4 self-hosted subset woff2, 82 KB | unchanged (no Google Fonts anywhere) |
| Phone page | | pixel-identical (About, footer, case pages checked at 390 x 844); index.html +0.4 KB and home.css +0.6 KB compressed (the laptop-only About and footer lines) |

**Notes.**
- **Smoothness right after the film appears got worse** (2-5 frames over 33 ms instead of 0-1). This came with items
  4 + 5, which moved the ridge, meadow and summit building to just after "live" in small pieces, to start the film
  ~0.6 s sooner without freezing the loading screen. The cost is a few 100-120 ms frames in the first 2 s, while
  the opening wave plays. It was the same at the start of the second session (`d6a27ed`), so items 7-19 didn't
  add to it. Logged in POLISH-BACKLOG.md.
- **Services (item 13):** the graphics driver's one-off work is not gone, it moved: the stage is drawn at 0.5%
  opacity for a few frames once the visitor rests on the summit hero, so the stalls happen over a still picture
  (only the trekker's breathing moves). Chrome keeps that work on disk, so later visits don't pay it at all.
- **Fonts (item 7):** already done before this round. Trimming Manrope to 400-600 saved 2.4 KB and was identical on
  laptops, but redrew some letter edges on phones at 2x, so the original file was kept.
- **Fast scrolling (item 9):** the film keeps 3 s of scroll history (a few hundred numbers) and checks it once per
  frame; the climb's frame times are unchanged.

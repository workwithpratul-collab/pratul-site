# Pratul — "The Ascent" portfolio site

## Who I am
I'm Pratul, a web developer learning as I build. Explain every new idea in plain words,
go a little slower, and keep the code simple and readable. Add short comments that say
*why* a piece of code exists, not just what it does.

## The project
My personal portfolio site. Its homepage is a real-time 3D film called **"The Ascent"**:
one continuous camera shot of an imagined Himalayan trek, driven by scrolling.

- **Scene 1, base camp (night):** dark oak and pine forest, glowing orange tent, lantern, stars.
- **Scene 2, the ridge trail (pre-dawn):** grassy ridge, snowy range across the valley.
  My projects are tents ("camps") along the trail, each playing a short video of the site.
- **Scene 3, the meadow (first light):** rolling alpine grassland. My story, and the "gear check"
  where trekking gear stands for my skills.
- **Scene 4, the summit (sunrise):** snow peaks above a sea of clouds; "Book a call" is the flag.

Light moves from night to sunrise as you climb. My anime-style character
(`assets/pratul-trekker.vrm`) walks the trail as you scroll.

## Quality bar
Benchmark: my King's Garden site. This must be clearly better: sharper, smoother, more beautiful.
- **Painted, stylised look**, not realistic: soft colours, layered misty ridges, simple shapes.
  See `references/` (style-1 to style-4 show the style; basecamp, ridge, meadow, summit show mood).
- **Sharp on every screen:** render at the device pixel ratio (cap at 2 on phones).
- **Smooth:** 60 fps on my PC. Slow, gentle camera moves. Never dizzying.
- **Text is real HTML** layered over the 3D canvas, never baked into images.
- **Sound:** none for now. Later only soft ambience, off by default. Never swoosh effects.

## Tech rules
- Plain HTML, CSS and JavaScript. **No React, no Next.js, no build step.**
- Libraries load as ES modules from a CDN using an import map, with pinned versions:
  three, @pixiv/three-vrm, gsap (+ ScrollTrigger), lenis.
- Run locally with VS Code's Live Server extension (3D files don't load from file://).
- Keep files small and organised:
  - `index.html`, `css/style.css`
  - `js/main.js` (starts everything), and one file per part of the world in `js/world/`
    (sky.js, terrain.js, forest.js, mist.js, camp.js, trekker.js, cameraPath.js)
  - also in `js/world/`: journey.js (the film's script: places, stops, light), ridge.js, grass.js,
    meadow.js and summit.js (one per zone), palette.js (colours), glsl.js (shader helpers)
- Desktop first. The mobile version comes later (Phase 7), so don't over-optimise for phones yet.

## Folders
- `content/site-copy.md`: all site text (headlines, story, services, projects)
- `recordings/`: dermae.mp4, kings-garden.mp4, trinetra.mp4
- `references/`: mood images and websites.txt
- `assets/`: pratul-trekker.vrm and other 3D files

## How we work
Build in small steps. After each step, stop, tell me what to look at in the browser,
and explain what the new code does in 3–5 simple sentences. Commit to Git after each
working step with a clear message.

## Rules of the look
Locked in Phase 2. Every future step must follow these. See `style-guide.html` for the palette,
type, components and style frames; colours live in `js/world/palette.js` (world) and
`css/tokens.css` (interface).
1. **Paint, don't render.** Surfaces are soft gradients of chosen colours. No photo textures, no visible
   facets, no shiny highlights, no hard edges between light and shade.
2. **No black, no hard shadows.** The darkest value in a scene is that scene's deep colour (navy at night,
   lilac at sunrise). Shade is a cooler colour, never a darker grey.
3. **Warm means light.** Saturated amber, orange and gold come only from light sources: tents, lanterns,
   the sun, and the summit flag ("Book a call"). Everything else stays soft and cool.
4. **Distance is paler.** Every layer further away leans towards the horizon colour, so the world reads as
   stacked painted layers, with mist gathering low between them.
5. **One palette, one place.** World colours only from `palette.js`, interface colours only from `tokens.css`.
   Never type a colour straight into a scene file.
6. **The light moves as one.** Sky, fog, mist, key light, trees and the trekker change together through
   `setClimb()` in `palette.js`. Never animate one of them on its own.
7. **Calm motion only.** Slow, eased camera and interface moves (ease out, 300 ms or more). Nothing bounces,
   flashes, shakes or swooshes.
8. **Small figure, big world.** The trekker is a small warm note in a large, quiet landscape. Leave open sky,
   and keep text as real HTML in the calm parts of the frame.

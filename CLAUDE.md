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

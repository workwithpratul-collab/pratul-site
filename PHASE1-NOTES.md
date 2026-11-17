# Phase 1 notes: how "The Ascent" proof of concept works

One short note per step. Read them in order; each builds on the last.

## Step 1: Project setup
We made the folders from CLAUDE.md and turned the project into a Git repository so every step is saved.
`index.html` has three layers: the `<canvas>` where 3D is drawn, an `#overlay` for real HTML text, and a tall
`#scroll-track` that gives the page something to scroll through. The **import map** is a small JSON list that tells the
browser "when code asks for `three`, fetch it from this exact CDN address and version". Pinning versions means the site
never breaks because a library changed. `css/style.css` resets browser spacing, fixes the canvas behind everything, and
sets the dark night background.

## Step 2: The four basics
Every three.js page needs four things: a **scene** (the box that holds objects), a **camera** (our eye), a **renderer**
(turns the scene into pixels) and a **light** (so solid shapes are visible). The renderer draws at your screen's pixel
ratio, capped at 2, which is why the picture stays sharp on high-resolution screens without wasting GPU power.
`outputColorSpace = SRGB` makes colours on screen match the colours we type. A resize handler updates the camera and
canvas size whenever the window changes, and the FPS counter (add `?fps` to the address or press F) counts how many frames
are drawn each second. The `tick` function is the loop: it runs before every screen refresh and redraws the world.

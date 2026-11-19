# DESIGN.md: "The Ascent", premium edition

The design system for the whole homepage: the film, the hero and every section below it. It keeps the
brand from the mockups (references/mockups/) and the Rules of the look in CLAUDE.md, and drops the
template patterns listed in DESIGN-AUDIT.md. Everything later follows this file.

## 1. Story

**Climb at dawn, walk back to camp at dusk.** The film climbs from night to sunrise. The hero is the
summit at sunrise, live. The page below it is the rest of that day on the mountain: each section sits a
little later in the light, until the contact section is back at a glowing tent under the first stars.

| Place on the page | Moment | Light |
|---|---|---|
| Film | the climb | night → pre-dawn → first light → sunrise |
| Hero | the summit | sunrise: navy sky, peach horizon, lavender cloud sea |
| Services | above the clouds | clear morning, cool lilac |
| Work | the prayer-flag ridge | dusk, the one warm panel is lit by lanterns |
| Process | the trail down | evening, the ridge line glows as it draws |
| About | a rest on the way | late golden light on the portrait |
| Tools | lanterns at the summit | night, lanterns are the only warm light |
| Contact | back at camp | night, the tent glows |
| Footer | stars | deepest night |

The page background is **one continuous gradient** (`--page-arc`) running through these moments, so there
is never a straight edge between sections. Paintings dissolve into it with soft masks.

## 2. Palette

Interface colours live only in `css/tokens.css`; world colours only in `js/world/palette.js`.

| Token | Value | Use | Contrast on `--night` |
|---|---|---|---|
| `--night` | `#1C1A33` | page base, deep indigo | |
| `--plum` | `#221D36` | deeper plum moments (work, footer) | |
| `--dusk` | `#2A2442` | raised surfaces (form fields, frames) | |
| `--cream` | `#F3ECE2` | primary text | 14.4 : 1 |
| `--lavender` | `#B8AED6` | secondary text (body copy under headings, captions) | 8.1 : 1 |
| `--lavender-quiet` | `#9D93C2` | labels and measurements only (never long text) | 5.9 : 1 |
| `--amber` | `#F6A04D` | emphasis only: the italic accent word, the primary button, the summit flag, focus | 8.1 : 1 |
| `--amber-ink` | `#1C1A33` | text on amber | 8.1 : 1 |
| `--line` | cream at 14 % | hairlines | |

Rules: amber is light (Rule 3), so it appears once or twice per screen at most. No grey anywhere: shade
is a cooler, deeper indigo. Text never sits on a painting without the painting being calmed under it
(a soft mask or a calm band), and every text/background pair meets WCAG AA.

## 3. Type

| Role | Face | Size (desktop → phone) | Line height | Notes |
|---|---|---|---|---|
| Display | Zodiak 400 | `clamp(52px, 7.4vw, 112px)` | 0.98 | hero and film title lines; `-0.025em` |
| Display italic | Zodiak 400 italic | same | | one accent word per heading, in amber |
| Heading | Zodiak 400 | `clamp(40px, 5vw, 76px)` | 1.02 | section headings (varies by section on purpose) |
| Line | Zodiak 400 | `clamp(28px, 3vw, 44px)` | 1.1 | service names, pull lines, film story lines |
| Body | Switzer 400 | `clamp(17px, 1.15vw, 18px)` | 1.6 | measure 60-68ch |
| Lead | Switzer 400 | `clamp(19px, 1.5vw, 22px)` | 1.5 | one per section at most |
| UI | Switzer 500 | 16px | 1 | buttons, nav |
| Label | Switzer 500 | 14px | 1.35 | chips, small captions (14px is the floor) |
| Measure | JetBrains Mono 400 | 14px, `0.12em` caps | 1.3 | only real measurements: altitude, time, counts |

Four woff2 files, self-hosted in `assets/fonts/`, subset to Latin + typographic punctuation (65 KB in
all). `font-display: swap`; only Zodiak regular is preloaded; fallbacks are metric-matched
(`size-adjust` and overrides on Georgia, Arial and Consolas) so nothing shifts when the fonts land.
Headings use `text-wrap: balance`, body `text-wrap: pretty`.

**Why these:** Zodiak has sharp wedge serifs and ink traps, so the big lines feel carved and alpine
rather than bookish, and its italic gives the one amber word real character. Switzer is a quiet,
precise grotesk that stays readable at 17px on dark. Mono is kept for numbers that are measurements
(the altitude meter speaks like an instrument), never as costume.

## 4. Space

One fluid scale, 8px based. Sections breathe; groups inside them are tight.

| Token | Value |
|---|---|
| `--s-1` … `--s-4` | 4, 8, 12, 16 px |
| `--s-5` | `clamp(20px, 2vw, 24px)` |
| `--s-6` | `clamp(28px, 3vw, 40px)` |
| `--s-7` | `clamp(40px, 5vw, 64px)` |
| `--s-8` | `clamp(64px, 8vw, 120px)` |
| `--s-9` | `clamp(96px, 13vw, 200px)` (between sections) |
| `--gutter` | `clamp(16px, 5vw, 96px)` (page side margin; 16px on phones) |

Content width: 1320px max. Body text column: 62ch max.

## 5. Motion

One family: **expo-style ease-out for arrivals, sine in-out for anything continuous.**

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | every arrival, hover, focus |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | scrubbed scroll motion, camera |
| `--t-fast` | 320ms | hover, focus |
| `--t-base` | 700ms | reveals |
| `--t-slow` | 1400ms | line reveals, hero settle |
| GSAP | `expo.out`, `sine.inOut` | the same curves in JS (`EASE` in js/ui/motion.js) |

Rules: nothing under 300ms, nothing bounces, flashes or swooshes. Only transform, opacity, clip-path and
mask move. Text arrives line by line (SplitText, lines masked, 1.4s, 90ms between lines), and only the
lines that matter do; body copy fades as a block. Every motion has a `prefers-reduced-motion` version
that simply shows the end state (or a 300ms fade).

## 6. Signature moments (one per section)

| Section | Signature | How it stays cheap |
|---|---|---|
| Film | Each text beat is composed into its shot (never over the trekker, a landmark or the sun) and set line by line with SplitText. | DOM text, transform/opacity only |
| Hero | **Hero ambience** (ThreeUI Background-style): lavender and amber motes drift slowly through the summit air, behind the text side kept faint. Clouds drift, the flag waves, the trekker breathes. | one instanced points draw, shader-driven; idle frame < 4 ms |
| Services | An editorial list: each service is a large line of display type. Hover or focus reveals a painted detail of the matching piece of gear (camera, lantern, compass, rope, watch), unmasked with clip-path beside the line. | 5 small WebP images, loaded when the section nears |
| Work | **The prayer-flag ridge**: framed project panels hang along a curved ridge at dusk; scrolling dollies the camera along it, the front panel lit warm and sharp, the rest racked out of focus into fog. | the shared renderer; blur is a pre-blurred texture mix, not post-processing |
| Process | The trail: a glowing ridge line draws itself as you scroll; each stage lights up as the line reaches it. Text sits on a calm band below. | one SVG path, stroke-dashoffset scrubbed |
| About | A magazine spread: the portrait dissolves into the page through a soft mask that opens as you arrive. | CSS mask, one image |
| Tools | **Lanterns at the summit**: seven tool logos glow as lanterns on a slow tilted orbit, always facing you; the front one is largest and brightest. | the shared renderer; billboarded sprites + a sprite glow |
| Contact | The tent's lantern brightens as the section arrives: back at camp. | one opacity transition |
| Footer | Calm. Faint stars. | static |

Only one 3D moment runs at a time, each pauses off-screen, and each has a reduced-motion and a phone
version (phones never load three.js).

## 7. Components

- **Buttons:** primary = amber pill, `--amber-ink` text, 52px tall (44px min target). Secondary = text
  link with an underline that draws from left on hover. No ghost pills next to primary pills.
- **Nav:** one bar everywhere: Pratul | Work, About, Process | Book a call. Transparent over the hero,
  a soft blurred indigo bar after it.
- **Focus:** a 2px amber outline, 3px offset, on everything focusable.
- **Browser surfaces:** amber text selection on indigo, amber caret, a thin indigo scrollbar.
- **No** eyebrow labels, icon card grids, numbered step rows, pulsing dots, newsletter boxes.

## 8. Performance rules (part of the design)

- Budget: Lighthouse 95+ desktop / 90+ phone; LCP < 1.8 s / 2.5 s; CLS < 0.05; INP < 200 ms;
  JS before 3D < 180 KB gz (desktop), < 120 KB (phone); 4 font files.
- First paint is HTML text over a poster image of the exact first frame. three.js and the world load
  after first paint (dynamic `import()`) and cross-fade in.
- **One WebGL renderer, one canvas** for the film, the hero and both carousels; each view draws into its
  own part of the screen. Pixel ratio `min(devicePixelRatio, 1.75)`.
- The loop pauses when nothing 3D is on screen and when the tab is hidden.
- Images: WebP/AVIF with `srcset`/`sizes`, explicit width/height, lazy below the fold; only the poster
  is preloaded.
- Never animate layout properties; no scroll handlers that read and write layout in the same frame.

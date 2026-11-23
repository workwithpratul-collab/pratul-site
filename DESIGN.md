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
| Work | the prayer-flag ridge | the summit darkens and blurs, and the ridge forms out of it: the work is the first thing after the hero (proof first). The one warm panel is lit by lanterns |
| Services | above the clouds | cool lilac |
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
| Display | Instrument Serif 400 | `clamp(56px, 7.8vw, 120px)` | 1.05 | hero and film title lines; `-0.005em` |
| Display italic | Instrument Serif 400 italic | same | | one accent word per heading, in amber ("move") |
| Heading | Instrument Serif 400 | `clamp(44px, 5.4vw, 84px)` | 1.08 | section headings |
| Line | Instrument Serif 400 | `clamp(30px, 3.3vw, 48px)` | 1.1 | service names, pull lines, film story lines |
| Body | Manrope 400 | `clamp(17px, 1.15vw, 18px)` | 1.6 | measure 60-68ch |
| Lead | Manrope 400 | `clamp(19px, 1.5vw, 22px)` | 1.5 | one per section at most |
| UI | Manrope 500 | 16px | 1 | buttons, nav |
| Label | Manrope 500 | 14px, `0.12em` caps (`.measure`) | 1.35 | chips, counts, the showreel time (14px is the floor) |
| Altitude | JetBrains Mono 400 | 14px, `0.12em` caps (`.alt`) | 1.3 | **only** altitude numbers: the meter, "Alt. 4,410 m", "2,850 m" |

**Line heights never go below 1.05** (descenders in y, g, p, j, q need the room), and every clipping
reveal mask (`.split-line-mask`, the opening's `.line`) has room inside it: 0.15em above, 0.2em below,
0.12em at the sides, with equal negative margins so nothing moves. Headings are split into lines only
after the fonts load.

Four woff2 files, self-hosted in `assets/fonts/`, Latin subset, only the weights used (86 KB in all):
Instrument Serif regular and italic, Manrope variable (400-600, one file), JetBrains Mono 400.
`font-display: swap`; Instrument Serif regular and Manrope are preloaded; fallbacks are metric-matched
(`size-adjust` and ascent/descent overrides on Georgia, Arial and Consolas, measured in the browser) so
nothing shifts when the fonts land. Headings use `text-wrap: balance`, body `text-wrap: pretty`.

**Why these:** Instrument Serif is slim and high-contrast: big lines read as quiet, editorial titles,
and its italic gives the one amber word grace without shouting. Because it is narrow, sizes sit a step
above a book serif and tracking stays near zero. Manrope is open and slightly rounded: friendly and
very legible at 15-18px on the dark indigo, and its 500 carries buttons and nav. Mono is kept for one
job, altitude, so the mountain's numbers read like an instrument.

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

**One section, one screen (desktop).** Every section fills exactly the window under the top bar
(`height: 100svh`) at 1440x900, 1366x768 and 1536x864, and down to 1280x720: headings, line sizes and
gaps follow the window height as well as its width (`min(…vw, …vh)` inside each clamp), with a short-screen rule
below 800 px tall. Work and Process are pinned screens; the open contact form takes a column beside
the heading.

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
| Hero | **Hero ambience** (ThreeUI Background-style): lavender and amber motes drift slowly through the summit air, behind the text side kept faint. Clouds drift, the flag waves, the trekker breathes. Laid out on a three-row grid (top bar, words, altitude), sized by width and height, so nothing overlaps from 1280x720 up. | one instanced points draw, shader-driven; idle frame < 4 ms |
| Hand-over | **The last shot holds**: the screen stays pinned while the summit softly blurs and dims into the page colour, the hero's words lift away, and the work's heading forms line by line over it; then the ridge fades in. Nothing scrolls in. Scroll lengths live in css/style.css (--hold, --darken, --form). | the blur is one quarter-size snapshot blurred once and faded by opacity; the film stops drawing once covered |
| Services | An editorial list: each service is a large line of display type. Hover or focus reveals a painted detail of the matching piece of gear (camera, lantern, compass, rope, watch), unmasked with clip-path beside the line. | 5 small WebP images, loaded when the section nears |
| Work | **The prayer-flag ridge**: framed project panels hang along a curved ridge at dusk; scrolling dollies the camera along it, the front panel lit warm and sharp, the rest racked out of focus into fog. | the shared renderer; blur is a pre-blurred texture mix, not post-processing |
| Process | **The night trail** (pinned): one screen holds while scrolling walks an amber trail up a painted ridge in three layers (far painting, middle ridge, near slope) that drift at different paces; five waypoints (Understand, Explore, Build, Launch, Refine) light as the trail's lantern reaches them, and the current stage rises into the reading column. Same moment on phones (the trail reframed to fit a tall screen). | CSS sticky, no library; one layout read and transform/opacity writes per frame, only while on screen; reduced motion shows one still screen with every stage |
| About | A magazine spread: the portrait dissolves into the page through a soft mask that opens as you arrive. | CSS mask, one image |
| Tools | **One tool in the light** (after King's Garden's 3D loop): seven tool logos stand on a slow tilted oval; the loop holds one at the front (large, lit, named, one plain line) for 2.4 s, then glides 1.2 s to the next while the rest recede. Logos only move and scale, never turn: always facing you, never mirrored. Pauses on hover, focus and touch. | plain HTML/CSS, transform and opacity only, runs only on screen (no WebGL); reduced motion: a still row |
| Contact | The tent's lantern brightens as the section arrives: back at camp. | one opacity transition |
| Footer | **Base camp under the stars**: the name large, one line, three short labelled columns (Explore, Elsewhere, Say hello), no newsletter; a range of three ridges (distance paler) rises softly out of the night as it arrives, the last line on the nearest ridge, and "Back to the summit". | inline SVG, one transform/opacity transition, once |

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

## 9. The phone version (references/mockups/5-phone-v2.png)

Phones and portrait tablets get no film and no 3D (js/device.js). Their page is built to the mockup
`5-phone-v2.png`, with two deliberate differences: About shows the real facts (6 websites built,
1+ year building and learning, worldwide from India) instead of "3+ Years, 10+ Projects", and the
work heading is "Work that speaks for itself." with each project's honest label (Concept / Pitch demo).
"Insights" is not in the menu (there is no blog). Process and Tools keep their desktop moments,
recomposed for a tall screen.

### Palette (phone)
Read from the mockup's swatches; tokens in `css/tokens.css` (`--m-*`).

| Token | Value | Role |
|---|---|---|
| `--m-navy` | `#29243A` | deepest ground, text on peach |
| `--m-plum` | `#513851` | card washes, painted ridges |
| `--m-mauve` | `#9C636D` | lit flanks of the painted ridges |
| `--m-peach` | `#FDB47B` | the one accent: buttons, eyebrows, "move", stats, icons (a lantern's light) |
| `--m-cream` | `#F3DFCD` | the arrow discs on work cards, snow |

Body text stays cream (`--cream`) and secondary text lavender (`--lavender`, `--lavender-light`).

### Type (phone)
Instrument Serif for headings (hero 36-60 px, sections `--t-heading`, card titles 27 px) and Manrope
for everything else (body 15-17 px, menu links 24 px). The **eyebrow** (13 px Manrope 600, 0.22em
capitals, peach) appears on phones only, above the hero and each section heading, as the mockup has
it; desktop keeps the no-eyebrow rule.

### Layout (phone)
One column, 16 px side gutter, sections separated by `--s-8`. Order: hero, work, services, process,
about, tools, contact, footer.

- **Top bar:** the peaks mark and "Pratul" left, a three-line menu button right (44 px). No button in
  the bar: "Book a call" lives in the menu.
- **Menu (open):** a full-height panel (`--m-panel`, blurred): Work, About, Process at 24 px, then
  the peach "Book a call" pill, over a range of peaks at the foot. Links rise in 60 ms apart.
- **Hero:** eyebrow, headline, line, then two stacked 272 px pills (peach "Explore my work", outlined
  "About me"); the summit painting below them (set 9 % of the screen low so the trekker and flag
  stand under the buttons); "The summit / Alt. 4,410 m" bottom left and a round down button bottom right.
- **Work:** eyebrow, heading, filter chips (All, Websites, Stores, Experiences; 44 px; the pressed one
  peach), then one card per project: screenshot (16:10), a cream arrow disc, name, kind with the
  honest label, one line.
- **Services:** eyebrow "What I can build", "Digital experiences for modern businesses.", three cards
  (Business Websites, Online Stores & Booking, Scroll Films & 3D): line icon, title, one line, a round
  arrow, and a small painted scene in the corner. Tapping one opens the form with that need chosen.
- **About:** eyebrow, "I'm Pratul, a web designer and developer.", the portrait as a rounded card,
  one paragraph, a hairline, three facts in a row split by hairlines (peach serif figures).
- **Contact:** eyebrow "Let's build together", "Have a project in mind?", one line, then the form:
  name, email, "What do you need?" menu, message, each with its icon inside the field (the real
  labels stay for screen readers), a full-width peach "Send message", and a painted range below.

### Components (phone)
- **Cards:** 18 px radius, 1 px cream-at-14 % border, a plum-to-navy wash. They lift 2 px and glow
  peach on tap (and hover).
- **Fields:** 52 px tall, 12 px radius, the icon 16 px in, text from 48 px.
- **Buttons:** peach pill with navy text; outlined pill (peach line) for the second action.

### Motion (phone)
Section blocks fade up once as they arrive; the hero painting drifts slower than the page (parallax);
a thin peach progress line runs along the top edge; cards lift on tap. No library: CSS transitions
and one scroll read per frame (js/mobile/mobile.js). Everything rests under "reduce motion".

### Checks
No sideways scroll at 320, 360, 390 and 430 px; no clipped text at 390x844; every tap target 44 px.


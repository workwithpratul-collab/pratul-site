# Design audit (Part 1)

The site as it stood at commit `db473aa`, before the premium redesign. Every finding has an ID; later
parts resolve them and the last column says how. Screenshots were taken at 1440 x 900 (desktop film) and
390 x 844 (phone).

**Method.** `⚠️ DEGRADED: single-context` (the brief asked for no questions and a single uninterrupted
run, so Impeccable's two assessments ran one after the other in this conversation instead of as two
isolated helpers). Assessment A: a design-director read of every screen. Assessment B: Impeccable's
detector (`impeccable detect index.html`: 8 warnings), plus a Lighthouse accessibility pass. Taste's
redesign audit and genjutsu's generic-tells list were applied by hand as checklists. Questions skipped:
the brief says not to ask anything.

## Verdict

**Specificity: half authored, half template.** The film is genuinely Pratul's (a painted night-to-sunrise
trek, the trekker, camps as projects) and nothing else on the web looks like it. Everything after the film
is a dark SaaS template wearing the brand's colours: eyebrow label + serif heading + right-hand lead
paragraph, then four identical icon cards, then a numbered four-step row. Swap the copy and it could sell
any agency. The film's own text is set like subtitles: small, faint, often over the busiest part of the frame.

**Heuristics** (Persuade/Experience surface; 7 and 10 scored n/a):

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Loading curtain shows real progress; but the page freezes ~2.5 s after it lifts |
| 2 | Match with the real world | 4 | The trek metaphor is clear and consistent |
| 3 | User control and freedom | 3 | "Skip film" exists but is a 11 px mono label in a corner |
| 4 | Consistency and standards | 2 | Two different heroes (film greeting, summit hero), two type voices, two navs at the hero |
| 5 | Error prevention | 3 | Form validates kindly |
| 6 | Recognition rather than recall | 3 | Nav is clear; work slider count is clear |
| 7 | Flexibility and efficiency | n/a | Portfolio |
| 8 | Aesthetic and minimalist design | 2 | Film is beautiful; sections are generic and over-labelled |
| 9 | Error recovery | 3 | Form errors are specific; placeholder links explain themselves |
| 10 | Help and documentation | n/a | Portfolio |
| **Total** | | **23/32** | Acceptable, not premium |

## Findings

### Global

| ID | Finding | Severity |
|---|---|---|
| G1 | **Eyebrow label over every heading** (mono caps + amber rule: "What I can do for you", "Selected work", "My process", "About me", "Tools I use", "Let's build together"). The single strongest template tell. | P1 |
| G2 | **Same composition repeated**: left serif heading, right lead paragraph (Services, Process, Tools). No section has its own layout idea. | P1 |
| G3 | **Four font families** (Instrument Serif, Newsreader, Manrope, IBM Plex Mono), 7 files, 347 KB, from Google, render-blocking. Two serifs fight: condensed Instrument in the film, bookish Newsreader in the sections. | P1 |
| G4 | **Text too small**: 11 px and 12 px used 14 times in home.css (chips, stats labels, tags, footer, mono labels); body 15-16 px. | P1 |
| G5 | **Faint text**: `--ink-muted` is cream at 68 % and `--ink-faint` 38 % opacity; over the painted backgrounds secondary text drops below AA (Lighthouse flags colour contrast on desktop). | P1 |
| G6 | **Hard straight edges** where painted images meet the page: the services mountain band, the contact painting's top edge, the about photo's left and bottom edges. | P2 |
| G7 | **Section heading sizes are all the same** (`clamp(36px, 4.2vw, 60px)`), so nothing leads and the page has no rhythm of big and small moments. | P2 |
| G8 | **Reveal motion is the same everywhere** (16 px fade-up, 600 ms) and applied to every element, so it reads as a library default. | P2 |
| G9 | Detector: radial-gradient halo on the dark page (hero glow). | P3 |

### The film (desktop)

| ID | Finding | Severity |
|---|---|---|
| F1 | **Opening headline**: italic "Hi, I'm Pratul." over a condensed serif statement (detector: italic serif display). Tight leading, sits over the moon and the far peaks; the copy ("stand out ... refuse to blend in") is a cliché. | P1 |
| F2 | **"Selected work" moment**: eyebrow + h2 + a 15 px lead paragraph laid over the treeline; the paragraph crosses dark trees and pale sky at once. | P1 |
| F3 | **Story lines at the meadow** ("That's how I see websites too...") are small body text over a bright, busy hillside: barely readable in daylight. | P0 |
| F4 | **Landmark labels** are a tiny mono strip (name · type · tag) under each project: they read as metadata, not as the name of the work. | P2 |
| F5 | **Altitude meter and "Skip film"**: 11-12 px mono, low contrast, easy to miss. Skip is the only escape from a 13-screen film. | P1 |
| F6 | **Scroll hint** "Scroll to begin the climb": tiny mono at the bottom centre, competes with nothing but is hard to see. | P2 |
| F7 | **Text pops in** with CSS opacity fades tied to scroll ranges; no line-by-line reveal, no sense of being typeset into the shot. | P2 |
| F8 | **Final summit shot** frames the trekker in the centre with the flag beside him and a pale sky: it doesn't leave the calm left side the hero text needs, and the colours don't match the mockup (no navy top, no peach horizon, sun too high). | P1 |

### The hero

| ID | Finding | Severity |
|---|---|---|
| H1 | **Duplicate hero**: a static summit painting cross-fades over the live 3D summit, so the film's last shot is thrown away and replaced by a picture of itself. | P1 |
| H2 | **Two navs** overlap during the hand-over (film overlay + top bar); the top bar is shown by a `setInterval` poll. | P1 |
| H3 | Subtext is lavender at low opacity over the bright cloud sea: weak contrast. | P2 |
| H4 | Detector: the drifting CSS "cloud" layer reads as a marquee loop. | P3 |

### Sections

| ID | Section | Finding | Severity |
|---|---|---|---|
| S1 | Services | **Four identical icon cards** (icon, title, two lines) in a row. Generic, and the card text is 14 px at 68 % opacity. Big empty band under the cards. | P1 |
| S2 | Services | Copy is interchangeable ("Website Design: clean, modern and brand-focused designs") and drifts from site-copy.md's own five services. | P2 |
| S3 | Work | "Work that speaks for itself" is a cliché heading. Slides are cards inside a card; the next slide peeks in cut off at the right edge. | P2 |
| S4 | Work | Was the source of the 3,000 px sideways scroll (fixed in db473aa, must stay fixed). | P1 |
| S5 | Process | **Numbered step row** (icon, 01, title, line) x4: the exact pattern the brief bans. Glowing dots pulse forever (detector: pulsing dot). | P1 |
| S6 | Process (phone) | **Overlap bug**: the lead paragraph runs into the first row of step icons. | P0 |
| S7 | About | Photo has hard edges; chips and stat labels are 12 px; stats sit in a thin column that reads as an afterthought. | P2 |
| S8 | Tools | CSS 3D ring is small, cramped (detector: cramped padding on every tile), tiles turn their backs to the viewer, and "Always evolving" is filler. Large empty area around it. Caused long paint frames while scrolling. | P1 |
| S9 | Contact | Straight top edge on the painting; buttons sit on the busiest part of the image on narrow screens. | P2 |
| S10 | Footer | Plain three-column footer; six social links of which four are placeholders. | P3 |

### Phone

| ID | Finding | Severity |
|---|---|---|
| M1 | Hero subtext ran over the bright sun and "About me" sat on the flag (fixed in db473aa; must stay fixed). | P1 |
| M2 | "Book a call" missing from the top bar (fixed in db473aa; must stay fixed). | P1 |
| M3 | Sections are the desktop layout stacked: service cards in a 2 x 2 grid of tiny text, process in a 2 x 2 grid. | P2 |
| M4 | Tools ring on the phone shows overlapping tiles with a large dead area. | P2 |

## What's working (keep)

1. The film itself: one continuous painted shot, light moving from night to sunrise, the trekker as a small
   warm note. Nothing else in the category does this.
2. The palette: deep indigo, cream, one amber reserved for light sources and calls to action.
3. Honesty: concept / pitch demo labels, real stats only (6 websites, 1+ year, based in India), the
   testimonial hidden until a real quote exists.

## Resolution log

(Filled in by each part: ID → what changed.)

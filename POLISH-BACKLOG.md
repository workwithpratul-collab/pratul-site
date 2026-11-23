# Polish backlog

Everything we chose to fix later. Phase 6 fixes the CLAUDE CODE items, Phase 7 the MOBILE items,
and Pratul does the PRATUL items in Phase 8.

RULE FOR CLAUDE CODE: this is Pratul's file. Only tick items or add new ones under the right heading.
Never delete items, never rewrite the file, never restore an older copy. Commit it whenever it changes.

## PRATUL: checks and decisions
- [ ] Phase 2 sign-off: review the meadow and summit style frames (style-frames.html) against base camp.
- [ ] Phase 3 recheck: scroll the full climb and compare base camp, a project camp, the meadow and the summit.
- [ ] Fast-scroll catch-up: confirm the film never lags more than ~1.5 s behind the scroll (jogging, mist skip).
- [ ] Judge the italic greeting "Hi, I'm Pratul." on screen (a design checker calls it a template look).
- [ ] Judge the summit finale: the text sits in the open sky, not beside the flag.
- [ ] Check the case-study "Key decisions" are accurate and in your own words.
- [ ] Fill in placeholders (marked TODO(Pratul) in the files): SITE_URL, FORMSPREE_ENDPOINT, YOUR_EMAIL, BOOKING_LINK, WHATSAPP_NUMBER, each project's YEAR and LIVE_URL_*, contact-form budget ranges.
- [ ] Test with a real screen reader (Windows Narrator), a touch screen, and the custom cursor with a real mouse.
- [ ] After launch: replace the example score rings (98 / 100) with real Lighthouse scores.
- [ ] Optional: download a ground-sitting Mixamo loop as assets/animations/Sitting.fbx for the gear check.
- [ ] Phase 7 check: open the mobile page on your own phone (and a friend's Android), scroll the whole climb, play with the gear check and the demos, and send the form; then open the site on a laptop and confirm the film.

## CLAUDE CODE: the world
- [x] Summit climb looks plain: smooth lilac snow, rock only as soft bands, big bland dome in the final shot.
- [x] Big pale, smooth hillside with sparse trees behind THE KING'S GARDEN and between camps.
- [x] Ground is plain: add grass and meadow detail, especially on the ridge under the cinema sheets.
- [x] Stones are all one rounded shape; add 3-4 different shapes.
- [x] Snow edges on the big far peak are blotchy and ragged.
- [x] Pine nearest the base-camp tent shows a stripy orange band; make the warm glow soft.
- [x] Far tree cards turn slightly to face the camera (fix only if it costs no speed).
- [ ] The open slope right of the path just before THE KING'S GARDEN (0.33) is still quite bare; the trail zig-zags across it, so trees can't go there without crowding the path.
- [ ] The new painted brush strokes in the ground barely show in the night light on the ridge.
- [x] Summit final shot: the middle of the knoll is still smooth snow (crags only at its edges); drifts there are too close to the snow colour to read.

## CLAUDE CODE: project camps
- [x] Sheet sway is hard to see when standing still in front of a sheet.
- [x] Canvas looks flat and grey; add warm projector light across the whole cloth.
- [x] Poles are plain sticks; add straps, lashing, tips, and pegs where the ropes meet the ground.
- [x] Opening a project: the camera glides close past the trekker's head on the way to the sheet.
- [ ] One ~60 ms frame when each landmark's video first starts playing (the browser starting a video decoder); a small hitch while the camera moves.
- [x] The trekker is large in frame at TRINETRA's sign, and the KING'S GARDEN arrival cuts him at the right edge.
- [ ] DERMAÉ's lake water is still a little saturated blue.

## CLAUDE CODE: the trekker
- [x] Feet float or sink up to ~10 cm on steep slopes (knoll, summit); needs per-foot placement (IK).
- [x] The wave is small (hand only reaches head height); may need a more open Mixamo wave.
- [x] Faint glowing outline around the body looks like a sticker.
- [x] Character file is 11.5 MB; compress textures to get it under ~5 MB.
- [ ] The eleven animation clips are 7.5 MB of FBX (Idle alone is 1 MB); a compact clip format would roughly halve that download.
- [ ] Foot placement is a simple two-bone fix: on the steepest summit spots a foot can still sit ~2 cm into the snow.
- [ ] The turn-on-the-spot steps (TurnLeft / TurnRight) were checked by their blend weights only, not filmed up close.

## CLAUDE CODE: gear check and pages
- [x] Gear items are simple shapes, less rich than the camps.
- [x] Trekker stands idle behind the gear mat (use Sitting.fbx if it exists).
- [x] Pages below the film are calm but plain; bring more of the painted world into them.
- [x] 404.html uses root paths (/css/...), so it only styles correctly from the domain root.
- [x] Fonts load from Google Fonts; self-host them.
- [ ] The painted gear images are more detailed and more realistic than the painted world around them, with warmer, saturated reds (rope, camera leather) than rule 3 allows outside light sources.
- [ ] 404.html: relative paths work at the site root or in a subfolder, but not for a missing address several folders deep (the host may need to point at 404.html).
- [x] Feedback 1: descenders (y, g, p, j, q) cut by the SplitText line masks; masks now have room below, above and at the sides, display line heights 1.05 or more (checked by a script at 1440x900, 1366x768, 390x844: 0 cut).
- [x] Feedback 2: Instrument Serif (headings, italic accent) and Manrope (body, UI), self-hosted woff2, only the weights used, metric-matched fallbacks; JetBrains Mono kept for altitude numbers only. DESIGN.md updated.
- [x] Feedback 3: film text composed per shot (top right, top left, sky centre, low left; never the trekker, landmarks, moon or sun) with no panels behind it; the scene darkens softly behind the words instead (js/world/shade.js, colours in palette.js textShade).
- [x] Feedback 4: hero on a three-row grid (no overlap between the buttons and the altitude, checked at 1280x720 to 1536x864); film-to-site hand-over: the summit holds, blurs and dims while the work forms in place.
- [x] Feedback 5: Selected work comes straight after the hero (then services, process, about, tools, contact); heading "Work that speaks for itself." with the honest labels kept.
- [x] Feedback 6: Process rebuilt as a pinned night trail with depth (Understand, Explore, Build, Launch, Refine), the same on phones.
- [x] Feedback 7: tools rebuilt as a one-in-focus loop (logos always upright, never mirrored, pauses on hover), plain HTML/CSS instead of WebGL; the same on phones.
- [x] Feedback 8: footer redesigned: calm and spaced, three labelled link columns, a mountain range fading in at the bottom, no newsletter.
- [x] Feedback 9: every section fits one screen at 1440x900, 1366x768 and 1536x864 (and 1280x720), measured by a script, including the contact form when open.
- [x] Feedback 10: phone version built to the 5-phone-v2 mockup (hero, service cards, work cards with filters, about, contact form with icons, open menu, progress line, parallax, peach palette), real About facts, "Work that speaks for itself.", no Insights; rules recorded in DESIGN.md section 9.
- [x] Feedback 2.1: Process trail rebuilt to round2/Main.dc.html: each step's words beside its own checkpoint, Phosphor icon markers (self-hosted), done / current / ahead states, no overlaps with the trail, each other or the heading (script: 10 sizes x 5 steps); phones get a reading column and the steps spread around the current one.
- [x] Feedback 2.2: About rebuilt to round2/About.dc.html: the "6 websites built" and "1+ year" numbers and the chips are gone; three value lines (Design and code, Built to be found, Worldwide) and the "Off the clock" line; the portrait fades out across its right side. Phones: values stacked, the off-the-clock label on its own line.
- [x] Feedback 2.3: film altitude meter rebuilt to round2/Meter.dc.html: one stacked label (NOW, the place name cross-fading, the altitude in amber, SUMMIT 4,410 M · X M TO GO) beside a taller progress line. The overlap came from the summit hero's own altitude label, which the hand-over timeline made visible during the whole film; it now fades through a CSS variable. Checked at 5 laptop sizes x 51 points of the climb: clear of all film text.
- [x] Feedback 2.4: phone hero to round2/Phone.dc.html: no film, the summit still with gently falling CSS snow (transform only, still under reduce motion), "I build websites" on its own line and the headline sized from the width (fits 360-440), the shorter subtext, "Explore my work" and "Watch showreel" stacked, the summit label bottom left and the round scroll button bottom right; the extra label above the headline and "About me" are gone.
- [x] Feedback 2.5: phone menu to round2/PhoneMenu.dc.html: Work, Services, Process, About, Contact in large serif, the full-width amber "Book a call", LinkedIn / GitHub / Instagram, a ridge at the foot, sized to the screen height too (fits a 375x667 phone). Every phone section checked at 360, 390, 430 and 440 px: no sideways scroll, nothing past the edges.
- [ ] Process trail: on desktop the trail sits a little left of the mockup's position so Refine's full description fits before the right edge at 1280-1440 px. Pratul to judge whether that reads right.

## MOBILE (Phase 7)
- [x] Lighter, simpler version of the film for phones and tablets.
- [x] Work cards only play video on hover, so touch screens see stills.
- [x] Top navigation hides Work / About / Contact below 640 px; needs a small mobile menu.
- [x] On a 390 px phone the page scrolls sideways: the mist veil (drawn 10% larger than the screen) and the landmark captions stick out past the edge.
- [x] The mobile opening waits for the full 2.7 MB character file: on slow 4G the live scene arrives after about 20 s (the painted still covers the wait). A mobile copy of the VRM without the 56 unused face shapes (0.6 MB) and with compressed vertex data could roughly halve it.
- [ ] Phone frame rates were measured in desktop Chrome with phone emulation (processor slowed 4x), so the graphics chip was the PC's: real phone GPU load is untested. The hero swaps to its still if frames take over 42 ms, but check it on a real mid-range Android.
- [ ] The version is chosen once, when the page loads: turning an iPad from portrait to landscape keeps the mobile page (and the reverse keeps the film) until a reload. An iPad with a mouse or trackpad attached, or a touch laptop in tablet mode, may get the other version.
- [x] Mobile project videos are the full 26-28 s recordings (0.5-0.95 MB each); a short 8-10 s loop of the best moment would cut that by more than half.
- [ ] The landmark cards are fixed stills: the video on the lake is a flat warped overlay (no ripples or reflection), and the trekker isn't in the card scenes.
- [x] Summit finale on a phone: the trekker is small at the very bottom of the frame (a little cut on tall phones), and his wave is one frozen moment of the gesture.
- [x] On an iPhone SE the moon sits just behind the "2,850 m" label of the opening.
- [ ] The scene parallax is gentle but simple: one picture drifting plus a band of CSS mist, not separately painted layers.
- [x] The painted gear on the mobile flat-lay still shows its baked lilac shadow halos (compass, rope) at this larger size.
- [x] Project pages at 360 px: the Play / Pause button covers a fair part of the small video in its frame.
- [ ] First paint on 4G varies (about 1.1 s to 3.3 s in tests) mostly with the Google Fonts stylesheet, which blocks drawing; self-hosting the fonts (listed above) would make it steady.

## Done
- [x] (P4) Pacing: 13 screen-heights plus a walking speed limit, so feet don't slide.
- [x] (P4) Camera no longer passes close behind the DERMAÉ sheet when leaving it.
- [x] (P4) Trekker no longer sits at the frame edge when leaving the meadow.
- [x] (P4) Greeting folded into the headline (no small label above it).
- [x] (P4) Altitude meter readable against the bright summit sky.
- [x] (P4) Gear-check camera moved in close (~3.5 m).

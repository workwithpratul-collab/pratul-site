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
- [ ] Fonts load from Google Fonts; self-host them.
- [ ] The painted gear images are more detailed and more realistic than the painted world around them, with warmer, saturated reds (rope, camera leather) than rule 3 allows outside light sources.
- [ ] 404.html: relative paths work at the site root or in a subfolder, but not for a missing address several folders deep (the host may need to point at 404.html).

## MOBILE (Phase 7)
- [ ] Lighter, simpler version of the film for phones and tablets.
- [ ] Work cards only play video on hover, so touch screens see stills.
- [ ] Top navigation hides Work / About / Contact below 640 px; needs a small mobile menu.
- [ ] On a 390 px phone the page scrolls sideways: the mist veil (drawn 10% larger than the screen) and the landmark captions stick out past the edge.

## Done
- [x] (P4) Pacing: 13 screen-heights plus a walking speed limit, so feet don't slide.
- [x] (P4) Camera no longer passes close behind the DERMAÉ sheet when leaving it.
- [x] (P4) Trekker no longer sits at the frame edge when leaving the meadow.
- [x] (P4) Greeting folded into the headline (no small label above it).
- [x] (P4) Altitude meter readable against the bright summit sky.
- [x] (P4) Gear-check camera moved in close (~3.5 m).

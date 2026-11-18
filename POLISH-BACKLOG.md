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

## CLAUDE CODE: project camps
- [x] Sheet sway is hard to see when standing still in front of a sheet.
- [x] Canvas looks flat and grey; add warm projector light across the whole cloth.
- [x] Poles are plain sticks; add straps, lashing, tips, and pegs where the ropes meet the ground.
- [x] Opening a project: the camera glides close past the trekker's head on the way to the sheet.

## CLAUDE CODE: the trekker
- [x] Feet float or sink up to ~10 cm on steep slopes (knoll, summit); needs per-foot placement (IK).
- [x] The wave is small (hand only reaches head height); may need a more open Mixamo wave.
- [x] Faint glowing outline around the body looks like a sticker.
- [ ] Character file is 11.5 MB; compress textures to get it under ~5 MB.

## CLAUDE CODE: gear check and pages
- [x] Gear items are simple shapes, less rich than the camps.
- [x] Trekker stands idle behind the gear mat (use Sitting.fbx if it exists).
- [x] Pages below the film are calm but plain; bring more of the painted world into them.
- [x] 404.html uses root paths (/css/...), so it only styles correctly from the domain root.
- [ ] Fonts load from Google Fonts; self-host them.

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

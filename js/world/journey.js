// journey.js: the script of the film. Pure data, no 3D code.
//
// Two things live here:
//  1. PLACES: where everything stands on the map (x, z in metres, -z = "forward", north).
//  2. THE TIMELINE: how the scroll (0 at the top of the page, 1 at the bottom) is shared
//     between the four zones, where the trekker stops, and how the light changes.
//
// Other files read this, so changing the pacing of the film means editing numbers here only.

// =====================================================================
// 1. PLACES
// =====================================================================
// The three project camps (outdoor camp cinemas). For each one:
//   stop   where the trekker stops on the trail to watch
//   sheet  where the canvas sheet stands (it turns to face `view`)
//   view   where the camera stands for the arrival shot (behind the trekker)
//   look   (optional) where that shot looks; by default a little left of the sheet
//   tent   which side of the sheet the small tent sits on (1 = right, -1 = left, seen from the front)
export const CAMPS = [
  {
    id: 'dermae',
    stop: [-0.5, -144],
    sheet: [6.2, -147.2],
    view: [-4.8, -135.5],
    look: [4.0, -146.2],
    tent: 1,
    video: 'recordings/web/dermae.mp4',
    label: 'label-dermae',
  },
  {
    // On the valley side of the ridge: the screen hangs against the misty valley and the snowy range.
    id: 'kings-garden',
    stop: [36, -174.6],
    sheet: [41.5, -184.5],
    view: [29, -168.2],
    look: [42.1, -184.2],
    tent: -1,
    tentTurn: 0.5,
    lanternSide: 1,
    blendIn: 0.022,   // the trail passes right by this camera spot: take over only at the very end
    video: 'recordings/web/kings-garden.mp4',
    label: 'label-kings-garden',
  },
  {
    // Up on a small knoll on the other side, among a few pines, turned towards the dawn.
    id: 'trinetra',
    stop: [101, -165.3],
    sheet: [106, -158.5],
    view: [91, -172],
    look: [105, -157.4],
    tent: 1,
    tentTurn: -0.35,
    video: 'recordings/web/trinetra.mp4',
    label: 'label-trinetra',
  },
];

// The meadow: the open, flat spot where the gear check will happen (Phase 4).
export const MEADOW = {
  centre: [158, -238],      // the middle of the rolling grassland
  stop: [161, -246],        // where the trekker stops (and stands, or sits, beside the mat)
  mat: [162.75, -245.8],    // the gear-check mat, just off the trail on the right, long side along it
  // The camera comes down close on the far side of the mat: the kit fills the foreground and the
  // trekker stands just behind it, looking down at their gear.
  view: [165.7, -245.4],
  viewHeight: 2.35,
  look: [161.8, -245.9],    // just in front of the trekker's knees: the whole kit in the
  lookHeight: 0.58,         // foreground, the trekker standing behind it
};

// The summit: the end of the trail, with the flag ("Book a call") beside it.
export const SUMMIT = {
  top: [193, -340],
  flag: [196.4, -342.6],
};

// =====================================================================
// 2. THE TIMELINE
// =====================================================================
// How many screen-heights of scrolling the whole film lasts (the film part of the page is this
// + 1 screens tall).
export const FILM_SCREENS = 13;

// The trekker's top speed when the film is keeping up with the scroll, in metres per second:
// a brisk pace his walk (and, above 2.4 m/s, his light jog) can match step for step.
export const MAX_WALK_SPEED = 3.8;
// If you scroll faster than that, the film falls behind. It never stays behind long: the
// further back he is, the faster he goes (blending into a jog), closing the gap with a time
// constant of CATCH_UP_SECONDS, and never slower than CATCH_UP_MIN_SPEED until he has caught up
// (so the last few metres don't drag on). Over CATCH_UP_MAX_SPEED the camera would rush.
export const CATCH_UP_SECONDS = 0.35;
export const CATCH_UP_MIN_SPEED = 8;
export const CATCH_UP_MAX_SPEED = 55;
// A gap bigger than this (metres of trail) would take more than about 1.5 s to walk: the film
// skips ahead behind a short, soft mist dissolve instead (a long flick, a scrollbar drag).
export const MIST_SKIP_METRES = 50;

// Each zone's share of the scroll (they add up to 1): base camp 15%, ridge 40%, meadow 25%, summit 20%.
export const ZONES = [
  { key: 'night', name: 'Base camp', from: 0.0, to: 0.15 },
  { key: 'predawn', name: 'The ridge', from: 0.15, to: 0.55 },
  { key: 'firstLight', name: 'The meadow', from: 0.55, to: 0.8 },
  { key: 'sunrise', name: 'The summit', from: 0.8, to: 1.0 },
];

// Where the trekker is at each moment. Between two entries the trekker walks, easing in and
// out, so the film always slows down to a stop at each place. An entry with `hold` keeps the
// trekker still for that long: time to look around.
//   at: 'start', a camp id, 'meadow' or 'summit'
export const STOPS = [
  { at: 'start', p: 0.0, hold: 0.035 },          // the opening shot at base camp
  { at: 'dermae', p: 0.215, hold: 0.05 },        // through the forest, up onto the ridge
  { at: 'kings-garden', p: 0.345, hold: 0.05 },
  { at: 'trinetra', p: 0.47, hold: 0.05 },
  { at: 'meadow', p: 0.635, hold: 0.085 },       // the gear check: a longer pause
  { at: 'summit', p: 0.95, hold: 0.05 },         // the end: turn, wave, Book a call
];

// The light: how far through the day (palette.js "climb": 0 night ... 1 sunrise) we are at
// points of the scroll. In between, it blends smoothly. The ridge camps keep the deep pre-dawn
// (DERMAÉ keeps exactly the light it had in Phase 1), first light breaks as we reach the
// meadow, and the sun rises as we reach the top.
export const LIGHT = [
  [0.0, 0.0],
  [0.04, 0.0],
  [0.215, 0.267],
  [0.52, 0.43],
  [0.64, 0.667],
  [0.72, 0.7],
  [0.95, 1.0],
];

// The altitude meter: base camp and summit, in metres (a believable Himalayan trek).
export const ALTITUDE = { base: 2850, summit: 4410 };

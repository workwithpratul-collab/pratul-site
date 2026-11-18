// work.js: the project cards on the mobile page.
//
// Each card shows a painted still of its landmark from the film (the lake, the hut's window, the
// signboard). When the card is well on screen, the project's video plays, muted, inside that
// landmark's own frame; when it scrolls away, the video pauses. Tapping the picture opens the
// project, like the "View project" button.
//
// Putting a flat video exactly onto a frame seen at an angle: we know where the frame's four
// corners are in the still (measured when the stills were rendered from the 3D world, stored in
// data-quad as fractions of the picture). A CSS "matrix3d" transform can bend a rectangle so its
// four corners land on any four points: a perspective warp, worked out below. The browser does
// the warping on the graphics chip, so it costs nothing while scrolling.

const VIDEO_ASPECT = 1888 / 908;   // the recordings' shape (the same as the film's screens)
const BASE_W = 1000;               // the video's own size before the warp (any size works)
const BASE_H = BASE_W / VIDEO_ASPECT;

export function initWorkCards({ reduceMotion }) {
  for (const scene of document.querySelectorAll('.work-card__scene')) {
    const quad = (scene.dataset.quad || '').split(',').map(Number);
    if (quad.length !== 8 || quad.some(Number.isNaN)) continue;
    const card = scene.closest('.work-card');
    const img = scene.querySelector('img');
    let video = null;
    let wanted = false;

    // Fit the warp to the card's current size (the picture fills the box like object-fit: cover).
    function place() {
      if (!video) return;
      const bw = scene.clientWidth, bh = scene.clientHeight;
      const iw = Number(img.getAttribute('width')), ih = Number(img.getAttribute('height'));
      const s = Math.max(bw / iw, bh / ih);
      const ox = (bw - iw * s) / 2, oy = (bh - ih * s) / 2;
      const pts = [0, 1, 2, 3].map((i) => [ox + quad[i * 2] * iw * s, oy + quad[i * 2 + 1] * ih * s]);
      video.style.transform = squareToQuad(BASE_W, BASE_H, pts);
    }

    function load() {
      if (video) return;
      video = document.createElement('video');
      Object.assign(video, { muted: true, loop: true, playsInline: true, preload: 'auto' });
      video.setAttribute('muted', '');          // (iOS reads the attribute when deciding to autoplay)
      video.setAttribute('playsinline', '');
      video.setAttribute('aria-hidden', 'true');
      video.className = 'work-card__video';
      video.width = BASE_W;
      video.height = BASE_H;
      video.style.width = `${BASE_W}px`;
      video.style.height = `${BASE_H}px`;
      video.src = scene.dataset.mobileVideo;
      scene.appendChild(video);
      place();
    }
    function play() {
      wanted = true;
      load();
      video.play().then(() => { if (wanted) card.classList.add('is-playing'); }).catch(() => {});
    }
    function pause() {
      wanted = false;
      card.classList.remove('is-playing');
      // Pause once the still has faded back over it.
      setTimeout(() => { if (video && !wanted) video.pause(); }, 900);
    }

    // Plays while at least 55% of the picture is on screen. With "reduce motion" it stays a still
    // (the project page has the video, with a Play button).
    if (!reduceMotion) {
      new IntersectionObserver(([entry]) => (entry.isIntersecting ? play() : pause()), { threshold: 0.55 }).observe(scene);
    }
    new ResizeObserver(place).observe(scene);
  }
}

// The perspective warp that takes a w x h rectangle onto four points (top-left, top-right,
// bottom-right, bottom-left), as a CSS matrix3d. (Heckbert's square-to-quad mapping: solve where
// the unit square's corners go, then scale the rectangle down to the unit square first.)
function squareToQuad(w, h, [[x0, y0], [x1, y1], [x2, y2], [x3, y3]]) {
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const k = (dx1 * dy3 - dx3 * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + k * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + k * y3, f = y0;
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, k / h, 0, 0, 1, 0, c, f, 0, 1];
  return `matrix3d(${m.map((v) => +v.toFixed(8)).join(',')})`;
}

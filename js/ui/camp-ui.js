// camp-ui.js: the interface of the three project camps.
//
// Over each 3D screen sits a real HTML link (to the project's case study page). Every frame the
// screen's four corners are projected onto the page and the link is sized to cover them, so:
//  - hovering the screen with the mouse is hovering the link,
//  - Tab reaches it like any link, and screen readers announce it ("DERMAÉ ... view project").
// On hover or focus the sheet glows a little brighter, the label lifts and "View project" appears.
// Clicking starts the transition: the camera glides up to the screen, the world dissolves into
// mist, and the case study page opens out of the same mist.

import * as THREE from 'three';
import { gsap } from 'gsap';
import { veil } from './veil.js';

const RETURN_KEY = 'ascent:return';   // where to come back to on the trail (see main.js)

export function createCampUI({ camps, defs, camera, cameraPath, getProgress, reduceMotion }) {
  const v = new THREE.Vector3();
  const ui = defs.map((def, i) => {
    const root = document.querySelector(`.camp-ui[data-camp="${def.id}"]`);
    const entry = {
      def, camp: camps[i], root,
      hit: root.querySelector('.camp-ui__hit'),
      caption: root.querySelector('.camp-ui__caption'),
      cta: root.querySelector('.camp-ui__cta'),
      hovering: 0, leaveTimer: 0, shown: false,
    };
    // Hover: on the screen (the link) or on the "View project" pill below it. A short grace
    // period lets the pointer travel from the screen down to the pill without it vanishing.
    const on = () => { clearTimeout(entry.leaveTimer); setHover(entry, true); };
    const off = () => { entry.leaveTimer = setTimeout(() => setHover(entry, false), 260); };
    for (const el of [entry.hit, entry.cta]) {
      el.addEventListener('pointerenter', on);
      el.addEventListener('pointerleave', off);
    }
    entry.hit.addEventListener('focus', on);
    entry.hit.addEventListener('blur', off);
    const open = (e) => { e.preventDefault(); openProject(entry); };
    entry.hit.addEventListener('click', open);
    entry.cta.addEventListener('click', open);
    return entry;
  });

  function setHover(entry, value) {
    entry.root.classList.toggle('is-hover', value);
    entry.camp.setHover(value);
  }

  // ---------- Every frame: lay each link over its screen ----------
  // near: 0..1 per camp (1 = arrived). The link only exists (is focusable) while we're there.
  function update(nears) {
    const w = window.innerWidth, h = window.innerHeight;
    ui.forEach((entry, i) => {
      const show = THREE.MathUtils.clamp((nears[i] - 0.6) / 0.3, 0, 1);
      const active = show > 0.5 && !opening;
      if (active !== entry.shown) {
        entry.shown = active;
        entry.hit.hidden = !active;
        if (!active) setHover(entry, false);
      }
      entry.caption.style.opacity = Math.max(show, 0.001).toFixed(3);
      if (show <= 0) return;
      // The screen's corners on the page: the link covers the box around them.
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const c of entry.camp.corners) {
        v.copy(c).project(camera);
        const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      Object.assign(entry.hit.style, {
        transform: `translate3d(${minX.toFixed(1)}px, ${minY.toFixed(1)}px, 0)`,
        width: `${(maxX - minX).toFixed(1)}px`,
        height: `${(maxY - minY).toFixed(1)}px`,
      });
      v.copy(entry.camp.captionPoint).project(camera);
      const cx = (v.x * 0.5 + 0.5) * w, cy = (-v.y * 0.5 + 0.5) * h;
      entry.caption.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0) translate(-50%, 0)`;
    });
  }

  // ---------- Opening a project ----------
  let opening = false;
  async function openProject(entry) {
    if (opening) return;
    opening = true;
    const href = entry.hit.getAttribute('href');
    // Remember where we were, so "Back to the trail" returns to this exact spot.
    sessionStorage.setItem(RETURN_KEY, JSON.stringify({ camp: entry.def.id, progress: getProgress() }));
    setHover(entry, true);
    if (reduceMotion) {
      // The calm version: no camera flight, just the mist.
      await veil(true, { duration: 700 });
    } else {
      // The camera glides up to the screen while the mist gathers.
      const f = cameraPath.focus;
      f.pos.copy(entry.camp.front);
      f.look.copy(entry.camp.centre);
      f.arc = 1.6;   // rise up and over the trekker on the way
      gsap.to(f, { w: 1, duration: 1.8, ease: 'power2.inOut' });
      await new Promise((r) => setTimeout(r, 700));
      await veil(true, { duration: 1100 });
    }
    location.href = href;
  }

  // Coming back from a project: start inside the mist, in front of the screen, then glide back
  // out to the trail as the mist clears.
  async function returnFrom(campId) {
    const entry = ui.find((e) => e.def.id === campId);
    if (!entry) return;
    if (!reduceMotion) {
      const f = cameraPath.focus;
      f.pos.copy(entry.camp.front);
      f.look.copy(entry.camp.centre);
      f.w = 1;
      f.arc = 1.6;
      gsap.to(f, { w: 0, duration: 2.6, ease: 'power2.inOut', delay: 0.3, onComplete: () => { f.arc = 0; } });
    }
    await veil(false, { duration: reduceMotion ? 700 : 1600 });
  }

  // If the browser restores this page from its back-forward cache, clear any transition state.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    opening = false;
    cameraPath.focus.w = 0;
    veil(false, { duration: 600 });
  });

  return { update, returnFrom, get opening() { return opening; } };
}

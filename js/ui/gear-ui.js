// gear-ui.js: the interface of the gear check on the meadow.
//
// Over each piece of kit on the mat sits a small round HTML link (index.html, .gear-ui__item).
// Hover or keyboard focus: the item glows and its name and one plain line appear beside it.
// Click: the page glides down to the matching part of "What I can build" below the film.

import * as THREE from 'three';

export function createGearUI({ gear, camera, lenis, reduceMotion, onHover = () => {} }) {
  const root = document.getElementById('gear-ui');
  const links = [...root.querySelectorAll('.gear-ui__item')];
  const v = new THREE.Vector3(), edge = new THREE.Vector3(), right = new THREE.Vector3();
  let shown = false;

  for (const a of links) {
    const id = a.dataset.item;
    // Near-row labels open below their item, so they never cover the item behind.
    a.classList.toggle('is-near', !!gear.near[id]);
    // onHover tells the film which item is being looked at (the trekker turns his head to it).
    const on = () => { gear.setGlow(id, true); onHover(id); };
    const off = () => { gear.setGlow(id, false); onHover(null); };
    a.addEventListener('pointerenter', on);
    a.addEventListener('pointerleave', off);
    a.addEventListener('focus', on);
    a.addEventListener('blur', off);
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(a.getAttribute('href'));
      history.replaceState(null, '', a.getAttribute('href'));
      lenis.scrollTo(target, { duration: reduceMotion ? 0 : 2.6, offset: -window.innerHeight * 0.3, immediate: reduceMotion });
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });   // keyboard and screen-reader users land there too
    });
  }

  // here: 0..1, how fully we're at the gear check (1 = arrived and the camera has settled).
  function update(here) {
    const visible = here > 0.92;
    if (visible !== shown) {
      shown = visible;
      root.hidden = !visible;
      if (!visible) { links.forEach((a) => gear.setGlow(a.dataset.item, false)); onHover(null); }
    }
    if (!visible) return;
    const w = window.innerWidth, h = window.innerHeight;
    right.setFromMatrixColumn(camera.matrixWorld, 0);   // the camera's "sideways"
    for (const a of links) {
      const id = a.dataset.item;
      v.copy(gear.centres[id]).project(camera);
      const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
      // Each link is a circle covering its item: the item's size, as it looks from here.
      edge.copy(gear.centres[id]).addScaledVector(right, gear.radii[id]).project(camera);
      const r = Math.max(Math.abs(edge.x - v.x) * 0.5 * w, 24);
      a.style.width = a.style.height = `${(r * 2).toFixed(1)}px`;
      a.style.transform = `translate3d(${(x - r).toFixed(1)}px, ${(y - r).toFixed(1)}px, 0)`;
    }
  }
  return { update };
}

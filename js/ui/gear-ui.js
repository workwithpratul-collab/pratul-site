// gear-ui.js: the interface of the gear check on the meadow.
//
// Over each piece of kit on the mat sits a small round HTML link (index.html, .gear-ui__item).
// Hover or keyboard focus: the item glows and its name and one plain line appear beside it.
// Click: the page glides down to the matching part of "What I can build" below the film.

import * as THREE from 'three';

export function createGearUI({ gear, camera, lenis, reduceMotion }) {
  const root = document.getElementById('gear-ui');
  const links = [...root.querySelectorAll('.gear-ui__item')];
  const v = new THREE.Vector3();
  let shown = false;

  for (const a of links) {
    const id = a.dataset.item;
    const on = () => gear.setGlow(id, true);
    const off = () => gear.setGlow(id, false);
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
      if (!visible) links.forEach((a) => gear.setGlow(a.dataset.item, false));
    }
    if (!visible) return;
    const w = window.innerWidth, h = window.innerHeight;
    for (const a of links) {
      v.copy(gear.centres[a.dataset.item]).project(camera);
      const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
      a.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
  }
  return { update };
}

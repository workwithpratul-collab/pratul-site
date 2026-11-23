// altitude.js: the altitude meter in the bottom-left corner of the film
// (references/round2/Meter.dc.html).
//
// One stacked label beside a thin progress line:
//   NOW
//   The ridge                       (the place name, cross-fading as you climb into the next place)
//   ALT. 3,240 M                    (the trekker's altitude, in amber)
//   SUMMIT 4,410 M · 1,170 M TO GO  (the goal, quietly underneath)
// The line fills as you scroll, so it doubles as the film's progress bar, with a small amber mark
// at its tip and a tick at the top for the summit.

// el: the .altitude element.
// stations: [{ progress, name, metres }], the four places and where they are in the scroll (0..1).
export function createAltitudeMeter(el, { stations }) {
  const summit = stations[stations.length - 1].metres;
  const format = new Intl.NumberFormat('en-US');
  el.innerHTML = `
    <div class="altitude__rail">
      <div class="altitude__fill"></div>
      <span class="altitude__tip"></span>
      <span class="altitude__top"></span>
    </div>
    <div class="altitude__readout">
      <span class="altitude__now">Now</span>
      <span class="altitude__places">${stations.map((s) => `<span class="altitude__place">${s.name}</span>`).join('')}</span>
      <span class="altitude__alt">Alt. <span class="altitude__value">0 m</span></span>
      <span class="altitude__goal">Summit ${format.format(summit)} m · <span class="altitude__togo"></span></span>
    </div>`;
  const value = el.querySelector('.altitude__value');
  const togo = el.querySelector('.altitude__togo');
  const places = [...el.querySelectorAll('.altitude__place')];
  const names = stations.map((s) => s.name);
  let shownMetres = -1;
  let shownPlace = -1;

  // progress: 0..1 through the film. metres: the trekker's altitude. name: the place we're in.
  // Only touches the page when something visibly changes, so it costs almost nothing per frame.
  function update(progress, metres, name) {
    el.style.setProperty('--progress', progress.toFixed(4));
    // Round to 10 m: the number ticks over calmly instead of flickering.
    const rounded = Math.round(metres / 10) * 10;
    if (rounded !== shownMetres) {
      shownMetres = rounded;
      value.textContent = `${format.format(rounded)} m`;
      const left = Math.max(0, summit - rounded);
      togo.textContent = left > 0 ? `${format.format(left)} m to go` : 'reached';
    }
    // The place names are stacked in one spot; the current one fades in as the last fades out.
    const at = Math.max(0, names.indexOf(name));
    if (at !== shownPlace) {
      shownPlace = at;
      places.forEach((p, i) => p.classList.toggle('is-current', i === at));
    }
  }
  return { update };
}

// The four places with their (rounded) altitudes. The film works out the live altitude from the
// trekker's height on the trail (film.js); the summit's figure is the meter's goal.
export const STATIONS = [
  { key: 'night', progress: 0, metres: 2850, name: 'Base camp' },
  { key: 'predawn', progress: 0.215, metres: 3180, name: 'The ridge' },
  { key: 'firstLight', progress: 0.635, metres: 3600, name: 'The meadow' },
  { key: 'sunrise', progress: 0.95, metres: 4410, name: 'The summit' },
];

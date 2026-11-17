// altitude.js: the small altitude meter in the bottom-left corner.
// It shows how high the trekker is ("ALT 3,620 m") and a thin rail that fills as you scroll,
// so it doubles as the film's progress bar. Each of the four places has a tick on the rail.

// el: the .altitude element.
// stations: [{ progress, name }], the four places and where they are in the scroll (0..1).
export function createAltitudeMeter(el, { stations }) {
  el.innerHTML = `
    <div class="altitude__rail">
      <div class="altitude__fill"></div>
      ${stations.map((s) => `<span class="altitude__tick" style="bottom:${(s.progress * 100).toFixed(1)}%"></span>`).join('')}
    </div>
    <div class="altitude__readout">
      <span class="altitude__place"></span>
      <span class="altitude__line"><span class="altitude__label">Alt</span><span class="altitude__value">0 m</span></span>
    </div>`;
  const value = el.querySelector('.altitude__value');
  const place = el.querySelector('.altitude__place');
  const ticks = [...el.querySelectorAll('.altitude__tick')];
  const format = new Intl.NumberFormat('en-US');
  let shownMetres = -1;
  let shownPlace = '';

  // progress: 0..1 down the page. metres: the trekker's altitude. name: the zone we're in.
  // Only touches the page when something visibly changes, so it costs almost nothing per frame.
  function update(progress, metres, name) {
    el.style.setProperty('--progress', progress.toFixed(4));
    // Round to 10 m: the number ticks over calmly instead of flickering.
    const rounded = Math.round(metres / 10) * 10;
    if (rounded !== shownMetres) {
      shownMetres = rounded;
      value.textContent = `${format.format(rounded)} m`;
    }
    if (name !== shownPlace) {
      shownPlace = name;
      place.textContent = name;
    }
    stations.forEach((s, i) => ticks[i].classList.toggle('is-passed', progress >= s.progress - 1e-4));
  }
  return { update };
}

// The four places with their (rounded) altitudes, for the style guide. The film itself works
// out the live altitude from the trekker's height on the trail (see main.js).
export const STATIONS = [
  { key: 'night', progress: 0, metres: 2850, name: 'Base camp' },
  { key: 'predawn', progress: 0.215, metres: 3180, name: 'The ridge' },
  { key: 'firstLight', progress: 0.635, metres: 3600, name: 'The meadow' },
  { key: 'sunrise', progress: 0.95, metres: 4410, name: 'The summit' },
];

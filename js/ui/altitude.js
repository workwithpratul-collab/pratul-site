// altitude.js: the small altitude meter in the bottom-left corner.
// It shows how high the trekker is ("ALT 3,620 m") and a thin rail that fills as you climb,
// so it doubles as the film's progress bar. Each of the four camps has a tick on the rail.

import { CLIMB, PRESETS } from '../world/palette.js';

// The imagined altitude of each camp, in metres (a believable Himalayan trek).
export const STATIONS = [
  { key: 'night', climb: CLIMB.night, metres: 3450 },
  { key: 'predawn', climb: CLIMB.predawn, metres: 3980 },
  { key: 'firstLight', climb: CLIMB.firstLight, metres: 4410 },
  { key: 'sunrise', climb: CLIMB.sunrise, metres: 5120 },
];

// Altitude for a point of the climb (0..1): straight lines between the camps.
export function altitudeAt(climb) {
  for (let i = 0; i < STATIONS.length - 1; i++) {
    const a = STATIONS[i], b = STATIONS[i + 1];
    if (climb <= b.climb) {
      const t = (climb - a.climb) / (b.climb - a.climb);
      return a.metres + (b.metres - a.metres) * Math.max(t, 0);
    }
  }
  return STATIONS[STATIONS.length - 1].metres;
}

// el: the .altitude element. filmEnd: how far up the climb the current film goes
// (Phase 1 ends at the ridge), so the rail is full when the page ends.
export function createAltitudeMeter(el, { filmEnd = 1 } = {}) {
  el.innerHTML = `
    <div class="altitude__rail">
      <div class="altitude__fill"></div>
      ${STATIONS.map((s) => `<span class="altitude__tick" style="bottom:${(Math.min(s.climb / filmEnd, 1) * 100).toFixed(1)}%" ${s.climb > filmEnd ? 'hidden' : ''}></span>`).join('')}
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

  // progress: 0..1 down the page. Only touches the page when something visibly changes,
  // so it costs almost nothing per frame.
  function update(progress) {
    const climb = progress * filmEnd;
    el.style.setProperty('--progress', progress.toFixed(4));
    // Round to 10 m: the number ticks over calmly instead of flickering.
    const metres = Math.round(altitudeAt(climb) / 10) * 10;
    if (metres !== shownMetres) {
      shownMetres = metres;
      value.textContent = `${format.format(metres)} m`;
    }
    // Name the camp we're nearest to.
    const nearest = STATIONS.reduce((best, s) => (Math.abs(s.climb - climb) < Math.abs(best.climb - climb) ? s : best));
    const name = PRESETS[nearest.key].place;
    if (name !== shownPlace) {
      shownPlace = name;
      place.textContent = name;
    }
    STATIONS.forEach((s, i) => ticks[i].classList.toggle('is-passed', climb >= s.climb - 1e-4));
  }
  update(0);
  return { update };
}

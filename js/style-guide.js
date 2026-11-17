// style-guide.js: fills style-guide.html with live values from palette.js, so the guide
// can never fall out of date: change a colour in the palette and the guide shows it.

import { PRESETS, CLIMB, sampleClimb } from './world/palette.js';
import { createAltitudeMeter, STATIONS } from './ui/altitude.js';
import { createCursor } from './ui/cursor.js';

const ORDER = ['night', 'predawn', 'firstLight', 'sunrise'];
const hex = (c) => `#${c.getHexString()}`;

// Each preset's sky as a CSS gradient (top of the sky → horizon), used as a backdrop.
function skyGradient(sky) {
  return `linear-gradient(180deg, ${sky.top} 0%, ${sky.mid} 55%, ${sky.horizon} 100%)`;
}

// ---------- 1. The four presets as swatches ----------
const SWATCH_ROWS = [
  ['Sky top', (p) => p.sky.top],
  ['Sky middle', (p) => p.sky.mid],
  ['Horizon', (p) => p.sky.horizon],
  ['Dawn glow', (p) => p.sky.glow],
  ['Fog', (p) => p.fog.color],
  ['Ambient light', (p) => p.ambient.sky],
  ['Key light', (p) => p.key.color],
  ['Mist', (p) => p.mist.air],
  ['Ground tint', (p) => p.ground],
  ['Warm accent', (p) => p.warm],
  ['Trees', (p) => p.trees.top],
  ['Snow (lit)', (p) => p.mountains.snowLit],
];
const presetsEl = document.getElementById('presets');
presetsEl.innerHTML = ORDER.map((key, i) => {
  const p = PRESETS[key];
  const station = STATIONS[i];
  return `
    <article class="preset">
      <div class="preset__sky" style="background:${skyGradient(p.sky)}">
        <span class="preset__num">${i + 1}</span>
        <span class="preset__sun" style="--glow:${p.sky.glow}; opacity:${(p.sky.glowStrength * 0.9 + 0.1).toFixed(2)}"></span>
      </div>
      <header class="preset__head">
        <h3>${p.label}</h3>
        <p>${p.place} · ${station.metres.toLocaleString('en-US')} m · key light ${p.key.intensity} ${p.key.fromSun ? '(sun)' : '(moon)'}</p>
      </header>
      <ul class="swatches">
        ${SWATCH_ROWS.map(([name, get]) => `
          <li><span class="chip" style="background:${get(p)}"></span><span>${name}</span><code>${get(p)}</code></li>`).join('')}
      </ul>
    </article>`;
}).join('');

// ---------- 2. The blend strip: the whole climb, sampled every 1/80 ----------
const STRIP_ROWS = [
  ['Sky', (m) => `linear-gradient(180deg, ${hex(m.sky.top)}, ${hex(m.sky.mid)} 55%, ${hex(m.sky.horizon)})`],
  ['Fog', (m) => hex(m.fog.color)],
  ['Key light', (m) => hex(m.key.color)],
  ['Mist', (m) => hex(m.mist.air)],
  ['Trees', (m) => `linear-gradient(180deg, ${hex(m.trees.top)}, ${hex(m.trees.bottom)})`],
];
const SLICES = 80;
const samples = Array.from({ length: SLICES }, (_, i) => sampleClimb(i / (SLICES - 1)));
document.getElementById('blend').innerHTML = `
  ${STRIP_ROWS.map(([name, get]) => `
    <div class="blend__row">
      <span class="blend__name">${name}</span>
      <div class="blend__slices">${samples.map((m) => `<span style="background:${get(m)}"></span>`).join('')}</div>
    </div>`).join('')}
  <div class="blend__row blend__row--marks">
    <span class="blend__name"></span>
    <div class="blend__marks">${ORDER.map((k) => `<span style="left:${(CLIMB[k] * 100).toFixed(2)}%">${PRESETS[k].label}</span>`).join('')}</div>
  </div>`;

// ---------- 3. Components on all four skies ----------
document.querySelectorAll('[data-sky]').forEach((el) => {
  el.style.background = skyGradient(PRESETS[el.dataset.sky].sky);
});

// Altitude meters, one per camp (the film's meter, frozen at each station).
document.querySelectorAll('[data-altitude]').forEach((el) => {
  const meter = createAltitudeMeter(el, { filmEnd: 1 });
  meter.update(Number(el.dataset.altitude));
});

// The real custom cursor runs on this page too: move over the buttons to feel it.
createCursor();

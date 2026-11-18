// intro.js: the opening. The headline appears line by line, like a film title: each line
// rises a few pixels out of a soft blur. Then the quiet "scroll to begin" hint, and the
// altitude meter. Scrolling fades the headline and the hint away.

import { gsap } from 'gsap';

// Split the headline into its real lines (however the screen width wraps it), so each line can
// appear on its own. Each word is wrapped first, then words on the same row are grouped.
function splitLines(block) {
  const words = block.textContent.trim().split(/\s+/);
  block.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(' ');
  const rows = [];
  let top = null;
  for (const w of block.querySelectorAll('.w')) {
    if (w.offsetTop !== top) { rows.push([]); top = w.offsetTop; }
    rows[rows.length - 1].push(w.textContent);
  }
  block.innerHTML = rows.map((r) => `<span class="line">${r.join(' ')}</span>`).join('');
}

export function createIntro({ reduceMotion }) {
  const intro = document.getElementById('intro');
  const hint = document.getElementById('scroll-hint');
  const hello = intro.querySelector('.intro__hello');
  const statement = intro.querySelector('.intro__statement');
  // Screen readers get the whole headline as one sentence, not line fragments.
  intro.querySelector('h1').setAttribute('aria-label', `${hello.textContent.trim()} ${statement.textContent.trim()}`);
  hello.innerHTML = `<span class="line">${hello.textContent.trim()}</span>`;
  let lines = [];
  // The lines depend on the real font's widths, so split once the web fonts have arrived.
  const split = document.fonts.ready.then(() => {
    splitLines(statement);
    for (const el of intro.querySelectorAll('.line')) el.setAttribute('aria-hidden', 'true');
    lines = intro.querySelectorAll('.line');
  });

  // The reveal, once the curtain lifts.
  async function reveal() {
    await split;
    if (reduceMotion) {
      gsap.to([...lines, hint, '#altitude'], { opacity: 1, duration: 1.2, ease: 'power1.out', stagger: 0.15 });
      return;
    }
    gsap.timeline({ delay: 0.5 })
      .fromTo(lines,
        { opacity: 0, y: 14, filter: 'blur(6px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.8, ease: 'power2.out', stagger: 0.32 })
      .to(hint, { opacity: 1, duration: 1.4, ease: 'power1.out' }, '-=0.6')
      .to('#altitude', { opacity: 1, duration: 1.6, ease: 'power1.out' }, '<');
  }

  // Skip the reveal (e.g. when coming back from a project mid-climb): just show the meter.
  async function skip() {
    await split;
    gsap.set(lines, { opacity: 1 });
    gsap.set('#altitude', { opacity: 1 });
  }

  // Every frame: the headline drifts up and fades over the first part of the climb, and the
  // hint fades out as soon as scrolling starts. p = film progress (0..1).
  let hintGone = false;
  function update(p) {
    const fade = Math.min(Math.max(p / 0.04, 0), 1);
    intro.style.opacity = (1 - fade).toFixed(3);
    intro.style.transform = reduceMotion ? '' : `translateY(${(-40 * fade).toFixed(1)}px)`;
    intro.style.visibility = fade >= 1 ? 'hidden' : 'visible';
    if (!hintGone && p > 0.004) {
      hintGone = true;
      gsap.to(hint, { opacity: 0, duration: 0.8, overwrite: true });
    }
  }
  return { reveal, skip, update };
}

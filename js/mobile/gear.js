// gear.js: the gear check on the mobile page. The painted kit lies on the mat; each item is a
// real button (so it works with a thumb, a keyboard and a screen reader).
//  - First tap: the item lifts a little off the mat, and what it stands for appears below,
//    with a "See how" link to that skill in "What I can build".
//  - Second tap on the same item: go straight there.

export function initGear() {
  const flatlay = document.querySelector('.flatlay');
  if (!flatlay) return;
  const readout = document.getElementById('flatlay-readout');
  const name = readout.querySelector('.flatlay__name');
  const line = readout.querySelector('.flatlay__line');
  const more = readout.querySelector('.flatlay__more');
  let picked = null;

  flatlay.addEventListener('click', (e) => {
    const item = e.target.closest('.flatlay__item');
    if (!item) return;
    // The second tap on the same item: go to its skill.
    if (item === picked) {
      document.querySelector(item.dataset.href)?.scrollIntoView({ block: 'start' });
      return;
    }
    picked?.classList.remove('is-picked');
    picked?.setAttribute('aria-pressed', 'false');
    picked = item;
    item.classList.add('is-picked');
    item.setAttribute('aria-pressed', 'true');
    flatlay.classList.add('has-pick');
    // The words below change (and gently rise in); their space never changes size.
    name.textContent = item.querySelector('.visually-hidden').textContent;
    line.textContent = item.dataset.line;
    more.href = item.dataset.href;
    more.hidden = false;
    readout.classList.remove('is-changed');
    void readout.offsetWidth;   // (restart the little rise animation)
    readout.classList.add('is-changed');
  });
  for (const item of flatlay.querySelectorAll('.flatlay__item')) item.setAttribute('aria-pressed', 'false');
}

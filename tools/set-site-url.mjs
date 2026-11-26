// set-site-url.mjs: change the site's web address everywhere, in one go.
//
// Link previews (WhatsApp, LinkedIn, X...) and Google read the full address written inside each page
// (the canonical link, og:url, og:image...). They don't run JavaScript, so it has to be typed out in the
// HTML itself. To keep that to ONE setting, the address lives in site-url.txt, and this little script
// swaps it in every page for you. (It's a helper you run by hand, not a build step: the site itself
// stays plain HTML.)
//
// To move to a new domain, run this in the project folder (VS Code's terminal):
//   node tools/set-site-url.mjs https://pratul.dev/
// It replaces the old address (from site-url.txt) in every .html file, then saves the new one there.

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const settingFile = path.join(root, 'site-url.txt');
const oldUrl = fs.readFileSync(settingFile, 'utf8').trim();
let newUrl = (process.argv[2] || '').trim();
if (!/^https:\/\/[^ ]+$/.test(newUrl)) {
  console.log(`The site's address is now: ${oldUrl}\nTo change it: node tools/set-site-url.mjs https://your-domain/`);
  process.exit(newUrl ? 1 : 0);
}
if (!newUrl.endsWith('/')) newUrl += '/';   // (always ends with "/", so "assets/..." can follow it)

// Every page of the site (not the style guides, which aren't shared).
const pages = ['index.html', '404.html', ...fs.readdirSync(path.join(root, 'case-studies')).filter((f) => f.endsWith('.html')).map((f) => `case-studies/${f}`)];
let changed = 0;
for (const page of pages) {
  const file = path.join(root, page);
  const before = fs.readFileSync(file, 'utf8');
  const after = before.split(oldUrl).join(newUrl);
  if (after !== before) { fs.writeFileSync(file, after); changed++; console.log('updated', page); }
}
fs.writeFileSync(settingFile, newUrl + '\n');
console.log(`Done: ${changed} page(s) now use ${newUrl}`);

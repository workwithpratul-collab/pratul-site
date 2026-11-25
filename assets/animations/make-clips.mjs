// make-clips.mjs: packs the trekker's eleven animation clips into one small binary file, clips.bin,
// which the film downloads (js/world/trekker.js reads it).
//
// The source is clips.json (the clips baked from the Mixamo FBX files, already fitted to this
// character). JSON writes every number as long text, like 0.032999999821186066, so the same
// motion takes ~2.4 MB. clips.bin stores it as plain numbers instead:
//   - key times as whole milliseconds (16-bit), which is exactly what the JSON holds (its times are
//     all whole milliseconds, stored as 32-bit floats; reading them back gives the same numbers),
//   - the hips' positions as 32-bit floats (exactly as in the JSON),
//   - every joint rotation (a quaternion: 4 numbers between -1 and 1) as 16-bit whole numbers,
//     value x 32767. The largest error is 1/65534 per number, under 0.003 degrees of turn: far
//     below anything visible.
//
// Run it from the site's folder whenever clips.json changes:   node assets/animations/make-clips.mjs
//
// The file's layout (all numbers little-endian):
//   uint32       length of the header, in bytes
//   header       JSON text: { clips: { name: { duration, blendMode, tracks: [{ name, type, keys }] } } },
//                padded with spaces to a multiple of 4 bytes
//   float32[]    every position value, track after track (type "vector")
//   int16[]      every rotation value, track after track (type "quaternion")
//   uint16[]     every key time in milliseconds, track after track (all tracks, in order)

import fs from 'node:fs';
import path from 'node:path';

const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const clips = JSON.parse(fs.readFileSync(path.join(dir, 'clips.json'), 'utf8'));

const header = { clips: {} };
const floats = [], shorts = [], times = [];
for (const [name, clip] of Object.entries(clips)) {
  header.clips[name] = { duration: clip.duration, blendMode: clip.blendMode, tracks: [] };
  for (const track of clip.tracks) {
    if (track.type !== 'quaternion' && track.type !== 'vector') throw new Error(`unexpected track type ${track.type}`);
    if (track.interpolation !== undefined) throw new Error(`unexpected interpolation on ${track.name}`);
    header.clips[name].tracks.push({ name: track.name, type: track.type, keys: track.times.length });
    for (const t of track.times) {
      const ms = Math.round(t * 1000);
      if (Math.fround(ms / 1000) !== Math.fround(t) || ms > 65535) throw new Error(`time ${t} is not a whole millisecond`);
      times.push(ms);
    }
    if (track.type === 'vector') floats.push(...track.values);
    else for (const v of track.values) shorts.push(Math.round(Math.max(-1, Math.min(1, v)) * 32767));
  }
}

let headerText = JSON.stringify(header);
while ((4 + Buffer.byteLength(headerText)) % 4) headerText += ' ';
const headerBytes = Buffer.from(headerText, 'utf8');
const out = Buffer.alloc(4 + headerBytes.length + floats.length * 4 + shorts.length * 2 + times.length * 2);
let o = 0;
out.writeUInt32LE(headerBytes.length, o); o += 4;
headerBytes.copy(out, o); o += headerBytes.length;
for (const v of floats) { out.writeFloatLE(v, o); o += 4; }
for (const v of shorts) { out.writeInt16LE(v, o); o += 2; }
for (const v of times) { out.writeUInt16LE(v, o); o += 2; }
fs.writeFileSync(path.join(dir, 'clips.bin'), out);
console.log(`clips.bin: ${Object.keys(clips).length} clips, ${times.length} keys, ${(out.length / 1024).toFixed(0)} KB`);

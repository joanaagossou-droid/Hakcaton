/**
 * Génère public/icons/icon-192.png et icon-512.png (icônes PWA) sans dépendance :
 * dessin par pixels de l'œil NUKUN (fond bleu nuit, contour turquoise, iris blanc)
 * puis encodage PNG avec zlib.
 *   node tools/gen-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

const NAVY = [11, 31, 58], TEAL = [20, 184, 166], WHITE = [255, 255, 255];
function eyeShade(u, v) {
  let col = NAVY;
  // amande de l'œil : |v| < 0.5*(1-u²)  (sur u ∈ [-0.78, 0.78])
  const uu = u / 0.78;
  const edge = 0.46 * (1 - uu * uu);
  const inEye = Math.abs(uu) <= 1 && Math.abs(v) <= edge;
  const nearEdge = Math.abs(uu) <= 1.06 && Math.abs(Math.abs(v) - Math.max(edge, 0)) < 0.06;
  if (nearEdge) col = TEAL;
  const r = Math.hypot(u, v);
  if (inEye && r < 0.27 && r > 0.17) col = WHITE;
  if (r < 0.09) col = WHITE;
  return col;
}

/** Icône « Calculatrice » du mode discret de SafeHer (mêmes formes que safeher/assets/calc-icon.svg). */
function calcShade(u, v) {
  const x = (u + 1) * 32, y = (v + 1) * 32;
  const BG = [28, 28, 30], OUT = [11, 31, 58];
  // coins arrondis (rayon 14 sur 64)
  const cx = Math.min(Math.max(x, 14), 50), cy = Math.min(Math.max(y, 14), 50);
  if (Math.hypot(x - cx, y - cy) > 14) return BG;
  if (x >= 10 && x <= 54 && y >= 9 && y <= 22) return [58, 58, 60];
  const cols = [15, 27, 39, 51], rows = [32, 43, 54];
  for (const ky of rows) for (const kx of cols) {
    if (Math.hypot(x - kx, y - ky) <= 4.5) return kx === 51 ? [255, 159, 10] : ky === 32 && kx < 39 ? [165, 165, 165] : [90, 90, 94];
  }
  return BG;
}

function draw(size, shade = eyeShade) {
  const px = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    px[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      // coordonnées normalisées -1..1 ; supersampling 3x3 pour l'anticrénelage
      let acc = [0, 0, 0];
      for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
        const u = ((x + (sx + .5) / 3) / size) * 2 - 1;
        const v = ((y + (sy + .5) / 3) / size) * 2 - 1;
        const col = shade(u, v);
        acc = acc.map((a, i) => a + col[i]);
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      px[o] = acc[0] / 9; px[o + 1] = acc[1] / 9; px[o + 2] = acc[2] / 9; px[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(px, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

for (const s of [192, 512]) {
  const c = path.join(root, 'safeher', 'assets', 'calc-' + s + '.png');
  fs.writeFileSync(c, draw(s, calcShade));
  console.log(c + ' : ' + Math.round(fs.statSync(c).size / 1024) + ' Ko');
  const f = path.join(root, 'public', 'icons', `icon-${s}.png`);
  fs.writeFileSync(f, draw(s));
  console.log(`${f} : ${Math.round(fs.statSync(f).size / 1024)} Ko`);
}

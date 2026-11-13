/**
 * Mesure le poids du premier chargement (brut et compressé gzip, comme le ferait l'hébergeur)
 * de NUKUN et de chaque page de LIGHT et HAVEN. Objectifs : NUKUN < 300 Ko, page LIGHT < 150 Ko.
 *   node tools/measure-weight.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const size = (files) => files.reduce((acc, f) => {
  const b = fs.readFileSync(path.join(root, f));
  return { raw: acc.raw + b.length, gz: acc.gz + zlib.gzipSync(b, { level: 6 }).length };
}, { raw: 0, gz: 0 });
const kb = (n) => `${Math.round(n / 102.4) / 10} Ko`;

// NUKUN : tout ce que le navigateur charge au démarrage (modules importés statiquement + données).
const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const pre = JSON.parse(sw.match(/\/\*PRECACHE\*\/([\s\S]*?)\/\*END\*\//)[1]).filter((f) => f !== './' && !/icon-512|snapshots/.test(f));
const nukun = size(pre);
const rows = [['NUKUN (premier chargement complet)', nukun, 300 * 1024]];
for (const dir of ['light', 'haven']) {
  for (const page of fs.readdirSync(path.join(root, dir)).filter((x) => x.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(root, dir, page), 'utf8');
    const assets = [...html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)].map((m) => `${dir}/${m[1]}`);
    rows.push([`${dir.toUpperCase()} ${page}`, size([`${dir}/${page}`, ...new Set(assets)]), dir === 'light' ? 150 * 1024 : null]);
  }
}
const out = rows.map(([name, s, max]) => ({ page: name, brut: kb(s.raw), compresse_gzip: kb(s.gz), objectif: max ? `< ${kb(max)}` : '—', respecte: max ? s.gz < max && s.raw < max * 2 : null }));
console.table(out);
fs.mkdirSync(path.join(root, 'tests', 'output'), { recursive: true });
fs.writeFileSync(path.join(root, 'tests', 'output', 'poids.json'), JSON.stringify({ date: new Date().toISOString(), mesures: out }, null, 2));

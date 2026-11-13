/**
 * Met à jour la liste de pré-cache et la version du service worker à partir des
 * fichiers réels de l'application NUKUN (HAVEN et SafeHer exclus volontairement),
 * et affiche le poids total du premier chargement.
 *   node tools/gen-precache.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
  const rel = path.posix.join(dir, e.name);
  return e.isDirectory() ? walk(rel) : [rel];
});
const files = ['./', 'index.html', 'manifest.webmanifest', ...walk('src'), ...walk('public')].filter((f) => !/\.(?:md|map)$/.test(f));
const hash = crypto.createHash('sha256');
let total = 0;
for (const f of files) {
  if (f === './') continue;
  const buf = fs.readFileSync(path.join(root, f));
  hash.update(f).update(buf);
  total += buf.length;
}
const version = hash.digest('hex').slice(0, 12);
const swPath = path.join(root, 'service-worker.js');
let sw = fs.readFileSync(swPath, 'utf8');
sw = sw.replace(/const VERSION = 'nukun-[^']*';/, `const VERSION = 'nukun-${version}';`)
  .replace(/\/\*PRECACHE\*\/[\s\S]*?\/\*END\*\//, `/*PRECACHE*/${JSON.stringify(files)}/*END*/`);
fs.writeFileSync(swPath, sw);
console.log(`service-worker : version ${version}, ${files.length} fichiers, ${Math.round(total / 1024)} Ko (non compressés, application complète).`);

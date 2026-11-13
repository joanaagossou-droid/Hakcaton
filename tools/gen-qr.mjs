/**
 * Génère le QR code (SVG) de l'adresse publique de démonstration, sans service tiers.
 *   node tools/gen-qr.mjs https://<votre-site>/#/express
 * Résultat : docs/qr-demo.svg (à vérifier en le scannant avec plusieurs téléphones).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { qrSvgString } from '../src/utils/qr.js';

const url = process.argv[2];
if (!url || !/^https:\/\//.test(url)) {
  console.error('Usage : node tools/gen-qr.mjs https://<adresse-publique>/#/express  (HTTPS obligatoire)');
  process.exit(1);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs', 'qr-demo.svg');
fs.writeFileSync(out, qrSvgString(url));
console.log(`QR code de ${url} → ${out}`);

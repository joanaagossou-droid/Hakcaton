/**
 * Génère haven/assets/bundle.js : un fichier JavaScript volontairement lourd
 * (~600 Ko décodés) qui reproduit le défaut A1 (« bundle de plusieurs Mo »).
 * Le contenu est fait de commentaires répétitifs : il se compresse très bien
 * (quelques Ko transférés avec gzip/brotli), ce qui épargne la connexion du jury,
 * tout en restant détectable par l'analyse du poids décodé.
 *
 *   node tools/gen-haven-bundle.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'haven', 'assets', 'bundle.js');
const lines = ['/* HAVEN — bundle fictif volontairement lourd (défaut A1). Aucun code exécuté hormis la ligne finale. */'];
for (let i = 1; i <= 7600; i++) {
  lines.push(`/* module-fictif-${String(i).padStart(5, '0')} : code inutilisé chargé sur chaque page (démonstration) */`);
}
lines.push('window.HAVEN_BUNDLE_LOADED = true;');
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log(`${out} : ${Math.round(fs.statSync(out).size / 1024)} Ko`);

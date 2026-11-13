/**
 * NUKUN — Essai de charge local, sans dépendance (Node ≥ 18).
 * Simule des visiteurs qui chargent NUKUN, HAVEN et LIGHT, sur le serveur LOCAL uniquement.
 * Ce n'est pas un essai de l'hébergement en ligne : pour celui-ci, utiliser tests/load/k6-nukun.js
 * sur VOS adresses, dans le respect des conditions de l'hébergeur.
 *
 *   node tests/load/mini-load.mjs [utilisateurs=200] [secondes=30]
 *   BASE=http://127.0.0.1:8080 node tests/load/mini-load.mjs   (serveur déjà lancé)
 */
import fs from 'node:fs';
import path from 'node:path';
import { startServer, ROOT } from '../helpers.mjs';

const USERS = Number(process.argv[2] || 200);
const SECONDS = Number(process.argv[3] || 30);
const PAGES = ['/', '/src/app.js', '/src/styles/main.css', '/src/data/criteria.json', '/haven/', '/haven/assets/gtag-sim.js', '/light/', '/light/ecrire.html', '/light/assets/light.js', '/light/assets/light.css'];

const own = process.env.BASE ? null : await startServer();
const BASE = process.env.BASE || own.base;
const lat = [];
let errors = 0;
let bytes = 0;
const stopAt = Date.now() + SECONDS * 1000;

async function user(i) {
  let k = i;
  while (Date.now() < stopAt) {
    const p = PAGES[k++ % PAGES.length];
    const t0 = performance.now();
    try {
      const r = await fetch(BASE + p);
      const b = await r.arrayBuffer();
      bytes += b.byteLength;
      if (!r.ok) errors++;
    } catch { errors++; }
    lat.push(performance.now() - t0);
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 300)); // temps de lecture simulé
  }
}

console.log(`Essai de charge local : ${USERS} utilisateurs simultanés pendant ${SECONDS} s sur ${BASE}`);
// Montée en charge sur 5 s
await Promise.all(Array.from({ length: USERS }, (_, i) => new Promise((r) => setTimeout(r, (i / USERS) * 5000)).then(() => user(i))));
lat.sort((a, b) => a - b);
const q = (p) => Math.round(lat[Math.min(lat.length - 1, Math.floor(p * lat.length))]);
const res = {
  date: new Date().toISOString(), cible: BASE, utilisateurs: USERS, duree_s: SECONDS, requetes: lat.length,
  erreurs: errors, taux_erreur_pct: Math.round((errors / Math.max(1, lat.length)) * 10000) / 100,
  p50_ms: q(0.5), p95_ms: q(0.95), p99_ms: q(0.99), max_ms: Math.round(lat[lat.length - 1]), mo_transferes: Math.round(bytes / 1024 / 1024),
  critere: '95 % des réponses en moins de 2 s et moins de 1 % d\'erreurs (mémoire § 10.3, C1)'
};
res.reussi = res.p95_ms < 2000 && res.taux_erreur_pct < 1;
console.log(res);
fs.mkdirSync(path.join(ROOT, 'tests', 'output'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tests', 'output', 'charge-locale.json'), JSON.stringify(res, null, 2));
if (own) await own.close();
process.exit(res.reussi ? 0 : 1);

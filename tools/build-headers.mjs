/**
 * Génère le fichier _headers (Netlify, Cloudflare Pages) à partir de server/headers.mjs,
 * pour que l'hébergement en ligne applique exactement les mêmes en-têtes que le serveur local.
 * Les règles sont écrites par chemin (et non « /* ») car ces hébergeurs CUMULENT les règles :
 * HAVEN ne doit pas hériter des en-têtes de sécurité de NUKUN (défauts volontaires).
 *   node tools/build-headers.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZONES } from '../server/headers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const byId = Object.fromEntries(ZONES.map((z) => [z.id, z.headers]));
const block = (pattern, headers, extra = {}) => [pattern, ...Object.entries({ ...headers, ...extra }).map(([k, v]) => `  ${k}: ${v}`)].join('\n');

const nukun = byId.nukun;
const out = [
  '# Généré par tools/build-headers.mjs — ne pas modifier à la main.',
  block('/', nukun, { 'Cache-Control': 'no-cache' }),
  block('/index.html', nukun, { 'Cache-Control': 'no-cache' }),
  block('/service-worker.js', nukun, { 'Cache-Control': 'no-cache' }),
  block('/manifest.webmanifest', nukun, { 'Content-Type': 'application/manifest+json; charset=utf-8' }),
  block('/robots.txt', nukun),
  block('/src/*', nukun),
  block('/public/*', nukun),
  block('/safeher/*', byId.safeher),
  block('/safeher/manifest.webmanifest', { 'Content-Type': 'application/manifest+json; charset=utf-8' }),
  // HAVEN : le cookie de session fictif n'est déposé que sur les pages HTML.
  block('/haven/*', Object.fromEntries(Object.entries(byId.haven).filter(([k]) => k !== 'Set-Cookie'))),
  block('/haven/', { 'Set-Cookie': byId.haven['Set-Cookie'] }),
  block('/haven/*.html', { 'Set-Cookie': byId.haven['Set-Cookie'] })
].join('\n\n') + '\n';
fs.writeFileSync(path.join(root, '_headers'), out);
console.log('_headers généré.');

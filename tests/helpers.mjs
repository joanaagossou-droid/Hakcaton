/** Utilitaires partagés par les tests (Node ≥ 18, aucune dépendance). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../server/server.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
export const referential = readJson('src/data/criteria.json');
export const scenarios = readJson('src/data/scenarios.json').scenarios;
export const corrections = readJson('src/data/corrections.json').corrections;

/** Démarre le serveur local sur un port libre. */
export async function startServer(opts = {}) {
  const srv = createServer({ quiet: true, allowlist: [], ...opts }).listen(0, '127.0.0.1');
  await new Promise((r) => srv.on('listening', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  return { srv, base, close: () => new Promise((r) => srv.close(r)) };
}

/** Récupération « same-origin » équivalente au mode navigateur (avec Set-Cookie en plus). */
export async function localFetcher(u) {
  const r = await fetch(u);
  const buf = new Uint8Array(await r.arrayBuffer());
  return { url: r.url, status: r.status, headers: r.headers, text: new TextDecoder().decode(buf), bytes: buf.length, setCookies: r.headers.getSetCookie ? r.headers.getSetCookie() : [] };
}

/** Évaluation « tout conforme, prouvé par un humain ». */
export function allConform(proof = 'human') {
  const out = {};
  for (const c of referential.criteria) out[c.id] = { note: 2, proof };
  return out;
}

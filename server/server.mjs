/**
 * NUKUN — Serveur local (démonstration, tests, plan de secours n° 2).
 * Node ≥ 18, aucune dépendance.
 *
 *   node server/server.mjs              → http://localhost:8080
 *   PORT=3000 node server/server.mjs
 *   HOST=0.0.0.0 node server/server.mjs → accessible depuis un téléphone du même réseau
 *
 * Sert les fichiers statiques avec les en-têtes de server/headers.mjs et expose
 * POST /api/analyze (analyse d'une adresse de la liste autorisée NUKUN_ALLOWLIST).
 * Aucun journal d'accès n'est écrit.
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { headersFor } from './headers.mjs';
import { createAnalyzeService, allowlistFromEnv } from './analyze-handler.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIRS = ['src', 'public', 'haven', 'light'];
const PUBLIC_FILES = ['index.html', 'manifest.webmanifest', 'service-worker.js', 'robots.txt'];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8'
};

export function resolveStatic(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split('?')[0]); } catch { return null; }
  if (p.includes('\0') || p.includes('\\')) return null;
  if (p.endsWith('/')) p += 'index.html';
  const rel = path.posix.normalize(p).replace(/^\/+/, '');
  if (rel.startsWith('..') || rel.split('/').some((seg) => seg.startsWith('.'))) return null;
  const top = rel.split('/')[0];
  if (!(PUBLIC_FILES.includes(rel) || PUBLIC_DIRS.includes(top))) return null;
  const abs = path.resolve(ROOT, rel);
  if (!abs.startsWith(ROOT + path.sep)) return null;
  return abs;
}

export function createServer({ allowlist = allowlistFromEnv(), quiet = false } = {}) {
  const service = createAnalyzeService({ allowlist });

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://local');
    const { headers } = headersFor(url.pathname);

    // --- API d'analyse ---
    if (url.pathname === '/api/analyze') {
      const base = { ...headersFor('/').headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
      if (req.method !== 'POST') { res.writeHead(405, { ...base, Allow: 'POST' }); return res.end(JSON.stringify({ ok: false, message: 'Méthode non autorisée.' })); }
      let body = '';
      let tooBig = false;
      for await (const chunk of req) { body += chunk; if (body.length > 4096) { tooBig = true; break; } }
      if (tooBig) { res.writeHead(413, base); return res.end(JSON.stringify({ ok: false, message: 'Requête trop volumineuse.' })); }
      let payload;
      try { payload = JSON.parse(body || '{}'); } catch { payload = {}; }
      const client = req.socket.remoteAddress || 'inconnu';
      const out = await service.handle({ url: typeof payload.url === 'string' ? payload.url : '', client });
      res.writeHead(out.status, base);
      return res.end(JSON.stringify(out.body));
    }
    if (url.pathname === '/api/status') {
      res.writeHead(200, { ...headersFor('/').headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ ok: true, analyzer: true, allowlist: service.allowlist.map((a) => a.host + a.path) }));
    }

    // --- Fichiers statiques ---
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, headers); return res.end(); }
    if (url.pathname === '/haven' || url.pathname === '/light') { res.writeHead(301, { ...headers, Location: url.pathname + '/' }); return res.end(); }
    const file = resolveStatic(url.pathname);
    if (!file) { res.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Introuvable'); }
    try {
      const data = await fs.readFile(file);
      const ext = path.extname(file).toLowerCase();
      const h = { ...headers, 'Content-Type': MIME[ext] || 'application/octet-stream' };
      if (!h['Cache-Control']) h['Cache-Control'] = ext === '.html' || file.endsWith('service-worker.js') ? 'no-cache' : 'public, max-age=3600';
      if (!h['Set-Cookie'] || ext !== '.html') delete h['Set-Cookie'];
      res.writeHead(200, h);
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch {
      res.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Introuvable');
    }
  }).on('listening', function () {
    if (!quiet) {
      const a = this.address();
      console.log(`NUKUN en local : http://localhost:${a.port}/  (HAVEN : /haven/  ·  LIGHT : /light/)`);
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8080);
  const host = process.env.HOST || '127.0.0.1';
  createServer().listen(port, host);
}

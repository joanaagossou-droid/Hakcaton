/** Essais de sécurité S-1 à S-12 réalisables automatiquement (mémoire § 10.2). */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { validateTargetUrl, parseAllowlist, isBlockedIPv4, isBlockedIPv6 } from '../../src/modules/url-analyzer/url-policy.js';
import { safeFetch, safeLookup, LIMITS } from '../../server/safe-fetch.mjs';
import { createAnalyzeService, RATE } from '../../server/analyze-handler.mjs';
import { startServer, ROOT } from '../helpers.mjs';

const ALLOW = parseAllowlist(['demo.exemple.org', '*.equipes.exemple.org', 'site.exemple.org/haven/']);

test('S-5 : adresses dangereuses refusées par la politique', () => {
  const refused = [
    'http://localhost/', 'http://LOCALHOST:80/', 'http://127.0.0.1/', 'http://127.1/', 'http://2130706433/', 'http://0x7f000001/',
    'http://169.254.169.254/latest/meta-data/', 'http://metadata.google.internal/', 'http://10.0.0.5/', 'http://192.168.1.1/',
    'http://172.16.0.1/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://[fd00:ec2::254]/', 'http://0.0.0.0/',
    'file:///etc/passwd', 'ftp://demo.exemple.org/', 'gopher://demo.exemple.org/', 'javascript:alert(1)', 'data:text/html,x',
    'http://user:pass@demo.exemple.org/', 'http://demo.exemple.org:8080/', 'http://router.local/', 'http://intranet.corp/',
    'https://autre-site.org/', 'https://exemple.org/', 'https://site.exemple.org/safeher/', 'https://equipes.exemple.org/',
    'http://demo.exemple.org/\nHost: x', ' ', 'x'.repeat(3000)
  ];
  for (const u of refused) assert.equal(validateTargetUrl(u, ALLOW).ok, false, u);
});

test('liste autorisée : hôtes exacts, sous-domaines, préfixe de chemin', () => {
  assert.equal(validateTargetUrl('https://demo.exemple.org/page', ALLOW).ok, true);
  assert.equal(validateTargetUrl('https://equipe3.equipes.exemple.org/', ALLOW).ok, true);
  assert.equal(validateTargetUrl('https://site.exemple.org/haven/recours.html', ALLOW).ok, true);
  assert.equal(validateTargetUrl('https://demo.exemple.org.attaquant.com/', ALLOW).ok, false);
});

test('plages IP interdites', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.31.255.255', '192.168.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255']) assert.ok(isBlockedIPv4(ip), ip);
  for (const ip of ['8.8.8.8', '41.138.80.1', '172.32.0.1']) assert.ok(!isBlockedIPv4(ip), ip);
  for (const ip of ['::1', '::', 'fe80::1', 'fc00::1', 'fd12::1', '::ffff:10.0.0.1', 'ff02::1']) assert.ok(isBlockedIPv6(ip), ip);
  assert.ok(!isBlockedIPv6('2001:4860:4860::8888'));
});

test('S-5 : la résolution DNS vers une adresse privée est refusée au moment de la connexion', async () => {
  const err = await new Promise((resolve) => safeLookup('localhost', {}, (e) => resolve(e)));
  assert.ok(err && err.code === 'private-ip');
});

/** Petit serveur « externe » simulé, sur la boucle locale, pour tester redirections et taille. */
async function fakeSite(handler) {
  const s = http.createServer(handler).listen(0, '127.0.0.1');
  await new Promise((r) => s.on('listening', r));
  return { url: `http://127.0.0.1:${s.address().port}`, close: () => new Promise((r) => s.close(r)) };
}
// Pour ces tests seulement : on autorise la boucle locale et on court-circuite le DNS.
const TEST_OPTS = { allowLocalForTests: true, lookup: (h, o, cb) => (o && o.all ? cb(null, [{ address: '127.0.0.1', family: 4 }]) : cb(null, '127.0.0.1', 4)) };

test('S-5 : redirection vers une destination interdite refusée', async () => {
  const site = await fakeSite((req, res) => { res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' }); res.end(); });
  try {
    await assert.rejects(safeFetch(site.url + '/', parseAllowlist(['127.0.0.1']), TEST_OPTS), (e) => /Redirection refusée/.test(e.message));
  } finally { await site.close(); }
});

test('téléchargement excessif interrompu', async () => {
  const site = await fakeSite((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); const chunk = Buffer.alloc(64 * 1024, 97); let n = 0; const w = () => { while (n++ < 60) { if (!res.write(chunk)) return res.once('drain', w); } res.end(); }; w(); });
  try {
    await assert.rejects(safeFetch(site.url + '/', parseAllowlist(['127.0.0.1']), TEST_OPTS), (e) => e.code === 'too-large');
  } finally { await site.close(); }
  assert.equal(LIMITS.maxBytes, 2 * 1024 * 1024);
});

test('l\'analyseur n\'envoie que des GET, sans cookie ni corps, et s\'identifie', async () => {
  const seen = [];
  const site = await fakeSite((req, res) => { seen.push({ m: req.method, cookie: req.headers.cookie, ua: req.headers['user-agent'] }); res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html><title>x</title><form><input name="nom" required></form></html>'); });
  try {
    const r = await safeFetch(site.url + '/', parseAllowlist(['127.0.0.1']), TEST_OPTS);
    assert.equal(r.status, 200);
    assert.ok(seen.every((s) => s.m === 'GET' && !s.cookie && /NUKUN-AuditBot/.test(s.ua)));
  } finally { await site.close(); }
});

test('S-7 : limitation des analyses par appareil, sans bloquer les autres', async () => {
  let calls = 0;
  const svc = createAnalyzeService({ allowlist: ['demo.exemple.org'], fetchImpl: async (u) => { calls++; return { url: u, status: 200, headers: { 'content-type': 'text/html' }, text: '<html><title>t</title></html>', bytes: 30 }; } });
  const results = [];
  for (let i = 0; i < 30; i++) results.push((await svc.handle({ url: `https://demo.exemple.org/p${i}`, client: '1.2.3.4' })).status);
  assert.equal(results.filter((s) => s === 200).length, RATE.perClientPerMinute);
  assert.equal(results.filter((s) => s === 429).length, 30 - RATE.perClientPerMinute);
  assert.equal((await svc.handle({ url: 'https://demo.exemple.org/', client: '5.6.7.8' })).status, 200);
  // Cache : une même adresse n'est pas relue
  const before = calls;
  await svc.handle({ url: 'https://demo.exemple.org/', client: '9.9.9.9' });
  assert.equal(calls, before);
});

test('le service refuse une adresse hors liste avec un message clair', async () => {
  const svc = createAnalyzeService({ allowlist: ['demo.exemple.org'] });
  const r = await svc.handle({ url: 'http://169.254.169.254/', client: 'x' });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /interdites|autorisée/);
});

test('serveur : traversée de répertoire, fichiers internes, méthodes et tailles', async () => {
  const s = await startServer();
  try {
    for (const p of ['/../package.json', '/%2e%2e/package.json', '/server/server.mjs', '/tests/helpers.mjs', '/package.json', '/.git/config', '/src/../server/headers.mjs', '/haven/..%5c..%5cpackage.json']) {
      const r = await fetch(s.base + p);
      assert.equal(r.status, 404, p);
    }
    assert.equal((await fetch(s.base + '/api/analyze')).status, 405);
    const big = await fetch(s.base + '/api/analyze', { method: 'POST', body: JSON.stringify({ url: 'x'.repeat(5000) }) });
    assert.equal(big.status, 413);
    const loc = await fetch(s.base + '/api/analyze', { method: 'POST', body: JSON.stringify({ url: 'http://localhost/' }) });
    assert.equal(loc.status, 400);
  } finally { await s.close(); }
});

test('S-3 : en-têtes de sécurité (NUKUN et SafeHer complets, HAVEN volontairement incomplet)', async () => {
  const s = await startServer();
  try {
    const n = await fetch(s.base + '/');
    for (const hd of ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'x-frame-options', 'strict-transport-security']) assert.ok(n.headers.get(hd), 'NUKUN ' + hd);
    assert.match(n.headers.get('content-security-policy'), /script-src 'self'/);
    assert.doesNotMatch(n.headers.get('content-security-policy'), /unsafe-inline|unsafe-eval|\*/);
    const l = await fetch(s.base + '/safeher/ecrire.html');
    assert.equal(l.headers.get('cache-control'), 'no-store');
    assert.match(l.headers.get('x-robots-tag'), /noindex/);
    const hv = await fetch(s.base + '/haven/');
    assert.ok(hv.headers.get('content-security-policy'), 'HAVEN garde une CSP (sécurité de la démo)');
    assert.equal(hv.headers.get('referrer-policy'), null);
    assert.match(hv.headers.get('x-robots-tag'), /noindex/);
  } finally { await s.close(); }
});

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return ['node_modules', 'output', '.git'].includes(e.name) ? [] : walk(p);
  return [p];
});

test('S-8 : aucun secret dans le dépôt', () => {
  const patterns = [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, /AKIA[0-9A-Z]{16}/, /AIza[0-9A-Za-z_-]{35}/, /sk-[A-Za-z0-9]{32,}/, /ghp_[A-Za-z0-9]{36}/, /xox[bp]-[A-Za-z0-9-]{10,}/, /(?:password|passwd|secret|api[_-]?key)\s*[:=]\s*['"][^'"\s]{8,}['"]/i];
  const hits = [];
  for (const f of walk(ROOT)) {
    if (!/\.(?:js|mjs|json|html|css|toml|md|txt|webmanifest)$|_headers$/.test(f)) continue;
    const s = fs.readFileSync(f, 'utf8');
    for (const re of patterns) if (re.test(s)) hits.push(path.relative(ROOT, f) + ' ' + re);
  }
  assert.deepEqual(hits, []);
});

test('S-6 : aucune insertion HTML brute dans le code de NUKUN', () => {
  const hits = [];
  for (const f of walk(path.join(ROOT, 'src'))) {
    if (!f.endsWith('.js')) continue;
    const s = fs.readFileSync(f, 'utf8');
    if (/\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write\s*\(|\beval\s*\(|new Function\s*\(/.test(s)) hits.push(path.relative(ROOT, f));
  }
  assert.deepEqual(hits, []);
});

test('S-10 et non-confusion : bandeau « site fictif » et noindex sur chaque page HAVEN et SafeHer', () => {
  const banner = 'Créé exclusivement pour une démonstration pédagogique. Ce site n\'est pas un service officiel et ne reçoit aucun signalement réel.';
  for (const dir of ['haven', 'safeher']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((x) => x.endsWith('.html'))) {
      const s = fs.readFileSync(path.join(ROOT, dir, f), 'utf8');
      assert.ok(s.includes('SITE FICTIF') && s.includes(banner), `${dir}/${f} : bandeau`);
      assert.match(s, /<meta name="robots" content="noindex/, `${dir}/${f} : noindex`);
    }
  }
  assert.match(fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8'), /Disallow: \//);
});

test('C1 appliqué à NUKUN lui-même : aucune ressource tierce chargée par les pages', () => {
  const files = ['index.html', ...['haven', 'safeher'].flatMap((d) => fs.readdirSync(path.join(ROOT, d)).filter((x) => x.endsWith('.html')).map((x) => `${d}/${x}`))];
  for (const f of files) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    const ext = [...s.matchAll(/<(?:script|link|img|iframe)[^>]+(?:src|href)=["'](https?:)?\/\//gi)];
    assert.equal(ext.length, 0, f);
  }
});

test('S-9 : les formulaires de démonstration n\'ont ni action ni bouton d\'envoi natif', () => {
  for (const f of ['haven/signaler.html', 'safeher/ecrire.html']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const form = s.match(/<form[^>]*>/)[0];
    assert.ok(!/action=/.test(form), f + ' action');
    assert.ok(!/type="submit"/.test(s), f + ' submit');
  }
});

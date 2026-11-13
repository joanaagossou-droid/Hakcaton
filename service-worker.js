/**
 * NUKUN — Service worker : fonctionnement hors ligne de l'application d'audit.
 *
 * - Pré-cache de l'application NUKUN (liste générée par tools/gen-precache.mjs).
 * - HAVEN, LIGHT et /api/ ne sont JAMAIS mis en cache (pas de cache sensible,
 *   et l'analyse doit lire la version en ligne) : le réseau est utilisé tel quel.
 * - Stratégie : cache d'abord, puis mise à jour en arrière-plan.
 */
const VERSION = 'nukun-501871c61458';
const PRECACHE = /*PRECACHE*/["./","index.html","manifest.webmanifest","src/app.js","src/components/charts.js","src/components/ui.js","src/data/corrections.json","src/data/criteria.json","src/data/reference/haven.json","src/data/reference/light.json","src/data/scenarios.json","src/data/snapshots/haven.json","src/data/snapshots/light.json","src/i18n/fr.js","src/modules/audit-engine/audit-engine.js","src/modules/comparison/compare.js","src/modules/report-generator/exports.js","src/modules/report-generator/pdf-writer.js","src/modules/report-generator/report-model.js","src/modules/scoring/scoring.js","src/modules/url-analyzer/analyzer-core.js","src/modules/url-analyzer/client.js","src/modules/url-analyzer/url-policy.js","src/pages/audit.js","src/pages/express.js","src/pages/home.js","src/pages/kit.js","src/pages/report.js","src/styles/main.css","src/theme.js","src/utils/dom.js","src/utils/image.js","src/utils/qr.js","src/utils/store.js","public/fonts/OFL-Outfit.txt","public/fonts/outfit-variable.woff2","public/icons/icon-192.png","public/icons/icon-512.png","public/icons/nukun.svg"]/*END*/;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope);
  const rel = url.pathname.slice(scope.pathname.length);
  if (rel.startsWith('haven/') || rel.startsWith('light/') || rel.startsWith('api/') || rel === 'haven' || rel === 'light') return;

  event.respondWith(caches.open(VERSION).then(async (cache) => {
    const key = rel === '' ? scope.href : req;
    const cached = await cache.match(key, { ignoreSearch: true });
    const network = fetch(req).then((res) => {
      if (res && res.ok && res.type === 'basic') cache.put(key, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { event.waitUntil(network); return cached; }
    const res = await network;
    return res || new Response('Hors ligne : ressource indisponible.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }));
});

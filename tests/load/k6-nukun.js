/**
 * NUKUN — Essais de charge C1 à C4 (mémoire § 10.3) avec k6 (https://k6.io).
 * À lancer UNIQUEMENT sur vos propres adresses, dans le respect des conditions de l'hébergeur.
 *
 *   k6 run -e BASE=https://<votre-site> tests/load/k6-nukun.js
 *   k6 run -e BASE=https://<votre-site> -e SCENARIO=pic tests/load/k6-nukun.js
 *
 * Scénarios : montee (C1, 0→200 VU en 2 min + palier 5 min), pic (C2, 150 VU en 10 s),
 * analyses (C3, 50 analyses de HAVEN — limitées par appareil : attendre des 429 au-delà de 10/min/IP),
 * endurance (C4, 30 VU pendant 30 min).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE;
if (!BASE) throw new Error('Définissez BASE, par exemple -e BASE=https://mon-site.netlify.app');
const S = __ENV.SCENARIO || 'montee';

const scenarios = {
  montee: { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '2m', target: 200 }, { duration: '5m', target: 200 }, { duration: '30s', target: 0 }] },
  pic: { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '10s', target: 150 }, { duration: '1m', target: 150 }] },
  analyses: { executor: 'shared-iterations', vus: 50, iterations: 50, exec: 'analyse' },
  endurance: { executor: 'constant-vus', vus: 30, duration: '30m' }
};

export const options = {
  scenarios: { [S]: scenarios[S] },
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<2000'] }
};

const PAGES = ['/', '/src/app.js', '/src/styles/main.css', '/src/data/criteria.json', '/haven/', '/safeher/', '/safeher/ecrire.html'];

export default function () {
  for (const p of PAGES) {
    const r = http.get(BASE + p);
    check(r, { 'statut 200': (x) => x.status === 200 });
  }
  sleep(1 + Math.random() * 2);
}

export function analyse() {
  const r = http.post(BASE + '/api/analyze', JSON.stringify({ url: BASE + '/haven/' }), { headers: { 'Content-Type': 'application/json' } });
  check(r, { 'analyse 200 ou limitée 429': (x) => x.status === 200 || x.status === 429, 'moins de 3 s': (x) => x.timings.duration < 3000 });
}

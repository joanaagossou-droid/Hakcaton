/**
 * NUKUN — Logique du service d'analyse (indépendante de l'hébergeur).
 *
 * Données traitées : l'adresse à analyser (dans la liste autorisée) et l'adresse IP
 * de l'appareil, gardée en mémoire vive une minute au plus pour la limitation.
 * Rien n'est écrit sur disque ni journalisé par NUKUN (voir docs/SECURITE_ET_JOURNAUX.md).
 */
import { runAnalysis } from '../src/modules/url-analyzer/analyzer-core.js';
import { parseAllowlist, validateTargetUrl } from '../src/modules/url-analyzer/url-policy.js';
import { safeFetch, FetchRefused } from './safe-fetch.mjs';

export const RATE = { perClientPerMinute: 10, globalPerMinute: 120 };
export const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 100;

export function createAnalyzeService({ allowlist, fetchImpl = safeFetch, now = () => Date.now(), fetchOpts = {} } = {}) {
  const entries = parseAllowlist(allowlist);
  const hits = new Map();   // client -> [timestamps]
  let globalHits = [];
  const cache = new Map();  // url -> {at, result}

  function rateLimited(client) {
    const t = now();
    globalHits = globalHits.filter((x) => t - x < 60000);
    const list = (hits.get(client) || []).filter((x) => t - x < 60000);
    if (list.length >= RATE.perClientPerMinute || globalHits.length >= RATE.globalPerMinute) {
      hits.set(client, list);
      return true;
    }
    list.push(t);
    globalHits.push(t);
    hits.set(client, list);
    // Nettoyage : on ne garde pas d'adresse IP plus d'une minute.
    for (const [k, v] of hits) if (!v.some((x) => t - x < 60000)) hits.delete(k);
    return false;
  }

  /**
   * @returns {Promise<{status:number, body:object}>}
   */
  async function handle({ url, client = 'inconnu' }) {
    if (rateLimited(client)) {
      return { status: 429, body: { ok: false, code: 'rate-limit', message: 'Trop d\'analyses en peu de temps. Réessayez dans une minute.' } };
    }
    const v = validateTargetUrl(url, entries, fetchOpts);
    if (!v.ok) return { status: 400, body: { ok: false, code: v.code, message: v.message } };

    const key = v.url.href;
    const cached = cache.get(key);
    if (cached && now() - cached.at < CACHE_TTL_MS) {
      return { status: 200, body: { ok: true, cached: true, result: cached.result } };
    }
    try {
      const result = await runAnalysis(key, (u) => fetchImpl(u, entries, fetchOpts), { mode: 'serveur' });
      cache.set(key, { at: now(), result });
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
      return { status: 200, body: { ok: true, cached: false, result } };
    } catch (e) {
      if (e instanceof FetchRefused) return { status: 400, body: { ok: false, code: e.code, message: e.message } };
      return { status: 502, body: { ok: false, code: 'fetch-failed', message: 'Le site n\'a pas pu être analysé (inaccessible ou délai dépassé). Utilisez le mode manuel.' } };
    }
  }

  return { handle, allowlist: entries };
}

/** Liste autorisée par défaut : variable d'environnement NUKUN_ALLOWLIST (séparée par des virgules). */
export function allowlistFromEnv(env = process.env) {
  const list = (env.NUKUN_ALLOWLIST || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (env.URL) {
    try {
      const self = new URL(env.URL).host;
      list.push(`${self}/haven/`, `${self}/light/`);
    } catch { /* ignoré */ }
  }
  return list;
}

/**
 * NUKUN — Orchestration de l'analyse côté navigateur.
 *
 * Trois modes, du plus direct au plus prudent :
 *  1. « navigateur » : l'adresse est sur le même site que NUKUN (HAVEN, SafeHer) ;
 *     le navigateur lit lui-même les pages (règle de même origine respectée).
 *  2. « serveur »    : autre site de la liste autorisée ; la fonction serveur
 *     légère /api/analyze fait la lecture passive (protégée contre la SSRF).
 *  3. « instantané » : plan de secours ; résultat enregistré à l'avance, daté.
 * Si aucun mode n'est possible, l'auditeur passe en mode manuel.
 */
import { runAnalysis } from './analyzer-core.js';

const DEMO_PATHS = ['/haven/', '/safeher/'];

export function isSameOrigin(url) {
  try { return new URL(url, location.href).origin === location.origin; } catch { return false; }
}

/** Seules les sections de démonstration du site sont analysables en mode navigateur. */
export function isLocalDemo(url) {
  try {
    const u = new URL(url, location.href);
    return u.origin === location.origin && DEMO_PATHS.some((p) => u.pathname.startsWith(p));
  } catch { return false; }
}

async function browserFetcher(u) {
  const target = new URL(u, location.href);
  if (target.origin !== location.origin) throw new Error('Ressource hors du site : non contactée.');
  const r = await fetch(target.href, { credentials: 'omit', cache: 'no-store', redirect: 'follow' });
  if (new URL(r.url).origin !== location.origin) throw new Error('Redirection hors du site refusée.');
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.length > 3 * 1024 * 1024) throw new Error('Ressource trop volumineuse.');
  return { url: r.url, status: r.status, headers: r.headers, text: new TextDecoder().decode(buf), bytes: buf.length, setCookies: [] };
}

export async function serverStatus() {
  try {
    const r = await fetch('/api/status', { cache: 'no-store', credentials: 'omit' });
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.analyzer ? j : null;
  } catch { return null; }
}

/**
 * @returns {Promise<{ok:true,result}|{ok:false,message,code}>}
 */
export async function analyze(url) {
  let u;
  try { u = new URL(url, location.href); } catch { return { ok: false, code: 'invalid', message: 'Adresse invalide.' }; }
  if (!/^https?:$/.test(u.protocol)) return { ok: false, code: 'protocol', message: 'Seuls http et https sont acceptés.' };

  if (isSameOrigin(u.href)) {
    if (!isLocalDemo(u.href)) return { ok: false, code: 'not-allowed', message: 'Sur ce site, seules les démonstrations /haven/ et /safeher/ sont analysables.' };
    try {
      const result = await runAnalysis(u.href, browserFetcher, { mode: 'navigateur' });
      return { ok: true, result };
    } catch (e) {
      return { ok: false, code: navigator.onLine === false ? 'offline' : 'fetch-failed', message: navigator.onLine === false ? 'Connexion nécessaire pour analyser une adresse.' : 'Lecture impossible : ' + (e && e.message || e) };
    }
  }

  if (navigator.onLine === false) return { ok: false, code: 'offline', message: 'Connexion nécessaire pour analyser une adresse.' };
  try {
    const r = await fetch('/api/analyze', {
      method: 'POST', credentials: 'omit', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: u.href })
    });
    let j = null;
    try { j = await r.json(); } catch { j = null; }
    if (!j) return { ok: false, code: 'unavailable', message: 'L\'analyseur serveur n\'est pas disponible sur cet hébergement. Utilisez le mode manuel.' };
    if (!j.ok) return { ok: false, code: j.code || 'refused', message: j.message || 'Analyse refusée.' };
    return { ok: true, result: j.result, cached: j.cached };
  } catch {
    return { ok: false, code: 'unavailable', message: 'L\'analyseur serveur ne répond pas. Utilisez le mode manuel.' };
  }
}

/** Plan de secours : analyse enregistrée à l'avance (générée par tools/snapshot-analyses.mjs). */
export async function loadSnapshot(caseId) {
  if (!['haven', 'safeher'].includes(caseId)) return null;
  try {
    const r = await fetch(`src/data/snapshots/${caseId}.json`, { credentials: 'omit' });
    if (!r.ok) return null;
    const j = await r.json();
    j.mode = 'instantané';
    return j;
  } catch { return null; }
}

/**
 * NUKUN — Récupération HTTP protégée contre la SSRF (Node, sans dépendance).
 *
 * - Validation de l'adresse (url-policy.js) à chaque requête ET à chaque redirection.
 * - Résolution DNS contrôlée : toutes les adresses résolues sont vérifiées, et la
 *   connexion utilise l'adresse vérifiée (pas de « DNS rebinding » entre contrôle et connexion).
 * - Méthode GET uniquement, aucun corps envoyé, aucun cookie envoyé.
 * - Taille maximale, délai maximal, 3 redirections au plus.
 */
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import { validateTargetUrl, isBlockedIPv4, isBlockedIPv6 } from '../src/modules/url-analyzer/url-policy.js';

export const LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  timeoutMs: 8000,
  maxRedirects: 3
};

export const USER_AGENT = 'NUKUN-AuditBot/1.0 (analyse passive Safety by Design; aucune soumission de formulaire)';

export class FetchRefused extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

/** lookup sécurisé : refuse si UNE des adresses résolues est interdite. */
export function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) return callback(err);
    if (!addresses || !addresses.length) return callback(new FetchRefused('dns', 'Nom de domaine introuvable.'));
    for (const a of addresses) {
      const blocked = a.family === 6 ? isBlockedIPv6(a.address) : isBlockedIPv4(a.address);
      if (blocked) return callback(new FetchRefused('private-ip', 'Le domaine pointe vers une adresse privée ou réservée : analyse refusée.'));
    }
    const first = addresses[0];
    if (options && options.all) return callback(null, [first]);
    callback(null, first.address, first.family);
  });
}

function requestOnce(url, { lookup = safeLookup } = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request(url, {
      method: 'GET',
      lookup,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml,text/css,application/javascript,*/*;q=0.5',
        'accept-encoding': 'identity'
      },
      timeout: LIMITS.timeoutMs
    }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (c) => {
        size += c.length;
        if (size > LIMITS.maxBytes) {
          req.destroy(new FetchRefused('too-large', `Réponse trop volumineuse (> ${LIMITS.maxBytes / 1024 / 1024} Mo) : téléchargement interrompu.`));
          return;
        }
        chunks.push(c);
      });
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, body: buf });
      });
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new FetchRefused('timeout', 'Délai dépassé.')));
    req.on('error', reject);
    req.end();
  });
}

/**
 * @param {string} rawUrl
 * @param {Array} allowlist entrées normalisées (parseAllowlist)
 * @returns {Promise<{url,status,headers,text,bytes,setCookies}>}
 */
export async function safeFetch(rawUrl, allowlist, opts = {}) {
  let current = rawUrl;
  for (let hop = 0; hop <= LIMITS.maxRedirects; hop++) {
    const v = validateTargetUrl(current, allowlist, opts);
    if (!v.ok) throw new FetchRefused(v.code, hop ? `Redirection refusée : ${v.message}` : v.message);
    const res = await requestOnce(v.url, opts);
    if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.location) {
      current = new URL(res.headers.location, v.url).href;
      continue;
    }
    const text = res.body.toString('utf8');
    const sc = res.headers['set-cookie'];
    return {
      url: v.url.href,
      status: res.status,
      headers: res.headers,
      text,
      bytes: res.body.length,
      setCookies: Array.isArray(sc) ? sc : sc ? [sc] : []
    };
  }
  throw new FetchRefused('redirects', 'Trop de redirections.');
}

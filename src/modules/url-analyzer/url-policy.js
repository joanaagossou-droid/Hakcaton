/**
 * NUKUN — Politique d'adresses de l'analyseur (module pur, navigateur + Node).
 *
 * Toute adresse soumise à l'analyseur passe par validateTargetUrl() :
 *  - protocoles http et https uniquement ;
 *  - aucun identifiant dans l'adresse (user:pass@) ;
 *  - ports 80 et 443 uniquement (ou port explicite de la liste autorisée) ;
 *  - aucun nom local (localhost, *.local, *.internal) ni adresse IP littérale privée,
 *    réservée ou de métadonnées cloud ;
 *  - l'hôte doit figurer dans la liste autorisée.
 * Côté serveur, la résolution DNS est vérifiée à son tour (voir server/safe-fetch.mjs).
 */

export const MAX_URL_LENGTH = 2048;

/** Adresses IPv4 interdites (bloc, masque). */
const BLOCKED_V4 = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4], ['255.255.255.255', 32]
];

function v4ToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

export function isBlockedIPv4(ip) {
  const n = v4ToInt(ip);
  if (n === null) return true;
  return BLOCKED_V4.some(([base, bits]) => {
    const b = v4ToInt(base);
    const size = 2 ** (32 - bits);
    return n >= b && n < b + size;
  });
}

export function isBlockedIPv6(ip) {
  const x = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (x === '::' || x === '::1') return true;
  // IPv4 mappée ou compatible (::ffff:a.b.c.d ou ::ffff:7f00:1)
  const mapped = x.match(/^(?:0*:)*:?ffff:(\d+\.\d+\.\d+\.\d+)$/) || x.match(/^::(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIPv4(mapped[1]);
  if (/^(?:0*:)*:?ffff:/.test(x)) return true;
  if (/^f[cd]/.test(x)) return true;          // fc00::/7 unique local
  if (/^fe[89ab]/.test(x)) return true;       // fe80::/10 lien local
  if (/^ff/.test(x)) return true;             // multicast
  if (/^2001:0?db8:/.test(x)) return true;    // documentation
  if (/^64:ff9b:/.test(x)) return true;       // NAT64
  if (/^fd00:ec2::254$/.test(x)) return true; // métadonnées AWS IPv6
  return false;
}

export function isIpLiteral(host) {
  const h = host.replace(/^\[|\]$/g, '');
  return /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':') || /^\d+$/.test(h) || /^0x[0-9a-f]+$/i.test(h);
}

const LOCAL_NAMES = /^(?:localhost|localhost\.localdomain|ip6-localhost|ip6-loopback|metadata|metadata\.google\.internal|instance-data)$|\.(?:localhost|local|internal|intranet|lan|home|corp|arpa)$/i;

/**
 * Normalise la liste autorisée : « exemple.org » autorise exactement cet hôte ;
 * « *.exemple.org » autorise ses sous-domaines. Un préfixe de chemin facultatif
 * peut être donné : « exemple.org/haven/ ».
 */
export function parseAllowlist(list) {
  return (list || [])
    .map((s) => String(s).trim().toLowerCase())
    .filter(Boolean)
    .map((entry) => {
      const [hostPart, ...rest] = entry.replace(/^https?:\/\//, '').split('/');
      return { host: hostPart, path: rest.length ? '/' + rest.join('/') : '/' };
    });
}

export function isAllowed(url, allowlist) {
  const host = url.hostname.toLowerCase();
  return allowlist.some((a) => {
    const hostOk = a.host.startsWith('*.') ? host.endsWith(a.host.slice(1)) && host !== a.host.slice(2) : host === a.host;
    return hostOk && url.pathname.startsWith(a.path);
  });
}

/**
 * @returns {{ok:true,url:URL}|{ok:false,code:string,message:string}}
 */
export function validateTargetUrl(input, allowlistEntries, { allowLocalForTests = false } = {}) {
  if (typeof input !== 'string' || !input.trim()) return fail('empty', 'Saisissez une adresse.');
  const raw = input.trim();
  if (raw.length > MAX_URL_LENGTH) return fail('too-long', 'Adresse trop longue.');
  if (/[\u0000-\u001f\u007f\s]/.test(raw)) return fail('invalid-chars', 'L\'adresse contient des caractères non autorisés.');
  let url;
  try { url = new URL(raw); } catch { return fail('invalid', 'Adresse invalide. Exemple attendu : https://exemple.org/page'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return fail('protocol', 'Seuls les protocoles http et https sont acceptés.');
  if (url.username || url.password) return fail('credentials', 'Les identifiants dans l\'adresse sont interdits.');
  const host = url.hostname.toLowerCase();
  if (!allowLocalForTests) {
    if (LOCAL_NAMES.test(host)) return fail('local', 'Les adresses locales sont interdites.');
    if (isIpLiteral(host)) {
      const h = host.replace(/^\[|\]$/g, '');
      if (h.includes(':') ? isBlockedIPv6(h) : isBlockedIPv4(h)) return fail('private-ip', 'Les adresses IP privées, locales ou réservées sont interdites.');
      return fail('ip-literal', 'Les adresses IP directes ne sont pas acceptées : utilisez un nom de domaine de la liste autorisée.');
    }
    if (url.port && url.port !== '80' && url.port !== '443') return fail('port', 'Seuls les ports standard (80 et 443) sont acceptés.');
  }
  if (!isAllowed(url, allowlistEntries)) return fail('not-allowed', 'Cette adresse ne fait pas partie de la liste autorisée. NUKUN n\'analyse que les sites dont l\'audit est autorisé.');
  url.hash = '';
  return { ok: true, url };
}

function fail(code, message) {
  return { ok: false, code, message };
}

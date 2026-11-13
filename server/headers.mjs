/**
 * NUKUN — En-têtes HTTP par zone du site (source unique pour le serveur local
 * et pour le fichier _headers de l'hébergeur, généré par tools/build-headers.mjs).
 *
 *  - NUKUN : en-têtes de sécurité complets.
 *  - LIGHT : en-têtes complets + noindex + no-store (pas de cache sensible).
 *  - HAVEN : défauts VOLONTAIRES pour la démonstration (pas de Referrer-Policy,
 *    pas de Permissions-Policy, pas de nosniff, pas de protection contre
 *    l'intégration, cache public, cookie de session déposé d'office).
 *    La CSP est CONSERVÉE sur HAVEN par sécurité : elle garantit qu'aucune
 *    requête ne part vers un tiers, même si le code de démonstration évolue.
 */

const CSP_STRICT = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

const CSP_HAVEN = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "form-action 'self'"
].join('; ');

const COMMON_STRONG = {
  'Content-Security-Policy': CSP_STRICT,
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'X-Frame-Options': 'DENY'
};

export const ZONES = [
  {
    id: 'haven', prefix: '/haven/',
    headers: {
      'Content-Security-Policy': CSP_HAVEN,
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Cache-Control': 'public, max-age=300',
      'Set-Cookie': 'haven_sid=demo-fictif; Path=/haven/; SameSite=Lax'
    }
  },
  {
    id: 'light', prefix: '/light/',
    headers: {
      ...COMMON_STRONG,
      // Mon espace : micro (message vocal, alerte discrète) et lecture audio en mémoire (blob:).
      'Content-Security-Policy': CSP_STRICT + "; media-src 'self' blob:",
      'Permissions-Policy': 'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Cache-Control': 'no-store'
    }
  },
  {
    id: 'nukun', prefix: '/',
    headers: {
      ...COMMON_STRONG,
      'X-Robots-Tag': 'noindex, nofollow'
    }
  }
];

export function headersFor(pathname) {
  const zone = ZONES.find((z) => pathname.startsWith(z.prefix)) || ZONES[ZONES.length - 1];
  return { zone: zone.id, headers: { ...zone.headers } };
}

/**
 * NUKUN — Fonction serveur légère pour l'hébergement Netlify (format « Functions v2 »).
 *
 * Pourquoi une fonction serveur ? Un navigateur ne peut pas lire le code et les
 * en-têtes d'un autre site (règle de même origine). Cette fonction le fait,
 * strictement pour les adresses de la liste autorisée (variable NUKUN_ALLOWLIST
 * + /haven/ et /safeher/ du site lui-même), sans rien enregistrer.
 *
 * Limite : la limitation de débit et le cache sont en mémoire, par instance de
 * fonction ; sur plusieurs instances, la limite effective est plus élevée.
 */
import { createAnalyzeService, allowlistFromEnv } from '../../server/analyze-handler.mjs';
import { headersFor } from '../../server/headers.mjs';

const service = createAnalyzeService({ allowlist: allowlistFromEnv() });

export default async (req, context) => {
  const base = { ...headersFor('/').headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, message: 'Méthode non autorisée.' }), { status: 405, headers: { ...base, Allow: 'POST' } });
  }
  const text = await req.text();
  if (text.length > 4096) return new Response(JSON.stringify({ ok: false, message: 'Requête trop volumineuse.' }), { status: 413, headers: base });
  let payload = {};
  try { payload = JSON.parse(text || '{}'); } catch { payload = {}; }
  const client = (context && context.ip) || 'inconnu';
  const out = await service.handle({ url: typeof payload.url === 'string' ? payload.url : '', client });
  return new Response(JSON.stringify(out.body), { status: out.status, headers: base });
};

export const config = { path: '/api/analyze' };

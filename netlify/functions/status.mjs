/** NUKUN — Indique au navigateur que l'analyseur serveur est disponible, et sa liste autorisée. */
import { allowlistFromEnv } from '../../server/analyze-handler.mjs';
import { parseAllowlist } from '../../src/modules/url-analyzer/url-policy.js';
import { headersFor } from '../../server/headers.mjs';

export default async () => new Response(
  JSON.stringify({ ok: true, analyzer: true, allowlist: parseAllowlist(allowlistFromEnv()).map((a) => a.host + a.path) }),
  { status: 200, headers: { ...headersFor('/').headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }
);

export const config = { path: '/api/status' };

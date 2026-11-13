/**
 * NUKUN — Cœur de l'analyse passive (module pur, navigateur + Node).
 *
 * Principe : on lit le code HTML, les en-têtes et les fichiers de même origine
 * comme une visiteuse ordinaire. On n'exécute aucun script, on ne soumet aucun
 * formulaire, on n'explore que les liens visibles de la même section du site,
 * et on NE CONTACTE JAMAIS les domaines tiers : on se contente de les relever.
 *
 * Limite documentée : l'analyse se fait sur le code reçu. Un contenu ajouté
 * par JavaScript après le chargement n'est pas vu ; les critères concernés
 * renvoient à un test humain (🧪).
 */

export const ANALYZER_VERSION = '1.0.0';
export const MAX_PAGES = 8;
export const MAX_RESOURCES_PER_PAGE = 20;

// ---------------------------------------------------------------------------
// Signatures de traceurs connus (liste non exhaustive, documentée)
// ---------------------------------------------------------------------------
export const TRACKER_SIGNATURES = [
  { id: 'google-analytics', name: 'Google Analytics / gtag', kind: 'analytics',
    re: /googletagmanager\.com|google-analytics\.com|\bgtag\s*\(\s*['"](?:config|js|event)|\bga\s*\(\s*['"]create|_gaq\.push|\bdataLayer\s*=\s*window\.dataLayer/ },
  { id: 'meta-pixel', name: 'Pixel Meta (Facebook)', kind: 'pixel',
    re: /connect\.facebook\.net|facebook\.com\/tr[?/]|\bfbq\s*\(\s*['"](?:init|track)/ },
  { id: 'tiktok-pixel', name: 'Pixel TikTok', kind: 'pixel', re: /analytics\.tiktok\.com|\bttq\.(?:load|page|track)\s*\(/ },
  { id: 'twitter-pixel', name: 'Pixel X (Twitter)', kind: 'pixel', re: /static\.ads-twitter\.com|\btwq\s*\(\s*['"](?:init|track)/ },
  { id: 'linkedin', name: 'LinkedIn Insight', kind: 'pixel', re: /snap\.licdn\.com|_linkedin_partner_id/ },
  { id: 'doubleclick', name: 'DoubleClick / Google Ads', kind: 'pixel', re: /doubleclick\.net|googleadservices\.com|googlesyndication\.com/ },
  { id: 'hotjar', name: 'Hotjar', kind: 'analytics', re: /static\.hotjar\.com|\bhj\s*\(\s*['"]/ },
  { id: 'clarity', name: 'Microsoft Clarity', kind: 'analytics', re: /clarity\.ms\/tag/ },
  { id: 'matomo', name: 'Matomo / Piwik', kind: 'analytics', re: /\b_paq\.push\s*\(|matomo\.js|piwik\.js/ },
  { id: 'yandex', name: 'Yandex Metrica', kind: 'analytics', re: /mc\.yandex\.ru/ },
  { id: 'segment', name: 'Segment', kind: 'analytics', re: /cdn\.segment\.com/ },
  { id: 'mixpanel', name: 'Mixpanel', kind: 'analytics', re: /cdn\.mxpnl\.com|mixpanel\.init\s*\(/ },
  { id: 'amplitude', name: 'Amplitude', kind: 'analytics', re: /cdn\.amplitude\.com|amplitude\.getInstance\s*\(/ }
];

const TRACKING_COOKIE_RE = /^(?:_ga|_gid|_gat|_fbp|_fbc|_hj|_clck|_clsk|_pk_|_ttp|IDE|NID|__utm)/i;
const CONSENT_RE = /tarteaucitron|cookiebot|onetrust|didomi|axeptio|quantcast|data-consent|cookie-?consent|gdpr-?consent/i;

const SECURITY_HEADERS = [
  { id: 'strict-transport-security', label: 'HSTS (Strict-Transport-Security)' },
  { id: 'content-security-policy', label: 'Content-Security-Policy' },
  { id: 'x-content-type-options', label: 'X-Content-Type-Options' },
  { id: 'referrer-policy', label: 'Referrer-Policy' },
  { id: 'frame-protection', label: 'Protection contre l\'intégration (frame-ancestors ou X-Frame-Options)' },
  { id: 'permissions-policy', label: 'Permissions-Policy' }
];

const IDENTIFYING_RE = /(?:^|[^a-z])(nom|name|prenom|prénom|firstname|lastname|surname|tel|t[ée]l[ée]phone|phone|mobile|portable|whatsapp|e-?mail|courriel|mail|adresse|address|cni|identit[ée]|matricule|date.?de.?naissance|birth)/i;
const QUICK_EXIT_TEXT_RE = /sortie\s+rapide|quitter\s+(?:rapidement|vite|le\s+site|maintenant)|^\s*quitter\s*$|quick\s*exit|exit\s+site|leave\s+(?:this\s+)?site/i;
const QUICK_EXIT_ATTR_RE = /data-quick-exit|(?:class|id)\s*=\s*["'][^"']*(?:quick-?exit|sortie-?rapide|exit-?now|safe-?exit)[^"']*["']/i;
const PRIVACY_LINK_RE = /confidentialit|vie\s+priv[ée]e|donn[ée]es\s+personnelles|privacy|mentions\s+l[ée]gales/i;
const REVEALING_TITLE_RE = /violence|signal|agress|abus|vbg|plainte|harc[eè]lement|viol\b|victime|chantage|sextorsion/i;
const PRIVATE_BROWSING_RE = /navigation\s+priv[ée]e|mode\s+priv[ée]|incognito/i;
const DEVICE_WARNING_RE = /(?:appareil|t[ée]l[ée]phone)[^.?!]{0,40}surveill|logiciel\s+espion/i;
// Numéros : groupes de chiffres de type « 00 00 00 00 » (8 chiffres et plus) ou indicatif international.
const PHONE_RE = /(?:\+\d{3}[\s.-]?)?(?:\d{2}[\s.-]){3,4}\d{2}\b/g;

// ---------------------------------------------------------------------------
// Utilitaires d'analyse HTML (sans DOM, compatibles Node)
// ---------------------------------------------------------------------------
export function decodeEntities(s) {
  return String(s)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

export function stripTags(html) {
  return decodeEntities(String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function withoutComments(html) {
  return String(html).replace(/<!--[\s\S]*?-->/g, ' ');
}

export function getAttr(tag, name) {
  const re = new RegExp('\\s' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i');
  const m = tag.match(re);
  if (!m) return null;
  return decodeEntities(m[1] ?? m[2] ?? m[3] ?? '');
}

export function hasAttr(tag, name) {
  return new RegExp('\\s' + name + '(?:\\s*=|\\s|/?>)', 'i').test(tag);
}

function resolveUrl(href, base) {
  try { return new URL(href, base); } catch { return null; }
}

export function extractTitle(html) {
  const m = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripTags(m[1]) : '';
}

export function extractLinks(html, baseUrl) {
  const out = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  const src = withoutComments(html);
  while ((m = re.exec(src))) {
    const tag = '<a ' + m[1] + '>';
    const href = getAttr(tag, 'href');
    if (href === null) continue;
    const text = stripTags(m[2]);
    const abs = resolveUrl(href, baseUrl);
    out.push({ href, text, url: abs ? abs.href : null, tag });
  }
  return out;
}

export function extractResources(html, baseUrl) {
  const out = [];
  const src = withoutComments(html);
  const push = (kind, raw) => {
    if (!raw) return;
    if (/^(?:data|blob|javascript|mailto|tel):/i.test(raw)) return;
    const abs = resolveUrl(raw, baseUrl);
    if (abs && /^https?:$/.test(abs.protocol)) out.push({ kind, url: abs.href });
  };
  let m;
  const scriptRe = /<script\b([^>]*)>/gi;
  while ((m = scriptRe.exec(src))) push('script', getAttr('<s ' + m[1] + '>', 'src'));
  const linkRe = /<link\b([^>]*)>/gi;
  while ((m = linkRe.exec(src))) {
    const tag = '<l ' + m[1] + '>';
    const rel = (getAttr(tag, 'rel') || '').toLowerCase();
    if (/stylesheet|icon|preload|modulepreload|manifest|apple-touch-icon/.test(rel)) push(rel.includes('stylesheet') ? 'style' : 'other', getAttr(tag, 'href'));
  }
  const imgRe = /<(img|iframe|source|embed|video|audio)\b([^>]*)>/gi;
  while ((m = imgRe.exec(src))) push(m[1].toLowerCase() === 'iframe' ? 'iframe' : 'media', getAttr('<x ' + m[2] + '>', 'src'));
  return out;
}

export function extractInlineScripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(withoutComments(html)))) {
    if (!getAttr('<s ' + m[1] + '>', 'src') && m[2].trim()) out.push(m[2]);
  }
  return out;
}

/** Extrait les formulaires et leurs champs. */
export function extractForms(html) {
  const forms = [];
  const src = withoutComments(html);
  const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let fm;
  while ((fm = formRe.exec(src))) {
    const body = fm[2];
    const labels = {};
    const labelRe = /<label\b([^>]*)>([\s\S]*?)<\/label>/gi;
    let lm;
    while ((lm = labelRe.exec(body))) {
      const forId = getAttr('<l ' + lm[1] + '>', 'for');
      if (forId) labels[forId] = stripTags(lm[2]);
    }
    const fields = [];
    const fieldRe = /<(input|textarea|select)\b([^>]*)>/gi;
    let im;
    while ((im = fieldRe.exec(body))) {
      const tag = '<' + im[1] + ' ' + im[2] + '>';
      const type = (getAttr(tag, 'type') || (im[1].toLowerCase() === 'input' ? 'text' : im[1].toLowerCase())).toLowerCase();
      if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue;
      const name = getAttr(tag, 'name') || '';
      const id = getAttr(tag, 'id') || '';
      const label = (id && labels[id]) || getAttr(tag, 'aria-label') || getAttr(tag, 'placeholder') || '';
      const required = hasAttr(tag, 'required') || /aria-required\s*=\s*["']?true/i.test(tag);
      const autocomplete = (getAttr(tag, 'autocomplete') || '').toLowerCase();
      const ident = type === 'tel' || type === 'email' || IDENTIFYING_RE.test(name) || IDENTIFYING_RE.test(id) || IDENTIFYING_RE.test(label);
      fields.push({ type, name, id, label, required, autocomplete, identifying: ident && !['checkbox', 'radio'].includes(type) });
    }
    forms.push({ action: getAttr('<f ' + fm[1] + '>', 'action'), fields });
  }
  return forms;
}

export function normalizeHeaders(h) {
  const out = {};
  if (!h) return out;
  if (typeof h.forEach === 'function' && typeof h.get === 'function') {
    h.forEach((v, k) => { out[String(k).toLowerCase()] = String(v); });
    return out;
  }
  for (const k of Object.keys(h)) out[k.toLowerCase()] = Array.isArray(h[k]) ? h[k].join(', ') : String(h[k]);
  return out;
}

export function checkSecurityHeaders(headers, isHttps) {
  const h = headers || {};
  const csp = h['content-security-policy'] || '';
  const present = {
    'strict-transport-security': !!h['strict-transport-security'] && isHttps,
    'content-security-policy': !!csp,
    'x-content-type-options': /nosniff/i.test(h['x-content-type-options'] || ''),
    'referrer-policy': !!h['referrer-policy'],
    'frame-protection': /frame-ancestors/i.test(csp) || !!h['x-frame-options'],
    'permissions-policy': !!h['permissions-policy']
  };
  return SECURITY_HEADERS.map((x) => ({ ...x, present: present[x.id] }));
}

export function detectTrackers(text) {
  const found = [];
  for (const sig of TRACKER_SIGNATURES) {
    if (sig.re.test(text)) found.push({ id: sig.id, name: sig.name, kind: sig.kind });
  }
  return found;
}

export function detectQuickExit(html) {
  if (QUICK_EXIT_ATTR_RE.test(withoutComments(html))) return true;
  const src = withoutComments(html);
  const re = /<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(src))) {
    const text = stripTags(m[3]);
    const aria = getAttr('<x ' + m[2] + '>', 'aria-label') || '';
    if (QUICK_EXIT_TEXT_RE.test(text) || QUICK_EXIT_TEXT_RE.test(aria)) return true;
  }
  return false;
}

/** Page de camouflage déclarée : <meta name="page-role" content="camouflage">. */
export function isCamouflagePage(html) {
  return /<meta\s+name=["']page-role["']\s+content=["']camouflage["']/i.test(withoutComments(html));
}

export function detectPhones(html, baseUrl) {
  const text = stripTags(html);
  const numbers = (text.match(PHONE_RE) || []).map((n) => n.replace(/[\s.-]/g, ''));
  const telLinks = extractLinks(html, baseUrl)
    .filter((l) => /^tel:/i.test(l.href))
    .map((l) => l.href.replace(/^tel:/i, '').replace(/[\s.-]/g, ''));
  const uniqueNumbers = [...new Set(numbers)];
  const clickable = uniqueNumbers.filter((n) => telLinks.some((t) => t.endsWith(n) || n.endsWith(t.replace(/^\+\d{3}/, ''))));
  return { numbers: uniqueNumbers, telLinks: [...new Set(telLinks)], clickable };
}

/** Évalue le contenu d'une page de confidentialité (couverture des sujets attendus). */
export function assessPrivacyText(html) {
  const text = stripTags(html);
  const words = text.split(/\s+/).filter(Boolean).length;
  const topics = {
    'données collectées': /donn[ée]es?\s+(?:que\s+nous\s+)?(?:collect|recueill|demand)|ce\s+que\s+nous\s+(?:collectons|demandons|recueillons)/i.test(text),
    'qui y accède': /qui\s+(?:peut\s+)?(?:lit|lire|acc[eè]de|voit)|personnes?\s+(?:qui|autoris)/i.test(text),
    'durée de conservation': /conserv|dur[ée]e|combien\s+de\s+temps|suppression\s+automatique/i.test(text),
    'suppression': /supprim|effacer|effacement/i.test(text),
    'limites de la confidentialité': /limites?\s+(?:de\s+la\s+)?confidentialit/i.test(text)
  };
  const covered = Object.values(topics).filter(Boolean).length;
  return { words, topics, covered };
}

// ---------------------------------------------------------------------------
// Orchestration : récupère les pages de même section, puis évalue.
// `fetcher(url)` doit renvoyer {url, status, headers, text, bytes, setCookies?}
// et appliquer lui-même les protections (liste autorisée, SSRF…).
// ---------------------------------------------------------------------------
export async function runAnalysis(entryUrl, fetcher, opts = {}) {
  const maxPages = opts.maxPages || MAX_PAGES;
  const entry = new URL(entryUrl);
  const scopeDir = entry.pathname.endsWith('/') ? entry.pathname : entry.pathname.replace(/[^/]*$/, '');
  const pages = [];
  const queue = [entry.href];
  const seen = new Set();
  const resourceCache = new Map();
  const errors = [];

  const sameScope = (u) => u && u.origin === entry.origin && u.pathname.startsWith(scopeDir);

  while (queue.length && pages.length < maxPages) {
    const url = queue.shift();
    const key = canonical(url);
    if (seen.has(key)) continue;
    seen.add(key);
    let res;
    try {
      res = await fetcher(key);
    } catch (e) {
      errors.push({ url: key, error: String(e && e.message || e) });
      if (pages.length === 0) throw e;
      continue;
    }
    const finalUrl = res.url || key;
    const ctype = (normalizeHeaders(res.headers)['content-type'] || '');
    if (!/html/i.test(ctype) && pages.length > 0) continue;
    const page = {
      url: finalUrl,
      status: res.status,
      headers: normalizeHeaders(res.headers),
      html: res.text || '',
      bytes: res.bytes || 0,
      setCookies: res.setCookies || [],
      resources: []
    };
    pages.push(page);

    // Ressources : on récupère seulement celles de même origine ; les tierces sont relevées, jamais contactées.
    const resources = extractResources(page.html, finalUrl).slice(0, MAX_RESOURCES_PER_PAGE);
    for (const r of resources) {
      const ru = new URL(r.url);
      const thirdParty = ru.origin !== entry.origin;
      const item = { ...r, thirdParty, host: ru.host, bytes: 0, content: '' };
      if (!thirdParty) {
        if (!resourceCache.has(ru.href)) {
          try {
            const rr = await fetcher(ru.href, { resource: true });
            resourceCache.set(ru.href, { bytes: rr.bytes || 0, content: r.kind === 'script' ? (rr.text || '') : '' });
          } catch (e) {
            resourceCache.set(ru.href, { bytes: 0, content: '', error: String(e && e.message || e) });
          }
        }
        const cached = resourceCache.get(ru.href);
        item.bytes = cached.bytes;
        item.content = cached.content;
      }
      page.resources.push(item);
    }

    // Liens visibles de la même section (aucune page cachée explorée).
    for (const l of extractLinks(page.html, finalUrl)) {
      const u = l.url ? new URL(l.url) : null;
      if (u && sameScope(u) && /^https?:$/.test(u.protocol) && !/\.(?:pdf|zip|png|jpe?g|svg|mp4)$/i.test(u.pathname)) {
        const k = canonical(u.href);
        if (!seen.has(k) && !queue.includes(k)) queue.push(k);
      }
    }
  }

  return evaluatePages(pages, { entryUrl: entry.href, errors, mode: opts.mode || 'inconnu' });
}

// ---------------------------------------------------------------------------
// Évaluation : transforme les pages observées en constats et en suggestions.
// ---------------------------------------------------------------------------
export function evaluatePages(pages, ctx = {}) {
  const entry = new URL(ctx.entryUrl || pages[0].url);
  const isHttps = entry.protocol === 'https:';
  const findings = [];
  const suggestions = {};
  const scope = `${pages.length} page(s) analysée(s)`;
  const suggest = (id, note, comment) => {
    // Règle prudente : si plusieurs constats visent le même critère, on garde la note la plus basse.
    if (!suggestions[id] || note < suggestions[id].note) suggestions[id] = { note, proof: 'machine', comment };
  };

  // 1. HTTPS
  findings.push({
    id: 'https', label: 'Connexion chiffrée (HTTPS)',
    status: isHttps ? 'detected' : 'not_detected',
    evidence: isHttps ? 'L\'adresse utilise https://' : 'L\'adresse utilise http:// (non chiffré)',
    risk: isHttps ? 'Aucun' : 'Sur un réseau partagé, les échanges peuvent être lus ou modifiés.',
    criteria: ['S5'], severity: isHttps ? 'ok' : 'high'
  });

  // 2. En-têtes de sécurité (page d'entrée)
  const headers = checkSecurityHeaders(pages[0].headers, isHttps);
  const nbHeaders = headers.filter((h) => h.present).length;
  findings.push({
    id: 'headers', label: 'En-têtes de sécurité',
    status: nbHeaders === headers.length ? 'detected' : nbHeaders > 0 ? 'partial' : 'not_detected',
    evidence: headers.map((h) => `${h.present ? '✓' : '✗'} ${h.label}`).join(' · '),
    risk: nbHeaders === headers.length ? 'Aucun dans le périmètre observé' : 'Protection incomplète contre l\'injection de contenu, l\'intégration et les fuites d\'adresse.',
    criteria: ['S5'], severity: nbHeaders >= 5 ? 'ok' : nbHeaders >= 3 ? 'medium' : 'high', detail: headers
  });
  if (isHttps && nbHeaders >= 5) suggest('S5', 2, `HTTPS et ${nbHeaders}/6 en-têtes de sécurité observés. Le chiffrement des données stockées n'est pas observable de l'extérieur.`);
  else if (isHttps || nbHeaders >= 3) suggest('S5', 1, `${isHttps ? 'HTTPS présent' : 'HTTPS absent'} ; ${nbHeaders}/6 en-têtes de sécurité observés.`);
  else suggest('S5', 0, `HTTPS absent et ${nbHeaders}/6 en-têtes de sécurité.`);

  // 3-4. Cookies (en-têtes Set-Cookie si visibles, sinon écriture par script)
  const allScripts = [];
  for (const p of pages) {
    for (const s of extractInlineScripts(p.html)) allScripts.push({ page: p.url, src: 'inline', content: s });
    for (const r of p.resources) if (r.kind === 'script' && r.content) allScripts.push({ page: p.url, src: r.url, content: r.content });
  }
  const setCookies = [];
  for (const p of pages) for (const c of p.setCookies) setCookies.push({ page: p.url, name: String(c).split('=')[0].trim() });
  const scriptCookieWriters = allScripts.filter((s) => /document\.cookie\s*=/.test(s.content));
  const consentDetected = pages.some((p) => CONSENT_RE.test(p.html)) || allScripts.some((s) => CONSENT_RE.test(s.content));
  const cookieNames = [...new Set(setCookies.map((c) => c.name))];
  const headersVisible = ctx.mode === 'serveur';
  findings.push({
    id: 'cookies', label: 'Cookies déposés',
    status: cookieNames.length || scriptCookieWriters.length ? 'detected' : headersVisible ? 'not_detected' : 'unverifiable',
    evidence: [
      cookieNames.length ? `En-têtes Set-Cookie : ${cookieNames.join(', ')}` : (headersVisible ? 'Aucun en-tête Set-Cookie' : 'En-têtes Set-Cookie non lisibles dans ce mode d\'analyse'),
      scriptCookieWriters.length ? `Écriture de cookie par script : ${[...new Set(scriptCookieWriters.map((s) => shortName(s.src)))].join(', ')}` : 'Aucune écriture de cookie par script observée'
    ].join(' · '),
    risk: cookieNames.length || scriptCookieWriters.length ? 'Un cookie peut permettre de reconnaître l\'appareil lors d\'une prochaine visite.' : 'Aucun dans le périmètre observé',
    criteria: ['C1', 'C5'], severity: cookieNames.length || scriptCookieWriters.length ? 'medium' : 'ok'
  });
  const trackingCookies = cookieNames.filter((n) => TRACKING_COOKIE_RE.test(n));
  const trackerScriptWritesCookie = scriptCookieWriters.some((s) => detectTrackers(s.content).length || /_ga|_fbp|_gid/.test(s.content));
  const preConsent = (trackingCookies.length > 0 || trackerScriptWritesCookie) && !consentDetected;
  findings.push({
    id: 'cookies-consent', label: 'Cookies de suivi déposés avant consentement',
    status: preConsent ? 'detected' : (cookieNames.length || scriptCookieWriters.length) ? 'not_detected' : 'unverifiable',
    evidence: preConsent
      ? `Cookie de suivi (${trackingCookies.join(', ') || 'écrit par le script de mesure'}) déposé au chargement, aucun mécanisme de consentement repéré.`
      : consentDetected ? 'Un mécanisme de consentement est présent dans le code.' : 'Aucun cookie de suivi observé au chargement.',
    risk: preConsent ? 'La visite est enregistrée avant que la personne ait pu refuser.' : 'Aucun dans le périmètre observé',
    criteria: ['C5', 'C1'], severity: preConsent ? 'high' : 'ok'
  });
  if (preConsent) suggest('C5', 0, 'Cookie de suivi déposé avant tout consentement (observé dans le code).');

  // 5-6. Traceurs et pixels
  const trackerHits = new Map();
  const scan = (text, where) => {
    for (const t of detectTrackers(text)) {
      if (!trackerHits.has(t.id)) trackerHits.set(t.id, { ...t, where: new Set() });
      trackerHits.get(t.id).where.add(where);
    }
  };
  for (const p of pages) scan(withoutComments(p.html), shortName(p.url));
  for (const s of allScripts) scan(s.content, shortName(s.src === 'inline' ? s.page : s.src));
  const thirdParty = [];
  for (const p of pages) for (const r of p.resources) if (r.thirdParty) thirdParty.push({ host: r.host, url: r.url, kind: r.kind, page: p.url });
  const thirdHosts = [...new Set(thirdParty.map((t) => t.host))];
  const trackers = [...trackerHits.values()].map((t) => ({ id: t.id, name: t.name, kind: t.kind, where: [...t.where] }));
  const analytics = trackers.filter((t) => t.kind === 'analytics');
  const pixels = trackers.filter((t) => t.kind === 'pixel');
  findings.push({
    id: 'trackers', label: 'Traceurs tiers connus (mesure d\'audience)',
    status: analytics.length ? 'detected' : 'not_detected',
    evidence: analytics.length ? analytics.map((t) => `${t.name} (dans ${t.where.join(', ')})`).join(' · ') : 'Aucune signature connue de mesure d\'audience dans le code reçu.',
    risk: analytics.length ? 'Un service tiers peut apprendre qu\'un appareil a visité ce site d\'aide.' : 'Aucun dans le périmètre observé (un traceur ajouté dynamiquement ne serait pas vu).',
    criteria: ['C1'], severity: analytics.length ? 'critical' : 'ok'
  });
  findings.push({
    id: 'pixels', label: 'Pixels publicitaires connus',
    status: pixels.length ? 'detected' : 'not_detected',
    evidence: pixels.length ? pixels.map((t) => `${t.name} (dans ${t.where.join(', ')})`).join(' · ') : 'Aucune signature connue de pixel publicitaire.',
    risk: pixels.length ? 'Un réseau publicitaire peut associer la visite au profil de la personne.' : 'Aucun dans le périmètre observé',
    criteria: ['C1'], severity: pixels.length ? 'critical' : 'ok'
  });
  findings.push({
    id: 'third-party', label: 'Ressources chargées depuis des domaines tiers',
    status: thirdHosts.length ? 'detected' : 'not_detected',
    evidence: thirdHosts.length ? `Domaines tiers : ${thirdHosts.join(', ')} (non contactés par NUKUN)` : 'Toutes les ressources proviennent du même site.',
    risk: thirdHosts.length ? 'Chaque domaine tiers contacté reçoit l\'adresse IP et la page visitée.' : 'Aucun',
    criteria: ['C1'], severity: thirdHosts.length ? 'high' : 'ok'
  });
  if (trackers.length) suggest('C1', 0, `Traceur(s) détecté(s) : ${trackers.map((t) => t.name).join(', ')}.`);
  else if (thirdHosts.length) suggest('C1', 1, `Aucun traceur connu, mais des ressources tierces : ${thirdHosts.join(', ')}.`);
  else suggest('C1', 2, `Aucun traceur ni ressource tierce dans le code reçu (${scope}). Un contenu ajouté dynamiquement ne serait pas vu.`);

  // 7. Poids des pages
  const weights = pages.map((p) => {
    const res = p.resources.filter((r) => !r.thirdParty).reduce((s, r) => s + (r.bytes || 0), 0);
    return { url: p.url, html: p.bytes, resources: res, total: p.bytes + res };
  });
  const maxWeight = Math.max(...weights.map((w) => w.total));
  const heaviest = weights.find((w) => w.total === maxWeight);
  findings.push({
    id: 'weight', label: 'Poids approximatif des pages',
    status: maxWeight < 500 * 1024 ? 'detected' : 'not_detected',
    evidence: `Page la plus lourde : ${formatKb(maxWeight)} (${shortName(heaviest.url)}). ` + weights.map((w) => `${shortName(w.url)} : ${formatKb(w.total)}`).join(' · ') + '. Taille décodée des ressources de même origine.',
    risk: maxWeight < 500 * 1024 ? 'Aucun (sous le seuil de 500 Ko)' : 'Chargement long sur téléphone d\'entrée de gamme et connexion faible.',
    criteria: ['A1'], severity: maxWeight < 500 * 1024 ? 'ok' : maxWeight < 1024 * 1024 ? 'medium' : 'high', detail: weights
  });
  suggest('A1', maxWeight < 500 * 1024 ? 2 : 0, `Page la plus lourde : ${formatKb(maxWeight)} (seuil du critère : moins de 500 Ko).`);

  // 8. Sortie rapide
  // Une page de camouflage déclarée (ex. calculatrice) EST la page neutre : elle n'est pas
  // une page sensible. Elle est exclue du contrôle, et cette exclusion est écrite dans le constat.
  const camoPages = pages.filter((p) => isCamouflagePage(p.html));
  const sensitive = pages.filter((p) => !isCamouflagePage(p.html));
  const exitPages = sensitive.map((p) => ({ url: p.url, found: detectQuickExit(p.html) }));
  const nbExit = exitPages.filter((p) => p.found).length;
  const allExit = sensitive.length > 0 && nbExit === sensitive.length;
  const camoNote = camoPages.length ? ` · Page(s) de camouflage déclarée(s), exclue(s) du contrôle : ${camoPages.map((p) => shortName(p.url)).join(', ')} (déclaration à vérifier par les scénarios T3 et T4)` : '';
  findings.push({
    id: 'quick-exit', label: 'Bouton de sortie rapide',
    status: allExit ? 'detected' : nbExit > 0 ? 'partial' : 'not_detected',
    evidence: exitPages.map((p) => `${p.found ? '✓' : '✗'} ${shortName(p.url)}`).join(' · ') + camoNote,
    risk: allExit ? 'Présence observée ; son fonctionnement réel doit être vérifié par le scénario T4.' : 'Afi ne peut pas masquer l\'outil rapidement.',
    criteria: ['S1'], severity: allExit ? 'ok' : 'critical'
  });
  suggest('S1', allExit ? 2 : nbExit > 0 ? 1 : 0,
    `Sortie rapide repérée sur ${nbExit}/${sensitive.length} page(s) sensible(s)${camoPages.length ? ` (${camoPages.length} page de camouflage déclarée exclue)` : ''}. Fonctionnement à confirmer par le scénario T4.`);
  if (camoPages.length) {
    findings.push({
      id: 'camouflage', label: 'Mode discret (page de camouflage)',
      status: 'detected',
      evidence: camoPages.map((p) => `${shortName(p.url)} : titre « ${extractTitle(p.html)} »`).join(' · '),
      risk: 'Information : la page se présente comme une autre application. Son efficacité réelle (code secret, retour automatique) se vérifie par les scénarios T3 et T4.',
      criteria: ['S1', 'S3'], severity: 'info', informative: true
    });
  }

  // 9. Numéros cliquables
  const phones = pages.map((p) => detectPhones(p.html, p.url));
  const allNumbers = [...new Set(phones.flatMap((x) => x.numbers))];
  const allClickable = [...new Set(phones.flatMap((x) => x.clickable))];
  const telCount = [...new Set(phones.flatMap((x) => x.telLinks))].length;
  const phoneStatus = !allNumbers.length && !telCount ? 'unverifiable' : allClickable.length === allNumbers.length ? 'detected' : allClickable.length ? 'partial' : 'not_detected';
  findings.push({
    id: 'phones', label: 'Numéros de téléphone cliquables',
    status: phoneStatus,
    evidence: allNumbers.length || telCount ? `${allNumbers.length} numéro(s) affiché(s), ${allClickable.length} cliquable(s) ; ${telCount} lien(s) tel:` : 'Aucun numéro repéré dans le texte.',
    risk: phoneStatus === 'detected' ? 'Aucun' : phoneStatus === 'unverifiable' ? 'À vérifier par un humain' : 'Recopier un numéro en situation de stress fait perdre du temps.',
    criteria: ['A4'], severity: phoneStatus === 'detected' ? 'ok' : phoneStatus === 'unverifiable' ? 'info' : 'medium'
  });
  if (phoneStatus === 'detected') suggest('A4', 2, `${allClickable.length} numéro(s), tous cliquables. L'exactitude des numéros relève de R2.`);
  else if (phoneStatus === 'partial') suggest('A4', 1, `${allClickable.length}/${allNumbers.length} numéro(s) cliquable(s).`);
  else if (phoneStatus === 'not_detected') suggest('A4', 0, `${allNumbers.length} numéro(s) affiché(s), aucun cliquable.`);

  // 10-11. Formulaires et champs identifiants obligatoires
  const forms = pages.flatMap((p) => extractForms(p.html).map((f) => ({ ...f, page: p.url })));
  const fields = forms.flatMap((f) => f.fields.map((x) => ({ ...x, page: f.page })));
  const requiredIdent = fields.filter((f) => f.required && f.identifying);
  const requiredFiles = fields.filter((f) => f.required && f.type === 'file');
  const requiredAll = fields.filter((f) => f.required && f.type !== 'checkbox');
  findings.push({
    id: 'forms', label: 'Formulaire',
    status: forms.length ? 'detected' : 'not_detected',
    evidence: forms.length ? forms.map((f) => `${shortName(f.page)} : ${f.fields.length} champ(s)`).join(' · ') : 'Aucun formulaire dans le code reçu (il peut être ajouté par JavaScript).',
    risk: forms.length ? 'Voir les champs obligatoires.' : 'La fonction de signalement doit être vérifiée par un humain (R1).',
    criteria: ['C2', 'R1'], severity: forms.length ? 'info' : 'medium'
  });
  findings.push({
    id: 'required-ident', label: 'Champs identifiants obligatoires',
    status: !forms.length ? 'unverifiable' : requiredIdent.length ? 'detected' : 'not_detected',
    evidence: !forms.length ? 'Pas de formulaire observé.' : requiredIdent.length
      ? `Obligatoires : ${requiredIdent.map((f) => f.label || f.name || f.type).join(', ')}${requiredFiles.length ? ` ; pièce jointe obligatoire (${requiredFiles.length})` : ''}`
      : `Aucun champ identifiant obligatoire (${fields.filter((f) => f.identifying).length} champ(s) identifiant(s) facultatif(s)).`,
    risk: requiredIdent.length ? 'Exiger une identité décourage la révélation et crée une trace.' : forms.length ? 'Aucun dans le périmètre observé (une validation par script ne serait pas vue).' : 'À vérifier par un humain',
    criteria: ['C2', 'C3'], severity: requiredIdent.length ? 'critical' : forms.length ? 'ok' : 'info'
  });
  if (forms.length) {
    if (requiredIdent.length) suggest('C2', 0, `Champ(s) identifiant(s) obligatoire(s) : ${requiredIdent.map((f) => f.label || f.name).join(', ')}.`);
    else suggest('C2', 2, 'Aucun champ identifiant obligatoire dans le code des formulaires. À confirmer en remplissant le formulaire avec des données fictives.');
    if (requiredIdent.length || requiredFiles.length || requiredAll.length > 2) suggest('C3', 0, `${requiredAll.length} champ(s) obligatoire(s), dont ${requiredIdent.length} identifiant(s) et ${requiredFiles.length} pièce(s) jointe(s).`);
    else if (requiredAll.length > 0) suggest('C3', 1, `${requiredAll.length} champ(s) obligatoire(s) non identifiant(s).`);
    else suggest('C3', 2, 'Aucun champ obligatoire hors consentement.');
  }

  // 12. Politique de confidentialité
  const privacyLinks = [];
  for (const p of pages) for (const l of extractLinks(p.html, p.url)) if (PRIVACY_LINK_RE.test(l.text) || PRIVACY_LINK_RE.test(l.href)) privacyLinks.push(l);
  const privacyPage = pages.find((p) => privacyLinks.some((l) => l.url && l.url.split('#')[0] === p.url.split('#')[0]));
  const privacy = privacyPage ? assessPrivacyText(privacyPage.html) : null;
  let privacyStatus;
  if (!privacyLinks.length) privacyStatus = 'not_detected';
  else if (!privacy) privacyStatus = 'partial';
  else if (privacy.words >= 150 && privacy.covered >= 4) privacyStatus = 'detected';
  else privacyStatus = 'partial';
  findings.push({
    id: 'privacy', label: 'Politique de confidentialité',
    status: privacyStatus,
    evidence: !privacyLinks.length ? 'Aucun lien vers une politique de confidentialité.'
      : !privacy ? 'Lien présent, page non analysée (hors section ou inaccessible).'
      : `Page ${shortName(privacyPage.url)} : ${privacy.words} mots ; sujets couverts ${privacy.covered}/5 (${Object.entries(privacy.topics).filter(([, v]) => v).map(([k]) => k).join(', ') || 'aucun'}).`,
    risk: privacyStatus === 'detected' ? 'Lisibilité à confirmer par un humain.' : 'Afi ne sait pas qui lit ses données ni combien de temps elles sont gardées.',
    criteria: ['C4', 'R5'], severity: privacyStatus === 'detected' ? 'ok' : 'high'
  });
  if (privacyStatus === 'not_detected') suggest('C4', 0, 'Aucun lien vers une politique de confidentialité.');
  else if (privacy && privacyStatus === 'partial') suggest('C4', 0, `Politique quasi vide ou incomplète : ${privacy.words} mots, ${privacy.covered}/5 sujets.`);
  else if (privacy) suggest('C4', 2, `Politique présente : ${privacy.words} mots, ${privacy.covered}/5 sujets couverts. Le langage simple reste à confirmer.`);

  // Signaux complémentaires : traces locales (S3)
  const titles = pages.map((p) => ({ url: p.url, title: extractTitle(p.html) }));
  const revealing = titles.filter((t) => REVEALING_TITLE_RE.test(t.title));
  const sensitiveFields = fields.filter((f) => f.type === 'textarea' || f.type === 'text' || f.identifying);
  const autocompleteOff = sensitiveFields.length > 0 && sensitiveFields.every((f) => f.autocomplete === 'off' || f.autocomplete === 'new-password');
  const noStore = pages.every((p) => /no-store/i.test(p.headers['cache-control'] || ''));
  const usesReplace = allScripts.some((s) => /location\.replace\s*\(/.test(s.content));
  const privateAdvice = pages.some((p) => PRIVATE_BROWSING_RE.test(stripTags(p.html)));
  const s3signals = [
    { label: 'Titres d\'onglet neutres', ok: revealing.length === 0 },
    { label: 'Auto-complétion désactivée sur les champs sensibles', ok: sensitiveFields.length === 0 ? null : autocompleteOff },
    { label: 'En-tête Cache-Control: no-store', ok: noStore },
    { label: 'Sortie par remplacement de page (location.replace)', ok: usesReplace },
    { label: 'Navigation privée conseillée', ok: privateAdvice }
  ];
  const s3ok = s3signals.filter((s) => s.ok === true).length;
  const s3known = s3signals.filter((s) => s.ok !== null).length;
  findings.push({
    id: 'local-traces', label: 'Limitation des traces locales (signaux observables)',
    status: s3ok === s3known ? 'detected' : s3ok > 0 ? 'partial' : 'not_detected',
    evidence: s3signals.map((s) => `${s.ok === null ? '–' : s.ok ? '✓' : '✗'} ${s.label}`).join(' · ') + (revealing.length ? ` · Titres révélateurs : ${revealing.map((t) => `« ${t.title} »`).join(', ')}` : ''),
    risk: s3ok === s3known ? 'À confirmer par le scénario T1 (historique).' : 'L\'historique, le cache ou le clavier peuvent révéler la démarche.',
    criteria: ['S3'], severity: s3ok === s3known ? 'ok' : 'medium'
  });
  suggest('S3', s3known > 0 && s3ok === s3known ? 2 : s3ok >= 2 ? 1 : 0, `${s3ok}/${s3known} signaux observables de limitation des traces. À confirmer par le scénario T1.`);

  // Informations : avertissement appareil surveillé, non-indexation
  const deviceWarning = pages.some((p) => DEVICE_WARNING_RE.test(stripTags(p.html)));
  findings.push({
    id: 'device-warning', label: 'Avertissement « appareil surveillé » (texte repéré)',
    status: deviceWarning ? 'detected' : 'not_detected',
    evidence: deviceWarning ? 'Un texte d\'avertissement sur la surveillance de l\'appareil est présent.' : 'Aucun texte d\'avertissement repéré.',
    risk: deviceWarning ? 'Contenu à évaluer par un humain (S2).' : 'Afi ignore peut-être que son téléphone est surveillé.',
    criteria: ['S2'], severity: deviceWarning ? 'info' : 'medium', informative: true
  });
  const noindex = pages.every((p) => /noindex/i.test(p.headers['x-robots-tag'] || '') || /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(p.html));
  findings.push({
    id: 'noindex', label: 'Exclusion des moteurs de recherche (noindex)',
    status: noindex ? 'detected' : 'not_detected',
    evidence: noindex ? 'Toutes les pages analysées demandent à ne pas être indexées.' : 'Au moins une page peut être indexée.',
    risk: 'Information (utile pour un site de démonstration).', criteria: [], severity: 'info', informative: true
  });

  const unverifiable = [
    { criteria: ['S2', 'S4'], why: 'Le contenu des avertissements et l\'envoi de notifications ou SMS demandent un test humain (T2).' },
    { criteria: ['R1', 'R4'], why: 'Le fonctionnement de bout en bout n\'est jamais testé automatiquement (aucun formulaire n\'est soumis).' },
    { criteria: ['R2', 'R5', 'E1', 'E5'], why: 'L\'exactitude des contacts et des informations demande une vérification auprès de sources institutionnelles.' },
    { criteria: ['A2', 'A3', 'A5', 'E2', 'E4'], why: 'La compréhension, les langues et l\'inclusion se vérifient avec des personnes.' },
    { criteria: ['N1', 'N2', 'N3', 'N4', 'N5', 'R3', 'E3'], why: 'Le ton, les conseils et les processus internes relèvent d\'une revue humaine ou d\'une déclaration.' },
    { criteria: ['S5'], why: 'Le chiffrement des données stockées côté serveur n\'est pas observable (test d\'intrusion sous mandat, hors périmètre).' }
  ];

  return {
    version: ANALYZER_VERSION,
    entryUrl: entry.href,
    mode: ctx.mode || 'inconnu',
    analyzedAt: ctx.analyzedAt || new Date().toISOString(),
    pages: pages.map((p, i) => ({ url: p.url, status: p.status, title: titles[i].title, bytes: weights[i].total })),
    findings,
    suggestions,
    trackers,
    thirdPartyHosts: thirdHosts,
    unverifiable,
    errors: ctx.errors || [],
    limits: [
      'Analyse passive du code reçu : un contenu ajouté par JavaScript après le chargement n\'est pas vu.',
      'Aucun formulaire n\'est soumis, aucun test intrusif n\'est réalisé, aucune page cachée n\'est explorée.',
      'Les domaines tiers sont relevés dans le code, jamais contactés par NUKUN.',
      'Une analyse automatique ne garantit pas la sécurité d\'un site : elle couvre environ un tiers des critères.'
    ]
  };
}

function canonical(u) {
  return String(u).split('#')[0].replace(/\/index\.html?$/i, '/');
}

function shortName(u) {
  try {
    const x = new URL(u);
    return x.pathname.split('/').filter(Boolean).pop() || x.pathname || x.host;
  } catch { return String(u).slice(0, 40); }
}

export function formatKb(bytes) {
  return `${Math.round((bytes / 1024) * 10) / 10} Ko`;
}

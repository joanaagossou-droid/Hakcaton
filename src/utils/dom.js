/**
 * NUKUN — Construction sûre du DOM.
 * Toute l'interface est construite avec h() : le texte passe par textContent,
 * jamais par innerHTML. Une saisie comme <script>alert(1)</script> s'affiche
 * donc telle quelle et n'est jamais exécutée (essai S-6).
 */
const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'g', 'path', 'circle', 'line', 'polyline', 'polygon', 'rect', 'text', 'title', 'tspan', 'defs', 'use']);

export function h(tag, attrs, ...children) {
  const isSvg = SVG_TAGS.has(tag);
  const el = isSvg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
      else if (k === 'text') el.textContent = String(v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv;
      else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) el.style.setProperty(sk, sv);
      else if (k === 'href' || k === 'src') el.setAttribute(k, safeUrl(String(v)));
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** N'autorise que des liens internes, http(s), tel:, data:image et blob:. */
export function safeUrl(u) {
  const s = u.trim();
  if (/^(?:#|\/|\.\/|\.\.\/|[a-z0-9_-]+\.html|[a-z0-9_/-]+\/$)/i.test(s)) return s;
  if (/^(?:https?:|tel:|mailto:|blob:)/i.test(s)) return s;
  if (/^data:image\/(?:png|jpeg|svg\+xml);/i.test(s)) return s;
  return '#';
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function mount(el, ...children) {
  clear(el);
  append(el, children);
  return el;
}

export function $(sel, root = document) { return root.querySelector(sel); }

/** Message d'état annoncé aux lecteurs d'écran. */
export function announce(msg) {
  const live = document.getElementById('live');
  if (live) { live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 30); }
}

export function toast(msg, tone = 'info') {
  const zone = document.getElementById('toasts');
  if (!zone) return;
  const t = h('div', { class: ['toast', tone], role: 'status' }, msg);
  zone.appendChild(t);
  setTimeout(() => t.remove(), 4200);
  announce(msg);
}

export function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return String(iso).slice(0, 16); }
}

export function fmtDay(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('fr-FR'); } catch { return String(iso).slice(0, 10); }
}

/** Téléchargement local d'un fichier (aucune transmission). */
export function download(filename, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: safeFilename(filename) });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function safeFilename(name) {
  return String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80) || 'nukun';
}

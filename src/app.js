/**
 * NUKUN — Point d'entrée : chargement du référentiel, routeur, service worker.
 * Navigation par fragment (#/...) : fonctionne en hébergement statique et hors ligne.
 */
import { h, mount, $, announce } from './utils/dom.js';
import * as store from './utils/store.js';
import t from './i18n/fr.js';
import * as home from './pages/home.js';
import * as audit from './pages/audit.js';
import * as report from './pages/report.js';
import * as kit from './pages/kit.js';
import * as express from './pages/express.js';

const DATA_FILES = {
  referential: 'src/data/criteria.json',
  scenariosFile: 'src/data/scenarios.json',
  correctionsFile: 'src/data/corrections.json',
  refHaven: 'src/data/reference/haven.json',
  refLight: 'src/data/reference/light.json'
};

export const ctx = { data: null, t, store };

async function loadData() {
  const entries = await Promise.all(Object.entries(DATA_FILES).map(async ([k, url]) => {
    const r = await fetch(url, { credentials: 'omit' });
    if (!r.ok) throw new Error(`Chargement impossible : ${url}`);
    return [k, await r.json()];
  }));
  const d = Object.fromEntries(entries);
  ctx.data = {
    referential: d.referential,
    criteria: d.referential.criteria,
    pillars: d.referential.pillars,
    scenarios: d.scenariosFile.scenarios,
    verdicts: d.scenariosFile.verdicts,
    corrections: d.correctionsFile.corrections,
    reference: { haven: d.refHaven, light: d.refLight }
  };
}

/** Table des routes : motif → [section de navigation, rendu]. */
const ROUTES = [
  [/^\/?$/, 'home', home.renderHome],
  [/^\/tableau-de-bord$/, 'dashboard', home.renderDashboard],
  [/^\/nouvel-audit$/, 'new', audit.renderNew],
  [/^\/audit\/(a[0-9a-f]{12})\/analyse$/, 'audit', audit.renderAnalysis],
  [/^\/audit\/(a[0-9a-f]{12})\/criteres$/, 'audit', audit.renderCriteria],
  [/^\/audit\/(a[0-9a-f]{12})\/scenarios$/, 'audit', audit.renderScenarios],
  [/^\/audit\/(a[0-9a-f]{12})\/rapport$/, 'audit', report.renderReport],
  [/^\/kit$/, 'kit', kit.renderKit],
  [/^\/kit\/(K-[A-Z]+)$/, 'kit', kit.renderCorrection],
  [/^\/comparer$/, 'compare', report.renderCompare],
  [/^\/express$/, 'express', express.renderExpressStart],
  [/^\/express\/(a[0-9a-f]{12})\/(\d)$/, 'express', express.renderExpressStep],
  [/^\/methode$/, 'method', home.renderMethod],
  [/^\/confidentialite$/, 'privacy', home.renderPrivacy],
  [/^\/partager$/, 'share', home.renderShare]
];

export function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  const params = new URLSearchParams(query);
  return { path, params };
}

export function go(path) {
  if (location.hash === '#' + path) route();
  else location.hash = path;
}

async function route() {
  const main = $('#main');
  const { path, params } = parseHash();
  let match = null;
  for (const [re, section, fn] of ROUTES) {
    const m = path.match(re);
    if (m) { match = { section, fn, args: m.slice(1) }; break; }
  }
  document.querySelectorAll('#nav a, .dock a').forEach((a) => {
    if (match && a.dataset.route === match.section) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  $('#nav').classList.remove('open');
  $('#menu-btn').setAttribute('aria-expanded', 'false');
  if (!match) {
    mount(main, h('div', { class: 'panel' }, h('h1', null, 'Page introuvable'), h('p', null, 'Cette adresse ne correspond à aucune page de NUKUN.'), h('a', { class: 'btn', href: '#/' }, 'Revenir à l\'accueil')));
    return;
  }
  try {
    const view = await match.fn(ctx, ...match.args, params);
    mount(main, view);
    const h1 = main.querySelector('h1');
    document.title = (h1 ? h1.textContent + ' — ' : '') + 'NUKUN';
    if (!routeIsSamePage) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
    routeIsSamePage = false;
    setupReveal(main);
    announce(h1 ? h1.textContent : 'Page chargée');
  } catch (e) {
    console.error(e);
    mount(main, h('div', { class: 'panel' }, h('h1', null, 'Une erreur est survenue'), h('p', null, String(e && e.message || e)), h('a', { class: 'btn', href: '#/' }, 'Revenir à l\'accueil')));
  }
}

/** Re-rendu de la page courante sans remonter en haut (après une saisie). */
let routeIsSamePage = false;
export function refresh() { routeIsSamePage = true; return route(); }

/** Apparition douce des sections marquées .reveal (ignorée si mouvement réduit). */
let revealObserver = null;
function setupReveal(root) {
  const items = root.querySelectorAll('.reveal');
  if (!items.length) return;
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach((el) => el.classList.add('in'));
    return;
  }
  if (revealObserver) revealObserver.disconnect();
  revealObserver = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); revealObserver.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  items.forEach((el) => revealObserver.observe(el));
}

/** Thème : clair, sombre ou celui du système (préférence locale uniquement). */
function setupTheme() {
  const buttons = document.querySelectorAll('[data-theme-choice]');
  let current = 'system';
  try { current = localStorage.getItem('nukun.theme') || 'system'; } catch { /* ignoré */ }
  const apply = (choice) => {
    if (choice === 'light' || choice === 'dark') document.documentElement.setAttribute('data-theme', choice);
    else document.documentElement.removeAttribute('data-theme');
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeChoice === choice)));
    try { localStorage.setItem('nukun.theme', choice); } catch { /* ignoré */ }
  };
  buttons.forEach((b) => b.addEventListener('click', () => apply(b.dataset.themeChoice)));
  apply(current);
}

function setupShell() {
  setupTheme();
  const btn = $('#menu-btn');
  if (btn) btn.addEventListener('click', () => {
    const open = $('#nav').classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
  const off = $('#offline');
  const upd = () => { off.hidden = navigator.onLine !== false; };
  window.addEventListener('online', upd);
  window.addEventListener('offline', upd);
  upd();
}

async function boot() {
  setupShell();
  try {
    await loadData();
  } catch (e) {
    mount($('#main'), h('div', { class: 'panel' }, h('h1', null, 'NUKUN n\'a pas pu démarrer'), h('p', null, 'Le référentiel n\'a pas pu être chargé. Vérifiez la connexion puis rechargez la page.'), h('p', { class: 'muted small' }, String(e.message))));
    return;
  }
  window.addEventListener('hashchange', route);
  await route();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('service-worker.js').catch(() => { /* hors ligne indisponible : non bloquant */ });
  }
}

boot();

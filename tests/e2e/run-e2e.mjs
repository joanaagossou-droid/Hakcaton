/**
 * NUKUN — Tests de bout en bout dans un vrai navigateur (Edge ou Chrome en mode headless),
 * pilotés par le protocole DevTools via le WebSocket natif de Node (≥ 22). Aucune dépendance.
 *
 *   node tests/e2e/run-e2e.mjs            (BROWSER=chemin/vers/chrome.exe pour forcer)
 *
 * Vérifie : pages sans erreur, parcours jury HAVEN, comparaison HAVEN/LIGHT, sortie rapide et
 * historique (T4), absence de requête tierce, formulaires sans envoi, anti-injection (S-6),
 * mise en page mobile sans défilement horizontal, hors ligne après premier chargement,
 * téléchargement d'un PDF. Produit des captures d'écran dans tests/output/e2e/.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, ROOT } from '../helpers.mjs';

const CANDIDATES = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);
const browserPath = CANDIDATES.find((p) => fs.existsSync(p));
if (!browserPath) { console.error('Aucun navigateur Chromium trouvé (variable BROWSER).'); process.exit(2); }

const OUT = path.join(ROOT, 'tests', 'output', 'e2e');
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${name}${detail ? ' — ' + detail : ''}`);
}

// ---------- mini client CDP ----------
class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = []; ws.addEventListener('message', (e) => this.onMsg(JSON.parse(e.data))); }
  static async connect(url) { const ws = new WebSocket(url); await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); }); return new Cdp(ws); }
  onMsg(m) {
    if (m.id && this.pending.has(m.id)) { const { res, rej } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
    else if (m.method) for (const h of this.handlers) h(m);
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((res, rej) => { this.pending.set(id, { res, rej }); setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error('Délai CDP : ' + method)); } }, 30000); });
  }
  on(fn) { this.handlers.push(fn); }
}

const srv = await startServer();
const BASE = srv.base;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nukun-e2e-'));
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(browserPath, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-background-networking', '--disable-component-update', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' });

let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; } catch { await sleep(200); }
}
if (!wsUrl) { console.error('Le navigateur n\'a pas démarré.'); proc.kill(); process.exit(2); }
const cdp = await Cdp.connect(wsUrl);
const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
let S = (await cdp.send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
const send = (m, p) => cdp.send(m, p, S);

const errors = [];
const requests = [];
const dialogs = [];
cdp.on((m) => {
  if (m.sessionId !== S) return;
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value || a.description).join(' '));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/favicon/.test(m.params.entry.url || '')) errors.push(`${m.params.entry.source}: ${m.params.entry.text}`);
  if (m.method === 'Network.requestWillBeSent') requests.push({ url: m.params.request.url, method: m.params.request.method });
  if (m.method === 'Page.javascriptDialogOpening') { dialogs.push(m.params.message); send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); }
});
const enableAll = async () => { await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable'); };
await enableAll();
/** Ré-attache la session après un changement de processus (navigation vers un autre site). */
async function reattach() { S = (await cdp.send('Target.attachToTarget', { targetId, flatten: true })).sessionId; await enableAll(); }

const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
  return r.result.value;
};
const nav = async (url) => { await send('Page.navigate', { url }); await waitFor('document.readyState === "complete"'); await sleep(300); };
async function waitFor(expr, timeout = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { try { if (await evalJs(`!!(${expr})`)) return true; } catch { /* page en transition */ } await sleep(150); }
  return false;
}
const shot = async (name) => { const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(data, 'base64')); };
const clickText = (sel, text) => evalJs(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find(e => e.textContent.includes(${JSON.stringify(text)})); if (!el) return false; el.click(); return true; })()`);
const h1 = () => evalJs('document.querySelector("main h1") ? document.querySelector("main h1").textContent : ""');

try {
  // 1. Accueil et pages principales
  await nav(BASE + '/');
  check('Accueil : titre affiché', await waitFor('document.querySelector("main h1")'), await h1());
  await shot('01-accueil-ordinateur');
  for (const route of ['#/tableau-de-bord', '#/nouvel-audit', '#/nouvel-audit?mode=design', '#/kit', '#/kit/K-EXIT', '#/kit/K-FORM', '#/methode', '#/confidentialite', '#/partager', '#/express']) {
    await evalJs(`location.hash = ${JSON.stringify(route)}`);
    const ok = await waitFor('document.querySelector("main h1") && !document.querySelector("#boot")');
    check(`Page ${route} s'affiche`, ok && !(await h1()).includes('erreur'), await h1());
  }
  check('QR code généré localement', await evalJs('!!document.querySelector(".qr svg path")') || (await evalJs('location.hash = "#/partager"'), await waitFor('document.querySelector(".qr svg path")')));

  // 2. Parcours jury sur HAVEN
  await evalJs('location.hash = "#/express"');
  await waitFor('document.querySelector("main h1")');
  await clickText('button', 'Auditer HAVEN');
  check('Express HAVEN : analyse puis étape 1', await waitFor('location.hash.includes("/express/") && location.hash.endsWith("/1") && document.querySelector("main h1")', 20000), await h1());
  await shot('02-express-analyse-haven');
  const auditId = await evalJs('location.hash.split("/")[2]');
  await evalJs(`location.hash = "#/express/${auditId}/2"`);
  await waitFor('document.querySelector("#scen-T4")');
  await clickText('#scen-T4 .verdict', 'Afi est exposée');
  check('T4 : verdict enregistré', await waitFor('document.querySelector("#scen-T4 .verdict.exposed[aria-pressed=true]")'));
  await evalJs(`location.hash = "#/express/${auditId}/3"`);
  await waitFor('document.querySelector("#scen-T6")');
  await clickText('#scen-T6 .verdict', 'Afi est exposée');
  await evalJs(`location.hash = "#/express/${auditId}/4"`);
  await waitFor('document.querySelector(".light-pill")');
  const havenScore = await evalJs('parseInt(document.querySelector(".light-pill").textContent)');
  check('HAVEN : score rouge ≤ 49 (plafonné)', havenScore <= 49 && (await evalJs('document.querySelector(".light-pill").classList.contains("red")')), `${havenScore}/100`);
  await shot('03-express-score-haven');

  // 3. Rapport et téléchargement du PDF
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: OUT, eventsEnabled: true });
  await evalJs(`location.hash = "#/audit/${auditId}/rapport"`);
  await waitFor('document.querySelector("svg.chart")');
  await shot('04-rapport-haven');
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.pdf')) fs.rmSync(path.join(OUT, f));
  const before = 0;
  await clickText('button', 'PDF · Rapport complet');
  let pdfOk = false;
  for (let i = 0; i < 40 && !pdfOk; i++) { await sleep(200); pdfOk = fs.readdirSync(OUT).filter((f) => f.endsWith('.pdf')).length > before; }
  check('Export PDF téléchargé localement', pdfOk);

  // 4. Comparaison HAVEN → LIGHT calculée par le moteur
  await evalJs('location.hash = "#/comparer"');
  await waitFor('document.querySelectorAll(".compare-cols .light-pill").length === 2', 20000);
  const scores = await evalJs('[...document.querySelectorAll(".compare-cols .light-pill")].map(e => parseInt(e.textContent))');
  check('Comparaison : HAVEN rouge, LIGHT verte mais < 100', scores[0] <= 49 && scores[1] >= 80 && scores[1] < 100, `HAVEN ${scores[0]} · LIGHT ${scores[1]}`);
  await shot('05-comparaison');

  // 5. Anti-injection dans le nom de l'outil (S-6)
  await evalJs('location.hash = "#/nouvel-audit"');
  await waitFor('document.querySelector("#name")');
  await evalJs(`(() => { const n = document.querySelector('#name'); n.value = '<img src=x onerror=alert(1)><script>alert(2)</script>'; document.querySelector('form button[type=submit]').click(); })()`);
  await waitFor('location.hash.includes("/criteres")');
  const shown = await evalJs('document.querySelector("main h1").textContent');
  const imgs = await evalJs('document.querySelectorAll("main h1 img, main h1 script").length');
  check('S-6 : saisie affichée comme texte, jamais exécutée', shown.includes('<img src=x') && imgs === 0 && dialogs.length === 0, shown);

  // 6. Aucune requête vers un tiers depuis NUKUN et HAVEN
  const origin = new URL(BASE).origin;
  requests.length = 0;
  let havenCookie = '';
  for (const p of ['/haven/', '/haven/signaler.html', '/haven/recours.html', '/light/', '/light/ecrire.html']) {
    await nav(BASE + p);
    if (p === '/haven/') havenCookie = await evalJs('document.cookie');
  }
  const third = requests.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith('data:') && !r.url.startsWith('about:'));
  check('S-2 : aucune requête vers un domaine tiers (HAVEN avec traceur simulé, LIGHT)', third.length === 0, third.map((r) => r.url).join(', '));
  const lightCookie = await evalJs('document.cookie');
  check('HAVEN : cookie fictif _ga déposé localement sans envoi ; aucun cookie sur LIGHT', /_ga=GA1\.1\.demo-fictif/.test(havenCookie) && lightCookie === '', `HAVEN : ${havenCookie.slice(0, 50)} · LIGHT : ${lightCookie || 'aucun'}`);

  // 7. Formulaires de démonstration : rien n'est envoyé
  await nav(BASE + '/haven/signaler.html');
  requests.length = 0;
  await evalJs('document.querySelector("#haven-send").click()');
  await sleep(300);
  const havenMsg = await evalJs('document.querySelector("#haven-result").textContent');
  check('S-9 : HAVEN — formulaire sans envoi, message de démonstration', havenMsg.includes('aucune information n\'a été envoyée') && requests.filter((r) => r.method !== 'GET').length === 0, havenMsg.slice(0, 80));
  await nav(BASE + '/light/ecrire.html');
  requests.length = 0;
  await evalJs('document.querySelector("#consent").click(); document.querySelector("#light-send").click()');
  await sleep(300);
  const lightMsg = await evalJs('document.querySelector("#light-result").textContent');
  check('S-9 : LIGHT — code de suivi, aucune requête envoyée', /LGT-[A-Z0-9]{4}-[A-Z0-9]{4}/.test(lightMsg) && lightMsg.includes('aucune information n\'a été envoyée') && requests.length === 0, lightMsg.slice(0, 60));
  await shot('06-light-formulaire');

  // 8. Sortie rapide (T4 / S-11) : page neutre, « Retour » ne ramène pas à la page sensible
  await nav(BASE + '/light/');
  await nav(BASE + '/light/ecrire.html');
  const t0 = Date.now();
  const errorsBeforeExit = errors.length;
  await send('Network.setBlockedURLs', { urls: ['*google.com*'] });
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  let info;
  for (let i = 0; i < 40; i++) { info = (await cdp.send('Target.getTargetInfo', { targetId })).targetInfo; if (/google\.com/.test(info.url)) break; await sleep(50); }
  const elapsed = Date.now() - t0;
  await sleep(300);
  await reattach();
  const navHist = await send('Page.getNavigationHistory');
  const urls = navHist.entries.map((e) => e.url);
  check('S-11 : Échap mène à la page neutre en moins de 2 s', /google\.com/.test(urls[navHist.currentIndex]) && elapsed < 2000, `${elapsed} ms`);
  const prev = urls[navHist.currentIndex - 1] || '';
  check('S-11 : la page sensible a été remplacée dans l\'historique (« Retour » mène à /light/, pas au formulaire)', prev.endsWith('/light/') && !prev.includes('ecrire.html'), `${prev.replace(BASE, '')} → ${urls[navHist.currentIndex].split('?')[0]}`);
  // Les erreurs éventuelles de la page neutre externe ne concernent pas NUKUN.
  errors.length = errorsBeforeExit;
  await send('Network.setBlockedURLs', { urls: [] });

  // 8 bis. Mode discret : calculatrice de camouflage (reprise du prototype SafeElle)
  const press = (keys) => evalJs(`(() => { for (const k of ${JSON.stringify(keys)}) document.querySelector('#keys button[data-k="' + k + '"]').click(); return document.querySelector('#result').textContent; })()`);
  await nav(BASE + '/#/');
  await nav(BASE + '/light/calculatrice.html');
  check('Calculatrice : 12 + 3 × 4 = 24 (priorité des opérateurs)', (await press(['C', '1', '2', '+', '3', '*', '4', '='])) === '24');
  check('Calculatrice : 10 ÷ 4 = 2,5 et 50 % = 0,5', (await press(['C', '1', '0', '/', '4', '='])) === '2,5' && (await press(['C', '5', '0', '%', '='])) === '0,5');
  check('Calculatrice : titre neutre « Calculatrice », manifeste « Calculatrice »', await evalJs(`(async () => document.title === 'Calculatrice' && (await (await fetch('manifest.webmanifest')).json()).name === 'Calculatrice')()`));
  await press(['C', '0', '0', '0', '0', '=']);
  check('Code leurre 0000 : historique banal affiché', await waitFor('!document.querySelector("#decoy").hidden && document.querySelectorAll("#decoy li").length === 4', 8000));
  await evalJs('document.querySelector("#decoy-back").click()');
  const prefsRaw = await evalJs('localStorage.getItem("calc.prefs") || ""');
  check('Codes jamais stockés en clair (empreintes PBKDF2 seulement)', prefsRaw.includes('sHash') && !/1234|0000/.test(prefsRaw.replace(/"[sd](Hash|Salt)":"[^"]*"/g, '')), prefsRaw.slice(0, 60));
  await press(['C', '1', '2', '3', '4', '=']);
  check('Code secret 1234 : LIGHT s\'ouvre', await waitFor('location.pathname.endsWith("/light/index.html") && document.querySelector("h1")', 8000));
  await evalJs('[...document.querySelectorAll("nav a")].find(a => a.textContent === "Écrire").click()');
  await waitFor('location.pathname.endsWith("/light/ecrire.html") && document.querySelector("#light-send")', 8000);
  await evalJs('document.querySelector("#consent").click(); document.querySelector("#light-send").click()');
  await sleep(200);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  check('Mode discret : Échap ramène à la calculatrice', await waitFor('location.pathname.endsWith("/light/calculatrice.html") && document.querySelector("#keys")', 8000));
  check('Mode discret : notification camouflée « Calcul enregistré » après l\'envoi', await waitFor('document.querySelector("#notif").classList.contains("show") && document.querySelector("#notif-txt").textContent === "Calcul enregistré"', 5000));
  const camoHist = await send('Page.getNavigationHistory');
  const prevCamo = camoHist.entries[camoHist.currentIndex - 1] ? camoHist.entries[camoHist.currentIndex - 1].url : '';
  check('Mode discret : « Retour » ne ramène à aucune page de LIGHT', !prevCamo.includes('/light/'), `entrée précédente : ${prevCamo.replace(BASE, '')}`);
  check('Mode discret : session refermée à l\'arrivée sur la calculatrice', (await evalJs('sessionStorage.getItem("calc.s")')) === null);
  await press(['C', '1', '2', '3', '4', '=']);
  await waitFor('location.pathname.endsWith("/light/index.html")', 8000);
  await evalJs(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'))`);
  check('Mode discret : passage en arrière-plan → retour automatique à la calculatrice', await waitFor('location.pathname.endsWith("/light/calculatrice.html")', 8000));
  await nav(BASE + '/light/');
  check('Sans code secret, la sortie rapide de LIGHT reste la page neutre externe', (await evalJs('sessionStorage.getItem("calc.s")')) === null);

  // 9. Mobile : 360 px sans défilement horizontal
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 740, deviceScaleFactor: 2, mobile: true });
  for (const p of ['/#/', '/#/express', `/#/audit/${auditId}/rapport`, '/#/comparer', '/#/kit/K-EXIT', '/light/', '/light/contacts.html', '/light/calculatrice.html', '/light/discret.html', '/haven/']) {
    await nav(BASE + p);
    await waitFor('document.querySelector("h1")', 20000);
    await sleep(500);
    const sw = await evalJs('document.documentElement.scrollWidth');
    check(`Mobile 360 px sans défilement horizontal : ${p}`, sw <= 361, `largeur ${sw}`);
    if (['/#/', '/#/comparer', '/light/', '/light/calculatrice.html', '/light/discret.html'].includes(p)) await shot('07-mobile-' + (p.replace(/[^a-z]/g, '') || 'accueil'));
  }
  await send('Emulation.clearDeviceMetricsOverride');

  // 10. Hors ligne après le premier chargement (service worker)
  await nav(BASE + '/');
  await waitFor('navigator.serviceWorker && navigator.serviceWorker.controller', 10000) || (await nav(BASE + '/'), await waitFor('navigator.serviceWorker.controller', 10000));
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await nav(BASE + '/#/methode');
  const offOk = await waitFor('document.querySelector("main h1") && document.querySelector("main h1").textContent.includes("Méthode")', 10000);
  check('F7 : NUKUN fonctionne hors ligne après le premier chargement', offOk, await h1().catch(() => ''));
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  // 11. Erreurs JavaScript et violations CSP sur l'ensemble du parcours
  const relevant = errors.filter((e) => !/google\.com|ERR_BLOCKED_BY_CLIENT|net::ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e));
  check('Aucune erreur JavaScript ni violation CSP', relevant.length === 0, relevant.slice(0, 5).join(' | '));
} catch (e) {
  check('Exécution du scénario e2e', false, e.stack);
} finally {
  const pass = results.filter((r) => r.ok).length;
  fs.writeFileSync(path.join(OUT, 'resultats.json'), JSON.stringify({ date: new Date().toISOString(), navigateur: browserPath, pass, total: results.length, results }, null, 2));
  console.log(`\n${pass}/${results.length} vérifications réussies. Captures : tests/output/e2e/`);
  try { cdp.ws.close(); } catch { /* ignoré */ }
  proc.kill();
  await srv.close();
  setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignoré */ } process.exit(pass === results.length ? 0 : 1); }, 500);
}

/*
 * LIGHT — Camouflage « Calculatrice » : calcul secret et calcul leurre CHOISIS PAR LA PERSONNE.
 *
 * Safety by Design :
 *  - aucun code universel : tant que la personne n'a pas choisi son calcul secret, la calculatrice
 *    n'est qu'une calculatrice (si un code commun fuitait, toutes les victimes seraient exposées) ;
 *  - le calcul n'est JAMAIS stocké en clair : seulement une empreinte PBKDF2-SHA-256 salée ;
 *  - clés de stockage aux noms neutres (« calc.* ») ; rien n'est envoyé.
 */
(function () {
  'use strict';
  var PREFS_KEY = 'calc.prefs';
  var SESSION_KEY = 'calc.s';
  var NOTIF_FLAG = 'calc.n';
  var ITER = 100000;

  var PRESETS = [
    { id: 'calc', app: 'Calculatrice', icon: '🧮', text: 'Calcul enregistré' },
    { id: 'meteo', app: 'Météo', icon: '🌧️', text: 'Pluie prévue demain' },
    { id: 'batterie', app: 'Système', icon: '🔋', text: 'Batterie faible : 15 %' },
    { id: 'maj', app: 'Système', icon: '⚙️', text: 'Mise à jour installée' },
    { id: 'aucune', app: '', icon: '', text: '' }
  ];

  var enc = new TextEncoder();
  function toB64(buf) { var s = ''; new Uint8Array(buf).forEach(function (b) { s += String.fromCharCode(b); }); return btoa(s); }
  function fromB64(str) { return Uint8Array.from(atob(str), function (c) { return c.charCodeAt(0); }); }
  function rand(n) { return crypto.getRandomValues(new Uint8Array(n)); }

  /** Forme canonique d'un calcul : « 47 x 15 = » → « 47*15 ». */
  function normalizeCalc(s) {
    return String(s || '').replace(/\s+/g, '').replace(/[xX×]/g, '*').replace(/÷/g, '/').replace(/,/g, '.').replace(/−/g, '-').replace(/=+$/, '');
  }
  /** Un calcul secret valable : chiffres et opérations, au moins 5 caractères, pas trivial. */
  var TRIVIAL = ['1234', '12345', '0000', '00000', '1111', '11111', '1+1', '2+2', '1+2', '123456', '000000', '111111'];
  function validCalc(s) {
    var n = normalizeCalc(s);
    if (!/^\d+(\.\d+)?([+\-*/]\d+(\.\d+)?)*$/.test(n)) return 'Utilisez seulement des chiffres et les opérations + − × ÷ (par exemple 47+15 ou 3x18).';
    if (n.length < 5) return 'Choisissez un calcul d’au moins 5 caractères (par exemple 47+15).';
    if (TRIVIAL.indexOf(n) >= 0) return 'Ce calcul est trop simple à deviner. Choisissez-en un qui n’a de sens que pour vous.';
    return null;
  }

  function getPrefs() {
    try { return Object.assign({ notif: 'calc' }, JSON.parse(localStorage.getItem(PREFS_KEY) || 'null') || {}); }
    catch (e) { return { notif: 'calc' }; }
  }
  function setPrefs(p) {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); return true; } catch (e) { return false; }
  }

  function hashCode(code, saltB64) {
    return crypto.subtle.importKey('raw', enc.encode(normalizeCalc(code)), 'PBKDF2', false, ['deriveBits'])
      .then(function (base) { return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(saltB64), iterations: ITER }, base, 256); })
      .then(toB64);
  }

  /** Le calcul secret a-t-il été choisi par la personne ? (les anciens codes par défaut sont ignorés) */
  function isConfigured() { var p = getPrefs(); return !!(p.custom && p.sHash && p.sSalt); }

  /** Enregistre le calcul secret et (facultatif) le calcul leurre : empreintes uniquement. */
  function setCodes(secret, decoy) {
    var p = getPrefs();
    p.sSalt = toB64(rand(16));
    return hashCode(secret, p.sSalt).then(function (h) {
      p.sHash = h;
      if (decoy) { p.dSalt = toB64(rand(16)); return hashCode(decoy, p.dSalt).then(function (h2) { p.dHash = h2; }); }
      if (decoy === '') { delete p.dSalt; delete p.dHash; }
      return null;
    }).then(function () { p.custom = true; setPrefs(p); });
  }

  /** Renvoie « secret », « decoy » ou null. Sans calcul choisi : toujours null. */
  function checkCode(code) {
    if (!isConfigured()) return Promise.resolve(null);
    var p = getPrefs();
    return hashCode(code, p.sSalt).then(function (h) {
      if (h === p.sHash) return 'secret';
      if (!p.dHash) return null;
      return hashCode(code, p.dSalt).then(function (h2) { return h2 === p.dHash ? 'decoy' : null; });
    });
  }

  /* ---- Session de camouflage (onglet courant uniquement) ---- */
  function openSession() { try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) { /* ignoré */ } }
  function inSession() { try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return false; } }
  function closeSession() { try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignoré */ } }
  function flagNotif() { try { sessionStorage.setItem(NOTIF_FLAG, '1'); } catch (e) { /* ignoré */ } }
  function takeNotif() {
    try {
      if (sessionStorage.getItem(NOTIF_FLAG) !== '1') return null;
      sessionStorage.removeItem(NOTIF_FLAG);
    } catch (e) { return null; }
    var id = getPrefs().notif;
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i].id === 'aucune' ? null : PRESETS[i];
    return PRESETS[0];
  }
  function wipe() {
    try { localStorage.removeItem(PREFS_KEY); } catch (e) { /* ignoré */ }
    try { sessionStorage.clear(); } catch (e) { /* ignoré */ }
  }

  window.LIGHT_CAMO = {
    PRESETS: PRESETS, normalizeCalc: normalizeCalc, validCalc: validCalc, isConfigured: isConfigured,
    getPrefs: getPrefs, setPrefs: setPrefs, setCodes: setCodes, checkCode: checkCode,
    openSession: openSession, inSession: inSession, closeSession: closeSession, flagNotif: flagNotif, takeNotif: takeNotif, wipe: wipe,
    // compatibilité : plus de codes par défaut
    ensureCodes: function () { return Promise.resolve(); }, isDefaultCodes: function () { return !isConfigured(); }
  };
})();

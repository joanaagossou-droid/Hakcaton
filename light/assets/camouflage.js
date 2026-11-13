/*
 * LIGHT — Camouflage « Calculatrice » : réglages et codes (repris du prototype SafeElle, adapté).
 *
 * Safety by Design :
 *  - les codes secret et leurre ne sont JAMAIS stockés en clair : seulement une empreinte
 *    PBKDF2-SHA-256 salée (100 000 itérations) ;
 *  - les clés de stockage ont des noms neutres (« calc.* ») ;
 *  - rien n'est envoyé : tout reste dans ce navigateur ;
 *  - la session « espace ouvert » vit seulement dans sessionStorage (effacée à la fermeture).
 *
 * Démonstration : codes par défaut 1234 (secret) et 0000 (leurre). Un vrai service doit
 * imposer le choix d'un code personnel de 6 chiffres ou plus au premier lancement.
 */
(function () {
  'use strict';
  var PREFS_KEY = 'calc.prefs';
  var SESSION_KEY = 'calc.s';
  var NOTIF_FLAG = 'calc.n';
  var DEFAULT_SECRET = '1234';
  var DEFAULT_DECOY = '0000';
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

  function getPrefs() {
    try {
      var p = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
      return Object.assign({ notif: 'calc' }, p || {});
    } catch (e) { return { notif: 'calc' }; }
  }
  function setPrefs(p) {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); return true; } catch (e) { return false; }
  }

  function hashCode(code, saltB64) {
    return crypto.subtle.importKey('raw', enc.encode(String(code)), 'PBKDF2', false, ['deriveBits'])
      .then(function (base) {
        return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(saltB64), iterations: ITER }, base, 256);
      })
      .then(toB64);
  }

  /** Enregistre de nouveaux codes (empreintes uniquement). decoy = null : conserver l'actuel. */
  function setCodes(secret, decoy) {
    var p = getPrefs();
    p.sSalt = toB64(rand(16));
    return hashCode(secret, p.sSalt).then(function (h) {
      p.sHash = h;
      if (decoy === null || decoy === undefined) return null;
      p.dSalt = toB64(rand(16));
      return hashCode(decoy, p.dSalt).then(function (h2) { p.dHash = h2; });
    }).then(function () { setPrefs(p); });
  }

  function ensureCodes() {
    var p = getPrefs();
    if (p.sHash && p.dHash) return Promise.resolve();
    return setCodes(DEFAULT_SECRET, DEFAULT_DECOY);
  }

  /** Renvoie « secret », « decoy » ou null. */
  function checkCode(code) {
    return ensureCodes().then(function () {
      var p = getPrefs();
      return hashCode(code, p.sSalt).then(function (h) {
        if (h === p.sHash) return 'secret';
        return hashCode(code, p.dSalt).then(function (h2) { return h2 === p.dHash ? 'decoy' : null; });
      });
    });
  }

  function isDefaultCodes() {
    var p = getPrefs();
    return !p.custom;
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

  /** Efface tout ce que le camouflage a enregistré sur cet appareil. */
  function wipe() {
    try { localStorage.removeItem(PREFS_KEY); } catch (e) { /* ignoré */ }
    try { sessionStorage.clear(); } catch (e) { /* ignoré */ }
  }

  window.LIGHT_CAMO = {
    PRESETS: PRESETS, getPrefs: getPrefs, setPrefs: setPrefs, setCodes: setCodes, checkCode: checkCode,
    ensureCodes: ensureCodes, isDefaultCodes: isDefaultCodes, openSession: openSession, inSession: inSession,
    closeSession: closeSession, flagNotif: flagNotif, takeNotif: takeNotif, wipe: wipe
  };
})();

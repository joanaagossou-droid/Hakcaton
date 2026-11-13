/*
 * LIGHT — Noyau de l'espace protégé (repris du prototype SafeElle, adapté).
 * PROTOTYPE DE DÉMONSTRATION : situations et données fictives uniquement.
 *
 *  - Stockage local : IndexedDB « calc-cache » (nom neutre), rien n'est envoyé à un serveur.
 *  - Coffre de preuves : clé maîtresse AES-GCM 256 aléatoire, elle-même chiffrée par une clé
 *    dérivée du code secret (PBKDF2-SHA-256, 210 000 itérations). Sans le code, rien n'est lisible.
 *  - Dépôt sans code (alerte discrète) : paire RSA-OAEP 2048 ; la clé publique permet de DÉPOSER
 *    un enregistrement chiffré depuis la calculatrice verrouillée, la clé privée (chiffrée par le
 *    coffre) permet de le RELIRE.
 *  - Repérage des violences par règles simples et explicables (pas d'IA externe).
 */
(function () {
  'use strict';

  /* ---------- Stockage local (IndexedDB) ---------- */
  var DB_NAME = 'calc-cache';
  var STORES = ['items', 'vault'];
  function openDb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        STORES.forEach(function (s) { if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath: 'id' }); });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function tx(store, mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(store, mode);
        var out = fn(t.objectStore(store));
        t.oncomplete = function () { db.close(); resolve(out instanceof IDBRequest ? out.result : out); };
        t.onerror = function () { db.close(); reject(t.error); };
      });
    });
  }
  var dbPut = function (o) { return tx('items', 'readwrite', function (s) { return s.put(o); }); };
  var dbGet = function (id) { return tx('items', 'readonly', function (s) { return s.get(id); }); };
  var dbDelete = function (id) { return tx('items', 'readwrite', function (s) { return s.delete(id); }); };
  var dbAll = function () { return tx('items', 'readonly', function (s) { return s.getAll(); }); };
  var vaultPutRaw = function (o) { return tx('vault', 'readwrite', function (s) { return s.put(o); }); };
  var vaultAllRaw = function () { return tx('vault', 'readonly', function (s) { return s.getAll(); }); };
  var vaultDelete = function (id) { return tx('vault', 'readwrite', function (s) { return s.delete(id); }); };

  /* ---------- Cryptographie (Web Crypto) ---------- */
  var enc = new TextEncoder(), dec = new TextDecoder();
  function toB64(buf) { var s = ''; new Uint8Array(buf).forEach(function (b) { s += String.fromCharCode(b); }); return btoa(s); }
  function fromB64(str) { return Uint8Array.from(atob(str), function (c) { return c.charCodeAt(0); }); }
  function rand(n) { return crypto.getRandomValues(new Uint8Array(n)); }
  var KEK_ITER = 210000;
  var VAULT_KEY = 'calc.v';
  var DROP_KEY = 'calc.d';
  var ALERT_KEY = 'calc.a';
  var RSA = { name: 'RSA-OAEP', hash: 'SHA-256' };

  function kekFrom(code, salt) {
    return crypto.subtle.importKey('raw', enc.encode(String(code)), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: KEK_ITER }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function wrapMaster(raw, code) {
    var salt = rand(16), iv = rand(12);
    return kekFrom(code, salt).then(function (kek) { return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, kek, raw); })
      .then(function (ct) { localStorage.setItem(VAULT_KEY, JSON.stringify({ salt: toB64(salt), iv: toB64(iv), ct: toB64(ct) })); });
  }
  function vaultExists() { try { return !!localStorage.getItem(VAULT_KEY); } catch (e) { return false; } }
  /** Ouvre (ou crée) le coffre. Rejette si le code est faux. */
  function openVault(code) {
    var meta = null;
    try { meta = JSON.parse(localStorage.getItem(VAULT_KEY) || 'null'); } catch (e) { meta = null; }
    var rawP;
    if (!meta) { var raw = rand(32); rawP = wrapMaster(raw, code).then(function () { return raw; }); }
    else {
      rawP = kekFrom(code, fromB64(meta.salt)).then(function (kek) {
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(meta.iv) }, kek, fromB64(meta.ct));
      }).then(function (r) { return new Uint8Array(r); });
    }
    return rawP.then(function (r) {
      return crypto.subtle.importKey('raw', r, 'AES-GCM', false, ['encrypt', 'decrypt']).then(function (key) { return { key: key, raw: r }; });
    });
  }
  function rewrapVault(vault, newCode) { return wrapMaster(vault.raw, newCode); }
  function seal(key, bytes) {
    var iv = rand(12);
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, bytes).then(function (ct) { return { iv: toB64(iv), ct: ct }; });
  }
  function unseal(key, iv, ct) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, ct); }
  function newId() { return Array.from(rand(8), function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }

  function vaultAdd(vault, blob, info) {
    var meta = Object.assign({ name: blob.name || 'preuve', mime: blob.type || 'application/octet-stream', size: blob.size, platform: '', note: '', eventDate: '', addedAt: Date.now() }, info || {});
    return Promise.all([seal(vault.key, enc.encode(JSON.stringify(meta))), blob.arrayBuffer().then(function (b) { return seal(vault.key, b); })])
      .then(function (r) { return vaultPutRaw({ id: newId(), ivM: r[0].iv, ctM: r[0].ct, ivD: r[1].iv, ctD: r[1].ct }); });
  }

  function dropMeta() { try { return JSON.parse(localStorage.getItem(DROP_KEY) || 'null'); } catch (e) { return null; } }
  function dropReady() { var m = dropMeta(); return !!(m && m.pub); }
  function ensureDropKeys(vault) {
    if (dropReady()) return Promise.resolve();
    return crypto.subtle.generateKey(Object.assign({ modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, RSA), true, ['encrypt', 'decrypt'])
      .then(function (kp) {
        return Promise.all([crypto.subtle.exportKey('pkcs8', kp.privateKey).then(function (p) { return seal(vault.key, p); }), crypto.subtle.exportKey('spki', kp.publicKey)]);
      }).then(function (r) { localStorage.setItem(DROP_KEY, JSON.stringify({ pub: toB64(r[1]), iv: r[0].iv, ct: toB64(r[0].ct) })); });
  }
  /** Dépose (ou remplace, même id) un enregistrement chiffré sans connaître le code. */
  function dropAdd(id, blob, info) {
    var m = dropMeta();
    if (!m || !m.pub) return Promise.resolve(false);
    var raw = rand(32);
    return Promise.all([
      crypto.subtle.importKey('spki', fromB64(m.pub), RSA, false, ['encrypt']),
      crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt'])
    ]).then(function (k) {
      var meta = Object.assign({ name: 'preuve', mime: blob.type || 'application/octet-stream', size: blob.size, platform: '', note: '', eventDate: '', addedAt: Date.now() }, info || {});
      return Promise.all([
        crypto.subtle.encrypt({ name: 'RSA-OAEP' }, k[0], raw),
        seal(k[1], enc.encode(JSON.stringify(meta))),
        blob.arrayBuffer().then(function (b) { return seal(k[1], b); })
      ]);
    }).then(function (r) {
      return vaultPutRaw({ id: id, wk: toB64(r[0]), ivM: r[1].iv, ctM: r[1].ct, ivD: r[2].iv, ctD: r[2].ct });
    }).then(function () { return true; });
  }
  function recordKey(vault, r) {
    if (!r.wk) return Promise.resolve(vault.key);
    var privP = vault.priv ? Promise.resolve(vault.priv) : (function () {
      var m = dropMeta();
      if (!m) return Promise.reject(new Error('dépôt absent'));
      return unseal(vault.key, m.iv, fromB64(m.ct)).then(function (p) { return crypto.subtle.importKey('pkcs8', p, RSA, false, ['decrypt']); })
        .then(function (k) { vault.priv = k; return k; });
    })();
    return privP.then(function (priv) { return crypto.subtle.decrypt({ name: 'RSA-OAEP' }, priv, fromB64(r.wk)); })
      .then(function (raw) { return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']); });
  }
  function vaultList(vault) {
    return vaultAllRaw().then(function (all) {
      return Promise.all(all.map(function (r) {
        return recordKey(vault, r).then(function (k) { return unseal(k, r.ivM, r.ctM); })
          .then(function (m) { return { id: r.id, meta: JSON.parse(dec.decode(m)) }; })
          .catch(function () { return null; });
      }));
    }).then(function (list) { return list.filter(Boolean).sort(function (a, b) { return b.meta.addedAt - a.meta.addedAt; }); });
  }
  function vaultBlob(vault, id) {
    return tx('vault', 'readonly', function (s) { return s.get(id); }).then(function (r) {
      if (!r) return null;
      return recordKey(vault, r).then(function (k) {
        return Promise.all([unseal(k, r.ivM, r.ctM), unseal(k, r.ivD, r.ctD)]);
      }).then(function (x) { return new Blob([x[1]], { type: JSON.parse(dec.decode(x[0])).mime }); });
    });
  }
  function fingerprint(blob) {
    return blob.arrayBuffer().then(function (b) { return crypto.subtle.digest('SHA-256', b); })
      .then(function (h) { return Array.from(new Uint8Array(h), function (x) { return x.toString(16).padStart(2, '0'); }).join(''); });
  }

  /* ---------- Réglages de l'alerte discrète ---------- */
  function alertPrefs() {
    try { return Object.assign({ on: false, vibrate: true, lang: '', pseudo: '' }, JSON.parse(localStorage.getItem(ALERT_KEY) || 'null') || {}); }
    catch (e) { return { on: false, vibrate: true, lang: '', pseudo: '' }; }
  }
  function saveAlertPrefs(patch) {
    try { localStorage.setItem(ALERT_KEY, JSON.stringify(Object.assign(alertPrefs(), patch))); } catch (e) { /* ignoré */ }
  }

  /* ---------- Tout effacer ---------- */
  function wipeAll() {
    return Promise.all([tx('items', 'readwrite', function (s) { return s.clear(); }), tx('vault', 'readwrite', function (s) { return s.clear(); })])
      .catch(function () { /* base absente */ })
      .then(function () {
        [VAULT_KEY, DROP_KEY, ALERT_KEY, 'calc.prefs'].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignoré */ } });
        try { sessionStorage.clear(); } catch (e) { /* ignoré */ }
      });
  }

  /* ---------- Code de suivi ---------- */
  var ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function newTrackingCode() {
    var s = '';
    rand(9).forEach(function (b, i) { s += ALPHA[b % ALPHA.length]; if (i === 2 || i === 5) s += '-'; });
    return s;
  }
  function normCode(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

  /* ---------- Repérage des violences (règles simples, explicables) ---------- */
  var CATEGORIES = {
    menace: { label: 'Menace', level: 3, why: 'Le message annonce une violence ou fait peur pour ta sécurité.',
      terms: ['je vais te tuer', 'te tuer', 'tuer', 'te frapper', 'je vais te frapper', 'tu vas le regretter', 'tu vas voir', 'je sais ou tu habites', 'je vais te retrouver', 'je vais venir chez toi', 'tu vas mourir', 'je vais te faire du mal', 'me tuer', 'me frapper', "m'a frappee", "m'a frappe", 'il me menace', 'me menace', 'menaces', 'faire du mal', 'te violer', 'me violer', 'violer', 'te tabasser', 'tu vas payer', 'tu es morte', 'je vais te bruler'] },
    chantage: { label: 'Chantage ou sextorsion', level: 3, why: "Quelqu'un utilise des images ou des informations pour te forcer à faire quelque chose. C'est une violence et un délit.",
      terms: ['photo', 'photos', 'video', 'videos', 'nue', 'nues', 'intime', 'intimes', 'publier', 'je vais publier', 'diffuser', 'envoyer a tout le monde', 'montrer a tout le monde', 'a ta famille', 'sinon', 'paie', 'payer', 'argent', 'transfert', 'nudes', 'sextape', 'tes photos', 'mes photos', 'video de toi', 'envoie moi une photo', 'envoie des photos'] },
    controle: { label: 'Contrôle ou surveillance', level: 2, why: 'Contrôler tes déplacements, ton téléphone ou ton argent est une forme de violence.',
      terms: ['ou es tu', 'ou es-tu', 'envoie ta position', 'ta position', 'localisation', 'ton code', 'mot de passe', 'donne moi ton telephone', 'je lis tes messages', 'je vois tout', 'je surveille', 'mobile money', 'ton compte', 'lit mes messages', 'lit tous mes messages', 'fouille mon telephone', 'ou je suis', 'ma position', 'me surveille', 'me suit', 'mon code', 'pris mon telephone', 'controle mon telephone', 'prend mon argent', 'pris mon argent'] },
    humiliation: { label: 'Insulte ou humiliation', level: 2, why: 'Les insultes et humiliations répétées sont une violence psychologique.',
      terms: ['salope', 'salaud', 'pute', 'putain', 'petasse', 'garce', 'chienne', 'connard', 'connasse', 'conne', 'idiote', 'idiot', 'imbecile', 'stupide', 'debile', 'abrutie', 'cretine', 'folle', 'nulle', 'grosse vache', 'laide', 'moche', 'sorciere', 'trainee', 'batarde', 'ta gueule', 'ferme ta gueule', 'ordure', 'pourriture', 'tu ne vaux rien', 'bonne a rien', 'personne ne te croira', "personne ne t'aime", 'tu es nulle', 'honte', 'inutile', "m'insulte", 'insultes', 'insulte', "m'humilie", 'se moque de moi', 'me traite de'] }
  };
  var LEVEL_LABELS = { urgente: 'Urgente', haute: 'Haute', normale: 'Normale' };
  var LANGUES = ['Fon', 'Goun', 'Yoruba', 'Mina', 'Adja', 'Bariba', 'Dendi', 'Français', 'Autre'];

  function normChar(c) { var n = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); return n.length ? n[0] : c; }
  function normalize(text) { var out = ''; Array.from(String(text)).forEach(function (c) { out += c === '’' ? "'" : normChar(c); }); return out; }
  function isLetter(ch) { return !!ch && /[a-z0-9À-ɏ]/i.test(ch); }

  function analyze(text) {
    var src = Array.from(String(text || ''));
    var norm = normalize(src.join(''));
    var hits = [];
    Object.keys(CATEGORIES).forEach(function (cat) {
      CATEGORIES[cat].terms.forEach(function (term) {
        var from = 0, idx;
        while ((idx = norm.indexOf(term, from)) !== -1) {
          var end = idx + term.length;
          if (!isLetter(norm[idx - 1]) && !isLetter(norm[end])) hits.push({ cat: cat, term: term, start: idx, end: end });
          from = idx + 1;
        }
      });
    });
    hits.sort(function (a, b) { return a.start - b.start || (b.end - b.start) - (a.end - a.start); });
    var kept = [], lastEnd = -1;
    hits.forEach(function (h) { if (h.start >= lastEnd) { kept.push(h); lastEnd = h.end; } });
    var cats = kept.map(function (h) { return h.cat; }).filter(function (c, i, a) { return a.indexOf(c) === i; });
    var maxLevel = cats.reduce(function (m, c) { return Math.max(m, CATEGORIES[c].level); }, 0);
    var level = maxLevel >= 3 ? 'urgente' : (maxLevel === 2 || kept.length >= 3) ? 'haute' : 'normale';
    return { level: level, hits: kept, cats: cats, chars: src };
  }
  function hitWords(r) {
    return r.hits.map(function (h) { return r.chars.slice(h.start, h.end).join('').toLowerCase(); }).filter(function (w, i, a) { return a.indexOf(w) === i; });
  }
  /** Texte surligné, construit en DOM (aucune insertion HTML). */
  function highlightNode(r) {
    var p = document.createElement('p');
    p.className = 'analysed';
    var pos = 0;
    r.hits.forEach(function (h) {
      p.appendChild(document.createTextNode(r.chars.slice(pos, h.start).join('')));
      var m = document.createElement('mark');
      m.className = 'hit hit-' + h.cat; m.title = CATEGORIES[h.cat].label;
      m.textContent = r.chars.slice(h.start, h.end).join('');
      p.appendChild(m); pos = h.end;
    });
    p.appendChild(document.createTextNode(r.chars.slice(pos).join('')));
    return p;
  }

  /* ---------- Assistante (règles locales, aucune IA externe) ----------
     Contacts : numéros FICTIFS de LIGHT (aucun numéro réel n'est publié tant qu'il n'est pas vérifié). */
  var HELP_LINES = 'Où trouver de l’aide (numéros FICTIFS de démonstration, voir la page Contacts) :\n• Services de sécurité, danger immédiat : 00 00 01 04\n• Assistance sociale et écoute : 00 00 01 01\n• Assistance juridique : 00 00 01 03\n• Assistance numérique : 00 00 01 05';
  var CONSTATS = {
    menace: 'Ce que tu décris ressemble à des menaces. Menacer quelqu’un, en ligne ou en face, est une violence.',
    chantage: 'Ce que tu décris ressemble à du chantage, peut-être de la sextorsion (menacer de publier des images pour obtenir de l’argent ou autre chose). C’est une violence et un délit.',
    controle: 'Ce que tu décris ressemble à du contrôle ou de la surveillance (téléphone, déplacements, argent). C’est une forme de violence.',
    humiliation: 'Ce que tu décris ressemble à du harcèlement : insultes ou humiliations répétées. C’est une violence psychologique.'
  };
  var CONSEILS = {
    menace: ['Si tu es en danger maintenant, contacte les services de sécurité.', 'Si possible, ne reste pas seule : parle à une personne de confiance.'],
    chantage: ['Ne paie pas et ne réponds pas.', 'Ne supprime rien : fais des captures d’écran et range-les dans « Mes preuves ».', 'Signale le compte sur l’application concernée.'],
    controle: ['Regarde les conseils de sécurité numérique, sans changer brusquement tes réglages si cela peut être remarqué.', 'Garde ton code Mobile Money pour toi seule si c’est sans danger.'],
    humiliation: ['Ne réponds pas aux insultes.', 'Garde les messages comme preuves dans « Mes preuves », puis bloque la personne si c’est sans danger.']
  };
  var ADVICE = {
    menace: 'Si tu es en danger maintenant, contacte les services de sécurité. Parle à une personne de confiance.',
    chantage: 'Ne paie pas et ne réponds pas. Garde les preuves. Ce n’est pas ta faute : tu peux demander de l’aide.',
    controle: 'Personne n’a le droit de contrôler ton téléphone, tes déplacements ou ton argent.',
    humiliation: 'Tu n’as pas à accepter des insultes. Ne réponds pas, garde les messages et parles-en à une personne de confiance.'
  };
  function assistant(text) {
    var n = normalize(text || '');
    var r = analyze(text || '');
    if (!r.cats.length) {
      if (/\b(bonjour|bonsoir|salut|coucou)\b/.test(n) && n.length < 40) return 'Bonjour. Je suis là pour t’écouter. Raconte-moi ce qui s’est passé, avec tes mots. Tu n’as pas besoin de donner ton nom.\n\nDémonstration : décris uniquement une situation inventée.';
      if (/(preuve|capture|garder)/.test(n)) return 'Pour garder des preuves, si tu le souhaites :\n1. Fais des captures d’écran où l’on voit la date, l’heure et le nom du compte.\n2. Range-les dans « Mes preuves » : elles y sont chiffrées avec ton code secret.\n3. Ensuite, tu peux les supprimer de ta galerie si c’est sans danger.\n\nTu n’as pas besoin de preuve pour demander de l’aide.\n\n' + HELP_LINES;
      if (/(numero|appeler|aide|qui contacter)/.test(n)) return 'Tu peux contacter :\n\n' + HELP_LINES + '\n\nLight ne remplace pas les services d’urgence.';
      return 'Merci de m’en parler. Je n’ai pas encore assez d’éléments pour comprendre. Peux-tu me dire ce que la personne dit ou fait, et sur quelle application ?\n\nSi tu es en danger maintenant, contacte les services de sécurité.';
    }
    var out = 'Ce que je comprends :\n' + r.cats.map(function (c) { return '• ' + CONSTATS[c]; }).join('\n');
    out += '\n\nCe n’est pas ta faute.';
    if (r.level === 'urgente') out += '\n\nTa sécurité d’abord : si tu es en danger maintenant, contacte les services de sécurité.';
    var tips = [];
    r.cats.forEach(function (c) { CONSEILS[c].forEach(function (t) { if (tips.indexOf(t) < 0) tips.push(t); }); });
    out += '\n\nCe que tu peux faire :\n' + tips.map(function (t, i) { return (i + 1) + '. ' + t; }).join('\n');
    out += '\n\n' + HELP_LINES + '\n\nJe suis une assistante automatique à règles simples : je repère des mots, je peux me tromper, et ce n’est pas un avis juridique. Je ne contacte personne à ta place.';
    return out;
  }

  window.LIGHT_CORE = {
    dbPut: dbPut, dbGet: dbGet, dbDelete: dbDelete, dbAll: dbAll,
    vaultExists: vaultExists, openVault: openVault, rewrapVault: rewrapVault, vaultAdd: vaultAdd, vaultList: vaultList, vaultBlob: vaultBlob, vaultDelete: vaultDelete,
    ensureDropKeys: ensureDropKeys, dropReady: dropReady, dropAdd: dropAdd, fingerprint: fingerprint,
    alertPrefs: alertPrefs, saveAlertPrefs: saveAlertPrefs, wipeAll: wipeAll,
    newTrackingCode: newTrackingCode, normCode: normCode, newId: newId,
    CATEGORIES: CATEGORIES, LEVEL_LABELS: LEVEL_LABELS, LANGUES: LANGUES, ADVICE: ADVICE,
    analyze: analyze, hitWords: hitWords, highlightNode: highlightNode, assistant: assistant
  };
})();

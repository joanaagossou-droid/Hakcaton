/*
 * SafeHer — « Mon espace » : message vocal, réponse, assistante, coffre de preuves, alerte discrète.
 * Repris du prototype SafeElle et réécrit sans insertion HTML (textContent uniquement).
 * Prototype de démonstration : rien n'est envoyé hors de ce navigateur.
 */
(function () {
  'use strict';
  var C = window.LIGHT_CORE;
  var $ = function (id) { return document.getElementById(id); };
  if (!C || !$('v-voice')) return;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  function mmss(s) { return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); }
  function camouflaged() { try { return sessionStorage.getItem('calc.s') === '1'; } catch (e) { return false; } }
  var urls = [];
  function objectUrl(blob) { var u = URL.createObjectURL(blob); urls.push(u); return u; }
  window.addEventListener('pagehide', function () { urls.forEach(function (u) { URL.revokeObjectURL(u); }); });

  /* ---------- Onglets ---------- */
  var tabs = document.querySelectorAll('[data-tab]');
  function show(id) {
    tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.tab === id)); });
    document.querySelectorAll('.view').forEach(function (v) { v.hidden = v.id !== id; });
    if (id !== 'v-voice') stopRecording(true);
    if (id === 'v-alert') loadAlertSettings();
  }
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var recog = null, transcript = '';
  tabs.forEach(function (t) { t.addEventListener('click', function () { show(t.dataset.tab); }); });

  /* =========================================================
     1. Message vocal
     ========================================================= */
  var lang = null, recorder = null, stream = null, chunks = [], audioBlob = null, tStart = 0, tick = null, durationSec = 0;
  var MAX_SEC = 120;
  var AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];

  C.LANGUES.forEach(function (l) {
    var b = el('button', 'chip', l); b.type = 'button'; b.dataset.lang = l;
    b.addEventListener('click', function () {
      lang = l;
      document.querySelectorAll('#lang-chips .chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c === b)); });
      $('voice-step2').hidden = false;
      routeInfo();
    });
    $('lang-chips').appendChild(b);
  });

  /** Français : analyse automatique possible (facultative). Autres langues : écoute humaine directe. */
  function routeInfo() {
    var fr = lang === 'Français';
    $('stt-wrap').hidden = !(fr && SR);
    if (!(fr && SR)) $('stt-on').checked = false;
    var ri = $('route-info');
    if (!fr) { ri.textContent = 'Votre message en ' + lang + ' sera écouté directement par une personne de l’équipe d’écoute qui parle cette langue. Aucune analyse automatique.'; ri.hidden = false; }
    else if (!SR) { ri.textContent = 'Ce navigateur ne sait pas transcrire la voix : une personne de l’équipe d’écoute écoutera votre message.'; ri.hidden = false; }
    else ri.hidden = true;
  }
  function startRecognition() {
    transcript = '';
    if (!SR || !$('stt-on').checked) return;
    try {
      recog = new SR();
      recog.lang = 'fr-FR'; recog.continuous = true; recog.interimResults = false;
      recog.onresult = function (e) { for (var i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) transcript += ' ' + e.results[i][0].transcript; };
      recog.onerror = function () { /* la personne sera écoutée par un humain */ };
      recog.onend = function () { recog = null; showVoiceAnalysis(); };
      recog.start();
    } catch (e) { recog = null; }
  }
  function stopRecognition() { if (recog) { try { recog.stop(); } catch (e) { recog = null; } } }
  function showVoiceAnalysis() {
    var box = clear($('voice-analysis'));
    if (!$('stt-on').checked || !audioBlob) return;
    if (!transcript.trim()) { box.appendChild(el('p', 'ok', 'Rien n’a pu être transcrit : une personne de l’équipe d’écoute écoutera votre message.')); return; }
    box.appendChild(el('p', 'small', 'Ce que l’analyse automatique a compris (elle peut se tromper) :'));
    box.appendChild(analysisBlock(C.analyze(transcript), 'Analyse de votre message'));
  }
  function updateSend() { $('send-voice').disabled = !($('voice-consent').checked && audioBlob && lang); }
  function setAudio(blob, sec) {
    audioBlob = blob; durationSec = sec;
    $('playback').src = objectUrl(blob);
    $('play-wrap').hidden = false; $('voice-step3').hidden = false;
    $('rec-timer').textContent = mmss(sec);
    updateSend();
    if (!recog) showVoiceAnalysis(); // sinon, l'analyse s'affiche quand la transcription se termine
  }
  function startRecording() {
    if (!navigator.mediaDevices || !window.MediaRecorder) { $('mic-msg').textContent = 'L’enregistrement n’est pas disponible ici. Utilisez un fichier audio.'; return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      stream = s;
      var type = AUDIO_TYPES.filter(function (t) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t); })[0];
      recorder = new MediaRecorder(s, Object.assign({ audioBitsPerSecond: 24000 }, type ? { mimeType: type } : {}));
      chunks = [];
      recorder.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      recorder.onstop = function () {
        if (recorder && recorder._discard) { chunks = []; return; }
        setAudio(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }), Math.round((Date.now() - tStart) / 1000));
      };
      recorder.start();
      startRecognition();
      tStart = Date.now();
      $('rec-btn').classList.add('on'); $('rec-btn').textContent = '⏹'; $('rec-btn').setAttribute('aria-label', 'Arrêter l’enregistrement');
      $('mic-msg').textContent = 'Enregistrement en cours… Appuyez à nouveau pour arrêter.';
      tick = setInterval(function () {
        var sec = (Date.now() - tStart) / 1000;
        $('rec-timer').textContent = mmss(sec);
        if (sec >= MAX_SEC) stopRecording(false);
      }, 250);
    }).catch(function () { $('mic-msg').textContent = 'Le micro est refusé ou indisponible. Vous pouvez utiliser un fichier audio.'; });
  }
  function stopRecording(discard) {
    clearInterval(tick);
    if (recorder && recorder.state !== 'inactive') { recorder._discard = !!discard; recorder.stop(); }
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    stopRecognition();
    $('rec-btn').classList.remove('on'); $('rec-btn').textContent = '🎙️'; $('rec-btn').setAttribute('aria-label', 'Commencer l’enregistrement');
    if (!discard) $('mic-msg').textContent = '';
  }
  function resetVoice() {
    stopRecording(true);
    lang = null; audioBlob = null; durationSec = 0; chunks = [];
    document.querySelectorAll('#lang-chips .chip').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
    $('voice-step2').hidden = true; $('voice-step3').hidden = true; $('play-wrap').hidden = true;
    $('playback').removeAttribute('src');
    $('rec-timer').textContent = '0:00'; $('mic-msg').textContent = '';
    $('voice-consent').checked = false; $('pseudo').value = ''; $('audio-file').value = '';
    transcript = ''; clear($('voice-analysis')); $('route-info').hidden = true; $('stt-wrap').hidden = true; $('stt-on').checked = false;
    updateSend();
  }
  $('rec-btn').addEventListener('click', function () { if (recorder && recorder.state === 'recording') stopRecording(false); else startRecording(); });
  $('redo').addEventListener('click', function () { var l = lang; resetVoice(); lang = l; document.querySelectorAll('#lang-chips .chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.lang === l)); }); $('voice-step2').hidden = false; });
  $('audio-file').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    if (f.size > 3 * 1024 * 1024) { $('mic-msg').textContent = 'Fichier trop lourd (3 Mo au plus).'; return; }
    transcript = '';
    setAudio(f, 0);
    clear($('voice-analysis')).appendChild(el('p', 'ok', 'Un fichier audio ne peut pas être analysé automatiquement : une personne de l’équipe d’écoute l’écoutera directement.'));
  });
  $('voice-consent').addEventListener('change', updateSend);
  $('send-voice').addEventListener('click', function () {
    if (!($('voice-consent').checked && audioBlob && lang)) return;
    var code = C.newTrackingCode();
    var msg = {
      id: C.newId(), kind: 'vocal', code: C.normCode(code), createdAt: Date.now(), lang: lang,
      pseudo: $('pseudo').value.trim().slice(0, 30), audio: audioBlob, audioType: audioBlob.type || 'audio/webm', durationSec: durationSec,
      consent: true, status: 'nouveau', translation: '', priority: null, needs: [], orientation: '', reply: null, listens: [], treatedAt: null,
      // Analyse automatique (français, si activée) ou écoute humaine directe (autres langues, fichiers).
      transcript: transcript.trim().slice(0, 4000), route: transcript.trim() ? 'analyse' : 'humain',
      priorityAuto: transcript.trim() ? C.analyze(transcript).level : null
    };
    C.dbPut(msg).then(function () {
      resetVoice();
      $('voice-step2').hidden = true;
      $('code-show').textContent = code;
      $('voice-code').hidden = false;
      // Mode discret : la calculatrice affichera une notification camouflée.
      if (camouflaged()) { try { sessionStorage.setItem('calc.n', '1'); } catch (e) { /* ignoré */ } }
    }).catch(function () { $('mic-msg').textContent = 'Impossible d’enregistrer le message sur cet appareil.'; });
  });
  $('code-done').addEventListener('click', function () { $('code-show').textContent = ''; $('voice-code').hidden = true; });

  /* =========================================================
     2. Écouter ma réponse
     ========================================================= */
  function analysisBlock(r, title) {
    var box = el('div', 'found');
    box.appendChild(el('strong', null, title));
    var words = C.hitWords(r);
    if (!words.length) {
      box.appendChild(el('p', null, 'Aucun mot inquiétant n’a été repéré. Cela ne veut pas dire que tout va bien : si vous avez peur, demandez de l’aide.'));
    } else {
      var lv = el('p'); lv.appendChild(document.createTextNode('Niveau de danger : ')); lv.appendChild(el('span', 'level ' + r.level, C.LEVEL_LABELS[r.level])); box.appendChild(lv);
      var wl = el('div', 'wordlist'); words.forEach(function (w) { wl.appendChild(el('span', null, '« ' + w + ' »')); }); box.appendChild(wl);
      r.cats.forEach(function (c) {
        var tip = el('div', 'tip'); tip.appendChild(el('strong', null, C.CATEGORIES[c].label));
        tip.appendChild(el('p', null, C.CATEGORIES[c].why)); tip.appendChild(el('p', null, C.ADVICE[c])); box.appendChild(tip);
      });
    }
    var p = el('p', 'small'); p.appendChild(document.createTextNode('Contacts (numéros fictifs de démonstration) : '));
    var a = el('a', null, 'voir la page Contacts'); a.href = 'contacts.html'; p.appendChild(a); box.appendChild(p);
    box.appendChild(el('p', 'small', 'Cette analyse repère des mots : elle peut se tromper. Ce n’est pas un avis juridique.'));
    return box;
  }
  $('code-go').addEventListener('click', function () {
    var c = C.normCode($('code-in').value);
    var out = clear($('reply-out'));
    if (c.length < 9) { out.appendChild(el('p', 'small', 'Le code contient 9 caractères, par exemple ABC-DEF-GHJ.')); return; }
    C.dbAll().then(function (all) {
      var m = all.filter(function (x) { return x.code === c; })[0];
      if (!m) { out.appendChild(el('p', 'small', 'Ce code n’est pas reconnu.')); return; }
      if (!m.reply) { out.appendChild(el('p', 'ok', 'Votre message a bien été reçu. Il n’y a pas encore de réponse : revenez plus tard.')); return; }
      var card = el('div', 'card'); card.appendChild(el('strong', null, 'Réponse'));
      if (m.reply.text) card.appendChild(el('p', 'pre', m.reply.text));
      if (m.reply.orientation) card.appendChild(el('p', 'small', 'Orientation proposée : ' + m.reply.orientation));
      if (m.reply.audio) { var au = document.createElement('audio'); au.controls = true; au.src = objectUrl(m.reply.audio); card.appendChild(au); }
      card.appendChild(el('p', 'small', 'Écoutez avec des écouteurs si possible.'));
      out.appendChild(card);
      if (m.translation) out.appendChild(analysisBlock(C.analyze(m.translation), 'Ce qui a été repéré dans votre message'));
      var del = el('button', 'btn secondary', 'J’ai lu : effacer ma réponse'); del.type = 'button';
      del.addEventListener('click', function () {
        C.dbDelete(m.id).then(function () { $('code-in').value = ''; clear(out).appendChild(el('p', 'ok', 'Votre réponse a été effacée de ce téléphone.')); });
      });
      out.appendChild(del);
    });
  });

  /* =========================================================
     3. Assistante (règles locales)
     ========================================================= */
  function bubble(who, text, analysis) {
    var b = el('div', 'bubble ' + who);
    if (analysis && analysis.hits.length) b.appendChild(C.highlightNode(analysis)); else b.appendChild(el('p', 'pre', text));
    $('chat-log').appendChild(b);
    b.scrollIntoView({ block: 'nearest' });
  }
  function sendChat(text) {
    text = String(text || '').trim().slice(0, 2000);
    if (!text) return;
    $('chat-in').value = '';
    var r = C.analyze(text);
    bubble('me', text, r);
    setTimeout(function () {
      bubble('bot', C.assistant(text));
      if (r.hits.length) $('chat-log').appendChild(analysisBlock(r, 'Mots repérés dans votre message'));
    }, 350);
  }
  $('chat-send').addEventListener('click', function () { sendChat($('chat-in').value); });
  $('chat-in').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat($('chat-in').value); } });
  $('chat-quick').addEventListener('click', function (e) { var b = e.target.closest('[data-q]'); if (b) sendChat(b.dataset.q); });
  bubble('bot', 'Bonjour. Je suis l’assistante de SafeHer. Racontez-moi ce qui se passe, ou collez un message reçu : je vous dirai ce que je repère. Démonstration : situation inventée uniquement.');

  /* =========================================================
     4. Coffre de preuves (chiffré avec le code secret)
     ========================================================= */
  var vault = null;
  function openVaultWith(code) {
    var camo = window.LIGHT_CAMO;
    if (!camo || !camo.isConfigured()) return Promise.reject(new Error('aucun'));
    // Le calcul doit être le calcul secret de la calculatrice (empreinte vérifiée).
    return camo.checkCode(code).then(function (r) {
      if (r !== 'secret') throw new Error('code');
      return C.openVault(camo.normalizeCalc(code));
    }).then(function (v) {
      vault = v;
      return C.ensureDropKeys(v).catch(function () { /* le coffre reste utilisable */ }).then(function () { return v; });
    });
  }
  $('vault-open').addEventListener('click', function () {
    var code = $('vault-code').value.trim();
    $('vault-lock-msg').textContent = 'Ouverture du coffre…';
    openVaultWith(code).then(function () {
      $('vault-code').value = '';
      $('vault-lock').hidden = true; $('vault-body').hidden = false; $('vault-lock-msg').textContent = '';
      renderVault();
    }).catch(function (e) {
      $('vault-lock-msg').textContent = e && e.message === 'aucun'
        ? 'Choisissez d’abord votre calcul secret dans « Mode discret ».'
        : 'Calcul incorrect. Utilisez le calcul secret de la calculatrice.';
    });
  });
  function closeVault() {
    vault = null;
    clear($('vault-list')); clear($('vault-view')); $('vault-view').hidden = true;
    $('vault-body').hidden = true; $('vault-lock').hidden = false;
  }
  $('vault-close').addEventListener('click', closeVault);
  function renderVault() {
    var list = clear($('vault-list'));
    if (!vault) return;
    list.appendChild(el('p', 'small', 'Déchiffrement…'));
    C.vaultList(vault).then(function (items) {
      clear(list);
      $('vault-count').textContent = items.length ? '(' + items.length + ')' : '';
      if (!items.length) { list.appendChild(el('p', 'small', 'Aucune preuve pour l’instant.')); return; }
      items.forEach(function (it) {
        var b = el('button', 'vitem'); b.type = 'button';
        var ph = el('span', 'ph');
        if (it.meta.mime.indexOf('image/') === 0) {
          C.vaultBlob(vault, it.id).then(function (blob) { var img = document.createElement('img'); img.alt = ''; img.src = objectUrl(blob); ph.appendChild(img); });
        } else ph.textContent = it.meta.mime.indexOf('audio/') === 0 ? '🎙️' : '📄';
        b.appendChild(ph);
        b.appendChild(el('span', null, (it.meta.platform || 'Preuve') + ' · ' + new Date(it.meta.addedAt).toLocaleDateString('fr-FR')));
        b.addEventListener('click', function () { viewItem(it); });
        list.appendChild(b);
      });
    }).catch(function () { clear(list).appendChild(el('p', 'small', 'Impossible d’ouvrir le coffre sur cet appareil.')); });
  }
  function viewItem(it) {
    C.vaultBlob(vault, it.id).then(function (blob) {
      var v = clear($('vault-view'));
      v.appendChild(el('strong', null, (it.meta.platform || 'Preuve') + (it.meta.eventDate ? ' – faits du ' + it.meta.eventDate : '')));
      v.appendChild(el('p', 'small', 'Ajoutée le ' + new Date(it.meta.addedAt).toLocaleString('fr-FR') + (it.meta.note ? ' · ' + it.meta.note : '')));
      if (it.meta.mime.indexOf('image/') === 0) { var img = document.createElement('img'); img.alt = 'Preuve'; img.src = objectUrl(blob); v.appendChild(img); }
      if (it.meta.mime.indexOf('audio/') === 0) { var au = document.createElement('audio'); au.controls = true; au.src = objectUrl(blob); v.appendChild(au); }
      if (it.meta.sha256) v.appendChild(el('p', 'small mono', 'Empreinte numérique (SHA-256), pour montrer que l’enregistrement n’a pas été modifié : ' + it.meta.sha256));
      var row = el('div', 'actions');
      var close = el('button', 'btn secondary', 'Fermer'); close.type = 'button';
      close.addEventListener('click', function () { clear(v); v.hidden = true; });
      var del = el('button', 'btn secondary', 'Supprimer cette preuve'); del.type = 'button';
      del.addEventListener('click', function () {
        if (!window.confirm('Supprimer définitivement cette preuve ?')) return;
        C.vaultDelete(it.id).then(function () { clear(v); v.hidden = true; renderVault(); });
      });
      row.appendChild(close); row.appendChild(del); v.appendChild(row);
      v.hidden = false; v.scrollIntoView({ block: 'nearest' });
    });
  }
  $('vault-file').addEventListener('change', function (e) { $('vault-add').disabled = !(e.target.files && e.target.files.length); });
  $('vault-add').addEventListener('click', function () {
    var files = Array.prototype.slice.call($('vault-file').files || []);
    var msg = $('vault-msg');
    if (!files.length || !vault) return;
    if (files.some(function (f) { return f.size > 10 * 1024 * 1024; })) { msg.textContent = 'Un fichier dépasse 10 Mo.'; return; }
    $('vault-add').disabled = true; msg.textContent = 'Chiffrement en cours…';
    var info = { platform: $('vault-platform').value, eventDate: $('vault-date').value.trim().slice(0, 40), note: $('vault-note').value.trim().slice(0, 200) };
    files.reduce(function (p, f) {
      return p.then(function () { return C.fingerprint(f); }).then(function (h) { return C.vaultAdd(vault, f, Object.assign({ name: f.name, sha256: h }, info)); });
    }, Promise.resolve()).then(function () {
      ['vault-file', 'vault-date', 'vault-note'].forEach(function (id) { $(id).value = ''; }); $('vault-platform').value = '';
      msg.textContent = files.length + ' preuve(s) mise(s) à l’abri. Pensez à les supprimer de la galerie si c’est sans danger.';
      renderVault();
    }).catch(function () { msg.textContent = 'Impossible de mettre la preuve à l’abri.'; $('vault-add').disabled = false; });
  });

  /* =========================================================
     5. Alerte discrète : réglages et préparation
     ========================================================= */
  function loadAlertSettings() {
    var a = C.alertPrefs();
    var sel = clear($('alert-lang'));
    var o0 = el('option', null, 'Choisir…'); o0.value = ''; sel.appendChild(o0);
    C.LANGUES.forEach(function (l) { var o = el('option', null, l); o.value = l; o.selected = a.lang === l; sel.appendChild(o); });
    $('alert-pseudo').value = a.pseudo || '';
    $('alert-vibrate').checked = !!a.vibrate;
    var chips = clear($('alert-on'));
    [['Désactivée', false], ['Activée', true]].forEach(function (x) {
      var b = el('button', 'chip', x[0]); b.type = 'button'; b.setAttribute('aria-pressed', String(!!a.on === x[1]));
      b.addEventListener('click', function () {
        C.saveAlertPrefs({ on: x[1] });
        loadAlertSettings();
        $('alert-msg').textContent = x[1] ? 'Activée. Autorisez le micro et préparez, ci-dessous.' : 'Alerte discrète désactivée.';
      });
      chips.appendChild(b);
    });
    if (!$('alert-msg').textContent) $('alert-msg').textContent = a.on ? (C.dropReady() ? 'Alerte discrète activée et préparée.' : 'Activée, mais pas encore préparée.') : '';
  }
  $('alert-lang').addEventListener('change', function (e) { C.saveAlertPrefs({ lang: e.target.value }); });
  $('alert-pseudo').addEventListener('change', function (e) { C.saveAlertPrefs({ pseudo: e.target.value.trim().slice(0, 30) }); });
  $('alert-vibrate').addEventListener('change', function (e) { C.saveAlertPrefs({ vibrate: e.target.checked }); });
  $('alert-prep').addEventListener('click', function () {
    var msg = $('alert-msg');
    msg.textContent = 'Préparation…';
    var code = $('alert-code').value.trim();
    var mic = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
      ? navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) { s.getTracks().forEach(function (t) { t.stop(); }); return true; }).catch(function () { return false; })
      : Promise.resolve(false);
    mic.then(function (micOk) {
      var vaultP = code ? openVaultWith(code).then(function () { return C.dropReady(); }).catch(function () { return 'code'; }) : Promise.resolve(C.dropReady());
      return vaultP.then(function (vaultOk) {
        $('alert-code').value = '';
        C.saveAlertPrefs({ on: true });
        msg.textContent = '';
        loadAlertSettings();
        if (navigator.vibrate && C.alertPrefs().vibrate) { try { navigator.vibrate(80); } catch (e) { /* ignoré */ } }
        msg.textContent = (micOk ? 'Micro autorisé. ' : 'Micro refusé : l’alerte partira quand même, sans enregistrement. ') +
          (vaultOk === 'code' ? 'Calcul secret incorrect (ou pas encore choisi dans « Mode discret ») : les enregistrements ne seront pas rangés dans « Mes preuves ». ' : vaultOk ? 'Les enregistrements iront, chiffrés, dans « Mes preuves ». ' : 'Saisissez votre calcul secret pour que les enregistrements aillent dans « Mes preuves ». ') +
          'Pour essayer : ouvrez la calculatrice, tapez 3 fois sur la zone des chiffres, puis regardez la console agent.';
      });
    });
  });

  /* =========================================================
     6. Personne de confiance (chiffrée avec le calcul secret)
     ========================================================= */
  var trustVault = null;
  function renderTrustCall(t) {
    var box = clear($('trust-call'));
    if (!t || !t.phone) return;
    var a = el('a', 'btn', 'Appeler ' + (t.name || 'ma personne de confiance') + (t.rel ? ' (' + t.rel + ')' : ''));
    a.href = 'tel:' + t.phone.replace(/[^0-9+]/g, '');
    box.appendChild(a);
  }
  $('trust-open').addEventListener('click', function () {
    $('trust-lock-msg').textContent = 'Ouverture…';
    openVaultWith($('trust-code').value.trim()).then(function (v) {
      trustVault = v; $('trust-code').value = '';
      return C.trustLoad(v);
    }).then(function (t) {
      $('trust-lock').hidden = true; $('trust-body').hidden = false; $('trust-lock-msg').textContent = '';
      t = t || {};
      $('trust-name').value = t.name || ''; $('trust-rel').value = t.rel || ''; $('trust-phone').value = t.phone || '';
      $('trust-share').checked = !!(C.alertPrefs().trusted);
      renderTrustCall(t);
    }).catch(function (e) {
      $('trust-lock-msg').textContent = e && e.message === 'aucun' ? 'Choisissez d’abord votre calcul secret dans « Mode discret ».' : 'Calcul incorrect.';
    });
  });
  $('trust-save').addEventListener('click', function () {
    if (!trustVault) return;
    var t = { name: $('trust-name').value.trim().slice(0, 40), rel: $('trust-rel').value, phone: $('trust-phone').value.trim().slice(0, 20) };
    if (!/^[0-9+ .()-]{8,20}$/.test(t.phone)) { $('trust-msg').textContent = 'Saisissez un numéro de téléphone valable.'; return; }
    C.trustSave(trustVault, t).then(function () {
      C.saveAlertPrefs({ trusted: $('trust-share').checked ? t : null });
      renderTrustCall(t);
      $('trust-msg').textContent = 'Personne de confiance enregistrée' + ($('trust-share').checked ? ', et transmise à l’équipe d’écoute en cas d’alerte discrète.' : '.');
    });
  });
  $('trust-del').addEventListener('click', function () {
    if (!trustVault || !window.confirm('Supprimer votre personne de confiance de ce téléphone ?')) return;
    C.trustSave(trustVault, null).then(function () {
      C.saveAlertPrefs({ trusted: null });
      ['trust-name', 'trust-phone'].forEach(function (id) { $(id).value = ''; }); $('trust-rel').value = ''; $('trust-share').checked = false;
      clear($('trust-call')); $('trust-msg').textContent = 'Supprimée.';
    });
  });

  // Quitter : la session de l'espace (coffre ouvert, conversation) disparaît avec la page.
  window.addEventListener('pagehide', function () { vault = null; stopRecording(true); });
})();

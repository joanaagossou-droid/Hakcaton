/*
 * LIGHT — Alerte discrète en trois appuis (reprise du prototype SafeElle).
 * 3 tapes rapides (moins de 1,5 s) sur la zone d'affichage de la calculatrice :
 *  - l'enregistrement démarre tout de suite, rien ne change à l'écran ;
 *  - 3 nouvelles tapes dans les 5 s : annulation, rien n'est gardé ni envoyé ;
 *  - après 5 s : l'alerte « urgente » est déposée pour la console agent (même navigateur) ;
 *  - l'audio suit par tranches de 10 s ; 3 tapes l'arrêtent (arrêt automatique à 5 min) ;
 *  - une copie chiffrée va dans « Mes preuves » (dépôt par clé publique, code inutile).
 * PROTOTYPE : aucun SMS, aucun appel, aucun service réel n'est contacté.
 */
(function () {
  'use strict';
  var C = window.LIGHT_CORE;
  var screenEl = document.getElementById('screen');
  if (!C || !screenEl) return;

  var QA = { TAPS: 3, WINDOW_MS: 1500, CANCEL_MS: 5000, SLICE_MS: 10000, MAX_MS: 5 * 60000 };
  var AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];
  function mmss(s) { return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); }
  function buzz(pattern) {
    if (C.alertPrefs().vibrate && navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* ignoré */ } }
  }

  var taps = [], run = null;
  screenEl.addEventListener('pointerdown', function () {
    if (!C.alertPrefs().on) return;
    var now = Date.now();
    taps = taps.filter(function (t) { return now - t < QA.WINDOW_MS; });
    taps.push(now);
    if (taps.length < QA.TAPS) return;
    taps = [];
    if (!run) startAlert();
    else if (run.phase === 'armed') cancelAlert(run);
    else if (run.phase === 'sent') stopAlert(run);
  });

  function startAlert() {
    var r = run = { phase: 'armed', t0: Date.now(), tEnd: 0, chunks: [], mime: 'audio/webm', noAudio: false,
      msgId: C.newId(), vaultId: C.newId(), recorder: null, stream: null, queue: Promise.resolve() };
    buzz(80);
    r.cancelTimer = setTimeout(function () { sendAlert(r); }, QA.CANCEL_MS);
    r.maxTimer = setTimeout(function () { stopAlert(r); }, QA.MAX_MS);
    if (!navigator.mediaDevices || !window.MediaRecorder) { r.noAudio = true; return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      if (r.phase === 'cancelled' || r.phase === 'stopped') { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      r.stream = stream;
      var type = AUDIO_TYPES.filter(function (t) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t); })[0];
      var rec = r.recorder = new MediaRecorder(stream, Object.assign({ audioBitsPerSecond: 24000 }, type ? { mimeType: type } : {}));
      r.mime = rec.mimeType || type || 'audio/webm';
      rec.ondataavailable = function (e) {
        if (!e.data || !e.data.size || r.phase === 'cancelled') return;
        r.chunks.push(e.data);
        if (r.phase !== 'armed') persist(r); // pendant le délai d'annulation, rien n'est écrit
      };
      rec.onstop = function () { if (r.phase !== 'cancelled') persist(r); };
      rec.start(QA.SLICE_MS);
    }).catch(function () {
      r.noAudio = true; // micro refusé : l'alerte part quand même, sans enregistrement
      if (r.phase !== 'armed' && r.phase !== 'cancelled') persist(r);
    });
  }
  function releaseMic(r) { if (r.stream) { r.stream.getTracks().forEach(function (t) { t.stop(); }); r.stream = null; } }
  function cancelAlert(r) {
    r.phase = 'cancelled'; r.chunks = [];
    clearTimeout(r.cancelTimer); clearTimeout(r.maxTimer);
    if (r.recorder && r.recorder.state !== 'inactive') r.recorder.stop();
    releaseMic(r);
    if (run === r) run = null;
    buzz([60, 90, 60]);
  }
  function sendAlert(r) {
    if (r.phase !== 'armed') return;
    r.phase = 'sent';
    persist(r);
  }
  function stopAlert(r) {
    if (r.phase !== 'sent') return;
    r.phase = 'stopped'; r.tEnd = Date.now();
    clearTimeout(r.maxTimer);
    if (r.recorder && r.recorder.state !== 'inactive') r.recorder.stop(); else persist(r);
    releaseMic(r);
    if (run === r) run = null;
    buzz(40);
  }
  function flush() { if (run && run.recorder && run.recorder.state === 'recording') { try { run.recorder.requestData(); } catch (e) { /* ignoré */ } } }
  document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });
  window.addEventListener('pagehide', flush);

  function persist(r) { r.queue = r.queue.then(function () { return writeAlert(r); }).catch(function () { /* on réessaiera à la tranche suivante */ }); }
  function writeAlert(r) {
    var a = C.alertPrefs();
    var done = r.phase === 'stopped';
    var blob = r.chunks.length ? new Blob(r.chunks, { type: r.mime }) : null;
    var sec = Math.round(((done ? r.tEnd : Date.now()) - r.t0) / 1000);
    return (blob ? C.fingerprint(blob) : Promise.resolve('')).then(function (sha256) {
      return C.dbGet(r.msgId).then(function (prev) {
        // Les champs remplis par l'agent ne sont jamais écrasés.
        var msg = Object.assign(prev || {
          id: r.msgId, kind: 'alerte', code: '', createdAt: r.t0, alertAt: Date.now(), lang: a.lang || 'Non précisée',
          pseudo: String(a.pseudo || '').slice(0, 30), consent: true, status: 'nouveau', translation: '',
          priority: 'urgente', needs: [], orientation: '', reply: null, listens: [], treatedAt: null
        }, { recording: !done && !r.noAudio, noAudio: r.noAudio, sha256: sha256 });
        if (msg.status !== 'traite') { msg.audio = blob; msg.audioType = r.mime; msg.durationSec = sec; }
        return C.dbPut(msg).then(function () {
          if (!blob || !C.dropReady()) return null;
          return C.dropAdd(r.vaultId, blob, { name: 'alerte-discrete', mime: r.mime, platform: 'Alerte discrète', addedAt: r.t0,
            eventDate: new Date(r.t0).toLocaleString('fr-FR'), note: 'Enregistrement déclenché par 3 appuis (' + mmss(sec) + ')', durationSec: sec, sha256: sha256 });
        });
      });
    });
  }
  window.LIGHT_ALERT = { active: function () { return run ? run.phase : null; } };
})();

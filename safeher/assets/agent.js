/*
 * SafeHer — Console agent de démonstration (reprise simplifiée du prototype SafeElle).
 * Lit les messages vocaux et les alertes enregistrés dans CE navigateur (IndexedDB).
 * Contrôle humain (critère R3) : le repérage de mots SUGGÈRE une priorité, l'agent DÉCIDE.
 * Construite sans insertion HTML.
 */
(function () {
  'use strict';
  var C = window.LIGHT_CORE;
  var $ = function (id) { return document.getElementById(id); };
  if (!C || !$('list')) return;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  function when(t) { return t ? new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'; }
  var NEEDS = ['Écoute et soutien', 'Mise en sécurité', 'Santé', 'Conseil juridique', 'Sécurité numérique et retrait de contenu'];
  var ORIENT = ['Assistance sociale et écoute', 'Assistance médicale', 'Assistance juridique', 'Services de sécurité', 'Assistance numérique', 'Organisations spécialisées'];
  var RANK = { urgente: 0, haute: 1, normale: 2 };
  var selected = null;
  var audioUrl = null;

  function sortItems(items) {
    return items.sort(function (a, b) {
      var ta = a.status === 'traite' ? 1 : 0, tb = b.status === 'traite' ? 1 : 0;
      if (ta !== tb) return ta - tb;
      var ka = a.kind === 'alerte' ? 0 : 1, kb = b.kind === 'alerte' ? 0 : 1;
      if (ka !== kb) return ka - kb;
      var pa = RANK[a.priority] !== undefined ? RANK[a.priority] : 3, pb = RANK[b.priority] !== undefined ? RANK[b.priority] : 3;
      return pa - pb || b.createdAt - a.createdAt;
    });
  }

  function renderKpis(items) {
    var k = clear($('kpis'));
    var langs = {};
    items.forEach(function (m) { langs[m.lang] = (langs[m.lang] || 0) + 1; });
    [[items.length, 'message(s)'], [items.filter(function (m) { return m.kind === 'alerte' && m.status !== 'traite'; }).length, 'alerte(s) en cours'],
     [items.filter(function (m) { return m.priority === 'urgente' && m.status !== 'traite'; }).length, 'urgent(s) à traiter'],
     [items.filter(function (m) { return m.status === 'traite'; }).length, 'traité(s)'],
     [Object.keys(langs).length, 'langue(s)']].forEach(function (x) {
      var d = el('div', 'kpi'); d.appendChild(el('b', null, String(x[0]))); d.appendChild(el('span', null, x[1])); k.appendChild(d);
    });
  }

  function refresh() {
    return C.dbAll().then(function (items) {
      sortItems(items);
      renderKpis(items);
      var list = clear($('list'));
      if (!items.length) { list.appendChild(el('p', 'small', 'Aucun message pour l’instant. Envoyez un message vocal depuis « Mon espace », déclenchez une alerte depuis la calculatrice, ou ajoutez des messages fictifs.')); return; }
      items.forEach(function (m) {
        var b = el('button', 'agent-item' + (m.kind === 'alerte' && m.status !== 'traite' ? ' alert' : '') + (m.status === 'traite' ? ' done' : '') + (selected === m.id ? ' sel' : ''));
        b.type = 'button';
        var top = el('span', 'row');
        top.appendChild(el('span', 'tag' + (m.kind === 'alerte' ? ' red' : ''), m.kind === 'alerte' ? 'ALERTE DISCRÈTE' : m.kind === 'demo' ? 'Message fictif' : 'Message vocal'));
        if (m.priority) top.appendChild(el('span', 'level ' + m.priority, C.LEVEL_LABELS[m.priority]));
        if (m.recording) top.appendChild(el('span', 'tag live', '● enregistrement en cours'));
        if (m.route === 'humain') top.appendChild(el('span', 'tag', 'Écoute humaine directe · ' + m.lang));
        b.appendChild(top);
        b.appendChild(el('span', 'meta', (m.pseudo || 'Sans prénom') + ' · ' + m.lang + ' · ' + when(m.alertAt || m.createdAt) + (m.durationSec ? ' · ' + m.durationSec + ' s' : '')));
        b.appendChild(el('span', 'meta', m.status === 'traite' ? 'Traité' : m.reply ? 'Réponse envoyée' : 'À traiter'));
        b.addEventListener('click', function () { selected = m.id; refresh(); renderDetail(m.id); });
        list.appendChild(b);
      });
    });
  }

  function renderDetail(id) {
    C.dbGet(id).then(function (m) {
      var d = clear($('detail'));
      if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null; }
      if (!m) { d.appendChild(el('p', 'small', 'Message introuvable.')); return; }
      d.appendChild(el('h3', null, m.kind === 'alerte' ? 'Alerte discrète' : m.kind === 'demo' ? 'Message fictif' : 'Message vocal'));
      d.appendChild(el('p', 'small', 'Prénom : ' + (m.pseudo || '—') + ' · Langue : ' + m.lang + ' · Reçu : ' + when(m.alertAt || m.createdAt) + (m.code ? ' · Code de suivi enregistré' : '')));
      if (m.kind === 'alerte') {
        var w = el('div', 'warning-box');
        w.appendChild(el('strong', null, 'Ne jamais rappeler. '));
        w.appendChild(document.createTextNode('La conduite à tenir est convenue à l’avance avec la personne. L’alerte ne contient aucune position ni aucun numéro. ' + (m.recording ? 'Enregistrement en cours : l’audio arrive par tranches de 10 secondes.' : m.noAudio ? 'Micro refusé : alerte sans enregistrement.' : 'Enregistrement terminé.')));
        d.appendChild(w);
        if (m.sha256) d.appendChild(el('p', 'small mono', 'Empreinte SHA-256 : ' + m.sha256));
        if (m.trusted && m.trusted.phone) {
          var tc = el('div', 'ok');
          tc.appendChild(el('strong', null, 'Personne de confiance indiquée par la victime : '));
          tc.appendChild(document.createTextNode((m.trusted.name || '—') + (m.trusted.rel ? ' (' + m.trusted.rel + ')' : '') + ' · ' + m.trusted.phone + '. À prévenir selon la conduite convenue à l’avance.'));
          d.appendChild(tc);
        }
      }
      if (m.route === 'humain') d.appendChild(el('p', 'ok', 'Écoute humaine directe : message en ' + m.lang + (m.lang === 'Français' ? ' sans transcription automatique' : '') + '. À confier à une personne qui parle cette langue.'));
      if (m.transcript) {
        d.appendChild(el('p', 'label', 'Transcription automatique (à vérifier en écoutant)'));
        var tr0 = C.analyze(m.transcript);
        d.appendChild(C.highlightNode(tr0));
        var sp = el('p', 'small'); sp.appendChild(document.createTextNode('Priorité suggérée par le repérage : ')); sp.appendChild(el('span', 'level ' + tr0.level, C.LEVEL_LABELS[tr0.level])); sp.appendChild(document.createTextNode(' — c’est vous qui décidez.')); d.appendChild(sp);
      }
      if (m.audio) {
        audioUrl = URL.createObjectURL(m.audio);
        var au = document.createElement('audio'); au.controls = true; au.src = audioUrl;
        au.addEventListener('play', function () { m.listens = (m.listens || []).concat([Date.now()]); C.dbPut(m); }, { once: true });
        d.appendChild(au);
        d.appendChild(el('p', 'small', 'Journal des écoutes : ' + ((m.listens || []).length ? m.listens.map(when).join(', ') : 'aucune')));
      } else if (m.status === 'traite') d.appendChild(el('p', 'small', 'Audio supprimé après traitement.'));

      // Traduction ou transcription par l'agent, puis repérage des mots
      d.appendChild(el('label', null, 'Traduction ou transcription (par l’agent)'));
      var tr = document.createElement('textarea'); tr.rows = 3; tr.autocomplete = 'off'; tr.value = m.translation || ''; d.appendChild(tr);
      var ana = el('div');
      function analyzeNow() {
        clear(ana);
        if (!tr.value.trim()) return;
        var r = C.analyze(tr.value);
        ana.appendChild(C.highlightNode(r));
        var p = el('p', 'small'); p.appendChild(document.createTextNode('Priorité suggérée par le repérage : ')); p.appendChild(el('span', 'level ' + r.level, C.LEVEL_LABELS[r.level])); p.appendChild(document.createTextNode(' — c’est vous qui décidez.'));
        ana.appendChild(p);
      }
      tr.addEventListener('input', analyzeNow);
      d.appendChild(ana); analyzeNow();

      d.appendChild(el('label', null, 'Priorité décidée par l’agent'));
      var pr = document.createElement('select');
      [['', 'Choisir…'], ['urgente', 'Urgente'], ['haute', 'Haute'], ['normale', 'Normale']].forEach(function (x) { var o = el('option', null, x[1]); o.value = x[0]; o.selected = (m.priority || '') === x[0]; pr.appendChild(o); });
      d.appendChild(pr);

      d.appendChild(el('p', 'label', 'Besoins'));
      var needsBox = el('div');
      NEEDS.forEach(function (n) {
        var l = el('label', 'inline'); var c = document.createElement('input'); c.type = 'checkbox'; c.value = n; c.checked = (m.needs || []).indexOf(n) >= 0;
        l.appendChild(c); l.appendChild(document.createTextNode(' ' + n)); needsBox.appendChild(l);
      });
      d.appendChild(needsBox);

      d.appendChild(el('label', null, 'Orientation'));
      var or = document.createElement('select');
      var o0 = el('option', null, 'Choisir…'); o0.value = ''; or.appendChild(o0);
      ORIENT.forEach(function (x) { var o = el('option', null, x); o.value = x; o.selected = m.orientation === x; or.appendChild(o); });
      d.appendChild(or);

      var rep = null;
      if (m.kind !== 'alerte') {
        d.appendChild(el('label', null, 'Réponse écrite (lue avec le code de suivi)'));
        rep = document.createElement('textarea'); rep.rows = 3; rep.autocomplete = 'off'; rep.value = m.reply ? m.reply.text : ''; d.appendChild(rep);
      }
      var msg = el('p', 'small'); msg.setAttribute('role', 'status');
      function collect() {
        m.translation = tr.value.trim().slice(0, 4000);
        m.priority = pr.value || null;
        m.needs = Array.prototype.slice.call(needsBox.querySelectorAll('input:checked')).map(function (c) { return c.value; });
        m.orientation = or.value;
      }
      var row = el('div', 'actions');
      var save = el('button', 'btn secondary', 'Enregistrer'); save.type = 'button';
      save.addEventListener('click', function () { collect(); C.dbPut(m).then(function () { msg.textContent = 'Enregistré.'; refresh(); }); });
      row.appendChild(save);
      if (rep) {
        var send = el('button', 'btn', 'Envoyer la réponse'); send.type = 'button';
        send.addEventListener('click', function () {
          collect();
          if (!rep.value.trim()) { msg.textContent = 'Écrivez une réponse.'; return; }
          m.reply = { text: rep.value.trim().slice(0, 2000), orientation: m.orientation, at: Date.now() };
          C.dbPut(m).then(function () { msg.textContent = 'Réponse enregistrée : la personne la lira avec son code de suivi. Aucun SMS n’est envoyé.'; refresh(); });
        });
        row.appendChild(send);
      }
      var done = el('button', 'btn secondary', 'Marquer traité (supprime l’audio)'); done.type = 'button';
      done.addEventListener('click', function () {
        collect();
        m.status = 'traite'; m.treatedAt = Date.now(); m.audio = null; m.recording = false;
        C.dbPut(m).then(function () { msg.textContent = 'Traité : l’audio a été supprimé de la console. La copie chiffrée éventuelle reste dans le coffre de la personne.'; refresh(); renderDetail(m.id); });
      });
      row.appendChild(done);
      d.appendChild(row); d.appendChild(msg);
    });
  }

  $('demo-add').addEventListener('click', function () {
    var now = Date.now();
    var demo = [
      { pseudo: 'Étoile', lang: 'Fon', translation: 'Il a pris mon téléphone, il lit tous mes messages et il dit qu’il va publier mes photos si je ne lui envoie pas d’argent.' },
      { pseudo: 'Rosée', lang: 'Yoruba', translation: 'Dans le groupe de la classe, ils m’insultent tous les jours et se moquent de moi.' }
    ];
    Promise.all(demo.map(function (x, i) {
      return C.dbPut({ id: C.newId(), kind: 'demo', code: C.normCode(C.newTrackingCode()), createdAt: now - i * 60000, lang: x.lang, pseudo: x.pseudo, audio: null,
        durationSec: 0, consent: true, status: 'nouveau', translation: x.translation, priority: null, needs: [], orientation: '', reply: null, listens: [], treatedAt: null });
    })).then(refresh);
  });
  $('refresh').addEventListener('click', refresh);
  $('wipe-done').addEventListener('click', function () {
    C.dbAll().then(function (items) { return Promise.all(items.filter(function (m) { return m.status === 'traite'; }).map(function (m) { return C.dbDelete(m.id); })); })
      .then(function () { selected = null; clear($('detail')).appendChild(el('p', 'small', 'Choisissez un message dans la liste.')); refresh(); });
  });
  refresh();
  setInterval(function () { if (!document.hidden) refresh(); }, 4000);
})();

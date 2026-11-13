/* LIGHT — Réglages du mode discret (codes, notification camouflée, effacement). Aucun envoi réseau. */
(function () {
  'use strict';
  var CAMO = window.LIGHT_CAMO;
  var $ = function (id) { return document.getElementById(id); };
  if (!CAMO || !$('camo-form')) return;

  var msg = $('camo-msg');
  function say(text, isError) {
    msg.textContent = text;
    msg.className = isError ? 'result error' : 'result';
    msg.hidden = false;
  }

  function renderChoices() {
    var box = $('notif-choices');
    while (box.firstChild) box.removeChild(box.firstChild);
    var current = CAMO.getPrefs().notif || 'calc';
    CAMO.PRESETS.forEach(function (p) {
      var label = document.createElement('label');
      label.className = 'inline';
      var input = document.createElement('input');
      input.type = 'radio'; input.name = 'notif'; input.value = p.id; input.checked = p.id === current;
      label.appendChild(input);
      label.appendChild(document.createTextNode(p.id === 'aucune' ? ' Rien du tout' : ' ' + p.app + ' : « ' + p.text + ' »'));
      box.appendChild(label);
    });
  }

  function refresh() {
    $('default-warning').hidden = !CAMO.isDefaultCodes();
    renderChoices();
  }

  $('camo-save').addEventListener('click', function () {
    var s = $('secret').value.trim();
    var d = $('decoy').value.trim();
    var notif = (document.querySelector('input[name="notif"]:checked') || {}).value || 'calc';
    var ok = /^\d{4,8}$/;
    if ((s || d) && !(ok.test(s) && ok.test(d))) { say('Les deux codes doivent contenir de 4 à 8 chiffres.', true); return; }
    if (s && s === d) { say('Le code secret et le code leurre doivent être différents.', true); return; }
    var p = CAMO.getPrefs();
    p.notif = notif;
    CAMO.setPrefs(p);
    var done = function () {
      $('secret').value = ''; $('decoy').value = '';
      refresh();
      say(s ? 'Codes et réglages enregistrés. Retenez bien votre code secret.' : 'Réglages enregistrés.');
    };
    if (!s) { done(); return; }
    var CORE = window.LIGHT_CORE;
    var current = $('current') ? $('current').value.trim() : '';
    // Si des preuves existent, le coffre doit être re-chiffré avec le nouveau code (sinon elles deviendraient illisibles).
    var vaultStep = Promise.resolve(null);
    if (CORE && CORE.vaultExists()) {
      if (!current) { say('Vous avez des preuves : saisissez d’abord votre code secret actuel.', true); return; }
      vaultStep = CAMO.checkCode(current).then(function (r) {
        if (r !== 'secret') throw new Error('code');
        return CORE.openVault(current);
      });
    }
    vaultStep.then(function (vault) {
      return CAMO.setCodes(s, d).then(function () { return vault ? CORE.rewrapVault(vault, s) : null; });
    }).then(function () {
      var q = CAMO.getPrefs(); q.custom = true; q.notif = notif; CAMO.setPrefs(q);
      if ($('current')) $('current').value = '';
      done();
    }).catch(function (e) {
      say(e && e.message === 'code' ? 'Code secret actuel incorrect : rien n’a été changé.' : 'Enregistrement impossible sur ce navigateur.', true);
    });
  });

  $('camo-wipe').addEventListener('click', function () {
    if (!window.confirm('Effacer les codes, les réglages, les messages et les preuves de Light sur ce téléphone ?')) return;
    var CORE = window.LIGHT_CORE;
    (CORE ? CORE.wipeAll() : Promise.resolve()).then(function () {
      CAMO.wipe();
      refresh();
      say('Tout est effacé : codes, réglages, messages et preuves. Les codes de démonstration sont de nouveau actifs.');
    });
  });

  refresh();
})();

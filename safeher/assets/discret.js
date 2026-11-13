/* SafeHer — Réglages du mode discret : calcul secret et calcul leurre choisis par la personne,
   notification camouflée, effacement. Aucun envoi réseau. */
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
    var ok = CAMO.isConfigured();
    $('current-wrap').hidden = !ok;
    $('setup-title').textContent = ok ? '1. Votre calcul secret est choisi' : '1. Choisissez votre calcul secret';
    $('setup-status').textContent = ok
      ? 'La calculatrice s’ouvre avec votre calcul secret. Vous pouvez le changer ci-dessous (il faut alors saisir l’actuel).'
      : 'Aucun calcul secret n’est encore choisi : pour l’instant, la calculatrice n’ouvre rien. Choisissez-le ci-dessous.';
    renderChoices();
  }

  $('camo-save').addEventListener('click', function () {
    var s = $('secret').value.trim();
    var s2 = $('secret2').value.trim();
    var d = $('decoy').value.trim();
    var notif = (document.querySelector('input[name="notif"]:checked') || {}).value || 'calc';
    var p = CAMO.getPrefs(); p.notif = notif; CAMO.setPrefs(p);
    if (!s && !d) { say('Réglages enregistrés.'); return; }
    if (!s) { say('Saisissez votre calcul secret (vous pouvez garder le même).', true); return; }
    var err = CAMO.validCalc(s);
    if (err) { say(err, true); return; }
    if (CAMO.normalizeCalc(s) !== CAMO.normalizeCalc(s2)) { say('Les deux saisies du calcul secret ne sont pas identiques.', true); return; }
    if (d) {
      var errD = CAMO.validCalc(d);
      if (errD) { say('Calcul leurre : ' + errD, true); return; }
      if (CAMO.normalizeCalc(d) === CAMO.normalizeCalc(s)) { say('Le calcul leurre doit être différent du calcul secret.', true); return; }
    }
    var CORE = window.LIGHT_CORE;
    var current = $('current').value.trim();
    // Si un calcul existe déjà, il faut le connaître pour le changer ; si des preuves existent,
    // le coffre est re-chiffré avec le nouveau calcul (sinon elles deviendraient illisibles).
    var step = Promise.resolve(null);
    if (CAMO.isConfigured()) {
      if (!current) { say('Saisissez d’abord votre calcul secret actuel.', true); return; }
      step = CAMO.checkCode(current).then(function (r) {
        if (r !== 'secret') throw new Error('code');
        return CORE && CORE.vaultExists() ? CORE.openVault(CAMO.normalizeCalc(current)) : null;
      });
    } else if (CORE && CORE.vaultExists()) {
      say('Des preuves existent déjà sur ce téléphone avec un ancien code : effacez tout ci-dessous avant de choisir un nouveau calcul.', true);
      return;
    }
    step.then(function (vault) {
      return CAMO.setCodes(s, d || '').then(function () { return vault ? CORE.rewrapVault(vault, CAMO.normalizeCalc(s)) : null; });
    }).then(function () {
      ['current', 'secret', 'secret2', 'decoy'].forEach(function (id) { $(id).value = ''; });
      refresh();
      say('Calcul secret enregistré. Ouvrez la calculatrice, tapez-le puis « = » pour ouvrir SafeHer. Retenez-le bien.');
    }).catch(function (e) {
      say(e && e.message === 'code' ? 'Calcul secret actuel incorrect : rien n’a été changé.' : 'Enregistrement impossible sur ce navigateur.', true);
    });
  });

  $('camo-wipe').addEventListener('click', function () {
    if (!window.confirm('Effacer votre calcul secret, les réglages, les messages et les preuves de SafeHer sur ce téléphone ?')) return;
    var CORE = window.LIGHT_CORE;
    (CORE ? CORE.wipeAll() : Promise.resolve()).then(function () {
      CAMO.wipe();
      refresh();
      say('Tout est effacé : calcul secret, réglages, messages et preuves.');
    });
  });

  refresh();
})();

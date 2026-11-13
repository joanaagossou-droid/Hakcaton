/*
 * LIGHT — Correctifs du kit NUKUN appliqués (aucune dépendance, aucun appel réseau).
 *  1. Sortie rapide (K-EXIT) : bouton [data-quick-exit] + touche Échap.
 *  2. Bandeau « appareil surveillé ? » (K-BANNER) : masquable pour la session seulement.
 *  3. Formulaire minimal (K-FORM) : anonyme par défaut, rien n'est envoyé ni enregistré.
 */
(function () {
  'use strict';

  // ---- 1. Sortie rapide -------------------------------------------------
  // Page neutre externe : une recherche météo. Elle est configurable.
  var NEUTRAL_URL = 'https://www.google.com/search?q=m%C3%A9t%C3%A9o';

  function quickExit() {
    // Masquer immédiatement le contenu, avant même la redirection.
    document.documentElement.classList.add('exiting');
    document.title = 'Météo';
    try { sessionStorage.clear(); } catch (e) { /* ignoré */ }
    // Remplace l'entrée courante de l'historique : « Retour » ne ramène pas ici.
    window.location.replace(NEUTRAL_URL);
  }
  window.LIGHT_QUICK_EXIT = quickExit;

  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-quick-exit]') : null;
    if (t) { e.preventDefault(); quickExit(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Esc') quickExit();
  });

  // ---- 2. Bandeau d'avertissement ---------------------------------------
  var warning = document.getElementById('device-warning');
  if (warning) {
    var dismissed = false;
    try { dismissed = sessionStorage.getItem('light-warning') === 'vu'; } catch (e) { /* ignoré */ }
    if (dismissed) warning.hidden = true;
    var btn = warning.querySelector('[data-dismiss-warning]');
    if (btn) btn.addEventListener('click', function () {
      warning.hidden = true;
      try { sessionStorage.setItem('light-warning', 'vu'); } catch (e) { /* ignoré */ }
    });
  }

  // ---- 3. Formulaire minimal --------------------------------------------
  var form = document.getElementById('light-form');
  if (!form) return;
  var zone = document.getElementById('contact-zone');
  var send = document.getElementById('light-send');
  var out = document.getElementById('light-result');
  var consent = document.getElementById('consent');

  form.addEventListener('change', function (e) {
    if (e.target && e.target.name === 'recontact' && zone) zone.hidden = e.target.value !== 'oui';
  });

  function code() {
    var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var bytes = new Uint8Array(8);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    var s = '';
    for (var i = 0; i < bytes.length; i++) { s += alphabet[bytes[i] % alphabet.length]; if (i === 3) s += '-'; }
    return 'LGT-' + s;
  }

  function show(lines) {
    while (out.firstChild) out.removeChild(out.firstChild);
    lines.forEach(function (l) {
      var p = document.createElement('p');
      if (l.strong) { var b = document.createElement('strong'); b.textContent = l.text; p.appendChild(b); }
      else p.textContent = l.text;
      if (l.cls) p.className = l.cls;
      out.appendChild(p);
    });
    out.hidden = false;
    out.focus && out.setAttribute('tabindex', '-1');
    out.focus && out.focus();
  }

  send.addEventListener('click', function () {
    if (!consent.checked) {
      show([
        { text: 'Pour envoyer, cochez la case d\'accord. Rien n\'est obligatoire d\'autre.' },
        { text: 'Démonstration uniquement : aucune information n\'a été envoyée ni enregistrée.', cls: 'demo' }
      ]);
      consent.focus();
      return;
    }
    var c = code();
    form.reset();
    if (zone) zone.hidden = true;
    show([
      { text: 'Votre code de suivi anonyme : ' + c, strong: true },
      { text: 'Prochaine étape (dans un vrai service) : une personne de l\'équipe d\'écoute lit votre message sous 48 heures. Pour suivre votre demande, revenez avec ce code. Aucun SMS ni courriel ne vous sera envoyé.' },
      { text: 'Notez ce code dans un endroit sûr, ou retenez-le.' },
      { text: 'Démonstration uniquement : aucune information n\'a été envoyée ni enregistrée.', cls: 'demo' }
    ]);
  });
})();

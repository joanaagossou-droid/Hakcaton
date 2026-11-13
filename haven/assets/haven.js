/*
 * HAVEN — Comportement du formulaire de démonstration.
 * Aucune donnée n'est envoyée ni enregistrée : le formulaire n'a pas d'action,
 * le bouton n'est pas de type « submit », et le contenu des champs n'est jamais lu.
 * Défaut volontaire R1/R4 : l'envoi est bloqué tant que tous les champs (dont la
 * pièce jointe) ne sont pas remplis, puis aucune suite n'est indiquée.
 */
(function () {
  var form = document.getElementById('haven-form');
  var btn = document.getElementById('haven-send');
  var out = document.getElementById('haven-result');
  if (!form || !btn || !out) return;
  btn.addEventListener('click', function () {
    if (!form.checkValidity()) {
      form.reportValidity();
      out.textContent = 'Erreur : tous les champs sont obligatoires, y compris la preuve. Démonstration uniquement : aucune information n\'a été envoyée ni enregistrée.';
      return;
    }
    form.reset();
    out.textContent = 'Merci, votre demande a été prise en compte. (Démonstration uniquement : aucune information n\'a été envoyée ni enregistrée.)';
  });
})();

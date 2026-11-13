/* NUKUN — Applique le thème choisi (clair / sombre / système) avant l'affichage.
   Préférence purement locale (localStorage), jamais transmise. */
(function () {
  var t = null;
  try { t = localStorage.getItem('nukun.theme'); } catch (e) { /* stockage indisponible */ }
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
})();

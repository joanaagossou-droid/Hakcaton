/*
 * HAVEN — TRACEUR D'AUDIENCE SIMULÉ (défaut volontaire C1 / C5 pour la démonstration).
 *
 * Ce fichier reproduit la SIGNATURE de code d'un traceur de mesure d'audience
 * courant (fonction gtag et tableau dataLayer) pour que NUKUN puisse le détecter.
 * Il ne charge AUCUN script externe et n'envoie AUCUNE donnée : pas de requête
 * réseau, pas d'image espion, pas de balise. La Content-Security-Policy de HAVEN
 * (connect-src 'self', img-src 'self') l'interdirait de toute façon.
 *
 * Seul effet : un cookie local « _ga » fictif est écrit au chargement, avant
 * tout consentement, pour illustrer le défaut « cookie déposé d'office ».
 */
window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-DEMO-FICTIF');

(function () {
  try {
    if (document.cookie.indexOf('_ga=') === -1) {
      document.cookie = '_ga=GA1.1.demo-fictif.' + Date.now() + '; path=/haven/; max-age=86400; SameSite=Lax';
    }
  } catch (e) { /* ignoré */ }
  if (window.console && console.info) {
    console.info('[HAVEN] Traceur SIMULÉ : aucune donnée n\'a été transmise à un tiers.');
  }
})();

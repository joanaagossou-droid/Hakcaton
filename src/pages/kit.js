/** NUKUN — Kit de correctifs Safety by Design (module 4). */
import { h, toast, mount } from '../utils/dom.js';

export function renderKit(ctx) {
  const { data } = ctx;
  return h('div', { class: 'stack' },
    h('h1', null, 'Kit de correctifs Safety by Design'),
    h('p', { class: 'muted' }, 'Des solutions prêtes à l\'emploi, chacune avec son risque, sa solution, un exemple, du code et ses limites. Chaque critère non conforme d\'un rapport renvoie ici.'),
    h('div', { class: 'grid two' }, data.corrections.map((k) => h('article', { class: 'card' },
      h('div', { class: 'row between' }, h('h2', null, k.title), h('span', { class: 'badge outline' }, `Effort ${k.effort}`)),
      h('p', null, h('b', null, 'Risque : '), k.risk),
      h('p', { class: 'small' }, h('b', null, 'Critères : '), k.criteria.join(', ')),
      h('a', { class: 'btn small', href: `#/kit/${k.id}` }, 'Voir le correctif')))));
}

export function renderCorrection(ctx, id) {
  const { data } = ctx;
  const k = data.corrections.find((x) => x.id === id);
  if (!k) throw new Error('Correctif introuvable.');
  const crits = k.criteria.map((cid) => data.criteria.find((c) => c.id === cid)).filter(Boolean);
  const code = h('pre', { class: 'code', tabindex: '0', 'aria-label': 'Exemple de code' }, k.code);
  return h('div', { class: 'stack' },
    h('p', null, h('a', { href: '#/kit' }, '← Tout le kit')),
    h('h1', null, k.title),
    h('div', { class: 'grid two' },
      h('section', { class: 'panel' },
        h('h2', null, 'Risque concerné'), h('p', null, k.risk),
        h('h2', null, 'Problème'), h('p', null, k.problem),
        h('h2', null, 'Solution proposée'), h('p', null, k.solution),
        h('h2', null, 'Critères concernés'), h('ul', null, crits.map((c) => h('li', null, h('b', null, c.id), ' ', c.name, c.blocking ? ' (bloquant)' : ''))),
        h('h2', null, 'Limites de la solution'), h('p', { class: 'notice warn' }, k.limits)),
      h('section', { class: 'panel' },
        h('h2', null, 'Exemple visuel'),
        demo(k.demo),
        h('h2', null, 'Exemple de code'),
        code,
        h('button', { type: 'button', class: 'btn small secondary', onclick: async () => { try { await navigator.clipboard.writeText(k.code); toast('Code copié.', 'ok'); } catch { toast('Copie impossible : sélectionnez le texte manuellement.', 'warn'); } } }, 'Copier le code'))));
}

/** Démonstrations interactives : elles restent dans la page et n'envoient rien. */
function demo(kind) {
  const box = h('div', { class: 'demo-box' });
  if (kind === 'exit') {
    const show = () => mount(box,
      h('p', null, h('b', null, 'Page sensible (simulation) : '), 'formulaire de demande d\'aide…'),
      h('button', { type: 'button', class: 'btn', style: { background: '#b3261e', 'border-color': '#b3261e' }, onclick: leave }, 'Quitter ✕'),
      h('p', { class: 'small muted' }, 'Ou appuyez sur la touche Échap pendant que ce cadre a le focus.'));
    const leave = () => mount(box,
      h('p', null, h('b', null, 'Météo · Cotonou'), ' — 31 °C, ciel dégagé (page neutre simulée)'),
      h('p', { class: 'small muted' }, 'Sur un vrai site, location.replace() remplace la page dans l\'historique : « Retour » ne ramène pas à la page sensible.'),
      h('button', { type: 'button', class: 'btn small secondary', onclick: show }, 'Recommencer la démonstration'));
    box.tabIndex = 0;
    box.addEventListener('keydown', (e) => { if (e.key === 'Escape') leave(); });
    show();
    return h('div', null, box, h('p', null, h('a', { href: 'light/', target: '_blank', rel: 'noopener' }, 'Essayer la vraie sortie rapide sur LIGHT (site fictif)')));
  }
  if (kind === 'discreet') {
    return mount(box, h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, 'À éviter'), h('th', null, 'Recommandé'))),
      h('tbody', null,
        h('tr', null, h('td', null, '« Signaler une violence »'), h('td', null, '« Light · Formulaire »')),
        h('tr', null, h('td', null, 'Icône « SOS » ou cœur brisé'), h('td', null, 'Icône neutre (soleil, feuille)')),
        h('tr', null, h('td', null, 'SMS « Votre signalement est reçu »'), h('td', null, 'Code de suivi affiché à l\'écran seulement')),
        h('tr', null, h('td', null, 'Adresse /signaler-violence.html'), h('td', null, 'Adresse /ecrire.html')))));
  }
  if (kind === 'banner') {
    const show = () => mount(box, h('div', { class: 'notice' },
      h('p', null, h('b', null, 'Votre appareil est-il sûr ? '), 'Un téléphone peut être surveillé par un proche (code connu, compte partagé, logiciel espion). Si possible, utilisez un appareil de confiance et la navigation privée.'),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small', onclick: () => mount(box, h('p', { class: 'small muted' }, 'Bandeau masqué pour la session.'), h('button', { type: 'button', class: 'btn small secondary', onclick: show }, 'Réafficher')) }, 'Continuer'), h('a', { href: '#/kit/K-EXIT' }, 'Conseils de sécurité'))));
    show();
    return box;
  }
  if (kind === 'form') {
    const out = h('div', { role: 'status', 'aria-live': 'polite' });
    const consent = h('input', { type: 'checkbox', id: 'demo-consent' });
    const msg = h('textarea', { id: 'demo-msg', autocomplete: 'off', rows: 3 });
    return mount(box,
      h('label', { class: 'field', for: 'demo-msg' }, 'Votre message (facultatif)'), msg,
      h('fieldset', null, h('legend', null, 'Être recontactée ?'), h('label', { class: 'choice' }, h('input', { type: 'radio', name: 'demo-rc', checked: true }), 'Non, je reste anonyme'), h('label', { class: 'choice' }, h('input', { type: 'radio', name: 'demo-rc' }), 'Oui, par un moyen que je choisis')),
      h('label', { class: 'choice' }, consent, h('span', null, 'J\'accepte que mon message soit lu par l\'équipe d\'écoute (révocable).')),
      h('button', { type: 'button', class: 'btn small', onclick: () => {
        mount(out, consent.checked
          ? h('p', { class: 'notice' }, h('b', null, 'Code de suivi : DEMO-0000. '), 'Prochaine étape et délai affichés ici. ', h('b', null, 'Démonstration uniquement : aucune information n\'a été envoyée ni enregistrée.'))
          : h('p', { class: 'notice warn' }, 'Cochez la case d\'accord pour envoyer. Démonstration uniquement : aucune information n\'a été envoyée ni enregistrée.'));
        msg.value = '';
      } }, 'Envoyer'), out);
  }
  if (kind === 'privacy') {
    return mount(box, h('ol', { class: 'small' },
      ['Ce que nous collectons', 'Qui peut lire (fonction, pas de nom)', 'Combien de temps nous gardons les données', 'Où elles sont stockées', 'Comment les supprimer', 'Les limites de la confidentialité (mineurs, danger immédiat, obligation légale)', 'Ce que nous ne faisons jamais'].map((x) => h('li', null, x))),
      h('p', null, h('a', { href: 'light/confidentialite.html', target: '_blank', rel: 'noopener' }, 'Voir le modèle appliqué sur LIGHT')));
  }
  if (kind === 'evidence') {
    return mount(box,
      h('p', null, h('b', null, 'Conserver des éléments, si vous le souhaitez'), ' (c\'est un choix, jamais une obligation) :'),
      h('ul', { class: 'small' },
        h('li', null, 'Ce qui peut être utile : messages, images, liens, noms de profils, dates et heures.'),
        h('li', null, 'Comment : captures d\'écran, export des discussions, journal daté.'),
        h('li', null, 'Où : sur un support que vous êtes seul·e à contrôler. Attention à la galerie et au cloud synchronisés, visibles depuis un autre appareil.'),
        h('li', null, 'Pour la valeur juridique : demander conseil à une assistance juridique.')));
  }
  if (kind === 'orientation') {
    return mount(box,
      h('div', { class: 'grid two' }, ['Assistance sociale', 'Assistance médicale', 'Assistance juridique', 'Services de sécurité', 'Assistance numérique', 'Organisations spécialisées'].map((c) => h('div', { class: 'kpi' }, h('b', null, c), h('p', { class: 'small muted' }, 'Contact : [à vérifier auprès d\'une source institutionnelle — non publié]')))),
      h('p', { class: 'small notice warn' }, 'NUKUN ne publie aucun numéro : chaque contact doit être vérifié (validité, attribution, actualité au Bénin) avant publication.'));
  }
  if (kind === 'trackers' || kind === 'headers') {
    return mount(box, h('p', null, 'Vérification : relancez l\'analyse NUKUN de votre site. Les constats « Traceurs », « Pixels », « Ressources tierces » et « En-têtes de sécurité » doivent passer au vert.'),
      h('p', { class: 'small muted' }, 'Sur ordinateur, l\'onglet « Réseau » des outils de développement ne doit montrer aucune requête vers un autre domaine.'));
  }
  return mount(box, h('p', null, 'Budget : moins de 150 Ko par page, aucune police externe, utilisable en moins de 5 secondes en 3G lente. Test de prise en main avec des personnes extérieures à l\'équipe, documenté.'));
}

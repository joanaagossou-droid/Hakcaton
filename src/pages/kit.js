/**
 * NUKUN — Kit de correctifs Safety by Design (module 4).
 * Rédigé en français simple pour toute personne qui audite un outil : pas d'exemple de code,
 * pas de jargon technique. Pour chaque correctif : le risque, le problème, la solution,
 * comment vérifier, une illustration et les limites.
 */
import { h, mount } from '../utils/dom.js';

export function renderKit(ctx) {
  const { data } = ctx;
  return h('div', { class: 'stack' },
    h('h1', null, 'Kit de correctifs'),
    h('p', { class: 'muted' }, 'Pour chaque problème repéré pendant un audit : le risque pour la personne aidée, la solution à demander à l\'équipe qui gère l\'outil, et comment vérifier qu\'elle est bien appliquée. Chaque critère non conforme d\'un rapport renvoie ici.'),
    h('div', { class: 'grid two' }, data.corrections.map((k) => h('article', { class: 'card' },
      h('div', { class: 'row between' }, h('h2', null, k.title), h('span', { class: 'badge outline' }, `Effort ${k.effort}`)),
      h('p', null, h('b', null, 'Risque : '), k.risk),
      h('p', { class: 'small muted' }, h('b', null, 'Critères : '), k.criteria.join(', ')),
      h('a', { class: 'btn small', href: `#/kit/${k.id}` }, 'Voir le correctif')))));
}

export function renderCorrection(ctx, id) {
  const { data } = ctx;
  const k = data.corrections.find((x) => x.id === id);
  if (!k) throw new Error('Correctif introuvable.');
  const crits = k.criteria.map((cid) => data.criteria.find((c) => c.id === cid)).filter(Boolean);
  return h('div', { class: 'stack' },
    h('p', null, h('a', { href: '#/kit' }, '← Tout le kit')),
    h('h1', null, k.title),
    h('div', { class: 'grid two' },
      h('section', { class: 'panel' },
        h('h2', null, 'Le risque'), h('p', null, k.risk),
        h('h2', null, 'Le problème'), h('p', null, k.problem),
        h('h2', null, 'La solution'), h('p', null, k.solution),
        h('h2', null, 'Critères concernés'), h('ul', null, crits.map((c) => h('li', null, h('b', null, c.id), ' ', c.name, c.blocking ? ' (bloquant)' : ''))),
        h('h2', null, 'Les limites'), h('p', { class: 'notice warn' }, k.limits)),
      h('section', { class: 'panel' },
        h('h2', null, 'Comment vérifier'),
        h('ol', { class: 'checklist' }, (k.check || []).map((c) => h('li', null, c))),
        h('h2', null, 'Illustration'),
        demo(k.demo))));
}

/** Illustrations interactives : elles restent dans la page et n'envoient rien. */
function demo(kind) {
  const box = h('div', { class: 'demo-box' });
  if (kind === 'exit') {
    const show = () => mount(box,
      h('p', null, h('b', null, 'Page d\'aide (simulation) : '), 'formulaire de demande d\'aide…'),
      h('button', { type: 'button', class: 'btn', style: { background: '#b3261e', 'border-color': '#b3261e' }, onclick: leave }, 'Quitter ✕'));
    const leave = () => mount(box,
      h('p', null, h('b', null, 'Météo · Cotonou'), ' — 31 °C, ciel dégagé (page neutre simulée)'),
      h('p', { class: 'small muted' }, 'Sur un vrai site, la page d\'aide est remplacée : le bouton « Retour » n\'y ramène pas.'),
      h('button', { type: 'button', class: 'btn small secondary', onclick: show }, 'Recommencer'));
    show();
    return box;
  }
  if (kind === 'discreet') {
    return mount(box, h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, 'À éviter'), h('th', null, 'Préférable'))),
      h('tbody', null,
        h('tr', null, h('td', null, 'Titre de page « Signaler une violence »'), h('td', null, 'Titre neutre, par exemple « Formulaire »')),
        h('tr', null, h('td', null, 'Icône « SOS » ou cœur brisé'), h('td', null, 'Icône neutre')),
        h('tr', null, h('td', null, 'SMS « Votre signalement est reçu »'), h('td', null, 'Code de suivi affiché à l\'écran seulement')),
        h('tr', null, h('td', null, 'Application installée « Aide violences »'), h('td', null, 'Apparence d\'une autre application (calculatrice), ouverte par un calcul secret')))));
  }
  if (kind === 'banner') {
    const show = () => mount(box, h('div', { class: 'notice' },
      h('p', null, h('b', null, 'Votre appareil est-il sûr ? '), 'Un téléphone peut être surveillé par un proche (code connu, compte partagé, logiciel espion). Si possible, utilisez un appareil de confiance et la navigation privée.'),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn small', onclick: () => mount(box, h('p', { class: 'small muted' }, 'Message masqué.'), h('button', { type: 'button', class: 'btn small secondary', onclick: show }, 'Réafficher')) }, 'Continuer'))));
    show();
    return box;
  }
  if (kind === 'form') {
    const out = h('div', { role: 'status', 'aria-live': 'polite' });
    const consent = h('input', { type: 'checkbox', id: 'demo-consent' });
    const msg = h('textarea', { id: 'demo-msg', autocomplete: 'off', rows: 3 });
    return mount(box,
      h('label', { class: 'field', for: 'demo-msg' }, 'Votre message (facultatif)'), msg,
      h('fieldset', null, h('legend', null, 'Pour qui demandez-vous de l\'aide ?'), h('label', { class: 'choice' }, h('input', { type: 'radio', name: 'demo-who', checked: true }), 'Pour moi'), h('label', { class: 'choice' }, h('input', { type: 'radio', name: 'demo-who' }), 'Pour une autre personne (témoin, voisin, proche)')),
      h('label', { class: 'choice' }, consent, h('span', null, 'J\'accepte que mon message soit lu par l\'équipe d\'écoute.')),
      h('button', { type: 'button', class: 'btn small', onclick: () => {
        mount(out, consent.checked
          ? h('p', { class: 'notice' }, h('b', null, 'Code de suivi : DEMO-0000. '), 'Une personne lira votre message sous 48 heures. ', h('b', null, 'Illustration : rien n\'a été envoyé.'))
          : h('p', { class: 'notice warn' }, 'Cochez la case d\'accord pour envoyer. Illustration : rien n\'a été envoyé.'));
        msg.value = '';
      } }, 'Envoyer'), out);
  }
  if (kind === 'privacy') {
    return mount(box, h('ol', { class: 'small' },
      ['Ce que nous collectons', 'Qui peut lire (une fonction, pas un nom)', 'Combien de temps nous le gardons', 'Où c\'est gardé', 'Comment le supprimer', 'Les limites de la confidentialité (personne mineure en danger, vie menacée, obligation légale)'].map((x) => h('li', null, x))));
  }
  if (kind === 'evidence') {
    return mount(box,
      h('p', null, h('b', null, 'Garder des éléments, si vous le souhaitez'), ' (c\'est un choix, jamais une obligation) :'),
      h('ul', { class: 'small' },
        h('li', null, 'Ce qui peut être utile : messages, images, liens, noms de profils, dates et heures.'),
        h('li', null, 'Comment : captures d\'écran, journal daté.'),
        h('li', null, 'Où : à un endroit que vous êtes seul·e à contrôler. Attention à la galerie et aux comptes partagés.'),
        h('li', null, 'Pour la valeur devant la justice : demander conseil à une assistance juridique.')));
  }
  if (kind === 'orientation') {
    return mount(box,
      h('div', { class: 'grid two' }, ['Écoute et soutien', 'Santé', 'Aide juridique', 'Sécurité (police, pompiers)', 'Aide numérique', 'Associations spécialisées'].map((c) => h('div', { class: 'kpi' }, h('b', null, c), h('p', { class: 'small muted' }, 'Numéro appelable d\'un appui, avec sa source et sa date de vérification')))),
      h('p', { class: 'small' }, 'Un numéro n\'est publié que s\'il a été vérifié auprès d\'une source officielle.'));
  }
  if (kind === 'trackers' || kind === 'headers') {
    return mount(box, h('p', null, 'Relancez l\'analyse automatique de NUKUN sur l\'outil corrigé : les constats concernés doivent passer au vert.'));
  }
  return mount(box, h('p', null, 'Objectif : une page utilisable en moins de 5 secondes avec une connexion faible, et un essai avec des personnes extérieures à l\'équipe.'));
}

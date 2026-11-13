/** NUKUN — Accueil, tableau de bord, méthode, confidentialité, partage. */
import { h, fmtDate, toast, download } from '../utils/dom.js';
import * as store from '../utils/store.js';
import { computeScore, priorityRisks, correctionPlan, BLOCKING_CAP } from '../modules/scoring/scoring.js';
import { sanitizeImported, AUDIT_TYPES } from '../modules/audit-engine/audit-engine.js';
import { lightPill, auditTypeBadge, disclaimer } from '../components/ui.js';
import { qrSvg } from '../utils/qr.js';
import { loadSnapshot } from '../modules/url-analyzer/client.js';
import { go, refresh } from '../app.js';

function eyeSvg(cls) {
  return h('svg', { class: cls, viewBox: '0 0 100 100', 'aria-hidden': 'true' },
    h('path', { d: 'M5 50 C25 18 75 18 95 50 C75 82 25 82 5 50 Z', fill: 'none', stroke: '#fff', 'stroke-width': 5 }),
    h('circle', { cx: 50, cy: 50, r: 17, fill: 'none', stroke: '#fff', 'stroke-width': 5 }),
    h('circle', { cx: 50, cy: 50, r: 6, fill: '#fff' }));
}

/** Motif d'iris (l'œil de NUKUN) : anneaux concentriques et rayons, en SVG. */
function irisSvg() {
  const rings = [];
  for (let r = 60; r <= 520; r += 26) rings.push(h('circle', { cx: 550, cy: 550, r, fill: 'none', stroke: r % 104 === 60 ? '#2ee6c9' : '#2a3a5c', 'stroke-opacity': r % 104 === 60 ? 0.35 : 0.5, 'stroke-width': 1 }));
  const rays = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    rays.push(h('line', { x1: (550 + Math.cos(a) * 70).toFixed(1), y1: (550 + Math.sin(a) * 70).toFixed(1), x2: (550 + Math.cos(a) * 200).toFixed(1), y2: (550 + Math.sin(a) * 200).toFixed(1), stroke: '#2ee6c9', 'stroke-opacity': i % 6 === 0 ? 0.35 : 0.12, 'stroke-width': 1 }));
  }
  return h('svg', { class: 'iris', viewBox: '0 0 1100 1100', 'aria-hidden': 'true' }, ...rings, ...rays, h('circle', { cx: 550, cy: 550, r: 30, fill: '#2ee6c9', 'fill-opacity': 0.12 }));
}

const SCAN_ORDER = ['trackers', 'quick-exit', 'required-ident', 'cookies-consent', 'phones', 'privacy', 'weight', 'https'];

/** Fenêtre « analyse » : affiche les VRAIS constats de l'instantané d'analyse de HAVEN. */
function scanWindow(snapshot) {
  const lines = [];
  if (snapshot) {
    const byId = Object.fromEntries(snapshot.findings.map((f) => [f.id, f]));
    const bad = { trackers: 'detected', 'required-ident': 'detected', 'cookies-consent': 'detected' };
    SCAN_ORDER.forEach((id, i) => {
      const f = byId[id];
      if (!f) return;
      const isBad = bad[id] ? f.status === bad[id] : f.status !== 'detected';
      const cls = f.status === 'partial' ? 'part' : isBad ? 'bad' : 'ok';
      lines.push(h('div', { class: 'scan-line', style: { 'animation-delay': `${120 + i * 110}ms` } },
        h('span', { class: ['k', cls] }, cls === 'ok' ? '✓' : cls === 'part' ? '~' : '✗'),
        h('span', null, f.label, h('br'), h('small', null, f.evidence.length > 64 ? f.evidence.slice(0, 62) + '…' : f.evidence)),
        h('span', { class: 'scan-crit' }, (f.criteria || []).join(' '))));
    });
  }
  return h('div', { class: 'scan', role: 'img', 'aria-label': 'Extrait réel de l\'analyse automatique de HAVEN, site fictif' },
    h('div', { class: 'scan-top' }, h('i'), h('i'), h('i'), h('b', null, 'Analyse passive · HAVEN')),
    h('div', { class: 'scan-body' }, lines.length ? lines : h('p', null, 'Analyse indisponible.')),
    h('div', { class: 'scan-foot' },
      h('span', null, snapshot ? `Instantané réel du ${fmtDate(snapshot.analyzedAt).slice(0, 10)} · site fictif` : ''),
      h('a', { href: '#/comparer' }, 'Score calculé en direct →')));
}

export async function renderHome(ctx) {
  const { t } = ctx;
  const current = store.currentAuditId();
  const cur = current ? store.getAudit(current) : null;
  const snapshot = await loadSnapshot('haven');
  const ref = ctx.data.referential;
  return h('div', null,
    h('section', { class: 'hero' },
      irisSvg(),
      h('div', null,
        h('span', { class: 'eyebrow' }, h('span', { class: 'dot' }), 'Safety by Design · VBG-FT'),
        h('h1', { class: 'display', style: { 'margin-top': '22px' } }, 'Protéger ', h('span', { class: 'dim' }, 'sans'), h('br'), h('span', { class: 'accent' }, 'exposer.')),
        h('p', { class: 'lead', style: { 'margin-top': '20px' } }, 'NUKUN audite les outils numériques d\'aide aux survivantes et vérifie, preuves à l\'appui, qu\'ils ne laissent aucune trace exploitable par un agresseur qui a accès à leur téléphone.'),
        h('div', { class: 'row' },
          h('a', { class: 'btn', href: '#/express' }, 'Lancer le parcours jury ', h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→')),
          h('a', { class: 'btn secondary', href: '#/nouvel-audit?mode=audit' }, 'Auditer un outil'),
          cur ? h('a', { class: 'link-arrow', href: `#/audit/${cur.id}/criteres` }, 'Reprendre mon audit →') : h('a', { class: 'link-arrow', href: '#/nouvel-audit?mode=design' }, 'Concevoir un outil sûr →')),
        h('div', { class: 'hero-meta' }, h('span', null, 'Aucun compte'), h('span', null, 'Aucun traceur'), h('span', null, 'Fonctionne hors ligne'), h('span', null, 'Données fictives uniquement'))),
      scanWindow(snapshot)),

    h('section', { class: 'section reveal' },
      h('span', { class: 'eyebrow' }, 'En chiffres'),
      h('div', { class: 'stats' },
        h('div', null, h('b', null, String(ref.criteria.length)), h('span', null, 'critères vérifiables')),
        h('div', null, h('b', null, String(ref.pillars.length)), h('span', null, 'piliers pondérés')),
        h('div', null, h('b', null, String(ctx.data.scenarios.length)), h('span', null, 'scénarios d\'agresseur intime')),
        h('div', null, h('b', null, '0'), h('span', null, 'traceur, compte ou base de données')))),

    h('section', { class: 'section reveal' },
      h('p', { class: 'quote' }, 'Un outil destiné à protéger une survivante ne doit jamais devenir ', h('span', { class: 'dim' }, 'une nouvelle source de danger. NUKUN permet de voir les risques, de les corriger et de vérifier les améliorations.'))),

    h('section', { class: 'section reveal' },
      h('div', { class: 'section-head' },
        h('span', { class: 'eyebrow' }, 'Le problème'),
        h('h2', { class: 'display-2' }, 'La menace est souvent ', h('span', { class: 'dim' }, 'dans le foyer.'))),
      h('div', { class: 'grid three' },
        numCard('01', 'Il a accès au téléphone', 'Partenaire, ex ou membre de la famille : il connaît le code, lit les notifications et ouvre l\'historique.'),
        numCard('02', 'Chaque détail peut trahir', 'Un traceur, un SMS de confirmation, un titre d\'onglet explicite, un nom obligatoire : autant d\'indices d\'une demande d\'aide.'),
        numCard('03', 'Déclarer n\'est pas prouver', 'NUKUN distingue ce qui est observé par la machine, testé par un humain ou seulement déclaré par l\'éditeur.'))),

    h('section', { class: 'section reveal' },
      h('div', { class: 'section-head' },
        h('span', { class: 'eyebrow' }, 'Comment ça marche'),
        h('h2', { class: 'display-2' }, 'Voir, corriger, ', h('span', { class: 'dim' }, 'vérifier.'))),
      h('ol', { class: 'steps' },
        step('01', 'Analyse de l\'adresse', 'Lecture passive : traceurs, HTTPS, cookies, sortie rapide, formulaires. Preuve 🤖 machine.'),
        step('02', '30 critères, 6 piliers', 'Chaque critère noté 0, 1, 2 ou N/A, avec son niveau de preuve.'),
        step('03', 'Agresseur intime', `${ctx.data.scenarios.length} scénarios fictifs : Kossi contrôle le téléphone d’Afi, un voisin témoin, une victime qui ne lit pas le français. Preuve 🧪 humaine.`),
        step('04', 'Score et feu', `Un critère bloquant non conforme plafonne le score à ${BLOCKING_CAP}.`),
        step('05', 'Correction et ré-audit', 'Plan priorisé, kit de correctifs, puis nouvel audit pour prouver l\'amélioration.'))),

    h('section', { class: 'section reveal' },
      h('div', { class: 'band' },
        h('span', { class: 'eyebrow' }, h('span', { class: 'dot' }), 'Cas d’étude · plateformes fictives'),
        h('h2', { class: 'display-2', style: { 'margin-top': '14px' } }, 'Un audit complet, ', h('span', { class: 'dim' }, 'du constat à la vérification.')),
        h('p', { class: 'lead' }, 'HAVEN, une plateforme d’aide fictive, a été soumise à NUKUN. L’audit a relevé ses défauts et produit un plan de correction ; le kit a été appliqué, ce qui a donné la version corrigée LIGHT, auditée à son tour. Les deux scores sont recalculés par le même moteur à chaque ouverture : aucun n’est fixé à la main.'),
        h('div', { class: 'vs' },
          h('div', { class: 'side' }, h('span', { class: 'tag red' }, 'Soumise à l’audit'), h('h3', null, 'HAVEN'), h('ul', null, h('li', null, 'Traceur d\'audience simulé'), h('li', null, 'Aucune sortie rapide'), h('li', null, 'Nom et téléphone obligatoires'), h('li', null, 'Politique de confidentialité vide')), null),
          h('div', { class: 'arrow-mid', 'aria-hidden': 'true' }, '→'),
          h('div', { class: 'side' }, h('span', { class: 'tag green' }, 'Après correction'), h('h3', null, 'LIGHT'), h('ul', null, h('li', null, 'Bouton Quitter et touche Échap'), h('li', null, 'Formulaire anonyme par défaut'), h('li', null, 'Aucun service tiers'), h('li', null, 'Points restants affichés honnêtement')), null)),
        h('div', { class: 'row', style: { 'margin-top': '26px' } },
          h('a', { class: 'btn', href: '#/comparer' }, 'Voir l’audit avant / après ', h('span', { class: 'arrow', 'aria-hidden': 'true' }, '→')),
          h('a', { class: 'btn secondary', href: '#/kit' }, 'Voir le kit de correctifs')))),

    h('section', { class: 'section reveal' },
      h('div', { class: 'grid two' },
        h('div', null,
          h('span', { class: 'eyebrow' }, 'Ce que NUKUN ne fait pas'),
          h('h2', { class: 'display-2' }, 'Aucune attaque. ', h('span', { class: 'dim' }, 'Jamais.'))),
        h('div', { class: 'stack' },
          h('p', { class: 'lead' }, 'Aucun test intrusif, aucun formulaire soumis, aucune page cachée explorée, et seulement des adresses autorisées. La sécurité du serveur relève d\'un test d\'intrusion professionnel sous mandat écrit.'),
          disclaimer()))));
}

function numCard(n, title, text) {
  return h('div', { class: 'card num-card' }, h('span', { class: 'n' }, n), h('h3', null, title), h('p', { class: 'muted' }, text));
}

function step(n, title, text) {
  return h('li', null, h('span', { class: 'n' }, n), h('b', null, title), h('span', { class: 'muted small' }, text));
}

export function renderDashboard(ctx) {
  const { data, t } = ctx;
  const audits = store.listAudits();
  const scored = audits.map((a) => {
    const s = computeScore(a.assessments, data.referential);
    const plan = correctionPlan(s, data.referential, data.corrections);
    const done = plan.filter((p) => a.plan[p.criterion] === 'done').length;
    return { a, s, risks: priorityRisks(s, data.referential), plan, done };
  });
  const last = scored[0];
  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', id: 'import-file' });
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) { toast('Fichier trop volumineux.', 'err'); return; }
    try {
      const obj = JSON.parse(await f.text());
      const a = sanitizeImported(obj);
      if (!a) throw new Error('format');
      store.saveAudit(a);
      toast('Audit importé. Les résultats d\'analyse importés sont traités comme des déclarations.', 'ok');
      refresh();
    } catch { toast('Ce fichier n\'est pas une sauvegarde NUKUN valide.', 'err'); }
  });

  return h('div', { class: 'stack' },
    h('h1', null, 'Tableau de bord'),
    h('p', { class: 'muted' }, 'Ces informations sont calculées dans ce navigateur et ne sont transmises à aucun serveur.', store.isPersistent() ? '' : ' Attention : le stockage local est indisponible (navigation privée ?) — exportez vos audits.'),
    h('div', { class: 'grid four' },
      kpi(String(audits.length), 'audit(s) enregistré(s) ici'),
      kpi(last ? `${last.s.score}/100` : '—', 'score du dernier audit'),
      kpi(last ? String(last.risks.filter((r) => r.blocking || r.criticality === 'élevée').length) : '—', 'risque(s) critique(s), dernier audit'),
      kpi(last ? `${last.s.evaluated}/30` : '—', 'critères vérifiés, dernier audit'),
      kpi(last ? `${last.plan.length ? Math.round((last.done / last.plan.length) * 100) : 100} %` : '—', 'progression des corrections')),
    h('div', { class: 'row' },
      h('a', { class: 'btn', href: '#/nouvel-audit' }, 'Nouvel audit'),
      last ? h('a', { class: 'btn secondary', href: `#/audit/${last.a.id}/criteres` }, 'Reprendre mon audit') : null,
      h('label', { class: 'btn secondary', for: 'import-file' }, 'Importer un audit sauvegardé'), fileInput),
    last ? h('section', { class: 'panel' },
      h('h2', null, 'Dernier audit'),
      h('div', { class: 'row between' },
        h('div', null, h('b', null, last.a.meta.projectName), h('p', { class: 'muted small' }, `Modifié le ${fmtDate(last.a.updatedAt)}`)),
        h('div', { class: 'row' }, auditTypeBadge(last.a.meta.auditType), lightPill(last.s.light, last.s.score))),
      h('p', null, t.lightMeaning[last.s.light]),
      h('a', { class: 'btn small', href: `#/audit/${last.a.id}/rapport` }, 'Ouvrir le rapport')) : h('p', { class: 'notice' }, 'Aucun audit pour l\'instant. Commencez par le parcours jury : il audite HAVEN ou LIGHT en 5 minutes.'),
    audits.length ? h('section', null,
      h('h2', null, 'Mes audits'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, 'Outil'), h('th', null, 'Type'), h('th', null, 'Score'), h('th', { class: 'hide-sm' }, 'Vérifiés'), h('th', { class: 'hide-sm' }, 'Modifié'), h('th', null, 'Actions'))),
        h('tbody', null, scored.map(({ a, s }) => h('tr', null,
          h('td', null, h('a', { href: `#/audit/${a.id}/rapport` }, a.meta.projectName), a.parentId ? h('div', { class: 'muted small' }, 'ré-audit') : null),
          h('td', null, AUDIT_TYPES[a.meta.auditType]),
          h('td', null, lightPill(s.light, s.score)),
          h('td', { class: 'hide-sm' }, `${s.evaluated}/30`),
          h('td', { class: 'hide-sm' }, fmtDate(a.updatedAt)),
          h('td', null, h('div', { class: 'row' },
            h('a', { class: 'btn small secondary', href: `#/audit/${a.id}/criteres` }, 'Ouvrir'),
            h('button', { type: 'button', class: 'btn small danger', onclick: () => { if (confirm(`Supprimer définitivement l'audit « ${a.meta.projectName} » de ce navigateur ?`)) { store.deleteAudit(a.id); toast('Audit supprimé.'); refresh(); } } }, 'Supprimer')))))))),
      h('p', null, h('button', { type: 'button', class: 'btn small danger', onclick: () => { if (confirm('Supprimer TOUS les audits enregistrés dans ce navigateur ? Cette action est définitive.')) { store.deleteAll(); toast('Tous les audits ont été supprimés.'); refresh(); } } }, 'Tout effacer de ce navigateur'))) : null);
}

function kpi(v, l) {
  return h('div', { class: 'kpi' }, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l));
}

export function renderMethod(ctx) {
  const { data } = ctx;
  return h('div', { class: 'stack' },
    h('h1', null, 'Méthode, calcul du score et limites'),
    h('section', { class: 'panel' },
      h('h2', null, 'Le référentiel : 6 piliers, 30 critères'),
      h('p', null, 'Les 30 critères sont repris à l\'identique du mémoire NUKUN. Les 4 piliers officiels du hackathon sont complétés par 2 piliers issus des principes directeurs de l\'UNFPA.'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, 'Pilier'), h('th', null, 'Poids'), h('th', null, 'Critères'), h('th', null, 'Bloquants'))),
        h('tbody', null, data.pillars.map((p) => h('tr', null, h('td', null, `${p.id} · ${p.name}`), h('td', null, `${p.weight} %`),
          h('td', null, data.criteria.filter((c) => c.pillar === p.id).map((c) => c.id).join(', ')),
          h('td', null, data.criteria.filter((c) => c.pillar === p.id && c.blocking).map((c) => c.id).join(', ') || '—'))))))),
    h('section', { class: 'panel' },
      h('h2', null, 'Règles de calcul'),
      h('ol', null,
        h('li', null, 'Chaque critère reçoit 0 (absent), 1 (partiel), 2 (conforme) ou N/A. Un N/A exige une justification ; sans justification, il compte comme non vérifié.'),
        h('li', null, 'Niveau de preuve : 🤖 machine (analyse automatique), 🧪 humain (test documenté), 💬 déclaration. Une déclaration seule plafonne la note à 1 et ne valide JAMAIS un critère bloquant (il reste « non vérifié », donc 0).'),
        h('li', null, 'Un critère non évalué compte 0 : ce qui n\'est pas vérifié n\'est pas acquis.'),
        h('li', null, 'Score d\'un pilier = points obtenus ÷ points possibles (hors N/A).'),
        h('li', null, 'Score global = Σ (poids du pilier × score du pilier) ÷ Σ poids des piliers applicables × 100, arrondi à l\'entier. Si un pilier entier est N/A, les poids des autres sont renormalisés.'),
        h('li', null, `Si un critère bloquant (C1, C2, S1, R1, N1) n'est pas conforme (note retenue inférieure à 2), le score est plafonné à ${BLOCKING_CAP}.`),
        h('li', null, 'Feu : rouge sous 50 (non déployable dans l\'état évalué) ; orange de 50 à 79 (corrections prioritaires nécessaires) ; vert à partir de 80 (niveau favorable pour envisager un déploiement sous contrôle humain).'),
        h('li', null, 'Part prouvée : part du score qui repose sur des preuves 🤖 ou 🧪.')),
      h('h3', null, 'Exemple vérifié par les tests automatiques'),
      h('p', null, 'Tous les critères conformes et prouvés, sauf C3 = 1, A3 = 0 et E5 déclaré conforme (retenu 1). Confidentialité 9/10 × 25 = 22,5 ; Sécurité 20 ; Accessibilité 8/10 × 15 = 12 ; Recours 20 ; Ne pas nuire 10 ; Équité 9/10 × 10 = 9. Total 93,5 → 94/100, vert.'),
      h('h3', null, 'Fusion des sources'),
      h('p', null, 'Une réponse saisie par l\'auditeur prime toujours. Entre sources automatiques (analyse, scénarios), la note la plus basse est retenue. Si un scénario contredit une réponse saisie, l\'écart est signalé « à revoir ».')),
    h('section', { class: 'panel' },
      h('h2', null, 'L\'analyse automatique (module 0)'),
      h('p', null, 'Elle lit le code et les en-têtes comme une visiteuse ordinaire : HTTPS, en-têtes de sécurité, cookies (y compris avant consentement), signatures de traceurs et de pixels connus, domaines tiers, poids des pages, sortie rapide, numéros cliquables, formulaires et champs identifiants obligatoires, politique de confidentialité, signaux de traces locales.'),
      h('ul', null,
        h('li', null, 'Strictement passive : aucun formulaire soumis, aucun test intrusif, aucune page cachée (seuls les liens visibles de la même section sont suivis, 10 pages au plus).'),
        h('li', null, 'Les domaines tiers sont relevés dans le code, jamais contactés.'),
        h('li', null, 'Liste d\'adresses autorisées ; refus de localhost, des adresses IP privées ou réservées, des services de métadonnées cloud, des protocoles autres que http(s), des identifiants dans l\'adresse, des ports non standard, des redirections vers une destination interdite ; vérification DNS au moment de la connexion ; 10 analyses par minute et par appareil ; 2 Mo et 8 s au plus par réponse ; cache de 5 minutes.'),
        h('li', null, 'Limite : un contenu ajouté par JavaScript après le chargement n\'est pas vu. Les critères concernés passent par un test humain.')),
      h('p', null, 'Modes : « navigateur » pour HAVEN et LIGHT (même site), « serveur » pour un site autorisé externe, « instantané » (résultat enregistré à l\'avance, daté) en secours, et mode manuel si rien n\'est disponible.')),
    h('section', { class: 'panel' },
      h('h2', null, 'Ce que NUKUN ne fait pas'),
      h('ul', null,
        h('li', null, 'Aucune attaque, injection, soumission de formulaire ou recherche de failles sur un serveur.'),
        h('li', null, 'Aucune exploration de pages non publiques, aucun accès à un compte.'),
        h('li', null, 'Aucun audit d\'un site sans autorisation écrite de son responsable.')),
      h('p', null, 'Pourquoi : c\'est illégal sans mandat (Code du numérique du Bénin), interdit par le règlement du hackathon, dangereux dans le contexte des VBG (un outil capable de trouver les failles de n\'importe quel site d\'aide pourrait servir un agresseur), et irréaliste (un test d\'intrusion demande des experts et plusieurs jours).')),
    disclaimer());
}

export function renderPrivacy() {
  return h('div', { class: 'stack' },
    h('h1', null, 'Confidentialité de NUKUN'),
    h('section', { class: 'panel' },
      h('h2', null, 'Ce que NUKUN collecte'),
      h('p', null, 'Rien. NUKUN n\'a ni compte, ni base de données, ni traceur, ni publicité. Vos audits (description de l\'outil, notes, commentaires, captures) restent dans le stockage local de ce navigateur, jusqu\'à ce que vous les supprimiez.'),
      h('h2', null, 'Ce qui passe par un serveur'),
      h('ul', null,
        h('li', null, 'Le chargement des pages de NUKUN, HAVEN et LIGHT (comme tout site).'),
        h('li', null, 'Si vous analysez un site externe autorisé : l\'adresse de ce site est envoyée à la fonction d\'analyse, qui la lit et vous renvoie le résultat. Ni l\'adresse ni le résultat ne sont enregistrés. Votre adresse IP est gardée en mémoire vive une minute au plus, pour limiter les abus.')),
      h('h2', null, 'Journaux techniques de l\'hébergeur'),
      h('p', null, 'L\'hébergeur conserve des journaux techniques (adresse IP, date, page demandée, navigateur) pour faire fonctionner le service et le protéger. NUKUN ne les consulte pas pour suivre les visiteurs. Leur durée de conservation dépend de l\'hébergeur choisi : elle est indiquée dans la documentation de déploiement (docs/SECURITE_ET_JOURNAUX.md).'),
      h('h2', null, 'Vos droits et la suppression'),
      h('p', null, 'Depuis le tableau de bord, vous pouvez supprimer un audit ou tout effacer. Vous pouvez aussi vider les données du site dans les réglages du navigateur.'),
      h('h2', null, 'Règles d\'usage'),
      h('ul', null,
        h('li', null, 'N\'utilisez jamais d\'informations réelles concernant une survivante.'),
        h('li', null, 'N\'ajoutez aucune capture contenant des données personnelles.'),
        h('li', null, 'N\'auditez que des outils pour lesquels vous avez une autorisation.'))));
}

export function renderShare() {
  const base = location.href.split('#')[0];
  const links = [
    ['NUKUN', base],
    ['Parcours jury (5 min)', base + '#/express'],
    ['HAVEN (fictif, avant)', new URL('haven/', base).href],
    ['LIGHT (fictif, après)', new URL('light/', base).href]
  ];
  let svg;
  try { svg = qrSvg(base + '#/express'); } catch (e) { svg = h('p', null, 'QR code indisponible : ' + e.message); }
  const local = /^(localhost|127\.|192\.168\.|10\.)/.test(location.hostname);
  return h('div', { class: 'stack' },
    h('h1', null, 'QR code et liens de démonstration'),
    local ? h('p', { class: 'notice warn' }, 'Vous êtes sur une adresse locale : ce QR code ne fonctionnera que sur le même réseau. Après la mise en ligne, ouvrez cette page depuis l\'adresse publique pour obtenir le QR code définitif.') : null,
    h('div', { class: 'grid two' },
      h('div', { class: 'panel' }, h('h2', null, 'Scanner pour tester'), h('div', { class: 'qr' }, svg), h('p', { class: 'small muted' }, 'Le QR code est généré dans votre navigateur. Il ouvre le parcours jury.')),
      h('div', { class: 'panel' }, h('h2', null, 'Liens'), h('ul', null, links.map(([l, u]) => h('li', null, h('b', null, l), ' : ', h('a', { href: u }, u)))),
        h('button', { type: 'button', class: 'btn secondary', onclick: () => { try { download('nukun-qr.svg', new XMLSerializer().serializeToString(svg), 'image/svg+xml'); } catch { toast('Téléchargement impossible.', 'err'); } } }, 'Télécharger le QR code (SVG)'))));
}

export { go };

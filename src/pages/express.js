/**
 * NUKUN — Parcours express du jury (5 minutes) :
 * choisir HAVEN ou LIGHT → analyse → T4 et T6 → score, défauts, correctifs → comparaison et export.
 * Les 30 critères restent accessibles à tout moment (mode complet).
 */
import { h, toast } from '../utils/dom.js';
import * as store from '../utils/store.js';
import { buildReport } from '../modules/report-generator/report-model.js';
import { gauge } from '../components/charts.js';
import { requireAudit, persist, lightPill, disclaimer, buildCaseAudit, fictionNotice } from '../components/ui.js';
import { scenarioCard } from './audit.js';
import { exportPdf } from './report.js';
import { go } from '../app.js';

const STEPS = ['Analyse', 'Scénario T4', 'Scénario T6', 'Score et correctifs', 'Avant / après'];

export function renderExpressStart(ctx) {
  const status = h('p', { role: 'status', 'aria-live': 'polite', class: 'muted' });
  const start = async (caseId, btn) => {
    btn.disabled = true;
    status.textContent = `Analyse de ${caseId.toUpperCase()} en cours…`;
    try {
      const { audit, usedSnapshot, analysisError } = await buildCaseAudit(ctx.data, caseId, { skipScenarios: ['T4', 'T6'], meta: { express: true } });
      if (usedSnapshot) toast('Analyse en direct indisponible : instantané enregistré utilisé.', 'warn');
      else if (analysisError) toast(analysisError, 'warn');
      persist(audit);
      store.setCurrent(audit.id);
      go(`/express/${audit.id}/1`);
    } catch (e) {
      btn.disabled = false;
      status.textContent = 'Erreur : ' + e.message;
    }
  };
  const choice = (caseId, title, text, tone) => {
    const btn = h('button', { type: 'button', class: ['btn', 'block', tone === 'red' ? 'navy' : ''], onclick: () => start(caseId, btn) }, `Auditer ${title}`);
    return h('div', { class: 'card' }, h('h2', null, title), h('p', null, text), btn);
  };
  return h('div', { class: 'stack' },
    h('p', { class: 'express-step' }, 'Parcours jury · environ 5 minutes'),
    h('h1', null, 'Auditez vous-même une plateforme d\'aide'),
    h('p', null, 'Vous allez jouer le rôle de l\'auditeur : NUKUN analyse le site, vous exécutez deux scénarios du Test de l\'agresseur intime sur votre téléphone, puis vous voyez le score, les défauts et les correctifs.'),
    h('div', { class: 'grid two' },
      choice('haven', 'HAVEN', 'La plateforme fictive « avant » : elle se présente comme un refuge, mais expose-t-elle Afi ?', 'red'),
      choice('light', 'LIGHT', 'La plateforme fictive « après » : HAVEN reconstruite avec le kit NUKUN. Est-elle vraiment plus sûre ?', 'green')),
    status,
    h('p', { class: 'small muted' }, 'HAVEN et LIGHT sont des sites FICTIFS. Les critères qui demandent un humain sont pré-remplis par l\'évaluation de référence de l\'équipe (auto-évaluation) ; vous pouvez tous les revoir dans le mode complet.'),
    h('p', null, h('a', { href: '#/nouvel-audit' }, `Préférer le parcours complet (30 critères, ${ctx.data.scenarios.length} scénarios)`)));
}

/**
 * « Et les autres scénarios ? » : le parcours express ne fait jouer que T4 et T6 au jury.
 * Les autres scénarios comptent quand même dans le score : ils viennent de l'évaluation de
 * référence de l'équipe (auto-évaluation), affichée ici en toute transparence, et rejouables.
 */
function otherScenarios(ctx, audit, r) {
  const { t, data } = ctx;
  const ref = audit.meta.caseId ? data.reference[audit.meta.caseId] : null;
  const rows = r.scenarios.filter((s) => s.id !== 'T4' && s.id !== 'T6');
  const tone = (v) => (v === 'exposed' ? 'red' : v === 'partial' ? 'orange' : v === 'protected' ? 'green' : '');
  return h('section', { class: 'panel' },
    h('h2', null, 'Et les autres scénarios ?'),
    h('p', { class: 'muted' }, `Vous avez joué T4 et T6. Les ${rows.length} autres scénarios comptent aussi dans le score : ils ont été testés par l'équipe${ref ? ` (${ref.testedBy}, ${ref.testedOn})` : ''}. Leurs résultats sont affichés ci-dessous, et vous pouvez les rejouer vous-même : votre verdict remplacera celui de l'équipe.`),
    h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
      h('thead', null, h('tr', null, h('th', null, 'Scénario'), h('th', null, 'Verdict'), h('th', { class: 'hide-sm' }, 'Ce qui a été constaté'))),
      h('tbody', null, rows.map((s) => {
        const def = data.scenarios.find((x) => x.id === s.id);
        return h('tr', null,
          h('td', null, h('b', null, s.id), ' ', s.title, def && def.origin === 'contexte' ? h('div', { class: 'small muted' }, 'Contexte béninois') : null),
          h('td', null, h('span', { class: ['badge', tone(s.verdict)] }, s.verdict ? t.verdicts[s.verdict] : 'Non exécuté')),
          h('td', { class: 'hide-sm small' }, (s.notes || '').replace(/^\[Référence équipe\]\s*/, '')));
      })))),
    h('div', { class: 'row' }, h('a', { class: 'btn small secondary', href: `#/audit/${audit.id}/scenarios` }, 'Rejouer ces scénarios')));
}

export function renderExpressStep(ctx, id, step) {
  const audit = requireAudit(id);
  const { data, t } = ctx;
  const n = Math.max(1, Math.min(5, Number(step)));
  const r = buildReport(audit, data);
  const head = h('div', null,
    h('p', { class: 'express-step' }, `Étape ${n}/5 · ${STEPS[n - 1]}`),
    h('div', { class: 'progress' }, h('span', { style: { width: `${(n / 5) * 100}%` } })),
    fictionNotice(audit.meta.caseId));
  const nav = h('div', { class: 'row between' },
    n > 1 ? h('a', { class: 'btn secondary', href: `#/express/${id}/${n - 1}` }, '← Précédent') : h('a', { class: 'btn secondary', href: '#/express' }, '← Changer de site'),
    n < 5 ? h('a', { class: 'btn', href: `#/express/${id}/${n + 1}` }, `${STEPS[n]} →`) : h('a', { class: 'btn', href: `#/audit/${id}/criteres` }, 'Voir les 30 critères'));

  let body;
  if (n === 1) {
    const a = audit.analysis;
    const key = a ? a.findings.filter((f) => ['trackers', 'quick-exit', 'required-ident', 'phones', 'privacy', 'weight', 'https', 'cookies-consent'].includes(f.id)) : [];
    body = h('div', { class: 'panel' },
      h('h1', null, `NUKUN analyse ${audit.meta.caseId.toUpperCase()}`),
      a ? h('p', { class: 'small muted' }, `🤖 Analyse ${a.mode} · ${a.pages.length} page(s) lue(s), sans soumettre aucun formulaire.`) : h('p', { class: 'notice warn' }, 'Analyse automatique indisponible : les critères seront évalués manuellement.'),
      h('ul', null, key.map((f) => h('li', null, h('b', null, f.label), ' : ', t.findingStatus[f.status], h('div', { class: 'small muted' }, f.evidence)))),
      h('p', null, h('a', { href: `#/audit/${id}/analyse` }, 'Voir l\'analyse détaillée')));
  } else if (n === 2 || n === 3) {
    const s = data.scenarios.find((x) => x.id === (n === 2 ? 'T4' : 'T6'));
    body = h('div', null,
      h('h1', null, n === 2 ? 'Afi peut-elle cacher l\'outil à temps ?' : 'Le réseau partagé trahit-il Afi ?'),
      n === 3 && audit.analysis ? h('p', { class: 'notice small' }, h('b', null, 'Aide : '), `l'analyse automatique a relevé ${audit.analysis.trackers.length} traceur(s) et ${audit.analysis.thirdPartyHosts.length} domaine(s) tiers : `, audit.analysis.trackers.map((x) => x.name).join(', ') || 'aucun', '.') : null,
      scenarioCard(ctx, audit, s, { compact: true }));
  } else if (n === 4) {
    body = h('div', { class: 'stack' },
      h('h1', null, 'Le verdict de NUKUN'),
      h('div', { class: 'grid two' },
        h('div', { class: 'panel' }, gauge(r.score.score), h('div', { class: 'row' }, lightPill(r.score.light, r.score.score)), h('p', null, h('b', null, t.lightMeaning[r.score.light])),
          r.score.capped ? h('p', { class: 'small notice danger' }, `Plafonné à 49 : critère(s) bloquant(s) ${r.score.blockingFailures.join(', ')}.`) : null),
        h('div', { class: 'panel' }, h('h2', null, 'Défauts prioritaires'),
          r.risks.length ? h('ol', null, r.risks.slice(0, 6).map((x) => h('li', null, h('b', null, x.id), ` ${x.name} `, x.blocking ? h('span', { class: 'badge red' }, 'Bloquant') : null, ' — ', h('a', { href: `#/kit/${x.correction}` }, 'correctif')))) : h('p', null, 'Aucun défaut sur les critères évalués.'),
          r.risks.length > 6 ? h('p', { class: 'small muted' }, `… et ${r.risks.length - 6} autre(s) point(s).`) : null)),
      otherScenarios(ctx, audit, r),
      disclaimer(),
      h('div', { class: 'row' }, h('a', { class: 'btn secondary', href: `#/audit/${id}/rapport` }, 'Rapport complet'), h('a', { class: 'btn secondary', href: '#/kit' }, 'Kit de correctifs')));
  } else {
    body = h('div', { class: 'stack' },
      h('h1', null, 'De HAVEN à LIGHT'),
      h('p', null, 'Le plan de correction de NUKUN a été appliqué à HAVEN : elle est devenue LIGHT. Comparez les deux, calculés par le même moteur.'),
      h('div', { class: 'row' },
        h('a', { class: 'btn', href: '#/comparer' }, 'Comparer HAVEN et LIGHT'),
        h('button', { type: 'button', class: 'btn secondary', onclick: () => exportPdf('risks', r, data) }, 'Exporter la fiche de risques (PDF)'),
        h('a', { class: 'btn secondary', href: '#/express' }, `Auditer ${audit.meta.caseId === 'haven' ? 'LIGHT' : 'HAVEN'}`)),
      h('p', { class: 'message' }, ctx.t.centralMessage));
  }
  return h('div', { class: 'stack' }, head, body, nav);
}

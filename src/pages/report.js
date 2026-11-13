/** NUKUN — Rapport automatique (module 3), exports, ré-audit et comparaison avant/après. */
import { h, toast, fmtDate, download, safeFilename } from '../utils/dom.js';
import * as store from '../utils/store.js';
import { buildReport } from '../modules/report-generator/report-model.js';
import { buildPdf, DOC_TYPES, auditToJson } from '../modules/report-generator/exports.js';
import { createReaudit, applyAnalysis } from '../modules/audit-engine/audit-engine.js';
import { analyze } from '../modules/url-analyzer/client.js';
import { compareReports } from '../modules/comparison/compare.js';
import { gauge, radar, donut, proofBar, pillarBars, COLORS } from '../components/charts.js';
import { auditHeader, nextStep, requireAudit, persist, lightPill, statusBadge, disclaimer, buildCaseAudit } from '../components/ui.js';
import { go, refresh } from '../app.js';

export function exportPdf(type, report, data, extra = {}) {
  try {
    const bytes = buildPdf(type, report, { ...data, criteria: data.criteria, ...extra });
    download(`NUKUN_${DOC_TYPES[type]}_${report.meta.projectName}_${new Date().toISOString().slice(0, 10)}.pdf`, new Blob([bytes], { type: 'application/pdf' }));
    toast(`${DOC_TYPES[type]} généré(e) localement.`, 'ok');
  } catch (e) {
    console.error(e);
    toast('Génération impossible : ' + e.message, 'err');
  }
}

export function renderReport(ctx, id) {
  const audit = requireAudit(id);
  const { data, t } = ctx;
  store.setCurrent(audit.id);
  const r = buildReport(audit, data);
  const s = r.score;
  const parent = audit.parentId ? store.getAudit(audit.parentId) : null;

  const kpis = h('div', { class: 'grid four' },
    kpi(`${s.verifiedPercent} %`, 'critères vérifiés (évalués)'),
    kpi(`${s.evidencedPercent} %`, 'appuyés par une preuve 🤖 ou 🧪'),
    kpi(`${s.provenShare} %`, 'du score réellement prouvé'),
    kpi(String(s.counts.conform), 'critères conformes'),
    kpi(String(s.counts.partial), 'partiellement conformes'),
    kpi(String(s.counts.nonconform + s.counts.unverified), `non conformes (${s.counts.nonconform}) ou non vérifiés (${s.counts.unverified})`),
    kpi(`${s.blockingFailures.length}/5`, 'critères bloquants en échec'),
    kpi(`${r.scenariosExecuted}/${r.scenarios.length}`, 'scénarios exécutés'));

  const planRows = r.plan.map((p) => {
    const sel = h('select', { class: 'plan-state', 'aria-label': `État de la correction ${p.criterion}` }, Object.entries(t.planStates).map(([k, l]) => h('option', { value: k, selected: p.state === k }, l)));
    sel.addEventListener('change', () => { audit.plan[p.criterion] = sel.value; persist(audit); refresh(); });
    return h('tr', null, h('td', null, h('span', { class: ['badge', p.priority === 'P0' ? 'red' : p.priority === 'P1' ? 'orange' : ''] }, p.priority)),
      h('td', null, h('b', null, p.criterion), ' ', p.name, h('div', { class: 'small muted' }, t.status[p.status])),
      h('td', { class: 'small' }, h('a', { href: `#/kit/${p.correction}` }, p.correctionTitle), ' — ', p.action),
      h('td', null, p.effort), h('td', null, sel));
  });

  const exportsBox = h('section', { class: 'panel no-print' },
    h('h2', null, 'Exporter'),
    h('p', { class: 'small muted' }, 'Les documents sont générés dans votre navigateur ; rien n\'est envoyé. Chacun contient le score, les six piliers, les critères et leurs preuves, les scénarios, les risques, les recommandations, les limites et la mention de non-certification.'),
    h('div', { class: 'row' },
      Object.entries(DOC_TYPES).filter(([k]) => k !== 'compare').map(([k, label]) => h('button', { type: 'button', class: k === 'report' ? 'btn' : 'btn secondary', onclick: () => exportPdf(k, r, data) }, `PDF · ${label}`)),
      parent ? h('button', { type: 'button', class: 'btn secondary', onclick: () => exportPdf('compare', buildReport(parent, data), data, { after: r }) }, 'PDF · Comparaison avant / après') : null,
      h('button', { type: 'button', class: 'btn secondary', onclick: () => window.print() }, 'Imprimer cette page'),
      h('button', { type: 'button', class: 'btn secondary', onclick: () => { download(`NUKUN_audit_${safeFilename(r.meta.projectName)}.json`, auditToJson(audit), 'application/json'); toast('Sauvegarde de l’audit téléchargée (sans les captures).', 'ok'); } }, 'Sauvegarder l’audit (fichier réimportable)')));

  const reaudit = async () => {
    const n = createReaudit(audit);
    if (n.meta.url) {
      const res = await analyze(n.meta.url);
      if (res.ok) applyAnalysis(n, res.result);
      else toast('Analyse automatique indisponible : ' + res.message, 'warn');
    }
    persist(n);
    store.setCurrent(n.id);
    toast('Nouvel audit créé. Refaites les tests humains et les scénarios : les anciennes réponses ne sont pas reprises.', 'ok');
    go(`/audit/${n.id}/analyse`);
  };

  return h('div', { class: 'stack' },
    auditHeader(audit, data, 'rapport'),
    h('p', { class: 'print-only' }, `Rapport NUKUN — ${r.meta.projectName} — ${fmtDate(r.updatedAt)} — ${r.auditTypeLabel}`),
    h('section', { class: 'grid two' },
      h('div', { class: 'panel' },
        h('h2', null, 'Score global'),
        gauge(s.score),
        h('div', { class: 'row' }, lightPill(s.light, s.score), h('b', null, t.lightMeaning[s.light])),
        s.capped ? h('p', { class: 'notice danger small' }, `Score plafonné à 49 (score brut ${s.rawScore}) : critère(s) bloquant(s) non conforme(s) ${s.blockingFailures.join(', ')}.`)
          : s.blockingFailures.length ? h('p', { class: 'notice danger small' }, `Critère(s) bloquant(s) non conforme(s) : ${s.blockingFailures.join(', ')}.`) : h('p', { class: 'small muted' }, 'Aucun critère bloquant en échec.'),
        h('p', { class: 'small' }, h('b', null, `${r.auditTypeLabel}. `), r.meta.auditType === 'self' ? 'Le rapport n\'a pas été établi par un tiers indépendant.' : '')),
      h('div', { class: 'panel' }, h('h2', null, 'Six piliers'), radar(data.pillars, [{ label: r.meta.projectName, color: COLORS.teal, values: Object.fromEntries(s.pillars.map((p) => [p.id, p.percent])) }]))),
    disclaimer(),
    kpis,
    h('section', { class: 'grid two' },
      h('div', { class: 'panel' }, h('h2', null, 'Scores par pilier'), pillarBars(s.pillars), h('p', { class: 'small muted' }, 'Chaque famille : points obtenus sur points possibles. Voir « Le score expliqué ».')),
      h('div', { class: 'panel' }, h('h2', null, 'Répartition des 30 critères'), donut(s.counts), h('h3', null, 'Niveaux de preuve'), proofBar(s.proofCounts))),
    h('section', { class: 'panel' },
      h('h2', null, 'Test de l\'agresseur intime'),
      h('div', { class: 'grid three' }, r.scenarios.map((sc) => h('div', { class: 'kpi' },
        h('b', null, `${sc.id} · ${sc.title}`),
        h('p', null, h('span', { class: ['badge', sc.verdict === 'exposed' ? 'red' : sc.verdict === 'partial' ? 'orange' : sc.verdict === 'protected' ? 'green' : ''] }, sc.verdict ? t.verdicts[sc.verdict] : 'Non exécuté')),
        sc.notes ? h('p', { class: 'small muted' }, sc.notes) : null))),
      h('p', { class: 'small muted' }, 'Un verdict ne vaut que pour le périmètre testé et ne constitue pas une garantie de protection.')),
    h('section', { class: 'panel' },
      h('h2', null, `Risques prioritaires (${r.risks.length})`),
      r.risks.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, 'Critère'), h('th', null, 'Statut'), h('th', null, 'Criticité'), h('th', { class: 'hide-sm' }, 'Points perdus'), h('th', null, 'Correctif'))),
        h('tbody', null, r.risks.map((x) => h('tr', { class: ['risk-row', x.blocking && 'blocking'] },
          h('td', null, h('b', null, x.id), ' ', x.name), h('td', null, statusBadge(x.status)),
          h('td', null, x.blocking ? h('span', { class: 'badge red' }, 'Bloquant') : t.criticality[x.criticality]),
          h('td', { class: 'hide-sm' }, String(x.lost)), h('td', null, h('a', { href: `#/kit/${x.correction}` }, 'Voir'))))))) : h('p', null, 'Aucun risque sur les critères évalués.')),
    h('section', { class: 'panel' },
      h('h2', null, 'Plan de correction'),
      h('p', { class: 'small muted' }, 'P0 : bloquant, immédiat · P1 : criticité élevée, sous 1 mois · P2 : non conforme, sous 3 mois · P3 : à consolider. Trié par impact sur la sécurité, puis par effort.'),
      h('div', { class: 'row' }, h('b', null, `Progression des corrections : ${r.planProgress} %`)),
      h('div', { class: 'progress green' }, h('span', { style: { width: `${r.planProgress}%` } })),
      r.plan.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, 'Priorité'), h('th', null, 'Critère'), h('th', null, 'Action'), h('th', null, 'Effort'), h('th', null, 'État'))),
        h('tbody', null, planRows))) : h('p', null, 'Aucune action requise sur les critères évalués.'),
      h('div', { class: 'row no-print' },
        h('a', { class: 'btn secondary', href: '#/kit' }, 'Ouvrir le kit de correctifs'),
        h('button', { type: 'button', class: 'btn navy', onclick: reaudit }, 'Réaliser un nouvel audit après correction'),
        parent ? h('a', { class: 'btn secondary', href: `#/comparer?avant=${parent.id}&apres=${audit.id}` }, 'Comparer avec l\'audit précédent') : null)),
    h('section', { class: 'panel' },
      h('h2', null, 'Limites de l\'analyse'),
      h('ul', null, r.limits.map((l) => h('li', null, l))),
      h('p', null, h('b', null, 'Hors périmètre (test d\'intrusion professionnel sous mandat recommandé) : '), r.outOfScope.join(' ; '), '.')),
    exportsBox,
    nextStep(audit, 'rapport'));
}

function kpi(v, l) {
  return h('div', { class: 'kpi' }, h('div', { class: 'v' }, v), h('div', { class: 'l' }, l));
}

// ---------------------------------------------------------------------------
// Comparaison avant / après
// ---------------------------------------------------------------------------
let demoCache = null;

export async function renderCompare(ctx, params) {
  const { data, t } = ctx;
  const audits = store.listAudits();
  let before = params.get('avant') ? store.getAudit(params.get('avant')) : null;
  let after = params.get('apres') ? store.getAudit(params.get('apres')) : null;
  let demo = false;
  const notes = [];
  if (!before || !after) {
    demo = true;
    if (!demoCache || params.get('recalculer') === '1') {
      const [hv, lt] = await Promise.all([buildCaseAudit(data, 'haven'), buildCaseAudit(data, 'safeher')]);
      demoCache = { hv, lt };
    }
    before = demoCache.hv.audit;
    after = demoCache.lt.audit;
    if (demoCache.hv.usedSnapshot || demoCache.lt.usedSnapshot) notes.push('Analyse en direct indisponible : instantané enregistré utilisé (plan de secours).');
  }
  const rb = buildReport(before, data);
  const ra = buildReport(after, data);
  const cmp = compareReports(rb, ra);

  const pick = (label, key, current) => {
    const sel = h('select', { 'aria-label': label }, h('option', { value: '' }, '— Démonstration HAVEN → SafeHer —'), audits.map((a) => h('option', { value: a.id, selected: current && current.id === a.id && !demo }, `${a.meta.projectName} (${fmtDate(a.updatedAt)})`)));
    sel.addEventListener('change', () => {
      const p = new URLSearchParams(location.hash.split('?')[1] || '');
      if (sel.value) p.set(key, sel.value); else p.delete(key);
      go('/comparer?' + p.toString());
    });
    return h('label', null, h('span', { class: 'small muted' }, label), sel);
  };

  const save = () => {
    for (const a of [before, after]) persist(a);
    toast('Les deux audits de démonstration ont été enregistrés dans votre tableau de bord.', 'ok');
  };

  return h('div', { class: 'stack' },
    h('h1', null, demo ? 'De HAVEN à SafeHer : avant / après' : 'Comparaison avant / après'),
    demo ? h('p', { class: 'notice small' }, 'Ces deux scores sont calculés à l\'instant par le moteur NUKUN : analyse automatique réelle des deux sites fictifs, puis évaluation de référence de l\'équipe pour les critères humains (auto-évaluation, non certifiée). Aucun score n\'est fixé à la main.') : null,
    notes.map((n) => h('p', { class: 'notice warn small' }, n)),
    h('div', { class: 'panel row no-print' }, pick('Avant', 'avant', before), pick('Après', 'apres', after),
      demo ? h('button', { type: 'button', class: 'btn small secondary', onclick: () => go('/comparer?recalculer=1') }, 'Recalculer') : null,
      demo ? h('button', { type: 'button', class: 'btn small secondary', onclick: save }, 'Enregistrer ces audits') : null),
    h('div', { class: 'compare-cols' },
      side('Avant', rb, before, t),
      side('Après', ra, after, t)),
    h('section', { class: 'grid two' },
      h('div', { class: 'panel' }, h('h2', null, 'Les six piliers'), radar(data.pillars, [
        { label: 'Avant', color: COLORS.before, values: Object.fromEntries(rb.score.pillars.map((p) => [p.id, p.percent])) },
        { label: 'Après', color: COLORS.after, values: Object.fromEntries(ra.score.pillars.map((p) => [p.id, p.percent])) }]),
        h('div', { class: 'legend' }, h('span', null, h('i', { style: { background: COLORS.before } }), 'Avant'), h('span', null, h('i', { style: { background: COLORS.after } }), 'Après'))),
      h('div', { class: 'panel' }, h('h2', null, 'Écart par pilier'),
        h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
          h('thead', null, h('tr', null, h('th', null, 'Pilier'), h('th', null, 'Avant'), h('th', null, 'Après'), h('th', null, 'Écart'))),
          h('tbody', null, cmp.pillars.map((p) => h('tr', null, h('td', null, `${p.id} · ${p.name}`), h('td', null, fmtPct(p.before)), h('td', null, fmtPct(p.after)),
            h('td', { class: p.delta > 0 ? 'delta-up' : p.delta < 0 ? 'delta-down' : '' }, p.delta === null ? '—' : `${p.delta > 0 ? '+' : ''}${p.delta}`)))))))),
    h('section', { class: 'panel' },
      h('h2', null, `Risques corrigés (${cmp.fixed.length})`),
      cmp.fixed.length ? h('ul', null, cmp.fixed.map((c) => h('li', null, h('b', null, c.id), ` ${c.name} : ${t.status[c.before]} → ${t.status[c.after]}`))) : h('p', null, 'Aucun.'),
      cmp.degraded.length ? [h('h3', null, `Régressions (${cmp.degraded.length})`), h('ul', null, cmp.degraded.map((c) => h('li', null, h('b', null, c.id), ` ${c.name} : ${t.status[c.before]} → ${t.status[c.after]}`)))] : null,
      h('h3', null, `Points toujours non validés après correction (${cmp.remaining.length})`),
      h('ul', null, cmp.remaining.map((c) => h('li', null, h('b', null, c.id), ` ${c.name} — ${t.status[c.status]}${c.comment ? ' : ' + c.comment : ''}`))),
      h('h3', null, 'Scénarios'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, 'Scénario'), h('th', null, 'Avant'), h('th', null, 'Après'))),
        h('tbody', null, cmp.scenarios.map((x) => h('tr', null, h('td', null, `${x.id} · ${x.title}`), h('td', null, x.before ? t.verdicts[x.before] : 'Non exécuté'), h('td', null, x.after ? t.verdicts[x.after] : 'Non exécuté'))))))),
    disclaimer(),
    h('div', { class: 'row no-print' },
      h('button', { type: 'button', class: 'btn', onclick: () => exportPdf('compare', rb, data, { after: ra }) }, 'PDF · Comparaison avant / après'),
      h('button', { type: 'button', class: 'btn secondary', onclick: () => exportPdf('risks', rb, data) }, 'PDF · Fiche de risques (avant)'),
      h('button', { type: 'button', class: 'btn secondary', onclick: () => exportPdf('risks', ra, data) }, 'PDF · Fiche de risques (après)')));
}

function fmtPct(v) { return v === null || v === undefined ? 'N/A' : `${Math.round(v)} %`; }

function side(label, r, audit, t) {
  return h('div', { class: 'panel' },
    h('p', { class: 'express-step' }, label),
    h('h2', null, r.meta.projectName),
    gauge(r.score.score),
    h('div', { class: 'row' }, lightPill(r.score.light, r.score.score)),
    h('p', null, t.lightMeaning[r.score.light]),
    h('p', { class: 'small' }, `Bloquants en échec : ${r.score.blockingFailures.join(', ') || 'aucun'} · conformes ${r.score.counts.conform} · non vérifiés ${r.score.counts.unverified} · part prouvée ${r.score.provenShare} %`),
    r.score.capped ? h('p', { class: 'small muted' }, `Score brut ${r.score.rawScore}, plafonné à 49.`) : null,
    store.getAudit(audit.id) ? h('a', { class: 'btn small secondary', href: `#/audit/${audit.id}/rapport` }, 'Ouvrir le rapport') : null);
}

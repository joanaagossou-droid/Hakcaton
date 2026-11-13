/** NUKUN — Composants d'interface partagés. */
import { h, toast, fmtDate } from '../utils/dom.js';
import t from '../i18n/fr.js';
import * as store from '../utils/store.js';
import { computeScore } from '../modules/scoring/scoring.js';
import { AUDIT_TYPES, createAudit, applyAnalysis, applyReference, applyReferenceScenarios } from '../modules/audit-engine/audit-engine.js';
import { analyze, loadSnapshot } from '../modules/url-analyzer/client.js';

export function proofBadge(proof) {
  if (!proof || proof === 'none') return h('span', { class: 'badge outline' }, t.proof.none);
  return h('span', { class: ['badge', proof === 'machine' ? 'navy' : proof === 'human' ? 'teal' : 'orange'], title: t.proofLong[proof] }, t.proof[proof]);
}

export function statusBadge(status) {
  return h('span', { class: ['badge', t.statusTone[status]] }, t.status[status]);
}

export function lightPill(light, score) {
  return h('span', { class: ['light-pill', light], role: 'status' }, h('span', { class: 'light-dot', 'aria-hidden': 'true' }), `${score}/100 · ${t.lights[light]}`);
}

export function auditTypeBadge(type) {
  return h('span', { class: ['badge', type === 'third' ? 'green' : type === 'cross' ? 'teal' : 'orange'] }, AUDIT_TYPES[type]);
}

export function disclaimer() {
  return h('p', { class: 'notice disclaimer', role: 'note' }, t.disclaimer);
}

export function fictionNotice(caseId) {
  if (!caseId) return null;
  return h('p', { class: 'notice warn small' }, `${caseId.toUpperCase()} est une plateforme FICTIVE créée pour la démonstration. Aucune donnée réelle n'y est utilisée.`);
}

/** Récupère un audit ou lève une erreur lisible. */
export function requireAudit(id) {
  const a = store.getAudit(id);
  if (!a) throw new Error('Audit introuvable dans ce navigateur. Il a peut-être été supprimé, ou créé sur un autre appareil (importez sa sauvegarde depuis le tableau de bord).');
  return a;
}

export function persist(audit) {
  const r = store.saveAudit(audit);
  if (!r.ok) toast(r.message, 'warn');
  return r.ok;
}

const STEPS = [
  ['analyse', 'Analyse'],
  ['criteres', '30 critères'],
  ['scenarios', 'Scénarios'],
  ['rapport', 'Rapport']
];

export function auditHeader(audit, data, current) {
  const s = computeScore(audit.assessments, data.referential);
  return h('div', null,
    h('div', { class: 'audit-head' },
      h('div', null,
        h('p', { class: 'muted small' }, audit.meta.mode === 'design' ? 'Conception d\'un outil sûr' : 'Audit', ' · ', fmtDate(audit.createdAt), audit.parentId ? ' · ré-audit après correction' : ''),
        h('h1', null, audit.meta.projectName)),
      h('div', { class: 'row' }, auditTypeBadge(audit.meta.auditType), lightPill(s.light, s.score))),
    h('nav', { class: 'stepper', 'aria-label': 'Étapes de l\'audit' },
      STEPS.map(([k, label], i) => h('a', { href: `#/audit/${audit.id}/${k}`, 'aria-current': k === current ? 'step' : null }, `${i + 1}. ${label}`))),
    fictionNotice(audit.meta.caseId));
}

export function nextStep(audit, current) {
  const i = STEPS.findIndex(([k]) => k === current);
  const prev = STEPS[i - 1];
  const next = STEPS[i + 1];
  return h('div', { class: 'row between no-print' },
    prev ? h('a', { class: 'btn secondary', href: `#/audit/${audit.id}/${prev[0]}` }, '← ', prev[1]) : h('span'),
    next ? h('a', { class: 'btn', href: `#/audit/${audit.id}/${next[0]}` }, next[1], ' →') : h('span'));
}

/** Adresse de démonstration (même site que NUKUN). */
export function demoUrl(caseId) {
  return new URL(`${caseId}/`, location.href.split('#')[0]).href;
}

/**
 * Construit un audit complet d'un cas fictif : analyse en direct (ou instantané
 * daté en secours) + évaluation de référence de l'équipe. Le score est ensuite
 * calculé par le moteur, jamais fixé à la main.
 */
export async function buildCaseAudit(data, caseId, { skipScenarios = [], meta = {} } = {}) {
  const ref = data.reference[caseId];
  const a = createAudit({
    projectName: caseId === 'haven' ? 'HAVEN (fictif, avant correction)' : 'SafeHer (fictif, après correction)',
    url: demoUrl(caseId), toolType: 'Site web d\'information et de signalement', mainFunction: 'Informer, orienter et recevoir des demandes d\'aide (démonstration)',
    audience: 'Survivantes et survivants de VBG-FT, proches, témoins', caseId, auditType: 'cross', ...meta
  });
  let res = await analyze(a.meta.url);
  let usedSnapshot = false;
  if (!res.ok) {
    const snap = await loadSnapshot(caseId);
    if (snap) { res = { ok: true, result: snap }; usedSnapshot = true; }
  }
  if (res.ok) applyAnalysis(a, res.result);
  applyReference(a, ref);
  const defs = data.scenarios.filter((s) => !skipScenarios.includes(s.id));
  applyReferenceScenarios(a, ref, defs);
  return { audit: a, usedSnapshot, analysisError: res.ok ? null : res.message };
}

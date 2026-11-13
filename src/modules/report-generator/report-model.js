/**
 * NUKUN — Modèle de rapport (module pur) : rassemble tout ce qu'un rapport
 * ou un export doit contenir, à partir d'un audit et du référentiel.
 */
import { computeScore, priorityRisks, correctionPlan } from '../scoring/scoring.js';
import { AUDIT_TYPES } from '../audit-engine/audit-engine.js';

export const DISCLAIMER = 'Le score NUKUN est un indicateur des critères évalués et des preuves disponibles. Il ne constitue ni une certification, ni une garantie de sécurité, ni un substitut à un audit professionnel.';

export const PROOF_LABELS = { machine: 'Machine (observé automatiquement)', human: 'Humain (test documenté)', declared: 'Déclaration de l\'éditeur', none: 'Non évalué' };
export const PROOF_SHORT = { machine: 'Machine', human: 'Humain', declared: 'Déclaré', none: '—' };
export const STATUS_LABELS = { conform: 'Conforme', partial: 'Partiel', nonconform: 'Non conforme', unverified: 'Non vérifié', na: 'N/A' };
export const SOURCE_LABELS = { manual: 'Saisie de l\'auditeur', reference: 'Référence de l\'équipe', analyzer: 'Analyse automatique' };

export const GENERAL_LIMITS = [
  'NUKUN couvre l\'analyse passive et les tests humains (niveaux 1 et 2). Il ne réalise aucun test d\'intrusion : la sécurité du serveur, de la base de données et des comptes est hors périmètre et relève d\'un test d\'intrusion professionnel sous mandat écrit.',
  'L\'analyse automatique lit le code reçu : un contenu ajouté par JavaScript après le chargement n\'est pas vu.',
  'Un verdict de scénario vaut pour le périmètre testé (appareil, navigateur, date) ; il ne garantit pas une protection absolue.',
  'La pondération du référentiel est à valider avec des expertes VBG et des structures spécialisées.',
  'Une déclaration de l\'éditeur ne dépasse jamais « partiel » et ne valide jamais un critère bloquant.'
];

export function sourceLabel(src) {
  if (!src) return '—';
  if (src.startsWith('scenario:')) return 'Scénario ' + src.slice(9);
  return SOURCE_LABELS[src] || src;
}

export function buildReport(audit, data) {
  const { referential, scenarios, corrections } = data;
  const score = computeScore(audit.assessments, referential);
  const risks = priorityRisks(score, referential);
  const plan = correctionPlan(score, referential, corrections).map((p) => ({ ...p, state: audit.plan[p.criterion] || 'todo' }));
  const pillarsById = Object.fromEntries(referential.pillars.map((p) => [p.id, p]));
  const criteria = referential.criteria.map((c) => {
    const a = audit.assessments[c.id] || null;
    const eff = score.perCriterion[c.id];
    return {
      id: c.id, name: c.name, pillar: c.pillar, pillarName: pillarsById[c.pillar].name, blocking: c.blocking, criticality: c.criticality,
      note: a ? a.note : null, value: eff.value, status: eff.status, reason: eff.reason,
      proof: a && a.note !== null && a.note !== undefined && a.note !== 'na' ? (a.proof || 'declared') : 'none',
      source: a ? a.source : null, comment: a ? (a.note === 'na' ? a.naReason : a.comment) || '' : '',
      conflict: a ? a.conflict : null, hasAttachment: !!(a && a.attachment)
    };
  });
  const scen = scenarios.map((s) => {
    const r = audit.scenarios[s.id] || null;
    return { id: s.id, title: s.title, criteria: s.criteria, verdict: r ? r.verdict : null, notes: r ? r.notes : '', hasAttachment: !!(r && r.attachment), recommendation: s.recommendation };
  });
  const executed = scen.filter((s) => s.verdict && s.verdict !== 'unverified').length;
  const planDone = plan.filter((p) => p.state === 'done').length;
  return {
    meta: audit.meta,
    auditTypeLabel: AUDIT_TYPES[audit.meta.auditType],
    createdAt: audit.createdAt,
    updatedAt: audit.updatedAt,
    analysis: audit.analysis,
    reference: audit.reference,
    score, risks, plan, criteria, scenarios: scen,
    scenariosExecuted: executed,
    planProgress: plan.length ? Math.round((planDone / plan.length) * 100) : 100,
    criticalRisks: risks.filter((r) => r.blocking || r.criticality === 'élevée').length,
    disclaimer: DISCLAIMER,
    limits: [...GENERAL_LIMITS, ...((audit.analysis && audit.analysis.mode === 'instantané') ? [`Analyse automatique issue d'un instantané enregistré le ${String(audit.analysis.analyzedAt).slice(0, 10)} (plan de secours), et non d'une analyse en direct.`] : []), ...(!audit.analysis ? ['Aucune analyse automatique : les critères observables ont été évalués manuellement.'] : [])],
    outOfScope: ['Sécurité du serveur et de la base de données', 'Gestion des comptes et des accès internes', 'Chiffrement des données stockées (vérifiable seulement par audit interne)']
  };
}

/**
 * NUKUN — Moteur de calcul du score (module pur, sans effet de bord).
 *
 * Utilisable dans le navigateur et dans Node (tests). Les règles appliquées
 * sont celles du mémoire NUKUN (§ 4 « Règle de notation » et § 4 bis) :
 *
 *  1. Chaque critère reçoit 0, 1, 2 ou N/A (N/A exige une justification).
 *  2. Niveau de preuve : machine (🤖), human (🧪), declared (💬).
 *     - Une déclaration seule plafonne la note à 1 (partiel).
 *     - Une déclaration seule ne valide jamais un critère bloquant : il reste
 *       « non vérifié », donc compté 0.
 *  3. Un critère non évalué compte 0 point (« ce qui n'est pas vérifié n'est pas acquis »).
 *  4. Score du pilier = points obtenus / points possibles (hors N/A).
 *  5. Score global = Σ (poids du pilier × ratio du pilier) / Σ poids des piliers
 *     applicables × 100  → renormalisation si un pilier entier est N/A.
 *  6. Un critère bloquant qui n'est pas conforme (note effective < 2, y compris
 *     non vérifié) plafonne le score global à 49.
 *  7. Feu : rouge < 50, orange 50–79, vert ≥ 80.
 *
 * Le résultat est déterministe : les mêmes entrées donnent toujours la même sortie.
 */

export const BLOCKING_CAP = 49;
export const PROOFS = ['machine', 'human', 'declared'];
const CRITICALITY_RANK = { bloquant: 3, 'élevée': 2, moyenne: 1 };

/** Arrondi à une décimale, stable. */
export function round1(x) {
  return Math.round(x * 10) / 10;
}

/**
 * Calcule la note effective d'un critère à partir de son évaluation.
 * @returns {{value:number|null, status:string, excluded:boolean, proven:boolean, reason:string}}
 *  status ∈ conform | partial | nonconform | unverified | na
 */
export function effectiveNote(assessment, criterion) {
  const a = assessment || {};
  const note = a.note;

  if (note === undefined || note === null || note === '') {
    return { value: 0, status: 'unverified', excluded: false, proven: false, reason: 'Non évalué' };
  }

  if (note === 'na') {
    const justified = typeof a.naReason === 'string' && a.naReason.trim().length >= 3;
    if (justified) {
      return { value: null, status: 'na', excluded: true, proven: false, reason: 'Non applicable (justifié)' };
    }
    return { value: 0, status: 'unverified', excluded: false, proven: false, reason: 'N/A sans justification : traité comme non vérifié' };
  }

  if (![0, 1, 2].includes(note)) {
    return { value: 0, status: 'unverified', excluded: false, proven: false, reason: 'Note invalide' };
  }

  // Sans niveau de preuve, on applique la règle la plus prudente : déclaration.
  const proof = PROOFS.includes(a.proof) ? a.proof : 'declared';

  if (proof === 'declared') {
    if (criterion && criterion.blocking) {
      return {
        value: 0, status: 'unverified', excluded: false, proven: false,
        reason: 'Critère bloquant appuyé seulement par une déclaration : non vérifié, donc non conforme'
      };
    }
    const value = Math.min(note, 1);
    return {
      value,
      status: value === 1 ? 'partial' : 'nonconform',
      excluded: false, proven: false,
      reason: note === 2 ? 'Déclaration seule : note plafonnée à 1' : 'Déclaration'
    };
  }

  return {
    value: note,
    status: note === 2 ? 'conform' : note === 1 ? 'partial' : 'nonconform',
    excluded: false, proven: true,
    reason: proof === 'machine' ? 'Constaté par la machine' : 'Testé par un humain'
  };
}

export function trafficLight(score) {
  if (score >= 80) return 'green';
  if (score >= 50) return 'orange';
  return 'red';
}

export const LIGHT_LABELS = {
  red: 'Non déployable dans l\'état évalué',
  orange: 'Corrections prioritaires nécessaires',
  green: 'Niveau favorable pour envisager un déploiement sous contrôle humain'
};

/**
 * Calcule le score complet d'un audit.
 * @param {Object} assessments  { [criterionId]: {note, proof, naReason, ...} }
 * @param {Object} referential  { pillars:[], criteria:[] } (criteria.json)
 */
export function computeScore(assessments, referential) {
  const pillars = referential.pillars;
  const criteria = referential.criteria;
  const perCriterion = {};
  const pillarAcc = {};
  for (const p of pillars) {
    pillarAcc[p.id] = { id: p.id, name: p.name, weight: p.weight, points: 0, possible: 0, provenPoints: 0, applicable: 0, total: 0 };
  }

  const counts = { conform: 0, partial: 0, nonconform: 0, unverified: 0, na: 0 };
  const proofCounts = { machine: 0, human: 0, declared: 0, none: 0 };
  const blockingFailures = [];
  let evaluated = 0;

  for (const c of criteria) {
    const a = (assessments && assessments[c.id]) || null;
    const eff = effectiveNote(a, c);
    perCriterion[c.id] = eff;
    counts[eff.status] += 1;
    const acc = pillarAcc[c.pillar];
    acc.total += 1;

    const hasNote = !!a && a.note !== undefined && a.note !== null && a.note !== '';
    if (hasNote) evaluated += 1;

    if (eff.status !== 'na') {
      const proof = hasNote && a.note !== 'na' ? (PROOFS.includes(a.proof) ? a.proof : 'declared') : 'none';
      proofCounts[proof] += 1;
    }

    if (eff.excluded) continue;
    const w = c.weight || 1;
    acc.applicable += 1;
    acc.possible += 2 * w;
    acc.points += eff.value * w;
    if (eff.proven) acc.provenPoints += eff.value * w;

    if (c.blocking && eff.value < 2) blockingFailures.push(c.id);
  }

  let weightSum = 0;
  let weighted = 0;
  let provenWeighted = 0;
  const pillarScores = [];
  for (const p of pillars) {
    const acc = pillarAcc[p.id];
    const applicable = acc.possible > 0;
    const ratio = applicable ? acc.points / acc.possible : null;
    if (applicable) {
      weightSum += p.weight;
      weighted += p.weight * ratio;
      provenWeighted += p.weight * (acc.provenPoints / acc.possible);
    }
    pillarScores.push({
      id: p.id, name: p.name, weight: p.weight,
      points: acc.points, possible: acc.possible, applicable: acc.applicable, total: acc.total,
      ratio, percent: applicable ? round1(ratio * 100) : null
    });
  }

  // Poids effectif de chaque pilier après renormalisation.
  for (const ps of pillarScores) {
    ps.effectiveWeight = ps.ratio === null || weightSum === 0 ? 0 : round1((ps.weight / weightSum) * 100);
    ps.contribution = ps.ratio === null || weightSum === 0 ? 0 : round1((ps.weight * ps.ratio / weightSum) * 100);
  }

  const raw = weightSum > 0 ? (weighted / weightSum) * 100 : 0;
  const rawRounded = Math.round(raw);
  const capped = blockingFailures.length > 0 && rawRounded > BLOCKING_CAP;
  const score = blockingFailures.length > 0 ? Math.min(rawRounded, BLOCKING_CAP) : rawRounded;
  const provenScore = weightSum > 0 ? (provenWeighted / weightSum) * 100 : 0;
  const provenShare = raw > 0 ? Math.round((provenScore / raw) * 100) : 0;

  const totalCriteria = criteria.length;
  const applicableCount = totalCriteria - counts.na;
  const evidenced = proofCounts.machine + proofCounts.human;

  const light = trafficLight(score);
  return {
    score,
    rawScore: round1(raw),
    capped,
    blockingFailures,
    light,
    lightLabel: LIGHT_LABELS[light],
    pillars: pillarScores,
    perCriterion,
    counts,
    proofCounts,
    evaluated,
    totalCriteria,
    verifiedPercent: Math.round((evaluated / totalCriteria) * 100),
    evidencedPercent: applicableCount > 0 ? Math.round((evidenced / applicableCount) * 100) : 0,
    provenShare,
    weightSum
  };
}

/**
 * Points de score global perdus par un critère (avant plafonnement) —
 * utilisé pour trier les risques par impact.
 */
export function lostPoints(criterion, eff, scoreResult) {
  if (eff.excluded) return 0;
  const p = scoreResult.pillars.find((x) => x.id === criterion.pillar);
  if (!p || !p.possible || !scoreResult.weightSum) return 0;
  const w = criterion.weight || 1;
  return ((2 - eff.value) * w / p.possible) * (p.weight / scoreResult.weightSum) * 100;
}

/**
 * Liste des risques prioritaires : critères non conformes, triés par
 * bloquant > criticité > points perdus.
 */
export function priorityRisks(scoreResult, referential) {
  const risks = [];
  for (const c of referential.criteria) {
    const eff = scoreResult.perCriterion[c.id];
    if (!eff || eff.status === 'conform' || eff.status === 'na') continue;
    risks.push({
      id: c.id,
      name: c.name,
      pillar: c.pillar,
      blocking: !!c.blocking,
      criticality: c.criticality,
      status: eff.status,
      value: eff.value,
      reason: eff.reason,
      lost: round1(lostPoints(c, eff, scoreResult)),
      correction: c.correction
    });
  }
  risks.sort((a, b) =>
    (Number(b.blocking) - Number(a.blocking)) ||
    ((CRITICALITY_RANK[b.criticality] || 0) - (CRITICALITY_RANK[a.criticality] || 0)) ||
    (b.lost - a.lost) ||
    a.id.localeCompare(b.id)
  );
  return risks;
}

const EFFORT_RANK = { 'très faible': 0, faible: 1, moyen: 2, 'élevé': 3 };

/**
 * Plan de correction priorisé : P0 = critère bloquant, P1 = criticité élevée,
 * P2 = criticité moyenne non conforme, P3 = criticité moyenne partielle ou non vérifiée.
 * Trié par priorité puis par effort croissant (impact sur la sécurité, puis effort).
 */
export function correctionPlan(scoreResult, referential, corrections) {
  const byId = {};
  for (const k of corrections) byId[k.id] = k;
  const risks = priorityRisks(scoreResult, referential);
  const items = risks.map((r) => {
    let priority;
    if (r.blocking) priority = 'P0';
    else if (r.criticality === 'élevée') priority = 'P1';
    else if (r.status === 'nonconform') priority = 'P2';
    else priority = 'P3';
    const k = byId[r.correction] || null;
    return {
      criterion: r.id,
      name: r.name,
      priority,
      status: r.status,
      correction: r.correction,
      correctionTitle: k ? k.title : '',
      action: k ? k.solution : '',
      effort: k ? k.effort : 'moyen',
      lost: r.lost
    };
  });
  items.sort((a, b) =>
    a.priority.localeCompare(b.priority) ||
    ((EFFORT_RANK[a.effort] ?? 2) - (EFFORT_RANK[b.effort] ?? 2)) ||
    (b.lost - a.lost) ||
    a.criterion.localeCompare(b.criterion)
  );
  return items;
}

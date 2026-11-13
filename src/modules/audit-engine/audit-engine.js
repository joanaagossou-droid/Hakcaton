/**
 * NUKUN — Moteur d'audit (module pur) : modèle d'un audit et fusion des sources.
 *
 * Sources possibles d'une évaluation de critère, de la plus forte à la plus faible :
 *   manual    → réponse saisie par l'auditeur (toujours prioritaire)
 *   reference → évaluation de référence de l'équipe pour HAVEN / LIGHT (remplaçable)
 *   scenario  → verdict d'un scénario du Test de l'agresseur intime (🧪)
 *   analyzer  → constat de l'analyse automatique (🤖)
 *
 * Règles :
 *  - une source automatique (scenario, analyzer) ne remplace jamais une réponse manual/reference ;
 *  - entre sources automatiques, la note la plus basse l'emporte (prudence) ;
 *  - si un scénario contredit une réponse manuelle (note plus basse), l'écart est signalé.
 */

export const AUDIT_VERSION = 1;
export const AUDIT_TYPES = {
  self: 'Auto-évaluation, non certifiée',
  cross: 'Audit croisé',
  third: 'Audit tiers'
};
export const VERDICT_NOTES = { exposed: 0, partial: 1, protected: 2, unverified: null };

const STRONG = ['manual', 'reference'];
/** Liens scénario → critères (identiques à scenarios.json, mémoire § 5). */
export const SCENARIO_LINKS = { T1: ['S3'], T2: ['S4'], T3: ['S1', 'S3'], T4: ['S1'], T5: ['C1', 'N5'], T6: ['C1'], T7: ['R2', 'R5', 'N4'], T8: ['E4', 'C2', 'R1'], T9: ['A3', 'A2'] };

export function newId() {
  const b = new Uint8Array(6);
  globalThis.crypto.getRandomValues(b);
  return 'a' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function createAudit(meta = {}, now = new Date().toISOString()) {
  return {
    v: AUDIT_VERSION,
    id: newId(),
    createdAt: now,
    updatedAt: now,
    parentId: meta.parentId || null,
    meta: {
      projectName: clean(meta.projectName, 120) || 'Outil sans nom',
      url: clean(meta.url, 2048),
      toolType: clean(meta.toolType, 60),
      mainFunction: clean(meta.mainFunction, 200),
      audience: clean(meta.audience, 200),
      auditType: AUDIT_TYPES[meta.auditType] ? meta.auditType : 'self',
      mode: meta.mode === 'design' ? 'design' : 'audit',
      caseId: ['haven', 'light'].includes(meta.caseId) ? meta.caseId : null,
      usesAI: !!meta.usesAI,
      express: !!meta.express
    },
    analysis: null,
    automatic: {},     // { criterionId: { analyzer?: {...}, scenario:T4?: {...} } }
    assessments: {},   // évaluations effectives (calculées par resolveAssessments)
    manual: {},        // { criterionId: {note, proof, comment, naReason, attachment, source:'manual'|'reference'} }
    scenarios: {},     // { T1: {verdict, notes, attachment, at} }
    plan: {},          // { criterionId: 'todo'|'doing'|'done' }
    reference: null
  };
}

/** Nettoie une chaîne saisie : type, longueur, caractères de contrôle. */
export function clean(v, max = 500) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max).trim();
}

/** Applique un résultat d'analyse automatique. */
export function applyAnalysis(audit, result) {
  audit.analysis = result;
  for (const id of Object.keys(audit.automatic)) delete audit.automatic[id].analyzer;
  for (const [id, s] of Object.entries(result.suggestions || {})) {
    audit.automatic[id] = audit.automatic[id] || {};
    audit.automatic[id].analyzer = { note: s.note, proof: 'machine', comment: s.comment, source: 'analyzer' };
  }
  return resolveAssessments(audit);
}

/** Enregistre le verdict d'un scénario et propage aux critères liés. */
export function applyScenario(audit, scenario, verdict, notes = '', attachment = null) {
  const prev = audit.scenarios[scenario.id] || {};
  audit.scenarios[scenario.id] = {
    verdict: VERDICT_NOTES.hasOwnProperty(verdict) ? verdict : 'unverified',
    notes: clean(notes, 2000),
    attachment: attachment === undefined ? prev.attachment || null : attachment,
    at: new Date().toISOString()
  };
  const note = VERDICT_NOTES[audit.scenarios[scenario.id].verdict];
  for (const cid of scenario.criteria) {
    audit.automatic[cid] = audit.automatic[cid] || {};
    const key = 'scenario:' + scenario.id;
    if (note === null || note === undefined) delete audit.automatic[cid][key];
    else audit.automatic[cid][key] = { note, proof: 'human', comment: `Scénario ${scenario.id} — ${scenario.title}`, source: key };
  }
  return resolveAssessments(audit);
}

/** Saisie manuelle d'un critère (null pour effacer). */
export function setManual(audit, criterionId, value) {
  if (!value) { delete audit.manual[criterionId]; return resolveAssessments(audit); }
  const note = value.note === 'na' ? 'na' : [0, 1, 2].includes(value.note) ? value.note : null;
  audit.manual[criterionId] = {
    note,
    proof: ['machine', 'human', 'declared'].includes(value.proof) ? value.proof : 'declared',
    comment: clean(value.comment, 2000),
    naReason: clean(value.naReason, 500),
    attachment: value.attachment || null,
    source: value.source === 'reference' ? 'reference' : 'manual'
  };
  return resolveAssessments(audit);
}

/** Charge l'évaluation de référence de l'équipe (HAVEN / LIGHT). */
export function applyReference(audit, ref, { scenarios = true } = {}) {
  audit.reference = { case: ref.case, testedBy: ref.testedBy, testedOn: ref.testedOn, note: ref.note };
  for (const [id, a] of Object.entries(ref.assessments)) {
    if (audit.manual[id] && audit.manual[id].source === 'manual') continue;
    audit.manual[id] = { ...a, attachment: null, source: 'reference', comment: clean(a.comment || '', 2000), naReason: clean(a.naReason || '', 500) };
  }
  return resolveAssessments(audit);
}

export function applyReferenceScenarios(audit, ref, scenarioDefs, onlyMissing = true) {
  for (const s of scenarioDefs) {
    const r = ref.scenarios && ref.scenarios[s.id];
    if (!r) continue;
    if (onlyMissing && audit.scenarios[s.id] && audit.scenarios[s.id].verdict) continue;
    applyScenario(audit, s, r.verdict, `[Référence équipe] ${r.notes}`);
  }
  return resolveAssessments(audit);
}

/** Calcule les évaluations effectives et les incohérences. */
export function resolveAssessments(audit) {
  const out = {};
  const ids = new Set([...Object.keys(audit.manual), ...Object.keys(audit.automatic)]);
  for (const id of ids) {
    const m = audit.manual[id];
    const autos = Object.values(audit.automatic[id] || {});
    let auto = null;
    for (const a of autos) {
      if (!auto || a.note < auto.note || (a.note === auto.note && a.proof === 'human' && auto.proof !== 'human')) auto = a;
    }
    if (m && m.note !== null && m.note !== undefined && STRONG.includes(m.source)) {
      const conflict = auto && m.note !== 'na' && auto.note < m.note
        ? `${auto.source === 'analyzer' ? 'L\'analyse automatique' : 'Le ' + auto.source.replace('scenario:', 'scénario ')} indique ${auto.note}/2 : à revoir.`
        : null;
      out[id] = { ...m, conflict, sources: autos.map((a) => a.source) };
    } else if (auto) {
      out[id] = { note: auto.note, proof: auto.proof, comment: auto.comment, source: auto.source, conflict: null, sources: autos.map((a) => a.source) };
    }
  }
  audit.assessments = out;
  audit.updatedAt = new Date().toISOString();
  return audit;
}

/** Prépare un ré-audit après correction : même description, réponses à revérifier. */
export function createReaudit(parent) {
  const a = createAudit({ ...parent.meta, parentId: parent.id });
  a.meta.projectName = parent.meta.projectName;
  return a;
}

/** Validation d'un audit importé (JSON) : structure minimale, types, tailles. */
export function sanitizeImported(obj) {
  if (!obj || typeof obj !== 'object' || obj.v !== AUDIT_VERSION || typeof obj.id !== 'string') return null;
  const a = createAudit(obj.meta || {}, typeof obj.createdAt === 'string' ? obj.createdAt.slice(0, 40) : undefined);
  a.id = /^a[0-9a-f]{12}$/.test(obj.id) ? obj.id : a.id;
  a.parentId = typeof obj.parentId === 'string' && /^a[0-9a-f]{12}$/.test(obj.parentId) ? obj.parentId : null;
  const okNote = (n) => n === 'na' || [0, 1, 2].includes(n);
  for (const [id, m] of Object.entries(obj.manual || {})) {
    if (!/^[CSARNE][1-5]$/.test(id) || !m || !okNote(m.note)) continue;
    a.manual[id] = {
      note: m.note, proof: ['machine', 'human', 'declared'].includes(m.proof) ? m.proof : 'declared',
      comment: clean(m.comment, 2000), naReason: clean(m.naReason, 500),
      attachment: typeof m.attachment === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(m.attachment) && m.attachment.length < 200000 ? m.attachment : null,
      source: m.source === 'reference' ? 'reference' : 'manual'
    };
  }
  for (const [id, s] of Object.entries(obj.scenarios || {})) {
    if (!/^T[1-9]$/.test(id) || !s) continue;
    a.scenarios[id] = {
      verdict: VERDICT_NOTES.hasOwnProperty(s.verdict) ? s.verdict : 'unverified', notes: clean(s.notes, 2000),
      attachment: typeof s.attachment === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s.attachment) && s.attachment.length < 200000 ? s.attachment : null,
      at: typeof s.at === 'string' ? s.at.slice(0, 40) : null
    };
  }
  // Propagation des verdicts importés vers les critères liés (mémoire § 5).
  for (const [sid, s] of Object.entries(a.scenarios)) {
    const note = VERDICT_NOTES[s.verdict];
    if (note === null || note === undefined) continue;
    for (const cid of SCENARIO_LINKS[sid] || []) {
      a.automatic[cid] = a.automatic[cid] || {};
      a.automatic[cid]['scenario:' + sid] = { note, proof: 'human', comment: `Scénario ${sid}`, source: 'scenario:' + sid };
    }
  }
  for (const [id, st] of Object.entries(obj.plan || {})) {
    if (/^[CSARNE][1-5]$/.test(id) && ['todo', 'doing', 'done'].includes(st)) a.plan[id] = st;
  }
  // L'analyse importée n'est pas réutilisée telle quelle (elle pourrait être falsifiée) :
  // seules ses suggestions sont relues, et marquées comme importées.
  if (obj.analysis && obj.analysis.suggestions && typeof obj.analysis.suggestions === 'object') {
    for (const [id, s] of Object.entries(obj.analysis.suggestions)) {
      if (!/^[CSARNE][1-5]$/.test(id) || !s || ![0, 1, 2].includes(s.note)) continue;
      a.automatic[id] = { analyzer: { note: s.note, proof: 'declared', comment: '[Importé] ' + clean(s.comment, 500), source: 'analyzer' } };
    }
  }
  return resolveAssessments(a);
}

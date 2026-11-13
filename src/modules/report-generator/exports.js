/**
 * NUKUN — Documents exportables, générés localement (module pur, sans DOM).
 *
 * Six documents PDF : rapport complet, fiche technique, fiche d'analyse des
 * risques, résumé, plan de correction, comparaison avant/après. Chacun contient
 * le socle commun exigé : outil, date, type d'audit, score, six piliers,
 * critères et preuves, scénarios, risques prioritaires, recommandations,
 * limites et mention de non-certification.
 */
import { PdfDoc } from './pdf-writer.js';
import { PROOF_SHORT, STATUS_LABELS, sourceLabel } from './report-model.js';
import { LIGHT_LABELS } from '../scoring/scoring.js';

export const DOC_TYPES = {
  report: 'Rapport complet',
  tech: 'Fiche technique',
  risks: 'Fiche d\'analyse des risques',
  summary: 'Résumé des résultats',
  plan: 'Plan de correction',
  compare: 'Comparaison avant / après'
};

const LIGHT_NAMES = { red: 'ROUGE', orange: 'ORANGE', green: 'VERT' };
const LIGHT_COLORS = { red: '#c62828', orange: '#e07b00', green: '#1f8a4c' };
const VERDICTS = { exposed: 'Afi est exposée', partial: 'Risque partiellement maîtrisé', protected: 'Afi est protégée dans le périmètre testé', unverified: 'Non vérifié' };
const PLAN_STATES = { todo: 'À faire', doing: 'En cours', done: 'Fait' };
const day = (iso) => { try { return new Date(iso).toLocaleDateString('fr-FR'); } catch { return String(iso).slice(0, 10); } };

function header(pdf, r, docTitle) {
  pdf.rect(0, pdf.pageH - 74, pdf.pageW, 74, '#0b1f3a');
  pdf.text(pdf.margin, pdf.pageH - 34, 'NUKUN', { size: 20, bold: true, color: '#5eead4' });
  pdf.text(pdf.margin + 82, pdf.pageH - 34, docTitle, { size: 13, bold: true, color: '#ffffff' });
  pdf.text(pdf.margin, pdf.pageH - 54, 'L\'œil qui vérifie qu\'un outil protège sans exposer.', { size: 9, color: '#cfe9ef' });
  pdf.y = pdf.pageH - 96;
  pdf.para(`Outil audité : ${r.meta.projectName}${r.meta.url ? '  ·  ' + r.meta.url : ''}`, { size: 11, bold: true });
  pdf.para(`Date de l'audit : ${day(r.updatedAt)}  ·  Type : ${r.auditTypeLabel}${r.meta.caseId ? '  ·  Cas de démonstration FICTIF' : ''}`, { size: 9.5 });
  if (r.meta.mainFunction || r.meta.audience || r.meta.toolType) pdf.para(`Type d'outil : ${r.meta.toolType || '—'}  ·  Fonction : ${r.meta.mainFunction || '—'}  ·  Public : ${r.meta.audience || '—'}`, { size: 9.5 });
  scoreBox(pdf, r);
}

function scoreBox(pdf, r) {
  const s = r.score;
  pdf.ensure(70);
  pdf.y -= 62;
  pdf.rect(pdf.margin, pdf.y, pdf.pageW - 2 * pdf.margin, 56, '#f2f6fa');
  pdf.rect(pdf.margin, pdf.y, 6, 56, LIGHT_COLORS[s.light]);
  pdf.text(pdf.margin + 18, pdf.y + 24, `${s.score}/100`, { size: 24, bold: true, color: LIGHT_COLORS[s.light] });
  pdf.text(pdf.margin + 120, pdf.y + 34, `Feu ${LIGHT_NAMES[s.light]} — ${LIGHT_LABELS[s.light]}`, { size: 10.5, bold: true });
  pdf.text(pdf.margin + 120, pdf.y + 18, `Part prouvée : ${s.provenShare} %  ·  Critères vérifiés : ${s.verifiedPercent} %  ·  Appuyés par une preuve : ${s.evidencedPercent} %`, { size: 8.5 });
  pdf.text(pdf.margin + 120, pdf.y + 6, s.capped ? `Score plafonné à 49 (brut ${s.rawScore}) : critère(s) bloquant(s) non conforme(s) ${s.blockingFailures.join(', ')}` : (s.blockingFailures.length ? `Critère(s) bloquant(s) non conforme(s) : ${s.blockingFailures.join(', ')}` : 'Aucun critère bloquant non conforme'), { size: 8.5, bold: !!s.blockingFailures.length, color: s.blockingFailures.length ? '#c62828' : '#1f8a4c' });
  pdf.y -= 8;
  pdf.para(r.disclaimer, { size: 8.5, color: '#5b3a00' });
}

function pillars(pdf, r) {
  pdf.heading('Scores par pilier', 2);
  for (const p of r.score.pillars) {
    const col = p.percent === null ? '#9aa5b1' : p.percent >= 80 ? '#1f8a4c' : p.percent >= 50 ? '#e07b00' : '#c62828';
    pdf.bar(`${p.id} · ${p.name} (${p.weight} %)`, p.percent, col);
  }
  pdf.spacer(4);
  const c = r.score.counts;
  pdf.para(`Conformes : ${c.conform}  ·  Partiels : ${c.partial}  ·  Non conformes : ${c.nonconform}  ·  Non vérifiés : ${c.unverified}  ·  N/A : ${c.na}  ·  Bloquants en échec : ${r.score.blockingFailures.length}/5`, { size: 9 });
  const pc = r.score.proofCounts;
  pdf.para(`Niveaux de preuve : Machine ${pc.machine}  ·  Humain ${pc.human}  ·  Déclaration ${pc.declared}  ·  Non évalué ${pc.none}`, { size: 9 });
}

function criteriaTable(pdf, r, compact = false) {
  pdf.heading('Critères et preuves', 2);
  const rows = r.criteria.map((c) => [
    c.id + (c.blocking ? ' (B)' : ''),
    c.name,
    c.note === 'na' ? 'N/A' : c.note === null || c.note === undefined ? '—' : `${c.note}/2${c.value !== c.note ? ` → ${c.value}` : ''}`,
    STATUS_LABELS[c.status],
    PROOF_SHORT[c.proof],
    compact ? sourceLabel(c.source) : `${sourceLabel(c.source)}${c.comment ? ' — ' + c.comment : ''}${c.conflict ? ' [' + c.conflict + ']' : ''}`
  ]);
  pdf.table([
    { label: 'Code', width: 0.08 }, { label: 'Critère', width: compact ? 0.42 : 0.26 }, { label: 'Note', width: 0.07 },
    { label: 'Statut', width: 0.11 }, { label: 'Preuve', width: 0.09 }, { label: compact ? 'Source' : 'Source et justification', width: compact ? 0.23 : 0.39 }
  ], rows, { size: compact ? 7.5 : 7.5 });
  pdf.para('(B) = critère bloquant. « Note → valeur » : note saisie et valeur retenue après application des règles de preuve.', { size: 7.5, color: '#5b6b7f' });
}

function scenariosSection(pdf, r) {
  pdf.heading('Test de l\'agresseur intime — 7 scénarios', 2);
  pdf.table([{ label: 'Scénario', width: 0.25 }, { label: 'Critères', width: 0.1 }, { label: 'Verdict', width: 0.25 }, { label: 'Observations', width: 0.4 }],
    r.scenarios.map((s) => [`${s.id} · ${s.title}`, s.criteria.join(', '), s.verdict ? VERDICTS[s.verdict] : 'Non exécuté', s.notes || '']), { size: 8 });
  pdf.para('Un verdict ne vaut que pour le périmètre testé ; il ne constitue pas une garantie de protection.', { size: 7.5, color: '#5b6b7f' });
}

function risksSection(pdf, r, max = 10) {
  pdf.heading('Risques prioritaires', 2);
  if (!r.risks.length) { pdf.para('Aucun critère non conforme ou non vérifié.', { size: 9 }); return; }
  pdf.table([{ label: 'Critère', width: 0.36 }, { label: 'Statut', width: 0.14 }, { label: 'Bloquant', width: 0.1 }, { label: 'Criticité', width: 0.12 }, { label: 'Points perdus', width: 0.13 }, { label: 'Correctif', width: 0.15 }],
    r.risks.slice(0, max).map((x) => [`${x.id} · ${x.name}`, STATUS_LABELS[x.status], x.blocking ? 'Oui' : 'Non', x.criticality, String(x.lost), x.correction]), { size: 8 });
  if (r.risks.length > max) pdf.para(`… et ${r.risks.length - max} autre(s) point(s) : voir le plan de correction.`, { size: 8 });
}

function recommendations(pdf, r, max = 8) {
  pdf.heading('Recommandations', 2);
  if (!r.plan.length) { pdf.para('Aucune correction requise sur les critères évalués. Poursuivre les tests humains et faire réaliser un audit tiers.', { size: 9 }); return; }
  for (const p of r.plan.slice(0, max)) pdf.bullet(`${p.priority} · ${p.criterion} ${p.name} — ${p.correctionTitle} (effort ${p.effort}) : ${p.action}`, { size: 8.5 });
}

function limits(pdf, r) {
  pdf.heading('Limites de l\'analyse', 2);
  for (const l of r.limits) pdf.bullet(l, { size: 8.5 });
  pdf.para('Hors périmètre NUKUN (test d\'intrusion professionnel sous mandat recommandé) : ' + r.outOfScope.join(' ; ') + '.', { size: 8.5 });
  if (r.reference) pdf.para(`Évaluations de référence : ${r.reference.testedBy}, ${day(r.reference.testedOn)}. ${r.reference.note}`, { size: 8 });
  pdf.spacer(4);
  pdf.para(r.disclaimer, { size: 9, bold: true, color: '#5b3a00' });
}

function commonBase(pdf, r, { compact = true } = {}) {
  pillars(pdf, r);
  scenariosSection(pdf, r);
  risksSection(pdf, r);
  recommendations(pdf, r);
  criteriaTable(pdf, r, compact);
  limits(pdf, r);
}

function newDoc(r, type) {
  return new PdfDoc({ title: `NUKUN — ${DOC_TYPES[type]} — ${r.meta.projectName}`, footer: `NUKUN · ${DOC_TYPES[type]} · ${r.meta.projectName} · ${day(r.updatedAt)} · Indicateur, pas une certification` });
}

export function buildPdf(type, r, data = {}) {
  const pdf = newDoc(r, type);
  header(pdf, r, DOC_TYPES[type]);

  if (type === 'report') {
    if (r.analysis) {
      pdf.heading('Analyse automatique (module 0)', 2);
      pdf.para(`Mode : ${r.analysis.mode} · ${day(r.analysis.analyzedAt)} · ${r.analysis.pages.length} page(s) · adresse : ${r.analysis.entryUrl}`, { size: 8.5 });
      pdf.table([{ label: 'Élément', width: 0.27 }, { label: 'Résultat', width: 0.14 }, { label: 'Constat', width: 0.45 }, { label: 'Critères', width: 0.14 }],
        r.analysis.findings.map((f) => [f.label, { detected: 'Détecté', not_detected: 'Non détecté', partial: 'Partiel', unverifiable: 'Non vérifiable' }[f.status] || f.status, f.evidence, (f.criteria || []).join(', ')]), { size: 7.5 });
    }
    pillars(pdf, r);
    scenariosSection(pdf, r);
    risksSection(pdf, r, 30);
    recommendations(pdf, r, 5);
    pdf.heading('Plan de correction', 2);
    planTable(pdf, r);
    criteriaTable(pdf, r, false);
    limits(pdf, r);
  } else if (type === 'tech') {
    pdf.heading('Fiche technique', 2);
    pdf.table([{ label: 'Rubrique', width: 0.25 }, { label: 'Contenu', width: 0.75 }], [
      ['Besoin', r.meta.mainFunction || 'À préciser'],
      ['Public', r.meta.audience || 'À préciser'],
      ['Type d\'outil', r.meta.toolType || 'À préciser'],
      ['Adresse', r.meta.url || '—'],
      ['Tests réalisés', `Analyse automatique : ${r.analysis ? `oui (${r.analysis.mode}, ${day(r.analysis.analyzedAt)})` : 'non'} · Scénarios exécutés : ${r.scenariosExecuted}/7 · Critères évalués : ${r.score.evaluated}/30`],
      ['Résultat', `${r.score.score}/100, feu ${LIGHT_NAMES[r.score.light]} (${r.score.lightLabel}), part prouvée ${r.score.provenShare} %`],
      ['Limites', 'Voir la section « Limites de l\'analyse ».'],
      ['Conditions avant un usage réel', 'Corriger tous les critères bloquants ; faire réaliser un audit tiers ; valider le contenu avec une structure spécialisée ; vérifier chaque contact auprès d\'une source institutionnelle ; test d\'intrusion sous mandat ; revue juridique.']
    ], { size: 9 });
    commonBase(pdf, r);
  } else if (type === 'risks') {
    pdf.heading('Fiche d\'analyse des risques', 2);
    const byId = Object.fromEntries((data.criteria || []).map((c) => [c.id, c]));
    const kById = Object.fromEntries((data.corrections || []).map((k) => [k.id, k]));
    pdf.table([{ label: 'Risque (critère)', width: 0.28 }, { label: 'Conséquence pour la survivante', width: 0.36 }, { label: 'Mesure', width: 0.36 }],
      r.risks.map((x) => [`${x.id} · ${x.name}${x.blocking ? ' (bloquant)' : ''} — ${STATUS_LABELS[x.status]}`, byId[x.id] ? byId[x.id].survivorWhy : '', kById[x.correction] ? kById[x.correction].solution : x.correction]), { size: 8 });
    commonBase(pdf, r);
  } else if (type === 'summary') {
    pdf.heading('Résumé des résultats', 2);
    pdf.bullet(`Score : ${r.score.score}/100 — feu ${LIGHT_NAMES[r.score.light]} : ${r.score.lightLabel}.`);
    pdf.bullet(`${r.score.counts.conform} critère(s) conforme(s), ${r.score.counts.partial} partiel(s), ${r.score.counts.nonconform} non conforme(s), ${r.score.counts.unverified} non vérifié(s), ${r.score.counts.na} N/A.`);
    pdf.bullet(`Critères bloquants en échec : ${r.score.blockingFailures.length ? r.score.blockingFailures.join(', ') : 'aucun'}.`);
    pdf.bullet(`Scénarios exécutés : ${r.scenariosExecuted}/7 ; exposition constatée : ${r.scenarios.filter((s) => s.verdict === 'exposed').map((s) => s.id).join(', ') || 'aucune'}.`);
    pdf.bullet(`Priorité : ${r.plan.slice(0, 3).map((p) => `${p.criterion} (${p.correctionTitle})`).join(' ; ') || 'aucune correction requise'}.`);
    commonBase(pdf, r);
  } else if (type === 'plan') {
    pdf.heading('Plan de correction priorisé', 2);
    pdf.para('P0 : critère bloquant (immédiat) · P1 : criticité élevée (sous 1 mois) · P2 : criticité moyenne non conforme (sous 3 mois) · P3 : à consolider. Tri par impact sur la sécurité, puis par effort.', { size: 8.5 });
    planTable(pdf, r);
    pdf.para(`Progression des corrections : ${r.planProgress} %.`, { size: 9, bold: true });
    commonBase(pdf, r);
  } else if (type === 'compare') {
    const after = data.after;
    pdf.heading('Comparaison avant / après', 2);
    if (!after) pdf.para('Aucun audit « après » sélectionné.', { size: 9 });
    else compareSection(pdf, r, after);
    commonBase(pdf, r);
  }
  return pdf.build();
}

function planTable(pdf, r) {
  if (!r.plan.length) { pdf.para('Aucune action requise sur les critères évalués.', { size: 9 }); return; }
  pdf.table([{ label: 'Priorité', width: 0.08 }, { label: 'Critère', width: 0.24 }, { label: 'Action (correctif du kit)', width: 0.46 }, { label: 'Effort', width: 0.1 }, { label: 'État', width: 0.12 }],
    r.plan.map((p) => [p.priority, `${p.criterion} · ${p.name}`, `${p.correctionTitle} : ${p.action}`, p.effort, PLAN_STATES[p.state] || 'À faire']), { size: 7.8 });
}

export function compareSection(pdf, before, after) {
  pdf.para(`Avant : ${before.meta.projectName} — ${before.score.score}/100 (${LIGHT_NAMES[before.score.light]}) · Après : ${after.meta.projectName} — ${after.score.score}/100 (${LIGHT_NAMES[after.score.light]})`, { size: 10.5, bold: true });
  pdf.table([{ label: 'Pilier', width: 0.4 }, { label: 'Avant', width: 0.2 }, { label: 'Après', width: 0.2 }, { label: 'Écart', width: 0.2 }],
    before.score.pillars.map((p, i) => {
      const a = after.score.pillars[i];
      const d = p.percent === null || a.percent === null ? '—' : `${a.percent - p.percent > 0 ? '+' : ''}${Math.round(a.percent - p.percent)}`;
      return [`${p.id} · ${p.name}`, p.percent === null ? 'N/A' : `${p.percent} %`, a.percent === null ? 'N/A' : `${a.percent} %`, d];
    }), { size: 8.5 });
  const changed = before.criteria.map((c, i) => [c, after.criteria[i]]).filter(([b, a]) => b.status !== a.status);
  pdf.para(`Critères dont le statut a changé : ${changed.length}`, { size: 9, bold: true });
  pdf.table([{ label: 'Critère', width: 0.5 }, { label: 'Avant', width: 0.25 }, { label: 'Après', width: 0.25 }],
    changed.map(([b, a]) => [`${b.id} · ${b.name}`, STATUS_LABELS[b.status], STATUS_LABELS[a.status]]), { size: 8 });
  const still = after.criteria.filter((c) => c.status !== 'conform' && c.status !== 'na');
  pdf.para(`Points toujours non validés après correction : ${still.map((c) => `${c.id} (${STATUS_LABELS[c.status]})`).join(', ') || 'aucun'}.`, { size: 9 });
}

/** Export JSON (réimportable) : l'audit complet, sans pièces jointes si demandé. */
export function auditToJson(audit, { withAttachments = false } = {}) {
  const copy = JSON.parse(JSON.stringify(audit));
  if (!withAttachments) {
    for (const m of Object.values(copy.manual || {})) m.attachment = null;
    for (const s of Object.values(copy.scenarios || {})) s.attachment = null;
  }
  copy.exportedAt = new Date().toISOString();
  copy.notice = 'Export NUKUN. Ne contient aucune donnée réelle de survivante. Score : indicateur, pas une certification.';
  return JSON.stringify(copy, null, 2);
}

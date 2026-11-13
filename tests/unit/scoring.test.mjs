/** F3 — Règles de notation (mémoire § 4, § 4 bis ; essais F2, F3, S-12). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeScore, effectiveNote, priorityRisks, correctionPlan, trafficLight } from '../../src/modules/scoring/scoring.js';
import { referential, corrections, allConform } from '../helpers.mjs';

test('référentiel : 30 critères, 6 piliers, pondérations = 100 %, 5 bloquants', () => {
  assert.equal(referential.criteria.length, 30);
  assert.equal(referential.pillars.length, 6);
  assert.equal(referential.pillars.reduce((s, p) => s + p.weight, 0), 100);
  for (const p of referential.pillars) assert.equal(referential.criteria.filter((c) => c.pillar === p.id).length, 5);
  assert.deepEqual(referential.criteria.filter((c) => c.blocking).map((c) => c.id).sort(), ['C1', 'C2', 'N1', 'R1', 'S1']);
  const weights = Object.fromEntries(referential.pillars.map((p) => [p.id, p.weight]));
  assert.deepEqual(weights, { C: 25, S: 20, A: 15, R: 20, N: 10, E: 10 });
});

test('tout conforme et prouvé → 100, vert, aucun plafond', () => {
  const r = computeScore(allConform(), referential);
  assert.equal(r.score, 100);
  assert.equal(r.light, 'green');
  assert.equal(r.capped, false);
  assert.equal(r.provenShare, 100);
  assert.equal(r.counts.conform, 30);
});

test('audit vide → 0, rouge, les 5 critères bloquants non vérifiés', () => {
  const r = computeScore({}, referential);
  assert.equal(r.score, 0);
  assert.equal(r.light, 'red');
  assert.equal(r.blockingFailures.length, 5);
  assert.equal(r.counts.unverified, 30);
  assert.equal(r.verifiedPercent, 0);
});

test('un critère bloquant non conforme plafonne le score à 49', () => {
  const a = allConform();
  a.C1 = { note: 0, proof: 'machine' };
  const r = computeScore(a, referential);
  assert.ok(r.rawScore > 90, 'score brut élevé');
  assert.equal(r.score, 49);
  assert.equal(r.capped, true);
  assert.deepEqual(r.blockingFailures, ['C1']);
  assert.equal(r.light, 'red');
});

test('un critère bloquant partiel (1) plafonne aussi à 49', () => {
  const a = allConform();
  a.S1 = { note: 1, proof: 'human' };
  assert.equal(computeScore(a, referential).score, 49);
});

test('S-12 : une déclaration seule ne valide jamais un critère bloquant', () => {
  const a = allConform();
  a.R1 = { note: 2, proof: 'declared' };
  const r = computeScore(a, referential);
  assert.equal(r.perCriterion.R1.status, 'unverified');
  assert.equal(r.perCriterion.R1.value, 0);
  assert.equal(r.score, 49);
});

test('une déclaration seule plafonne un critère non bloquant à 1', () => {
  const eff = effectiveNote({ note: 2, proof: 'declared' }, referential.criteria.find((c) => c.id === 'A2'));
  assert.equal(eff.value, 1);
  assert.equal(eff.status, 'partial');
  assert.equal(eff.proven, false);
});

test('sans niveau de preuve, la règle la plus prudente (déclaration) s\'applique', () => {
  const eff = effectiveNote({ note: 2 }, referential.criteria.find((c) => c.id === 'A2'));
  assert.equal(eff.value, 1);
});

test('N/A justifié : exclu du calcul ; N/A non justifié : non vérifié', () => {
  const a = allConform();
  a.E3 = { note: 'na', naReason: 'Aucune IA utilisée' };
  a.A3 = { note: 0, proof: 'human' };
  const r = computeScore(a, referential);
  assert.equal(r.perCriterion.E3.status, 'na');
  const E = r.pillars.find((p) => p.id === 'E');
  assert.equal(E.possible, 8);
  assert.equal(E.percent, 100);
  const b = { ...a, E3: { note: 'na', naReason: '' } };
  const r2 = computeScore(b, referential);
  assert.equal(r2.perCriterion.E3.status, 'unverified');
  assert.equal(r2.pillars.find((p) => p.id === 'E').percent, 80);
});

test('pilier entièrement N/A : pondérations renormalisées', () => {
  const a = allConform();
  for (const id of ['E1', 'E2', 'E3', 'E4', 'E5']) a[id] = { note: 'na', naReason: 'Hors périmètre (test)' };
  a.A1 = { note: 0, proof: 'machine' };
  const r = computeScore(a, referential);
  assert.equal(r.weightSum, 90);
  // A : 8/10 × 15 = 12 → (25+20+12+20+10)/90 × 100 = 96,67 → 97
  assert.equal(r.score, 97);
  assert.equal(r.pillars.find((p) => p.id === 'E').effectiveWeight, 0);
});

test('calcul pilier par pilier, exemple documenté', () => {
  const a = allConform();
  a.C3 = { note: 1, proof: 'human' };   // C : 9/10 → 22,5
  a.A3 = { note: 0, proof: 'human' };   // A : 8/10 → 12
  a.E5 = { note: 2, proof: 'declared' };// E : 9/10 → 9
  const r = computeScore(a, referential);
  // 22,5 + 20 + 12 + 20 + 10 + 9 = 93,5 → 94
  assert.equal(r.rawScore, 93.5);
  assert.equal(r.score, 94);
});

test('feu tricolore : bornes 50 et 80', () => {
  assert.equal(trafficLight(49), 'red');
  assert.equal(trafficLight(50), 'orange');
  assert.equal(trafficLight(79), 'orange');
  assert.equal(trafficLight(80), 'green');
});

test('F2 — reproductibilité : 10 calculs identiques', () => {
  const a = allConform();
  a.C3 = { note: 1, proof: 'declared' };
  a.S1 = { note: 0, proof: 'machine' };
  const first = JSON.stringify(computeScore(a, referential));
  for (let i = 0; i < 10; i++) assert.equal(JSON.stringify(computeScore(a, referential)), first);
});

test('risques prioritaires et plan : bloquants d\'abord, P0', () => {
  const a = allConform();
  a.A3 = { note: 0, proof: 'human' };
  a.C1 = { note: 0, proof: 'machine' };
  a.R2 = { note: 1, proof: 'human' };
  const r = computeScore(a, referential);
  const risks = priorityRisks(r, referential);
  assert.deepEqual(risks.map((x) => x.id), ['C1', 'R2', 'A3']);
  const plan = correctionPlan(r, referential, corrections);
  assert.equal(plan[0].criterion, 'C1');
  assert.equal(plan[0].priority, 'P0');
  assert.equal(plan.find((p) => p.criterion === 'R2').priority, 'P1');
  assert.equal(plan.find((p) => p.criterion === 'A3').priority, 'P2');
});

test('part prouvée : les points déclarés ne comptent pas comme prouvés', () => {
  const a = allConform();
  for (const id of ['E1', 'E2', 'E4', 'E5', 'E3']) a[id] = { note: 2, proof: 'declared' };
  const r = computeScore(a, referential);
  // E : 5/10 → 5 points déclarés sur 95 → part prouvée 90/95 ≈ 95 %
  assert.equal(r.score, 95);
  assert.equal(r.provenShare, 95);
});

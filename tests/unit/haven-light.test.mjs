/** F1, F4 — Analyse réelle de HAVEN et LIGHT + calcul du score par le moteur (aucun score défini à la main). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { runAnalysis } from '../../src/modules/url-analyzer/analyzer-core.js';
import { createAudit, applyAnalysis, applyReference, applyReferenceScenarios, setManual, applyScenario } from '../../src/modules/audit-engine/audit-engine.js';
import { computeScore } from '../../src/modules/scoring/scoring.js';
import { startServer, localFetcher, referential, scenarios, readJson } from '../helpers.mjs';

async function fullAudit(base, site) {
  const analysis = await runAnalysis(`${base}/${site}/`, localFetcher, { mode: 'navigateur' });
  const audit = createAudit({ projectName: site, caseId: site });
  applyAnalysis(audit, analysis);
  applyReference(audit, readJson(`src/data/reference/${site}.json`));
  applyReferenceScenarios(audit, readJson(`src/data/reference/${site}.json`), scenarios);
  return { audit, analysis, score: computeScore(audit.assessments, referential) };
}

test('HAVEN et LIGHT : analyse réelle, résultats réellement différents', async () => {
  const s = await startServer();
  try {
    const haven = await fullAudit(s.base, 'haven');
    const light = await fullAudit(s.base, 'light');

    // F4 : chaque défaut observable de HAVEN est détecté
    const hf = Object.fromEntries(haven.analysis.findings.map((f) => [f.id, f.status]));
    assert.equal(hf.trackers, 'detected');
    assert.equal(hf['quick-exit'], 'not_detected');
    assert.equal(hf['required-ident'], 'detected');
    assert.equal(hf.phones, 'not_detected');
    assert.equal(hf.privacy, 'partial');
    assert.equal(hf.weight, 'not_detected');
    assert.equal(hf['cookies-consent'], 'detected');
    // … et aucun faux problème sur LIGHT
    const lf = Object.fromEntries(light.analysis.findings.map((f) => [f.id, f.status]));
    for (const id of ['trackers', 'pixels', 'third-party', 'required-ident']) assert.equal(lf[id], 'not_detected', id);
    for (const id of ['quick-exit', 'phones', 'privacy', 'weight', 'local-traces', 'device-warning']) assert.equal(lf[id], 'detected', id);

    // F1 : HAVEN rouge et plafonnée ; LIGHT verte sans critère bloquant en échec, mais pas 100
    assert.equal(haven.score.light, 'red');
    assert.ok(haven.score.score <= 49);
    assert.deepEqual(haven.score.blockingFailures.sort(), ['C1', 'C2', 'R1', 'S1']);
    assert.equal(light.score.blockingFailures.length, 0);
    assert.equal(light.score.light, 'green');
    assert.ok(light.score.score >= 80 && light.score.score < 100, `LIGHT = ${light.score.score}`);
    console.log(`    HAVEN : ${haven.score.score}/100 (brut ${haven.score.rawScore}) · LIGHT : ${light.score.score}/100 (brut ${light.score.rawScore}, en HTTP local)`);
  } finally { await s.close(); }
});

test('la réponse manuelle prime ; un scénario contradictoire est signalé', () => {
  const audit = createAudit({});
  const s4 = scenarios.find((s) => s.id === 'T4');
  setManual(audit, 'S1', { note: 2, proof: 'human' });
  applyScenario(audit, s4, 'exposed');
  assert.equal(audit.assessments.S1.note, 2);
  assert.match(audit.assessments.S1.conflict, /scénario T4/);
  setManual(audit, 'S1', null);
  assert.equal(audit.assessments.S1.note, 0);
  assert.equal(audit.assessments.S1.proof, 'human');
});

test('entre sources automatiques, la note la plus basse l\'emporte', () => {
  const audit = createAudit({});
  applyAnalysis(audit, { suggestions: { C1: { note: 2, comment: 'rien vu' } } });
  applyScenario(audit, scenarios.find((s) => s.id === 'T6'), 'partial');
  assert.equal(audit.assessments.C1.note, 1);
  applyScenario(audit, scenarios.find((s) => s.id === 'T6'), 'unverified');
  assert.equal(audit.assessments.C1.note, 2);
});

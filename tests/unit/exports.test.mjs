/** Génération des rapports et exports PDF (essais F1, S-6 dans l'export). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runAnalysis } from '../../src/modules/url-analyzer/analyzer-core.js';
import { createAudit, applyAnalysis, applyReference, applyReferenceScenarios, sanitizeImported } from '../../src/modules/audit-engine/audit-engine.js';
import { buildReport } from '../../src/modules/report-generator/report-model.js';
import { buildPdf, DOC_TYPES, auditToJson } from '../../src/modules/report-generator/exports.js';
import { toWinAnsi, pdfString } from '../../src/modules/report-generator/pdf-writer.js';
import { startServer, localFetcher, referential, scenarios, corrections, readJson, ROOT } from '../helpers.mjs';

const data = { referential, scenarios, corrections, criteria: referential.criteria };

/** Vérifie la structure d'un PDF : en-tête, fin, table xref cohérente avec les offsets réels. */
export function checkPdf(bytes) {
  const s = Buffer.from(bytes).toString('latin1');
  assert.ok(s.startsWith('%PDF-1.4'));
  assert.ok(s.trimEnd().endsWith('%%EOF'));
  const startxref = Number(s.match(/startxref\n(\d+)/)[1]);
  assert.equal(s.slice(startxref, startxref + 4), 'xref');
  const count = Number(s.slice(startxref).match(/xref\n0 (\d+)/)[1]);
  const entries = s.slice(startxref).split('\n').slice(3, 3 + count - 1);
  entries.forEach((e, i) => {
    const off = Number(e.slice(0, 10));
    assert.equal(s.slice(off, off + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`, `objet ${i + 1}`);
  });
  for (const m of s.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
    const start = m.index + m[0].length;
    assert.equal(s.slice(start + Number(m[1]), start + Number(m[1]) + 10), '\nendstream');
  }
  return s;
}

async function audits() {
  const srv = await startServer();
  try {
    const out = {};
    for (const site of ['haven', 'light']) {
      const a = createAudit({ projectName: site.toUpperCase() + ' <script>alert(1)</script>', caseId: site, url: `/${site}/` });
      applyAnalysis(a, await runAnalysis(`${srv.base}/${site}/`, localFetcher, { mode: 'navigateur' }));
      applyReference(a, readJson(`src/data/reference/${site}.json`));
      applyReferenceScenarios(a, readJson(`src/data/reference/${site}.json`), scenarios);
      out[site] = a;
    }
    return out;
  } finally { await srv.close(); }
}

test('les 6 documents PDF sont générés, valides et contiennent le socle commun', async () => {
  const { haven, light } = await audits();
  const rh = buildReport(haven, data);
  const rl = buildReport(light, data);
  const dir = path.join(ROOT, 'tests', 'output');
  fs.mkdirSync(dir, { recursive: true });
  for (const type of Object.keys(DOC_TYPES)) {
    const bytes = buildPdf(type, rh, { ...data, after: rl });
    const s = checkPdf(bytes);
    // Socle commun (texte encodé WinAnsi, donc recherche sur une forme encodée)
    for (const needle of ['Le score NUKUN est un indicateur', 'Scores par pilier', 'Critères et preuves', 'Test de l\'agresseur intime', 'Risques prioritaires', 'Recommandations', 'Limites de l\'analyse', 'Type : ']) {
      const enc = pdfString(toWinAnsi(needle)).slice(1, -1);
      assert.ok(s.includes(enc), `${type} : « ${needle} » absent`);
    }
    // S-6 : la saisie dangereuse apparaît comme du texte, échappé
    assert.ok(s.includes('<script>alert\\(1\\)</script>'), `${type} : nom de l'outil non échappé correctement`);
    fs.writeFileSync(path.join(dir, `exemple-${type}.pdf`), bytes);
  }
});

test('export JSON réimportable et ré-import assaini', async () => {
  const { light } = await audits();
  const json = auditToJson(light);
  const back = sanitizeImported(JSON.parse(json));
  assert.ok(back);
  assert.equal(back.manual.R5.note, 2);
  assert.equal(back.scenarios.T4.verdict, 'protected');
  // Les suggestions d'analyse importées sont rétrogradées en « déclaration »
  assert.equal(back.automatic.C1.analyzer.proof, 'declared');
  // Un JSON hostile est rejeté ou nettoyé
  assert.equal(sanitizeImported({ v: 99 }), null);
  const evil = sanitizeImported({ v: 1, id: 'a000000000000', meta: { projectName: 'x'.repeat(5000) }, manual: { C1: { note: 2, proof: 'human', attachment: 'javascript:alert(1)' }, '__proto__': { note: 2 }, ZZ: { note: 2 } } });
  assert.equal(evil.meta.projectName.length, 120);
  assert.equal(evil.manual.C1.attachment, null);
  assert.equal(Object.keys(evil.manual).length, 1);
});

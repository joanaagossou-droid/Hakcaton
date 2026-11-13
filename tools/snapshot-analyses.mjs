/**
 * Génère les « instantanés » d'analyse de HAVEN et LIGHT (plan de secours n° 1 du mémoire § 7.2).
 * Ce sont de VRAIS résultats de l'analyseur, exécuté sur les fichiers servis par le serveur local,
 * datés. Ils ne sont utilisés que si l'analyse en direct est impossible, et sont affichés comme tels.
 *
 *   node tools/snapshot-analyses.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { runAnalysis } from '../src/modules/url-analyzer/analyzer-core.js';
import { startServer, localFetcher, ROOT } from '../tests/helpers.mjs';

const s = await startServer();
fs.mkdirSync(path.join(ROOT, 'src/data/snapshots'), { recursive: true });
try {
  for (const site of ['haven', 'light']) {
    const res = await runAnalysis(`${s.base}/${site}/`, localFetcher, { mode: 'instantané' });
    // Adresses rendues relatives : l'instantané ne dépend pas du port local.
    const json = JSON.stringify(res, null, 1).split(s.base).join('');
    fs.writeFileSync(path.join(ROOT, `src/data/snapshots/${site}.json`), json);
    console.log(`instantané ${site} : ${res.findings.length} constats, ${Object.keys(res.suggestions).length} suggestions`);
  }
} finally { await s.close(); }

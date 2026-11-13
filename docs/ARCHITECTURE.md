# Architecture technique de NUKUN

## Principes

- **Application web progressive (PWA)** en HTML, CSS et JavaScript (modules ES natifs), **sans framework ni dépendance** : rien à installer, rien à mettre à jour, aucune bibliothèque tierce chargée.
- **Aucun compte, aucune base de données.** Les audits restent dans le `localStorage` du navigateur ; tout export est volontaire et généré localement.
- **Une seule partie serveur** : la fonction d'analyse d'URL, nécessaire parce qu'un navigateur ne peut pas lire le code d'un autre site (règle de même origine). Elle ne conserve rien.
- **Modules purs** (sans DOM) pour tout ce qui calcule : ils tournent à l'identique dans le navigateur et dans Node, donc sont testés automatiquement.

## Arborescence

```
index.html, manifest.webmanifest, service-worker.js, robots.txt, _headers, netlify.toml
src/
  app.js                      routeur (#/...), chargement du référentiel, service worker
  data/
    criteria.json             6 piliers, 30 critères (mémoire § 4)
    scenarios.json            7 scénarios T1–T7 et verdicts (mémoire § 5)
    corrections.json          10 correctifs du kit (module 4)
    reference/haven.json      évaluation de référence de l'équipe (critères humains)
    reference/light.json
    snapshots/*.json          analyses réelles enregistrées à l'avance (plan de secours)
  modules/
    scoring/scoring.js        moteur de score (pur)
    audit-engine/audit-engine.js   modèle d'audit, fusion des sources, import assaini (pur)
    url-analyzer/analyzer-core.js  analyse passive (pur, navigateur + Node)
    url-analyzer/url-policy.js     liste autorisée et règles anti-SSRF (pur)
    url-analyzer/client.js         choix du mode d'analyse dans le navigateur
    report-generator/report-model.js, exports.js, pdf-writer.js   rapports et PDF locaux
    comparison/compare.js     comparaison avant / après (pur)
  pages/        home.js, audit.js, report.js, kit.js, express.js
  components/   charts.js (SVG), ui.js
  utils/        dom.js (construction sûre du DOM), store.js, image.js, qr.js
  i18n/fr.js    textes d'interface (prêt pour d'autres langues)
  styles/main.css
haven/          4 pages fictives avec défauts volontaires
safeher/          4 pages fictives corrigées
server/         server.mjs (serveur local), safe-fetch.mjs (anti-SSRF), analyze-handler.mjs, headers.mjs
netlify/functions/   analyze.mjs, status.mjs (même logique que le serveur local)
tests/          unit/, security/, e2e/, load/, manual/
tools/          génération des icônes, du bundle lourd de HAVEN, des en-têtes, des instantanés, du QR code
docs/
```

Écart avec la structure proposée dans le prompt : les dossiers `criteria`, `intimate-partner-test` et `correction-kit` n'ont pas de code propre ; leur contenu est **des données** (`criteria.json`, `scenarios.json`, `corrections.json`) exploitées par `audit-engine`, `scoring` et les pages. Cela permet à des expertes non développeuses de modifier le référentiel sans toucher au code.

## Flux d'un audit

1. **Description** (`pages/audit.js → renderNew`) → `createAudit()`.
2. **Analyse** (`client.analyze`) :
   - adresse `/haven/` ou `/safeher/` du même site → lecture directe par le navigateur (mode « navigateur ») ;
   - autre adresse → `POST /api/analyze` (mode « serveur », liste autorisée) ;
   - échec → instantané daté pour HAVEN/SafeHer, sinon mode manuel.
   Le résultat (`findings`, `suggestions`) est appliqué par `applyAnalysis()`.
3. **Critères** : `setManual()` ; **scénarios** : `applyScenario()` propage le verdict aux critères liés.
4. `resolveAssessments()` fusionne : saisie de l'auditeur > référence de l'équipe > sources automatiques (la plus basse retenue).
5. `computeScore()` → `buildReport()` → affichage et `buildPdf()`.

## Sécurité de l'interface

- Toute l'interface est construite par `h()` (`utils/dom.js`) avec `textContent` : aucune chaîne saisie n'est interprétée comme du HTML. Un test statique vérifie l'absence de `innerHTML`, `eval`, `document.write`.
- Les liens passent par `safeUrl()` (pas de `javascript:`).
- CSP stricte : `script-src 'self'`, `style-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'`, sans `unsafe-inline`.
- Les audits importés sont assainis (`sanitizeImported`) ; les analyses importées sont rétrogradées en « déclaration ».

## Hors ligne

Le service worker pré-cache l'application NUKUN (36 fichiers). Il ne met **jamais** en cache HAVEN, SafeHer ni `/api/` : pas de cache sensible, et l'analyse lit toujours la version en ligne. Hors ligne, la grille, les scénarios, les rapports, les exports et la comparaison (via les instantanés) fonctionnent ; l'analyse d'une adresse affiche « connexion nécessaire ».

## Traduction

Les textes d'interface communs sont dans `src/i18n/fr.js` ; le référentiel est en JSON. Une langue nationale s'ajoutera par un fichier `src/i18n/<langue>.js` et des JSON traduits. **Aucune traduction n'a été inventée** : elles devront être produites et validées par des locuteurs.

# NUKUN — l'œil qui vérifie qu'un outil protège sans exposer

**NUKUN** est une plateforme d'audit *Safety by Design* pour les outils numériques de lutte contre les violences basées sur le genre facilitées par la technologie (VBG-FT). Elle vérifie, preuves à l'appui, qu'un outil conçu pour aider une survivante ne l'expose pas davantage à un agresseur qui a accès à son téléphone.

> Un outil numérique destiné à protéger une survivante ne doit jamais devenir une nouvelle source de danger. NUKUN permet de voir les risques, de les corriger et de vérifier les améliorations.

Prototype HACK4HER 2026, Défi 6 (Safety by Design). Référentiel : mémoire `OUTPUT/11_Memoire_complet_NUKUN_final.md`.

## Les trois composantes

| | Rôle | Adresse |
|---|---|---|
| **NUKUN** | Application d'audit : analyse d'URL, 30 critères, 7 scénarios, score, rapport, kit, comparaison | `/` |
| **HAVEN** | Plateforme d'aide **fictive** avec défauts volontaires (traceur simulé, pas de sortie rapide, formulaire intrusif…) | `/haven/` |
| **LIGHT** | HAVEN corrigée avec le kit NUKUN ; garde des points non validés (LIGHT n'obtient pas 100/100) | `/light/` |

## Démarrer en 30 secondes

Prérequis : **Node.js 18 ou plus** (aucune dépendance à installer).

```bash
npm start            # http://localhost:8080
npm test             # 36 tests unitaires et de sécurité
npm run test:e2e     # 48 vérifications dans un vrai navigateur (Edge ou Chrome)
```

Pour tester depuis un téléphone du même Wi-Fi : `npm run start:lan`, puis ouvrir `http://<adresse-IP-de-l'ordinateur>:8080`.

## Ce qui fonctionne (vérifié par les tests)

- **Module 0 — analyse d'URL** : lecture passive (HTTPS, 6 en-têtes de sécurité, cookies et cookies avant consentement, 13 signatures de traceurs et pixels, domaines tiers, poids, sortie rapide, numéros cliquables, formulaires et champs identifiants obligatoires, politique de confidentialité, signaux de traces locales). Modes navigateur (HAVEN/LIGHT), serveur (liste autorisée, protection SSRF), instantané daté (secours), manuel.
- **Module 1 — 30 critères** du mémoire, 6 piliers pondérés, notes 0/1/2/N/A, niveaux de preuve 🤖/🧪/💬, filtres, progression, sauvegarde locale, « Reprendre mon audit », pièces jointes (réduites, métadonnées supprimées).
- **Module 2 — Test de l'agresseur intime** : 7 scénarios T1–T7, verdicts, captures, propagation aux critères liés.
- **Module 3 — rapport** : score, feu tricolore, plafond à 49, renormalisation N/A, part prouvée, jauge, radar, répartition, niveaux de preuve, risques, plan priorisé avec suivi.
- **Module 4 — kit** : 10 correctifs avec démonstration interactive, code, critères et limites.
- **Module 5 — HAVEN** (4 pages) **et LIGHT** (6 pages) et **comparaison avant/après** calculée par le moteur.
- **Mode discret de LIGHT** (repris du prototype SafeElle) : calculatrice qui fonctionne vraiment, installable sous le nom « Calculatrice », ouverte par un code secret (`1234` puis `=` en démonstration), code leurre (`0000`), retour automatique à la calculatrice, notification camouflée, codes jamais stockés en clair.
- **Exports locaux** : 6 PDF (rapport, fiche technique, fiche de risques, résumé, plan, comparaison), JSON réimportable, impression.
- **Parcours jury en 5 minutes**, tableau de bord local, PWA hors ligne, QR code généré localement.

**En ligne : https://nukun-demo.netlify.app** (parcours jury : `/#/express`, QR code : `OUTPUT/21_QR_code_NUKUN_demo.png`).

Résultats mesurés en ligne : HAVEN **9/100** (rouge, plafonné : C1, C2, S1, R1 bloquants), LIGHT **85/100** (vert). En local (HTTP) : 7 et 83. Voir [docs/RESULTATS_TESTS.md](docs/RESULTATS_TESTS.md).

## Documentation

- [Guide d'installation et de mise en ligne](docs/INSTALLATION.md)
- [Guide utilisateur](docs/GUIDE_UTILISATEUR.md)
- [Guide de présentation au jury et plan de secours](docs/GUIDE_JURY.md)
- [Architecture technique](docs/ARCHITECTURE.md)
- [Méthode et calcul du score](docs/METHODE_SCORE.md)
- [Sécurité, données et journaux](docs/SECURITE_ET_JOURNAUX.md)
- [Résultats des tests réellement exécutés](docs/RESULTATS_TESTS.md)
- [Décisions prises et limites](docs/DECISIONS_ET_LIMITES.md)
- [Tests manuels restant à faire](tests/manual/CHECKLIST_MANUELLE.md)

## Avertissement

Le score NUKUN est un indicateur des critères évalués et des preuves disponibles. Il ne constitue ni une certification, ni une garantie de sécurité, ni un substitut à un audit professionnel. HAVEN et LIGHT sont des sites fictifs : ils ne reçoivent aucun signalement et ne doivent jamais être présentés comme des services réels.

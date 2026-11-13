# Résultats des tests réellement exécutés

Date d'exécution : 13/11/2026. Machine : Windows 11, Node.js 24.19, Microsoft Edge 157 (headless). Environnement : **serveur local** (`http://127.0.0.1`), pas l'hébergement en ligne. Fichiers bruts : `tests/output/` (`e2e/resultats.json`, `charge-locale.json`, `poids.json`, captures et PDF d'exemple).

## Synthèse

| Famille | Commande | Résultat |
|---|---|---|
| Unitaires + sécurité | `npm test` | **36/36 réussis** |
| Navigateur réel (bout en bout) | `npm run test:e2e` | **79/79 réussis** (dont le calcul secret personnel, le témoin anonyme, les numéros d’urgence vérifiés, la personne de confiance, et 20 sur « Mon espace » avec micro simulé : message vocal, code de suivi, réponse, assistante, coffre chiffré, alerte discrète, annulation, effacement ; et 14 sur le mode discret : calculs, code leurre, empreintes des codes, code secret, Échap, notification camouflée, historique, verrouillage en arrière-plan) |
| Charge locale | `node tests/load/mini-load.mjs 200 60` | **Réussi** : 200 utilisateurs, 31 897 requêtes, 0 erreur, p95 = 24 ms, p99 = 27 ms |
| Poids | `node tools/measure-weight.mjs` | NUKUN 282 Ko bruts / 100 Ko compressés (< 300 Ko) ; pages LIGHT 12 à 14 Ko (< 150 Ko) |
| QR code | décodage par la bibliothèque indépendante jsQR 1.4.0 | **5/5** textes décodés à l'identique (versions 1, 3, 8 et 10, accents) |
| PDF | rendu par le moteur PDF de Windows (`Windows.Data.Pdf`) | Rapport complet (7 pages) et résumé (3 pages) ouverts et rendus correctement |

## Vérifications sur le site public (13/11/2026)

Adresse : **https://nukun-demo.netlify.app** (Netlify, HTTPS). La protection visiteurs de Netlify est limitée aux brouillons ; la production est publique.

| Vérification | Résultat |
|---|---|
| Pages NUKUN, HAVEN, LIGHT, police | 200 |
| Dossiers internes `server/`, `tests/`, `tools/`, `docs/`, `netlify/` | 404 (inaccessibles) |
| En-têtes NUKUN | CSP stricte, HSTS (preload), nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options, noindex |
| En-têtes LIGHT | idem + `Cache-Control: no-store` |
| En-têtes HAVEN | défauts volontaires (cookie `haven_sid` d'office, cache public, pas de Referrer/Permissions/X-Frame) ; CSP et noindex conservés |
| `/api/status` | liste autorisée = `nukun-demo.netlify.app/haven/` et `/light/` |
| `/api/analyze` : métadonnées cloud, localhost, `file://`, site hors liste | 4 refus avec message clair |
| `/api/analyze` sur HAVEN | analyse en mode serveur ; traceur et en-tête Set-Cookie détectés |
| Scores calculés en ligne | **HAVEN 9/100** rouge, plafonné (C1, C2, S1, R1) · **LIGHT 86/100** vert (S5 conforme grâce au HTTPS ; R3 devenu applicable et conforme avec « Mon espace ») |
| QR code `https://nukun-demo.netlify.app/#/express` | décodé à l'identique par jsQR ; fichier `OUTPUT/21_QR_code_NUKUN_demo.png` |

HAVEN passe de 7 (local) à 9 (en ligne) : avec HTTPS et sa CSP, son critère S5 devient « partiel ». Elle reste rouge et plafonnée.

## Correspondance avec le plan d'essais du mémoire (§ 10)

| Essai | Statut | Preuve |
|---|---|---|
| F1 Bout en bout | ✅ en local | HAVEN 7/100 rouge (plafonné, C1 C2 S1 R1), LIGHT 83/100 vert, rapport et export PDF sans erreur (`haven-light.test.mjs`, e2e) |
| F2 Reproductibilité | ✅ | 10 calculs identiques (`scoring.test.mjs`) |
| F3 Règles de notation | ✅ | Plafond 49, déclaration ≤ 1, bloquant déclaré = non vérifié, N/A justifié exclu, N/A non justifié = non vérifié, renormalisation d'un pilier N/A |
| F4 Précision de l'analyse | ✅ | 7 défauts observables de HAVEN détectés ; 0 faux problème sur LIGHT (hors HTTPS, absent en local) |
| F5 Compatibilité | ⚠️ partiel | Mise en page 360 px sans défilement horizontal sur 8 pages (émulation mobile Edge). **Vrais téléphones non testés.** |
| F6 Connexion faible | ⚠️ partiel | Poids mesurés conformes. **Test 3G réel non fait.** |
| F7 Hors ligne | ✅ | Rechargement hors ligne après premier chargement (service worker), e2e |
| F8 Disponibilité | ⚠️ partiel | En ligne depuis le 13/11/2026 ; sonde automatique toutes les 5 min non mise en place |
| F9 Cohérence entre auditeurs | ❌ non fait | Nécessite deux auditeurs humains |
| F10 Accessibilité (personne extérieure) | ❌ non fait | Voir `tests/manual/CHECKLIST_MANUELLE.md` |
| F11 Biais | ⚠️ partiel | Gestion N/A testée ; audit de 3 outils de profils différents non fait |
| F12 Données fictives | ✅ | Revue : personas Afi/Kossi, numéros `00 00 …`, aucun témoignage |
| F13 Non-confusion | ⚠️ partiel | Bandeau et noindex vérifiés automatiquement sur les 8 pages ; **test avec des personnes extérieures non fait** |
| S-1 Auto-audit | ⚠️ partiel | LIGHT ≥ 80 sans bloquant en échec ; auto-audit de NUKUN par lui-même non fait (seules /haven/ et /light/ sont analysables sur le même site) |
| S-2 Aucune fuite vers un tiers | ✅ | Aucune requête tierce relevée par le navigateur sur NUKUN, HAVEN (avec traceur simulé) et LIGHT |
| S-3 En-têtes | ✅ en local / ❌ Observatory | En-têtes vérifiés sur le serveur local ; Mozilla Observatory nécessite l'adresse publique |
| S-4 Scan OWASP ZAP | ❌ non fait | Nécessite l'adresse publique |
| S-5 Détournement de l'analyseur | ✅ (local et en ligne) | 31 adresses dangereuses refusées ; DNS vers adresse privée refusé ; redirection vers 169.254.169.254 refusée |
| S-6 Injection | ✅ | Texte affiché tel quel dans l'interface (navigateur réel, aucune boîte de dialogue), échappé dans les 6 PDF ; aucune insertion HTML brute dans le code |
| S-7 Limitation | ✅ | 10 analyses/min/appareil, les autres appareils restent servis ; cache vérifié |
| S-8 Dépendances et secrets | ✅ | Aucune dépendance ; aucun motif de secret dans le dépôt |
| S-9 Formulaires | ✅ | HAVEN et LIGHT : aucune requête à l'envoi, message « Démonstration uniquement » |
| S-10 Non-indexation | ✅ | `noindex` sur les 8 pages, en-tête `X-Robots-Tag`, `robots.txt` |
| S-11 Sortie rapide | ✅ ordinateur | Touche Échap : page neutre en ~0,6 s ; « Retour » mène à /light/, pas au formulaire (Edge headless). **À refaire sur téléphones.** |
| S-12 Niveaux de preuve | ✅ | Bloquant déclaré conforme → non vérifié, score plafonné |
| C1 Montée en charge | ✅ en local / ❌ en ligne | 200 utilisateurs locaux OK ; k6 sur l'hébergement non lancé |
| C2–C5 | ❌ non faits | Scripts prêts (`tests/load/k6-nukun.js`) ; test en salle à faire |

## Anomalies trouvées et corrigées pendant les tests

- Section « Recommandations » absente du rapport PDF complet (détectée par le test du socle commun) → ajoutée.
- Arc de la jauge mal dessiné au-delà de 50 (vu sur capture) → corrigé.
- Cadre de focus jaune autour de toute la page après navigation → corrigé.
- Bouton « Quitter » de LIGHT masquant le bandeau « site fictif » sur mobile → corrigé.
- Titre de section orphelin en bas de page PDF → corrigé.
- Doublon `/` et `/index.html` dans l'analyse ; seuil A1 aligné sur le texte du critère ; détection du bandeau de LIGHT.
- Récursion infinie dans la conversion de caractères du PDF (caractère « · ») → corrigée.

## Anomalie trouvée et corrigée sur le mode discret

- Le déchargement d'une page lors d'une navigation interne déclenchait le verrouillage automatique et fermait la session : corrigé (événements `beforeunload` / `pagehide` pris en compte), puis vérifié par test.

## Ce que ces résultats ne prouvent pas

Les mesures de charge et de temps de réponse portent sur un serveur local sur la même machine : elles ne disent rien de l'hébergement réel ni d'une connexion 3G. Les tests e2e utilisent un navigateur de bureau en émulation mobile, pas de vrais téléphones.

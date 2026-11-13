# Sécurité, données personnelles et journaux techniques

## Données traitées

| Donnée | Où | Durée | Transmise ? |
|---|---|---|---|
| Audits (description d'outil, notes, commentaires, verdicts) | `localStorage` du navigateur | Jusqu'à suppression par l'utilisateur | Non, sauf export volontaire |
| Captures jointes | `localStorage`, réduites à 640 px, ré-encodées en JPEG (métadonnées EXIF/GPS supprimées) | Idem | Non (exclues de l'export JSON par défaut) |
| Adresse soumise à l'analyse serveur | Mémoire vive de la fonction | Durée de la requête + cache de 5 min du résultat | Uniquement à la fonction NUKUN |
| Adresse IP du client de l'analyse | Mémoire vive | 1 minute au plus (limitation de débit) | Non |
| SafeHer : choix « bandeau vu » | `sessionStorage` | Fin de session | Non |

NUKUN ne demande jamais d'information sur une survivante. HAVEN et SafeHer n'envoient ni n'enregistrent rien (formulaires sans action ni bouton `submit` ; vérifié par test).

## Journaux techniques

- **Serveur local** (`server/server.mjs`) : n'écrit **aucun** journal d'accès.
- **Hébergeur en ligne** : comme tout hébergeur, il conserve des journaux techniques (adresse IP, date, URL demandée, navigateur) et des journaux d'exécution des fonctions. Leur durée dépend de l'offre (à relever dans la documentation de l'hébergeur au moment du déploiement et à reporter ici). NUKUN n'y écrit aucune donnée d'audit ; la fonction d'analyse ne journalise ni l'adresse analysée ni le résultat.
- Cette information figure dans la page « Confidentialité » de NUKUN.

## Protections mises en œuvre

| Menace | Protection | Vérification |
|---|---|---|
| Injection (XSS) | DOM construit par `textContent` ; `safeUrl()` ; CSP sans `unsafe-inline` ; texte échappé dans les PDF | Tests S-6 (unitaire, statique, navigateur) |
| SSRF via l'analyseur | Liste autorisée ; http(s) seulement ; ports 80/443 ; pas d'identifiants ; refus de localhost, IP privées/réservées, métadonnées cloud, IPv6 locales, IPv4 mappées ; **vérification DNS au moment de la connexion** (pas de rebinding) ; chaque redirection revalidée (3 au plus) | `tests/security` |
| Abus de l'analyseur | 10 analyses/min/appareil, 120/min au total ; cache 5 min ; 2 Mo et 8 s par réponse ; requête de 4 Ko au plus | Tests S-7, taille, 413 |
| Analyse intrusive | GET uniquement, sans cookie ni corps ; aucun formulaire soumis ; seuls les liens visibles de la même section, 10 pages max ; domaines tiers jamais contactés | Test « GET uniquement » |
| Fuite vers des tiers | Aucun script, police ou image tiers ; `connect-src 'self'` ; traceur de HAVEN simulé localement | Test navigateur S-2 (aucune requête tierce) |
| Accès à des fichiers internes | Serveur : liste blanche de dossiers, refus des `..`, `\`, fichiers cachés ; Netlify : redirections 404 | Test traversée |
| Imports falsifiés | `sanitizeImported` : types, tailles, identifiants, images JPEG seulement ; analyses importées rétrogradées en déclaration | Test d'import hostile |
| Secrets | Aucun secret nécessaire ; recherche automatique de motifs de clés | Test S-8 |
| Indexation de HAVEN | `noindex` (balise et en-tête), `robots.txt` | Test S-10 |
| Confusion avec un vrai service | Bandeau « SITE FICTIF » sur chaque page, numéros fictifs `00 00 …`, nom et charte inventés | Test S-10 + test humain à faire |

## Dépendances

Aucune dépendance d'exécution ni de développement (`package.json` sans `dependencies`). `npm audit` est donc sans objet ; le seul module utilisé pour une vérification (décodeur QR `jsqr`) a été installé hors du projet, dans un dossier temporaire.

## Hors périmètre (à faire avant tout usage réel)

- Test d'intrusion professionnel sous mandat de la fonction d'analyse et de l'hébergement.
- Scan OWASP ZAP (passif puis actif) et Mozilla Observatory sur l'adresse publique (essais S-3, S-4 du mémoire) : **non réalisés**, le site n'étant pas encore en ligne.
- Revue juridique (Code du numérique du Bénin, protection des données personnelles ; références à confirmer).

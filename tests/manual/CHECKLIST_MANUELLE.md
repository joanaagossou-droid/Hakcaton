# Tests manuels à réaliser (non automatisables ici)

À faire par l'équipe, **sur l'adresse publique**, et à consigner (date, appareil, testeur, résultat, capture) dans `docs/RESULTATS_TESTS.md`.

## Appareils (F5, F6, F10)

| Appareil | Parcours jury complet sans blocage | Lisible sans zoom | Sortie rapide LIGHT (< 2 s, Retour OK) | Résultat |
|---|---|---|---|---|
| Android d'entrée de gamme (1–2 Go) | ☐ | ☐ | ☐ | |
| Android récent | ☐ | ☐ | ☐ | |
| iPhone (Safari) | ☐ | ☐ | ☐ | |
| Ordinateur (clavier seul, touche Tab) | ☐ | ☐ | ☐ (touche Échap) | |

- ☐ Connexion faible : données mobiles réelles + mode « 3G lente » des outils de développement → page utilisable en moins de 5 s.
- ☐ Hors ligne après premier chargement : mode avion, rouvrir NUKUN → grille et rapports OK, analyse « connexion nécessaire ».
- ☐ Une personne extérieure fait le parcours express en moins de 5 min, le parcours complet en moins de 30 min.

## Non-confusion (F13, E)

- ☐ Trois personnes extérieures regardent HAVEN et LIGHT sur téléphone : comprennent-elles immédiatement qu'il s'agit de sites fictifs ? Reconnaissent-elles un site réel ? Noter leurs réponses mot pour mot.

## Sécurité sur l'adresse publique (S-3, S-4, S-5, S-7)

- ☐ Mozilla Observatory sur le domaine → note visée A- ou mieux.
- ☐ OWASP ZAP : scan passif puis actif, **uniquement sur nos adresses** → aucune alerte haute ou moyenne non traitée.
- ☐ `POST /api/analyze` avec `http://localhost/`, `http://169.254.169.254/`, une adresse hors liste → refus clair.
- ☐ 30 analyses en 1 minute depuis un même téléphone → « Réessayez dans une minute ».
- ☐ Onglet Réseau sur chaque page de NUKUN, HAVEN, LIGHT → aucune requête tierce.

## Charge (C1–C5)

- ☐ `k6 run -e BASE=https://<site> tests/load/k6-nukun.js` (montée), puis `-e SCENARIO=pic`, `analyses`, `endurance`.
- ☐ Test réel en salle : 10 téléphones ou plus, Wi-Fi et 4G, parcours express simultané.

## Avant le pitch

- ☐ QR code scanné par 3 téléphones différents.
- ☐ Vidéo de secours de 60 s enregistrée.
- ☐ Copie locale testée (`npm start`) sur l'ordinateur de démonstration.

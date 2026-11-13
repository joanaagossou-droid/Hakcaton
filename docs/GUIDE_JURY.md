# Guide de présentation au jury

## Démonstration en 2 minutes (pendant le pitch)

| Temps | Écran | À dire |
|---|---|---|
| 0:00 | Accueil NUKUN | « NUKUN ne fait pas confiance : il vérifie. » |
| 0:10 | Parcours jury → **Auditer HAVEN** | « Voici Haven, un refuge fictif. NUKUN lit ses pages comme une visiteuse : traceur d'audience, aucune sortie rapide, nom et téléphone obligatoires. » |
| 0:35 | Étape T4 : ouvrir HAVEN, chercher la sortie rapide → **Afi est exposée** | « Kossi entre dans la pièce. Afi ne peut pas cacher la page. » |
| 0:50 | Étape T6 → **Afi est exposée** | « Le traceur révèle la visite. » |
| 1:00 | Score **9/100 en ligne (7 en local), rouge**, plafonné | « Quatre critères bloquants : non déployable. NUKUN donne le plan de correction et les correctifs. » |
| 1:20 | **HAVEN → LIGHT** | « Nous avons appliqué le plan : Haven est devenue Light. Même moteur : **85/100 en ligne**, vert. Et pas 100 : NUKUN affiche ce qui reste à valider (langues nationales, test utilisateur, contacts à vérifier). » |
| 1:45 | Ouvrir LIGHT, appuyer sur **Quitter** | « Une page neutre, et Retour ne ramène pas ici. » |
| 1:55 | QR code (`#/partager`) | « Scannez, et auditez Haven vous-mêmes. » |

Ne jamais nommer de site ou d'institution réels.

## Parcours express du jury (5 minutes, sur son téléphone)

1. Scanner le QR code → parcours jury.
2. Choisir HAVEN ou LIGHT.
3. Lire l'analyse automatique.
4. Jouer T4 (sortie rapide) puis T6 (réseau partagé) : ouvrir le site, faire l'action, choisir le verdict.
5. Voir le score, les défauts prioritaires et leurs correctifs.
6. Comparer HAVEN et LIGHT ; exporter la fiche de risques en PDF.

Les 30 critères restent accessibles (« Voir les 30 critères »). Les critères humains sont pré-remplis par l'évaluation de référence de l'équipe, clairement signalée : le jury peut les modifier.

## Questions probables

- **« Qui garantit les réponses humaines ? »** Le niveau de preuve est affiché pour chaque critère, une déclaration plafonne à 1 et ne valide jamais un bloquant ; le rapport indique le type d'audit (auto-évaluation, croisé, tiers).
- **« Le score de LIGHT est-il truqué ? »** Non : il est recalculé à chaque ouverture à partir de l'analyse réelle et des réponses visibles ; les tests automatiques le vérifient.
- **« Et si on audite un vrai site ? »** Seulement avec autorisation écrite : l'analyseur n'accepte que la liste autorisée.
- **« Que ne fait pas NUKUN ? »** Pas de test d'intrusion, pas de soumission de formulaire, pas de pages cachées.

## Plan de secours (3 niveaux)

1. **Analyse en ligne indisponible** → bouton « Utiliser l'instantané enregistré » (résultat réel de l'analyseur, daté, affiché comme tel). La comparaison HAVEN → LIGHT bascule automatiquement sur les instantanés.
2. **Lien public indisponible** → `npm start` sur l'ordinateur de démonstration (copie complète, hors ligne possible après un premier chargement).
3. **Dernier recours** → vidéo de 60 secondes, à enregistrer la veille selon le scénario ci-dessous.

## Scénario de la vidéo de secours (60 s, à enregistrer)

Capture d'écran d'un téléphone (ou mode mobile du navigateur), sans son ou avec voix off :

1. (0–8 s) Accueil NUKUN, slogan.
2. (8–20 s) Parcours jury → HAVEN → analyse : traceur, sortie rapide absente, champs obligatoires.
3. (20–30 s) T4 : HAVEN sans bouton Quitter → « Afi est exposée ».
4. (30–38 s) Score 7/100 rouge, critères bloquants.
5. (38–50 s) Comparaison HAVEN → LIGHT, scores côte à côte, points restants.
6. (50–58 s) LIGHT : bouton Quitter → page neutre.
7. (58–60 s) Message : « NUKUN permet de voir les risques, de les corriger et de vérifier les améliorations. »

Outil possible : l'enregistreur d'écran du téléphone, ou la Xbox Game Bar sous Windows (Win + Alt + R). **La vidéo n'a pas été enregistrée** : elle doit l'être par l'équipe avec la version en ligne définitive.

## Les captures d'écran disponibles

`tests/output/e2e/` contient des captures produites par les tests automatiques (accueil, analyse, score HAVEN, rapport, comparaison, formulaire LIGHT, vues mobiles). Elles peuvent servir de diapositives de secours.

# Guide utilisateur de NUKUN

NUKUN s'utilise dans un navigateur, sur téléphone ou ordinateur, sans compte. Vos audits restent sur votre appareil.

## Règles avant de commencer

- N'utilisez **jamais** d'information réelle concernant une survivante, ni de vrai témoignage, ni de capture contenant des données personnelles.
- N'auditez que des outils pour lesquels vous avez une **autorisation** (votre propre outil, HAVEN, LIGHT, ou un outil dont le responsable a donné son accord écrit).

## Deux façons de commencer

- **Auditer un outil** : vous évaluez un outil existant.
- **Concevoir un outil sûr** : la grille sert de liste de contrôle pendant la conception (rapport marqué « auto-évaluation »).

## Étape 1 — Décrire l'outil

Choisissez un cas fictif (HAVEN ou LIGHT) ou saisissez une adresse, puis le nom, le type d'outil, la fonction principale, le public et le **type d'audit** :
- *auto-évaluation* : par l'équipe qui conçoit l'outil (non certifiée) ;
- *audit croisé* : par une autre équipe ou le jury ;
- *audit tiers* : par un organisme indépendant mandaté.

Si l'outil n'utilise pas d'IA, le critère E3 est marqué N/A avec cette justification.

## Étape 2 — Analyse automatique

NUKUN lit les pages comme une visiteuse ordinaire et présente : éléments détectés, non détectés, partiels, **impossibles à vérifier automatiquement**, avec le risque et le critère correspondant. Les critères observables sont pré-remplis avec le niveau de preuve 🤖. Si l'analyse est impossible, continuez en mode manuel.

## Étape 3 — Les 30 critères

Pour chaque critère : lisez la question et l'explication « pour Afi », puis choisissez une **note** (0, 1, 2 ou N/A) et un **niveau de preuve** :
- 🧪 **Humain** : vous l'avez testé (précisez comment dans le commentaire, joignez une capture si utile) ;
- 💬 **Déclaration** : l'éditeur l'affirme, sans preuve. La note est alors plafonnée à 1, et un critère bloquant reste « non vérifié ».

Un N/A doit être justifié. Les filtres (pilier, criticité, preuve, statut) aident à trouver ce qui reste à faire. Tout est sauvegardé automatiquement ; « Reprendre mon audit » ramène au dernier audit.

## Étape 4 — Le Test de l'agresseur intime

Pour chacun des 7 scénarios, faites **réellement** l'action demandée sur l'outil (ouvrir l'historique, appuyer sur la sortie rapide…), puis choisissez le verdict : *Afi est exposée*, *Risque partiellement maîtrisé*, *Afi est protégée dans le périmètre testé* ou *Non vérifié*. Le verdict alimente les critères liés comme preuve 🧪, sans écraser vos propres réponses ; en cas de contradiction, NUKUN la signale.

## Étape 5 — Le rapport

Score sur 100, feu tricolore, critères bloquants, part du score réellement prouvée, piliers, répartition, niveaux de preuve, résultats des scénarios, risques prioritaires et plan de correction (P0 à P3). Marquez chaque action « à faire / en cours / fait » pour suivre la progression.

**Exports** (générés sur votre appareil) : rapport complet, fiche technique, fiche d'analyse des risques, résumé, plan de correction, comparaison avant/après (PDF), et export JSON réimportable depuis le tableau de bord.

## Étape 6 — Corriger et vérifier

Ouvrez les correctifs du **kit** depuis le rapport. Une fois les corrections appliquées, cliquez sur **« Réaliser un nouvel audit après correction »** : NUKUN relance l'analyse, et vous refaites les tests humains (les anciennes réponses ne sont pas reprises, pour ne pas valider sans vérifier). Comparez ensuite les deux audits.

## Lire le score

| Feu | Score | Signification |
|---|---|---|
| Rouge | moins de 50, ou critère bloquant non conforme | Non déployable dans l'état évalué |
| Orange | 50 à 79 | Corrections prioritaires nécessaires |
| Vert | 80 et plus | Niveau favorable pour envisager un déploiement sous contrôle humain |

Le score NUKUN est un indicateur des critères évalués et des preuves disponibles. Il ne constitue ni une certification, ni une garantie de sécurité, ni un substitut à un audit professionnel.

## Effacer ses données

Tableau de bord → « Supprimer » (un audit) ou « Tout effacer de ce navigateur ».

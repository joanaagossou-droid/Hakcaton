# Méthode et calcul du score

Source : mémoire NUKUN (§ 4 et § 4 bis). Implémentation : `src/modules/scoring/scoring.js`. Tests : `tests/unit/scoring.test.mjs` (15 tests).

## Référentiel

30 critères, 6 piliers de 5 critères, poids égal (1) à l'intérieur d'un pilier.

| Pilier | Poids | Bloquants |
|---|---:|---|
| C · Confidentialité et données | 25 % | C1, C2 |
| S · Sécurité par défaut | 20 % | S1 |
| A · Accessibilité et inclusion | 15 % | — |
| R · Recours et contrôle humain | 20 % | R1 |
| N · Ne pas nuire | 10 % | N1 |
| E · Équité et fiabilité | 10 % | — |

Le référentiel du mémoire est complet : les 30 critères sont repris à l'identique, aucun n'a été ajouté ni retiré. La criticité « élevée / moyenne » des critères non bloquants est une **décision de l'équipe de développement** (le mémoire ne la précise pas) ; elle sert uniquement à trier les risques et le plan, jamais au calcul du score.

## Règles

1. **Note** : 0 (absent), 1 (partiel), 2 (conforme), N/A. N/A sans justification → traité comme « non vérifié ».
2. **Preuve** : 🤖 machine, 🧪 humain → note conservée. 💬 déclaration → note plafonnée à 1 ; sur un critère bloquant, valeur 0 (« non vérifié, donc non conforme »). Sans niveau de preuve : traité comme une déclaration.
3. **Non évalué** → 0.
4. **Pilier** = points obtenus ÷ points possibles (hors N/A).
5. **Global** = Σ (poids × ratio du pilier) ÷ Σ poids des piliers ayant au moins un critère applicable × 100, arrondi à l'entier. Si un pilier entier est N/A, les autres poids sont renormalisés.
6. **Plafond** : si un critère bloquant a une valeur retenue inférieure à 2 (y compris partiel ou non vérifié), le score est plafonné à 49. Le mémoire dit « critère bloquant non conforme » ; nous avons choisi l'interprétation la plus prudente (tout ce qui n'est pas pleinement conforme et prouvé).
7. **Feu** : rouge < 50, orange 50–79, vert ≥ 80.
8. **Part prouvée** = part du score issue de critères 🤖 ou 🧪.
9. **Pourcentage vérifié** = critères évalués ÷ 30 ; **appuyés par une preuve** = critères 🤖/🧪 ÷ critères applicables.

## Fusion des sources d'un critère

- La saisie de l'auditeur prime, puis l'évaluation de référence de l'équipe (pour HAVEN et LIGHT).
- Entre l'analyse automatique et les scénarios, la note la plus basse est retenue (prudence).
- Si un scénario donne une note plus basse qu'une saisie, l'écart est affiché « à revoir ».

## Priorisation

- **Risques** : bloquants d'abord, puis criticité, puis points de score perdus.
- **Plan** : P0 bloquant, P1 criticité élevée, P2 criticité moyenne non conforme, P3 à consolider ; à priorité égale, effort le plus faible d'abord.

## Exemple chiffré (test automatique)

Tout conforme et prouvé, sauf C3 = 1, A3 = 0, E5 déclaré conforme :
C = 9/10 × 25 = 22,5 · S = 20 · A = 8/10 × 15 = 12 · R = 20 · N = 10 · E = 9/10 × 10 = 9 → 93,5 → **94/100**.

## Résultats sur les cas fictifs (calculés par le moteur)

| | Score | Feu | Bloquants en échec |
|---|---:|---|---|
| HAVEN | 7 (brut 6,8) | Rouge | C1, C2, S1, R1 |
| LIGHT, serveur local HTTP | 83 | Vert | aucun |
| LIGHT, en ligne HTTPS (mesuré le 13/11/2026) | 85 | Vert | aucun |
| HAVEN, en ligne HTTPS (mesuré) | 9 | Rouge | C1, C2, S1, R1 |

Points non validés de LIGHT, affichés dans le rapport : A3 (langues nationales), A5 (test utilisateur), R2 et E1 (contacts fictifs non vérifiés), A2 (langage non testé avec un public peu scolarisé), E2 (déclaré), E5 (pas de relecture par une structure spécialisée), S5 en local.

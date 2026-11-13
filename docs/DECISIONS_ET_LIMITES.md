# Décisions techniques prudentes et limites

Quand une information manquait, une décision prudente a été prise et documentée ici, sans inventer de faits.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Plafond à 49 | Appliqué dès qu'un bloquant n'est pas **pleinement** conforme et prouvé (partiel et non vérifié compris) | Interprétation la plus prudente de « critère bloquant non conforme » |
| Critère non évalué | Compte 0 | « Ce qui n'est pas vérifié n'est pas acquis » (mémoire § 4 bis) |
| Criticité élevée / moyenne | Fixée par l'équipe pour trier risques et plan ; sans effet sur le score | Non précisée par le mémoire |
| Niveau « machine » | Réservé à l'analyse automatique ; l'auditeur choisit humain ou déclaration | Empêcher de présenter une affirmation comme un constat automatique |
| Seuil A1 | Page la plus lourde < 500 Ko → 2, sinon 0 | Texte du critère A1 (« page < 500 Ko ») |
| Numéros d'urgence | **Aucun numéro réel publié**. LIGHT affiche des numéros fictifs `00 00 01 0x`, cliquables, marqués « à vérifier » ; R2 et E1 restent partiels | Consigne : ne publier aucun contact non vérifié auprès d'une source institutionnelle |
| Évaluations de référence | HAVEN/LIGHT : les critères humains sont pré-remplis par l'équipe, marqués « Référence de l'équipe », remplaçables | Rendre le parcours jury faisable en 5 minutes sans masquer qui a évalué |
| Verdicts de référence | Ne revendiquent que ce qui a été vérifié (ex. T4 vérifié sur ordinateur par le test automatisé, « à refaire sur Android et iPhone ») | Ne pas fabriquer de résultats |
| Page neutre de la sortie rapide | Recherche « météo » sur un moteur de recherche (configurable dans `light/assets/light.js`) | Page banale, sans lien avec le site ; l'adresse ne révèle rien |
| Noms de fichiers de LIGHT | `ecrire.html`, `contacts.html` au lieu de `signaler`, `recours` | L'adresse visible dans l'historique ne doit pas révéler la démarche (T1) |
| Traceur de HAVEN | Signature de code reproduite (`gtag`, `dataLayer`) + cookie `_ga` local ; aucune requête ; CSP conservée sur HAVEN | Détectable par NUKUN sans jamais rien transmettre |
| Poids de HAVEN | Fichier de commentaires de ~630 Ko décodés, ~25 Ko compressés | Reproduire le défaut A1 sans pénaliser la connexion du jury |
| Export PDF | Générateur PDF écrit pour le projet (polices standard, accents WinAnsi) ; émojis remplacés par du texte | Aucune bibliothèque externe ; génération 100 % locale |
| Ré-audit | Les réponses humaines ne sont pas recopiées | Un ré-audit doit revérifier, pas reconduire |
| Analyses importées (JSON) | Rétrogradées en « déclaration » | Un fichier peut être modifié ; seule une analyse faite par NUKUN vaut preuve machine |
| Hébergeur | Netlify proposé (fichiers prêts), Cloudflare Pages possible | HTTPS automatique, offre gratuite, fonction serveur |

## Limites connues

- L'analyse lit le code reçu, par expressions régulières : un contenu ajouté par JavaScript n'est pas vu, et un code très inhabituel peut tromper la détection (faux négatifs possibles). Les critères concernés demandent un test humain.
- Les signatures de traceurs couvrent 13 services courants, pas tous.
- Les verdicts ne valent que pour l'appareil, le navigateur et la date du test.
- La sortie rapide ne supprime pas l'historique déjà enregistré ni les traces sur d'autres appareils synchronisés.
- La limitation de débit et le cache de la fonction en ligne sont en mémoire par instance (limite effective plus élevée si plusieurs instances).
- Le stockage local peut être indisponible (navigation privée stricte) : NUKUN prévient et propose l'export.
- La pondération du référentiel n'a pas été validée par des expertes VBG ni des survivantes.
- Les références juridiques citées dans le mémoire restent à confirmer.
- « Nùkún » = « l'œil » en fon : sens et orthographe à faire confirmer par un locuteur.
- Aucune traduction en langue nationale n'est fournie (architecture prête, contenu à produire par des locuteurs).

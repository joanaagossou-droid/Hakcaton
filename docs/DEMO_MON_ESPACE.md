# Démonstration au jury : « Mon espace » de SafeHer (environ 3 minutes)

Prototype : **situations inventées uniquement**. Tout se passe dans le même navigateur ; aucun service réel n'est contacté.

## Avant la démonstration (une fois, au calme)
1. Ouvrir https://nukun-demo.netlify.app/safeher/espace.html sur le téléphone de démonstration.
2. **Mode discret** : choisir un calcul secret personnel (par exemple **47+15**, à retaper) et un calcul leurre (par exemple **100-25**). Il n'existe aucun code commun.
3. **Mon espace → Alerte discrète** : choisir « Fon », un prénom inventé (« Étoile »), saisir le calcul secret, puis **Autoriser le micro et préparer**.
4. **Mon espace → Confiance** : enregistrer une personne de confiance fictive (« Tonton Koffi », grand frère) et cocher « transmettre en cas d'alerte ».
5. Ouvrir dans un **deuxième onglet** la console : https://nukun-demo.netlify.app/safeher/agent.html

## Déroulé
| Temps | Écran | Action | À dire |
|---|---|---|---|
| 0:00 | Calculatrice | Calculer 12 + 30, puis taper **47+15 =** | « Pour Kossi, c'est une calculatrice. Chaque victime choisit son propre calcul secret : s'il fuitait, il n'exposerait qu'elle. » |
| 0:20 | Mon espace → Parler | Choisir **Fon** : « votre message sera écouté directement par une personne qui parle votre langue ». Enregistrer 10 s d'un message **inventé**, accepter, envoyer | « Afi parle dans sa langue, sans écrire, sans donner son nom. » Montrer le **code de suivi** affiché une seule fois. |
| 0:50 | Console agent | Ouvrir le message, l'écouter, saisir une traduction fictive (« il menace de publier mes photos »), montrer la **priorité suggérée**, choisir la priorité, répondre | « L'outil suggère, l'humain décide. » |
| 1:30 | Mon espace → Ma réponse | Saisir le code, lire la réponse | « Aucun SMS : la réponse ne s'ouvre qu'avec le code. » |
| 1:50 | Mon espace → Assistante | Coller : « Il va publier mes photos si je ne paie pas » | Mots surlignés, constat, conseils, limites affichées. |
| 2:10 | Mon espace → Mes preuves | Calcul secret, ajouter une capture **fictive** | « Chiffrée avec son code : sans le code, illisible, même en fouillant le téléphone. » |
| 2:30 | Calculatrice | « Quitter », puis **3 tapes rapides sur la zone des chiffres** ; attendre 5 s ; montrer la console : **alerte rouge**, avec la personne de confiance à prévenir ; après 10 s, 3 tapes pour arrêter | « Rien ne change à l'écran. L'alerte part après 5 s ; l'enregistrement va, chiffré, dans ses preuves. Consigne : ne jamais rappeler. » |
| 2:55 | Mode discret | **Tout effacer** | « Et tout disparaît du téléphone. » |

## Si quelque chose bloque
- Micro refusé : autoriser le micro pour le site dans les réglages du navigateur ; l'alerte part quand même, sans audio.
- Pas de micro : « Parler » propose d'importer un fichier audio fictif.
- Console vide : « Ajouter 2 messages fictifs ».

## Limites à annoncer honnêtement
Prototype sans serveur : la console lit le même navigateur ; l'assistante fonctionne avec des règles (pas d'IA externe) ; une application web ne peut ni enregistrer en arrière-plan ni cacher le témoin du micro ; un vrai service exigerait serveur sécurisé, authentification des agents, chiffrement de bout en bout et validation par une structure spécialisée.

## Si le jury demande : « Et les scénarios T1, T2, T3, T5, T7 ? »
Dans le parcours jury, vous jouez T4 et T6 en direct. Les autres scénarios **comptent quand même dans le score** : ils ont été testés par l'équipe et leurs verdicts sont affichés à l'étape « Score et correctifs », dans « Et les autres scénarios ? », avec ce qui a été constaté. Le bouton « Rejouer ces scénarios » permet au jury de les refaire lui-même : son verdict remplace celui de l'équipe. Réponse type : « Nous en faisons jouer deux en direct pour tenir en cinq minutes ; les neuf sont dans l'audit, documentés, et vous pouvez rejouer n'importe lequel. »

## Les deux scénarios du contexte béninois
- **T8, le voisin témoin** : un voisin entend que le père frappe sa fille ; peut-il signaler pour une autre personne, sans donner son nom ? (HAVEN : exposé ; SafeHer : protégé, option « Pour une autre personne ».)
- **T9, elle ne lit pas le français** : peut-elle demander de l'aide dans sa langue et être écoutée par une personne ? (HAVEN : exposé ; SafeHer : partiel, message vocal en langue nationale vers un agent, mais interface encore écrite en français.)

# Démonstration au jury : « Mon espace » de LIGHT (environ 3 minutes)

Prototype : **situations inventées uniquement**. Tout se passe dans le même navigateur ; aucun service réel n'est contacté.

## Avant la démonstration (une fois, au calme)
1. Ouvrir https://nukun-demo.netlify.app/light/espace.html sur le téléphone de démonstration.
2. Onglet **Alerte discrète** : choisir « Fon », un prénom inventé (« Étoile »), saisir le code **1234**, puis **Autoriser le micro et préparer**.
3. Ouvrir dans un **deuxième onglet** la console : https://nukun-demo.netlify.app/light/agent.html

## Déroulé
| Temps | Écran | Action | À dire |
|---|---|---|---|
| 0:00 | Calculatrice | Calculer 12 + 30, puis taper **1234 =** | « Pour Kossi, c'est une calculatrice. Le code secret ouvre Light. » |
| 0:20 | Mon espace → Parler | Choisir **Fon**, enregistrer 10 s d'un message **inventé**, accepter, envoyer | « Afi parle dans sa langue, sans écrire, sans donner son nom. » Montrer le **code de suivi** affiché une seule fois. |
| 0:50 | Console agent | Ouvrir le message, l'écouter, saisir une traduction fictive (« il menace de publier mes photos »), montrer la **priorité suggérée**, choisir la priorité, répondre | « L'outil suggère, l'humain décide. » |
| 1:30 | Mon espace → Ma réponse | Saisir le code, lire la réponse | « Aucun SMS : la réponse ne s'ouvre qu'avec le code. » |
| 1:50 | Mon espace → Assistante | Coller : « Il va publier mes photos si je ne paie pas » | Mots surlignés, constat, conseils, limites affichées. |
| 2:10 | Mon espace → Mes preuves | Code 1234, ajouter une capture **fictive** | « Chiffrée avec son code : sans le code, illisible, même en fouillant le téléphone. » |
| 2:30 | Calculatrice | « Quitter », puis **3 tapes rapides sur la zone des chiffres** ; attendre 5 s ; montrer la console : **alerte rouge** ; après 10 s, 3 tapes pour arrêter | « Rien ne change à l'écran. L'alerte part après 5 s ; l'enregistrement va, chiffré, dans ses preuves. Consigne : ne jamais rappeler. » |
| 2:55 | Mode discret | **Tout effacer** | « Et tout disparaît du téléphone. » |

## Si quelque chose bloque
- Micro refusé : autoriser le micro pour le site dans les réglages du navigateur ; l'alerte part quand même, sans audio.
- Pas de micro : « Parler » propose d'importer un fichier audio fictif.
- Console vide : « Ajouter 2 messages fictifs ».

## Limites à annoncer honnêtement
Prototype sans serveur : la console lit le même navigateur ; l'assistante fonctionne avec des règles (pas d'IA externe) ; une application web ne peut ni enregistrer en arrière-plan ni cacher le témoin du micro ; un vrai service exigerait serveur sécurisé, authentification des agents, chiffrement de bout en bout et validation par une structure spécialisée.

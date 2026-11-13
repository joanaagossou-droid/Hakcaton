# Guide d'installation et de mise en ligne

## 1. En local (démonstration, plan de secours n° 2)

Prérequis : Node.js 18 ou plus. Aucune dépendance.

```bash
cd 19_NUKUN_application
npm start                 # http://localhost:8080  (HAVEN : /haven/, LIGHT : /light/)
```

Depuis un téléphone sur le même Wi-Fi :

```bash
npm run start:lan         # écoute sur toutes les interfaces
```

puis ouvrir `http://<IP de l'ordinateur>:8080` (sous Windows : `ipconfig`). Le pare-feu peut demander une autorisation. En local, la connexion est en HTTP : le critère S5 de LIGHT reste « partiel » (c'est attendu).

## 2. Régénérer les fichiers produits

```bash
npm run build
```

enchaîne : bundle lourd de HAVEN, icônes PNG, fichier `_headers`, instantanés d'analyse, liste de pré-cache du service worker. À relancer après toute modification de HAVEN, LIGHT ou des fichiers de NUKUN.

## 3. Mise en ligne sur Netlify (recommandé : HTTPS automatique + fonction d'analyse)

1. Créer un compte Netlify (offre gratuite) et installer l'outil : `npm install -g netlify-cli`, puis `netlify login`.
2. Dans le dossier : `netlify deploy` (aperçu) puis `netlify deploy --prod`. Le fichier `netlify.toml` configure la publication, la fonction `/api/analyze` et bloque l'accès public aux dossiers `server/`, `tests/`, `tools/`, `netlify/`, `docs/`.
3. Variables d'environnement (Site settings → Environment variables) :
   - `NUKUN_ALLOWLIST` : hôtes externes autorisés à l'analyse, séparés par des virgules (ex. `equipe1.exemple.org,*.hackathon.exemple.org`). Les sections `/haven/` et `/light/` du site lui-même sont ajoutées automatiquement à partir de la variable `URL` fournie par Netlify.
   - N'ajouter **que** des sites dont l'audit est autorisé par écrit.
4. Vérifier : `https://<site>/api/status` doit répondre `{"ok":true,...}` et sa liste `allowlist` doit contenir `<site>/haven/` et `<site>/light/`. Si ce n'est pas le cas (variable `URL` non transmise à la fonction), les ajouter dans `NUKUN_ALLOWLIST`. *Vérifié le 13/11/2026 sur nukun-demo.netlify.app.* Attention : sur un nouveau site, Netlify peut activer une « protection visiteurs » (connexion obligatoire) ; la limiter aux brouillons dans Project configuration → Access & security, ou via `netlify api updateSite` avec `sso_login_context: "non_production"`.
5. Générer le QR code définitif : `node tools/gen-qr.mjs https://<site>/#/express` → `docs/qr-demo.svg`, ou ouvrir `https://<site>/#/partager`. **Scanner avec au moins trois téléphones différents** avant le pitch.

Choisir une adresse neutre, sans nom ni logo d'institution (ex. `nukun-demo`).

## 4. Autre hébergeur statique (Cloudflare Pages, GitHub Pages…)

L'application fonctionne sur tout hébergement statique HTTPS. Le fichier `_headers` est compris par Cloudflare Pages. **Sans fonction serveur**, l'analyse de HAVEN et LIGHT fonctionne quand même (mode navigateur, même site) ; seule l'analyse de sites externes est indisponible (NUKUN propose alors le mode manuel). Sur GitHub Pages, les en-têtes personnalisés ne sont pas pris en charge : les critères S5 et S3 de LIGHT baisseront, ce qui est le comportement attendu d'un audit honnête.

## 5. Après l'événement

- **Retirer HAVEN** (supprimer le dossier `haven/` et redéployer), comme prévu au mémoire § 8 bis.
- Garder NUKUN et LIGHT en ligne comme démonstrateurs, ou tout retirer.

## 6. Dépannage

| Symptôme | Cause probable | Solution |
|---|---|---|
| « Analyse automatique indisponible » | Hors ligne, ou site non autorisé | Mode manuel, ou bouton « instantané » pour HAVEN/LIGHT |
| Ancienne version affichée | Cache du service worker | Recharger deux fois, ou vider les données du site |
| `npm run test:e2e` : « Aucun navigateur trouvé » | Ni Edge ni Chrome aux emplacements connus | `BROWSER=<chemin> npm run test:e2e` |

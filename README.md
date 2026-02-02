# Krimo Alertes

Site simple (Node.js + Express) :
- Page publique : `/` (alerte qui clignote)
- Panneau admin : `/admin` (connexion + mise à jour de l’alerte)

## Déploiement sur Render
1) Crée un **Web Service**
2) Build command : `npm install`
3) Start command : `npm start`
4) Ajoute les variables d’environnement :
   - `ADMIN_USER`
   - `ADMIN_PASS`
   - `JWT_SECRET`

## Images
Remplace :
- `public/assets/logo.png`
- `public/assets/cover.png`
par tes vraies images (logo et couverture).

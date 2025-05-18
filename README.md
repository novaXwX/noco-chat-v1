HEAD
# Application de Messagerie Simple

Une application de messagerie web simple et sécurisée permettant la communication en temps réel entre utilisateurs.

## Fonctionnalités

- Interface utilisateur moderne et responsive
- Authentification sécurisée avec hachage des mots de passe
- Messages en temps réel
- Indicateurs de statut en ligne/hors ligne
- Mode sombre automatique
- Animations fluides
- Notifications système

## Prérequis

- Node.js (version 14 ou supérieure)
- npm (généralement installé avec Node.js)

## Installation

1. Clonez ce dépôt ou téléchargez les fichiers
2. Ouvrez un terminal dans le dossier du projet
3. Installez les dépendances :
   ```bash
   npm install
   ```

## Configuration

1. Ouvrez le fichier `app.js`
2. Modifiez la variable `SERVER_URL` avec l'adresse IP de votre serveur :
   ```javascript
   const SERVER_URL = 'http://votre-ip:3000';
   ```

## Démarrage

1. Démarrez le serveur :
   ```bash
   npm start
   ```
2. Ouvrez votre navigateur et accédez à :
   ```
   http://localhost:3000
   ```

## Utilisation

1. Créez un compte en entrant un nom d'utilisateur et un mot de passe
2. Connectez-vous avec vos identifiants
3. Commencez à discuter !

## Sécurité

- Les mots de passe sont hachés avec bcrypt
- Les connexions sont gérées via WebSocket sécurisé
- Aucune donnée n'est stockée de manière permanente

## Déploiement

Pour déployer l'application sur un serveur distant :

1. Copiez tous les fichiers sur votre serveur
2. Installez les dépendances avec `npm install`
3. Démarrez le serveur avec `npm start`
4. Configurez votre pare-feu pour autoriser le port 3000
5. Mettez à jour l'URL du serveur dans `app.js` sur les clients

## Support

Pour toute question ou problème, veuillez ouvrir une issue sur le dépôt GitHub. 

# noco-chat-v1
chat application
git init
git add .
git commit -m "Add all project files"
git branch -M main
git remote add origin https://github.com/novaXwX/noco-chat-v1.git
git push -u origin main
 aec1bbfe88ff03d82c9a0829b14118162a066fdb

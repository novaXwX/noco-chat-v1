const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const bcrypt = require('bcrypt');

// Stockage en mémoire (à remplacer par une base de données dans un environnement de production)
const users = new Map();
const onlineUsers = new Set();

// Middleware pour servir les fichiers statiques
app.use(express.static('.'));

// Gestion des connexions Socket.IO
io.on('connection', (socket) => {
    console.log('Nouvelle connexion');

    socket.on('login', async (data) => {
        const { username, password } = data;

        // Vérification des identifiants
        if (!users.has(username)) {
            // Création d'un nouvel utilisateur
            const hashedPassword = await bcrypt.hash(password, 10);
            users.set(username, hashedPassword);
        } else {
            // Vérification du mot de passe
            const hashedPassword = users.get(username);
            const isValid = await bcrypt.compare(password, hashedPassword);
            if (!isValid) {
                socket.emit('login_error', { message: 'Mot de passe incorrect' });
                return;
            }
        }

        // Connexion réussie
        onlineUsers.add(username);
        socket.username = username;
        socket.emit('login_success');
        
        // Notification aux autres utilisateurs
        socket.broadcast.emit('user_status', {
            username: username,
            online: true
        });
    });

    socket.on('message', (data) => {
        if (socket.username) {
            // Diffusion du message à tous les utilisateurs
            io.emit('message', {
                username: socket.username,
                message: data.message
            });
        }
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            onlineUsers.delete(socket.username);
            socket.broadcast.emit('user_status', {
                username: socket.username,
                online: false
            });
        }
        console.log('Déconnexion');
    });
});

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
}); 
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const cors = require('cors');
const path = require('path');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Stockage en mémoire des utilisateurs connectés
const connectedUsers = new Map(); // Map des utilisateurs connectés { socketId: username }

// Gestion des connexions Socket.IO
io.on('connection', (socket) => {
    console.log('Nouvelle connexion socket:', socket.id);

    socket.on('user_connected', (username) => {
        // Vérifier si le pseudo est déjà pris
        const isUsernameTaken = Array.from(connectedUsers.values()).includes(username);

        if (isUsernameTaken) {
            socket.emit('username_taken', 'Ce pseudo est déjà utilisé. Veuillez en choisir un autre.');
            console.log(`Tentative de connexion avec le pseudo '${username}' déjà pris.`);
        } else {
            connectedUsers.set(socket.id, username);
            socket.username = username;
            io.emit('user_connected', username);
            const usersList = Array.from(new Set(connectedUsers.values()));
            io.emit('connected_users', usersList);
            console.log(`${username} connecté. Total utilisateurs: ${usersList.length}`);
        }
    });

    socket.on('get_connected_users', () => {
        const usersList = Array.from(new Set(connectedUsers.values()));
        socket.emit('connected_users', usersList);
    });

    socket.on('private_message', (data) => {
        const targetSocketId = Array.from(connectedUsers.entries())
            .find(([_, username]) => username === data.to)?.[0];
        if (targetSocketId) {
            io.to(targetSocketId).emit('private_message', {
                from: data.from,
                text: data.text,
                timestamp: new Date().toISOString(),
                replyTo: data.replyTo || null
            });
            console.log(`Message envoyé de ${data.from} à ${data.to}`);
        }
    });

    socket.on('delete_message', (data) => {
        const targetSocketId = Array.from(connectedUsers.entries())
            .find(([_, username]) => username === data.to)?.[0];
        if (targetSocketId && targetSocketId !== socket.id) { // Assurez-vous de ne pas l'envoyer à soi-même deux fois
            io.to(targetSocketId).emit('delete_message', { messageId: data.messageId });
            console.log(`Message ${data.messageId} supprimé pour ${data.to} par ${data.from}`);
        }
    });

    socket.on('disconnect', () => {
        const username = connectedUsers.get(socket.id);
        if (username) {
            connectedUsers.delete(socket.id);
            io.emit('user_disconnected', username);
            console.log(`${username} déconnecté. Total utilisateurs: ${connectedUsers.size}`);
        }
    });
});

// Route par défaut
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Serveur lancé sur le port ${PORT}`);
}); 
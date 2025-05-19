const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Sert les fichiers statiques (index.html, client.js, styles.css, etc.)
app.use(express.static(__dirname));
app.use(express.json()); // Pour lire le JSON dans les requêtes

// Stockage en mémoire des utilisateurs
const users = {}; // { username: { password: string, avatar: string } }
const connectedUsers = new Map(); // Map des utilisateurs connectés { socketId: username }

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Champs manquants' });
    if (users[username]) return res.status(400).json({ error: 'Utilisateur déjà existant' });
    users[username] = {
        password: password,
        avatar: `https://ui-avatars.com/api/?name=${username}&background=random`
    };
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Champs manquants' });
    if (users[username] && users[username].password === password) {
        res.json({ 
            success: true,
            avatar: users[username].avatar
        });
    } else {
        res.status(401).json({ error: 'Identifiants incorrects' });
    }
});

// Gestion des connexions Socket.IO
io.on('connection', (socket) => {
    console.log('Nouvelle connexion socket:', socket.id);

    socket.on('user_connected', (username) => {
        // Stocke l'utilisateur connecté
        connectedUsers.set(socket.id, username);
        
        // Notifie tous les utilisateurs de la nouvelle connexion
        io.emit('user_connected', username);
        
        // Envoie la liste des utilisateurs connectés au nouvel utilisateur
        const usersList = Array.from(new Set(connectedUsers.values()));
        socket.emit('connected_users', usersList);
        
        console.log(`${username} connecté. Total utilisateurs: ${usersList.length}`);
    });

    socket.on('update_avatar', (data) => {
        const { username, avatar } = data;
        if (users[username]) {
            users[username].avatar = avatar;
            // Notifie tous les utilisateurs du changement d'avatar
            io.emit('avatar_updated', {
                username: username,
                avatar: avatar
            });
        }
    });

    socket.on('get_connected_users', () => {
        const usersList = Array.from(new Set(connectedUsers.values()));
        socket.emit('connected_users', usersList);
    });

    socket.on('private_message', (data) => {
        // Trouve le socket de l'utilisateur destinataire
        const targetSocketId = Array.from(connectedUsers.entries())
            .find(([_, username]) => username === data.to)?.[0];
        
        if (targetSocketId) {
            io.to(targetSocketId).emit('private_message', {
                from: data.from,
                text: data.text
            });
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

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Serveur lancé sur le port ${PORT}`);
}); 
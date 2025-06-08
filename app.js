const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const multer = require('multer');
const path = require('path');

// Sert les fichiers statiques (index.html, client.js, styles.css, etc.)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '50mb' })); // Augmenter la limite pour les fichiers volumineux
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuration de multer pour l'upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'uploads'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

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
                text: data.text,
                file: data.file || null
            });
        }
    });

    // Gestion du signal "en train d'écrire"
    socket.on('typing', (data) => {
        const targetSocketId = Array.from(connectedUsers.entries())
            .find(([_, username]) => username === data.to)?.[0];
        if (targetSocketId) {
            io.to(targetSocketId).emit('typing', {
                from: data.from
            });
        }
    });

    // Gestion du signal "arrêt d'écriture"
    socket.on('stop_typing', (data) => {
        const targetSocketId = Array.from(connectedUsers.entries())
            .find(([_, username]) => username === data.to)?.[0];
        if (targetSocketId) {
            io.to(targetSocketId).emit('stop_typing', {
                from: data.from
            });
        }
    });

    // Suppression d'un message pour tout le monde
    socket.on('delete_message', (data) => {
        // On relaie à tous les clients concernés (expéditeur et destinataire)
        const { messageId, to, from } = data;
        // Trouver le socket du destinataire
        const targetSocketId = Array.from(connectedUsers.entries())
            .find(([_, username]) => username === to)?.[0];
        // Supprimer chez l'expéditeur
        socket.emit('delete_message', { messageId });
        // Supprimer chez le destinataire
        if (targetSocketId) {
            io.to(targetSocketId).emit('delete_message', { messageId });
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

// Route d'upload de fichiers (POST /upload)
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
    res.json({
        url: `/uploads/${req.file.filename}`,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Serveur lancé sur le port ${PORT}`);
}); 
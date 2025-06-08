const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    maxHttpBufferSize: 1e8 // 100 MB, Augmenté pour les fichiers volumineux
});
const cors = require('cors');
const path = require('path');
const multer = require('multer'); // Ajout de multer

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Augmenter la limite pour les fichiers volumineux
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Servir les fichiers uploadés

// Configuration de multer pour l'upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'public', 'uploads')); // Chemin de destination des uploads
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname); // Nom de fichier unique
    }
});
const upload = multer({ storage: storage });

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
                timestamp: data.timestamp || new Date().toISOString(),
                replyTo: data.replyTo || null,
                id: data.id,
                file: data.file || null // S'assurer que la propriété file est transmise
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

// Route d'upload de fichiers (POST /upload)
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        console.error('Erreur d\'upload: Aucun fichier reçu');
        return res.status(400).json({ error: 'Aucun fichier reçu' });
    }
    console.log(`Fichier reçu: ${req.file.originalname} (${req.file.size} octets, ${req.file.mimetype})`);
    res.json({
        url: `/uploads/${req.file.filename}`,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
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
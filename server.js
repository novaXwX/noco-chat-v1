const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    maxHttpBufferSize: 1e8 // 100 MB, Augmenté pour les fichiers volumineux
});
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Créer le dossier uploads s'il n'existe pas
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuration de multer pour l'upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB max
    },
    fileFilter: function (req, file, cb) {
        // Accepter les images et vidéos
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Type de fichier non supporté. Seules les images et vidéos sont acceptées.'));
        }
    }
});

// Stockage en mémoire des utilisateurs connectés
const connectedUsers = new Map(); // Map des utilisateurs connectés { socketId: username }

// Gestion des connexions Socket.IO
io.on('connection', (socket) => {
    console.log('Nouvelle connexion socket:', socket.id);

    socket.on('user_connected', (username) => {
        console.log(`Tentative de connexion avec le pseudo: ${username}`);
        
        // Vérifier si le pseudo est déjà pris
        const isUsernameTaken = Array.from(connectedUsers.values()).includes(username);

        if (isUsernameTaken) {
            console.log(`Pseudo '${username}' déjà pris, envoi du message d'erreur`);
            socket.emit('username_taken', 'Ce pseudo est déjà utilisé. Veuillez en choisir un autre.');
        } else {
            console.log(`Pseudo '${username}' accepté, connexion établie`);
            connectedUsers.set(socket.id, username);
            socket.username = username;
            
            // Envoyer la confirmation de connexion au client
            socket.emit('connection_success', username);
            
            // Informer tous les clients de la nouvelle connexion
            io.emit('user_connected', username);
            
            // Envoyer la liste mise à jour des utilisateurs
            const usersList = Array.from(new Set(connectedUsers.values()));
            io.emit('connected_users', usersList);
            console.log(`Liste des utilisateurs connectés: ${usersList.join(', ')}`);
        }
    });

    socket.on('get_connected_users', () => {
        const usersList = Array.from(new Set(connectedUsers.values()));
        console.log('Envoi de la liste des utilisateurs connectés:', usersList);
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

    // Ajout : gestion des événements "en train d'écrire"
    socket.on('typing', (data) => {
        const targetSocketId = Array.from(connectedUsers.entries())
            .find(([_, username]) => username === data.to)?.[0];
        if (targetSocketId) {
            io.to(targetSocketId).emit('typing', { from: data.from });
        }
    });

    socket.on('stop_typing', (data) => {
        const targetSocketId = Array.from(connectedUsers.entries())
            .find(([_, username]) => username === data.to)?.[0];
        if (targetSocketId) {
            io.to(targetSocketId).emit('stop_typing', { from: data.from });
        }
    });

    socket.on('delete_message', (data) => {
        const { messageId, to, from, forEveryone } = data;
        
        if (forEveryone) {
            // Trouver le socket ID de l'expéditeur
            const senderSocketId = Array.from(connectedUsers.entries())
                .find(([id, username]) => username === from)?.[0];

            // Trouver le socket ID du destinataire
            const recipientSocketId = Array.from(connectedUsers.entries())
                .find(([id, username]) => username === to)?.[0];

            // Envoyer la notification de suppression à l'expéditeur
            if (senderSocketId) {
                io.to(senderSocketId).emit('delete_message', {
                    messageId: messageId,
                    forEveryone: true,
                    from: from
                });
                console.log(`Notification de suppression du message ${messageId} envoyée à l'expéditeur ${from} (${senderSocketId})`);
            }

            // Envoyer la notification de suppression au destinataire
            if (recipientSocketId) {
                io.to(recipientSocketId).emit('delete_message', {
                    messageId: messageId,
                    forEveryone: true,
                    from: from
                });
                console.log(`Notification de suppression du message ${messageId} envoyée au destinataire ${to} (${recipientSocketId})`);
            }
        }
    });

    socket.on('disconnect', () => {
        const username = connectedUsers.get(socket.id);
        if (username) {
            console.log(`Déconnexion de l'utilisateur: ${username}`);
            connectedUsers.delete(socket.id);
            io.emit('user_disconnected', username);
            const usersList = Array.from(new Set(connectedUsers.values()));
            console.log(`Liste des utilisateurs restants: ${usersList.join(', ')}`);
        }
    });
});

// Route d'upload de fichiers
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

// Gestion des erreurs d'upload
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Le fichier est trop volumineux. Taille maximale: 50MB' });
        }
        return res.status(400).json({ error: err.message });
    }
    next(err);
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
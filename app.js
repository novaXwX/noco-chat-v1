const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Sert les fichiers statiques (index.html, client.js, styles.css, etc.)
app.use(express.static(__dirname));
app.use(express.json()); // Pour lire le JSON dans les requêtes

// Stockage en mémoire des utilisateurs
const users = {}; // { username: password }

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Champs manquants' });
    if (users[username]) return res.status(400).json({ error: 'Utilisateur déjà existant' });
    users[username] = password;
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Champs manquants' });
    if (users[username] && users[username] === password) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'Identifiants incorrects' });
    }
});

// Exemple d'événement socket.io (à adapter selon tes besoins)
io.on('connection', (socket) => {
    console.log('Un utilisateur est connecté');
    // Ici tu peux gérer les messages, etc.
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Serveur lancé sur le port ${PORT}`);
}); 
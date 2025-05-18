const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Sert les fichiers statiques (index.html, client.js, styles.css, etc.)
app.use(express.static(__dirname));

// Exemple d'événement socket.io (à adapter selon tes besoins)
io.on('connection', (socket) => {
    console.log('Un utilisateur est connecté');
    // Ici tu peux gérer les messages, etc.
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Serveur lancé sur le port ${PORT}`);
}); 
// Configuration
let currentUser = null;
let selectedContact = null;
let contacts = [];
let unreadMessages = new Set();

// Éléments DOM
const pseudoForm = document.getElementById('pseudoForm');
const chatContainer = document.getElementById('chatContainer');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const messagesList = document.getElementById('messages');
const contactsList = document.getElementById('contacts');
const chatTitle = document.getElementById('chatTitle');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const toggleTheme = document.getElementById('toggleTheme');
const searchInput = document.getElementById('searchContacts');
const dropZone = document.getElementById('dropZone');

// Connexion Socket.IO
const socket = io();

// Entrée du pseudo
pseudoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pseudo = document.getElementById('pseudo').value.trim();
    if (!pseudo) return alert('Veuillez entrer un pseudo !');
    currentUser = pseudo;
    pseudoForm.style.display = 'none';
    chatContainer.style.display = 'flex';
    socket.emit('user_connected', pseudo);
});

// Affichage des contacts
function renderContacts(searchTerm = '') {
    contactsList.innerHTML = '';
    const filteredContacts = contacts.filter(contact => 
        contact.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    filteredContacts.forEach(contact => {
        const contactElement = document.createElement('div');
        contactElement.className = `contact ${contact === selectedContact ? 'selected' : ''}`;
        contactElement.innerHTML = `
            <div class="contact-info">
                <span class="contact-name">${contact}</span>
            </div>
            <div class="notification-badge ${unreadMessages.has(contact) ? 'active' : ''}"></div>
        `;
        contactElement.addEventListener('click', () => selectContact(contact));
        contactsList.appendChild(contactElement);
    });
}

function selectContact(contact) {
    selectedContact = contact;
    chatTitle.textContent = contact;
    unreadMessages.delete(contact);
    renderContacts(searchInput.value);
    messagesList.innerHTML = '';
}

// Recherche de contacts
searchInput.addEventListener('input', (e) => {
    renderContacts(e.target.value);
});

// Affichage des messages
function addMessageToChat(sender, text, isOutgoing = false) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isOutgoing ? 'outgoing' : 'incoming'}`;
    messageElement.innerHTML = `
        <div class="message-content">
            <span class="message-sender">${sender}</span>
            <p>${text}</p>
            <span class="message-time">${new Date().toLocaleTimeString()}</span>
        </div>
    `;
    messagesList.appendChild(messageElement);
    messagesList.scrollTop = messagesList.scrollHeight;
}

// Envoi de message
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (message && selectedContact) {
        socket.emit('private_message', {
            from: currentUser,
            to: selectedContact,
            text: message
        });
        addMessageToChat(currentUser, message, true);
        messageInput.value = '';
    }
});

// Gestion des sockets
socket.on('user_connected', (username) => {
    if (!contacts.includes(username) && username !== currentUser) {
        contacts.push(username);
        renderContacts();
    }
});

socket.on('user_disconnected', (username) => {
    const index = contacts.indexOf(username);
    if (index > -1) {
        contacts.splice(index, 1);
        renderContacts();
    }
});

socket.on('connected_users', (users) => {
    contacts = users.filter(user => user !== currentUser);
    renderContacts();
});

socket.on('private_message', (data) => {
    if (data.from === selectedContact || data.from === currentUser) {
        addMessageToChat(data.from, data.text, data.from === currentUser);
    } else {
        unreadMessages.add(data.from);
        renderContacts(searchInput.value);
    }
});

// --- Gestion du thème ---
function setTheme(theme) {
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(theme);
    localStorage.setItem('noco-theme', theme);
    // Change l'icône de la roue
    if (theme === 'theme-dark') {
        toggleTheme.innerHTML = '<i class="fas fa-moon"></i> Thème clair';
    } else {
        toggleTheme.innerHTML = '<i class="fas fa-sun"></i> Thème sombre';
    }
}

settingsBtn.onclick = () => {
    settingsModal.style.display = 'flex';
};
closeSettings.onclick = () => {
    settingsModal.style.display = 'none';
};
toggleTheme.onclick = () => {
    if (document.body.classList.contains('theme-dark')) {
        setTheme('theme-light');
    } else {
        setTheme('theme-dark');
    }
};

// Fermer le modal si on clique en dehors
window.onclick = (e) => {
    if (e.target === settingsModal) {
        settingsModal.style.display = 'none';
    }
};

// Thème par défaut (sombre)
(function () {
    const saved = localStorage.getItem('noco-theme');
    if (saved === 'theme-light' || saved === 'theme-dark') {
        setTheme(saved);
    } else {
        setTheme('theme-dark');
    }
})();

// --- Drag & Drop fichiers (affichage zone drop) ---
let dragCounter = 0;
window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (dropZone) {
        dropZone.style.display = 'flex';
        setTimeout(() => dropZone.classList.add('active'), 10);
    }
});
window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0 && dropZone) {
        dropZone.classList.remove('active');
        setTimeout(() => dropZone.style.display = 'none', 200);
        dragCounter = 0;
    }
});
window.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (dropZone) dropZone.classList.add('active');
});
window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    if (dropZone) {
        dropZone.classList.remove('active');
        setTimeout(() => dropZone.style.display = 'none', 200);
    }
    // Ici on pourra gérer l'upload plus tard
}); 
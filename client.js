// Configuration
let currentUser = null;
let selectedContact = null;
let contacts = [];

// Éléments DOM
const authScreen = document.getElementById('auth-screen');
const mainApp = document.getElementById('main-app');
const showLoginBtn = document.getElementById('show-login');
const showRegisterBtn = document.getElementById('show-register');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const registerUsername = document.getElementById('register-username');
const registerPassword = document.getElementById('register-password');
const contactsList = document.getElementById('contacts-list');
const chatUsername = document.getElementById('chat-username');
const chatAvatar = document.getElementById('chat-avatar');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const searchContact = document.getElementById('search-contact');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const toggleThemeBtn = document.getElementById('toggle-theme');
const closeSettingsBtn = document.getElementById('close-settings');

// Connexion Socket.IO
const socket = io();

// Authentification
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const isRegister = e.submitter.id === 'registerButton';

    try {
        const response = await fetch(`/api/${isRegister ? 'register' : 'login'}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (data.success) {
            currentUser = username;
            loginForm.style.display = 'none';
            chatContainer.style.display = 'flex';
            socket.emit('user_connected', username);
        } else {
            alert(data.error || 'Erreur de connexion');
        }
    } catch (error) {
        alert('Erreur de connexion');
    }
});

// Affichage des contacts
function renderContacts() {
    contactsList.innerHTML = '';
    contacts.forEach(contact => {
        const contactElement = document.createElement('div');
        contactElement.className = `contact ${contact === selectedContact ? 'selected' : ''}`;
        contactElement.innerHTML = `
            <div class="contact-info">
                <span class="contact-name">${contact}</span>
            </div>
        `;
        contactElement.addEventListener('click', () => selectContact(contact));
        contactsList.appendChild(contactElement);
    });
}

function selectContact(contact) {
    selectedContact = contact;
    document.querySelector('.chat-header h2').textContent = contact;
    renderContacts();
    messagesList.innerHTML = '';
}

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
    }
});

// --- Gestion des onglets Auth ---
showLoginBtn.onclick = (e) => {
    e && e.preventDefault && e.preventDefault();
    showLoginBtn.classList.add('bg-blue-600', 'text-white');
    showLoginBtn.classList.remove('bg-gray-700', 'text-gray-300');
    showRegisterBtn.classList.remove('bg-blue-600', 'text-white');
    showRegisterBtn.classList.add('bg-gray-700', 'text-gray-300');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
};
showRegisterBtn.onclick = (e) => {
    e && e.preventDefault && e.preventDefault();
    showRegisterBtn.classList.add('bg-blue-600', 'text-white');
    showRegisterBtn.classList.remove('bg-gray-700', 'text-gray-300');
    showLoginBtn.classList.remove('bg-blue-600', 'text-white');
    showLoginBtn.classList.add('bg-gray-700', 'text-gray-300');
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
};

// --- Inscription ---
registerForm.onsubmit = async e => {
    e.preventDefault();
    const username = registerUsername.value.trim();
    const password = registerPassword.value.trim();
    if (!username || !password) return alert('Remplis tous les champs !');
    if (username.toLowerCase() === 'admin') return alert('Ce nom est réservé à l\'administrateur.');
    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
            alert('Compte créé ! Connecte-toi.');
            showLoginBtn.click();
        } else {
            alert(data.error || 'Erreur lors de la création du compte');
        }
    } catch (err) {
        alert('Erreur réseau');
    }
};

// --- Connexion ---
loginForm.onsubmit = async e => {
    e.preventDefault();
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();
    if (!username || !password) return alert('Remplis tous les champs !');
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
            currentUser = username;
            authScreen.classList.add('hidden');
            mainApp.classList.remove('hidden');
            // Connexion au socket
            socket.emit('user_connected', username);
            // Récupération de la liste des utilisateurs connectés
            socket.emit('get_connected_users');
        } else {
            alert(data.error || 'Identifiants incorrects !');
        }
    } catch (err) {
        alert('Erreur réseau');
    }
};

// --- Affichage des contacts ---
function renderContacts(filter = '') {
    contactsList.innerHTML = '';
    contacts
        .filter(c => c.name.toLowerCase().includes(filter.toLowerCase()))
        .forEach(contact => {
            const li = document.createElement('li');
            li.className = `contact-item ${(selectedContact && selectedContact.name === contact.name) ? 'selected' : ''}`;
            li.innerHTML = `
                <div class="flex items-center space-x-3 p-3 hover:bg-gray-700 rounded-lg cursor-pointer">
                    <div class="relative">
                        <img src="${contact.avatar}" alt="${contact.name}" class="w-10 h-10 rounded-full">
                        <span class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"></span>
                    </div>
                    <div>
                        <h3 class="text-white font-medium">${contact.name}</h3>
                        <p class="text-gray-400 text-sm">En ligne</p>
                    </div>
                </div>
            `;
            li.onclick = () => selectContact(contact);
            contactsList.appendChild(li);
        });
}
searchContact.oninput = e => renderContacts(e.target.value);

// --- Sélection d'un contact ---
function selectContact(contact) {
    selectedContact = contact;
    chatUsername.textContent = contact.name;
    chatAvatar.src = contact.avatar;
    renderMessages();
    renderContacts(searchContact.value);
}

// --- Affichage des messages ---
function renderMessages() {
    chatMessages.innerHTML = '';
    if (!selectedContact) return;
    selectedContact.messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = 'message-bubble ' + (msg.from === currentUser ? 'sent' : 'received');
        div.textContent = msg.text;
        chatMessages.appendChild(div);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- Envoi de message ---
chatForm.onsubmit = e => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text || !selectedContact) return;
    
    // Envoi du message via socket
    socket.emit('private_message', {
        to: selectedContact.name,
        from: currentUser,
        text: text
    });
    
    // Ajout du message localement
    selectedContact.messages.push({ from: currentUser, text });
    renderMessages();
    chatInput.value = '';
};

// --- Paramètres (thème) ---
settingsBtn.onclick = () => {
    settingsModal.classList.remove('hidden');
};
closeSettingsBtn.onclick = () => {
    settingsModal.classList.add('hidden');
};
toggleThemeBtn.onclick = () => {
    if (document.body.classList.contains('theme-dark')) {
        document.body.classList.remove('theme-dark');
        document.body.classList.add('theme-light');
    } else {
        document.body.classList.remove('theme-light');
        document.body.classList.add('theme-dark');
    }
};

// --- Initialisation ---
if (!document.body.classList.contains('theme-dark') && !document.body.classList.contains('theme-light')) {
    document.body.classList.add('theme-dark');
} 
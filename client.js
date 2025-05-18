// Configuration
let currentUser = null;
let selectedContact = null;
let contacts = [
    { id: 1, name: 'Bot', avatar: 'https://randomuser.me/api/portraits/lego/1.jpg', messages: [
        { from: 'Bot', text: 'Bonjour ! Je suis ton assistant virtuel. Pose-moi une question ou commence à discuter !' }
    ] }
];

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

// Fonctions utilitaires
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function addMessage(message, isSent = false) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
    messageElement.textContent = message;
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

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
            renderContacts();
            selectContact(contacts[0].id);
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
    contacts.filter(c => c.name.toLowerCase().includes(filter.toLowerCase())).forEach(contact => {
        const li = document.createElement('li');
        li.className = (selectedContact && selectedContact.id === contact.id) ? 'selected' : '';
        li.innerHTML = `<img src="${contact.avatar}" alt="avatar"><span>${contact.name}</span>`;
        li.onclick = () => selectContact(contact.id);
        contactsList.appendChild(li);
    });
}
searchContact.oninput = e => renderContacts(e.target.value);

// --- Sélection d'un contact ---
function selectContact(id) {
    selectedContact = contacts.find(c => c.id === id);
    chatUsername.textContent = selectedContact.name;
    chatAvatar.src = selectedContact.avatar;
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

// --- Envoi de message et réponse du bot ---
chatForm.onsubmit = e => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text || !selectedContact) return;
    selectedContact.messages.push({ from: currentUser, text });
    renderMessages();
    chatInput.value = '';
    setTimeout(() => botReply(text), 700);
};

function botReply(userMsg) {
    // Réponses simples ou aléatoires
    const lower = userMsg.toLowerCase();
    let reply = "Je n'ai pas compris, peux-tu reformuler ?";
    if (lower.includes('bonjour') || lower.includes('salut')) reply = 'Salut ! Comment puis-je t\'aider aujourd\'hui ?';
    else if (lower.includes('ça va')) reply = 'Je vais très bien, merci ! Et toi ?';
    else if (lower.includes('merci')) reply = 'Avec plaisir !';
    else if (lower.includes('heure')) reply = `Il est ${new Date().toLocaleTimeString()}`;
    else if (lower.includes('date')) reply = `Nous sommes le ${new Date().toLocaleDateString()}`;
    else if (lower.includes('qui es-tu')) reply = "Je suis un bot de démonstration !";
    else if (lower.includes('aide')) reply = "Je peux répondre à des questions simples ou discuter avec toi.";
    else if (lower.includes('bye')) reply = "Au revoir ! Passe une bonne journée.";
    selectedContact.messages.push({ from: 'Bot', text: reply });
    renderMessages();
}

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
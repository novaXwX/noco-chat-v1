// Configuration
let currentUser = null;
let selectedContact = null;
let contacts = [];
let unreadMessages = new Set();
let fileToUpload = null;
let currentReplyMessage = null;
let chatMessages = new Map(); // Pour stocker les messages par contact

// Éléments DOM
const pseudoForm = document.getElementById('pseudoForm');
const chatContainer = document.getElementById('chatContainer');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const messagesList = document.getElementById('messages');
const contactsList = document.getElementById('contacts');
const chatTitle = document.getElementById('chatTitle');
const searchInput = document.getElementById('searchContacts');
const dropZone = document.getElementById('dropZone');
const chatHeader = document.querySelector('.chat-header');

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

// Gérer l'événement de pseudo déjà pris
socket.on('username_taken', (message) => {
    alert(message);
    pseudoForm.style.display = 'flex'; // Réafficher le formulaire de pseudo
    chatContainer.style.display = 'none'; // Masquer le conteneur de chat
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
                <div class="contact-name">${contact}</div>
            </div>
            <div class="notification-badge ${unreadMessages.has(contact) ? 'active' : ''}"></div>
        `;
        contactElement.onclick = () => selectContact(contact);
        contactsList.appendChild(contactElement);
    });
}

function selectContact(contact) {
    selectedContact = contact;
    chatTitle.textContent = contact;
    unreadMessages.delete(contact);
    renderContacts(searchInput.value);
    messagesList.innerHTML = '';

    // Charger et afficher tous les messages pour le contact nouvellement sélectionné
    if (chatMessages.has(contact) && chatMessages.get(contact).length > 0) {
        const messagesForContact = chatMessages.get(contact);
        messagesForContact.forEach(msg => {
            // Déterminer si le message est sortant du point de vue de currentUser
            const isOutgoing = msg.from === currentUser;
            addMessageToChat(msg.from, msg.text, isOutgoing, msg.replyTo, msg.id);
        });
    } else {
        // Si le chat est vide, afficher le message d'introduction
        displayIntroductoryMessage();
    }
}

// Fonction pour afficher le message d'introduction
function displayIntroductoryMessage() {
    const introMessageElement = document.createElement('div');
    introMessageElement.id = 'introMessage';
    introMessageElement.className = 'introductory-message';
    introMessageElement.innerHTML = `
        <i class="fas fa-lock"></i> Messages et appels sont chiffrés de bout en bout.
        Seules les personnes de ce chat peuvent les lire, les écouter ou les partager.
    `;
    messagesList.appendChild(introMessageElement);
    messagesList.scrollTop = messagesList.scrollHeight;
}

// Fonction pour masquer le message d'introduction
function hideIntroductoryMessage() {
    const introMessageElement = document.getElementById('introMessage');
    if (introMessageElement) {
        introMessageElement.remove();
    }
}

// Recherche de contacts
searchInput.addEventListener('input', (e) => {
    renderContacts(e.target.value);
});

// Affichage des messages
function addMessageToChat(sender, text, isOutgoing = false, replyTo = null, messageId = null) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isOutgoing ? 'outgoing' : 'incoming'}`;
    messageElement.id = messageId;

    let replyHtml = '';
    if (replyTo) {
        replyHtml = `
            <div class="message-reply-preview">
                <span class="reply-sender">${replyTo.sender}</span>
                <p class="reply-content">${replyTo.text}</p>
            </div>
        `;
    }

    messageElement.innerHTML = `
        ${replyHtml}
        <div class="message-content-row" style="display:flex;align-items:flex-start;justify-content:space-between;">
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span class="message-sender" style="font-size:1rem;">${sender}</span>
                    <span class="message-menu-btn" style="cursor:pointer;font-size:1rem;line-height:1;">&#8942;</span>
                </div>
                <p style="margin:4px 0 0 0;word-break:break-word;">${text}</p>
            </div>
        </div>
        <span class="message-time" style="display:block;text-align:right;margin-top:2px;opacity:0.7;">${new Date().toLocaleTimeString()}</span>
    `;
    messagesList.appendChild(messageElement);
    messagesList.scrollTop = messagesList.scrollHeight;

    // Gestion du menu de suppression
    const btn = messageElement.querySelector('.message-menu-btn');
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showDeleteMenu(messageElement, isOutgoing, messageId, sender, text);
    });
}

// Menu suppression façon WhatsApp
function showDeleteMenu(messageElement, isOutgoing, messageId, messageSender, messageText) {
    // Supprime un éventuel menu déjà ouvert
    const oldMenu = document.getElementById('delete-menu');
    if (oldMenu) oldMenu.remove();
    // Création du menu
    const menu = document.createElement('div');
    menu.id = 'delete-menu';
    menu.style.position = 'absolute';
    menu.style.background = 'var(--bg-sidebar)';
    menu.style.color = 'var(--text-main)';
    menu.style.border = '1px solid var(--border)';
    menu.style.borderRadius = '8px';
    menu.style.boxShadow = '0 2px 8px rgba(44,62,80,0.10)';
    menu.style.padding = '8px 0';
    menu.style.zIndex = 1000;
    menu.style.right = '30px';
    menu.style.top = '30px';
    menu.style.minWidth = '160px';
    menu.style.textAlign = 'left';

    // Option Répondre
    const replyOption = document.createElement('div');
    replyOption.textContent = 'Répondre';
    replyOption.style.padding = '8px 16px';
    replyOption.style.cursor = 'pointer';
    replyOption.onmouseover = () => replyOption.style.background = 'var(--contact-hover)';
    replyOption.onmouseout = () => replyOption.style.background = 'none';
    replyOption.onclick = () => {
        currentReplyMessage = {
            id: messageId,
            sender: messageSender,
            text: messageText
        };
        displayReplyPreview(messageSender, messageText);
        menu.remove();
    };
    menu.appendChild(replyOption);

    // Option supprimer pour moi
    const delForMe = document.createElement('div');
    delForMe.textContent = 'Supprimer pour moi';
    delForMe.style.padding = '8px 16px';
    delForMe.style.cursor = 'pointer';
    delForMe.onmouseover = () => delForMe.style.background = 'var(--contact-hover)';
    delForMe.onmouseout = () => delForMe.style.background = 'none';
    delForMe.onclick = () => {
        messageElement.remove();
        menu.remove();
    };
    menu.appendChild(delForMe);
    // Option supprimer pour tout le monde (si c'est mon message)
    if (isOutgoing) {
        const delForAll = document.createElement('div');
        delForAll.textContent = 'Supprimer pour tout le monde';
        delForAll.style.padding = '8px 16px';
        delForAll.style.cursor = 'pointer';
        delForAll.onmouseover = () => delForAll.style.background = 'var(--contact-hover)';
        delForAll.onmouseout = () => delForAll.style.background = 'none';
        delForAll.onclick = () => {
            // Suppression pour tout le monde
            socket.emit('delete_message', {
                messageId: messageId,
                to: selectedContact,
                from: currentUser
            });
            messageElement.remove();
            menu.remove();
        };
        menu.appendChild(delForAll);
    }
    // Fermer le menu si on clique ailleurs
    document.body.appendChild(menu);
    const rect = messageElement.getBoundingClientRect();
    menu.style.left = (rect.right - 180) + 'px';
    menu.style.top = (rect.top + 20 + window.scrollY) + 'px';
    function closeMenu(e) {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('mousedown', closeMenu);
        }
    }
    setTimeout(() => document.addEventListener('mousedown', closeMenu), 10);
}

// Fonction pour afficher la prévisualisation de la réponse
function displayReplyPreview(sender, text) {
    let replyPreview = document.getElementById('replyPreview');
    if (!replyPreview) {
        replyPreview = document.createElement('div');
        replyPreview.id = 'replyPreview';
        replyPreview.className = 'message-reply-input-preview';
        replyPreview.innerHTML = `
            <div class="reply-header">
                Répondre à <span class="reply-sender">${sender}</span>
                <span class="close-reply-preview">&times;</span>
            </div>
            <p class="reply-content">${text}</p>
        `;
        messageForm.insertBefore(replyPreview, messageInput);

        replyPreview.querySelector('.close-reply-preview').addEventListener('click', () => {
            currentReplyMessage = null;
            replyPreview.remove();
        });
    }
    messageInput.focus();
}

// Envoi de message
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (message && selectedContact) {
        const messageId = 'msg-' + Date.now() + '-' + Math.floor(Math.random()*10000);
        const messageData = {
            id: messageId,
            from: currentUser,
            to: selectedContact,
            text: message,
            timestamp: new Date().toISOString()
        };

        if (currentReplyMessage) {
            messageData.replyTo = currentReplyMessage;
            currentReplyMessage = null; // Réinitialiser après l'envoi
            document.getElementById('replyPreview')?.remove();
        }

        socket.emit('private_message', messageData);
        
        // Stocker le message pour l'expéditeur (dans son propre historique de chat)
        if (!chatMessages.has(selectedContact)) {
            chatMessages.set(selectedContact, []);
        }
        chatMessages.get(selectedContact).push(messageData);

        addMessageToChat(currentUser, message, true, messageData.replyTo, messageId);
        messageInput.value = '';
        hideIntroductoryMessage(); // Masquer le message d'introduction après le premier message
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
    // Stocker le message entrant pour le destinataire (dans son propre historique de chat)
    if (!chatMessages.has(data.from)) {
        chatMessages.set(data.from, []);
    }
    chatMessages.get(data.from).push(data);

    if (data.file) {
        addFileToChat(data.from, data.file, data.from === currentUser);
    } else if (data.from === selectedContact || data.from === currentUser) {
        // Afficher le message uniquement si le contact actuel est l'expéditeur OU si c'est son propre message (pour l'écho)
        addMessageToChat(data.from, data.text, data.from === currentUser, data.replyTo, data.id);
        hideIntroductoryMessage(); // Masquer le message d'introduction après le premier message
    } else {
        // Si c'est un message entrant pour un autre chat, marquer comme non lu
        unreadMessages.add(data.from);
        renderContacts(searchInput.value);
    }
});

// Réception de la suppression pour tout le monde
socket.on('delete_message', (data) => {
    const msgElem = document.getElementById(data.messageId);
    if (msgElem) msgElem.remove();

    // Retirer également du stockage côté client
    if (chatMessages.has(data.from)) {
        let messages = chatMessages.get(data.from);
        chatMessages.set(data.from, messages.filter(msg => msg.id !== data.messageId));
    }
    if (chatMessages.has(data.to)) {
        let messages = chatMessages.get(data.to);
        chatMessages.set(data.to, messages.filter(msg => msg.id !== data.messageId));
    }
});

// --- Drag & Drop fichiers (affichage zone drop + upload) ---
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
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileUpload(e.dataTransfer.files[0]);
    }
});

// Fonction d'upload de fichier (désactivée)
function handleFileUpload(file) {
    alert("L'envoi de fichiers est désactivé pour le moment.");
    return;
}

// Affichage d'un fichier dans le chat (désactivé)
function addFileToChat(sender, fileData, isOutgoing = false) {
    // Ne rien faire
}

// Ajout de l'affichage "en train d'écrire..." sous le nom du contact et dans la zone de chat
function showTypingIndicator(sender) {
    // Sous le nom du contact
    let typingElem = document.getElementById('typing-indicator-header');
    if (!typingElem) {
        typingElem = document.createElement('div');
        typingElem.id = 'typing-indicator-header';
        typingElem.style.fontSize = '0.95rem';
        typingElem.style.color = 'var(--primary-color)';
        typingElem.style.marginTop = '2px';
        chatHeader.appendChild(typingElem);
    }
    typingElem.textContent = `${sender} est en train d'écrire...`;

    // Dans la zone de chat
    let typingChatElem = document.getElementById('typing-indicator-chat');
    if (!typingChatElem) {
        typingChatElem = document.createElement('div');
        typingChatElem.id = 'typing-indicator-chat';
        typingChatElem.style.fontSize = '1rem';
        typingChatElem.style.color = 'var(--primary-color)';
        typingChatElem.style.margin = '8px 0 0 12px';
        messagesList.appendChild(typingChatElem);
    }
    typingChatElem.textContent = `${sender} écrit...`;

    // Masquer après 2 secondes sans nouveau signal
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(hideTypingIndicator, 2000);
}

function hideTypingIndicator() {
    const typingElem = document.getElementById('typing-indicator-header');
    if (typingElem) typingElem.remove();
    const typingChatElem = document.getElementById('typing-indicator-chat');
    if (typingChatElem) typingChatElem.remove();
}

// Émission du signal "en train d'écrire" ou "arrêt d'écriture"
messageInput.addEventListener('input', () => {
    if (selectedContact) {
        if (messageInput.value.length > 0) {
            socket.emit('typing', { from: currentUser, to: selectedContact });
        } else {
            socket.emit('stop_typing', { from: currentUser, to: selectedContact });
        }
    }
});

// Réception du signal "en train d'écrire"
socket.on('typing', (data) => {
    if (data.from === selectedContact) {
        showTypingIndicator(data.from);
    }
});

// Réception du signal "arrêt d'écriture"
socket.on('stop_typing', (data) => {
    if (data.from === selectedContact) {
        hideTypingIndicator();
    }
}); 
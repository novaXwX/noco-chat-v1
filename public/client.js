// Configuration
let currentUser = null;
let selectedContact = null;
let contacts = [];
let unreadMessages = new Set();
let fileToUpload = null;
let currentReplyMessage = null;

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
const chatHeader = document.querySelector('.chat-header');
const emojiBtn = document.getElementById('emojiBtn');
const emojiPicker = document.getElementById('emojiPicker');

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
function addMessageToChat(sender, text, isOutgoing = false, replyTo = null) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isOutgoing ? 'outgoing' : 'incoming'}`;
    const messageId = 'msg-' + Date.now() + '-' + Math.floor(Math.random()*10000);
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
        <button class="reply-btn" data-message-id="${messageId}" data-sender="${sender}" data-text="${text}" title="Répondre"><i class="fas fa-reply"></i></button>
    `;
    messagesList.appendChild(messageElement);
    messagesList.scrollTop = messagesList.scrollHeight;

    // Gestion du menu de suppression
    const btn = messageElement.querySelector('.message-menu-btn');
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showDeleteMenu(messageElement, isOutgoing, messageId);
    });

    // Gestion du bouton de réponse
    const replyButton = messageElement.querySelector('.reply-btn');
    replyButton.addEventListener('click', () => {
        const msgId = replyButton.dataset.messageId;
        const msgSender = replyButton.dataset.sender;
        const msgText = replyButton.dataset.text;
        
        currentReplyMessage = {
            id: msgId,
            sender: msgSender,
            text: msgText
        };
        
        // Afficher la prévisualisation de la réponse dans la zone de saisie
        displayReplyPreview(msgSender, msgText);
    });
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

// Menu suppression façon WhatsApp
function showDeleteMenu(messageElement, isOutgoing, messageId) {
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

// Envoi de message
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (message && selectedContact) {
        const messageData = {
            from: currentUser,
            to: selectedContact,
            text: message
        };

        if (currentReplyMessage) {
            messageData.replyTo = currentReplyMessage;
            currentReplyMessage = null; // Réinitialiser après l'envoi
            document.getElementById('replyPreview')?.remove();
        }

        socket.emit('private_message', messageData);
        addMessageToChat(currentUser, message, true, messageData.replyTo);
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
    if (data.file) {
        addFileToChat(data.from, data.file, data.from === currentUser);
    } else if (data.from === selectedContact || data.from === currentUser) {
        addMessageToChat(data.from, data.text, data.from === currentUser, data.replyTo);
    } else {
        unreadMessages.add(data.from);
        renderContacts(searchInput.value);
    }
});

// Réception de la suppression pour tout le monde
socket.on('delete_message', (data) => {
    const msgElem = document.getElementById(data.messageId);
    if (msgElem) msgElem.remove();
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

// --- Emoji Button (nouveau sélecteur d'emojis) ---
if (window.EmojiButton) {
    const picker = new EmojiButton({
        position: 'top-start',
        zIndex: 2000,
        autoHide: false,
        theme: document.body.classList.contains('theme-dark') ? 'dark' : 'light',
    });
    document.addEventListener('DOMContentLoaded', () => {
        const emojiBtn = document.getElementById('emojiBtn');
        const messageInput = document.getElementById('messageInput');
        if (emojiBtn && messageInput) {
            emojiBtn.addEventListener('click', (e) => {
                e.preventDefault();
                messageInput.focus();
                emojiBtn.title = 'Astuce : utilise Windows + . pour ouvrir les emojis !';
            });
        }
    });
    picker.on('emoji', emoji => {
        console.log('Emoji choisi :', emoji);
        const input = document.getElementById('messageInput');
        if (!input) return;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;
        input.value = text.slice(0, start) + emoji.emoji + text.slice(end);
        input.focus();
        input.selectionStart = input.selectionEnd = start + emoji.emoji.length;
    });
} 
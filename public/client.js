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
        <i class="fas fa-lock"></i> Les messages échangés sont éphémères et chiffrés de bout en bout. Seuls les deux correspondants peuvent les consulter. Une fois la connexion terminée, tous les messages sont supprimés pour assurer une confidentialité totale.
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

    // Ajouter le bouton de menu contextuel
    const menuButton = `<button class="message-menu-button"><i class="fas fa-ellipsis-v"></i></button>`;

    messageElement.innerHTML = `
        ${replyHtml}
        <div class="message-content-row" style="display:flex;align-items:flex-start;justify-content:space-between;">
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span class="message-sender" style="font-size:1rem;">${sender}</span>
                </div>
                <p style="margin:4px 0 0 0;word-break:break-word;">${text}</p>
            </div>
            ${menuButton}
        </div>
        <span class="message-time" style="display:block;text-align:right;margin-top:2px;opacity:0.7;">${new Date().toLocaleTimeString()}</span>
    `;

    // Ajouter le gestionnaire d'événements pour le menu contextuel
    const menuBtn = messageElement.querySelector('.message-menu-button');
    if (menuBtn) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Empêcher la propagation pour ne pas fermer immédiatement
            showContextMenu(e, messageId, sender, text, isOutgoing);
        });
    }

    messagesList.appendChild(messageElement);
    messagesList.scrollTop = messagesList.scrollHeight;
}

// Fonction pour afficher le menu contextuel
function showContextMenu(e, messageId, sender, text, isOutgoing) {
    // Supprimer tout menu existant
    const existingMenu = document.getElementById('messageContextMenu');
    if (existingMenu) existingMenu.remove();

    const contextMenu = document.createElement('div');
    contextMenu.id = 'messageContextMenu';
    contextMenu.className = 'message-context-menu';
    contextMenu.style.top = `${e.clientY}px`;
    contextMenu.style.left = `${e.clientX}px`;

    // Option Répondre
    const replyOption = document.createElement('button');
    replyOption.innerHTML = '<i class="fas fa-reply"></i> Répondre';
    replyOption.addEventListener('click', () => {
        currentReplyMessage = { id: messageId, sender: sender, text: text };
        displayReplyPreview(sender, text);
        contextMenu.remove();
    });
    contextMenu.appendChild(replyOption);

    // Options Supprimer (si le message est sortant)
    if (isOutgoing) {
        const deleteForMeOption = document.createElement('button');
        deleteForMeOption.innerHTML = '<i class="fas fa-trash"></i> Supprimer pour moi';
        deleteForMeOption.addEventListener('click', () => {
            deleteMessage(messageId, false);
            contextMenu.remove();
        });
        contextMenu.appendChild(deleteForMeOption);

        const deleteForEveryoneOption = document.createElement('button');
        deleteForEveryoneOption.innerHTML = '<i class="fas fa-trash-alt"></i> Supprimer pour tout le monde';
        deleteForEveryoneOption.addEventListener('click', () => {
            deleteMessage(messageId, true);
            contextMenu.remove();
        });
        contextMenu.appendChild(deleteForEveryoneOption);
    }

    document.body.appendChild(contextMenu);

    // Fermer le menu si on clique ailleurs
    document.addEventListener('click', function closeMenu(event) {
        if (!contextMenu.contains(event.target) && event.target !== menuBtn) {
            contextMenu.remove();
            document.removeEventListener('click', closeMenu);
        }
    });
}

// Fonction pour supprimer un message
function deleteMessage(messageId, forEveryone) {
    const messageData = {
        messageId: messageId,
        from: currentUser,
        to: selectedContact,
        forEveryone: forEveryone
    };

    socket.emit('delete_message', messageData);

    // Si c'est une suppression locale, supprimer immédiatement
    if (!forEveryone) {
        const msgElem = document.getElementById(messageId);
        if (msgElem) msgElem.remove();

        // Retirer du stockage côté client
        if (chatMessages.has(selectedContact)) {
            let messages = chatMessages.get(selectedContact);
            chatMessages.set(selectedContact, messages.filter(msg => msg.id !== messageId));
        }
    }
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

// Gestion des fichiers
function handleFileUpload(file) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const fileData = {
            name: file.name,
            type: file.type,
            size: file.size,
            data: e.target.result
        };
        
        const messageId = 'msg-' + Date.now() + '-' + Math.floor(Math.random()*10000);
        const messageData = {
            id: messageId,
            from: currentUser,
            to: selectedContact,
            file: fileData,
            timestamp: new Date().toISOString()
        };

        socket.emit('private_message', messageData);
        
        // Stocker le message pour l'expéditeur
        if (!chatMessages.has(selectedContact)) {
            chatMessages.set(selectedContact, []);
        }
        chatMessages.get(selectedContact).push(messageData);

        addFileToChat(currentUser, fileData, true, messageId);
        hideIntroductoryMessage();
    };
    reader.readAsDataURL(file);
}

function addFileToChat(sender, fileData, isOutgoing = false, messageId = null) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isOutgoing ? 'outgoing' : 'incoming'}`;
    if (messageId) messageElement.id = messageId;

    let fileContent = '';
    if (fileData.type.startsWith('image/')) {
        fileContent = `<img src="${fileData.data}" alt="${fileData.name}" class="message-image" onclick="openMediaViewer(this.src)">`;
    } else if (fileData.type.startsWith('video/')) {
        fileContent = `
            <video controls class="message-video">
                <source src="${fileData.data}" type="${fileData.type}">
                Votre navigateur ne supporte pas la lecture de vidéos.
            </video>`;
    } else {
        fileContent = `<a href="${fileData.data}" download="${fileData.name}" class="message-file">
            <i class="fas fa-file"></i> ${fileData.name}
        </a>`;
    }

    messageElement.innerHTML = `
        <div class="message-content-row">
            <div class="message-content">
                <span class="message-sender">${sender}</span>
                ${fileContent}
            </div>
        </div>
        <span class="message-time">${new Date().toLocaleTimeString()}</span>
    `;
    messagesList.appendChild(messageElement);
    messagesList.scrollTop = messagesList.scrollHeight;
}

// Fonction pour ouvrir le visualiseur de médias
function openMediaViewer(src) {
    const viewer = document.createElement('div');
    viewer.className = 'media-viewer';
    viewer.innerHTML = `
        <div class="media-viewer-content">
            <img src="${src}" alt="Image en plein écran">
            <button class="close-viewer">&times;</button>
        </div>
    `;
    document.body.appendChild(viewer);
    
    viewer.querySelector('.close-viewer').onclick = () => viewer.remove();
    viewer.onclick = (e) => {
        if (e.target === viewer) viewer.remove();
    };
}

// Gestionnaire d'événements pour le glisser-déposer
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.display = 'flex';
});

dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.style.display = 'none';
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.display = 'none';
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileUpload(files[0]);
    }
});

// Ajout du bouton d'envoi de fichier
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'image/*,video/*';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);

const fileButton = document.createElement('button');
fileButton.type = 'button';
fileButton.innerHTML = '<i class="fas fa-paperclip"></i>';
fileButton.className = 'file-button';
messageForm.insertBefore(fileButton, messageInput);

fileButton.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileUpload(e.target.files[0]);
        e.target.value = ''; // Réinitialiser l'input
    }
});

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
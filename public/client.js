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

// Logs de connexion Socket.IO
socket.on('connect', () => {
    console.log('Connecté au serveur Socket.IO');
    if (currentUser) {
        socket.emit('user_connected', currentUser);
    }
});

socket.on('connect_error', (error) => {
    console.error('Erreur de connexion Socket.IO:', error);
    alert('Erreur de connexion au serveur. Veuillez réessayer.');
    pseudoForm.style.display = 'flex';
    chatContainer.style.display = 'none';
});

// Entrée du pseudo
pseudoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pseudo = document.getElementById('pseudo').value.trim();
    if (!pseudo) return alert('Veuillez entrer un pseudo !');
    
    if (!socket.connected) {
        alert('Pas de connexion au serveur. Veuillez réessayer.');
        return;
    }
    
    console.log('Tentative de connexion avec le pseudo:', pseudo);
    currentUser = pseudo;
    socket.emit('user_connected', pseudo);
});

// Gérer l'événement de pseudo déjà pris
socket.on('username_taken', (message) => {
    console.log('Pseudo déjà pris:', message);
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

// Nouvelle fonction pour rendre un seul élément de message, gérant tous les types et états
function renderSingleMessage(messageData) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${messageData.from === currentUser ? 'outgoing' : 'incoming'}`;
    messageElement.id = messageData.id;

    let messageContentHtml = '';
    const isDeleted = messageData.deleted;

    if (isDeleted) {
        messageContentHtml = `
            <div class="message-content-row deleted-message-display">
                <i class="fas fa-ban deleted-icon"></i>
                <p class="deleted-text">Ce message a été supprimé.</p>
            </div>
        `;
        messageElement.classList.add('deleted');
    } else if (messageData.file) {
        let fileContent = '';
        if (messageData.file.type.startsWith('image/')) {
            fileContent = `
                <div class="message-media">
                    <img src="${messageData.file.url}" alt="${messageData.file.name}" class="message-image" onclick="openMediaViewer(this.src)">
                    <div class="file-info">
                        <span class="file-name">${messageData.file.name}</span>
                        <span class="file-size">${formatFileSize(messageData.file.size)}</span>
                    </div>
                </div>`;
        } else if (messageData.file.type.startsWith('video/')) {
            fileContent = `
                <div class="message-media">
                    <video controls class="message-video">
                        <source src="${messageData.file.url}" type="${messageData.file.type}">
                        Votre navigateur ne supporte pas la lecture de vidéos.
                    </video>
                    <div class="file-info">
                        <span class="file-name">${messageData.file.name}</span>
                        <span class="file-size">${formatFileSize(messageData.file.size)}</span>
                    </div>
                </div>`;
        } else {
            fileContent = `
                <div class="message-file">
                    <i class="fas fa-file"></i>
                    <div class="file-info">
                        <span class="file-name">${messageData.file.name}</span>
                        <span class="file-size">${formatFileSize(messageData.file.size)}</span>
                    </div>
                </div>`;
        }

        let replyHtml = '';
        if (messageData.replyTo) {
            replyHtml = `
                <div class="message-reply-preview">
                    <span class="reply-sender">${messageData.replyTo.sender}</span>
                    <p class="reply-content">${messageData.replyTo.text}</p>
                </div>
            `;
        }

        messageContentHtml = `
            ${replyHtml}
            <div class="message-content-row" style="display:flex;align-items:flex-start;justify-content:space-between;">
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span class="message-sender" style="font-size:1rem;">${messageData.from}</span>
                    </div>
                    ${fileContent}
                </div>
                <button class="message-menu-button"><i class="fas fa-ellipsis-v"></i></button>
            </div>
            <span class="message-time" style="display:block;text-align:right;margin-top:2px;opacity:0.7;">${new Date(messageData.timestamp).toLocaleTimeString()}</span>
        `;
    } else {
        let replyHtml = '';
        if (messageData.replyTo) {
            replyHtml = `
                <div class="message-reply-preview">
                    <span class="reply-sender">${messageData.replyTo.sender}</span>
                    <p class="reply-content">${messageData.replyTo.text}</p>
                </div>
            `;
        }
        
        messageContentHtml = `
            ${replyHtml}
            <div class="message-content-row" style="display:flex;align-items:flex-start;justify-content:space-between;">
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span class="message-sender" style="font-size:1rem;">${messageData.from}</span>
                    </div>
                    <p style="margin:4px 0 0 0;word-break:break-word;">${messageData.text}</p>
                </div>
                <button class="message-menu-button"><i class="fas fa-ellipsis-v"></i></button>
            </div>
            <span class="message-time" style="display:block;text-align:right;margin-top:2px;opacity:0.7;">${new Date(messageData.timestamp).toLocaleTimeString()}</span>
        `;
    }

    messageElement.innerHTML = messageContentHtml;

    if (!isDeleted) {
        const menuBtn = messageElement.querySelector('.message-menu-button');
        if (menuBtn) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const existingMenu = document.getElementById('messageContextMenu');
                if (existingMenu && existingMenu.dataset.messageId === messageData.id) {
                    existingMenu.remove(); 
                } else {
                    showContextMenu(e, messageData.id, messageData.from, messageData.text, messageData.from === currentUser, messageData.file);
                }
            });
        }
    }

    return messageElement;
}

function selectContact(contact) {
    selectedContact = contact;
    chatTitle.textContent = contact;
    unreadMessages.delete(contact);
    renderContacts(searchInput.value);
    messagesList.innerHTML = '';

    if (chatMessages.has(contact) && chatMessages.get(contact).length > 0) {
        const messagesForContact = chatMessages.get(contact);
        messagesForContact.forEach(msg => {
            const messageElement = renderSingleMessage(msg);
            messagesList.appendChild(messageElement);
        });
    } else {
        displayIntroductoryMessage();
    }
    messagesList.scrollTop = messagesList.scrollHeight;
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
            e.stopPropagation();
            const existingMenu = document.getElementById('messageContextMenu');
            if (existingMenu && existingMenu.dataset.messageId === messageId) {
                existingMenu.remove(); 
            } else {
                showContextMenu(e, messageId, sender, text, isOutgoing);
            }
        });
    }

    messagesList.appendChild(messageElement);
    messagesList.scrollTop = messagesList.scrollHeight;
}

// Fonction pour afficher le menu contextuel
function showContextMenu(e, messageId, sender, text, isOutgoing, fileData = null) {
    // Supprimer tout menu existant
    const existingMenu = document.getElementById('messageContextMenu');
    if (existingMenu) existingMenu.remove();

    const contextMenu = document.createElement('div');
    contextMenu.id = 'messageContextMenu';
    contextMenu.className = 'message-context-menu';
    contextMenu.style.top = `${e.clientY}px`;
    contextMenu.style.left = `${e.clientX}px`;
    contextMenu.dataset.messageId = messageId;

    const messageElement = document.getElementById(messageId);
    const isDeleted = messageElement?.classList.contains('deleted');

    // Option Répondre (uniquement si le message n'est pas supprimé)
    if (!isDeleted) {
        const replyOption = document.createElement('button');
        replyOption.innerHTML = '<i class="fas fa-reply"></i> Répondre';
        replyOption.addEventListener('click', () => {
            currentReplyMessage = { 
                id: messageId, 
                sender: sender, 
                text: text || (fileData ? `[Fichier: ${fileData.name}]` : '')
            };
            displayReplyPreview(sender, text || (fileData ? `[Fichier: ${fileData.name}]` : ''));
            contextMenu.remove();
        });
        contextMenu.appendChild(replyOption);
    }

    // Option Supprimer pour moi (si le message n'est pas déjà supprimé)
    if (!isDeleted) {
        const deleteForMeOption = document.createElement('button');
        deleteForMeOption.innerHTML = '<i class="fas fa-trash"></i> Supprimer pour moi';
        deleteForMeOption.addEventListener('click', () => {
            deleteMessage(messageId, false);
            contextMenu.remove();
        });
        contextMenu.appendChild(deleteForMeOption);
    }

    // Option Supprimer pour tous (uniquement pour les messages sortants non supprimés)
    if (isOutgoing && !isDeleted) {
        const deleteForEveryoneOption = document.createElement('button');
        deleteForEveryoneOption.innerHTML = '<i class="fas fa-trash-alt"></i> Supprimer pour tous';
        deleteForEveryoneOption.addEventListener('click', () => {
            deleteMessage(messageId, true);
            contextMenu.remove();
        });
        contextMenu.appendChild(deleteForEveryoneOption);
    }

    // Option Restaurer (si le message est supprimé)
    if (isDeleted) {
        const restoreOption = document.createElement('button');
        restoreOption.innerHTML = '<i class="fas fa-undo"></i> Restaurer le message';
        restoreOption.addEventListener('click', () => {
            restoreMessage(messageId);
            contextMenu.remove();
        });
        contextMenu.appendChild(restoreOption);
    }

    // Option Supprimer définitivement (si le message est supprimé)
    if (isDeleted) {
        const deletePermanentlyOption = document.createElement('button');
        deletePermanentlyOption.innerHTML = '<i class="fas fa-times-circle"></i> Supprimer définitivement';
        deletePermanentlyOption.addEventListener('click', () => {
            deleteMessagePermanently(messageId);
            contextMenu.remove();
        });
        contextMenu.appendChild(deletePermanentlyOption);
    }

    document.body.appendChild(contextMenu);

    // Fermer le menu si on clique ailleurs
    document.addEventListener('click', function closeMenuGlobal(event) {
        if (!contextMenu.contains(event.target) && !event.target.closest('.message-menu-button')) {
            contextMenu.remove();
            document.removeEventListener('click', closeMenuGlobal);
        }
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
            timestamp: new Date().toISOString(),
            deleted: false
        };

        if (currentReplyMessage) {
            messageData.replyTo = currentReplyMessage;
            currentReplyMessage = null;
            document.getElementById('replyPreview')?.remove();
        }

        socket.emit('private_message', messageData);
        
        // Ajout : signaler l'arrêt d'écriture après l'envoi du message
        socket.emit('stop_typing', { from: currentUser, to: selectedContact });
        
        if (!chatMessages.has(selectedContact)) {
            chatMessages.set(selectedContact, []);
        }
        chatMessages.get(selectedContact).push(messageData);

        const messageElement = renderSingleMessage(messageData);
        messagesList.appendChild(messageElement);
        messageInput.value = '';
        hideIntroductoryMessage();
        messagesList.scrollTop = messagesList.scrollHeight;
    }
});

// Gérer la connexion réussie
socket.on('connection_success', (username) => {
    console.log('Connexion réussie pour:', username);
    pseudoForm.style.display = 'none';
    chatContainer.style.display = 'flex';
});

socket.on('user_connected', (username) => {
    console.log('Utilisateur connecté:', username);
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

// Gérer la liste des utilisateurs connectés
socket.on('connected_users', (users) => {
    console.log('Liste des utilisateurs connectés:', users);
    contacts = users.filter(user => user !== currentUser);
    renderContacts();
});

socket.on('private_message', (data) => {
    if (!chatMessages.has(data.from)) {
        chatMessages.set(data.from, []);
    }
    chatMessages.get(data.from).push(data);

    if (data.from === selectedContact || data.from === currentUser) {
        const messageElement = renderSingleMessage(data);
        messagesList.appendChild(messageElement);
        hideIntroductoryMessage();
        messagesList.scrollTop = messagesList.scrollHeight;
    } else {
        unreadMessages.add(data.from);
        renderContacts(searchInput.value);
    }
});

// Gestion des fichiers
async function handleFileUpload(file) {
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
        alert('Le fichier est trop volumineux. Taille maximale: 50MB');
        return;
    }

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        alert('Type de fichier non supporté. Seules les images et vidéos sont acceptées.');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Erreur d'upload: ${response.statusText}`);
        }

        const fileInfo = await response.json();

        const messageId = 'msg-' + Date.now() + '-' + Math.floor(Math.random()*10000);
        const messageData = {
            id: messageId,
            from: currentUser,
            to: selectedContact,
            file: {
                url: fileInfo.url,
                name: fileInfo.originalname,
                type: fileInfo.mimetype,
                size: fileInfo.size
            },
            timestamp: new Date().toISOString(),
            deleted: false
        };

        socket.emit('private_message', messageData);
        
        // Ajout : signaler l'arrêt d'écriture après l'envoi du message
        socket.emit('stop_typing', { from: currentUser, to: selectedContact });
        
        if (!chatMessages.has(selectedContact)) {
            chatMessages.set(selectedContact, []);
        }
        chatMessages.get(selectedContact).push(messageData);

        const messageElement = renderSingleMessage(messageData);
        messagesList.appendChild(messageElement);
        hideIntroductoryMessage();
        messagesList.scrollTop = messagesList.scrollHeight;

    } catch (error) {
        console.error("Erreur lors de l'envoi du fichier:", error);
        alert(error.message || "Échec de l'envoi du fichier.");
    }
}

function addFileToChat(sender, fileData, isOutgoing = false, messageId = null) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isOutgoing ? 'outgoing' : 'incoming'}`;
    if (messageId) messageElement.id = messageId;

    let fileContent = '';
    if (fileData.type.startsWith('image/')) {
        fileContent = `
            <div class="message-media">
                <img src="${fileData.url}" alt="${fileData.name}" class="message-image" onclick="openMediaViewer(this.src)">
                <div class="file-info">
                    <span class="file-name">${fileData.name}</span>
                    <span class="file-size">${formatFileSize(fileData.size)}</span>
                </div>
            </div>`;
    } else if (fileData.type.startsWith('video/')) {
        fileContent = `
            <div class="message-media">
                <video controls class="message-video">
                    <source src="${fileData.url}" type="${fileData.type}">
                    Votre navigateur ne supporte pas la lecture de vidéos.
                </video>
                <div class="file-info">
                    <span class="file-name">${fileData.name}</span>
                    <span class="file-size">${formatFileSize(fileData.size)}</span>
                </div>
            </div>`;
    } else {
        fileContent = `
            <div class="message-file">
                <i class="fas fa-file"></i>
                <div class="file-info">
                    <span class="file-name">${fileData.name}</span>
                    <span class="file-size">${formatFileSize(fileData.size)}</span>
                </div>
            </div>`;
    }

    // Ajouter le bouton de menu contextuel
    const menuButton = `<button class="message-menu-button"><i class="fas fa-ellipsis-v"></i></button>`;

    messageElement.innerHTML = `
        <div class="message-content-row" style="display:flex;align-items:flex-start;justify-content:space-between;">
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span class="message-sender" style="font-size:1rem;">${sender}</span>
                </div>
                ${fileContent}
            </div>
            ${menuButton}
        </div>
        <span class="message-time" style="display:block;text-align:right;margin-top:2px;opacity:0.7;">${new Date().toLocaleTimeString()}</span>
    `;

    // Ajouter le gestionnaire d'événements pour le menu contextuel
    const menuBtn = messageElement.querySelector('.message-menu-button');
    if (menuBtn) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const existingMenu = document.getElementById('messageContextMenu');
            if (existingMenu && existingMenu.dataset.messageId === messageId) {
                existingMenu.remove();
            } else {
                showContextMenu(e, messageId, sender, null, isOutgoing, fileData);
            }
        });
    }

    messagesList.appendChild(messageElement);
    messagesList.scrollTop = messagesList.scrollHeight;
}

// Fonction pour formater la taille des fichiers
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
fileInput.accept = "image/*,video/*";
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

// Fonction pour supprimer un message
function deleteMessage(messageId, forEveryone) {
    const messageElement = document.getElementById(messageId);
    if (!messageElement) return;

    if (forEveryone) {
        socket.emit('delete_message', {
            messageId: messageId,
            to: selectedContact,
            from: currentUser,
            forEveryone: true
        });

        const messageData = chatMessages.get(selectedContact)?.find(msg => msg.id === messageId);
        if (messageData) {
            messageData.deleted = true;
            messageData.originalContent = {
                text: messageData.text,
                file: messageData.file
            };
            messageData.text = "Ce message a été supprimé";
            messageData.file = null;
        }

        const updatedMessageElement = renderSingleMessage(messageData);
        messageElement.replaceWith(updatedMessageElement);
        messagesList.scrollTop = messagesList.scrollHeight;

    } else {
        messageElement.remove();
        
        if (chatMessages.has(selectedContact)) {
            const messages = chatMessages.get(selectedContact);
            const index = messages.findIndex(msg => msg.id === messageId);
            if (index !== -1) {
                messages.splice(index, 1);
            }
        }
    }
}

// Modifier la fonction de gestion des messages supprimés
socket.on('delete_message', (data) => {
    const { messageId, forEveryone, from } = data;
    const messageElement = document.getElementById(messageId);
    
    if (messageElement && forEveryone) {
        const contactToUpdate = (from === currentUser) ? selectedContact : from;

        if (chatMessages.has(contactToUpdate)) {
            const messages = chatMessages.get(contactToUpdate);
            const message = messages.find(msg => msg.id === messageId);
            if (message) {
                message.deleted = true;
                message.originalContent = {
                    text: message.text,
                    file: message.file
                };
                message.text = "Ce message a été supprimé";
                message.file = null;
                
                const updatedMessageElement = renderSingleMessage(message);
                messageElement.replaceWith(updatedMessageElement);
                messagesList.scrollTop = messagesList.scrollHeight;
            }
        }
    }
});

// Fonction pour restaurer un message
function restoreMessage(messageId) {
    const messageElement = document.getElementById(messageId);
    if (!messageElement) return;

    if (chatMessages.has(selectedContact)) {
        const messages = chatMessages.get(selectedContact);
        const message = messages.find(msg => msg.id === messageId);
        if (message && message.originalContent) {
            message.text = message.originalContent.text;
            message.file = message.originalContent.file;
            message.deleted = false;
            delete message.originalContent;

            const updatedMessageElement = renderSingleMessage(message);
            messageElement.replaceWith(updatedMessageElement);
            messagesList.scrollTop = messagesList.scrollHeight;
            updatedMessageElement.classList.add('restored');
        }
    }
}

// Fonction pour supprimer définitivement un message
function deleteMessagePermanently(messageId) {
    const messageElement = document.getElementById(messageId);
    if (!messageElement) return;

    // Supprimer le message de l'historique
    if (chatMessages.has(selectedContact)) {
        const messages = chatMessages.get(selectedContact);
        const index = messages.findIndex(msg => msg.id === messageId);
        if (index !== -1) {
            messages.splice(index, 1);
        }
    }

    // Supprimer l'élément du DOM
    messageElement.remove();
}

// Fonction pour obtenir le contenu HTML d'un fichier
function getFileContent(fileData) {
    if (fileData.type.startsWith('image/')) {
        return `
            <div class="message-media">
                <img src="${fileData.url}" alt="${fileData.name}" class="message-image" onclick="openMediaViewer(this.src)">
                <div class="file-info">
                    <span class="file-name">${fileData.name}</span>
                    <span class="file-size">${formatFileSize(fileData.size)}</span>
                </div>
            </div>`;
    } else if (fileData.type.startsWith('video/')) {
        return `
            <div class="message-media">
                <video controls class="message-video">
                    <source src="${fileData.url}" type="${fileData.type}">
                    Votre navigateur ne supporte pas la lecture de vidéos.
                </video>
                <div class="file-info">
                    <span class="file-name">${fileData.name}</span>
                    <span class="file-size">${formatFileSize(fileData.size)}</span>
                </div>
            </div>`;
    } else {
        return `
            <div class="message-file">
                <i class="fas fa-file"></i>
                <div class="file-info">
                    <span class="file-name">${fileData.name}</span>
                    <span class="file-size">${formatFileSize(fileData.size)}</span>
                </div>
            </div>`;
    }
} 
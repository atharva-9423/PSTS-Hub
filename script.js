// Firebase configuration - Using Firebase CDN for GitHub Pages
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getDatabase,
    ref,
    push,
    onValue,
    set,
    remove,
    get,
    onDisconnect
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
// Firebase Storage removed - using Realtime Database for files

// Firebase configuration - Replace with your config
const firebaseConfig = {
    apiKey: "AIzaSyC38q6kEQdtCzgWXbnmgKihrjiIu-bfIvU",
    authDomain: "connecthub-5b9c7.firebaseapp.com",
    databaseURL:
        "https://connecthub-5b9c7-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "connecthub-5b9c7",
    storageBucket: "connecthub-5b9c7.firebasestorage.app",
    messagingSenderId: "449900375650",
    appId: "1:449900375650:web:1ca9df988ab4b3a9786b3b",
    measurementId: "G-YHPX8KM0R3",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Application state
let currentUser = null;
let currentRole = null;
let selectedChat = null;
let attachments = [];
let users = [];
let chats = {};

// Session management
function saveSession(username, role) {
    localStorage.setItem('nexuschat_session', JSON.stringify({
        username: username,
        role: role,
        timestamp: Date.now()
    }));
}

function loadSession() {
    try {
        const session = localStorage.getItem('nexuschat_session');
        if (session) {
            const sessionData = JSON.parse(session);
            // Session expires after 24 hours
            if (Date.now() - sessionData.timestamp < 24 * 60 * 60 * 1000) {
                return sessionData;
            } else {
                localStorage.removeItem('nexuschat_session');
            }
        }
    } catch (error) {
        console.error('Error loading session:', error);
        localStorage.removeItem('nexuschat_session');
    }
    return null;
}

function clearSession() {
    localStorage.removeItem('nexuschat_session');
}

// DOM elements
const loginScreen = document.getElementById("loginScreen");
const chatScreen = document.getElementById("chatScreen");
const loginForm = document.getElementById("loginForm");
const currentUserEl = document.getElementById("currentUser");
const currentRoleEl = document.getElementById("currentRole");
const contactsList = document.getElementById("contactsList");
const messagesContainer = document.getElementById("messagesContainer");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const attachBtn = document.getElementById("attachBtn");
const fileInput = document.getElementById("fileInput");
const attachmentPreview = document.getElementById("attachmentPreview");
const chatTitle = document.getElementById("chatTitle");
const downloadBtn = document.getElementById("downloadBtn");
const deleteBtn = document.getElementById("deleteBtn");
const logoutBtn = document.getElementById("logoutBtn");
const newChatBtn = document.getElementById("newChatBtn");
const broadcastBtn = document.getElementById("broadcastBtn");
const broadcastSection = document.getElementById("broadcastSection");
const newChatModal = document.getElementById("newChatModal");
const broadcastModal = document.getElementById("broadcastModal");
const availableUsers = document.getElementById("availableUsers");
const broadcastMessage = document.getElementById("broadcastMessage");
const sendBroadcastBtn = document.getElementById("sendBroadcastBtn");
const downloadChatBtn = document.getElementById("downloadChatBtn");
const messageInputContainer = document.querySelector(
    ".message-input-container",
);

// Utility functions
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function showNotification(message, type = "success") {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    const timeout = type === "info" ? 2000 : 3000;
    setTimeout(() => {
        notification.remove();
    }, timeout);
}

function getChatId(user1, user2) {
    return [user1, user2].sort().join("_");
}

function canUserMessage(fromRole, toRole) {
    if (fromRole === "admin") return true;
    if (fromRole === "moderator") return true;
    if (fromRole === "member")
        return toRole === "admin";
    return false;
}

function getUsersForRole(role) {
    switch (role) {
        case "admin":
            return users; // Admin can see everyone
        case "moderator":
            return users; // Moderator can see everyone
        case "member":
            return users.filter(
                (u) => u.role === "admin"
            ); // Members can only see admins
        default:
            return [];
    }
}

// Firebase functions
async function saveUser(username, role) {
    const userRef = ref(database, `users/${username}`);
    await set(userRef, {
        username,
        role,
        lastActive: Date.now(),
    });
}

async function loadUsers() {
    try {
        const usersRef = ref(database, "users");
        const snapshot = await get(usersRef);
        if (snapshot.exists()) {
            const usersData = snapshot.val();
            users = Object.values(usersData);
        }
    } catch (error) {
        console.error('Firebase connection error in loadUsers:', error);
        throw error;
    }
}

async function saveMessage(chatId, message) {
    const messagesRef = ref(database, `chats/${chatId}/messages`);
    await push(messagesRef, message);
}

async function saveBroadcastMessage(message) {
    const broadcastRef = ref(database, "broadcasts");
    await push(broadcastRef, message);
    
    // Also save to urgent notifications for immediate delivery
    const urgentRef = ref(database, "urgent_notifications");
    const urgentNotification = {
        ...message,
        type: 'broadcast',
        urgent: true,
        deliveredTo: [] // Track who has seen this
    };
    
    const notificationRef = await push(urgentRef, urgentNotification);
    const notificationId = notificationRef.key;
    
    // Track offline users for this notification
    await trackOfflineUserNotification(notificationId, urgentNotification);
}

function listenToMessages(chatId) {
    const messagesRef = ref(database, `chats/${chatId}/messages`);
    onValue(messagesRef, (snapshot) => {
        if (snapshot.exists()) {
            const messages = snapshot.val();
            displayMessages(Object.values(messages));
        } else {
            displayMessages([]);
        }
    });
}

function listenToBroadcasts() {
    const broadcastRef = ref(database, "broadcasts");
    onValue(broadcastRef, (snapshot) => {
        if (snapshot.exists()) {
            const broadcasts = snapshot.val();
            // Display broadcasts in all chats for members
            if (currentRole === "member") {
                Object.values(broadcasts).forEach((broadcast) => {
                    if (
                        selectedChat &&
                        !document.querySelector(
                            `[data-broadcast-id="${broadcast.id}"]`,
                        )
                    ) {
                        displayBroadcastMessage(broadcast);
                    }
                });
            }
        }
    });
}

// Listen for urgent notifications for all users
function listenToUrgentNotifications() {
    const urgentRef = ref(database, "urgent_notifications");
    onValue(urgentRef, (snapshot) => {
        if (snapshot.exists()) {
            const notifications = snapshot.val();
            Object.entries(notifications).forEach(([notificationId, notification]) => {
                // Check if this user has already been notified
                if (!notification.deliveredTo || !notification.deliveredTo.includes(currentUser)) {
                    showUrgentNotification(notification, notificationId);
                }
            });
        }
    });
}

// Track offline users for pending notifications
async function trackOfflineUserNotification(notificationId, notification) {
    try {
        const offlineUsersRef = ref(database, "offline_pending_notifications");
        
        // Get all users and check who's offline
        const usersSnapshot = await get(ref(database, "users"));
        if (usersSnapshot.exists()) {
            const allUsers = Object.values(usersSnapshot.val());
            
            // Find offline users (users without 'online' status)
            const offlineUsers = allUsers.filter(user => 
                user.status !== 'online' && 
                (!notification.deliveredTo || !notification.deliveredTo.includes(user.username))
            );
            
            // Store pending notification for each offline user
            for (const user of offlineUsers) {
                const pendingRef = ref(database, `offline_pending_notifications/${user.username}/${notificationId}`);
                await set(pendingRef, {
                    ...notification,
                    notificationId: notificationId,
                    queuedAt: Date.now()
                });
            }
        }
    } catch (error) {
        console.error("Error tracking offline users:", error);
    }
}

// Check for pending notifications when user comes online
async function checkPendingNotifications(username) {
    try {
        const pendingRef = ref(database, `offline_pending_notifications/${username}`);
        const snapshot = await get(pendingRef);
        
        if (snapshot.exists()) {
            const pendingNotifications = snapshot.val();
            
            // Show each pending notification
            Object.entries(pendingNotifications).forEach(([notificationId, notification]) => {
                // Add a delay to prevent overwhelming the user
                setTimeout(() => {
                    showUrgentNotification(notification, notificationId);
                }, 1000);
            });
            
            // Clear pending notifications for this user
            await set(pendingRef, null);
        }
    } catch (error) {
        console.error("Error checking pending notifications:", error);
    }
}

// Show urgent notification with special styling and persistence
function showUrgentNotification(notification, notificationId) {
    // Check if this notification was queued for offline delivery
    const wasOfflineDelivery = notification.queuedAt && notification.queuedAt > notification.timestamp;
    const deliveryInfo = wasOfflineDelivery ? 
        `<div class="urgent-delivery-info">📱 Delivered while you were offline</div>` : '';
    
    // Create urgent notification overlay
    const urgentOverlay = document.createElement("div");
    urgentOverlay.className = "urgent-notification-overlay";
    urgentOverlay.innerHTML = `
        <div class="urgent-notification-modal">
            <div class="urgent-header">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>🚨 URGENT BROADCAST 🚨</h3>
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <div class="urgent-content">
                <div class="urgent-from">From: ${notification.from}</div>
                <div class="urgent-message">${notification.text}</div>
                <div class="urgent-time">${new Date(notification.timestamp).toLocaleString()}</div>
                ${deliveryInfo}
            </div>
            <div class="urgent-actions">
                <button class="urgent-acknowledge-btn" onclick="acknowledgeUrgentNotification('${notificationId}')">
                    <i class="fas fa-check"></i> I Acknowledge
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(urgentOverlay);

    // Add animation
    setTimeout(() => {
        urgentOverlay.classList.add('active');
    }, 100);

    // Play urgent sound effect (if supported)
    playUrgentSound();

    // Flash the browser tab title
    flashBrowserTitle();

    // Auto-remove after 30 seconds if not acknowledged
    setTimeout(() => {
        if (document.body.contains(urgentOverlay)) {
            acknowledgeUrgentNotification(notificationId);
        }
    }, 30000);
}

// Acknowledge urgent notification
async function acknowledgeUrgentNotification(notificationId) {
    try {
        // Mark as delivered for this user
        const deliveredRef = ref(database, `urgent_notifications/${notificationId}/deliveredTo`);
        const snapshot = await get(deliveredRef);
        const deliveredTo = snapshot.exists() ? snapshot.val() : [];
        
        if (!deliveredTo.includes(currentUser)) {
            deliveredTo.push(currentUser);
            await set(deliveredRef, deliveredTo);
        }

        // Remove from UI
        const overlay = document.querySelector('.urgent-notification-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.remove();
            }, 300);
        }

        showNotification("Urgent notification acknowledged", "success");

    } catch (error) {
        console.error("Error acknowledging notification:", error);
        showNotification("Error acknowledging notification", "error");
    }
}

// Play urgent sound effect
function playUrgentSound() {
    try {
        // Create audio context for urgent beep sound
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create multiple beeps
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.2);
            }, i * 300);
        }
    } catch (error) {
        console.log("Audio not supported or blocked");
    }
}

// Flash browser tab title
function flashBrowserTitle() {
    const originalTitle = document.title;
    let flashCount = 0;
    const maxFlashes = 10;
    
    const flashInterval = setInterval(() => {
        document.title = flashCount % 2 === 0 ? "🚨 URGENT MESSAGE 🚨" : originalTitle;
        flashCount++;
        
        if (flashCount >= maxFlashes) {
            clearInterval(flashInterval);
            document.title = originalTitle;
        }
    }, 500);
}

// Presence tracking functions
function setUserOnline(username) {
    const userStatusRef = ref(database, `users/${username}/status`);
    const lastActiveRef = ref(database, `users/${username}/lastActive`);
    
    // Set status to 'online' and update lastActive timestamp
    set(userStatusRef, 'online');
    set(lastActiveRef, Date.now());

    // Set up onDisconnect to mark user as offline when connection is lost
    onDisconnect(userStatusRef).set('offline');
    onDisconnect(lastActiveRef).set(Date.now()); // Update lastActive on disconnect too
    
    // Check for pending notifications when user comes online
    if (currentUser === username) {
        setTimeout(async () => {
            await checkPendingNotifications(username);
        }, 2000); // Small delay to ensure everything is set up
    }
}

function setUserOffline(username) {
    const userStatusRef = ref(database, `users/${username}/status`);
    const lastActiveRef = ref(database, `users/${username}/lastActive`);

    // Update lastActive timestamp to reflect the time they went offline
    set(lastActiveRef, Date.now());
    // The 'offline' status will be set by onDisconnect when the connection is lost.
    // We don't explicitly set it here as it might be overwritten by an active connection.
}

function listenToUserPresence(username) {
    const userStatusRef = ref(database, `users/${username}/status`);
    onValue(userStatusRef, (snapshot) => {
        const status = snapshot.val();
        const statusIndicator = document.getElementById(`status-${username}`);
        const statusTextEl = document.getElementById(`status-text-${username}`);

        if (statusIndicator && statusTextEl) {
            let statusText = 'Offline';
            let statusClass = 'offline';

            if (status === 'online') {
                statusText = 'Active now';
                statusClass = 'online';
            } else if (status === 'away') {
                statusText = 'Away';
                statusClass = 'away';
            }

            statusIndicator.className = `contact-status-indicator ${statusClass}`;
            statusTextEl.className = `contact-status ${statusClass}`;
            statusTextEl.querySelector('.contact-status-dot').className = 'contact-status-dot';
            statusTextEl.querySelector('span').textContent = statusText;
        }
    });
}


// File upload function using Realtime Database (stores as base64)
async function uploadFile(file) {
    const uploadTimeout = 30000; // 30 second timeout

    const uploadWithTimeout = new Promise(async (resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error("Upload timeout - please try again"));
        }, uploadTimeout);

        try {
            console.log("Starting file upload to database:", file.name, "Type:", file.type, "Size:", file.size);

            // Comprehensive validation
            if (!file || !(file instanceof File)) {
                clearTimeout(timeoutId);
                throw new Error("Invalid file object");
            }

            if (file.size === 0) {
                clearTimeout(timeoutId);
                throw new Error("Cannot upload empty file");
            }

            // Reduced size limit for database storage (5MB)
            const maxSize = 5 * 1024 * 1024; // 5MB limit for database storage
            if (file.size > maxSize) {
                clearTimeout(timeoutId);
                throw new Error(`File too large for database storage. Maximum size is ${Math.round(maxSize / (1024 * 1024))}MB`);
            }

            // Create secure filename - replace invalid Firebase path characters
            const fileExtension = file.name.split('.').pop() || '';
            const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, '_');
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(2, 10);
            // Replace dots and other invalid characters for Firebase paths
            const sanitizedExtension = fileExtension.replace(/[.#$[\]]/g, '_');
            const uniqueFileName = `${currentUser}_${timestamp}_${randomId}_${sanitizedExtension}`;

            console.log("Converting file to base64...");

            // Convert file to base64
            const base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    // Remove the data URL prefix (data:image/png;base64,)
                    const base64 = reader.result.split(',')[1];
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            console.log("Saving file to database...");

            // Save file data to database
            const fileData = {
                name: file.name,
                originalName: file.name,
                type: file.type || 'application/octet-stream',
                size: file.size,
                data: base64Data,
                uploadedBy: currentUser,
                uploadedAt: timestamp,
                id: randomId
            };

            // Save to database
            const fileRef = ref(database, `files/${uniqueFileName}`);
            await set(fileRef, fileData);

            clearTimeout(timeoutId);
            console.log("File upload completed successfully to database");

            // Return file info with database reference
            resolve({
                name: file.name,
                url: `db://${uniqueFileName}`, // Special URL to indicate database storage
                type: file.type || 'application/octet-stream',
                size: file.size,
                uploadedAt: timestamp,
                id: randomId,
                isDatabase: true // Flag to indicate this is stored in database
            });

        } catch (error) {
            clearTimeout(timeoutId);
            console.error("File upload to database failed:", error);

            if (error.message && error.message.includes('timeout')) {
                reject(new Error("Upload timeout. Please try again."));
            } else if (error.message && error.message.includes('quota')) {
                reject(new Error("Database quota exceeded. Try a smaller file."));
            } else if (error.message && error.message.includes('permission')) {
                reject(new Error("Permission denied. Check database rules."));
            } else {
                reject(new Error(error.message || "Upload failed. Please try again."));
            }
        }
    });

    return uploadWithTimeout;
}

async function deleteAllData() {
    if (currentRole !== "admin") {
        showNotification("Only admins can delete data", "error");
        return;
    }

    if (
        confirm(
            "Are you sure you want to delete all data? This action cannot be undone.",
        )
    ) {
        try {
            await set(ref(database, "chats"), null);
            await set(ref(database, "broadcasts"), null);
            showNotification("All data deleted successfully");
            location.reload();
        } catch (error) {
            showNotification("Error deleting data", "error");
        }
    }
}

function downloadData() {
    const data = {
        user: currentUser,
        role: currentRole,
        chats: chats,
        timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexuschat_data_${currentUser}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function downloadChat() {
    if (!selectedChat) return;

    const chatData = chats[selectedChat] || { messages: [] };
    const data = {
        chatId: selectedChat,
        participants: selectedChat.split("_"),
        messages: chatData.messages || [],
        timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat_${selectedChat}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// UI functions
function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach((screen) => {
        screen.classList.remove("active");
    });
    document.getElementById(screenId).classList.add("active");
}

function displayContacts() {
    contactsList.innerHTML = "";
    const availableUsers = getUsersForRole(currentRole);

    // Add Partner Chats group for admins and moderators
    if (currentRole === "admin" || currentRole === "moderator") {
        const partnerGroupEl = document.createElement("div");
        partnerGroupEl.className = "contact-item partner-group";
        partnerGroupEl.dataset.chatId = "partner-group";
        partnerGroupEl.dataset.username = "partner-group";

        partnerGroupEl.innerHTML = `
            <div class="contact-avatar group">
                <span>PC</span>
                <div class="contact-status-indicator online"></div>
            </div>
            <div class="contact-info">
                <div class="contact-header">
                    <div class="contact-name">Partner Chats</div>
                    <div class="contact-unread"></div>
                </div>
                <div class="contact-meta">
                    <div class="contact-role">Group</div>
                    <div class="contact-status online">
                        <div class="contact-status-dot"></div>
                        <span>All Partner Messages</span>
                    </div>
                </div>
            </div>
        `;

        partnerGroupEl.style.opacity = '0';
        partnerGroupEl.style.transform = 'translateX(-20px)';

        setTimeout(() => {
            partnerGroupEl.style.transition = 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            partnerGroupEl.style.opacity = '1';
            partnerGroupEl.style.transform = 'translateX(0)';
        }, 0);

        partnerGroupEl.addEventListener("click", (e) => {
            addContactRipple(partnerGroupEl, e);
            setTimeout(() => selectPartnerGroup(), 150);
        });

        contactsList.appendChild(partnerGroupEl);
    }

    availableUsers.forEach((user, index) => {
        if (user.username === currentUser) return;

        const chatId = getChatId(currentUser, user.username);
        const contactEl = document.createElement("div");
        contactEl.className = "contact-item";
        contactEl.dataset.chatId = chatId;
        contactEl.dataset.username = user.username;

        // Get role-specific avatar class
        const avatarClass = user.role.toLowerCase();

        // Get user initials
        const initials = user.username.substring(0, 2).toUpperCase();

        // Initial status will be set by presence listener
        contactEl.innerHTML = `
            <div class="contact-avatar ${avatarClass}">
                <span>${initials}</span>
                <div class="contact-status-indicator offline" id="status-${user.username}"></div>
            </div>
            <div class="contact-info">
                <div class="contact-header">
                    <div class="contact-name">${user.username}</div>
                    <div class="contact-unread"></div>
                </div>
                <div class="contact-meta">
                    <div class="contact-role">${user.role}</div>
                    <div class="contact-status offline" id="status-text-${user.username}">
                        <div class="contact-status-dot"></div>
                        <span>Offline</span>
                    </div>
                </div>
            </div>
        `;

        // Add staggered animation
        contactEl.style.opacity = '0';
        contactEl.style.transform = 'translateX(-20px)';

        setTimeout(() => {
            contactEl.style.transition = 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            contactEl.style.opacity = '1';
            contactEl.style.transform = 'translateX(0)';
        }, index * 80);

        // Add ripple effect on click
        contactEl.addEventListener("click", (e) => {
            addContactRipple(contactEl, e);
            setTimeout(() => selectChat(chatId, user.username), 150);
        });

        // Add hover sound effect (optional)
        contactEl.addEventListener("mouseenter", () => {
            if (!contactEl.classList.contains('active')) {
                contactEl.style.transform = 'translateX(4px)';
            }
        });

        contactEl.addEventListener("mouseleave", () => {
            if (!contactEl.classList.contains('active')) {
                contactEl.style.transform = 'translateX(0)';
            }
        });

        contactsList.appendChild(contactEl);

        // Set up real-time presence listener for this user
        listenToUserPresence(user.username);
    });
}

function addContactRipple(element, event) {
    const ripple = document.createElement('div');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    ripple.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: rgba(0, 122, 255, 0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: ripple 0.6s ease-out;
        pointer-events: none;
        z-index: 1;
    `;

    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(ripple);

    setTimeout(() => ripple.remove(), 600);
}

// Add CSS for ripple animation if not already present
if (!document.getElementById('ripple-styles')) {
    const style = document.createElement('style');
    style.id = 'ripple-styles';
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(2);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

function selectChat(chatId, targetUser) {
    selectedChat = chatId;

    // Update UI
    document.querySelectorAll(".contact-item").forEach((item) => {
        item.classList.remove("active");
    });
    document
        .querySelector(`[data-chat-id="${chatId}"]`)
        ?.classList.add("active");

    chatTitle.textContent = `Chat with ${targetUser}`;
    messageInputContainer.style.display = "block";

    // Listen to messages
    listenToMessages(chatId);

    // Load existing chat data
    const chatRef = ref(database, `chats/${chatId}`);
    get(chatRef).then((snapshot) => {
        if (snapshot.exists()) {
            chats[chatId] = snapshot.val();
        }
    });
}

function selectPartnerGroup() {
    selectedChat = "partner-group";

    // Update UI
    document.querySelectorAll(".contact-item").forEach((item) => {
        item.classList.remove("active");
    });
    document
        .querySelector(`[data-chat-id="partner-group"]`)
        ?.classList.add("active");

    chatTitle.textContent = "Partner Chats - All Conversations";
    messageInputContainer.style.display = "none"; // Disable messaging in group view

    // Listen to all partner messages
    listenToPartnerMessages();
}

function listenToPartnerMessages() {
    const chatsRef = ref(database, "chats");
    onValue(chatsRef, (snapshot) => {
        if (snapshot.exists()) {
            const allChats = snapshot.val();
            const partnerMessages = [];

            // Collect all messages involving partners
            Object.keys(allChats).forEach(chatId => {
                const participants = chatId.split("_");
                const hasPartner = participants.some(username => {
                    const user = users.find(u => u.username === username);
                    return user && user.role === "member";
                });

                if (hasPartner && allChats[chatId].messages) {
                    Object.values(allChats[chatId].messages).forEach(message => {
                        partnerMessages.push({
                            ...message,
                            chatId: chatId,
                            participants: participants
                        });
                    });
                }
            });

            // Sort messages by timestamp
            partnerMessages.sort((a, b) => a.timestamp - b.timestamp);
            displayPartnerMessages(partnerMessages);
        } else {
            displayPartnerMessages([]);
        }
    });
}

function displayPartnerMessages(messages) {
    messagesContainer.innerHTML = "";

    if (messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="no-chat-selected">
                <i class="fas fa-users"></i>
                <p>No partner conversations yet</p>
            </div>
        `;
        return;
    }

    let lastChatId = null;
    messages.forEach((message) => {
        // Add chat separator if this is a different conversation
        if (message.chatId !== lastChatId) {
            const separatorEl = document.createElement("div");
            separatorEl.className = "chat-separator";
            separatorEl.innerHTML = `
                <div class="separator-line"></div>
                <div class="separator-text">
                    Conversation: ${message.participants.join(" & ")}
                </div>
                <div class="separator-line"></div>
            `;
            messagesContainer.appendChild(separatorEl);
            lastChatId = message.chatId;
        }

        const messageEl = createMessageElement(message);
        messagesContainer.appendChild(messageEl);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Auto-load images after messages are displayed
    setTimeout(() => {
        autoLoadImages();
    }, 100);
}

function displayMessages(messages) {
    messagesContainer.innerHTML = "";

    messages.forEach((message) => {
        const messageEl = createMessageElement(message);
        messagesContainer.appendChild(messageEl);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Auto-load images after messages are displayed
    setTimeout(() => {
        autoLoadImages();
    }, 100);
}

function displayBroadcastMessage(broadcast) {
    const messageEl = document.createElement("div");
    messageEl.className = "message broadcast";
    messageEl.dataset.broadcastId = broadcast.id;

    messageEl.innerHTML = `
        <div class="message-header">
            <span>📢 Broadcast from ${broadcast.from}</span>
            <span>${formatTime(broadcast.timestamp)}</span>
        </div>
        <div class="message-content">${broadcast.text}</div>
    `;

    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function createMessageElement(message) {
    const messageEl = document.createElement("div");
    messageEl.className = `message ${message.from === currentUser ? "sent" : "received"}`;

    let attachmentHtml = "";

    // Handle both single attachment (legacy) and multiple attachments
    const attachments = message.attachments || (message.attachment ? [message.attachment] : []);

    if (attachments.length > 0) {
        attachmentHtml = attachments.map(att => {

        // Handle database-stored files with improved UX
        if (att.isDatabase || att.url.startsWith('db://')) {
            const fileId = att.url.replace('db://', '');
            const fileSizeText = att.size ? Math.round(att.size / 1024) + ' KB' : 'Unknown size';

            if (att.type && att.type.startsWith("image/")) {
                return `<div class="message-attachment image">
                    <div class="db-file-placeholder auto-load-image" data-file-id="${fileId}" 
                         style="max-width: 100%; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; background: linear-gradient(145deg, var(--surface), var(--background)); border: 2px dashed var(--border-light); min-height: 120px; transition: all 0.3s ease; position: relative; overflow: hidden;" 
                         onclick="loadDatabaseFile('${fileId}', 'image')"
                         onmouseenter="this.style.transform='scale(1.02)'; this.style.borderColor='var(--primary-color)'"
                         onmouseleave="this.style.transform='scale(1)'; this.style.borderColor='var(--border-light)'">
                        <div style="text-align: center; z-index: 2;">
                            <i class="fas fa-image" style="font-size: 2.5rem; color: var(--primary-color); margin-bottom: 12px; animation: pulse 2s infinite;"></i>
                            <div style="color: var(--text); font-weight: 500; margin-bottom: 4px;">Loading image...</div>
                            <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">${att.name}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">${fileSizeText}</div>
                            <button onclick="event.stopPropagation(); downloadDatabaseFile('${fileId}')" 
                                    style="margin-top: 8px; padding: 6px 12px; background: var(--primary-color); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.75rem; transition: all 0.2s ease;"
                                    onmouseenter="this.style.background='var(--primary-dark)'; this.style.transform='scale(1.05)'"
                                    onmouseleave="this.style.background='var(--primary-color)'; this.style.transform='scale(1)'">
                                <i class="fas fa-download" style="margin-right: 4px;"></i>Download
                            </button>
                        </div>
                        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.05); opacity: 0; transition: opacity 0.3s ease;" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0'"></div>
                    </div>
                </div>`;
            } else if (att.type && att.type.startsWith("video/")) {
                return `<div class="message-attachment video">
                    <div class="db-file-placeholder" data-file-id="${fileId}" 
                         style="max-width: 100%; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; background: linear-gradient(145deg, var(--surface), var(--background)); border: 2px dashed var(--border-light); min-height: 120px; transition: all 0.3s ease;" 
                         onclick="loadDatabaseFile('${fileId}', 'video')"
                         onmouseenter="this.style.transform='scale(1.02)'; this.style.borderColor='var(--primary-color)'"
                         onmouseleave="this.style.transform='scale(1)'; this.style.borderColor='var(--border-light)'">
                        <div style="text-align: center;">
                            <i class="fas fa-play-circle" style="font-size: 2.5rem; color: var(--primary-color); margin-bottom: 12px;"></i>
                            <div style="color: var(--text); font-weight: 500; margin-bottom: 4px;">Click to play video</div>
                            <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">${att.name}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">${fileSizeText}</div>
                        </div>
                    </div>
                </div>`;
            } else if (att.type && att.type.startsWith("audio/")) {
                return `<div class="message-attachment audio">
                    <div class="db-file-placeholder" data-file-id="${fileId}" 
                         style="width: 100%; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; background: linear-gradient(145deg, var(--surface), var(--background)); border: 2px dashed var(--border-light); min-height: 80px; transition: all 0.3s ease;" 
                         onclick="loadDatabaseFile('${fileId}', 'audio')"
                         onmouseenter="this.style.transform='scale(1.02)'; this.style.borderColor='var(--primary-color)'"
                         onmouseleave="this.style.transform='scale(1)'; this.style.borderColor='var(--border-light)'">
                        <div style="text-align: center;">
                            <i class="fas fa-volume-up" style="font-size: 2rem; color: var(--primary-color); margin-bottom: 8px;"></i>
                            <div style="color: var(--text); font-weight: 500; margin-bottom: 4px;">Click to play audio</div>
                            <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">${att.name}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">${fileSizeText}</div>
                        </div>
                    </div>
                </div>`;
            } else {
                let icon = "file";
                let iconColor = "var(--primary-color)";
                if (att.type === "application/pdf") { icon = "file-pdf"; iconColor = "#dc3545"; }
                else if (att.type && att.type.includes("document")) { icon = "file-word"; iconColor = "#0078d4"; }
                else if (att.type === "text/plain") { icon = "file-text"; iconColor = "#28a745"; }
                else if (att.type && att.type.includes("zip")) { icon = "file-archive"; iconColor = "#ffc107"; }

                return `<div class="message-attachment file" onclick="downloadDatabaseFile('${fileId}')" 
                             style="cursor: pointer; padding: 12px; border-radius: 8px; background: var(--surface); border: 1px solid var(--border-light); transition: all 0.3s ease; display: flex; align-items: center; gap: 12px;"
                             onmouseenter="this.style.transform='scale(1.02)'; this.style.borderColor='var(--primary-color)'; this.style.background='var(--background)'"
                             onmouseleave="this.style.transform='scale(1)'; this.style.borderColor='var(--border-light)'; this.style.background='var(--surface)'">
                    <i class="fas fa-${icon}" style="font-size: 1.8rem; color: ${iconColor};"></i>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${att.name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">${fileSizeText} • Click to download</div>
                    </div>
                    <i class="fas fa-download" style="color: var(--text-muted); font-size: 0.9rem;"></i>
                </div>`;
            }
        } else {
            // Handle regular URLs (Firebase Storage files)
            if (att.type && att.type.startsWith("image/")) {
                return `<div class="message-attachment image">
                    <img src="${att.url}" alt="${att.name}" loading="lazy" style="max-width: 100%; border-radius: 8px; cursor: pointer;" onclick="window.open('${att.url}', '_blank')">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                        <span class="attachment-name">${att.name}</span>
                        <button onclick="event.stopPropagation(); downloadImageFromUrl('${att.url}', '${att.name}')" 
                                style="padding: 4px 8px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.7rem; transition: all 0.2s ease;"
                                onmouseenter="this.style.background='var(--primary-dark)'"
                                onmouseleave="this.style.background='var(--primary-color)'">
                            <i class="fas fa-download"></i>
                        </button>
                    </div>
                </div>`;
            } else if (att.type && att.type.startsWith("video/")) {
                return `<div class="message-attachment video">
                    <video controls style="max-width: 100%; border-radius: 8px;">
                        <source src="${att.url}" type="${att.type}">
                        Your browser does not support the video tag.
                    </video>
                    <span class="attachment-name">${att.name}</span>
                </div>`;
            } else if (att.type && att.type.startsWith("audio/")) {
                return `<div class="message-attachment audio">
                    <audio controls style="width: 100%;">
                        <source src="${att.url}" type="${att.type}">
                        Your browser does not support the audio tag.
                    </audio>
                    <span class="attachment-name">${att.name}</span>
                </div>`;
            } else {
                let icon = "file";
                if (att.type === "application/pdf") icon = "file-pdf";
                else if (att.type && att.type.includes("document")) icon = "file-word";
                else if (att.type === "text/plain") icon = "file-text";

                return `<div class="message-attachment file" onclick="window.open('${att.url}', '_blank')" style="cursor: pointer;">
                    <i class="fas fa-${icon}"></i>
                    <span>${att.name}</span>
                    <small>(${att.size ? Math.round(att.size / 1024) + ' KB' : 'Unknown size'})</small>
                </div>`;
            }
        }
        }).join('');

        // Wrap multiple attachments in a container
        if (attachments.length > 1) {
            attachmentHtml = `<div class="message-attachments-container">${attachmentHtml}</div>`;
        }
    }

    const messageText = message.text || "";

    messageEl.innerHTML = `
        <div class="message-header">
            <span>${message.from}</span>
            <span>${formatTime(message.timestamp)}</span>
        </div>
        ${messageText ? `<div class="message-content">${messageText}</div>` : ''}
        ${attachmentHtml}
    `;

    return messageEl;
}

function updateAttachmentPreview() {
    if (!attachmentPreview) return;

    attachmentPreview.innerHTML = "";

    if (attachments.length === 0) {
        attachmentPreview.style.display = "none";
        return;
    }

    attachmentPreview.style.display = "block";

    attachments.forEach((attachment, index) => {
        const previewEl = document.createElement("div");
        previewEl.className = "attachment-item";

        // Enhanced icon selection
        let icon = "file";
        const fileType = attachment.type.toLowerCase();

        if (fileType.startsWith("image/")) {
            icon = "image";
        } else if (fileType.startsWith("video/")) {
            icon = "video";
        } else if (fileType.startsWith("audio/")) {
            icon = "music";
        } else if (fileType === "application/pdf") {
            icon = "file-pdf";
        } else if (fileType.includes("document") || fileType.includes("word") || fileType.includes("msword")) {
            icon = "file-word";
        } else if (fileType.includes("spreadsheet") || fileType.includes("excel")) {
            icon = "file-excel";
        } else if (fileType.includes("presentation") || fileType.includes("powerpoint")) {
            icon = "file-powerpoint";
        } else if (fileType.startsWith("text/")) {
            icon = "file-text";
        } else if (fileType.includes("zip") || fileType.includes("rar") || fileType.includes("archive")) {
            icon = "file-archive";
        }

        // Format file size
        let sizeDisplay;
        const sizeInBytes = attachment.size;
        if (sizeInBytes < 1024) {
            sizeDisplay = `${sizeInBytes} B`;
        } else if (sizeInBytes < 1024 * 1024) {
            sizeDisplay = `${(sizeInBytes / 1024).toFixed(1)} KB`;
        } else {
            sizeDisplay = `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
        }

        previewEl.innerHTML = `
            <i class="fas fa-${icon}" style="color: var(--primary-color); font-size: 1.2rem;"></i>
            <div class="attachment-info">
                <span class="attachment-name" title="${attachment.name}">${attachment.name}</span>
                <span class="attachment-size">${sizeDisplay}</span>
                <span class="attachment-type">${attachment.type || 'Unknown type'}</span>
            </div>
            <button class="attachment-remove" onclick="removeAttachment(${index})" title="Remove file">&times;</button>
        `;

        attachmentPreview.appendChild(previewEl);
    });
}

function removeAttachment(index) {
    if (index >= 0 && index < attachments.length) {
        const removedFile = attachments[index];
        attachments.splice(index, 1);
        updateAttachmentPreview();
        resetFileInput();

        showNotification(`Removed "${removedFile.name}"`, "info");
        console.log("Attachment removed:", removedFile.name);
    }
}

async function sendMessage() {
    const text = messageInput.value.trim();

    // Validation
    if (!text && attachments.length === 0) {
        showNotification("Please enter a message or select a file to send", "info");
        return;
    }

    if (!selectedChat) {
        showNotification("Please select a chat first", "error");
        return;
    }

    if (selectedChat === "partner-group") {
        showNotification("Cannot send messages in group view", "error");
        return;
    }

    const targetUser = selectedChat.split("_").find((u) => u !== currentUser);
    const targetUserData = users.find(u => u.username === targetUser);

    if (!targetUserData) {
        showNotification("Target user not found", "error");
        return;
    }

    // Check permissions (allow file sharing for partners, restrict text)
    if (text && !canUserMessage(currentRole, targetUserData.role)) {
        showNotification(`You don't have permission to send text messages to ${targetUser}`, "error");
        return;
    }

    // Create message object
    const message = {
        id: generateId(),
        from: currentUser,
        to: targetUser,
        text: text,
        timestamp: Date.now(),
        attachment: null,
    };

    // Disable UI during processing
    const originalSendBtnHTML = sendBtn.innerHTML;
    const originalMessageInputValue = messageInput.value;

    sendBtn.disabled = true;
    messageInput.disabled = true;
    attachBtn.disabled = true;

    // Set overall timeout for the entire send operation
    const sendTimeout = setTimeout(() => {
        sendBtn.innerHTML = originalSendBtnHTML;
        sendBtn.disabled = false;
        messageInput.disabled = false;
        attachBtn.disabled = false;
        showNotification("Send operation timed out. Please try again.", "error");
    }, 45000); // 45 second total timeout

    try {
        // Handle file attachments if present
        if (attachments.length > 0) {
            console.log("Processing file attachments:", attachments.length);

            // For single file, keep existing attachment structure
            if (attachments.length === 1) {
                const file = attachments[0];

                // Additional file size check
                if (file.size > 25 * 1024 * 1024) {
                    throw new Error("File too large. Please select a smaller file (max 25MB).");
                }

                console.log("Processing single file attachment:", {
                    name: file.name,
                    size: file.size,
                    type: file.type
                });

                // Show upload progress
                sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
                showNotification(`Uploading "${file.name}"...`, "info");

                try {
                    const uploadedFile = await uploadFile(file);
                    console.log("File upload completed:", uploadedFile);

                    message.attachment = uploadedFile;
                    showNotification(`File uploaded successfully!`, "success");

                } catch (uploadError) {
                    console.error("File upload failed:", uploadError);
                    throw new Error(`Upload failed: ${uploadError.message}`);
                }
            } else {
                // Handle multiple files
                const uploadedFiles = [];
                let uploadCount = 0;

                sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading files...';
                showNotification(`Uploading ${attachments.length} files...`, "info");

                for (const file of attachments) {
                    if (file.size > 25 * 1024 * 1024) {
                        throw new Error(`File "${file.name}" too large. Please select smaller files (max 25MB each).`);
                    }

                    try {
                        sendBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Uploading ${uploadCount + 1}/${attachments.length}...`;
                        const uploadedFile = await uploadFile(file);
                        uploadedFiles.push(uploadedFile);
                        uploadCount++;

                        console.log(`File ${uploadCount}/${attachments.length} uploaded:`, uploadedFile);

                    } catch (uploadError) {
                        console.error("File upload failed:", uploadError);
                        throw new Error(`Upload failed for "${file.name}": ${uploadError.message}`);
                    }
                }

                // Store multiple files in attachments array
                message.attachments = uploadedFiles;
                showNotification(`${uploadedFiles.length} files uploaded successfully!`, "success");
            }
        }

        // Show sending progress
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

        // Save message to database with timeout
        console.log("Saving message to database:", message);
        const savePromise = saveMessage(selectedChat, message);
        const saveTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Database save timeout")), 10000)
        );

        await Promise.race([savePromise, saveTimeout]);

        console.log("Message sent successfully");

        // Clear timeout
        clearTimeout(sendTimeout);

        // Clear inputs and reset UI
        messageInput.value = "";
        attachments = [];
        updateAttachmentPreview();
        resetFileInput();

        // Success notification
        if (message.attachment) {
            showNotification(`File "${message.attachment.name}" sent successfully!`, "success");
        } else {
            showNotification("Message sent successfully!", "success");
        }

    } catch (error) {
        console.error("Send message error:", error);

        // Clear timeout
        clearTimeout(sendTimeout);

        // Restore original state on error
        messageInput.value = originalMessageInputValue;

        // Show specific error message
        if (error.message.includes("CORS")) {
            showNotification("File upload blocked by browser security. Firebase Storage needs domain configuration.", "error");
        } else if (error.message.includes("timeout")) {
            showNotification("Operation timed out. Please check your connection and try again.", "error");
        } else if (error.message.includes("network")) {
            showNotification("Network error. Please check your connection.", "error");
        } else if (error.message.includes("Firebase Storage")) {
            showNotification("Storage service temporarily unavailable. Please try again later.", "error");
        } else {
            showNotification(`Failed to send: ${error.message}`, "error");
        }

    } finally {
        // Re-enable UI
        sendBtn.innerHTML = originalSendBtnHTML;
        sendBtn.disabled = false;
        messageInput.disabled = false;
        attachBtn.disabled = false;

        // Focus back to input
        messageInput.focus();
    }
}

async function sendBroadcast() {
    const text = broadcastMessage.value.trim();
    if (!text) return;

    const broadcast = {
        id: generateId(),
        from: currentUser,
        text: text,
        timestamp: Date.now(),
    };

    try {
        await saveBroadcastMessage(broadcast);
        broadcastMessage.value = "";
        closeModal("broadcastModal");
        showNotification("Broadcast sent to all users");
    } catch (error) {
        showNotification("Error sending broadcast", "error");
    }
}

function showModal(modalId) {
    document.getElementById(modalId).classList.add("active");

    if (modalId === "newChatModal") {
        displayAvailableUsers();
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove("active");
}

function displayAvailableUsers() {
    availableUsers.innerHTML = "";
    const usersToShow = getUsersForRole(currentRole);

    usersToShow.forEach((user) => {
        if (user.username === currentUser) return;

        const userEl = document.createElement("div");
        userEl.className = "user-item";
        userEl.innerHTML = `
            <div class="contact-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="contact-info">
                <div class="contact-name">${user.username}</div>
                <div class="contact-role">${user.role}</div>
            </div>
        `;

        userEl.addEventListener("click", () => {
            const chatId = getChatId(currentUser, user.username);
            selectChat(chatId, user.username);
            closeModal("newChatModal");
        });

        availableUsers.appendChild(userEl);
    });
}

// Login function for card clicks
async function handleLogin(username, password, role) {
    // Simple authentication (in production, use proper authentication)
    const validCredentials = {
        admin: { password: "admin123", role: "admin" },
        mod1: { password: "mod123", role: "moderator" },
        partner1: { password: "partner123", role: "member" },
        user1: { password: "user123", role: "member" },
    };

    try {
        if (
            validCredentials[username] &&
            validCredentials[username].password === password &&
            validCredentials[username].role === role
        ) {
            currentUser = username;
            currentRole = role;

            // Save session
            saveSession(username, role);

            // Try to save user and load users with retry
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
                try {
                    await saveUser(username, role);
                    await loadUsers();
                    break;
                } catch (error) {
                    retryCount++;
                    if (retryCount === maxRetries) {
                        throw error;
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
            }

            setupUserInterface(username, role);
            showNotification(`Welcome to NexusChat, ${username}!`);
        } else {
            showNotification("Invalid credentials", "error");
        }
    } catch (error) {
        console.error("Login error:", error);
        if (error.message && error.message.includes('Firebase')) {
            showNotification("Firebase connection issue. Please try again.", "error");
        } else {
            showNotification("Connection error. Please check your internet connection.", "error");
        }
    }
}

sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

attachBtn.addEventListener("click", () => fileInput.click());
// Enhanced file input handler - supports multiple files
fileInput.addEventListener("change", (e) => {
    const files = Array.from(e.target.files);
    console.log("Files selected:", files.length);

    if (files.length === 0) {
        return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB limit for database storage
    const maxFiles = 10; // Maximum 10 files at once

    // Check file count limit
    if (files.length > maxFiles) {
        showNotification(`Too many files selected. Maximum ${maxFiles} files allowed.`, "error");
        resetFileInput();
        return;
    }

    // Validate all files first
    const validFiles = [];
    let totalSize = 0;

    for (const file of files) {
        console.log("Processing file:", {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
        });

        // Individual file size check
        if (file.size > maxSize) {
            showNotification(`File "${file.name}" too large. Maximum ${Math.round(maxSize / (1024 * 1024))}MB per file.`, "error");
            resetFileInput();
            return;
        }

        if (file.size === 0) {
            showNotification(`Cannot upload empty file: "${file.name}".`, "error");
            resetFileInput();
            return;
        }

        totalSize += file.size;
        validFiles.push(file);
    }

    // Check total size (optional - can be removed if not needed)
    const maxTotalSize = 100 * 1024 * 1024; // 100MB total
    if (totalSize > maxTotalSize) {
        showNotification(`Total file size too large. Maximum ${Math.round(maxTotalSize / (1024 * 1024))}MB total.`, "error");
        resetFileInput();
        return;
    }

    // Add all valid files to attachments
    attachments = validFiles;
    updateAttachmentPreview();

    // Provide user feedback
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    if (validFiles.length === 1) {
        showNotification(`File "${validFiles[0].name}" (${(validFiles[0].size / (1024 * 1024)).toFixed(2)}MB) ready to send!`, "success");
    } else {
        showNotification(`${validFiles.length} files (${totalSizeMB}MB total) ready to send!`, "success");
    }

    // Focus message input for user to add text if needed
    messageInput.focus();

    console.log("File attachments ready:", validFiles.map(f => f.name));
});

function resetFileInput() {
    fileInput.value = '';
    attachments = [];
    updateAttachmentPreview();
}

downloadBtn.addEventListener("click", downloadData);
downloadChatBtn.addEventListener("click", downloadChat);
deleteBtn.addEventListener("click", deleteAllData);
async function setupUserInterface(username, role) {
    currentUserEl.textContent = username;
    currentRoleEl.textContent = role;

    // Show/hide features based on role
    if (role === "admin") {
        broadcastSection.style.display = "block";
        deleteBtn.style.display = "block";
    } else if (role === "moderator") {
        broadcastSection.style.display = "block";
        deleteBtn.style.display = "none";
    } else {
        broadcastSection.style.display = "none";
        deleteBtn.style.display = "none";
    }

    // Hide AI assistant toggle after login
    const aiChatToggle = document.getElementById('aiChatToggle');
    if (aiChatToggle) {
        aiChatToggle.style.display = 'none';
    }

    displayContacts();
    showScreen("chatScreen");

    // Listen to broadcasts for members
    if (role === "member") {
        listenToBroadcasts();
    }

    // Listen to urgent notifications for all users
    listenToUrgentNotifications();

    // Set current user's presence to online
    setUserOnline(username);
    
    // Check for any pending notifications for this user
    await checkPendingNotifications(username);
}

// Check for existing session on page load
async function checkExistingSession() {
    const session = loadSession();
    if (session) {
        currentUser = session.username;
        currentRole = session.role;

        try {
            // Try to load users with retry mechanism
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
                try {
                    await loadUsers();
                    break;
                } catch (error) {
                    retryCount++;
                    if (retryCount === maxRetries) {
                        throw error;
                    }
                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
            }

            setupUserInterface(currentUser, currentRole);
            showNotification(`Welcome back, ${currentUser}!`);
        } catch (error) {
            console.error('Error restoring session:', error);
            // Don't clear session immediately, just show login screen
            showScreen("loginScreen");
            showNotification("Connection issue. Please sign in again.", "error");
        }
    }
}

logoutBtn.addEventListener("click", () => {
    if (currentUser) {
        setUserOffline(currentUser); // Mark user as offline on logout
    }
    currentUser = null;
    currentRole = null;
    selectedChat = null;
    clearSession();

    // Show AI assistant toggle on logout
    const aiChatToggle = document.getElementById('aiChatToggle');
    if (aiChatToggle) {
        aiChatToggle.style.display = 'flex';
    }

    // Close AI chatbox if open
    if (aiChatOpen) {
        closeAIChat();
    }

    showScreen("loginScreen");
    showNotification("Logged out successfully");
});

newChatBtn.addEventListener("click", () => showModal("newChatModal"));
broadcastBtn.addEventListener("click", () => showModal("broadcastModal"));
sendBroadcastBtn.addEventListener("click", sendBroadcast);

// Modal close events
document.querySelectorAll(".close-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
        const modal = e.target.closest(".modal");
        modal.classList.remove("active");
    });
});

document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (e) => {
        if (e.target === modal) {
            modal.classList.remove("active");
        }
    });
});

// File cache for faster access
const fileCache = new Map();

// Functions to handle database-stored files with caching and optimization
async function loadDatabaseFile(fileId, mediaType) {
    try {
        console.log("Loading database file:", fileId);

        // Find the placeholder first
        const placeholder = document.querySelector(`[data-file-id="${fileId}"]`);
        if (!placeholder) return;

        // Show loading state immediately
        placeholder.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--primary-color); margin-bottom: 8px;"></i>
                <div style="color: var(--text-muted); font-size: 0.9rem;">Loading...</div>
            </div>
        `;

        // Check cache first
        let fileData;
        if (fileCache.has(fileId)) {
            fileData = fileCache.get(fileId);
            console.log("File loaded from cache:", fileId);
        } else {
            // Load from database with timeout
            const fileRef = ref(database, `files/${fileId}`);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Load timeout')), 5000)
            );

            const snapshot = await Promise.race([get(fileRef), timeoutPromise]);

            if (!snapshot.exists()) {
                showNotification("File not found in database", "error");
                return;
            }

            fileData = snapshot.val();
            // Cache the file data for future use
            fileCache.set(fileId, fileData);
        }

        const dataUrl = `data:${fileData.type};base64,${fileData.data}`;

        let mediaElement;
        if (mediaType === 'image') {
            mediaElement = document.createElement('img');
            mediaElement.src = dataUrl;
            mediaElement.alt = fileData.name;
            mediaElement.style.cssText = 'max-width: 100%; border-radius: 8px; cursor: pointer; transition: transform 0.2s ease;';
            mediaElement.onload = () => {
                mediaElement.style.opacity = '0';
                mediaElement.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    mediaElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                    mediaElement.style.opacity = '1';
                    mediaElement.style.transform = 'scale(1)';
                }, 50);
            };
            mediaElement.onclick = () => openFileInNewTab(dataUrl, fileData.name);
            mediaElement.onmouseenter = () => mediaElement.style.transform = 'scale(1.02)';
            mediaElement.onmouseleave = () => mediaElement.style.transform = 'scale(1)';
        } else if (mediaType === 'video') {
            mediaElement = document.createElement('video');
            mediaElement.controls = true;
            mediaElement.preload = 'metadata';
            mediaElement.style.cssText = 'max-width: 100%; border-radius: 8px; opacity: 0; transition: opacity 0.3s ease;';
            const source = document.createElement('source');
            source.src = dataUrl;
            source.type = fileData.type;
            mediaElement.appendChild(source);
            mediaElement.onloadedmetadata = () => {
                mediaElement.style.opacity = '1';
            };
        } else if (mediaType === 'audio') {
            mediaElement = document.createElement('audio');
            mediaElement.controls = true;
            mediaElement.preload = 'metadata';
            mediaElement.style.cssText = 'width: 100%; opacity: 0; transition: opacity 0.3s ease;';
            const source = document.createElement('source');
            source.src = dataUrl;
            source.type = fileData.type;
            mediaElement.appendChild(source);
            mediaElement.onloadedmetadata = () => {
                mediaElement.style.opacity = '1';
            };
        }

        if (mediaElement) {
            // Create container for smooth replacement
            const container = document.createElement('div');
            container.style.cssText = 'position: relative; overflow: hidden;';
            container.appendChild(mediaElement);

            // Add filename below media
            const nameSpan = document.createElement('span');
            nameSpan.className = 'attachment-name';
            nameSpan.textContent = fileData.name;
            nameSpan.style.cssText = 'display: block; margin-top: 4px; font-size: 0.85rem; color: var(--text-muted);';
            container.appendChild(nameSpan);

            // Smooth replacement
            placeholder.style.transition = 'opacity 0.2s ease';
            placeholder.style.opacity = '0';

            setTimeout(() => {
                placeholder.parentNode.replaceChild(container, placeholder);
            }, 200);
        }

    } catch (error) {
        console.error("Error loading database file:", error);

        // Show error state
        const placeholder = document.querySelector(`[data-file-id="${fileId}"]`);
        if (placeholder) {
            placeholder.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--error-color);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 1.5rem; margin-bottom: 8px;"></i>
                    <div style="font-size: 0.9rem;">Failed to load file</div>
                    <button onclick="loadDatabaseFile('${fileId}', '${mediaType}')" 
                            style="margin-top: 8px; padding: 4px 8px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Retry
                    </button>
                </div>
            `;
        }

        if (error.message === 'Load timeout') {
            showNotification("File loading timed out. Please try again.", "error");
        } else {
            showNotification("Error loading file", "error");
        }
    }
}

async function downloadDatabaseFile(fileId) {
    try {
        console.log("Downloading database file:", fileId);

        // Show immediate feedback
        showNotification("Preparing download...", "info");

        let fileData;

        // Check cache first for instant download
        if (fileCache.has(fileId)) {
            fileData = fileCache.get(fileId);
            console.log("File download from cache:", fileId);
        } else {
            // Load from database with timeout
            const fileRef = ref(database, `files/${fileId}`);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Download timeout')), 5000)
            );

            const snapshot = await Promise.race([get(fileRef), timeoutPromise]);

            if (!snapshot.exists()) {
                showNotification("File not found in database", "error");
                return;
            }

            fileData = snapshot.val();
            // Cache for future use
            fileCache.set(fileId, fileData);
        }

        const dataUrl = `data:${fileData.type};base64,${fileData.data}`;

        // Create and trigger download with better UX
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileData.name;
        link.style.display = 'none';
        document.body.appendChild(link);

        // Trigger download
        link.click();

        // Cleanup
        setTimeout(() => {
            document.body.removeChild(link);
        }, 100);

        // Show success with file size info
        const fileSizeMB = (fileData.size / (1024 * 1024)).toFixed(2);
        showNotification(`Downloaded "${fileData.name}" (${fileSizeMB}MB)`, "success");

    } catch (error) {
        console.error("Error downloading database file:", error);

        if (error.message === 'Download timeout') {
            showNotification("Download timed out. Please try again.", "error");
        } else {
            showNotification("Error downloading file", "error");
        }
    }
}

function openFileInNewTab(dataUrl, filename) {
    try {
        const newWindow = window.open();
        if (newWindow) {
            newWindow.document.write(`
                <html>
                    <head><title>${filename}</title></head>
                    <body style="margin:0;padding:20px;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f0f0f0;">
                        <img src="${dataUrl}" style="max-width:100%;max-height:100%;object-fit:contain;" alt="${filename}">
                    </body>
                </html>
            `);
        } else {
            showNotification("Please allow popups to view file", "error");
        }
    } catch (error) {
        console.error("Error opening file:", error);
        showNotification("Error opening file", "error");
    }
}

// Function to download images from regular URLs
async function downloadImageFromUrl(url, filename) {
    try {
        showNotification("Downloading image...", "info");
        
        const response = await fetch(url);
        const blob = await response.blob();
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        
        link.click();
        
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        }, 100);
        
        showNotification(`Downloaded "${filename}"`, "success");
    } catch (error) {
        console.error("Error downloading image:", error);
        showNotification("Error downloading image", "error");
    }
}

// Auto-load images function
function autoLoadImages() {
    const imageElements = document.querySelectorAll('.auto-load-image');
    imageElements.forEach(element => {
        const fileId = element.dataset.fileId;
        if (fileId && !element.classList.contains('loaded')) {
            element.classList.add('loaded');
            loadDatabaseFile(fileId, 'image');
        }
    });
}

// Make functions global for onclick
window.removeAttachment = removeAttachment;
window.loadDatabaseFile = loadDatabaseFile;
window.downloadDatabaseFile = downloadDatabaseFile;
window.downloadImageFromUrl = downloadImageFromUrl;
window.acknowledgeUrgentNotification = acknowledgeUrgentNotification;

// Spline loading handler
function handleSplineLoading() {
    const splineViewer = document.getElementById('splineViewer');
    const splineViewerDark = document.getElementById('splineViewerDark');
    const splineLoading = document.getElementById('splineLoading');
    const loadingTitle = document.querySelector('.loading-title');

    if (splineViewer && splineViewerDark && splineLoading) {
        // Hide viewers initially to prevent WebGL errors
        splineViewer.style.opacity = '0';
        splineViewer.style.pointerEvents = 'none';
        splineViewerDark.style.opacity = '0';
        splineViewerDark.style.pointerEvents = 'none';

        let loadedCount = 0;
        const totalViewers = 2;

        // Function to show Spline with full animation
        const showSpline = () => {
            loadedCount++;
            if (loadedCount >= totalViewers) {
                // Start fading out the loading title text first
                if (loadingTitle) {
                    loadingTitle.classList.add('fade-out');
                }

                // Small delay to ensure everything is ready and text starts fading
                setTimeout(() => {
                    splineLoading.classList.add('hidden');

                    // Show the appropriate viewer based on current theme
                    const currentTheme = document.documentElement.getAttribute('data-theme');
                    if (currentTheme === 'dark') {
                        splineViewer.style.opacity = '0';
                        splineViewer.style.pointerEvents = 'none';

                        splineViewerDark.style.opacity = '1';
                        splineViewerDark.style.pointerEvents = 'auto';
                        splineViewerDark.classList.add('loaded');
                    } else {
                        splineViewerDark.style.opacity = '0';
                        splineViewerDark.style.pointerEvents = 'none';

                        splineViewer.style.opacity = '1';
                        splineViewer.style.pointerEvents = 'auto';
                        splineViewer.classList.add('loaded');
                    }
                }, 250);
            }
        };

        // Listen for when both Spline scenes are fully loaded
        splineViewer.addEventListener('load', showSpline);
        splineViewer.addEventListener('spline-loaded', showSpline);
        splineViewerDark.addEventListener('load', showSpline);
        splineViewerDark.addEventListener('spline-loaded', showSpline);

        // Fallback timeout - reduced to show animation sooner
        setTimeout(() => {
            if (loadedCount < totalViewers) {
                loadedCount = totalViewers;
                showSpline();
            }
        }, 3000);
    }
}

// Theme toggle functionality
function initializeThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = themeToggle.querySelector('i');

    // Check for saved theme preference
    const savedTheme = localStorage.getItem('nexuschat_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme, themeIcon);

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        // Add rotation animation
        themeToggle.style.transform = 'scale(0.9) rotate(180deg)';

        setTimeout(() => {
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('nexuschat_theme', newTheme);
            updateThemeIcon(newTheme, themeIcon);
            switchSplineModel(newTheme);

            themeToggle.style.transform = 'scale(1) rotate(0deg)';
        }, 150);
    });
}

function switchSplineModel(theme) {
    const splineViewer = document.getElementById('splineViewer');
    const splineViewerDark = document.getElementById('splineViewerDark');

    if (splineViewer && splineViewerDark) {
        if (theme === 'dark') {
            // Smooth transition without hiding elements completely
            splineViewer.style.opacity = '0';
            splineViewer.style.pointerEvents = 'none';

            // Show dark model
            splineViewerDark.style.opacity = '1';
            splineViewerDark.style.pointerEvents = 'auto';
        } else {
            // Smooth transition without hiding elements completely
            splineViewerDark.style.opacity = '0';
            splineViewerDark.style.pointerEvents = 'none';

            // Show light model
            splineViewer.style.opacity = '1';
            splineViewer.style.pointerEvents = 'auto';
        }
    }
}

function updateThemeIcon(theme, iconElement) {
    if (theme === 'dark') {
        iconElement.className = 'fas fa-sun';
    } else {
        iconElement.className = 'fas fa-moon';
    }
}

// Initialize app
console.log("NexusChat initialized");
console.log("Demo credentials:");
console.log('Admin: username="admin", password="admin123", role="admin"');
console.log('Moderator: username="mod1", password="mod123", role="moderator"');
console.log('Partner: username="partner1", password="partner123", role="member"');
console.log('Member: username="user1", password="user123", role="member"');

// Initialize Spline loading
handleSplineLoading();

// Initialize theme toggle
initializeThemeToggle();

// Animation and UI Enhancement Functions
function addRippleEffect(button, event) {
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple-effect');

    button.appendChild(ripple);

    setTimeout(() => {
        ripple.remove();
    }, 600);
}

function animateCounter(element, start, end, duration) {
    const startTime = performance.now();
    const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const current = Math.floor(start + (end - start) * progress);
        element.textContent = current;

        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    };
    requestAnimationFrame(animate);
}

function addShakeAnimation(element) {
    element.style.animation = 'shake 0.5s ease-in-out';
    setTimeout(() => {
        element.style.animation = '';
    }, 500);
}

function addSuccessAnimation(element) {
    element.style.animation = 'bounce 0.6s ease';
    setTimeout(() => {
        element.style.animation = '';
    }, 600);
}

// Enhanced form interactions
function enhanceFormInputs() {
    const inputs = document.querySelectorAll('.form-input, .form-select');
    inputs.forEach(input => {
        input.addEventListener('focus', (e) => {
            e.target.parentElement.style.transform = 'translateY(-2px)';
            e.target.parentElement.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        });

        input.addEventListener('blur', (e) => {
            e.target.parentElement.style.transform = '';
        });

        input.addEventListener('input', (e) => {
            if (e.target.value) {
                e.target.parentElement.classList.add('has-value');
            } else {
                e.target.parentElement.classList.remove('has-value');
            }
        });
    });
}

// Enhanced button interactions
function enhanceButtons() {
    const buttons = document.querySelectorAll('button:not(.no-ripple):not(.send-btn):not(.ai-send-btn):not(.quick-ai-send)');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            if (!this.classList.contains('no-ripple')) {
                addRippleEffect(this, e);
            }
        });
    });
}

// Staggered animations for lists
function animateListItems(container, delay = 100) {
    const items = container.querySelectorAll('.contact-item, .user-item');
    items.forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateX(-20px)';

        setTimeout(() => {
            item.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
            item.style.opacity = '1';
            item.style.transform = 'translateX(0)';
        }, index * delay);
    });
}

// Enhanced message animations removed

// Notification animations
function showEnhancedNotification(message, type = "success") {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.transform = 'translateX(100%)';
    notification.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

    document.body.appendChild(notification);

    requestAnimationFrame(() => {
        notification.style.transform = 'translateX(0)';
    });

    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Login form modal functionality
let selectedRole = null;

function openLoginForm(role, roleName) {
    selectedRole = role;
    const loginFormModal = document.getElementById('loginFormModal');
    const loginFormTitle = document.getElementById('loginFormTitle');

    loginFormTitle.textContent = `Sign In - ${roleName}`;
    loginFormModal.classList.add('active');

    // Focus on username input
    setTimeout(() => {
        document.getElementById('loginUsername').focus();
    }, 300);
}

function closeLoginForm() {
    const loginFormModal = document.getElementById('loginFormModal');
    loginFormModal.classList.remove('active');
    selectedRole = null;

    // Clear form
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
}

async function submitLoginForm() {
    if (!selectedRole) return;

    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!username || !password) {
        showNotification('Please enter both username and password', 'error');
        return;
    }

    const submitBtn = document.getElementById('submitLoginForm');
    const originalText = submitBtn.querySelector('.text').textContent;

    // Show loading state
    submitBtn.querySelector('.text').textContent = 'Logging In...';
    submitBtn.disabled = true;

    try {
        await handleLogin(username, password, selectedRole);
        closeLoginForm();
    } catch (error) {
        submitBtn.querySelector('.text').textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Login card options functionality
document.addEventListener('DOMContentLoaded', () => {
    const loginCards = document.querySelectorAll('.login-card-option');
    loginCards.forEach((card, index) => {
        card.addEventListener('click', () => {
            const role = card.dataset.role;
            const roleName = card.dataset.roleName;

            // Enhanced visual feedback
            addSuccessAnimation(card);

            // Pulse the card icon
            const cardIcon = card.querySelector('.card-icon');
            cardIcon.style.animation = 'pulse 0.6s ease';

            // Open login form modal
            setTimeout(() => {
                openLoginForm(role, roleName);
            }, 300);
        });
    });

    // Login form event listeners
    const loginFormModal = document.getElementById('loginFormModal');
    const submitLoginBtn = document.getElementById('submitLoginForm');
    const loginUsername = document.getElementById('loginUsername');
    const loginPassword = document.getElementById('loginPassword');

    // Submit button click
    submitLoginBtn.addEventListener('click', submitLoginForm);

    // Enter key submission
    loginUsername.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            loginPassword.focus();
        }
    });

    loginPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitLoginForm();
        }
    });

    // Close modal when clicking close button
    loginFormModal.querySelector('.close-btn').addEventListener('click', closeLoginForm);

    // Close modal when clicking outside
    loginFormModal.addEventListener('click', (e) => {
        if (e.target === loginFormModal) {
            closeLoginForm();
        }
    });

    // Initialize enhancements
    enhanceButtons();
});

// AI Assistant Chatbox functionality
const aiChatbox = document.getElementById('aiChatbox');
const aiChatToggle = document.getElementById('aiChatToggle');
const aiChatHeader = document.getElementById('aiChatHeader');
const aiChatBody = document.getElementById('aiChatBody');
const aiMessages = document.getElementById('aiMessages');
const aiMessageInput = document.getElementById('aiMessageInput');
const aiSendBtn = document.getElementById('aiSendBtn');
const aiMinimizeBtn = document.getElementById('aiMinimizeBtn');
const aiCloseBtn = document.getElementById('aiCloseBtn');

const quickAiInput = document.getElementById('quickAiInput');
const quickAiSend = document.getElementById('quickAiSend');

let aiChatOpen = false;
let aiChatMinimized = false;
let aiTypingTimeout = null;

// Text-to-Speech functionality for robot voice
let speechSynthesis = window.speechSynthesis;
let robotVoice = null;
let isSpeaking = false;

// Initialize robot voice
function initializeRobotVoice() {
    if ('speechSynthesis' in window) {
        // Wait for voices to load
        const loadVoices = () => {
            const voices = speechSynthesis.getVoices();

            // Try to find a suitable robotic voice
            robotVoice = voices.find(voice => 
                voice.name.toLowerCase().includes('google') ||
                voice.name.toLowerCase().includes('microsoft') ||
                voice.name.toLowerCase().includes('alex') ||
                voice.voiceURI.includes('en-US')
            ) || voices[0];

            console.log('Robot voice initialized:', robotVoice?.name || 'Default voice');
        };

        if (speechSynthesis.getVoices().length > 0) {
            loadVoices();
        } else {
            speechSynthesis.addEventListener('voiceschanged', loadVoices);
        }
    }
}

// Speak text with robot voice settings
function speakWithRobotVoice(text) {
    if (!('speechSynthesis' in window)) {
        console.warn('Speech synthesis not supported');
        return;
    }

    // Stop any current speech
    speechSynthesis.cancel();

    // Clean text for speech (remove HTML tags and special characters)
    const cleanText = text
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/[^\w\s.,!?-]/g, '') // Keep only basic punctuation
        .trim();

    if (!cleanText) return;

    // Check if response is long (more than 100 characters for shorter cutoff)
    const isLongResponse = cleanText.length > 100;
    let textToSpeak = cleanText;

    if (isLongResponse) {
        // For long responses, speak first sentence and add screen prompt
        const firstSentence = cleanText.split('.')[0] + '.';
        textToSpeak = firstSentence + " Check screen for details.";
    }

    // Create single utterance for smoother speech
    const utterance = new SpeechSynthesisUtterance(textToSpeak);

    // Robot voice settings - more robotic sound with increased rate
    utterance.voice = robotVoice;
    utterance.rate = 0.75; // Slightly faster while maintaining robotic effect
    utterance.pitch = 0.4; // Very low pitch for mechanical sound
    utterance.volume = 0.9;

    // Add robotic character without chunking
    utterance.onstart = () => {
        isSpeaking = true;
    };

    utterance.onend = () => {
        isSpeaking = false;
    };

    utterance.onerror = () => {
        isSpeaking = false;
    };

    speechSynthesis.speak(utterance);
}

// Stop speech function
function stopRobotSpeech() {
    if (speechSynthesis) {
        speechSynthesis.cancel();
        isSpeaking = false;
    }
}

// Import Groq SDK from CDN for GitHub Pages compatibility
import Groq from "https://cdn.skypack.dev/groq-sdk";

// Initialize Groq client - you'll need to add your API key to secrets
let groqClient = null;

// Initialize Groq client with API key from environment
function initializeGroq() {
    try {
        // Try different ways to access the environment variable for better compatibility
        const apiKey = import.meta.env?.VITE_GROQ_API_KEY || 
                      window.__VITE_GROQ_API_KEY__ || 
                      process.env?.VITE_GROQ_API_KEY;
        
        if (apiKey && apiKey !== 'your_groq_api_key_here') {
            groqClient = new Groq({
                apiKey: apiKey,
                dangerouslyAllowBrowser: true // Required for browser usage
            });
            console.log('Groq client initialized successfully');
        } else {
            console.warn('Groq API key not found or not set. Using fallback responses.');
            groqClient = null;
        }
    } catch (error) {
        console.error('Error initializing Groq client:', error);
        groqClient = null;
    }
}

// Initialize Groq immediately when module loads
initializeGroq();

// System prompt for the AI assistant
const SYSTEM_PROMPT = `You are Nexbot, an AI assistant for NexusChat. Be direct and concise in all responses.

Creator: Atharva Phatangare is my creator and developer of NexusChat.

NexusChat Features:
- Secure messaging with role-based access (Admin/Moderator/Partner)
- Real-time chat, file sharing, broadcasts, chat downloads
- Firebase backend, responsive design, themes

I help with NexusChat features only. For unrelated topics, redirect to NexusChat.

Keep responses short and direct.`;

// Fallback responses for when Groq API is unavailable
const fallbackResponses = [
    "I help with NexusChat features. What do you need?",
    "NexusChat assistant here. How can I help?",
    "Ask me about messaging, file sharing, or user roles.",
    "I'm here for NexusChat support. What's your question?",
    "Need help with NexusChat features?",
    "What NexusChat feature can I explain?",
    "I assist with NexusChat only. What do you need?",
    "NexusChat questions? I'm here to help."
];

// Check if query is jailbreak command
function isJailbreakCommand(message) {
    return message.toLowerCase().startsWith('/jailbreak');
}

// Extract jailbreak query
function extractJailbreakQuery(message) {
    return message.substring(10).trim(); // Remove '/jailbreak' and trim
}

// Check for common greetings and polite expressions
function isCommonGreeting(message) {
    const greetings = [
        'hi', 'hello', 'hey', 'hiya', 'greetings', 'good morning', 'good afternoon', 
        'good evening', 'good day', 'howdy', 'what\'s up', 'how are you', 'how do you do'
    ];

    const farewells = [
        'bye', 'goodbye', 'see you', 'farewell', 'good night', 'take care', 
        'catch you later', 'see ya', 'until next time', 'good bye'
    ];

    const politeExpressions = [
        'thank you', 'thanks', 'thank u', 'thx', 'appreciate', 'grateful',
        'sorry', 'apologize', 'excuse me', 'pardon', 'my apologies',
        'please', 'kindly', 'help me', 'can you help'
    ];

    const lowerMessage = message.toLowerCase().trim();

    // Check exact matches and partial matches for these common expressions
    return [...greetings, ...farewells, ...politeExpressions].some(expression => 
        lowerMessage === expression || 
        lowerMessage.includes(expression) && lowerMessage.length <= expression.length + 10
    );
}

// Get appropriate response for common greetings
function getGreetingResponse(message) {
    const lowerMessage = message.toLowerCase().trim();

    // Greetings
    if (lowerMessage.includes('hi') || lowerMessage.includes('hello') || lowerMessage.includes('hey')) {
        return "Hi! I'm Nexbot. How can I help with NexusChat?";
    }

    if (lowerMessage.includes('good morning')) {
        return "Good morning! What NexusChat feature do you need help with?";
    }

    if (lowerMessage.includes('good afternoon')) {
        return "Good afternoon! How can I help with NexusChat?";
    }

    if (lowerMessage.includes('good evening')) {
        return "Good evening! What do you need help with?";
    }

    if (lowerMessage.includes('how are you')) {
        return "I'm good! Ready to help with NexusChat. What do you need?";
    }

    // Farewells
    if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye') || lowerMessage.includes('see you')) {
        return "Goodbye! Ask anytime for NexusChat help.";
    }

    if (lowerMessage.includes('good night')) {
        return "Good night! Ask me tomorrow for any NexusChat help.";
    }

    // Thank you
    if (lowerMessage.includes('thank') || lowerMessage.includes('appreciate')) {
        return "You're welcome! Need anything else about NexusChat?";
    }

    // Apologies
    if (lowerMessage.includes('sorry') || lowerMessage.includes('apologize')) {
        return "No problem! How can I help with NexusChat?";
    }

    // Help requests
    if (lowerMessage.includes('help me') || lowerMessage.includes('can you help')) {
        return "Sure! I help with messaging, roles, file sharing, and broadcasts. What do you need?";
    }

    // Default greeting response
    return "Hello! I'm Nexbot for NexusChat. What do you need help with?";
}

// Check if query is related to NexusChat
function isNexusChatRelated(message) {
    const nexusChatKeywords = [
        'nexuschat', 'chat', 'message', 'messaging', 'broadcast', 'file', 'share', 'download',
        'admin', 'moderator', 'partner', 'user', 'role', 'permission', 'login', 'logout',
        'contact', 'conversation', 'attachment', 'upload', 'firebase', 'real-time',
        'authentication', 'secure', 'communication', 'platform', 'interface', 'theme',
        'dark', 'light', 'navigation', 'features', 'help', 'support', 'how to', 'what is',
        'nexbot', 'assistant', 'ai', 'chatbot', 'atharva', 'phatangare', 'creator', 'developer',
        'who created', 'who made', 'who built'
    ];

    const lowerMessage = message.toLowerCase();

    // Check if message contains NexusChat-related keywords
    const hasNexusChatKeywords = nexusChatKeywords.some(keyword => 
        lowerMessage.includes(keyword)
    );

    // Check for question patterns that might be about the platform
    const isQuestionAboutPlatform = lowerMessage.includes('this app') || 
                                   lowerMessage.includes('this platform') ||
                                   lowerMessage.includes('here') ||
                                   lowerMessage.includes('this chat');

    return hasNexusChatKeywords || isQuestionAboutPlatform;
}

function getOffTopicResponse() {
    const offTopicResponses = [
        "I only help with NexusChat. What feature do you need help with?",
        "NexusChat questions only. Ask about messaging or user roles.",
        "I focus on NexusChat features. What do you need to know?",
        "Only NexusChat topics. How can I help with the platform?",
        "I assist with NexusChat only. What feature interests you?",
        "NexusChat support only. What do you need help with?"
    ];

    return offTopicResponses[Math.floor(Math.random() * offTopicResponses.length)];
}

async function getAIResponse(message) {
    let actualQuery = message;
    let systemPrompt = SYSTEM_PROMPT;
    let maxTokens = 200;

    // Check if this is a jailbreak command
    if (isJailbreakCommand(message)) {
        actualQuery = extractJailbreakQuery(message);
        if (!actualQuery) {
            return "Please provide a query after /jailbreak. Example: /jailbreak What is the weather like?";
        }

        // Use unrestricted system prompt for jailbreak
        systemPrompt = `You are Nexbot, a helpful AI assistant. You can answer any question the user asks. Be helpful, informative, and concise.`;
        maxTokens = 400; // Allow longer responses for general queries
    } else {
        // First check if this is a common greeting or polite expression
        if (isCommonGreeting(message)) {
            return getGreetingResponse(message);
        }

        // Then check if the query is related to NexusChat
        if (!isNexusChatRelated(message)) {
            return getOffTopicResponse();
        }
    }

    // Try to use Groq API first
    if (groqClient) {
        try {
            // Use a faster model and optimized settings for quicker responses
            const completion = await groqClient.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: actualQuery
                    }
                ],
                model: "llama3-70b-8192", // Updated to use llama3-70b-8192 model
                temperature: 0.3, // Lower temperature for more direct responses
                max_tokens: isJailbreakCommand(message) ? maxTokens : 100, // Shorter responses for normal queries
                top_p: 0.9, // Slightly lower for faster processing
                stream: false
            });

            return completion.choices[0]?.message?.content || getFallbackResponse();
        } catch (error) {
            console.error('Groq API error:', error);
            return getFallbackResponse();
        }
    } else {
        return getFallbackResponse();
    }
}

function getFallbackResponse() {
    return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
}

function toggleAIChat() {
    aiChatOpen = !aiChatOpen;

    if (aiChatOpen) {
        if (aiChatbox) aiChatbox.classList.add('active');
        setTimeout(() => {
            if (aiMessageInput) aiMessageInput.focus();
        }, 300);
    } else {
        if (aiChatbox) {
            aiChatbox.classList.remove('active');
            aiChatbox.classList.remove('minimized');
        }
        aiChatMinimized = false;
    }
}

function expandToggleToFullChat() {
    // Start the expansion animation from the toggle position
    aiChatOpen = true;

    // Position the chatbox at the toggle's position initially
    const toggleRect = aiChatToggle.getBoundingClientRect();
    aiChatbox.style.position = 'fixed';
    aiChatbox.style.bottom = '17px';
    aiChatbox.style.right = '17px';
    aiChatbox.style.width = '350px';
    aiChatbox.style.height = '100px';
    aiChatbox.style.borderRadius = '20px';
    aiChatbox.style.display = 'flex';
    aiChatbox.classList.add('active');

    // Hide the toggle immediately
    aiChatToggle.style.opacity = '0';
    aiChatToggle.style.transform = 'scale(0.8)';

    // Animate to full size
    requestAnimationFrame(() => {
        aiChatbox.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        aiChatbox.style.height = '500px';
        aiChatbox.style.bottom = '20px';
        aiChatbox.style.borderRadius = '16px';

        // Hide toggle completely after animation starts
        setTimeout(() => {
            aiChatToggle.style.display = 'none';
        }, 100);

        // Focus input after expansion completes
        setTimeout(() => {
            if (aiMessageInput) aiMessageInput.focus();
            aiChatbox.style.transition = '';
        }, 600);
    });


}

async function sendQuickAIMessage() {
    const message = quickAiInput.value.trim();
    if (!message) return;

    // Add user message to the chatbox first
    addAIMessage(message, true);

    // Clear the input
    quickAiInput.value = '';
    quickAiSend.disabled = true;

    // Expand the toggle into full chat interface
    expandToggleToFullChat();

    // Show typing indicator in the expanded chat
    setTimeout(() => {
        showAITyping();
    }, 500);

    try {
        // Add timeout for faster fallback
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Response timeout')), 8000) // 8 second timeout
        );

        // Race between API call and timeout
        const response = await Promise.race([
            getAIResponse(message),
            timeoutPromise
        ]);

        // Hide typing and show response
        hideAITyping();
        addAIMessage(response);
    } catch (error) {
        console.error('Error getting AI response:', error);
        hideAITyping();

        if (error.message === 'Response timeout') {
            addAIMessage("Response is taking longer than expected. Here's a quick answer: " + getFallbackResponse());
        } else {
            addAIMessage("I'm sorry, I'm having trouble responding right now. Please try again.");
        }
    }

    quickAiSend.disabled = false;
}

function minimizeAIChat(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    aiChatMinimized = !aiChatMinimized;

    if (aiChatMinimized) {
        aiChatbox.classList.add('minimized');
        aiMinimizeBtn.innerHTML = '<i class="fas fa-plus"></i>';
    } else {
        aiChatbox.classList.remove('minimized');
        aiMinimizeBtn.innerHTML = '<i class="fas fa-minus"></i>';
    }
}

function closeAIChat() {
    aiChatOpen = false;
    aiChatMinimized = false;

    if (aiChatbox) {
        // Animate back to toggle size and position
        aiChatbox.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        aiChatbox.style.height = '100px';
        aiChatbox.style.bottom = '17px';
        aiChatbox.style.borderRadius = '20px';
        aiChatbox.style.opacity = '0';

        // After collapse animation, hide chatbox and show toggle
        setTimeout(() => {
            aiChatbox.classList.remove('active');
            aiChatbox.classList.remove('minimized');
            aiChatbox.style.display = 'none';
            aiChatbox.style.transition = '';
            aiChatbox.style.opacity = '1';

            // Restore the toggle button
            if (aiChatToggle) {
                aiChatToggle.style.display = 'flex';
                aiChatToggle.style.transform = 'scale(1)';
                aiChatToggle.style.opacity = '1';
            }
        }, 500);
    }
}

function addAIMessage(message, isUser = false) {
    const messageEl = document.createElement('div');
    messageEl.className = `ai-message ${isUser ? 'ai-user' : 'ai-assistant'}`;

    const avatar = isUser ? '<i class="fas fa-user ai-avatar"></i>' : '<i class="ph ph-chats-teardrop ai-avatar"></i>';

    // Add speech control button for AI messages
    const speechButton = !isUser ? 
        `<button class="speech-btn" onclick="speakWithRobotVoice('${message.replace(/'/g, "\\'")}')">
            <i class="fas fa-volume-up"></i>
        </button>` : '';

    messageEl.innerHTML = `
        <div class="ai-message-content">
            ${avatar}
            <div class="ai-text">
                <p>${message.replace(/\n/g, '<br>')}</p>
            </div>
            ${speechButton}
        </div>
    `;

    aiMessages.appendChild(messageEl);
    aiMessages.scrollTop = aiMessages.scrollHeight;

    // Add animation
    messageEl.style.opacity = '0';
    messageEl.style.transform = 'translateY(20px)';

    requestAnimationFrame(() => {
        messageEl.style.transition = 'all 0.3s ease';
        messageEl.style.opacity = '1';
        messageEl.style.transform = 'translateY(0)';

        // Auto-speak AI messages with robot voice
        if (!isUser && message.trim()) {
            setTimeout(() => {
                speakWithRobotVoice(message);
            }, 500); // Small delay to let the message appear first
        }
    });
}

function showAITyping() {
    const typingEl = document.createElement('div');
    typingEl.className = 'ai-typing';
    typingEl.id = 'aiTyping';

    typingEl.innerHTML = `
        <i class="ph ph-chats-teardrop ai-avatar"></i>
        <span>AI is typing</span>
        <div class="ai-typing-dots">
            <div class="ai-typing-dot"></div>
            <div class="ai-typing-dot"></div>
            <div class="ai-typing-dot"></div>
        </div>
    `;

    aiMessages.appendChild(typingEl);
    aiMessages.scrollTop = aiMessages.scrollHeight;
}

function hideAITyping() {
    const typingEl = document.getElementById('aiTyping');
    if (typingEl) {
        typingEl.remove();
    }
}

async function sendAIMessage() {
    const message = aiMessageInput.value.trim();
    if (!message) return;

    // Add user message
    addAIMessage(message, true);
    aiMessageInput.value = '';

    // Show typing indicator
    showAITyping();
    aiSendBtn.disabled = true;

    try {
        // Add timeout for faster fallback
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Response timeout')), 8000) // 8 second timeout
        );

        // Race between API call and timeout
        const response = await Promise.race([
            getAIResponse(message),
            timeoutPromise
        ]);

        // Hide typing and show response
        hideAITyping();
        addAIMessage(response);
    } catch (error) {
        console.error('Error getting AI response:', error);
        hideAITyping();

        if (error.message === 'Response timeout') {
            addAIMessage("Response is taking longer than expected. Here's a quick answer: " + getFallbackResponse());
        } else {
            addAIMessage("I'm sorry, I'm having trouble responding right now. Please try again.");
        }
    }

    aiSendBtn.disabled = false;
    aiMessageInput.focus();
}

// Event listeners for AI chat
quickAiInput.addEventListener('click', (e) => {
    e.stopPropagation();
    // Just focus the input, don't open the chatbox
    quickAiInput.focus();
});

quickAiSend.addEventListener('click', sendQuickAIMessage);

quickAiInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendQuickAIMessage();
    }
});

aiMinimizeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    minimizeAIChat(e);
});
aiCloseBtn.addEventListener('click', closeAIChat);
aiSendBtn.addEventListener('click', sendAIMessage);

aiMessageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendAIMessage();
    }
});

// Click outside to close (optional)
document.addEventListener('click', (e) => {
    if (aiChatOpen && !aiChatbox.contains(e.target) && !aiChatToggle.contains(e.target)) {
        // Uncomment the line below if you want click-outside-to-close functionality
        // closeAIChat();
    }
});

// Make chatbox draggable (simple version)
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

aiChatHeader.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = aiChatbox.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    aiChatHeader.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const x = e.clientX - dragOffset.x;
        const y = e.clientY - dragOffset.y;

        // Keep within viewport bounds
        const maxX = window.innerWidth - aiChatbox.offsetWidth;
        const maxY = window.innerHeight - aiChatbox.offsetHeight;

        const boundedX = Math.max(0, Math.min(x, maxX));
        const boundedY = Math.max(0, Math.min(y, maxY));

        aiChatbox.style.left = boundedX + 'px';
        aiChatbox.style.top = boundedY + 'px';
        aiChatbox.style.right = 'auto';
        aiChatbox.style.bottom = 'auto';
    }
});

document.addEventListener('mouseup', () => {
    isDragging = false;
    aiChatHeader.style.cursor = 'move';
});



// Initialize robot voice
initializeRobotVoice();

// Make speech functions globally available
window.speakWithRobotVoice = speakWithRobotVoice;
window.stopRobotSpeech = stopRobotSpeech;

// Check for existing session on page load
checkExistingSession();
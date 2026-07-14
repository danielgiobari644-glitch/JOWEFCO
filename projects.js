// ==================== FIREBASE CONFIGURATION ====================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getFirestore, collection, getDocs, addDoc, doc, getDoc, setDoc, Timestamp, query, orderBy, onSnapshot, where, updateDoc } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyB0KdLj5TnV_9k0jWFz_-2kHSAYHyG8dq0",
    authDomain: "jowefco.firebaseapp.com",
    projectId: "jowefco",
    storageBucket: "jowefco.firebasestorage.app",
    messagingSenderId: "698975205460",
    appId: "1:698975205460:web:1e7539da1fc748932115c1",
    measurementId: "G-5NE7NQQBQE"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentUser = null;
let currentProjectChat = null;
let projectChatListener = null;
let selectedProjectType = '';
let selectedProjectTypeName = '';

// SVG icons for project types
const projectIcons = {
    welding: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    fabrication: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    gates: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16M3 21h18M9 7v6M15 7v6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    structures: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 22h20M3 22V7l9-5 9 5v15M9 22v-5h6v5M9 11h.01M15 11h.01" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    furniture: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18v-6a9 9 0 0118 0v6M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    custom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4.5L6 21l1.5-7.5L2 9h7z" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

// ==================== UTILITY FUNCTIONS ====================
function getUserFromStorage() {
    const userId = localStorage.getItem('jowefco_user_id');
    const userName = localStorage.getItem('jowefco_user_name');
    const userPhone = localStorage.getItem('jowefco_user_phone');
    if (userId && userName && userPhone) {
        return { id: userId, name: userName, phone: userPhone };
    }
    return null;
}

function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function saveUserToStorage(user) {
    localStorage.setItem('jowefco_user_id', user.id);
    localStorage.setItem('jowefco_user_name', user.name);
    localStorage.setItem('jowefco_user_phone', user.phone);
}

async function registerUserInFirestore(user) {
    try {
        await setDoc(doc(db, 'users', user.id), {
            id: user.id,
            name: user.name,
            phone: user.phone,
            createdAt: Timestamp.now(),
            lastVisit: Timestamp.now()
        }, { merge: true });
    } catch (error) {
        console.error('Error registering user:', error);
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 3500);
}

function showLoading(show = true) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-NG', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function playNotificationSound() {
    const audio = document.getElementById('notificationSound');
    if (audio) {
        audio.volume = 1.0;
        audio.play().catch(e => console.error('Error playing sound:', e));
    }
}

// ==================== NAVIGATION ====================
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');
const navbar = document.getElementById('navbar');

if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
    });
}

window.addEventListener('scroll', () => {
    if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 30);
});

// ==================== PROJECT TYPE SELECTION ====================
window.selectProjectType = function (type, typeName) {
    if (!currentUser) {
        showToast('Please wait while we set up your profile...', 'info');
        return;
    }
    selectedProjectType = type;
    selectedProjectTypeName = typeName;
    showBookingModal();
};

function showBookingModal() {
    const modal = document.getElementById('projectBookingModal');
    const iconContainer = document.getElementById('bookingIcon');
    if (iconContainer) iconContainer.innerHTML = projectIcons[selectedProjectType] || projectIcons.custom;
    document.getElementById('bookingTitle').textContent = `${selectedProjectTypeName} Project`;
    document.getElementById('projectType').value = selectedProjectType;
    document.getElementById('projectCustomerName').value = currentUser.name;
    document.getElementById('projectCustomerPhone').value = currentUser.phone;
    modal.classList.add('active');

    modal.querySelector('.modal-close').onclick = () => modal.classList.remove('active');
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
}

// ==================== SUBMIT PROJECT BOOKING ====================
document.getElementById('projectBookingForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const projectData = {
        userId: currentUser.id,
        customerName: document.getElementById('projectCustomerName').value.trim(),
        customerPhone: document.getElementById('projectCustomerPhone').value.trim(),
        projectType: selectedProjectType,
        projectTypeName: selectedProjectTypeName,
        location: document.getElementById('projectLocation').value.trim(),
        title: document.getElementById('projectTitle').value.trim(),
        description: document.getElementById('projectDescription').value.trim(),
        budget: document.getElementById('projectBudget').value || null,
        timeline: document.getElementById('projectTimeline').value,
        hasDrawing: document.getElementById('projectHasDrawing').checked,
        status: 'pending',
        createdAt: Timestamp.now()
    };

    try {
        showLoading(true);
        const projectRef = await addDoc(collection(db, 'projectBookings'), projectData);

        const chatId = `project_${projectRef.id}`;
        await setDoc(doc(db, 'projectChats', chatId), {
            userId: currentUser.id,
            userName: currentUser.name,
            userPhone: currentUser.phone,
            projectId: projectRef.id,
            projectType: selectedProjectType,
            projectTitle: projectData.title,
            status: 'active',
            lastMessage: 'Project inquiry submitted',
            lastMessageTime: Timestamp.now(),
            unreadAdmin: 1,
            unreadUser: 0,
            createdAt: Timestamp.now()
        });

        await addDoc(collection(db, 'projectChats', chatId, 'messages'), {
            sender: 'user',
            message: `Project Inquiry: ${selectedProjectTypeName}. Details: ${projectData.description}`,
            timestamp: Timestamp.now()
        });

        showLoading(false);
        document.getElementById('projectBookingModal').classList.remove('active');
        document.getElementById('projectBookingForm').reset();
        showToast('Project request sent successfully! We will contact you soon.', 'success');

        await loadMyProjects();
    } catch (error) {
        showLoading(false);
        console.error('Error booking project:', error);
        showToast('Could not send request. Please try again.', 'error');
    }
});

// ==================== LOAD USER PROJECTS ====================
async function loadMyProjects() {
    const projectsList = document.getElementById('myProjectsList');
    if (!projectsList) return;

    if (!currentUser) {
        projectsList.innerHTML = '<div class="loading-message">Please complete your profile to view your projects.</div>';
        return;
    }

    projectsList.innerHTML = '<div class="loading-message">Loading your projects...</div>';

    try {
        const projectsQuery = query(
            collection(db, 'projectBookings'),
            where('userId', '==', currentUser.id)
        );
        const projectsSnapshot = await getDocs(projectsQuery);

        if (projectsSnapshot.empty) {
            projectsList.innerHTML = `
                <div class="no-projects">
                    <div class="no-projects-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2v6h6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </div>
                    <h3>No Projects Yet</h3>
                    <p>Choose a service above to start your first project with us.</p>
                </div>
            `;
            return;
        }

        const projects = [];
        projectsSnapshot.forEach((doc) => {
            const project = { ...doc.data(), id: doc.id };
            projects.push(project);
        });
        projects.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
        });

        projectsList.innerHTML = '';
        projects.forEach((project, index) => {
            const card = createProjectCard(project);
            card.style.animationDelay = `${index * 0.1}s`;
            projectsList.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading projects:', error);
        projectsList.innerHTML = '<div class="loading-message">Could not load your projects. Please try again later.</div>';
    }
}

function createProjectCard(project) {
    const div = document.createElement('div');
    div.className = 'my-project-card';
    div.style.animation = 'fadeInUp 0.6s ease-out backwards';

    const statusClass = {
        'pending': 'status-pending',
        'in-progress': 'status-progress',
        'completed': 'status-completed',
        'cancelled': 'status-cancelled'
    }[project.status] || 'status-pending';

    const statusLabel = {
        'pending': 'Pending',
        'in-progress': 'In Progress',
        'completed': 'Completed',
        'cancelled': 'Cancelled'
    }[project.status] || 'Pending';

    div.innerHTML = `
        <div class="project-card-header">
            <div class="project-card-icon">${projectIcons[project.projectType] || projectIcons.custom}</div>
            <div class="project-card-info">
                <h3>${project.title}</h3>
                <p class="project-type-label">${project.projectTypeName}</p>
            </div>
            <span class="project-status ${statusClass}">${statusLabel}</span>
        </div>
        <p class="project-card-description">${project.description}</p>
        <div class="project-card-meta">
            <span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="10" r="3"/></svg>
                ${project.location}
            </span>
            <span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6" stroke-linecap="round"/><line x1="8" y1="2" x2="8" y2="6" stroke-linecap="round"/><line x1="3" y1="10" x2="21" y2="10" stroke-linecap="round"/></svg>
                ${formatDate(project.createdAt)}
            </span>
            ${project.budget ? `<span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23" stroke-linecap="round"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                ₦${parseFloat(project.budget).toLocaleString()}
            </span>` : ''}
        </div>
        <button class="btn btn-primary btn-full" onclick="openProjectChat('${project.id}', '${project.projectType}', '${project.title.replace(/'/g, "\\'")}')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Chat with Us
        </button>
    `;
    return div;
}

// ==================== PROJECT CHAT ====================
window.openProjectChat = async function (projectId, projectType, projectTitle) {
    const chatId = `project_${projectId}`;
    currentProjectChat = chatId;

    const modal = document.getElementById('projectChatModal');
    const iconEl = document.getElementById('chatProjectIcon');
    if (iconEl) iconEl.innerHTML = projectIcons[projectType] || projectIcons.custom;
    document.getElementById('chatProjectTitle').textContent = projectTitle;

    const projectDoc = await getDoc(doc(db, 'projectBookings', projectId));
    if (projectDoc.exists()) {
        const project = projectDoc.data();
        const statusText = {
            'pending': 'Pending Review',
            'in-progress': 'In Progress',
            'completed': 'Completed',
            'cancelled': 'Cancelled'
        }[project.status] || 'Pending';
        document.getElementById('chatProjectStatus').textContent = statusText;
    }

    loadProjectChatMessages();
    modal.classList.add('active');

    modal.querySelector('.modal-close').onclick = () => {
        modal.classList.remove('active');
        if (projectChatListener) projectChatListener();
        currentProjectChat = null;
    };
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            if (projectChatListener) projectChatListener();
            currentProjectChat = null;
        }
    };
};

function loadProjectChatMessages() {
    const messagesContainer = document.getElementById('projectChatMessages');
    messagesContainer.innerHTML = '<div class="chat-date-divider">Messages</div>';

    if (projectChatListener) projectChatListener();

    projectChatListener = onSnapshot(
        query(collection(db, 'projectChats', currentProjectChat, 'messages'), orderBy('timestamp', 'asc')),
        (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const message = change.doc.data();
                    messagesContainer.appendChild(createMessageElement(message));
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    if (message.sender === 'admin') playNotificationSound();
                }
            });
            updateDoc(doc(db, 'projectChats', currentProjectChat), { unreadUser: 0 }).catch(() => {});
        }
    );
}

function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = `chat-message ${message.sender === 'user' ? 'sent' : 'received'}`;
    const time = message.timestamp ? message.timestamp.toDate().toLocaleTimeString('en-NG', {
        hour: '2-digit', minute: '2-digit'
    }) : '';
    div.innerHTML = `
        <div class="message-bubble">
            ${message.message}
            <div class="message-time">${time}</div>
        </div>
    `;
    return div;
}

document.getElementById('projectChatForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('projectChatInput');
    const message = input.value.trim();
    if (!message || !currentProjectChat) return;

    try {
        await addDoc(collection(db, 'projectChats', currentProjectChat, 'messages'), {
            sender: 'user',
            message: message,
            timestamp: Timestamp.now()
        });
        await updateDoc(doc(db, 'projectChats', currentProjectChat), {
            lastMessage: message,
            lastMessageTime: Timestamp.now(),
            unreadAdmin: 1
        });
        input.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Could not send message. Please try again.', 'error');
    }
});

document.querySelectorAll('.quick-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.getElementById('projectChatInput').value = btn.dataset.message;
        document.getElementById('projectChatForm').dispatchEvent(new Event('submit'));
    });
});

// ==================== USER REGISTRATION ====================
async function checkAndRegisterUser() {
    currentUser = getUserFromStorage();

    if (!currentUser) {
        // Redirect to home for registration
        const name = prompt('Welcome to JOWEFCO! Please enter your full name:');
        if (!name) {
            showToast('Please enter your name to continue', 'info');
            return;
        }
        const phone = prompt('Please enter your phone number:');
        if (!phone) {
            showToast('Please enter your phone number to continue', 'info');
            return;
        }
        const userId = generateUserId();
        currentUser = { id: userId, name: name.trim(), phone: phone.trim() };
        saveUserToStorage(currentUser);
        await registerUserInFirestore(currentUser);
        showToast('Welcome to JOWEFCO!', 'success');
    }
}

// ==================== REVEAL ANIMATIONS ====================
function initReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('active');
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ==================== LOAD CONTACT & SOCIAL FOR FOOTER ====================
async function loadFooterInfo() {
    try {
        const contactDoc = await getDoc(doc(db, 'settings', 'contact'));
        const footerContact = document.getElementById('footerContact');
        if (contactDoc.exists() && footerContact) {
            const data = contactDoc.data();
            const items = footerContact.querySelectorAll('li');
            if (items[0]) items[0].querySelector('span').textContent = data.phone || 'Not available';
            if (items[1]) items[1].querySelector('span').textContent = data.email || 'Not available';
            if (items[2]) items[2].querySelector('span').textContent = data.address || 'Not available';
        }

        // Social links
        const socialDoc = await getDoc(doc(db, 'settings', 'social'));
        const footerSocial = document.getElementById('footerSocial');
        if (footerSocial) {
            const links = socialDoc.exists() ? socialDoc.data() : {};
            const SOCIAL_ICONS = {
                facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
                instagram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
                twitter: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
                linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
                youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
                tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>'
            };
            footerSocial.innerHTML = '';
            const platforms = ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok'];
            platforms.forEach(platform => {
                const url = links[platform];
                if (url && url.trim()) {
                    const a = document.createElement('a');
                    a.href = url;
                    a.className = 'social-link';
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    a.setAttribute('aria-label', `${platform} link`);
                    a.innerHTML = SOCIAL_ICONS[platform];
                    footerSocial.appendChild(a);
                }
            });
        }
    } catch (error) {
        console.error('Error loading footer info:', error);
    }
}

// ==================== INITIALIZATION ====================
async function init() {
    await checkAndRegisterUser();
    await loadMyProjects();
    await loadFooterInfo();
    initReveal();
}

init();

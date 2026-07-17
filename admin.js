// ==================== FIREBASE CONFIGURATION ====================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getFirestore, collection, getDocs, addDoc, doc, getDoc, setDoc, updateDoc, deleteDoc, Timestamp, query, orderBy, where, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';
import { getAuth, signInWithEmailAndPassword, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';

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
const auth = getAuth(app);

let currentTab = 'dashboard';
let projectBookingsListener = null;
let projectChatsListener = null;
let ordersListener = null;
let currentProjectFilter = 'all';
let currentOrdersFilter = 'all';
let currentTestimonialsFilter = 'pending';
let currentProjectChatId = null;

// ==================== UTILITY FUNCTIONS ====================
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 3500);
}

function showLoading(show = true) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-NG', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function formatPrice(amount, symbol = '₦') {
    const num = parseFloat(amount) || 0;
    return `${symbol}${num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function playNotificationSound() {
    const audio = document.getElementById('notificationSound');
    if (audio) {
        audio.volume = 1.0;
        audio.play().catch(e => console.error('Error playing sound:', e));
    }
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

// ==================== AUTHENTICATION ====================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
        showLoading(true);
        await signInWithEmailAndPassword(auth, email, password);
        showToast('Welcome back!', 'success');
    } catch (error) {
        document.getElementById('loginError').textContent = 'Invalid email or password.';
    } finally {
        showLoading(false);
    }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await signOut(auth);
        showToast('Signed out successfully', 'success');
    } catch (error) {
        showToast('Could not sign out', 'error');
    }
});

document.getElementById('viewSiteBtn').addEventListener('click', () => window.open('index.html', '_blank'));

auth.onAuthStateChanged((user) => {
    if (user) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'block';
        initializeDashboard();
    } else {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('adminDashboard').style.display = 'none';
        if (projectBookingsListener) { projectBookingsListener(); projectBookingsListener = null; }
        if (projectChatsListener) { projectChatsListener(); projectChatsListener = null; }
        if (ordersListener) { ordersListener(); ordersListener = null; }
    }
});

// ==================== TAB NAVIGATION ====================
document.querySelectorAll('.admin-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Mobile sidebar toggle
const adminSidebarToggle = document.getElementById('adminSidebarToggle');
const adminSidebar = document.getElementById('adminSidebar');
const adminOverlay = document.getElementById('adminOverlay');

if (adminSidebarToggle) {
    adminSidebarToggle.addEventListener('click', () => {
        adminSidebar.classList.add('active');
        adminOverlay.classList.add('active');
    });
}
if (adminOverlay) {
    adminOverlay.addEventListener('click', () => {
        adminSidebar.classList.remove('active');
        adminOverlay.classList.remove('active');
    });
}

function switchTab(tabName) {
    currentTab = tabName;
    document.querySelectorAll('.admin-nav-btn').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.tab === tabName));
    document.querySelectorAll('.admin-tab').forEach(tab =>
        tab.classList.toggle('active', tab.id === tabName + 'Tab'));

    // Close mobile sidebar
    if (adminSidebar) adminSidebar.classList.remove('active');
    if (adminOverlay) adminOverlay.classList.remove('active');

    loadTabContent(tabName);
}

async function loadTabContent(tabName) {
    switch (tabName) {
        case 'dashboard': await loadDashboard(); break;
        case 'hero': await loadHeroSettings(); break;
        case 'portfolio': await loadPortfolioManagement(); break;
        case 'shop': await loadShopManagement(); break;
        case 'orders': await loadOrdersManagement(); break;
        case 'projects': await loadProjectsManagement(); break;
        case 'users': await loadUsersManagement(); break;
        case 'testimonials': await loadTestimonialsManagement(); break;
        case 'contact': await loadContactSettings(); break;
        case 'social': await loadSocialSettings(); break;
        case 'payments': await loadPaymentSettings(); break;
        case 'settings': await loadSettings(); break;
    }
}

// ==================== DASHBOARD ====================
async function loadDashboard() {
    try {
        const [projectsSnap, portfolioSnap, usersSnap, ordersSnap, productsSnap, testimonialsSnap] = await Promise.all([
            getDocs(collection(db, 'projectBookings')),
            getDocs(collection(db, 'portfolio')),
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'shopOrders')),
            getDocs(collection(db, 'shopItems')),
            getDocs(query(collection(db, 'testimonials'), where('approved', '==', false)))
        ]);

        setText('totalProjects', projectsSnap.size || 0);
        setText('totalOrders', ordersSnap.size || 0);
        setText('totalPortfolio', portfolioSnap.size || 0);
        setText('totalProducts', productsSnap.size || 0);
        setText('totalUsers', usersSnap.size || 0);
        setText('pendingReviews', testimonialsSnap.size || 0);
        setText('testimonialsBadge', testimonialsSnap.size || 0);
        setText('ordersBadge', ordersSnap.size || 0);

        // Recent activity
        const activityList = document.getElementById('recentActivityList');
        if (activityList) {
            const activities = [];

            projectsSnap.forEach(d => {
                const p = d.data();
                activities.push({
                    icon: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2v6h6" stroke-linecap="round" stroke-linejoin="round"/>',
                    text: `New project inquiry: ${escapeHtml(p.title || 'Untitled')}`,
                    time: p.createdAt
                });
            });
            ordersSnap.forEach(d => {
                const o = d.data();
                activities.push({
                    icon: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6" stroke-linecap="round" stroke-linejoin="round"/>',
                    text: `New order: ${escapeHtml(o.productName || 'Product')} (${formatPrice(o.amount)})`,
                    time: o.createdAt
                });
            });
            testimonialsSnap.forEach(d => {
                const t = d.data();
                activities.push({
                    icon: '<path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4.5L6 21l1.5-7.5L2 9h7z" stroke-linecap="round" stroke-linejoin="round"/>',
                    text: `New review from ${escapeHtml(t.name || 'Customer')}`,
                    time: t.createdAt
                });
            });

            activities.sort((a, b) => {
                const ta = a.time?.toMillis ? a.time.toMillis() : 0;
                const tb = b.time?.toMillis ? b.time.toMillis() : 0;
                return tb - ta;
            });

            if (activities.length === 0) {
                activityList.innerHTML = '<p style="color: var(--text-tertiary); text-align: center; padding: 1rem;">No recent activity</p>';
            } else {
                activityList.innerHTML = activities.slice(0, 8).map(a => `
                    <div class="activity-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${a.icon}</svg>
                        <span>${a.text}</span>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// ==================== HERO SETTINGS ====================
async function loadHeroSettings() {
    try {
        const heroDoc = await getDoc(doc(db, 'settings', 'hero'));
        if (heroDoc.exists()) {
            const data = heroDoc.data();
            const titleInput = document.getElementById('heroTitleInput');
            const descInput = document.getElementById('heroDescriptionInput');
            if (titleInput) titleInput.value = data.title || '';
            if (descInput) descInput.value = data.description || '';
            displayHeroMediaList(data.media || []);
        }
    } catch (error) {
        console.error('Error loading hero settings:', error);
    }
}

function displayHeroMediaList(media) {
    const list = document.getElementById('heroMediaList');
    if (!list) return;
    list.innerHTML = media.length === 0
        ? '<p style="color: var(--text-tertiary); text-align:center; padding:1rem;">No media added yet.</p>'
        : '';

    media.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'hero-media-item';

        let previewHtml = item.type === 'video'
            ? `<video src="${item.url}" muted></video>`
            : `<img src="${item.url}" alt="Media ${index + 1}">`;

        div.innerHTML = `
            ${previewHtml}
            <div class="hero-media-info">
                <p style="font-weight: 600; color: var(--primary-color); margin: 0 0 0.25rem;">${item.type.toUpperCase()} ${index + 1}</p>
                <p style="word-break: break-all;">${escapeHtml(item.url)}</p>
            </div>
            <button class="btn-delete" onclick="deleteHeroMedia(${index})">Remove</button>
        `;
        list.appendChild(div);
    });
}

document.getElementById('previewMediaBtn')?.addEventListener('click', () => {
    const mediaType = document.getElementById('heroMediaType').value;
    const mediaUrl = document.getElementById('heroMediaUrl').value.trim();
    const preview = document.getElementById('heroMediaPreview');
    if (!mediaUrl) return;
    preview.innerHTML = mediaType === 'video'
        ? `<video src="${mediaUrl}" controls muted></video>`
        : `<img src="${mediaUrl}" alt="Preview">`;
});

document.getElementById('heroForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('heroTitleInput').value.trim();
    const description = document.getElementById('heroDescriptionInput').value.trim();

    try {
        showLoading(true);
        const heroDoc = await getDoc(doc(db, 'settings', 'hero'));
        const currentData = heroDoc.exists() ? heroDoc.data() : {};
        await setDoc(doc(db, 'settings', 'hero'), { ...currentData, title, description, updatedAt: Timestamp.now() });
        showToast('Hero text saved', 'success');
    } catch (error) {
        showToast('Could not save changes', 'error');
    } finally {
        showLoading(false);
    }
});

document.getElementById('heroMediaForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('heroMediaType').value;
    const url = document.getElementById('heroMediaUrl').value.trim();

    try {
        showLoading(true);
        const heroDoc = await getDoc(doc(db, 'settings', 'hero'));
        const currentData = heroDoc.exists() ? heroDoc.data() : { title: '', description: '' };
        const media = currentData.media || [];
        media.push({ type, url, addedAt: Date.now() });
        await setDoc(doc(db, 'settings', 'hero'), { ...currentData, media, updatedAt: Timestamp.now() });
        showToast('Media added successfully', 'success');
        document.getElementById('heroMediaForm').reset();
        document.getElementById('heroMediaPreview').innerHTML = '';
        displayHeroMediaList(media);
    } catch (error) {
        showToast('Could not add media', 'error');
    } finally {
        showLoading(false);
    }
});

window.deleteHeroMedia = async function (index) {
    if (!confirm('Remove this media?')) return;
    try {
        showLoading(true);
        const heroDoc = await getDoc(doc(db, 'settings', 'hero'));
        const data = heroDoc.data();
        const media = data.media || [];
        media.splice(index, 1);
        await setDoc(doc(db, 'settings', 'hero'), { ...data, media, updatedAt: Timestamp.now() });
        showToast('Media removed', 'success');
        displayHeroMediaList(media);
    } catch (error) {
        showToast('Could not remove media', 'error');
    } finally {
        showLoading(false);
    }
};

// ==================== PORTFOLIO MANAGEMENT ====================
async function loadPortfolioManagement() {
    try {
        const portfolioSnapshot = await getDocs(collection(db, 'portfolio'));
        const list = document.getElementById('portfolioList');
        if (!list) return;
        list.innerHTML = portfolioSnapshot.empty
            ? '<p style="text-align: center; color: var(--text-tertiary); grid-column: 1/-1;">No portfolio items yet.</p>'
            : '';

        const items = [];
        portfolioSnapshot.forEach(docSnap => {
            items.push({ ...docSnap.data(), id: docSnap.id });
        });
        items.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
        items.forEach(item => list.appendChild(createPortfolioItemCard(item)));
    } catch (error) {
        console.error('Error loading portfolio:', error);
    }
}

document.getElementById('previewPortfolioBtn')?.addEventListener('click', () => {
    const type = document.getElementById('portfolioMediaType').value;
    const url = document.getElementById('portfolioMediaUrl').value.trim();
    const preview = document.getElementById('portfolioMediaPreview');
    if (!url) return;
    preview.innerHTML = type === 'video'
        ? `<video src="${url}" controls muted></video>`
        : `<img src="${url}" alt="Preview">`;
});

document.getElementById('portfolioForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('portfolioTitle').value.trim();
    const description = document.getElementById('portfolioDescription').value.trim();
    const category = document.getElementById('portfolioCategory').value;
    const mediaType = document.getElementById('portfolioMediaType').value;
    const media = document.getElementById('portfolioMediaUrl').value.trim();

    try {
        showLoading(true);
        await addDoc(collection(db, 'portfolio'), { title, description, category, mediaType, media, createdAt: Timestamp.now() });
        showToast('Portfolio item added', 'success');
        document.getElementById('portfolioForm').reset();
        document.getElementById('portfolioMediaPreview').innerHTML = '';
        await loadPortfolioManagement();
    } catch (error) {
        showToast('Could not add portfolio item', 'error');
    } finally {
        showLoading(false);
    }
});

function createPortfolioItemCard(item) {
    const div = document.createElement('div');
    div.className = 'item-card';
    const mediaHtml = item.mediaType === 'video'
        ? `<video class="item-card-media" src="${item.media}" muted></video>`
        : `<img class="item-card-media" src="${item.media}" alt="${escapeHtml(item.title)}">`;

    div.innerHTML = `
        ${mediaHtml}
        <div class="item-card-content">
            <h4 class="item-card-title">${escapeHtml(item.title)}</h4>
            <p class="item-card-description">${escapeHtml(item.description)}</p>
            <div class="item-card-meta">${escapeHtml(item.category || 'General')}</div>
            <div class="item-card-actions">
                <button class="btn-delete" onclick="deletePortfolioItem('${item.id}')">Remove</button>
            </div>
        </div>
    `;
    return div;
}

window.deletePortfolioItem = async function (id) {
    if (!confirm('Remove this portfolio item?')) return;
    try {
        showLoading(true);
        await deleteDoc(doc(db, 'portfolio', id));
        showToast('Item removed', 'success');
        await loadPortfolioManagement();
    } catch (error) {
        showToast('Could not remove item', 'error');
    } finally {
        showLoading(false);
    }
};

// ==================== SHOP MANAGEMENT ====================
async function loadShopManagement() {
    try {
        const snapshot = await getDocs(collection(db, 'shopItems'));
        const list = document.getElementById('productsList');
        if (!list) return;
        list.innerHTML = snapshot.empty
            ? '<p style="text-align: center; color: var(--text-tertiary); grid-column: 1/-1;">No products added yet.</p>'
            : '';

        const items = [];
        snapshot.forEach(docSnap => items.push({ ...docSnap.data(), id: docSnap.id }));
        items.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
        items.forEach(item => list.appendChild(createProductCard(item)));
    } catch (error) {
        console.error('Error loading shop items:', error);
    }
}

document.getElementById('previewProductBtn')?.addEventListener('click', () => {
    const type = document.getElementById('productMediaType').value;
    const url = document.getElementById('productMediaUrl').value.trim();
    const preview = document.getElementById('productMediaPreview');
    if (!url) return;
    preview.innerHTML = type === 'video'
        ? `<video src="${url}" controls muted></video>`
        : `<img src="${url}" alt="Preview">`;
});

document.getElementById('productForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('productName').value.trim();
    const description = document.getElementById('productDescription').value.trim();
    const priceMin = parseFloat(document.getElementById('productPriceMin').value);
    const priceMax = parseFloat(document.getElementById('productPriceMax').value);
    const category = document.getElementById('productCategory').value.trim();
    const mediaType = document.getElementById('productMediaType').value;
    const mediaUrl = document.getElementById('productMediaUrl').value.trim();

    if (priceMin > priceMax) {
        showToast('Minimum price cannot be higher than maximum', 'error');
        return;
    }

    try {
        showLoading(true);
        await addDoc(collection(db, 'shopItems'), {
            name,
            description,
            priceMin,
            priceMax,
            category: category || null,
            mediaType,
            media: mediaUrl,
            createdAt: Timestamp.now()
        });
        showToast('Product added successfully', 'success');
        document.getElementById('productForm').reset();
        document.getElementById('productMediaPreview').innerHTML = '';
        await loadShopManagement();
    } catch (error) {
        showToast('Could not add product', 'error');
    } finally {
        showLoading(false);
    }
});

function createProductCard(item) {
    const div = document.createElement('div');
    div.className = 'item-card';
    const mediaHtml = item.mediaType === 'video'
        ? `<video class="item-card-media" src="${item.media}" muted></video>`
        : `<img class="item-card-media" src="${item.media}" alt="${escapeHtml(item.name)}">`;

    const priceText = (item.priceMin === item.priceMax)
        ? formatPrice(item.priceMax)
        : `${formatPrice(item.priceMin)} - ${formatPrice(item.priceMax)}`;

    div.innerHTML = `
        ${mediaHtml}
        <div class="item-card-content">
            <h4 class="item-card-title">${escapeHtml(item.name)}</h4>
            <p class="item-card-description">${escapeHtml(item.description)}</p>
            <div class="item-card-meta">${priceText}</div>
            ${item.category ? `<div style="font-size: 0.7rem; color: var(--text-tertiary); margin-bottom: 0.5rem;">${escapeHtml(item.category)}</div>` : ''}
            <div class="item-card-actions">
                <button class="btn-delete" onclick="deleteProduct('${item.id}')">Remove</button>
            </div>
        </div>
    `;
    return div;
}

window.deleteProduct = async function (id) {
    if (!confirm('Remove this product?')) return;
    try {
        showLoading(true);
        await deleteDoc(doc(db, 'shopItems', id));
        showToast('Product removed', 'success');
        await loadShopManagement();
    } catch (error) {
        showToast('Could not remove product', 'error');
    } finally {
        showLoading(false);
    }
};

// ==================== ORDERS MANAGEMENT ====================
async function loadOrdersManagement() {
    if (ordersListener) { ordersListener(); ordersListener = null; }

    ordersListener = onSnapshot(collection(db, 'shopOrders'), async () => {
        await displayOrders(currentOrdersFilter);
    });

    // Setup filter buttons
    document.querySelectorAll('.orders-filter .filter-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.orders-filter .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentOrdersFilter = btn.dataset.status;
            displayOrders(currentOrdersFilter);
        };
    });
}

async function displayOrders(filter = 'all') {
    try {
        let q = collection(db, 'shopOrders');
        if (filter !== 'all') {
            q = query(q, where('orderStatus', '==', filter));
        }
        const snapshot = await getDocs(q);
        const list = document.getElementById('ordersList');
        if (!list) return;
        list.innerHTML = snapshot.empty
            ? '<p style="text-align: center; color: var(--text-tertiary); padding: 1rem;">No orders found.</p>'
            : '';

        const orders = [];
        snapshot.forEach(docSnap => orders.push({ ...docSnap.data(), id: docSnap.id }));
        orders.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
        orders.forEach(order => list.appendChild(createOrderCard(order)));
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

function createOrderCard(order) {
    const div = document.createElement('div');
    div.className = 'order-card';
    div.style.animation = 'fadeInUp 0.4s ease-out backwards';

    const statusLabel = {
        'pending': 'Pending',
        'completed': 'Completed',
        'cancelled': 'Cancelled'
    }[order.orderStatus] || 'Pending';

    const paymentLabel = order.paymentStatus === 'paid' ? 'Paid' : 'Unpaid';

    div.innerHTML = `
        <div class="order-header">
            <div>
                <p class="order-id">${escapeHtml(order.productName)}</p>
                <p class="order-details"><strong>Customer:</strong> ${escapeHtml(order.customerName)} (${escapeHtml(order.customerPhone)})</p>
                ${order.customerEmail ? `<p class="order-details"><strong>Email:</strong> ${escapeHtml(order.customerEmail)}</p>` : ''}
            </div>
            <span class="order-status ${order.orderStatus}">${statusLabel}</span>
        </div>
        <p class="order-details"><strong>Amount:</strong> ${formatPrice(order.amount, order.currency === 'NGN' ? '₦' : '$')}</p>
        <p class="order-details"><strong>Payment:</strong> ${escapeHtml(order.paymentMethod)} - ${paymentLabel}</p>
        <p class="order-details"><strong>Reference:</strong> ${escapeHtml(order.paymentRef || 'N/A')}</p>
        <p class="order-details"><strong>Date:</strong> ${formatDate(order.createdAt)}</p>
        <div class="order-actions">
            ${order.orderStatus === 'pending' ? `<button class="btn btn-success btn-sm" onclick="updateOrderStatus('${order.id}', 'completed')">Mark Completed</button>` : ''}
            ${order.orderStatus !== 'cancelled' && order.orderStatus !== 'completed' ? `<button class="btn btn-danger btn-sm" onclick="updateOrderStatus('${order.id}', 'cancelled')">Cancel</button>` : ''}
            ${order.orderStatus === 'cancelled' || order.orderStatus === 'completed' ? `<button class="btn btn-secondary btn-sm" onclick="updateOrderStatus('${order.id}', 'pending')">Reopen</button>` : ''}
        </div>
    `;
    return div;
}

window.updateOrderStatus = async function (id, status) {
    try {
        showLoading(true);
        await updateDoc(doc(db, 'shopOrders', id), { orderStatus: status, updatedAt: Timestamp.now() });
        showToast(`Order marked as ${status}`, 'success');
    } catch (error) {
        showToast('Could not update order', 'error');
    } finally {
        showLoading(false);
    }
};

// ==================== PROJECT INQUIRIES ====================
async function loadProjectsManagement() {
    if (projectBookingsListener) projectBookingsListener();
    projectBookingsListener = onSnapshot(collection(db, 'projectBookings'), async () => {
        await displayProjectBookings(currentProjectFilter);
    });

    if (projectChatsListener) projectChatsListener();
    projectChatsListener = onSnapshot(collection(db, 'projectChats'), (snapshot) => {
        const list = document.getElementById('projectChatsList');
        if (!list) return;
        list.innerHTML = snapshot.empty ? '<div class="no-chats">No active chats</div>' : '';

        const chats = [];
        snapshot.forEach(docSnap => chats.push({ ...docSnap.data(), id: docSnap.id }));
        chats.sort((a, b) => (b.lastMessageTime?.toMillis() || 0) - (a.lastMessageTime?.toMillis() || 0));

        chats.forEach(chat => {
            list.appendChild(createProjectChatItem(chat));
            if (chat.unreadAdmin > 0) playNotificationSound();
        });

        const unreadCount = chats.filter(c => c.unreadAdmin > 0).length;
        setText('projectsBadge', unreadCount);
    });

    document.querySelectorAll('.projects-filter .filter-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.projects-filter .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentProjectFilter = btn.dataset.status;
            displayProjectBookings(currentProjectFilter);
        };
    });
}

async function displayProjectBookings(filter = 'all') {
    try {
        let q = collection(db, 'projectBookings');
        if (filter !== 'all') q = query(q, where('status', '==', filter));
        const snapshot = await getDocs(q);
        const list = document.getElementById('projectBookingsList');
        if (!list) return;
        list.innerHTML = snapshot.empty
            ? '<p style="text-align: center; color: var(--text-tertiary); padding: 1rem;">No inquiries found.</p>'
            : '';

        const projects = [];
        snapshot.forEach(docSnap => projects.push({ ...docSnap.data(), id: docSnap.id }));
        projects.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        projects.forEach(project => list.appendChild(createProjectBookingCard(project)));
    } catch (error) {
        console.error('Error loading inquiries:', error);
    }
}

function createProjectBookingCard(project) {
    const div = document.createElement('div');
    div.className = 'order-card';
    div.style.animation = 'fadeInUp 0.4s ease-out backwards';

    const statusLabel = {
        'pending': 'Pending',
        'in-progress': 'In Progress',
        'completed': 'Completed',
        'cancelled': 'Archived'
    }[project.status] || 'Pending';

    div.innerHTML = `
        <div class="order-header">
            <div>
                <p class="order-id">${escapeHtml(project.title)}</p>
                <p class="order-details"><strong>Client:</strong> ${escapeHtml(project.customerName)} (${escapeHtml(project.customerPhone)})</p>
            </div>
            <span class="order-status ${project.status}">${statusLabel}</span>
        </div>
        <p class="order-details"><strong>Service:</strong> ${escapeHtml(project.projectTypeName)}</p>
        <p class="order-details"><strong>Details:</strong> ${escapeHtml(project.description)}</p>
        <p class="order-details"><strong>Location:</strong> ${escapeHtml(project.location)}</p>
        <p class="order-details"><strong>Timeline:</strong> ${escapeHtml(project.timeline)}</p>
        ${project.budget ? `<p class="order-details"><strong>Budget:</strong> ₦${parseFloat(project.budget).toLocaleString()}</p>` : ''}
        <p class="order-details"><strong>Date:</strong> ${formatDate(project.createdAt)}</p>
        <div class="order-actions">
            ${project.status === 'pending' ? `<button class="btn btn-primary btn-sm" onclick="updateProjectStatus('${project.id}', 'in-progress')">Start</button>` : ''}
            ${project.status === 'in-progress' ? `<button class="btn btn-success btn-sm" onclick="updateProjectStatus('${project.id}', 'completed')">Complete</button>` : ''}
            ${project.status !== 'cancelled' && project.status !== 'completed' ? `<button class="btn btn-danger btn-sm" onclick="updateProjectStatus('${project.id}', 'cancelled')">Archive</button>` : ''}
        </div>
    `;
    return div;
}

window.updateProjectStatus = async function (id, status) {
    try {
        showLoading(true);
        await updateDoc(doc(db, 'projectBookings', id), { status, updatedAt: Timestamp.now() });
        showToast(`Status updated to ${status}`, 'success');
    } catch (error) {
        showToast('Could not update status', 'error');
    } finally {
        showLoading(false);
    }
};

function createProjectChatItem(chat) {
    const div = document.createElement('div');
    div.className = `chat-item ${chat.unreadAdmin > 0 ? 'unread' : ''}`;
    div.onclick = () => openAdminProjectChat(chat.id);
    div.innerHTML = `
        <h4>${escapeHtml(chat.userName)}</h4>
        <p style="font-size: 0.8rem; color: var(--primary-color); margin: 0.25rem 0;">${escapeHtml(chat.projectTitle)}</p>
        <p style="font-size: 0.75rem; margin-top: 0.5rem; opacity: 0.7;">${escapeHtml(chat.lastMessage || '')}</p>
    `;
    return div;
}

async function openAdminProjectChat(chatId) {
    currentProjectChatId = chatId;
    const conversation = document.getElementById('projectChatConversation');
    const chatDoc = await getDoc(doc(db, 'projectChats', chatId));
    if (!chatDoc.exists()) return;
    const chat = chatDoc.data();

    conversation.innerHTML = `
        <div style="padding: 1.25rem; border-bottom: 1px solid var(--glass-border); background: var(--glass-bg);">
            <h3 style="margin: 0; font-size: 1.05rem;">${escapeHtml(chat.userName)}</h3>
            <p style="margin: 0.25rem 0 0; color: var(--primary-color); font-size: 0.85rem;">${escapeHtml(chat.projectTitle)}</p>
            <p style="margin: 0.25rem 0 0; color: var(--text-tertiary); font-size: 0.75rem;">${escapeHtml(chat.userPhone || '')}</p>
        </div>
        <div class="chat-messages" id="adminProjectChatMessages" style="flex: 1; overflow-y: auto; padding: 1.25rem; min-height: 320px; max-height: 400px;"></div>
        <div style="padding: 1rem; border-top: 1px solid var(--glass-border); background: var(--glass-bg);">
            <form id="adminProjectChatForm" style="display: flex; gap: 0.6rem;">
                <input type="text" id="adminProjectChatInput" placeholder="Type your reply..." style="flex: 1; padding: 0.85rem 1.1rem; background: var(--bg-primary); border: 1px solid var(--glass-border); border-radius: 24px; color: white;">
                <button type="submit" class="chat-send-btn" style="width: 44px; height: 44px; border-radius: 50%; background: var(--primary-gradient); color: var(--secondary-dark);">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
            </form>
        </div>
    `;

    loadAdminProjectChatMessages(chatId);
    await updateDoc(doc(db, 'projectChats', chatId), { unreadAdmin: 0 }).catch(() => {});

    document.getElementById('adminProjectChatForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('adminProjectChatInput');
        const message = input.value.trim();
        if (!message) return;

        try {
            await addDoc(collection(db, 'projectChats', chatId, 'messages'), {
                sender: 'admin',
                message,
                timestamp: Timestamp.now()
            });
            await updateDoc(doc(db, 'projectChats', chatId), {
                lastMessage: message,
                lastMessageTime: Timestamp.now(),
                unreadUser: 1
            });
            input.value = '';
        } catch (error) {
            showToast('Could not send message', 'error');
        }
    });
}

let adminChatMsgListener = null;
function loadAdminProjectChatMessages(chatId) {
    const container = document.getElementById('adminProjectChatMessages');
    if (!container) return;
    if (adminChatMsgListener) adminChatMsgListener();

    adminChatMsgListener = onSnapshot(
        query(collection(db, 'projectChats', chatId, 'messages'), orderBy('timestamp', 'asc')),
        (snapshot) => {
            container.innerHTML = '';
            snapshot.forEach(docSnap => {
                const msg = docSnap.data();
                const div = document.createElement('div');
                div.className = `chat-message ${msg.sender === 'admin' ? 'sent' : 'received'}`;
                const time = msg.timestamp ? msg.timestamp.toDate().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }) : '';
                div.innerHTML = `
                    <div class="message-bubble">
                        ${escapeHtml(msg.message)}
                        <div class="message-time">${time}</div>
                    </div>
                `;
                container.appendChild(div);
            });
            container.scrollTop = container.scrollHeight;
        }
    );
}

// ==================== USERS ====================
async function loadUsersManagement() {
    try {
        const snapshot = await getDocs(collection(db, 'users'));
        const list = document.getElementById('usersList');
        if (!list) return;
        list.innerHTML = snapshot.empty
            ? '<p style="text-align: center; color: var(--text-tertiary); padding: 1rem;">No users registered yet.</p>'
            : '';

        const users = [];
        snapshot.forEach(docSnap => users.push(docSnap.data()));
        users.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });

        users.forEach(user => {
            const div = document.createElement('div');
            div.className = 'user-card';
            div.innerHTML = `
                <div class="user-card-header">
                    <div class="user-avatar">${escapeHtml((user.name || 'U').charAt(0).toUpperCase())}</div>
                    <div class="user-info">
                        <h4>${escapeHtml(user.name || 'Unknown')}</h4>
                        <p>${escapeHtml(user.phone || 'No phone')}</p>
                    </div>
                </div>
                <p style="font-size: 0.75rem; color: var(--text-tertiary); margin: 0.5rem 0 0;">Joined: ${formatDate(user.createdAt)}</p>
                <p style="font-size: 0.75rem; color: var(--text-tertiary); margin: 0.25rem 0 0;">Last visit: ${formatDate(user.lastVisit)}</p>
            `;
            list.appendChild(div);
        });
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// ==================== TESTIMONIALS ====================
let testimonialsListener = null;
async function loadTestimonialsManagement() {
    const list = document.getElementById('testimonialsList');
    if (!list) return;

    document.querySelectorAll('.testimonials-filter .filter-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.testimonials-filter .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTestimonialsFilter = btn.dataset.filter;
            renderTestimonials();
        };
    });

    if (testimonialsListener) testimonialsListener();
    testimonialsListener = onSnapshot(collection(db, 'testimonials'), () => renderTestimonials());
}

let allTestimonials = [];
function renderTestimonials() {
    const list = document.getElementById('testimonialsList');
    if (!list) return;

    if (testimonialsListener) {
        // Get fresh data via getDocs since onSnapshot callback may be stale
    }
    getDocs(collection(db, 'testimonials')).then(snapshot => {
        allTestimonials = [];
        snapshot.forEach(docSnap => allTestimonials.push({ ...docSnap.data(), id: docSnap.id }));
        allTestimonials.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });

        let filtered = allTestimonials;
        if (currentTestimonialsFilter === 'pending') {
            filtered = allTestimonials.filter(t => !t.approved);
        } else if (currentTestimonialsFilter === 'approved') {
            filtered = allTestimonials.filter(t => t.approved);
        }

        list.innerHTML = filtered.length === 0
            ? '<p style="text-align: center; color: var(--text-tertiary); padding: 1rem;">No reviews found.</p>'
            : '';

        filtered.forEach(t => {
            const div = document.createElement('div');
            div.className = 'testimonial-admin-card';
            div.style.animation = 'fadeInUp 0.4s ease-out backwards';
            const stars = '★'.repeat(t.rating) + '☆'.repeat(5 - t.rating);
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
                    <div>
                        <h4>${escapeHtml(t.name)}</h4>
                        ${t.company ? `<p style="font-size: 0.8rem; color: var(--primary-color); margin: 0.25rem 0;">${escapeHtml(t.company)}</p>` : ''}
                        <div style="color: var(--primary-color); font-size: 1rem; margin: 0.5rem 0;">${stars}</div>
                    </div>
                    <span style="color: ${t.approved ? 'var(--success)' : 'var(--warning)'}; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">${t.approved ? 'Published' : 'Pending'}</span>
                </div>
                <p style="font-style: italic; margin: 1rem 0; color: var(--text-secondary);">"${escapeHtml(t.text)}"</p>
                <p style="font-size: 0.75rem; color: var(--text-tertiary);">Submitted: ${formatDate(t.createdAt)}</p>
                <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                    ${!t.approved ? `<button class="btn btn-success btn-sm" onclick="approveTestimonial('${t.id}')">Approve</button>` : ''}
                    <button class="btn btn-danger btn-sm" onclick="deleteTestimonial('${t.id}')">Delete</button>
                </div>
            `;
            list.appendChild(div);
        });
    }).catch(err => console.error('Error loading testimonials:', err));
}

window.approveTestimonial = async function (id) {
    try {
        showLoading(true);
        await updateDoc(doc(db, 'testimonials', id), { approved: true, approvedAt: Timestamp.now() });
        showToast('Review published', 'success');
    } catch (error) {
        showToast('Could not approve review', 'error');
    } finally {
        showLoading(false);
    }
};

window.deleteTestimonial = async function (id) {
    if (!confirm('Delete this review?')) return;
    try {
        showLoading(true);
        await deleteDoc(doc(db, 'testimonials', id));
        showToast('Review deleted', 'success');
    } catch (error) {
        showToast('Could not delete review', 'error');
    } finally {
        showLoading(false);
    }
};

// ==================== CONTACT SETTINGS ====================
async function loadContactSettings() {
    try {
        const d = await getDoc(doc(db, 'settings', 'contact'));
        if (d.exists()) {
            const data = d.data();
            const phone = document.getElementById('contactPhoneInput');
            const email = document.getElementById('contactEmailInput');
            const addr = document.getElementById('contactAddressInput');
            if (phone) phone.value = data.phone || '';
            if (email) email.value = data.email || '';
            if (addr) addr.value = data.address || '';
        }
    } catch (error) {
        console.error('Error loading contact:', error);
    }
}

document.getElementById('contactForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('contactPhoneInput').value.trim();
    const email = document.getElementById('contactEmailInput').value.trim();
    const address = document.getElementById('contactAddressInput').value.trim();
    try {
        showLoading(true);
        await setDoc(doc(db, 'settings', 'contact'), { phone, email, address, updatedAt: Timestamp.now() });
        showToast('Contact info saved', 'success');
    } catch (error) {
        showToast('Could not save contact info', 'error');
    } finally {
        showLoading(false);
    }
});

// ==================== SOCIAL LINKS SETTINGS ====================
async function loadSocialSettings() {
    try {
        const d = await getDoc(doc(db, 'settings', 'social'));
        if (d.exists()) {
            const data = d.data();
            const fields = ['socialFacebook', 'socialInstagram', 'socialTwitter', 'socialLinkedin', 'socialYoutube', 'socialTiktok'];
            const keys = ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok'];
            fields.forEach((field, i) => {
                const el = document.getElementById(field);
                if (el) el.value = data[keys[i]] || '';
            });
        }
    } catch (error) {
        console.error('Error loading social settings:', error);
    }
}

document.getElementById('socialForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        facebook: document.getElementById('socialFacebook').value.trim(),
        instagram: document.getElementById('socialInstagram').value.trim(),
        twitter: document.getElementById('socialTwitter').value.trim(),
        linkedin: document.getElementById('socialLinkedin').value.trim(),
        youtube: document.getElementById('socialYoutube').value.trim(),
        tiktok: document.getElementById('socialTiktok').value.trim(),
        updatedAt: Timestamp.now()
    };
    try {
        showLoading(true);
        await setDoc(doc(db, 'settings', 'social'), data, { merge: true });
        showToast('Social links saved', 'success');
    } catch (error) {
        showToast('Could not save social links', 'error');
    } finally {
        showLoading(false);
    }
});

// ==================== PAYMENT SETTINGS ====================
async function loadPaymentSettings() {
    try {
        const d = await getDoc(doc(db, 'settings', 'payments'));
        if (d.exists()) {
            const data = d.data();
            const codeEl = document.getElementById('currencyCode');
            const symEl = document.getElementById('currencySymbol');
            if (codeEl) codeEl.value = data.currency || 'NGN';
            if (symEl) symEl.value = data.currencySymbol || '₦';

            // PayPal
            if (data.paypal) {
                document.getElementById('paypalEnabled').checked = !!data.paypal.enabled;
                document.getElementById('paypalClientId').value = data.paypal.clientId || '';
                updateGatewayCard('paypalCard', data.paypal.enabled && data.paypal.clientId);
            }
            // Paystack
            if (data.paystack) {
                document.getElementById('paystackEnabled').checked = !!data.paystack.enabled;
                document.getElementById('paystackPublicKey').value = data.paystack.publicKey || '';
                updateGatewayCard('paystackCard', data.paystack.enabled && data.paystack.publicKey);
            }
            // Flutterwave
            if (data.flutterwave) {
                document.getElementById('flutterwaveEnabled').checked = !!data.flutterwave.enabled;
                document.getElementById('flutterwavePublicKey').value = data.flutterwave.publicKey || '';
                updateGatewayCard('flutterwaveCard', data.flutterwave.enabled && data.flutterwave.publicKey);
            }
        }
    } catch (error) {
        console.error('Error loading payment settings:', error);
    }

    // Toggle change listeners
    ['paypalEnabled', 'paystackEnabled', 'flutterwaveEnabled'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', async (e) => {
            const gateway = id.replace('Enabled', '');
            await updateGatewayToggle(gateway, e.target.checked);
        });
    });
}

function updateGatewayCard(cardId, isActive) {
    const card = document.getElementById(cardId);
    if (!card) return;
    card.classList.toggle('active', !!isActive);
}

async function updateGatewayToggle(gateway, enabled) {
    try {
        const d = await getDoc(doc(db, 'settings', 'payments'));
        const current = d.exists() ? d.data() : {};
        if (!current[gateway]) current[gateway] = {};
        current[gateway] = { ...current[gateway], enabled };
        await setDoc(doc(db, 'settings', 'payments'), current, { merge: true });
        showToast(`${gateway.charAt(0).toUpperCase() + gateway.slice(1)} ${enabled ? 'enabled' : 'disabled'}`, 'success');

        // Update card visual state
        const hasCreds = gateway === 'paypal'
            ? document.getElementById('paypalClientId').value.trim()
            : document.getElementById(`${gateway}PublicKey`).value.trim();
        updateGatewayCard(`${gateway}Card`, enabled && hasCreds);
    } catch (error) {
        showToast('Could not update setting', 'error');
    }
}

document.getElementById('currencyForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currency = document.getElementById('currencyCode').value.trim().toUpperCase();
    const currencySymbol = document.getElementById('currencySymbol').value.trim();
    try {
        showLoading(true);
        await setDoc(doc(db, 'settings', 'payments'), { currency, currencySymbol, updatedAt: Timestamp.now() }, { merge: true });
        showToast('Currency saved', 'success');
    } catch (error) {
        showToast('Could not save currency', 'error');
    } finally {
        showLoading(false);
    }
});

document.getElementById('paypalForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const clientId = document.getElementById('paypalClientId').value.trim();
    const enabled = document.getElementById('paypalEnabled').checked;
    try {
        showLoading(true);
        await setDoc(doc(db, 'settings', 'payments'), {
            paypal: { clientId, enabled },
            updatedAt: Timestamp.now()
        }, { merge: true });
        showToast('PayPal settings saved', 'success');
        updateGatewayCard('paypalCard', enabled && clientId);
    } catch (error) {
        showToast('Could not save PayPal settings', 'error');
    } finally {
        showLoading(false);
    }
});

document.getElementById('paystackForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const publicKey = document.getElementById('paystackPublicKey').value.trim();
    const enabled = document.getElementById('paystackEnabled').checked;
    try {
        showLoading(true);
        await setDoc(doc(db, 'settings', 'payments'), {
            paystack: { publicKey, enabled },
            updatedAt: Timestamp.now()
        }, { merge: true });
        showToast('Paystack settings saved', 'success');
        updateGatewayCard('paystackCard', enabled && publicKey);
    } catch (error) {
        showToast('Could not save Paystack settings', 'error');
    } finally {
        showLoading(false);
    }
});

document.getElementById('flutterwaveForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const publicKey = document.getElementById('flutterwavePublicKey').value.trim();
    const enabled = document.getElementById('flutterwaveEnabled').checked;
    try {
        showLoading(true);
        await setDoc(doc(db, 'settings', 'payments'), {
            flutterwave: { publicKey, enabled },
            updatedAt: Timestamp.now()
        }, { merge: true });
        showToast('Flutterwave settings saved', 'success');
        updateGatewayCard('flutterwaveCard', enabled && publicKey);
    } catch (error) {
        showToast('Could not save Flutterwave settings', 'error');
    } finally {
        showLoading(false);
    }
});

// ==================== SETTINGS (SMS + Password) ====================
async function loadSettings() {
    try {
        const d = await getDoc(doc(db, 'settings', 'sms'));
        if (d.exists()) {
            const data = d.data();
            const phoneEl = document.getElementById('adminPhoneNumber');
            const apiKeyEl = document.getElementById('termiiApiKey');
            const senderEl = document.getElementById('termiiSenderId');
            if (phoneEl) phoneEl.value = data.adminPhone || '';
            if (apiKeyEl) apiKeyEl.value = data.termiiApiKey || '';
            if (senderEl) senderEl.value = data.senderId || '';
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

document.getElementById('smsSettingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const adminPhone = document.getElementById('adminPhoneNumber').value.trim();
    const termiiApiKey = document.getElementById('termiiApiKey').value.trim();
    const senderId = document.getElementById('termiiSenderId').value.trim();
    try {
        showLoading(true);
        await setDoc(doc(db, 'settings', 'sms'), { adminPhone, termiiApiKey, senderId, updatedAt: Timestamp.now() });
        showToast('SMS settings saved', 'success');
    } catch (error) {
        showToast('Could not save settings', 'error');
    } finally {
        showLoading(false);
    }
});

document.getElementById('passwordChangeForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    if (newPassword.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    try {
        showLoading(true);
        const user = auth.currentUser;
        if (!user) throw new Error('Not authenticated');
        const cred = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, cred);
        await updatePassword(user, newPassword);
        showToast('Password updated successfully', 'success');
        document.getElementById('passwordChangeForm').reset();
    } catch (error) {
        console.error('Password update error:', error);
        showToast(error.code === 'auth/wrong-password' ? 'Current password is incorrect' : 'Could not update password', 'error');
    } finally {
        showLoading(false);
    }
});

// ==================== INITIALIZATION ====================
async function initializeDashboard() {
    await loadDashboard();
}

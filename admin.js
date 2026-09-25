// ====================================================================
// JOWEFCO ADMIN.JS — Full admin dashboard
// Authentication via Firebase Auth (sign-in + secure password reset).
// Manages: dashboard stats, products (full CRUD with specs), orders
// (WhatsApp flow — full detail view + status + payment + delivery),
// projects, hero, portfolio, testimonials, contact, social, payments
// (bank transfer), WhatsApp settings, business/workshop settings,
// users, branding.
// ====================================================================

import {
    getAuth, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import {
    collection, getDocs, addDoc, doc, getDoc, setDoc, updateDoc, deleteDoc,
    Timestamp, query, where, onSnapshot, deleteDoc as fsDeleteDoc
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const db = window.JOWEFCO.db;
const utils = window.JOWEFCO.utils;
const warn = window.JOWEFCO.warnPermissionsOnce;

// Initialize Firebase Auth
const auth = getAuth(window.JOWEFCO.firebaseApp);

// State
let currentTab = 'dashboard';
let projectBookingsListener = null;
let ordersListener = null;
let currentProjectsFilter = 'all';
let currentOrdersFilter = 'all';
let currentTestimonialsFilter = 'pending';
let allProducts = [];
let allOrders = [];
let allProjects = [];
let allTestimonials = [];

// ==================== AUTHENTICATION ====================
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) return;
    loginError.classList.remove('show');
    try {
        utils.showLoading(true, 'Signing in...');
        await signInWithEmailAndPassword(auth, email, password);
        utils.showToast('Welcome back!', 'success');
    } catch (error) {
        loginError.textContent = 'Invalid email or password. Please try again.';
        loginError.classList.add('show');
    } finally {
        utils.showLoading(false);
    }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await signOut(auth);
        utils.showToast('Signed out', 'success');
    } catch (e) {
        utils.showToast('Could not sign out', 'error');
    }
});

document.getElementById('viewSiteBtn').addEventListener('click', () => window.open('index.html', '_blank'));

// ==================== FORGOT PASSWORD ====================
const forgotLink = document.getElementById('forgotPasswordLink');
const forgotModal = document.getElementById('forgotPasswordModal');
const forgotForm = document.getElementById('forgotPasswordForm');
const forgotResult = document.getElementById('forgotPasswordResult');

forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    // Pre-fill with login email if present
    const loginEmail = document.getElementById('loginEmail').value.trim();
    if (loginEmail) document.getElementById('forgotEmail').value = loginEmail;
    forgotModal.classList.add('active');
});

forgotModal.addEventListener('click', (e) => {
    if (e.target === forgotModal) forgotModal.classList.remove('active');
});

forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value.trim();
    if (!email) return;
    forgotResult.style.display = 'block';
    forgotResult.innerHTML = '<p style="color:var(--text-secondary);font-size:0.9rem;">Sending reset email...</p>';
    try {
        // Use Firebase Auth's secure password-reset mechanism.
        // The email is sent ONLY to the email address entered here,
        // and only if that address belongs to an existing Firebase Auth user.
        // Authorized JOWEFCO admins: danielgiobari644@gmail.com, jowefcotech@gmail.com
        // (configured in Firebase Console → Authentication → Users).
        await sendPasswordResetEmail(auth, email);
        forgotResult.innerHTML = `<div style="background:rgba(27,135,84,0.1);border:1px solid rgba(27,135,84,0.3);color:var(--success);padding:0.85rem 1rem;border-radius:var(--radius-sm);font-size:0.9rem;">
            <strong>Reset link sent.</strong> Check your inbox (and spam folder) at <strong>${utils.escapeHtml(email)}</strong>.
            Click the link in the email to set a new password.
        </div>`;
        forgotForm.reset();
    } catch (error) {
        let msg = 'Could not send reset email.';
        if (error.code === 'auth/user-not-found') {
            // Do NOT reveal whether the email is registered (security best practice).
            // Show same success-looking message to avoid account enumeration.
            forgotResult.innerHTML = `<div style="background:rgba(27,135,84,0.1);border:1px solid rgba(27,135,84,0.3);color:var(--success);padding:0.85rem 1rem;border-radius:var(--radius-sm);font-size:0.9rem;">
                <strong>If that email is registered as an admin account</strong>, a reset link has been sent. Please check your inbox.
            </div>`;
            forgotForm.reset();
            return;
        }
        if (error.code === 'auth/invalid-email') msg = 'Please enter a valid email address.';
        if (error.code === 'auth/too-many-requests') msg = 'Too many reset attempts. Please try again later.';
        forgotResult.innerHTML = `<div style="background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.3);color:var(--danger);padding:0.85rem 1rem;border-radius:var(--radius-sm);font-size:0.9rem;">${msg}</div>`;
    }
});

// ==================== AUTH STATE ====================
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'block';
        initializeDashboard();
    } else {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('adminDashboard').style.display = 'none';
        if (projectBookingsListener) { projectBookingsListener(); projectBookingsListener = null; }
        if (ordersListener) { ordersListener(); ordersListener = null; }
    }
});

// ==================== TAB NAVIGATION ====================
document.querySelectorAll('.admin-nav-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

const adminSidebar = document.getElementById('adminSidebar');
const adminOverlay = document.getElementById('adminOverlay');
document.getElementById('adminSidebarToggle').addEventListener('click', () => {
    adminSidebar.classList.add('active');
    adminOverlay.classList.add('active');
});
document.getElementById('adminSidebarToggleClose').addEventListener('click', closeSidebar);
adminOverlay.addEventListener('click', closeSidebar);
function closeSidebar() {
    adminSidebar.classList.remove('active');
    adminOverlay.classList.remove('active');
}

function switchTab(tabName) {
    currentTab = tabName;
    document.querySelectorAll('.admin-nav-btn[data-tab]').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.tab === tabName));
    document.querySelectorAll('.admin-tab').forEach(tab =>
        tab.classList.toggle('active', tab.id === tabName + 'Tab'));
    // Page title
    const titles = {
        dashboard: 'Dashboard',
        shop: 'Products',
        orders: 'Orders',
        projects: 'Project Inquiries',
        hero: 'Hero Section',
        portfolio: 'Portfolio',
        testimonials: 'Reviews',
        contact: 'Contact Info',
        social: 'Social Links',
        payments: 'Bank Transfer',
        whatsapp: 'WhatsApp Settings',
        business: 'Business Settings',
        users: 'Users',
        branding: 'Logo & Branding'
    };
    document.getElementById('adminPageTitle').textContent = titles[tabName] || 'Dashboard';
    closeSidebar();
    loadTabContent(tabName);
}

async function loadTabContent(tabName) {
    switch (tabName) {
        case 'dashboard': await loadDashboard(); break;
        case 'shop': await loadShopManagement(); break;
        case 'orders': await loadOrdersManagement(); break;
        case 'projects': await loadProjectsManagement(); break;
        case 'hero': await loadHeroSettings(); break;
        case 'portfolio': await loadPortfolioManagement(); break;
        case 'testimonials': await loadTestimonialsManagement(); break;
        case 'contact': await loadContactSettings(); break;
        case 'social': await loadSocialSettings(); break;
        case 'payments': await loadPaymentSettings(); break;
        case 'whatsapp': await loadWhatsAppSettings(); break;
        case 'business': await loadBusinessSettings(); break;
        case 'users': await loadUsersManagement(); break;
        case 'branding': await loadBrandingSettings(); break;
    }
}

// ==================== DASHBOARD ====================
async function loadDashboard() {
    try {
        const [projectsSnap, ordersSnap, portfolioSnap, productsSnap, usersSnap, reviewsSnap] = await Promise.all([
            getDocs(collection(db, 'projectBookings')),
            getDocs(collection(db, 'shopOrders')),
            getDocs(collection(db, 'portfolio')),
            getDocs(collection(db, 'shopItems')),
            getDocs(collection(db, 'users')),
            getDocs(query(collection(db, 'testimonials'), where('approved', '==', false)))
        ]);
        document.getElementById('statProjects').textContent = projectsSnap.size;
        document.getElementById('statOrders').textContent = ordersSnap.size;
        document.getElementById('statPortfolio').textContent = portfolioSnap.size;
        document.getElementById('statProducts').textContent = productsSnap.size;
        document.getElementById('statUsers').textContent = usersSnap.size;
        document.getElementById('statReviews').textContent = reviewsSnap.size;

        // Recent activity: combine latest 5 from orders + projects
        const recent = [];
        ordersSnap.forEach(d => recent.push({ type: 'order', id: d.id, ...d.data() }));
        projectsSnap.forEach(d => recent.push({ type: 'project', id: d.id, ...d.data() }));
        recent.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
        const recentContainer = document.getElementById('recentActivity');
        if (recent.length === 0) {
            recentContainer.innerHTML = '<p>No recent activity yet.</p>';
        } else {
            recentContainer.innerHTML = '<ul style="list-style:none;padding:0;margin:0;">' + recent.slice(0, 8).map(item => {
                const date = utils.formatDate(item.createdAt);
                if (item.type === 'order') {
                    return `<li style="display:flex;justify-content:space-between;padding:0.65rem 0;border-bottom:1px solid var(--surface-border);">
                        <span><strong>Order</strong> from ${utils.escapeHtml(item.customerName || '—')}</span>
                        <span style="color:var(--text-tertiary);font-size:0.85rem;">${date}</span>
                    </li>`;
                } else {
                    return `<li style="display:flex;justify-content:space-between;padding:0.65rem 0;border-bottom:1px solid var(--surface-border);">
                        <span><strong>Inquiry</strong> — ${utils.escapeHtml(item.title || '—')}</span>
                        <span style="color:var(--text-tertiary);font-size:0.85rem;">${date}</span>
                    </li>`;
                }
            }).join('') + '</ul>';
        }
    } catch (e) { warn(e); }
}

// ==================== SHOP MANAGEMENT (full CRUD) ====================
async function loadShopManagement() {
    await loadProducts();
    // Wire form
    const form = document.getElementById('productForm');
    if (!form.dataset.wired) {
        form.dataset.wired = '1';
        form.addEventListener('submit', onProductFormSubmit);
        document.getElementById('resetProductForm').addEventListener('click', resetProductForm);
        document.getElementById('cancelEditBtn').addEventListener('click', resetProductForm);
        document.getElementById('previewProductBtn').addEventListener('click', () => {
            const url = document.getElementById('productMediaUrl').value.trim();
            const type = document.getElementById('productMediaType').value;
            const preview = document.getElementById('productMediaPreview');
            if (!url) { preview.style.display = 'none'; preview.innerHTML = ''; return; }
            preview.style.display = 'block';
            preview.innerHTML = type === 'video'
                ? `<video class="admin-image-preview" src="${url}" controls muted></video>`
                : `<img class="admin-image-preview" src="${url}" alt="Preview" onerror="this.style.opacity=0.3">`;
        });
        document.getElementById('adminProductSearch').addEventListener('input', (e) => renderProductsTable());
    }
}

async function loadProducts() {
    try {
        const snap = await getDocs(collection(db, 'shopItems'));
        allProducts = [];
        snap.forEach(d => allProducts.push({ id: d.id, ...d.data() }));
        allProducts.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
        // Populate category datalist
        const cats = [...new Set(allProducts.map(p => p.category).filter(Boolean))].sort();
        document.getElementById('categoryList').innerHTML = cats.map(c => `<option value="${utils.escapeHtml(c)}">`).join('');
        renderProductsTable();
    } catch (e) { warn(e); }
}

function renderProductsTable() {
    const list = document.getElementById('productsList');
    if (!list) return;
    const search = (document.getElementById('adminProductSearch')?.value || '').toLowerCase();
    let filtered = allProducts;
    if (search) {
        filtered = allProducts.filter(p =>
            (p.name||'').toLowerCase().includes(search) ||
            (p.category||'').toLowerCase().includes(search)
        );
    }
    if (filtered.length === 0) {
        list.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-tertiary);padding:1.5rem;">No products found.</td></tr>';
        return;
    }
    list.innerHTML = filtered.map(p => {
        const media = p.mediaType === 'video'
            ? `<video src="${p.media}" muted style="width:50px;height:50px;object-fit:cover;border-radius:var(--radius-sm);"></video>`
            : `<img src="${p.media || ''}" alt="" onerror="this.style.opacity=0.2">`;
        const price = (typeof p.price === 'number')
            ? utils.formatPrice(p.price)
            : (typeof p.priceMin === 'number' && typeof p.priceMax === 'number')
                ? (p.priceMin === p.priceMax ? utils.formatPrice(p.priceMin) : `${utils.formatPrice(p.priceMin)} – ${utils.formatPrice(p.priceMax)}`)
                : '—';
        const stock = (typeof p.stock === 'number') ? p.stock : '∞';
        const available = (typeof p.available === 'boolean') ? p.available : true;
        return `<tr data-id="${p.id}">
            <td>${media}</td>
            <td><strong>${utils.escapeHtml(p.name||'')}</strong></td>
            <td>${utils.escapeHtml(p.category||'—')}</td>
            <td>${price}</td>
            <td>${stock}</td>
            <td><span class="status-pill ${available?'active':'unavailable'}">${available?'Available':'Unavailable'}</span></td>
            <td>
                <button class="btn btn-outline btn-sm" onclick="JOWEFCOAdmin.editProduct('${p.id}')">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="JOWEFCOAdmin.deleteProduct('${p.id}')">Delete</button>
            </td>
        </tr>`;
    }).join('');
}

window.JOWEFCOAdmin = {
    editProduct(id) {
        const p = allProducts.find(x => x.id === id);
        if (!p) return;
        document.getElementById('productFormTitle').textContent = 'Edit Product';
        document.getElementById('productId').value = p.id;
        document.getElementById('productName').value = p.name || '';
        document.getElementById('productCategory').value = p.category || '';
        document.getElementById('productDescription').value = p.description || '';
        document.getElementById('productSpecifications').value = p.specifications || '';
        document.getElementById('productPrice').value = (typeof p.price === 'number') ? p.price : (p.priceMin || '');
        document.getElementById('productStock').value = (typeof p.stock === 'number') ? p.stock : '';
        document.getElementById('productMediaType').value = p.mediaType || 'image';
        document.getElementById('productAvailable').value = (typeof p.available === 'boolean') ? String(p.available) : 'true';
        document.getElementById('productMediaUrl').value = p.media || '';
        document.getElementById('productFeatured').checked = !!p.featured;
        // Show preview if URL
        if (p.media) {
            const preview = document.getElementById('productMediaPreview');
            preview.style.display = 'block';
            preview.innerHTML = p.mediaType === 'video'
                ? `<video class="admin-image-preview" src="${p.media}" muted></video>`
                : `<img class="admin-image-preview" src="${p.media}" alt="Preview">`;
        }
        document.getElementById('productSubmitBtn').textContent = 'Update Product';
        document.getElementById('cancelEditBtn').style.display = 'inline-flex';
        // Scroll to form
        document.getElementById('productForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    async deleteProduct(id) {
        if (!confirm('Delete this product? This cannot be undone.')) return;
        try {
            await fsDeleteDoc(doc(db, 'shopItems', id));
            utils.showToast('Product deleted', 'success');
            await loadProducts();
        } catch (e) {
            warn(e);
            utils.showToast('Could not delete product', 'error');
        } finally {
        }
    }
};

function resetProductForm() {
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('productFormTitle').textContent = 'Add New Product';
    document.getElementById('productSubmitBtn').textContent = 'Add Product';
    document.getElementById('cancelEditBtn').style.display = 'none';
    document.getElementById('productMediaPreview').innerHTML = '';
    document.getElementById('productMediaPreview').style.display = 'none';
}

async function onProductFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('productId').value;
    const name = document.getElementById('productName').value.trim();
    const description = document.getElementById('productDescription').value.trim();
    const specifications = document.getElementById('productSpecifications').value.trim() || null;
    const price = parseFloat(document.getElementById('productPrice').value);
    const stockInput = document.getElementById('productStock').value;
    const stock = stockInput === '' ? null : parseInt(stockInput, 10);
    const category = document.getElementById('productCategory').value.trim() || null;
    const mediaType = document.getElementById('productMediaType').value;
    const media = document.getElementById('productMediaUrl').value.trim();
    const available = document.getElementById('productAvailable').value === 'true';
    const featured = document.getElementById('productFeatured').checked;

    if (!name || !description || isNaN(price) || !media) {
        utils.showToast('Please fill in all required fields', 'error');
        return;
    }

    const payload = {
        name, description, specifications, price, stock, category, mediaType, media, available, featured,
        // Keep legacy fields for backwards compatibility
        priceMin: price, priceMax: price
    };

    try {
        if (id) {
            await updateDoc(doc(db, 'shopItems', id), payload);
            utils.showToast('Product updated', 'success');
        } else {
            payload.createdAt = Timestamp.now();
            await addDoc(collection(db, 'shopItems'), payload);
            utils.showToast('Product added', 'success');
        }
        resetProductForm();
        await loadProducts();
    } catch (e) {
        warn(e);
        utils.showToast('Could not save product', 'error');
    } finally {
    }
}

// ==================== ORDERS MANAGEMENT (WhatsApp ordering flow) ====================
// The shopOrders collection is the new single-order-per-product collection
// created when a customer clicks "Order on WhatsApp" on a product page.
// Each order starts at orderStatus='awaiting_discussion' and
// paymentStatus='pending'. The admin walks each order through the
// status flow from the Orders tab + #orderModal.

const ORDER_STATUSES = [
    'awaiting_discussion',
    'order_agreed',
    'payment_pending',
    'payment_confirmed',
    'delivery_scheduled',
    'out_for_delivery',
    'delivered',
    'cancelled'
];

// Map any order/payment status to an existing status-pill CSS class
// (styles.css defines .pending/.approved/.completed/.paid/.active/.rejected/.cancelled/.unavailable).
function pillClassFor(status) {
    const s = String(status || '').toLowerCase();
    if (['cancelled', 'rejected', 'unavailable'].includes(s)) return 'cancelled';
    if (['delivered', 'completed', 'paid', 'payment_confirmed', 'approved', 'active'].includes(s)) return 'paid';
    if (['pending', 'awaiting_discussion', 'payment_pending', 'order_agreed', 'delivery_scheduled', 'out_for_delivery'].includes(s)) return 'pending';
    return '';
}

function statusPillHtml(status, fallback) {
    const s = String(status || fallback || '').toLowerCase();
    const label = (s || fallback || '—').replace(/_/g, ' ');
    return `<span class="status-pill ${pillClassFor(s)}">${utils.escapeHtml(label)}</span>`;
}

// Build a WhatsApp deep-link to message the customer about their order.
function buildCustomerWhatsAppUrl(order) {
    const number = order.customerWhatsapp || order.customerPhone || '';
    if (!number) return '#';
    const msg = `Hello ${order.customerName || 'there'}, this is JOWEFCO regarding your order ${order.orderReference || ''}...`;
    return utils.buildWhatsAppUrl(number, msg) || '#';
}

// Build a tel: link for the customer.
function buildCustomerCallUrl(order) {
    const phone = String(order.customerPhone || '').replace(/[^\d+]/g, '');
    return phone ? `tel:${phone}` : '#';
}

async function loadOrdersManagement() {
    // Wire filter bar buttons (idempotent)
    document.querySelectorAll('#ordersTab .filter-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('#ordersTab .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentOrdersFilter = btn.dataset.status;
            renderOrdersTable();
        };
    });
    // Set up real-time listener
    if (ordersListener) { ordersListener(); ordersListener = null; }
    ordersListener = onSnapshot(
        collection(db, 'shopOrders'),
        (snap) => {
            allOrders = [];
            snap.forEach(d => allOrders.push({ id: d.id, ...d.data() }));
            allOrders.sort((a, b) => {
                const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return tb - ta;
            });
            renderOrdersTable();
        },
        (err) => warn(err)
    );
}

function renderOrdersTable() {
    const list = document.getElementById('ordersList');
    if (!list) return;
    let filtered = allOrders;
    if (currentOrdersFilter !== 'all') {
        filtered = allOrders.filter(o => (o.orderStatus || 'awaiting_discussion') === currentOrdersFilter);
    }
    if (filtered.length === 0) {
        list.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-tertiary);padding:1.5rem;">No orders found.</td></tr>';
        return;
    }
    list.innerHTML = filtered.map(o => {
        const customerCell = `<strong>${utils.escapeHtml(o.customerName || '')}</strong><br><span style="font-size:0.78rem;color:var(--text-tertiary);">${utils.escapeHtml(o.customerPhone || '')}</span>`;
        const productCell = `${utils.escapeHtml(o.productName || '—')}<br><span style="font-size:0.78rem;color:var(--text-tertiary);">Qty: ${o.quantity || 1}</span>`;
        const listedPrice = utils.formatPrice(o.listedPrice || 0);
        const agreedPrice = (typeof o.agreedPrice === 'number')
            ? utils.formatPrice(o.agreedPrice)
            : '<span style="color:var(--text-tertiary);">—</span>';
        return `<tr>
            <td><strong>${utils.escapeHtml(o.orderReference || '—')}</strong></td>
            <td>${customerCell}</td>
            <td style="max-width:240px;font-size:0.85rem;">${productCell}</td>
            <td>${listedPrice}</td>
            <td>${agreedPrice}</td>
            <td>${statusPillHtml(o.paymentStatus, 'pending')}</td>
            <td>${statusPillHtml(o.orderStatus, 'awaiting_discussion')}</td>
            <td style="font-size:0.85rem;color:var(--text-tertiary);">${utils.formatDate(o.createdAt)}</td>
            <td><button class="btn btn-outline btn-sm" onclick="JOWEFCOAdmin.viewOrder('${o.id}')">View</button></td>
        </tr>`;
    }).join('');
}

function viewOrder(id) {
    const o = allOrders.find(x => x.id === id);
    if (!o) return;
    const waUrl = buildCustomerWhatsAppUrl(o);
    const callUrl = buildCustomerCallUrl(o);
    const productImage = o.productImageUrl
        ? `<img src="${utils.escapeHtml(o.productImageUrl)}" alt="${utils.escapeHtml(o.productName || '')}" style="width:100%;max-height:200px;object-fit:contain;background:var(--bg-tertiary);border:1px solid var(--surface-border);border-radius:var(--radius-sm);" onerror="this.style.display='none'">`
        : '';

    const waIcon = `<svg viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;margin-right:0.35rem;vertical-align:middle;"><path d="M16 0C7.164 0 0 7.163 0 16c0 2.825.738 5.487 2.031 7.794L.05 31.95l8.331-2.019A15.923 15.923 0 0016 32c8.837 0 16-7.163 16-16S24.837 0 16 0zm0 29.333c-2.387 0-4.713-.638-6.756-1.85l-.481-.287-5.006 1.213 1.238-4.888-.313-.5A13.259 13.259 0 012.667 16c0-7.35 5.983-13.333 13.333-13.333S29.333 8.65 29.333 16 23.35 29.333 16 29.333z"/><path d="M23.094 19.45c-.4-.2-2.369-1.169-2.737-1.3-.369-.131-.637-.2-.906.2-.269.4-1.038 1.3-1.275 1.569-.237.269-.475.3-.875.1-.4-.2-1.688-.619-3.213-1.975-1.188-1.056-1.988-2.362-2.219-2.762-.231-.4-.025-.619.175-.819.181-.181.4-.475.6-.712.2-.238.269-.4.4-.669.131-.269.069-.5-.031-.7-.1-.2-.906-2.181-1.244-2.987-.331-.794-.662-.688-.906-.7-.237-.012-.506-.012-.775-.012s-.706.1-1.075.5c-.369.4-1.406 1.375-1.406 3.35s1.444 3.888 1.644 4.156c.2.269 2.819 4.306 6.831 6.038.956.413 1.7.656 2.281.844.962.306 1.837.262 2.531.162.769-.112 2.369-.969 2.706-1.906.337-.938.337-1.738.237-1.906-.1-.169-.369-.269-.769-.469z"/></svg>`;

    const body = document.getElementById('orderModalBody');
    body.innerHTML = `
        <!-- Reference line -->
        <p style="margin:0 0 1rem 0;font-size:0.85rem;color:var(--text-tertiary);">
            Order Reference: <strong style="color:var(--text-primary);">${utils.escapeHtml(o.orderReference || '—')}</strong>
            • Created ${utils.formatDate(o.createdAt)}
        </p>

        <!-- Customer -->
        <div style="margin-bottom:1.25rem;">
            <h3 style="margin:0 0 0.5rem 0;font-size:1rem;">Customer</h3>
            <p style="margin:0.15rem 0;font-size:0.92rem;"><strong>Name:</strong> ${utils.escapeHtml(o.customerName || '—')}</p>
            <p style="margin:0.15rem 0;font-size:0.92rem;"><strong>Phone:</strong> ${utils.escapeHtml(o.customerPhone || '—')}</p>
            ${o.customerWhatsapp ? `<p style="margin:0.15rem 0;font-size:0.92rem;"><strong>WhatsApp:</strong> ${utils.escapeHtml(o.customerWhatsapp)}</p>` : ''}
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.65rem;">
                <button class="btn btn-primary btn-sm" onclick="JOWEFCOAdmin.contactCustomerWhatsApp('${o.id}')">${waIcon} WhatsApp Customer</button>
                <a href="${callUrl}" class="btn btn-outline btn-sm" style="text-decoration:none;">Call Customer</a>
            </div>
        </div>

        <!-- Product -->
        <div style="margin-bottom:1.25rem;padding-top:1rem;border-top:1px solid var(--surface-border);">
            <h3 style="margin:0 0 0.5rem 0;font-size:1rem;">Product</h3>
            ${productImage ? `<div style="margin-bottom:0.75rem;">${productImage}</div>` : ''}
            <p style="margin:0.15rem 0;font-size:0.92rem;"><strong>Product:</strong> ${utils.escapeHtml(o.productName || '—')}</p>
            ${o.productId ? `<p style="margin:0.15rem 0;font-size:0.92rem;"><strong>Product ID:</strong> <code>${utils.escapeHtml(o.productId)}</code></p>` : ''}
            <p style="margin:0.15rem 0;font-size:0.92rem;"><strong>Quantity:</strong> ${o.quantity || 1}</p>
            <p style="margin:0.15rem 0;font-size:0.92rem;"><strong>Listed Price:</strong> ${utils.formatPrice(o.listedPrice || 0)}</p>
        </div>

        <!-- Financial -->
        <div style="margin-bottom:1.25rem;padding-top:1rem;border-top:1px solid var(--surface-border);">
            <h3 style="margin:0 0 0.5rem 0;font-size:1rem;">Financial</h3>
            <div class="form-row">
                <div class="form-group">
                    <label for="orderAgreedPrice">Agreed / Final Price (₦)</label>
                    <input type="number" id="orderAgreedPrice" step="0.01" min="0" value="${typeof o.agreedPrice === 'number' ? o.agreedPrice : ''}" placeholder="Set after WhatsApp discussion">
                    <p style="font-size:0.78rem;color:var(--text-tertiary);margin-top:0.35rem;">Different from listed price? Update after agreeing the final amount on WhatsApp.</p>
                </div>
                <div class="form-group">
                    <label>Payment Status</label>
                    <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                        ${statusPillHtml(o.paymentStatus, 'pending')}
                        <button class="btn btn-outline btn-sm" onclick="JOWEFCOAdmin.confirmPayment('${o.id}')">
                            ${o.paymentStatus === 'confirmed' ? 'Mark as Pending' : 'Confirm Payment'}
                        </button>
                    </div>
                    <p style="font-size:0.78rem;color:var(--text-tertiary);margin-top:0.35rem;">Toggles between pending and confirmed. Confirming payment also moves the order status to <strong>payment_confirmed</strong>.</p>
                </div>
            </div>
        </div>

        <!-- Delivery -->
        <div style="margin-bottom:1.25rem;padding-top:1rem;border-top:1px solid var(--surface-border);">
            <h3 style="margin:0 0 0.5rem 0;font-size:1rem;">Delivery</h3>
            <div class="form-group">
                <label for="orderDeliveryAddress">Delivery Address</label>
                <input type="text" id="orderDeliveryAddress" value="${utils.escapeHtml(o.deliveryAddress || o.deliveryLocation || '')}" placeholder="Where to deliver">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="orderDeliveryDate">Delivery Date (as discussed)</label>
                    <input type="text" id="orderDeliveryDate" value="${utils.escapeHtml(o.deliveryDate || '')}" placeholder="e.g. Tue 12 Nov">
                </div>
                <div class="form-group">
                    <label for="orderDeliveryTime">Delivery Time (as discussed)</label>
                    <input type="text" id="orderDeliveryTime" value="${utils.escapeHtml(o.deliveryTime || '')}" placeholder="e.g. 2:00 PM">
                </div>
            </div>
            <div class="form-group">
                <label for="orderDeliveryInstructions">Delivery Instructions</label>
                <textarea id="orderDeliveryInstructions" rows="3" placeholder="Notes for the delivery (e.g. 'Call 30 mins before arrival')">${utils.escapeHtml(o.deliveryInstructions || '')}</textarea>
            </div>
        </div>

        <!-- Status -->
        <div style="margin-bottom:1.25rem;padding-top:1rem;border-top:1px solid var(--surface-border);">
            <h3 style="margin:0 0 0.5rem 0;font-size:1rem;">Order Status</h3>
            <p style="margin:0 0 0.65rem 0;font-size:0.92rem;">Current: ${statusPillHtml(o.orderStatus, 'awaiting_discussion')}</p>
            <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                <button class="btn btn-outline btn-sm" onclick="JOWEFCOAdmin.updateOrderStatus('${o.id}','awaiting_discussion')">Awaiting Discussion</button>
                <button class="btn btn-outline btn-sm" onclick="JOWEFCOAdmin.updateOrderStatus('${o.id}','order_agreed')">Order Agreed</button>
                <button class="btn btn-outline btn-sm" onclick="JOWEFCOAdmin.updateOrderStatus('${o.id}','payment_pending')">Payment Pending</button>
                <button class="btn btn-outline btn-sm" onclick="JOWEFCOAdmin.updateOrderStatus('${o.id}','payment_confirmed')">Payment Confirmed</button>
                <button class="btn btn-outline btn-sm" onclick="JOWEFCOAdmin.updateOrderStatus('${o.id}','delivery_scheduled')">Delivery Scheduled</button>
                <button class="btn btn-outline btn-sm" onclick="JOWEFCOAdmin.updateOrderStatus('${o.id}','out_for_delivery')">Out for Delivery</button>
                <button class="btn btn-outline btn-sm" onclick="JOWEFCOAdmin.updateOrderStatus('${o.id}','delivered')">Delivered</button>
                <button class="btn btn-danger btn-sm" onclick="JOWEFCOAdmin.updateOrderStatus('${o.id}','cancelled')">Cancel Order</button>
            </div>
        </div>

        <!-- Footer actions -->
        <div style="padding-top:1rem;border-top:1px solid var(--surface-border);display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
            <button class="btn btn-primary" onclick="JOWEFCOAdmin.saveOrderDetails('${o.id}')">Save Changes</button>
            <a href="${waUrl}" target="_blank" rel="noopener" class="btn btn-red" style="text-decoration:none;">${waIcon} WhatsApp Customer</a>
        </div>
    `;
    document.getElementById('orderModal').classList.add('active');
}

async function updateOrderStatus(id, status) {
    try {
        await updateDoc(doc(db, 'shopOrders', id), { orderStatus: status });
        utils.showToast(`Order marked as ${status.replace(/_/g, ' ')}`, 'success');
        // Optimistic local update + re-render modal so admin sees the change immediately
        const o = allOrders.find(x => x.id === id);
        if (o) { o.orderStatus = status; viewOrder(id); }
        renderOrdersTable();
    } catch (e) {
        warn(e);
        utils.showToast('Could not update order status', 'error');
    } finally {
    }
}

async function confirmPayment(id) {
    const o = allOrders.find(x => x.id === id);
    if (!o) return;
    const newStatus = o.paymentStatus === 'confirmed' ? 'pending' : 'confirmed';
    const payload = { paymentStatus: newStatus };
    // If confirming, also auto-set orderStatus to payment_confirmed
    if (newStatus === 'confirmed') payload.orderStatus = 'payment_confirmed';
    try {
        await updateDoc(doc(db, 'shopOrders', id), payload);
        utils.showToast(`Payment ${newStatus}`, 'success');
        // Optimistic local update
        o.paymentStatus = newStatus;
        if (newStatus === 'confirmed') o.orderStatus = 'payment_confirmed';
        else if (o.orderStatus === 'payment_confirmed') o.orderStatus = 'payment_pending';
        viewOrder(id);
        renderOrdersTable();
    } catch (e) {
        warn(e);
        utils.showToast('Could not update payment status', 'error');
    } finally {
    }
}

async function saveOrderDetails(id) {
    const agreedPriceStr = document.getElementById('orderAgreedPrice')?.value;
    const agreedPrice = (agreedPriceStr === undefined || agreedPriceStr === '') ? null : parseFloat(agreedPriceStr);
    const payload = {
        agreedPrice: (typeof agreedPrice === 'number' && !isNaN(agreedPrice)) ? agreedPrice : null,
        deliveryAddress: (document.getElementById('orderDeliveryAddress')?.value || '').trim(),
        deliveryDate: (document.getElementById('orderDeliveryDate')?.value || '').trim(),
        deliveryTime: (document.getElementById('orderDeliveryTime')?.value || '').trim(),
        deliveryInstructions: (document.getElementById('orderDeliveryInstructions')?.value || '').trim()
    };
    try {
        await updateDoc(doc(db, 'shopOrders', id), payload);
        utils.showToast('Order details saved', 'success');
        // Optimistic local update + re-render
        const o = allOrders.find(x => x.id === id);
        if (o) { Object.assign(o, payload); viewOrder(id); }
        renderOrdersTable();
    } catch (e) {
        warn(e);
        utils.showToast('Could not save order details', 'error');
    } finally {
    }
}

function contactCustomerWhatsApp(id) {
    const o = allOrders.find(x => x.id === id);
    if (!o) return;
    const url = buildCustomerWhatsAppUrl(o);
    if (url && url !== '#') {
        window.open(url, '_blank', 'noopener');
    } else {
        utils.showToast('No WhatsApp number on file for this customer', 'error');
    }
}

function callCustomer(id) {
    const o = allOrders.find(x => x.id === id);
    if (!o) return;
    const url = buildCustomerCallUrl(o);
    if (url && url !== '#') {
        window.location.href = url;
    } else {
        utils.showToast('No phone number on file for this customer', 'error');
    }
}

// Attach order functions to global admin namespace (used by inline onclick handlers)
Object.assign(window.JOWEFCOAdmin, {
    viewOrder,
    updateOrderStatus,
    confirmPayment,
    saveOrderDetails,
    contactCustomerWhatsApp,
    callCustomer,
    // Backward-compat alias (old name → new behaviour)
    updateOrder(id, status) { return updateOrderStatus(id, status); }
});

// ==================== PROJECTS MANAGEMENT ====================
async function loadProjectsManagement() {
    try {
        const snap = await getDocs(collection(db, 'projectBookings'));
        allProjects = [];
        snap.forEach(d => allProjects.push({ id: d.id, ...d.data() }));
        allProjects.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
        document.querySelectorAll('#projectsTab .filter-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('#projectsTab .filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentProjectsFilter = btn.dataset.status;
                renderProjects();
            };
        });
        renderProjects();
    } catch (e) { warn(e); }
}

function renderProjects() {
    const list = document.getElementById('projectsList');
    if (!list) return;
    let filtered = allProjects;
    if (currentProjectsFilter !== 'all') {
        filtered = allProjects.filter(p => (p.status||'pending') === currentProjectsFilter);
    }
    if (filtered.length === 0) {
        list.innerHTML = '<p style="text-align:center;color:var(--text-tertiary);padding:1.5rem;">No project inquiries found.</p>';
        return;
    }
    list.innerHTML = filtered.map(p => `
        <div class="admin-panel" style="margin-bottom:1rem;">
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.85rem;">
                <div>
                    <h3 style="margin:0;font-size:1.1rem;">${utils.escapeHtml(p.title||'')}</h3>
                    <p style="font-size:0.85rem;color:var(--text-tertiary);margin:0.25rem 0 0 0;">By ${utils.escapeHtml(p.customerName||'')} • ${utils.escapeHtml(p.customerPhone||'')}</p>
                </div>
                <span class="status-pill ${p.status||'pending'}">${p.status||'pending'}</span>
            </div>
            <p style="font-size:0.9rem;color:var(--text-secondary);">${utils.escapeHtml(p.description||'')}</p>
            ${p.projectLocation ? `<p style="font-size:0.85rem;color:var(--text-tertiary);margin-top:0.5rem;">📍 ${utils.escapeHtml(p.projectLocation)}</p>` : ''}
            ${p.projectType ? `<p style="font-size:0.85rem;color:var(--text-tertiary);">Type: ${utils.escapeHtml(p.projectType)}</p>` : ''}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.85rem;flex-wrap:wrap;gap:0.5rem;">
                <span style="font-size:0.8rem;color:var(--text-tertiary);">${utils.formatDate(p.createdAt)}</span>
                <select onchange="JOWEFCOAdmin.updateProjectStatus('${p.id}', this.value)" style="width:auto;">
                    <option value="pending" ${p.status==='pending'?'selected':''}>Pending</option>
                    <option value="contacted" ${p.status==='contacted'?'selected':''}>Contacted</option>
                    <option value="quoted" ${p.status==='quoted'?'selected':''}>Quoted</option>
                    <option value="completed" ${p.status==='completed'?'selected':''}>Completed</option>
                </select>
            </div>
        </div>
    `).join('');
}

window.JOWEFCOAdmin.updateProjectStatus = async function (id, status) {
    try {
        await updateDoc(doc(db, 'projectBookings', id), { status });
        utils.showToast(`Updated to ${status}`, 'success');
        await loadProjectsManagement();
    } catch (e) { warn(e); utils.showToast('Could not update', 'error'); }
};

// ==================== HERO SETTINGS ====================
async function loadHeroSettings() {
    try {
        const snap = await getDoc(doc(db, 'settings', 'hero'));
        if (!snap.exists()) return;
        const d = snap.data();
        document.getElementById('heroTitleInput').value = d.title || '';
        document.getElementById('heroSubtitleInput').value = d.subtitle || '';
        document.getElementById('heroBackgroundInput').value = d.backgroundMedia || '';
    } catch (e) { warn(e); }
    const form = document.getElementById('heroForm');
    if (!form.dataset.wired) {
        form.dataset.wired = '1';
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                title: document.getElementById('heroTitleInput').value,
                subtitle: document.getElementById('heroSubtitleInput').value,
                backgroundMedia: document.getElementById('heroBackgroundInput').value
            };
            try {
                await setDoc(doc(db, 'settings', 'hero'), payload, { merge: true });
                utils.showToast('Hero content saved', 'success');
            } catch (e) { warn(e); utils.showToast('Could not save', 'error'); }

        });
    }
}

// ==================== PORTFOLIO MANAGEMENT ====================
async function loadPortfolioManagement() {
    try {
        const snap = await getDocs(collection(db, 'portfolio'));
        const items = [];
        snap.forEach(d => items.push({ id: d.id, ...d.data() }));
        items.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
        const list = document.getElementById('portfolioList');
        if (items.length === 0) {
            list.innerHTML = '<p style="color:var(--text-tertiary);">No portfolio items yet.</p>';
        } else {
            list.innerHTML = items.map(item => {
                const media = item.mediaType === 'video'
                    ? `<video src="${item.media}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--radius-sm);"></video>`
                    : `<img src="${item.media}" alt="" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--radius-sm);" onerror="this.style.opacity=0.2">`;
                return `<div style="position:relative;">
                    ${media}
                    <h4 style="font-size:0.9rem;margin:0.5rem 0 0.25rem 0;">${utils.escapeHtml(item.title)}</h4>
                    <p style="font-size:0.75rem;color:var(--text-tertiary);margin:0 0 0.5rem 0;">${utils.escapeHtml(item.category||'')}</p>
                    <button class="btn btn-danger btn-sm" style="width:100%;" onclick="JOWEFCOAdmin.deletePortfolio('${item.id}')">Delete</button>
                </div>`;
            }).join('');
        }
    } catch (e) { warn(e); }
    const form = document.getElementById('portfolioForm');
    if (!form.dataset.wired) {
        form.dataset.wired = '1';
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                title: document.getElementById('portfolioTitle').value.trim(),
                category: document.getElementById('portfolioCategory').value,
                description: document.getElementById('portfolioDescription').value.trim(),
                mediaType: document.getElementById('portfolioMediaType').value,
                media: document.getElementById('portfolioMediaUrl').value.trim(),
                createdAt: Timestamp.now()
            };
            try {
                await addDoc(collection(db, 'portfolio'), payload);
                utils.showToast('Portfolio item added', 'success');
                form.reset();
                await loadPortfolioManagement();
            } catch (e) { warn(e); utils.showToast('Could not add', 'error'); }

        });
    }
}

window.JOWEFCOAdmin.deletePortfolio = async function (id) {
    if (!confirm('Delete this portfolio item?')) return;
    try {
        await fsDeleteDoc(doc(db, 'portfolio', id));
        utils.showToast('Deleted', 'success');
        await loadPortfolioManagement();
    } catch (e) { warn(e); utils.showToast('Could not delete', 'error'); }
};

// ==================== TESTIMONIALS ====================
async function loadTestimonialsManagement() {
    try {
        const snap = await getDocs(collection(db, 'testimonials'));
        allTestimonials = [];
        snap.forEach(d => allTestimonials.push({ id: d.id, ...d.data() }));
        allTestimonials.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
        document.querySelectorAll('#testimonialsTab .filter-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('#testimonialsTab .filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentTestimonialsFilter = btn.dataset.status;
                renderTestimonials();
            };
        });
        renderTestimonials();
    } catch (e) { warn(e); }
}

function renderTestimonials() {
    const list = document.getElementById('testimonialsList');
    if (!list) return;
    const filtered = allTestimonials.filter(t => currentTestimonialsFilter === 'approved' ? t.approved : !t.approved);
    if (filtered.length === 0) {
        list.innerHTML = '<p style="text-align:center;color:var(--text-tertiary);padding:1.5rem;">No reviews found.</p>';
        return;
    }
    list.innerHTML = filtered.map(t => `
        <div class="admin-panel" style="margin-bottom:1rem;">
            <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;">
                <div>
                    <strong>${utils.escapeHtml(t.name)}</strong>
                    ${t.company ? `<span style="color:var(--text-tertiary);"> — ${utils.escapeHtml(t.company)}</span>` : ''}
                </div>
                <div style="color:#F5B301;">${'★'.repeat(t.rating||5)}</div>
            </div>
            <p style="font-size:0.9rem;color:var(--text-secondary);">${utils.escapeHtml(t.text)}</p>
            <div style="display:flex;gap:0.5rem;margin-top:0.85rem;">
                ${!t.approved ? `<button class="btn btn-primary btn-sm" onclick="JOWEFCOAdmin.approveTestimonial('${t.id}')">Approve</button>` : ''}
                <button class="btn btn-danger btn-sm" onclick="JOWEFCOAdmin.deleteTestimonial('${t.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

window.JOWEFCOAdmin.approveTestimonial = async function (id) {
    try {
        await updateDoc(doc(db, 'testimonials', id), { approved: true });
        utils.showToast('Review approved', 'success');
        await loadTestimonialsManagement();
    } catch (e) { warn(e); utils.showToast('Could not approve', 'error'); }
};
window.JOWEFCOAdmin.deleteTestimonial = async function (id) {
    if (!confirm('Delete this review?')) return;
    try {
        await fsDeleteDoc(doc(db, 'testimonials', id));
        utils.showToast('Deleted', 'success');
        await loadTestimonialsManagement();
    } catch (e) { warn(e); utils.showToast('Could not delete', 'error'); }
};

// ==================== CONTACT SETTINGS ====================
async function loadContactSettings() {
    try {
        const snap = await getDoc(doc(db, 'settings', 'contact'));
        if (snap.exists()) {
            const d = snap.data();
            document.getElementById('contactPhoneInput').value = d.phone || '';
            document.getElementById('contactWhatsappInput').value = d.whatsapp || '';
            document.getElementById('contactEmailInput').value = d.email || '';
            document.getElementById('contactAddressInput').value = d.address || '';
        }
    } catch (e) { warn(e); }
    const form = document.getElementById('contactForm');
    if (!form.dataset.wired) {
        form.dataset.wired = '1';
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                phone: document.getElementById('contactPhoneInput').value,
                whatsapp: document.getElementById('contactWhatsappInput').value,
                email: document.getElementById('contactEmailInput').value,
                address: document.getElementById('contactAddressInput').value
            };
            try {
                await setDoc(doc(db, 'settings', 'contact'), payload, { merge: true });
                utils.showToast('Contact info saved', 'success');
                // Instantly refresh the contact info displayed on the admin page footer
                window.JOWEFCO.applyContactInfoNow();
            } catch (e) { warn(e); utils.showToast('Could not save', 'error'); }

        });
    }
}

// ==================== SOCIAL LINKS ====================
async function loadSocialSettings() {
    try {
        const snap = await getDocs(collection(db, 'socialLinks'));
        const list = document.getElementById('socialLinksList');
        if (snap.empty) {
            list.innerHTML = '<p style="color:var(--text-tertiary);">No social links yet.</p>';
        } else {
            list.innerHTML = '';
            snap.forEach(d => {
                const data = d.data();
                const div = document.createElement('div');
                div.className = 'card';
                div.innerHTML = `<div class="card-body" style="text-align:center;">
                    <strong style="text-transform:capitalize;">${utils.escapeHtml(data.platform)}</strong>
                    <p style="font-size:0.78rem;color:var(--text-tertiary);word-break:break-all;margin:0.5rem 0;">${utils.escapeHtml(data.url)}</p>
                    <button class="btn btn-danger btn-sm" style="width:100%;" onclick="JOWEFCOAdmin.deleteSocial('${d.id}')">Delete</button>
                </div>`;
                list.appendChild(div);
            });
        }
    } catch (e) { warn(e); }
    const form = document.getElementById('socialForm');
    if (!form.dataset.wired) {
        form.dataset.wired = '1';
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const platform = document.getElementById('socialPlatform').value;
            const url = document.getElementById('socialUrl').value.trim();
            if (!url) return;
            try {
                // Use platform as document ID (one link per platform)
                await setDoc(doc(db, 'socialLinks', platform), { platform, url, createdAt: Timestamp.now() });
                utils.showToast('Social link saved', 'success');
                form.reset();
                await loadSocialSettings();
            } catch (e) { warn(e); utils.showToast('Could not save', 'error'); }

        });
    }
}

window.JOWEFCOAdmin.deleteSocial = async function (id) {
    try {
        await fsDeleteDoc(doc(db, 'socialLinks', id));
        utils.showToast('Deleted', 'success');
        await loadSocialSettings();
    } catch (e) { warn(e); utils.showToast('Could not delete', 'error'); }
};

// ==================== PAYMENT SETTINGS (Bank Transfer) ====================
// Reads / writes the single `settings/payment` doc. The bank details are
// shown to customers after they agree the order on WhatsApp — they bank-
// transfer the agreed amount and send the receipt in the same chat.
async function loadPaymentSettings() {
    try {
        const snap = await getDoc(doc(db, 'settings', 'payment'));
        if (snap.exists()) {
            const d = snap.data();
            document.getElementById('bankNameInput').value = d.bankName || '';
            document.getElementById('accountNameInput').value = d.accountName || '';
            document.getElementById('accountNumberInput').value = d.accountNumber || '';
            document.getElementById('paymentInstructionsInput').value = d.paymentInstructions || '';
        }
    } catch (e) { warn(e); }
    const form = document.getElementById('paymentsForm');
    if (!form.dataset.wired) {
        form.dataset.wired = '1';
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                bankName: document.getElementById('bankNameInput').value.trim(),
                accountName: document.getElementById('accountNameInput').value.trim(),
                accountNumber: document.getElementById('accountNumberInput').value.trim(),
                paymentInstructions: document.getElementById('paymentInstructionsInput').value.trim(),
                paymentMethod: 'manual',
                updatedAt: Timestamp.now()
            };
            try {
                await setDoc(doc(db, 'settings', 'payment'), payload, { merge: true });
                utils.showToast('Bank transfer details saved', 'success');
                window.JOWEFCO.applyPaymentNow();
            } catch (e) { warn(e); utils.showToast('Could not save', 'error'); }

        });
    }
}

// ==================== WHATSAPP SETTINGS ====================
// Reads / writes `settings/whatsapp`. The number is the one customers
// reach when they click "Order on WhatsApp" on a product page. The
// default message is the opening line of the prefilled WhatsApp chat.
async function loadWhatsAppSettings() {
    try {
        const snap = await getDoc(doc(db, 'settings', 'whatsapp'));
        if (snap.exists()) {
            const d = snap.data();
            document.getElementById('whatsappNumberInput').value = d.whatsappNumber || '';
            document.getElementById('whatsappDefaultMessageInput').value = d.defaultOrderMessage || '';
            document.getElementById('whatsappInstructionsInput').value = d.instructions || '';
        }
    } catch (e) { warn(e); }
    const form = document.getElementById('whatsappForm');
    if (!form.dataset.wired) {
        form.dataset.wired = '1';
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                whatsappNumber: document.getElementById('whatsappNumberInput').value.trim(),
                defaultOrderMessage: document.getElementById('whatsappDefaultMessageInput').value.trim(),
                instructions: document.getElementById('whatsappInstructionsInput').value.trim(),
                updatedAt: Timestamp.now()
            };
            try {
                await setDoc(doc(db, 'settings', 'whatsapp'), payload, { merge: true });
                utils.showToast('WhatsApp settings saved', 'success');
                window.JOWEFCO.applyWhatsAppNow();
            } catch (e) { warn(e); utils.showToast('Could not save', 'error'); }

        });
    }
}

// ==================== BUSINESS SETTINGS (workshop, delivery) ====================
// Reads / writes `settings/business`. The workshop coordinates power
// the "Get Directions to Workshop" button on product pages.
async function loadBusinessSettings() {
    try {
        const snap = await getDoc(doc(db, 'settings', 'business'));
        if (snap.exists()) {
            const d = snap.data();
            document.getElementById('businessNameInput').value = d.businessName || '';
            document.getElementById('workshopAddressInput').value = d.workshopAddress || '';
            document.getElementById('latitudeInput').value = (typeof d.latitude === 'number') ? d.latitude : '';
            document.getElementById('longitudeInput').value = (typeof d.longitude === 'number') ? d.longitude : '';
            document.getElementById('mapsUrlInput').value = d.mapsUrl || '';
            document.getElementById('openingHoursInput').value = d.openingHours || '';
            document.getElementById('deliveryCoverageInput').value = d.deliveryCoverage || '';
        }
    } catch (e) { warn(e); }
    const form = document.getElementById('businessForm');
    if (!form.dataset.wired) {
        form.dataset.wired = '1';
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const latStr = document.getElementById('latitudeInput').value.trim();
            const lngStr = document.getElementById('longitudeInput').value.trim();
            const payload = {
                businessName: document.getElementById('businessNameInput').value.trim(),
                workshopAddress: document.getElementById('workshopAddressInput').value.trim(),
                latitude: latStr === '' ? null : parseFloat(latStr),
                longitude: lngStr === '' ? null : parseFloat(lngStr),
                mapsUrl: document.getElementById('mapsUrlInput').value.trim(),
                openingHours: document.getElementById('openingHoursInput').value.trim(),
                deliveryCoverage: document.getElementById('deliveryCoverageInput').value.trim(),
                updatedAt: Timestamp.now()
            };
            try {
                await setDoc(doc(db, 'settings', 'business'), payload, { merge: true });
                utils.showToast('Business settings saved', 'success');
                window.JOWEFCO.applyBusinessNow();
            } catch (e) { warn(e); utils.showToast('Could not save', 'error'); }

        });
    }
}

// ==================== USERS MANAGEMENT ====================
async function loadUsersManagement() {
    try {
        const snap = await getDocs(collection(db, 'users'));
        const list = document.getElementById('usersList');
        if (snap.empty) {
            list.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-tertiary);padding:1.5rem;">No users yet.</td></tr>';
            return;
        }
        const users = [];
        snap.forEach(d => users.push(d.data()));
        users.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
        list.innerHTML = users.map(u => `<tr>
            <td>${utils.escapeHtml(u.name||'')}</td>
            <td>${utils.escapeHtml(u.phone||'')}</td>
            <td style="font-size:0.85rem;color:var(--text-tertiary);">${utils.formatDate(u.createdAt)}</td>
            <td style="font-size:0.85rem;color:var(--text-tertiary);">${utils.formatDate(u.lastVisit)}</td>
        </tr>`).join('');
    } catch (e) { warn(e); }
}

// ==================== BRANDING SETTINGS (Logo + tagline) ====================
async function loadBrandingSettings() {
    try {
        const snap = await getDoc(doc(db, 'settings', 'branding'));
        if (snap.exists()) {
            const d = snap.data();
            document.getElementById('brandingLogoUrl').value = d.logoUrl || '';
            document.getElementById('brandingSiteName').value = d.siteName || '';
            document.getElementById('brandingTagline').value = d.tagline || '';
            // Show preview if logo URL set
            if (d.logoUrl) showBrandingPreview(d.logoUrl);
        }
    } catch (e) { warn(e); }

    const form = document.getElementById('brandingForm');
    if (!form.dataset.wired) {
        form.dataset.wired = '1';

        // Preview button
        document.getElementById('previewLogoBtn').addEventListener('click', () => {
            const url = document.getElementById('brandingLogoUrl').value.trim();
            if (!url) {
                utils.showToast('Enter a logo URL first', 'error');
                return;
            }
            showBrandingPreview(url);
        });

        // Save
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                logoUrl: document.getElementById('brandingLogoUrl').value.trim(),
                siteName: document.getElementById('brandingSiteName').value.trim(),
                tagline: document.getElementById('brandingTagline').value.trim(),
                updatedAt: Timestamp.now()
            };
            try {
                await setDoc(doc(db, 'settings', 'branding'), payload, { merge: true });
                utils.showToast('Branding saved', 'success');
                // INSTANTLY apply the new logo to the admin UI (sidebar, login
                // screen, favicon) without a page reload. Other public pages
                // will pick it up on next visit (or immediately if common.js
                // is reloaded).
                await window.JOWEFCO.applyBrandingNow();
            } catch (e) {
                warn(e);
                utils.showToast('Could not save branding', 'error');
            }
        });

        // Reset to default
        document.getElementById('resetBrandingBtn').addEventListener('click', async () => {
            if (!confirm('Reset logo to the default logo.jpg? This will clear the saved logo URL.')) return;
            try {
                await setDoc(doc(db, 'settings', 'branding'), {
                    logoUrl: '',
                    updatedAt: Timestamp.now()
                }, { merge: true });
                document.getElementById('brandingLogoUrl').value = '';
                showBrandingPreview('');
                utils.showToast('Reset to default logo', 'success');
                // Instantly restore the default logo across the admin UI
                await window.JOWEFCO.applyBrandingNow();
            } catch (e) {
                warn(e);
                utils.showToast('Could not reset', 'error');
            }
        });
    }
}

function showBrandingPreview(url) {
    const preview = document.getElementById('brandingLogoPreview');
    if (!preview) return;
    if (!url) {
        preview.innerHTML = '<p style="color:var(--text-tertiary);font-size:0.85rem;margin:0;">Using default logo.jpg</p>';
        return;
    }
    preview.innerHTML = `<img src="${url}" alt="Logo preview" style="max-width:100%;max-height:140px;object-fit:contain;" onerror="this.parentElement.innerHTML='<p style=\\'color:var(--danger);font-size:0.85rem;margin:0;\\'>Could not load image. Check the URL.</p>'">`;
}

// ==================== INIT ====================
async function initializeDashboard() {
    // Load current tab
    await loadTabContent(currentTab);
}

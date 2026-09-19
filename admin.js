// ====================================================================
// JOWEFCO ADMIN.JS — Full admin dashboard
// Authentication via Firebase Auth (sign-in + secure password reset).
// Manages: dashboard stats, products (full CRUD), orders, projects,
// hero, portfolio, testimonials, contact, social, payments, users.
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
    utils.showLoading(true, 'Signing in...');
    try {
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

// Theme toggle (in admin topbar) — common.js already wires the one with id="themeToggle"
// but we want to confirm we don't re-wire it twice. common.js attaches only if not already.

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
    const titles = { dashboard:'Dashboard', shop:'Products', orders:'Orders', projects:'Project Inquiries', hero:'Hero Section', portfolio:'Portfolio', testimonials:'Reviews', contact:'Contact Info', social:'Social Links', payments:'Payment Settings', users:'Users' };
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
        case 'users': await loadUsersManagement(); break;
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
        utils.showLoading(true, 'Deleting product...');
        try {
            await fsDeleteDoc(doc(db, 'shopItems', id));
            utils.showToast('Product deleted', 'success');
            await loadProducts();
        } catch (e) {
            warn(e);
            utils.showToast('Could not delete product', 'error');
        } finally {
            utils.showLoading(false);
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
        name, description, price, stock, category, mediaType, media, available, featured,
        // Keep legacy fields for backwards compatibility
        priceMin: price, priceMax: price
    };

    utils.showLoading(true, id ? 'Updating product...' : 'Adding product...');
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
        utils.showLoading(false);
    }
}

// ==================== ORDERS MANAGEMENT ====================
async function loadOrdersManagement() {
    if (ordersListener) { ordersListener(); ordersListener = null; }
    ordersListener = onSnapshot(collection(db, 'shopOrders'), async () => {
        await loadOrders();
    });
    document.querySelectorAll('#ordersTab .filter-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('#ordersTab .filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentOrdersFilter = btn.dataset.status;
            renderOrdersTable();
        };
    });
}

async function loadOrders() {
    try {
        const snap = await getDocs(collection(db, 'shopOrders'));
        allOrders = [];
        snap.forEach(d => allOrders.push({ id: d.id, ...d.data() }));
        allOrders.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
        renderOrdersTable();
    } catch (e) { warn(e); }
}

function renderOrdersTable() {
    const list = document.getElementById('ordersList');
    if (!list) return;
    let filtered = allOrders;
    if (currentOrdersFilter !== 'all') {
        filtered = allOrders.filter(o => (o.orderStatus || 'requested') === currentOrdersFilter);
    }
    if (filtered.length === 0) {
        list.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-tertiary);padding:1.5rem;">No orders found.</td></tr>';
        return;
    }
    list.innerHTML = filtered.map(o => {
        const items = (o.items && o.items.length)
            ? `${o.items.length} item(s): ${o.items.map(i => i.productName).join(', ').slice(0, 60)}`
            : utils.escapeHtml(o.productName || '—');
        return `<tr>
            <td><strong>${utils.escapeHtml(o.customerName||'')}</strong><br><span style="font-size:0.78rem;color:var(--text-tertiary);">${utils.escapeHtml(o.customerPhone||'')}</span></td>
            <td style="max-width:280px;font-size:0.85rem;">${items}</td>
            <td><strong>${utils.formatPrice(o.amount||0)}</strong></td>
            <td><span class="status-pill ${o.paymentStatus||'pending'}">${o.paymentStatus||'pending'}</span></td>
            <td><span class="status-pill ${o.orderStatus||'requested'}">${o.orderStatus||'requested'}</span></td>
            <td style="font-size:0.85rem;color:var(--text-tertiary);">${utils.formatDate(o.createdAt)}</td>
            <td><button class="btn btn-outline btn-sm" onclick="JOWEFCOAdmin.viewOrder('${o.id}')">View</button></td>
        </tr>`;
    }).join('');
}

window.JOWEFCOAdmin.viewOrder = function (id) {
    const o = allOrders.find(x => x.id === id);
    if (!o) return;
    const itemsList = (o.items && o.items.length)
        ? `<table style="width:100%;border-collapse:collapse;font-size:0.9rem;margin-top:0.5rem;">
            <thead><tr><th style="text-align:left;padding:0.4rem 0;">Item</th><th style="text-align:center;padding:0.4rem 0;">Qty</th><th style="text-align:right;padding:0.4rem 0;">Price</th></tr></thead>
            <tbody>${o.items.map(i => `<tr><td style="padding:0.4rem 0;">${utils.escapeHtml(i.productName)}</td><td style="text:center;padding:0.4rem 0;">${i.quantity}</td><td style="text-align:right;padding:0.4rem 0;">${utils.formatPrice(i.price)}</td></tr>`).join('')}</tbody>
          </table>`
        : `<p>${utils.escapeHtml(o.productName||'')}</p>`;
    const body = document.getElementById('orderModalBody');
    body.innerHTML = `
        <p><strong>Customer:</strong> ${utils.escapeHtml(o.customerName||'')}</p>
        <p><strong>Phone:</strong> ${utils.escapeHtml(o.customerPhone||'')}</p>
        ${o.customerEmail ? `<p><strong>Email:</strong> ${utils.escapeHtml(o.customerEmail)}</p>` : ''}
        ${o.deliveryLocation ? `<p><strong>Delivery:</strong> ${utils.escapeHtml(o.deliveryLocation)}</p>` : ''}
        ${o.notes ? `<p><strong>Notes:</strong> ${utils.escapeHtml(o.notes)}</p>` : ''}
        <h3 style="margin-top:1.25rem;">Items</h3>
        ${itemsList}
        <p style="margin-top:1rem;"><strong>Total:</strong> ${utils.formatPrice(o.amount||0)}</p>
        <p><strong>Payment:</strong> <span class="status-pill ${o.paymentStatus||'pending'}">${o.paymentStatus||'pending'}</span></p>
        <p><strong>Status:</strong> <span class="status-pill ${o.orderStatus||'requested'}">${o.orderStatus||'requested'}</span></p>
        <p><strong>Date:</strong> ${utils.formatDate(o.createdAt)}</p>
        <h3 style="margin-top:1.25rem;">Update Status</h3>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
            <button class="btn btn-outline btn-sm" onclick="JOWEFCOAdmin.updateOrder('${o.id}','requested')">Requested</button>
            <button class="btn btn-outline btn-sm" onclick="JOWEFCOAdmin.updateOrder('${o.id}','confirmed')">Confirmed</button>
            <button class="btn btn-outline btn-sm" onclick="JOWEFCOAdmin.updateOrder('${o.id}','paid')">Paid</button>
            <button class="btn btn-outline btn-sm" onclick="JOWEFCOAdmin.updateOrder('${o.id}','completed')">Completed</button>
            <button class="btn btn-danger btn-sm" onclick="JOWEFCOAdmin.updateOrder('${o.id}','cancelled')">Cancel</button>
        </div>
    `;
    document.getElementById('orderModal').classList.add('active');
};

window.JOWEFCOAdmin.updateOrder = async function (id, status) {
    utils.showLoading(true, 'Updating order...');
    try {
        await updateDoc(doc(db, 'shopOrders', id), { orderStatus: status });
        utils.showToast(`Order marked as ${status}`, 'success');
        document.getElementById('orderModal').classList.remove('active');
        await loadOrders();
    } catch (e) {
        warn(e);
        utils.showToast('Could not update order', 'error');
    } finally {
        utils.showLoading(false);
    }
};

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
            utils.showLoading(true, 'Saving...');
            try {
                await setDoc(doc(db, 'settings', 'hero'), payload, { merge: true });
                utils.showToast('Hero content saved', 'success');
            } catch (e) { warn(e); utils.showToast('Could not save', 'error'); }
            finally { utils.showLoading(false); }
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
            utils.showLoading(true, 'Adding...');
            try {
                await addDoc(collection(db, 'portfolio'), payload);
                utils.showToast('Portfolio item added', 'success');
                form.reset();
                await loadPortfolioManagement();
            } catch (e) { warn(e); utils.showToast('Could not add', 'error'); }
            finally { utils.showLoading(false); }
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
            utils.showLoading(true, 'Saving...');
            try {
                await setDoc(doc(db, 'settings', 'contact'), payload, { merge: true });
                utils.showToast('Contact info saved', 'success');
            } catch (e) { warn(e); utils.showToast('Could not save', 'error'); }
            finally { utils.showLoading(false); }
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
            utils.showLoading(true, 'Saving...');
            try {
                // Use platform as document ID (one link per platform)
                await setDoc(doc(db, 'socialLinks', platform), { platform, url, createdAt: Timestamp.now() });
                utils.showToast('Social link saved', 'success');
                form.reset();
                await loadSocialSettings();
            } catch (e) { warn(e); utils.showToast('Could not save', 'error'); }
            finally { utils.showLoading(false); }
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

// ==================== PAYMENT SETTINGS ====================
async function loadPaymentSettings() {
    try {
        const snap = await getDoc(doc(db, 'settings', 'payments'));
        if (snap.exists()) {
            const d = snap.data();
            document.getElementById('currencyCode').value = d.currency || 'NGN';
            document.getElementById('currencySymbol').value = d.currencySymbol || '₦';
            if (d.paystack) {
                document.getElementById('paystackEnabled').value = String(d.paystack.enabled || false);
                document.getElementById('paystackKey').value = d.paystack.publicKey || '';
            }
            if (d.flutterwave) {
                document.getElementById('flutterwaveEnabled').value = String(d.flutterwave.enabled || false);
                document.getElementById('flutterwaveKey').value = d.flutterwave.publicKey || '';
            }
        }
    } catch (e) { warn(e); }
    const form = document.getElementById('paymentsForm');
    if (!form.dataset.wired) {
        form.dataset.wired = '1';
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                currency: document.getElementById('currencyCode').value || 'NGN',
                currencySymbol: document.getElementById('currencySymbol').value || '₦',
                paystack: {
                    enabled: document.getElementById('paystackEnabled').value === 'true',
                    publicKey: document.getElementById('paystackKey').value
                },
                flutterwave: {
                    enabled: document.getElementById('flutterwaveEnabled').value === 'true',
                    publicKey: document.getElementById('flutterwaveKey').value
                }
            };
            utils.showLoading(true, 'Saving...');
            try {
                await setDoc(doc(db, 'settings', 'payments'), payload, { merge: true });
                utils.showToast('Payment settings saved', 'success');
            } catch (e) { warn(e); utils.showToast('Could not save', 'error'); }
            finally { utils.showLoading(false); }
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

// ==================== INIT ====================
async function initializeDashboard() {
    // Load current tab
    await loadTabContent(currentTab);
}

// Expose globally for inline handlers
window.JOWEFCOAdmin = window.JOWEFCOAdmin || {};
Object.assign(window.JOWEFCOAdmin, {
    // functions already attached above
});

// ====================================================================
// JOWEFCO COMMON.JS
// Shared script for ALL pages. Handles:
//   • Firebase initialization (Firestore + optional Auth for password reset)
//   • Theme toggle (light/dark) with localStorage persistence
//   • Navbar (mobile menu + scrolled state + active link)
//   • Footer (load contact info + social links)
//   • Cart badge (update on every page)
//   • WhatsApp float button (auto-fill from settings)
//   • Scroll reveal animations
//   • Cart drawer (shared UI across all pages)
//   • Checkout flow integration with shop.js (when present)
// ====================================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import {
    getFirestore, collection, getDocs, doc, getDoc, setDoc, onSnapshot,
    query, orderBy, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyB0KdLj5TnV_9k0jWFz_-2kHSAYHyG8dq0",
    authDomain: "jowefco.firebaseapp.com",
    projectId: "jowefco",
    storageBucket: "jowefco.firebasestorage.app",
    messagingSenderId: "698975205460",
    appId: "1:698975205460:web:1e7539da1fc748932115c1",
    measurementId: "G-5NE7NQQBQE"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Expose for inline scripts (shop.js, etc.)
window.JOWEFCO = window.JOWEFCO || {};
window.JOWEFCO.db = db;
window.JOWEFCO.firebaseConfig = firebaseConfig;

// ==================== THEME TOGGLE ====================
const THEME_KEY = 'jowefco_theme';

function getStoredTheme() {
    return localStorage.getItem(THEME_KEY) || 'light';
}
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    // Update meta theme-color for mobile browsers
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
        metaTheme.setAttribute('content', theme === 'dark' ? '#0A1929' : '#003B7A');
    }
}
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'light' ? 'dark' : 'light');
}
// Apply theme IMMEDIATELY (before page paints to avoid flash)
applyTheme(getStoredTheme());
window.JOWEFCO.toggleTheme = toggleTheme;

// ==================== SOCIAL ICONS ====================
const SOCIAL_ICONS = {
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
    twitter: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>'
};
window.JOWEFCO.SOCIAL_ICONS = SOCIAL_ICONS;

// ==================== DEFAULT CONTACT INFO (fallback) ====================
const DEFAULT_CONTACT = {
    phone: '+234 801 234 5678',
    whatsapp: '2348012345678',
    email: 'info@jowefco.com',
    address: 'Port Harcourt, Rivers State, Nigeria'
};

// ==================== UTILITIES ====================
window.JOWEFCO.utils = {
    generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },
    getUserFromStorage() {
        const userId = localStorage.getItem('jowefco_user_id');
        const userName = localStorage.getItem('jowefco_user_name');
        const userPhone = localStorage.getItem('jowefco_user_phone');
        if (userId && userName && userPhone) {
            return { id: userId, name: userName, phone: userPhone };
        }
        return null;
    },
    saveUserToStorage(user) {
        localStorage.setItem('jowefco_user_id', user.id);
        localStorage.setItem('jowefco_user_name', user.name);
        localStorage.setItem('jowefco_user_phone', user.phone);
    },
    async registerUserInFirestore(user) {
        try {
            await setDoc(doc(db, 'users', user.id), {
                id: user.id,
                name: user.name,
                phone: user.phone,
                createdAt: Timestamp.now(),
                lastVisit: Timestamp.now()
            }, { merge: true });
        } catch (e) {
            console.warn('Could not register user in Firestore:', e);
        }
    },
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => toast.classList.remove('show'), 3500);
    },
    showLoading(show = true, message = 'Please wait...') {
        const overlay = document.getElementById('loadingOverlay');
        if (!overlay) return;
        if (show) {
            const p = overlay.querySelector('p');
            if (p) p.textContent = message;
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    },
    formatPrice(amount, symbol = '₦') {
        const num = parseFloat(amount) || 0;
        return `${symbol}${num.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    },
    escapeHtml(str) {
        if (str == null) return '';
        return String(str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    },
    formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-NG', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }
};

let _permissionsWarned = false;
function warnPermissionsOnce(error) {
    if (_permissionsWarned) return;
    if (error?.code === 'permission-denied') {
        _permissionsWarned = true;
        console.warn(
            '%c[JOWEFCO] Firestore permissions denied — deploy rules: firebase deploy --only firestore:rules',
            'color: #e8a735; font-weight: bold;'
        );
    }
}
window.JOWEFCO.warnPermissionsOnce = warnPermissionsOnce;

// ==================== NAVBAR ====================
function initNavbar() {
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navToggle.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
        // Close menu when a link is clicked
        navMenu.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', () => {
                navToggle.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    }

    if (navbar) {
        const onScroll = () => {
            if (window.pageYOffset > 60) navbar.classList.add('scrolled');
            else navbar.classList.remove('scrolled');
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    // Theme toggle button
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
}

// ==================== LOAD CONTACT INFO ====================
async function loadContactInfo() {
    let info = { ...DEFAULT_CONTACT };
    try {
        const snap = await getDoc(doc(db, 'settings', 'contact'));
        if (snap.exists()) {
            info = { ...info, ...snap.data() };
        }
    } catch (e) {
        warnPermissionsOnce(e);
    }
    applyContactInfo(info);
    window.JOWEFCO.contact = info;
    return info;
}

function applyContactInfo(info) {
    const phone = info.phone || DEFAULT_CONTACT.phone;
    const whatsapp = info.whatsapp || DEFAULT_CONTACT.whatsapp;
    const email = info.email || DEFAULT_CONTACT.email;
    const address = info.address || DEFAULT_CONTACT.address;

    // Footer contact list items
    const footerPhone = document.querySelector('#footerPhone span');
    const footerEmail = document.querySelector('#footerEmail span');
    const footerAddress = document.querySelector('#footerAddress span');
    if (footerPhone) footerPhone.textContent = phone;
    if (footerEmail) footerEmail.textContent = email;
    if (footerAddress) footerAddress.textContent = address;

    // Any element with data-contact="phone|email|address|whatsapp"
    document.querySelectorAll('[data-contact="phone"]').forEach(el => { el.textContent = phone; });
    document.querySelectorAll('[data-contact="email"]').forEach(el => { el.textContent = email; });
    document.querySelectorAll('[data-contact="address"]').forEach(el => { el.textContent = address; });
    document.querySelectorAll('[data-contact="whatsapp"]').forEach(el => { el.textContent = phone; });

    // href auto-fill
    document.querySelectorAll('[data-href="phone"]').forEach(el => { el.href = 'tel:' + phone.replace(/\s+/g, ''); });
    document.querySelectorAll('[data-href="email"]').forEach(el => { el.href = 'mailto:' + email; });
    document.querySelectorAll('[data-href="whatsapp"]').forEach(el => { el.href = 'https://wa.me/' + whatsapp; });

    // WhatsApp float button
    const waBtn = document.getElementById('whatsappBtn');
    if (waBtn) waBtn.href = 'https://wa.me/' + whatsapp;
}

// ==================== LOAD SOCIAL LINKS ====================
async function loadSocialLinks() {
    const container = document.getElementById('footerSocial');
    if (!container) return;
    try {
        const snap = await getDocs(collection(db, 'socialLinks'));
        if (snap.empty) { container.innerHTML = ''; return; }
        container.innerHTML = '';
        snap.forEach(docSnap => {
            const d = docSnap.data();
            if (!d.url || !d.platform) return;
            const a = document.createElement('a');
            a.href = d.url;
            a.target = '_blank';
            a.rel = 'noopener';
            a.className = 'footer-social-link';
            a.setAttribute('aria-label', d.platform);
            a.innerHTML = SOCIAL_ICONS[d.platform] || '';
            container.appendChild(a);
        });
    } catch (e) {
        warnPermissionsOnce(e);
        container.innerHTML = '';
    }
}

// ==================== CART (shared across all pages) ====================
const CART_KEY = 'jowefco_cart';

function getCart() {
    try {
        return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    } catch (e) { return []; }
}
function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartBadge();
}
function clearCart() {
    localStorage.removeItem(CART_KEY);
    updateCartBadge();
}
function updateCartBadge() {
    const cart = getCart();
    const totalQty = cart.reduce((s, i) => s + (i.quantity || 0), 0);
    document.querySelectorAll('.cart-badge').forEach(b => {
        b.textContent = totalQty;
        b.style.display = totalQty > 0 ? 'flex' : 'none';
    });
}

window.JOWEFCO.cart = {
    get: getCart,
    save: saveCart,
    clear: clearCart,
    add(productId, name, price, imageUrl, qty = 1) {
        const cart = getCart();
        const existing = cart.find(i => i.productId === productId);
        if (existing) {
            existing.quantity += qty;
        } else {
            cart.push({ productId, name, price, imageUrl, quantity: qty });
        }
        saveCart(cart);
        return cart;
    },
    updateQty(productId, qty) {
        const cart = getCart();
        const item = cart.find(i => i.productId === productId);
        if (item) {
            item.quantity = Math.max(1, qty);
            saveCart(cart);
        }
        return cart;
    },
    remove(productId) {
        const cart = getCart().filter(i => i.productId !== productId);
        saveCart(cart);
        return cart;
    },
    getTotal() {
        return getCart().reduce((s, i) => s + (i.price * i.quantity), 0);
    },
    getItemCount() {
        return getCart().reduce((s, i) => s + i.quantity, 0);
    }
};

// ==================== CART DRAWER (rendered on every page that has #cartDrawer) ====================
function renderCartDrawer() {
    const cartBody = document.getElementById('cartBody');
    const cartTotal = document.getElementById('cartTotalAmount');
    const cartCheckoutBtn = document.getElementById('cartCheckoutBtn');
    if (!cartBody) return;

    const cart = getCart();
    if (cart.length === 0) {
        cartBody.innerHTML = `
            <div class="cart-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <p>Your cart is empty</p>
                <p style="font-size:0.85rem; margin-top:0.5rem;">Browse our shop to add products.</p>
            </div>
        `;
        if (cartTotal) cartTotal.textContent = window.JOWEFCO.utils.formatPrice(0);
        if (cartCheckoutBtn) cartCheckoutBtn.disabled = true;
        return;
    }

    cartBody.innerHTML = cart.map(item => `
        <div class="cart-item" data-product-id="${item.productId}">
            <img class="cart-item-image" src="${item.imageUrl || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 80%22%3E%3Crect width=%2280%22 height=%2280%22 fill=%22%23E8EAED%22/%3E%3C/svg%3E'}" alt="${window.JOWEFCO.utils.escapeHtml(item.name)}">
            <div>
                <div class="cart-item-name">${window.JOWEFCO.utils.escapeHtml(item.name)}</div>
                <div class="cart-item-price">${window.JOWEFCO.utils.formatPrice(item.price)} each</div>
                <div class="cart-item-controls">
                    <button class="qty-btn" onclick="JOWEFCO.cartDecrement('${item.productId}')" aria-label="Decrease">−</button>
                    <span class="qty-display">${item.quantity}</span>
                    <button class="qty-btn" onclick="JOWEFCO.cartIncrement('${item.productId}')" aria-label="Increase">+</button>
                    <button class="cart-item-remove" onclick="JOWEFCO.cartRemove('${item.productId}')">Remove</button>
                </div>
            </div>
        </div>
    `).join('');

    if (cartTotal) cartTotal.textContent = window.JOWEFCO.utils.formatPrice(window.JOWEFCO.cart.getTotal());
    if (cartCheckoutBtn) cartCheckoutBtn.disabled = false;
}

window.JOWEFCO.openCart = function () {
    renderCartDrawer();
    document.getElementById('cartDrawer')?.classList.add('open');
    document.getElementById('cartOverlay')?.classList.add('open');
    document.body.style.overflow = 'hidden';
};
window.JOWEFCO.closeCart = function () {
    document.getElementById('cartDrawer')?.classList.remove('open');
    document.getElementById('cartOverlay')?.classList.remove('open');
    document.body.style.overflow = '';
};
window.JOWEFCO.cartIncrement = function (productId) {
    const item = getCart().find(i => i.productId === productId);
    if (item) {
        window.JOWEFCO.cart.updateQty(productId, item.quantity + 1);
        renderCartDrawer();
    }
};
window.JOWEFCO.cartDecrement = function (productId) {
    const item = getCart().find(i => i.productId === productId);
    if (item) {
        const newQty = item.quantity - 1;
        if (newQty <= 0) {
            window.JOWEFCO.cart.remove(productId);
        } else {
            window.JOWEFCO.cart.updateQty(productId, newQty);
        }
        renderCartDrawer();
    }
};
window.JOWEFCO.cartRemove = function (productId) {
    window.JOWEFCO.cart.remove(productId);
    renderCartDrawer();
    window.JOWEFCO.utils.showToast('Removed from cart', 'success');
};

// ==================== SCROLL REVEAL ====================
function initReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ==================== VISITOR REGISTRATION (lightweight) ====================
async function ensureVisitorRegistered() {
    let user = window.JOWEFCO.utils.getUserFromStorage();
    if (user) {
        // Update lastVisit silently
        try {
            await setDoc(doc(db, 'users', user.id), { lastVisit: Timestamp.now() }, { merge: true });
        } catch (e) { /* ignore */ }
        return user;
    }
    // Don't auto-prompt on every page — only on action (checkout / project submit).
    // The contact / projects / shop pages will trigger the registration modal if needed.
    return null;
}

// ==================== INIT ====================
async function init() {
    initNavbar();
    updateCartBadge();
    await Promise.all([
        loadContactInfo(),
        loadSocialLinks(),
        ensureVisitorRegistered()
    ]);
    initReveal();
}

// Run init on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

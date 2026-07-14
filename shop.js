// ==================== FIREBASE CONFIGURATION ====================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getFirestore, collection, getDocs, addDoc, doc, getDoc, setDoc, Timestamp, query, orderBy } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

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

// ==================== GLOBAL STATE ====================
let currentUser = null;
let shopItems = [];
let paymentConfig = { currency: 'NGN', currencySymbol: '₦' };
let activeGateways = {};
let selectedProduct = null;
let selectedPaymentMethod = null;
let paypalSdkLoaded = false;

// ==================== SVG ICON LIBRARY ====================
const SOCIAL_ICONS = {
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
    twitter: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>'
};

const PAYMENT_ICONS = {
    paypal: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm18.804-14.59c-.077-.473-.087-.91-.18-1.295C24.062.901 19.39 0 14.7 0H5.275a.641.641 0 0 0-.633.74L7.99 21.997a.641.641 0 0 0 .633.541h4.55a.641.641 0 0 0 .633-.74l-.65-4.124a.641.641 0 0 1 .633-.74h1.5c4.65 0 7.53-1.873 8.49-5.864.077-.32.137-.654.18-1z"/></svg>',
    paystack: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.36 17.06l-3.49-3.49a.996.996 0 0 1 0-1.41l3.49-3.49c.45-.45 1.21-.13 1.21.51v7.36c0 .64-.76.96-1.21.51z" opacity=".4"/><path d="M7.7 11.46l-3.49 3.49c-.45.45-1.21.13-1.21-.51V7.08c0-.64.76-.96 1.21-.51l3.49 3.49a.996.996 0 0 1 0 1.4z" opacity=".7"/><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".3"/></svg>',
    flutterwave: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.94 8.6v2.32h4.18c.43 0 .86.05 1.27.16 1.43.36 2.16 1.45 2.16 3.02 0 .27-.02.51-.06.74-.36 2.04-1.85 3.13-4.4 3.13h-3.42v-3.32h3.42c.74 0 1.27-.06 1.6-.18.5-.18.74-.55.74-1.1 0-.3-.07-.54-.21-.72-.16-.21-.4-.34-.74-.4-.27-.04-.59-.07-.96-.07h-2.07c-.43 0-.86-.05-1.27-.16-1.43-.36-2.16-1.45-2.16-3.02 0-.27.02-.51.06-.74.36-2.04 1.85-3.13 4.4-3.13h6.7v3.32h-6.7c-.74 0-1.27.06-1.6.18-.5.18-.74.55-.74 1.1 0 .3.07.54.21.72.16.21.4.34.74.4.27.04.59.07.96.07h2.07c.43 0 .86.05 1.27.16 1.43.36 2.16 1.45 2.16 3.02 0 .27-.02.51-.06.74-.36 2.04-1.85 3.13-4.4 3.13H8.7V8.6h6.24z"/></svg>'
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

function showLoading(show = true, message = 'Processing payment...') {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
        const p = overlay.querySelector('p');
        if (p) p.textContent = message;
    }
}

function formatPrice(amount) {
    const num = parseFloat(amount) || 0;
    return `${paymentConfig.currencySymbol}${num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

// ==================== LOAD SHOP ITEMS ====================
async function loadShopItems() {
    const grid = document.getElementById('shopGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="loading-message">Loading products...</div>';

    try {
        const snapshot = await getDocs(collection(db, 'shopItems'));
        if (snapshot.empty) {
            grid.innerHTML = `
                <div class="shop-empty">
                    <div class="shop-empty-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </div>
                    <h3>No Products Available</h3>
                    <p>We're stocking our shop. Please check back soon!</p>
                </div>
            `;
            return;
        }

        shopItems = [];
        snapshot.forEach(docSnap => {
            shopItems.push({ ...docSnap.data(), id: docSnap.id });
        });
        shopItems.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
        });

        grid.innerHTML = '';
        shopItems.forEach((item, index) => {
            const card = createShopItemCard(item);
            card.style.animationDelay = `${index * 0.08}s`;
            grid.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading shop items:', error);
        grid.innerHTML = '<div class="loading-message">Could not load products. Please try again later.</div>';
    }
}

function createShopItemCard(item) {
    const div = document.createElement('div');
    div.className = 'shop-item-card';
    div.style.animation = 'fadeInUp 0.6s ease-out backwards';

    let mediaHtml;
    if (item.mediaType === 'video') {
        mediaHtml = `<video class="shop-item-media" src="${item.media}" muted loop playsinline></video>`;
    } else {
        mediaHtml = `<img class="shop-item-media" src="${item.media}" alt="${item.name}" loading="lazy">`;
    }

    const priceMin = parseFloat(item.priceMin) || 0;
    const priceMax = parseFloat(item.priceMax) || 0;
    const priceText = priceMin === priceMax
        ? `<span class="price-value">${formatPrice(priceMax)}</span>`
        : `<span class="price-range">${formatPrice(priceMin)} - ${formatPrice(priceMax)}</span>`;

    div.innerHTML = `
        <div class="shop-item-media">${mediaHtml}</div>
        <div class="shop-item-content">
            ${item.category ? `<div class="item-card-meta" style="margin-bottom: 0.5rem; font-size: 0.7rem;">${item.category}</div>` : ''}
            <h3>${item.name}</h3>
            <p class="shop-item-description">${item.description}</p>
            <div class="shop-item-price">
                <span class="price-label">Price:</span>
                ${priceText}
            </div>
            <button class="btn btn-primary btn-full" onclick="openBuyModal('${item.id}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Buy Now
            </button>
        </div>
    `;
    return div;
}

// ==================== LOAD PAYMENT CONFIG ====================
async function loadPaymentConfig() {
    try {
        const paymentsDoc = await getDoc(doc(db, 'settings', 'payments'));
        if (paymentsDoc.exists()) {
            const data = paymentsDoc.data();
            paymentConfig.currency = data.currency || 'NGN';
            paymentConfig.currencySymbol = data.currencySymbol || '₦';

            // Update currency symbol display
            const symbolEl = document.getElementById('currencySymbol');
            if (symbolEl) symbolEl.textContent = paymentConfig.currencySymbol;

            // Build list of active gateways
            activeGateways = {};
            if (data.paypal && data.paypal.enabled && data.paypal.clientId) {
                activeGateways.paypal = { clientId: data.paypal.clientId };
            }
            if (data.paystack && data.paystack.enabled && data.paystack.publicKey) {
                activeGateways.paystack = { publicKey: data.paystack.publicKey };
            }
            if (data.flutterwave && data.flutterwave.enabled && data.flutterwave.publicKey) {
                activeGateways.flutterwave = { publicKey: data.flutterwave.publicKey };
            }
        }
    } catch (error) {
        console.error('Error loading payment config:', error);
    }
}

// ==================== BUY MODAL ====================
window.openBuyModal = function (productId) {
    if (!currentUser) {
        showToast('Please wait while we set up your profile...', 'info');
        return;
    }

    selectedProduct = shopItems.find(p => p.id === productId);
    if (!selectedProduct) {
        showToast('Product not found', 'error');
        return;
    }

    selectedPaymentMethod = null;

    // Fill product preview
    const productPreview = document.getElementById('buyModalProduct');
    let mediaHtml;
    if (selectedProduct.mediaType === 'video') {
        mediaHtml = `<video src="${selectedProduct.media}" muted loop playsinline></video>`;
    } else {
        mediaHtml = `<img src="${selectedProduct.media}" alt="${selectedProduct.name}">`;
    }
    productPreview.innerHTML = `
        ${mediaHtml}
        <div class="buy-modal-product-info">
            <h4>${selectedProduct.name}</h4>
            <p>${selectedProduct.description.substring(0, 80)}${selectedProduct.description.length > 80 ? '...' : ''}</p>
        </div>
    `;

    // Set price range hint
    const priceMin = parseFloat(selectedProduct.priceMin) || 0;
    const priceMax = parseFloat(selectedProduct.priceMax) || 0;
    const hint = document.getElementById('priceRangeHint');
    if (priceMin === priceMax) {
        hint.textContent = `Fixed price: ${formatPrice(priceMax)}`;
        document.getElementById('buyOfferPrice').value = priceMax;
        document.getElementById('buyOfferPrice').min = priceMax;
        document.getElementById('buyOfferPrice').max = priceMax;
    } else {
        hint.textContent = `Acceptable range: ${formatPrice(priceMin)} to ${formatPrice(priceMax)}`;
        document.getElementById('buyOfferPrice').value = priceMax;
        document.getElementById('buyOfferPrice').min = priceMin;
        document.getElementById('buyOfferPrice').max = priceMax;
    }

    // Pre-fill user info
    document.getElementById('buyCustomerName').value = currentUser.name;
    document.getElementById('buyCustomerPhone').value = currentUser.phone;

    // Render payment methods
    renderPaymentMethods();

    // Show modal
    document.getElementById('buyModal').classList.add('active');
    const modal = document.getElementById('buyModal');
    modal.querySelector('.modal-close').onclick = () => modal.classList.remove('active');
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
};

function renderPaymentMethods() {
    const container = document.getElementById('paymentMethods');
    const unavailable = document.getElementById('paymentUnavailable');
    const proceedBtn = document.getElementById('proceedPaymentBtn');

    const gateways = Object.keys(activeGateways);

    if (gateways.length === 0) {
        container.innerHTML = '';
        unavailable.style.display = 'block';
        proceedBtn.disabled = true;
        return;
    }

    unavailable.style.display = 'none';
    container.innerHTML = '';

    const gatewayLabels = {
        paypal: 'PayPal',
        paystack: 'Paystack',
        flutterwave: 'Flutterwave'
    };

    gateways.forEach(gateway => {
        const method = document.createElement('div');
        method.className = 'payment-method';
        method.innerHTML = `
            ${PAYMENT_ICONS[gateway]}
            <span class="payment-method-name">${gatewayLabels[gateway]}</span>
        `;
        method.onclick = () => {
            document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('selected'));
            method.classList.add('selected');
            selectedPaymentMethod = gateway;
            proceedBtn.disabled = false;
        };
        container.appendChild(method);
    });
}

// ==================== PAYMENT PROCESSING ====================
document.getElementById('proceedPaymentBtn').addEventListener('click', async () => {
    if (!selectedProduct || !selectedPaymentMethod) {
        showToast('Please select a payment method', 'error');
        return;
    }

    const offerPrice = parseFloat(document.getElementById('buyOfferPrice').value);
    const priceMin = parseFloat(selectedProduct.priceMin) || 0;
    const priceMax = parseFloat(selectedProduct.priceMax) || 0;

    if (!offerPrice || offerPrice < priceMin || offerPrice > priceMax) {
        showToast(`Offer must be between ${formatPrice(priceMin)} and ${formatPrice(priceMax)}`, 'error');
        return;
    }

    const customerName = document.getElementById('buyCustomerName').value.trim();
    const customerPhone = document.getElementById('buyCustomerPhone').value.trim();
    const customerEmail = document.getElementById('buyCustomerEmail').value.trim();

    if (!customerName || !customerPhone) {
        showToast('Please fill in your name and phone', 'error');
        return;
    }

    // Process payment based on selected method
    try {
        switch (selectedPaymentMethod) {
            case 'paypal':
                await processPayPalPayment(offerPrice, customerName, customerPhone, customerEmail);
                break;
            case 'paystack':
                await processPaystackPayment(offerPrice, customerName, customerPhone, customerEmail);
                break;
            case 'flutterwave':
                await processFlutterwavePayment(offerPrice, customerName, customerPhone, customerEmail);
                break;
        }
    } catch (error) {
        console.error('Payment error:', error);
        showToast('Payment failed. Please try again.', 'error');
        showLoading(false);
    }
});

// ==================== PAYPAL ====================
async function loadPayPalSDK() {
    if (paypalSdkLoaded || !activeGateways.paypal) return;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${activeGateways.paypal.clientId}&currency=${paymentConfig.currency}&intent=capture`;
        script.onload = () => { paypalSdkLoaded = true; resolve(); };
        script.onerror = () => reject(new Error('Failed to load PayPal SDK'));
        document.head.appendChild(script);
    });
}

async function processPayPalPayment(amount, name, phone, email) {
    showLoading(true, 'Loading PayPal...');

    if (!paypalSdkLoaded) {
        await loadPayPalSDK();
    }

    showLoading(false);

    // Create a temporary container for PayPal buttons
    const existingBtn = document.getElementById('paypalButtonContainer');
    if (existingBtn) existingBtn.remove();

    const btnContainer = document.createElement('div');
    btnContainer.id = 'paypalButtonContainer';
    btnContainer.style.marginTop = '1rem';
    document.querySelector('#buyModal .buy-modal-content').appendChild(btnContainer);

    // Show a friendly note
    const note = document.createElement('p');
    note.style.cssText = 'font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.5rem; text-align: center;';
    note.textContent = 'Click the PayPal button below to complete your payment.';
    btnContainer.appendChild(note);

    const btnDiv = document.createElement('div');
    btnDiv.id = 'paypal-button';
    btnContainer.appendChild(btnDiv);

    window.paypal.Buttons({
        createOrder: (data, actions) => {
            return actions.order.create({
                purchase_units: [{
                    amount: { value: amount.toFixed(2), currency_code: paymentConfig.currency },
                    description: selectedProduct.name,
                    custom_id: selectedProduct.id
                }]
            });
        },
        onApprove: async (data, actions) => {
            showLoading(true, 'Confirming payment...');
            const details = await actions.order.capture();
            await saveOrder(amount, 'paypal', details.id, name, phone, email);
            showLoading(false);
            document.getElementById('buyModal').classList.remove('active');
            document.getElementById('paypalButtonContainer')?.remove();
            showToast('Payment successful! We will contact you shortly.', 'success');
        },
        onError: (err) => {
            console.error('PayPal error:', err);
            showToast('PayPal payment failed. Please try again.', 'error');
            document.getElementById('paypalButtonContainer')?.remove();
        },
        onCancel: () => {
            showToast('Payment cancelled', 'info');
            document.getElementById('paypalButtonContainer')?.remove();
        }
    }).render('#paypal-button');
}

// ==================== PAYSTACK ====================
async function processPaystackPayment(amount, name, phone, email) {
    if (!email) {
        showToast('Email is required for Paystack payment', 'error');
        return;
    }

    // Load Paystack inline script if not loaded
    if (!window.PaystackPop) {
        await loadScript('https://js.paystack.co/v1/inline.js');
    }

    const reference = 'JOW_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    const handler = window.PaystackPop.setup({
        key: activeGateways.paystack.publicKey,
        email: email,
        amount: Math.round(amount * 100), // Paystack uses kobo (smallest unit)
        currency: paymentConfig.currency,
        ref: reference,
        metadata: {
            custom_fields: [
                { display_name: 'Product', variable_name: 'product', value: selectedProduct.name },
                { display_name: 'Customer Phone', variable_name: 'phone', value: phone }
            ]
        },
        callback: async (response) => {
            showLoading(true, 'Confirming payment...');
            await saveOrder(amount, 'paystack', response.reference, name, phone, email);
            showLoading(false);
            document.getElementById('buyModal').classList.remove('active');
            showToast('Payment successful! We will contact you shortly.', 'success');
        },
        onClose: () => {
            showToast('Payment window closed', 'info');
        }
    });
    handler.openIframe();
}

// ==================== FLUTTERWAVE ====================
async function processFlutterwavePayment(amount, name, phone, email) {
    // Load Flutterwave script if not loaded
    if (!window.FlutterwaveCheckout) {
        await loadScript('https://checkout.flutterwave.com/v3.js');
    }

    const reference = 'JOW_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    window.FlutterwaveCheckout({
        public_key: activeGateways.flutterwave.publicKey,
        tx_ref: reference,
        amount: amount,
        currency: paymentConfig.currency,
        payment_options: 'card,banktransfer,ussd,account',
        customer: {
            email: email || `${phone.replace(/\D/g, '')}@jowefco.shop`,
            phone_number: phone,
            name: name
        },
        customizations: {
            title: 'JOWEFCO Shop',
            description: selectedProduct.name,
            logo: 'https://via.placeholder.com/50x50/D4AF37/0A0A0F?text=J'
        },
        callback: async (response) => {
            if (response.status === 'successful' || response.status === 'completed') {
                showLoading(true, 'Confirming payment...');
                await saveOrder(amount, 'flutterwave', response.transaction_id || reference, name, phone, email);
                showLoading(false);
                document.getElementById('buyModal').classList.remove('active');
                showToast('Payment successful! We will contact you shortly.', 'success');
            } else {
                showToast('Payment was not completed', 'error');
            }
        },
        onclose: () => {
            // User closed the modal
        }
    });
}

// Helper to load external scripts
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
}

// ==================== SAVE ORDER TO FIRESTORE ====================
async function saveOrder(amount, paymentMethod, paymentRef, name, phone, email) {
    const orderData = {
        userId: currentUser.id,
        customerName: name,
        customerPhone: phone,
        customerEmail: email || null,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        productDescription: selectedProduct.description,
        productMedia: selectedProduct.media,
        productMediaType: selectedProduct.mediaType || 'image',
        amount: amount,
        currency: paymentConfig.currency,
        paymentMethod: paymentMethod,
        paymentRef: paymentRef,
        paymentStatus: 'paid',
        orderStatus: 'pending',
        createdAt: Timestamp.now()
    };

    await addDoc(collection(db, 'shopOrders'), orderData);
}

// ==================== USER REGISTRATION ====================
async function checkAndRegisterUser() {
    currentUser = getUserFromStorage();
    if (!currentUser) {
        const name = prompt('Welcome to JOWEFCO Shop! Please enter your full name:');
        if (!name) return;
        const phone = prompt('Please enter your phone number:');
        if (!phone) return;
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

// ==================== LOAD FOOTER INFO ====================
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

        const socialDoc = await getDoc(doc(db, 'settings', 'social'));
        const footerSocial = document.getElementById('footerSocial');
        if (footerSocial) {
            const links = socialDoc.exists() ? socialDoc.data() : {};
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
    await Promise.all([
        loadShopItems(),
        loadPaymentConfig(),
        loadFooterInfo()
    ]);
    initReveal();
}

init();

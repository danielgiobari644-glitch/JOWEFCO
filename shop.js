// ====================================================================
// JOWEFCO SHOP.JS
// Full shop functionality with cart and order-request checkout.
// Uses existing Firestore `shopItems` (catalog) and `shopOrders` collections.
// Orders are created with paymentStatus='pending' and orderStatus='requested'
//  — admin confirms stock + total, then sends payment instructions.
// (Existing rules require paymentStatus='paid' for single-product orders;
//  we extend the rules to also accept cart-based orders with 'pending' status
//  because payment is collected manually after confirmation. See updated
//  firestore.rules.)
// ====================================================================

import {
    collection, getDocs, doc, addDoc, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const db = window.JOWEFCO.db;
const utils = window.JOWEFCO.utils;
const warn = window.JOWEFCO.warnPermissionsOnce;

let allProducts = [];
let currentFilter = { search: '', category: '', sort: 'newest' };

// ==================== LOAD PRODUCTS ====================
async function loadShopItems() {
    const grid = document.getElementById('shopGrid');
    if (!grid) return;
    try {
        const snap = await getDocs(collection(db, 'shopItems'));
        allProducts = [];
        snap.forEach(d => allProducts.push({ id: d.id, ...d.data() }));
        // Sort by createdAt desc by default
        allProducts.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
        populateCategoryFilter();
        renderProducts();
    } catch (e) {
        warn(e);
        grid.innerHTML = '<p class="loading-message">Could not load products. Please try again later.</p>';
    }
}

function populateCategoryFilter() {
    const select = document.getElementById('shopCategory');
    if (!select) return;
    const cats = [...new Set(allProducts.map(p => p.category).filter(Boolean))].sort();
    // Preserve "All" option
    select.innerHTML = '<option value="">All Categories</option>' +
        cats.map(c => `<option value="${utils.escapeHtml(c)}">${utils.escapeHtml(c)}</option>`).join('');
    if (currentFilter.category) select.value = currentFilter.category;
}

function renderProducts() {
    const grid = document.getElementById('shopGrid');
    if (!grid) return;
    let filtered = allProducts.slice();
    // Filter: search
    if (currentFilter.search) {
        const q = currentFilter.search.toLowerCase();
        filtered = filtered.filter(p =>
            (p.name || '').toLowerCase().includes(q) ||
            (p.description || '').toLowerCase().includes(q) ||
            (p.category || '').toLowerCase().includes(q)
        );
    }
    // Filter: category
    if (currentFilter.category) {
        filtered = filtered.filter(p => p.category === currentFilter.category);
    }
    // Hide unavailable? No — show them but mark as out of stock.
    // Sort
    switch (currentFilter.sort) {
        case 'price-low': filtered.sort((a,b) => (priceOf(a)) - (priceOf(b))); break;
        case 'price-high': filtered.sort((a,b) => priceOf(b) - priceOf(a)); break;
        case 'name': filtered.sort((a,b) => (a.name||'').localeCompare(b.name||'')); break;
        default: /* newest */ filtered.sort((a,b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
    }
    const empty = document.getElementById('shopEmpty');
    if (filtered.length === 0) {
        grid.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
    }
    if (empty) empty.classList.add('hidden');
    grid.innerHTML = '';
    filtered.forEach(p => grid.appendChild(buildProductCard(p)));
}

function priceOf(p) {
    if (typeof p.price === 'number') return p.price;
    if (typeof p.priceMin === 'number') return p.priceMin;
    return 0;
}

function isAvailable(p) {
    // Explicit flag wins; else assume available
    if (typeof p.available === 'boolean') return p.available;
    if (typeof p.stock === 'number') return p.stock > 0;
    return true;
}

function buildProductCard(item) {
    const div = document.createElement('div');
    div.className = 'product-card';
    const media = item.mediaType === 'video'
        ? `<video src="${item.media}" muted></video>`
        : `<img src="${item.media || ''}" alt="${utils.escapeHtml(item.name)}" loading="lazy" onerror="this.style.opacity=0.2">`;
    const available = isAvailable(item);
    const priceText = (typeof item.price === 'number')
        ? utils.formatPrice(item.price)
        : (typeof item.priceMin === 'number' && typeof item.priceMax === 'number')
            ? (item.priceMin === item.priceMax
                ? utils.formatPrice(item.priceMin)
                : `${utils.formatPrice(item.priceMin)} – ${utils.formatPrice(item.priceMax)}`)
            : 'Price on request';
    div.innerHTML = `
        <div class="product-image" onclick="JOWEFCO.openProductModal('${item.id}')">
            ${media}
            ${!available ? '<span class="product-badge out-of-stock">Out of Stock</span>' : (item.featured ? '<span class="product-badge">Featured</span>' : '')}
            ${typeof item.stock === 'number' && item.stock > 0 ? `<span class="product-availability">${item.stock} in stock</span>` : ''}
        </div>
        <div class="product-body">
            ${item.category ? `<div class="product-category">${utils.escapeHtml(item.category)}</div>` : ''}
            <div class="product-name">${utils.escapeHtml(item.name)}</div>
            <p class="product-description">${utils.escapeHtml(item.description || '')}</p>
            <div class="product-price">${priceText}</div>
            <div class="product-actions">
                <button class="btn btn-primary btn-sm" ${!available ? 'disabled' : ''} onclick="JOWEFCO.addToCartUI('${item.id}')">Add to Cart</button>
                <button class="btn btn-outline btn-sm" onclick="JOWEFCO.openProductModal('${item.id}')">Details</button>
            </div>
        </div>
    `;
    return div;
}

// ==================== PRODUCT MODAL ====================
window.JOWEFCO.openProductModal = function (id) {
    const item = allProducts.find(p => p.id === id);
    if (!item) return;
    const body = document.getElementById('productModalBody');
    if (!body) return;
    const available = isAvailable(item);
    const media = item.mediaType === 'video'
        ? `<video src="${item.media}" controls style="width:100%;border-radius:10px;margin-bottom:1rem;"></video>`
        : `<img src="${item.media || ''}" alt="${utils.escapeHtml(item.name)}" style="width:100%;border-radius:10px;margin-bottom:1rem;" onerror="this.style.background='var(--bg-tertiary)';this.style.minHeight='200px';">`;
    const priceText = (typeof item.price === 'number')
        ? utils.formatPrice(item.price)
        : (typeof item.priceMin === 'number' && typeof item.priceMax === 'number')
            ? (item.priceMin === item.priceMax
                ? utils.formatPrice(item.priceMin)
                : `${utils.formatPrice(item.priceMin)} – ${utils.formatPrice(item.priceMax)}`)
            : 'Price on request';
    body.innerHTML = `
        ${media}
        ${item.category ? `<span class="section-badge">${utils.escapeHtml(item.category)}</span>` : ''}
        <h2 style="margin:0.5rem 0 1rem 0;">${utils.escapeHtml(item.name)}</h2>
        <div class="product-price" style="font-size:1.5rem;margin-bottom:1rem;">${priceText}</div>
        <p style="color:var(--text-secondary);line-height:1.7;margin-bottom:1rem;">${utils.escapeHtml(item.description || 'No description available.')}</p>
        ${typeof item.stock === 'number' ? `<p style="font-size:0.85rem;color:var(--text-tertiary);margin-bottom:1rem;">Stock: ${item.stock} units</p>` : ''}
        ${!available ? '<p style="color:var(--danger);font-weight:600;margin-bottom:1rem;">Currently out of stock</p>' : ''}
        <div class="flex gap-sm">
            <button class="btn btn-primary" ${!available ? 'disabled' : ''} onclick="JOWEFCO.addToCartUI('${item.id}');document.getElementById('productModal').classList.remove('active');">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                Add to Cart
            </button>
            <button class="btn btn-outline" onclick="document.getElementById('productModal').classList.remove('active')">Close</button>
        </div>
    `;
    document.getElementById('productModal').classList.add('active');
};

// ==================== ADD TO CART (UI) ====================
window.JOWEFCO.addToCartUI = function (id) {
    const item = allProducts.find(p => p.id === id);
    if (!item) return;
    if (!isAvailable(item)) {
        utils.showToast('This product is out of stock', 'error');
        return;
    }
    const price = priceOf(item);
    const imageUrl = item.media || '';
    window.JOWEFCO.cart.add(id, item.name, price, imageUrl, 1);
    utils.showToast(`${item.name} added to cart`, 'success');
    // Open cart drawer briefly to confirm
    // JOWEFCO.openCart();
};

// ==================== CHECKOUT ====================
function renderOrderSummary() {
    const cart = window.JOWEFCO.cart.get();
    const summary = document.getElementById('checkoutOrderSummary');
    if (!summary) return;
    if (cart.length === 0) {
        summary.innerHTML = '<p style="color:var(--text-tertiary);text-align:center;margin:0;">Your cart is empty.</p>';
        return;
    }
    summary.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
            <thead>
                <tr><th style="text-align:left;padding:0.35rem 0;">Item</th><th style="text-align:center;padding:0.35rem 0;">Qty</th><th style="text-align:right;padding:0.35rem 0;">Subtotal</th></tr>
            </thead>
            <tbody>
                ${cart.map(i => `
                    <tr>
                        <td style="padding:0.35rem 0;">${utils.escapeHtml(i.name)}</td>
                        <td style="text-align:center;padding:0.35rem 0;">${i.quantity}</td>
                        <td style="text-align:right;padding:0.35rem 0;">${utils.formatPrice(i.price * i.quantity)}</td>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="2" style="padding:0.75rem 0 0 0;font-weight:700;text-align:right;border-top:1px solid var(--surface-border);">Total:</td>
                    <td style="padding:0.75rem 0 0 0;font-weight:700;text-align:right;color:var(--brand-blue);">${utils.formatPrice(window.JOWEFCO.cart.getTotal())}</td>
                </tr>
            </tfoot>
        </table>
    `;
}

async function submitOrderRequest(e) {
    e.preventDefault();
    const cart = window.JOWEFCO.cart.get();
    if (cart.length === 0) {
        utils.showToast('Your cart is empty', 'error');
        return;
    }
    const name = document.getElementById('checkoutName').value.trim();
    const phone = document.getElementById('checkoutPhone').value.trim();
    const email = document.getElementById('checkoutEmail').value.trim();
    const location = document.getElementById('checkoutLocation').value.trim();
    const notes = document.getElementById('checkoutNotes').value.trim();
    if (!name || !phone || !location) {
        utils.showToast('Please fill in all required fields', 'error');
        return;
    }

    // Ensure user is registered
    let user = utils.getUserFromStorage();
    if (!user) {
        user = { id: utils.generateUserId(), name, phone };
        utils.saveUserToStorage(user);
        await utils.registerUserInFirestore(user);
    }

    // Build order document. Use cart-based structure with items array.
    // The total amount is the cart total. We mark paymentStatus='pending'
    // and orderStatus='requested' — the admin reviews and sends payment instructions.
    const totalAmount = window.JOWEFCO.cart.getTotal();
    const items = cart.map(i => ({
        productId: i.productId,
        productName: i.name,
        price: i.price,
        quantity: i.quantity,
        imageUrl: i.imageUrl || null
    }));

    utils.showLoading(true, 'Submitting your order...');
    try {
        const orderRef = await addDoc(collection(db, 'shopOrders'), {
            userId: user.id,
            customerName: name,
            customerPhone: phone,
            customerEmail: email || null,
            deliveryLocation: location,
            notes: notes || null,
            items: items,
            // For backwards-compat with single-product rules, also populate
            // the legacy fields using the first item.
            productId: items[0]?.productId || null,
            productName: items.map(i => i.productName).join(', '),
            amount: totalAmount,
            paymentMethod: 'pending',     // admin will assign after confirmation
            paymentStatus: 'pending',     // see updated firestore.rules
            orderStatus: 'requested',
            createdAt: Timestamp.now()
        });
        utils.showLoading(false);
        // Clear cart and show success
        window.JOWEFCO.cart.clear();
        utils.showToast('Order request submitted! We will contact you within 1 business day.', 'success');
        // Show confirmation modal
        showOrderConfirmation(name, phone, totalAmount);
        // Reset form
        document.getElementById('checkoutForm').reset();
        renderOrderSummary();
    } catch (e) {
        warn(e);
        utils.showLoading(false);
        utils.showToast('Could not submit order. Please try again or contact us directly.', 'error');
        console.error(e);
    }
}

function showOrderConfirmation(name, phone, total) {
    const body = document.getElementById('productModalBody');
    if (!body) return;
    body.innerHTML = `
        <div style="text-align:center;padding:1rem 0;">
            <div style="width:64px;height:64px;background:rgba(27,135,84,0.15);color:var(--success);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:1rem;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke-linecap="round" stroke-linejoin="round"/><polyline points="22 4 12 14.01 9 11.01" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <h2>Order Request Received</h2>
            <p style="color:var(--text-secondary);margin:0.5rem 0 1.5rem 0;">Thank you, ${utils.escapeHtml(name)}! Your order request has been received.</p>
            <p style="font-size:0.95rem;margin-bottom:0.5rem;"><strong>Total (estimated):</strong> ${utils.formatPrice(total)}</p>
            <p style="font-size:0.9rem;color:var(--text-tertiary);margin-bottom:1.5rem;">Our team will call you on <strong>${utils.escapeHtml(phone)}</strong> within 1 business day to confirm stock, delivery fee, and total payable. We'll then send payment instructions or a secure payment link.</p>
            <button class="btn btn-primary" onclick="document.getElementById('productModal').classList.remove('active');">Close</button>
        </div>
    `;
    document.getElementById('productModal').classList.add('active');
}

// ==================== INIT ====================
function initShopPage() {
    loadShopItems();
    // Search / filter / sort handlers
    document.getElementById('shopSearch')?.addEventListener('input', (e) => {
        currentFilter.search = e.target.value;
        renderProducts();
    });
    document.getElementById('shopCategory')?.addEventListener('change', (e) => {
        currentFilter.category = e.target.value;
        renderProducts();
    });
    document.getElementById('shopSort')?.addEventListener('change', (e) => {
        currentFilter.sort = e.target.value;
        renderProducts();
    });
    document.getElementById('checkoutForm')?.addEventListener('submit', submitOrderRequest);
    renderOrderSummary();
    // Re-render summary when cart changes (custom event)
    window.addEventListener('jowefco:cart:update', renderOrderSummary);
    // If URL has #checkout, scroll there
    if (window.location.hash === '#checkout') {
        setTimeout(() => {
            document.getElementById('checkout')?.scrollIntoView({ behavior: 'smooth' });
        }, 300);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShopPage);
} else {
    initShopPage();
}

// Override cart save to dispatch event (so the summary re-renders)
const _origSave = window.JOWEFCO.cart.save;
window.JOWEFCO.cart.save = function(cart) {
    _origSave.call(window.JOWEFCO.cart, cart);
    window.dispatchEvent(new CustomEvent('jowefco:cart:update'));
};
const _origRemove = window.JOWEFCO.cart.remove;
window.JOWEFCO.cart.remove = function(id) {
    _origRemove.call(window.JOWEFCO.cart, id);
    window.dispatchEvent(new CustomEvent('jowefco:cart:update'));
};
const _origClear = window.JOWEFCO.cart.clear;
window.JOWEFCO.cart.clear = function() {
    _origClear.call(window.JOWEFCO.cart);
    window.dispatchEvent(new CustomEvent('jowefco:cart:update'));
};

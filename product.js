// ====================================================================
// JOWEFCO PRODUCT.JS — Product detail page with WhatsApp ordering
// ====================================================================
// Flow:
//   1. Parse ?id=<productId> from URL
//   2. Load product from Firestore `shopItems/{productId}`
//   3. Render product detail (image, name, price, stock, description,
//      specifications, delivery info, quantity selector, Order on WhatsApp)
//   4. Customer enters name + phone (only required customer info)
//   5. Customer clicks "Order on WhatsApp":
//      a) Create an `shopOrders` doc with status `awaiting_discussion`,
//         paymentStatus `pending`, paymentMethod `manual`, the full
//         product context (productId, productName, quantity, listedPrice,
//         orderReference, etc.)
//      b) Build WhatsApp deep-link with the product info + order reference
//      c) Open WhatsApp in a new tab
//   6. "Not in Port Harcourt?" section with directions to the workshop
//      (uses settings/business coordinates + customer's geolocation
//      if granted, else opens Google Maps with destination only)
// ====================================================================

import {
    doc, getDoc, addDoc, collection, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const db = window.JOWEFCO.db;
const utils = window.JOWEFCO.utils;
const warn = window.JOWEFCO.warnPermissionsOnce;

let currentProduct = null;
let quantity = 1;
let customerLocation = null; // {lat, lng} or null

// ==================== PARSE URL ====================
function getProductIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || '';
}

// ==================== LOAD PRODUCT ====================
async function loadProduct(productId) {
    const container = document.getElementById('productContainer');
    if (!productId) {
        container.innerHTML = renderErrorState('No product selected. Please browse our shop.',
            '<a href="shop.html" class="btn btn-primary">Browse Shop</a>');
        return;
    }
    try {
        const snap = await getDoc(doc(db, 'shopItems', productId));
        if (!snap.exists()) {
            container.innerHTML = renderErrorState('Product not found. It may have been removed.',
                '<a href="shop.html" class="btn btn-primary">Browse Shop</a>');
            return;
        }
        currentProduct = { id: snap.id, ...snap.data() };
        renderProduct(currentProduct);
        // Update page title + breadcrumb
        document.title = `${currentProduct.name} | JOWEFCO Shop`;
        document.getElementById('breadcrumbProductName').textContent = currentProduct.name;
    } catch (e) {
        warn(e);
        container.innerHTML = renderErrorState('Could not load the product. Please try again later.',
            '<a href="shop.html" class="btn btn-primary">Back to Shop</a>');
    }
}

function renderErrorState(message, actionHtml) {
    return `<div style="text-align:center;padding:4rem 1rem;">
        <p style="font-size:1.05rem;color:var(--text-secondary);margin-bottom:1.5rem;">${utils.escapeHtml(message)}</p>
        ${actionHtml}
    </div>`;
}

function isAvailable(p) {
    if (typeof p.available === 'boolean') return p.available;
    if (typeof p.stock === 'number') return p.stock > 0;
    return true;
}

function priceOf(p) {
    if (typeof p.price === 'number') return p.price;
    if (typeof p.priceMin === 'number') return p.priceMin;
    return 0;
}

function formatStock(p) {
    if (typeof p.stock === 'number') {
        if (p.stock === 0) return 'Out of stock';
        if (p.stock <= 5) return `Low stock — only ${p.stock} left`;
        return `${p.stock} in stock`;
    }
    return isAvailable(p) ? 'Available' : 'Currently unavailable';
}

function renderProduct(p) {
    const container = document.getElementById('productContainer');
    const available = isAvailable(p);
    const price = priceOf(p);

    // Product image
    const media = p.mediaType === 'video'
        ? `<video src="${p.media}" controls style="width:100%;border-radius:var(--radius-md);background:var(--bg-tertiary);"></video>`
        : `<img src="${p.media || ''}" alt="${utils.escapeHtml(p.name)}" style="width:100%;border-radius:var(--radius-md);background:var(--bg-tertiary);" onerror="this.style.background='var(--bg-tertiary)';this.style.minHeight='320px';this.alt='Image not available';">`;

    // Specs (if available)
    let specsHtml = '';
    if (p.specifications && typeof p.specifications === 'string' && p.specifications.trim()) {
        // Parse simple "Key: Value\nKey: Value" format
        const lines = p.specifications.trim().split('\n').filter(Boolean);
        if (lines.length > 0) {
            specsHtml = `
                <div style="margin-top:2rem;">
                    <h3 style="margin-bottom:0.75rem;">Specifications</h3>
                    <dl style="display:grid;grid-template-columns:1fr 2fr;gap:0.5rem 1rem;font-size:0.92rem;color:var(--text-secondary);">
                        ${lines.map(line => {
                            const idx = line.indexOf(':');
                            const key = idx > 0 ? line.slice(0, idx).trim() : '';
                            const val = idx > 0 ? line.slice(idx + 1).trim() : line.trim();
                            return `<dt style="font-weight:600;color:var(--text-primary);">${utils.escapeHtml(key)}</dt><dd>${utils.escapeHtml(val)}</dd>`;
                        }).join('')}
                    </dl>
                </div>
            `;
        }
    }

    // Delivery info
    const deliveryInfo = `
        <div style="margin-top:1.5rem;padding:1rem;background:var(--bg-secondary);border:1px solid var(--surface-border);border-radius:var(--radius-sm);">
            <p style="margin:0 0 0.35rem 0;font-weight:600;color:var(--text-primary);font-size:0.95rem;">Delivery</p>
            <p style="margin:0;color:var(--text-secondary);font-size:0.88rem;line-height:1.6;">
                Delivery is currently available only within Port Harcourt, Nigeria. Delivery date and time will be confirmed directly with JOWEFCO on WhatsApp.
            </p>
        </div>
    `;

    // Quantity selector
    const qtySelector = `
        <div style="margin:1.5rem 0;">
            <label style="display:block;margin-bottom:0.5rem;font-weight:600;font-size:0.92rem;">Quantity</label>
            <div style="display:inline-flex;align-items:center;border:1px solid var(--surface-border);border-radius:var(--radius-sm);overflow:hidden;">
                <button type="button" id="qtyMinus" style="background:var(--surface);border:0;padding:0.65rem 1rem;font-size:1.1rem;cursor:pointer;color:var(--text-primary);" aria-label="Decrease quantity">−</button>
                <input type="number" id="qtyInput" value="1" min="1" max="${typeof p.stock === 'number' ? p.stock : 9999}" style="width:64px;text-align:center;border:0;border-left:1px solid var(--surface-border);border-right:1px solid var(--surface-border);background:var(--surface);color:var(--text-primary);padding:0.65rem 0;font-size:0.95rem;" aria-label="Quantity">
                <button type="button" id="qtyPlus" style="background:var(--surface);border:0;padding:0.65rem 1rem;font-size:1.1rem;cursor:pointer;color:var(--text-primary);" aria-label="Increase quantity">+</button>
            </div>
        </div>
    `;

    // Order action box
    const stockStatus = formatStock(p);
    const stockClass = available ? 'active' : 'unavailable';
    const orderCta = available
        ? `<button type="button" class="btn btn-red btn-lg btn-full" id="orderWhatsAppBtn" style="margin-top:0.5rem;">
            <svg viewBox="0 0 32 32" fill="currentColor" style="width:20px;height:20px;"><path d="M16 0C7.164 0 0 7.163 0 16c0 2.825.738 5.487 2.031 7.794L.05 31.95l8.331-2.019A15.923 15.923 0 0016 32c8.837 0 16-7.163 16-16S24.837 0 16 0z"/><path d="M23.094 19.45c-.4-.2-2.369-1.169-2.737-1.3-.369-.131-.637-.2-.906.2-.269.4-1.038 1.3-1.275 1.569-.237.269-.475.3-.875.1-.4-.2-1.688-.619-3.213-1.975-1.188-1.056-1.988-2.362-2.219-2.762-.231-.4-.025-.619.175-.819.181-.181.4-.475.6-.712.2-.238.269-.4.4-.669.131-.269.069-.5-.031-.7-.1-.2-.906-2.181-1.244-2.987-.331-.794-.662-.688-.906-.7-.237-.012-.506-.012-.775-.012s-.706.1-1.075.5c-.369.4-1.406 1.375-1.406 3.35s1.444 3.888 1.644 4.156c.2.269 2.819 4.306 6.831 6.038.956.413 1.7.656 2.281.844.962.306 1.837.262 2.531.162.769-.112 2.369-.969 2.706-1.906.337-.938.337-1.738.237-1.906-.1-.169-.369-.269-.769-.469z"/></svg>
            <span>Order on WhatsApp</span>
        </button>`
        : `<button type="button" class="btn btn-primary btn-lg btn-full" disabled style="margin-top:0.5rem;">Out of Stock — Contact Us</button>
           <a href="contact.html" class="btn btn-outline btn-full" style="margin-top:0.5rem;">Contact JOWEFCO to check availability</a>`;

    // Customer info form (minimal — only name + phone)
    const customerInfo = available ? `
        <div style="margin-top:1.5rem;border-top:1px solid var(--surface-border);padding-top:1.5rem;">
            <p style="font-size:0.92rem;color:var(--text-secondary);margin-bottom:1rem;">
                Enter your name and phone number so JOWEFCO can reach you on WhatsApp.
            </p>
            <div class="form-row">
                <div class="form-group">
                    <label for="customerName">Your Name *</label>
                    <input type="text" id="customerName" placeholder="e.g. John Doe" required>
                </div>
                <div class="form-group">
                    <label for="customerPhone">Your Phone Number *</label>
                    <input type="tel" id="customerPhone" placeholder="e.g. 08012345678" required>
                </div>
            </div>
        </div>
    ` : '';

    container.innerHTML = `
        <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:2.5rem;align-items:start;" class="product-layout">
            <div class="product-image-wrap">${media}</div>
            <div class="product-info-wrap">
                ${p.category ? `<div class="product-category">${utils.escapeHtml(p.category)}</div>` : ''}
                <h1 style="font-size:clamp(1.5rem,3vw,2rem);margin:0.5rem 0 1rem 0;line-height:1.2;">${utils.escapeHtml(p.name)}</h1>
                <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1.25rem;">
                    <div class="product-price" style="font-size:1.75rem;font-weight:800;font-family:var(--font-display);color:var(--brand-blue);">${utils.formatPrice(price)}</div>
                    <span class="status-pill ${stockClass}">${stockStatus}</span>
                </div>
                <p style="color:var(--text-secondary);line-height:1.7;margin-bottom:1.25rem;">${utils.escapeHtml(p.description || 'No description available.')}</p>
                ${qtySelector}
                ${customerInfo}
                ${orderCta}
                ${deliveryInfo}
                ${specsHtml}
                <div style="margin-top:1.5rem;padding:1rem;background:rgba(0,59,122,0.06);border-left:3px solid var(--brand-blue);border-radius:var(--radius-sm);">
                    <p style="margin:0;font-size:0.88rem;color:var(--text-secondary);line-height:1.6;">
                        <strong style="color:var(--text-primary);">How ordering works:</strong><br>
                        Click "Order on WhatsApp" — a chat opens with JOWEFCO pre-filled with your product details. Discuss the price, delivery, and date with our team. After agreement, you'll receive bank transfer details. Send your payment receipt in the same WhatsApp chat for verification.
                    </p>
                </div>
            </div>
        </div>
    `;

    // Wire up quantity + order button
    if (available) wireProductInteractions(p);
}

function wireProductInteractions(p) {
    const qtyMinus = document.getElementById('qtyMinus');
    const qtyPlus = document.getElementById('qtyPlus');
    const qtyInput = document.getElementById('qtyInput');
    const maxQty = (typeof p.stock === 'number') ? p.stock : 9999;

    const setQty = (val) => {
        let v = parseInt(val, 10);
        if (isNaN(v) || v < 1) v = 1;
        if (v > maxQty) v = maxQty;
        quantity = v;
        qtyInput.value = v;
    };

    qtyMinus.addEventListener('click', () => setQty(quantity - 1));
    qtyPlus.addEventListener('click', () => setQty(quantity + 1));
    qtyInput.addEventListener('change', (e) => setQty(e.target.value));

    const orderBtn = document.getElementById('orderWhatsAppBtn');
    if (orderBtn) {
        orderBtn.addEventListener('click', onOrderClick);
    }
}

// ==================== ORDER ON WHATSAPP ====================
async function onOrderClick() {
    const orderBtn = document.getElementById('orderWhatsAppBtn');
    if (!orderBtn) return;

    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    if (!name || !phone) {
        utils.showToast('Please enter your name and phone number', 'error');
        return;
    }
    if (!currentProduct) return;

    // Get WhatsApp number from settings (loaded by common.js)
    const waNumber = utils.getWhatsAppNumber();
    if (!waNumber) {
        utils.showToast('JOWEFCO WhatsApp number not configured yet. Please contact us directly.', 'error');
        return;
    }

    // 1. Create the order record in Firestore with status `awaiting_discussion`
    const orderRef = utils.generateOrderReference();
    const price = priceOf(currentProduct);
    const productUrl = window.location.href;
    const deliveryLocation = 'Port Harcourt'; // customer confirms in WhatsApp

    utils.showLoading(true, 'Preparing your order...');

    let orderId = null;
    try {
        // Ensure user is registered
        let user = utils.getUserFromStorage();
        if (!user) {
            user = { id: utils.generateUserId(), name, phone };
            utils.saveUserToStorage(user);
            await utils.registerUserInFirestore(user);
        }

        const orderDoc = {
            userId: user.id,
            customerName: name,
            customerPhone: phone,
            customerWhatsapp: phone, // customer's phone IS their WhatsApp number (default)
            orderReference: orderRef,
            productId: currentProduct.id,
            productName: currentProduct.name,
            productImageUrl: currentProduct.media || null,
            quantity: parseInt(quantity, 10),
            listedPrice: price,
            // agreedPrice is set by admin after WhatsApp discussion
            paymentStatus: 'pending',
            paymentMethod: 'manual',
            orderStatus: 'awaiting_discussion',
            deliveryLocation: deliveryLocation,
            storeUrl: productUrl,
            createdAt: Timestamp.now()
        };
        const orderRefSnap = await addDoc(collection(db, 'shopOrders'), orderDoc);
        orderId = orderRefSnap.id;

        // Save order ID → reference mapping in localStorage so the customer
        // can track the order on the same device using just the reference.
        try {
            localStorage.setItem('jowefco_order_ref:' + orderRef, orderId);
        } catch (e) { /* localStorage may be unavailable; ignore */ }

        utils.showLoading(false);

        // 2. Build the WhatsApp deep-link with the order details
        const message = buildWhatsAppOrderMessage({
            customerName: name,
            orderReference: orderRef,
            productName: currentProduct.name,
            productId: currentProduct.id,
            quantity: parseInt(quantity, 10),
            listedPrice: price,
            productUrl: productUrl,
            deliveryLocation: deliveryLocation
        });
        const waUrl = utils.buildWhatsAppUrl(waNumber, message);

        // 3. Show a confirmation modal with order details + "Open WhatsApp" button
        showOrderConfirmationModal({
            orderReference: orderRef,
            productName: currentProduct.name,
            quantity: parseInt(quantity, 10),
            listedPrice: price,
            waUrl: waUrl
        });

    } catch (e) {
        warn(e);
        utils.showLoading(false);
        utils.showToast('Could not create your order record. Please try WhatsApp directly.', 'error');
        console.error(e);
        // Fallback: still open WhatsApp even if order record creation failed
        const message = buildWhatsAppOrderMessage({
            customerName: name,
            orderReference: orderRef,
            productName: currentProduct.name,
            productId: currentProduct.id,
            quantity: parseInt(quantity, 10),
            listedPrice: price,
            productUrl: window.location.href,
            deliveryLocation: 'Port Harcourt'
        });
        const waUrl = utils.buildWhatsAppUrl(waNumber, message);
        if (waUrl) window.open(waUrl, '_blank');
    }
}

function buildWhatsAppOrderMessage({ customerName, orderReference, productName, productId, quantity, listedPrice, productUrl, deliveryLocation }) {
    return [
        `Hello JOWEFCO, I would like to order:`,
        ``,
        `Order Reference: ${orderReference}`,
        `Product: ${productName}`,
        `Product ID: ${productId}`,
        `Quantity: ${quantity}`,
        `Listed Price: ${utils.formatPrice(listedPrice)}`,
        ``,
        `Customer Name: ${customerName}`,
        `I would like this delivered to ${deliveryLocation}.`,
        ``,
        `I would like to discuss the delivery location, delivery date, delivery time, final price, and other details with you.`,
        ``,
        `Product page: ${productUrl}`
    ].join('\n');
}

function showOrderConfirmationModal({ orderReference, productName, quantity, listedPrice, waUrl }) {
    // Use the existing modal pattern from shop.js / product.html (simple inline modal)
    const modalHtml = `
        <div id="orderConfirmModal" class="modal active">
            <div class="modal-content" style="max-width:480px;">
                <button class="modal-close" onclick="document.getElementById('orderConfirmModal').remove()" aria-label="Close">×</button>
                <div style="text-align:center;padding:1rem 0;">
                    <div style="width:60px;height:60px;background:rgba(27,135,84,0.15);color:var(--success);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:1rem;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke-linecap="round" stroke-linejoin="round"/><polyline points="22 4 12 14.01 9 11.01" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </div>
                    <h2 style="margin-bottom:0.5rem;">Order Started</h2>
                    <p style="color:var(--text-secondary);margin-bottom:1.25rem;">We've created an order record. Open WhatsApp to discuss the details with JOWEFCO.</p>
                    <div style="background:var(--bg-secondary);border:1px solid var(--surface-border);border-radius:var(--radius-sm);padding:1rem;text-align:left;margin-bottom:1.5rem;">
                        <p style="margin:0 0 0.35rem 0;font-size:0.85rem;color:var(--text-tertiary);">Order Reference</p>
                        <p style="margin:0 0 0.85rem 0;font-weight:700;font-family:var(--font-display);color:var(--brand-blue);">${utils.escapeHtml(orderReference)}</p>
                        <p style="margin:0 0 0.35rem 0;font-size:0.85rem;color:var(--text-tertiary);">Product</p>
                        <p style="margin:0 0 0.5rem 0;font-weight:600;">${utils.escapeHtml(productName)}</p>
                        <p style="margin:0 0 0.35rem 0;font-size:0.85rem;color:var(--text-tertiary);">Quantity</p>
                        <p style="margin:0 0 0.5rem 0;font-weight:600;">${quantity}</p>
                        <p style="margin:0 0 0.35rem 0;font-size:0.85rem;color:var(--text-tertiary);">Listed Price</p>
                        <p style="margin:0;font-weight:600;">${utils.formatPrice(listedPrice)}</p>
                    </div>
                    <a href="${waUrl}" target="_blank" rel="noopener" class="btn btn-red btn-lg btn-full" style="margin-bottom:0.5rem;">
                        <svg viewBox="0 0 32 32" fill="currentColor" style="width:20px;height:20px;"><path d="M16 0C7.164 0 0 7.163 0 16c0 2.825.738 5.487 2.031 7.794L.05 31.95l8.331-2.019A15.923 15.923 0 0016 32c8.837 0 16-7.163 16-16S24.837 0 16 0z"/><path d="M23.094 19.45c-.4-.2-2.369-1.169-2.737-1.3-.369-.131-.637-.2-.906.2-.269.4-1.038 1.3-1.275 1.569-.237.269-.475.3-.875.1-.4-.2-1.688-.619-3.213-1.975-1.188-1.056-1.988-2.362-2.219-2.762-.231-.4-.025-.619.175-.819.181-.181.4-.475.6-.712.2-.238.269-.4.4-.669.131-.269.069-.5-.031-.7-.1-.2-.906-2.181-1.244-2.987-.331-.794-.662-.688-.906-.7-.237-.012-.506-.012-.775-.012s-.706.1-1.075.5c-.369.4-1.406 1.375-1.406 3.35s1.444 3.888 1.644 4.156c.2.269 2.819 4.306 6.831 6.038.956.413 1.7.656 2.281.844.962.306 1.837.262 2.531.162.769-.112 2.369-.969 2.706-1.906.337-.938.337-1.738.237-1.906-.1-.169-.369-.269-.769-.469z"/></svg>
                        Open WhatsApp
                    </a>
                    <a href="track-order.html?id=${orderReference}" class="btn btn-outline btn-full" style="font-size:0.9rem;">Track this order</a>
                    <p style="margin-top:1rem;font-size:0.82rem;color:var(--text-tertiary);">
                        Discuss your order on WhatsApp. Final price, delivery arrangements, date and time will be confirmed directly with JOWEFCO.
                    </p>
                </div>
            </div>
        </div>
    `;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = modalHtml;
    const modal = wrapper.firstElementChild;
    document.body.appendChild(modal);
    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// ==================== DIRECTIONS TO WORKSHOP ====================
function setupDirectionsButton() {
    const btn = document.getElementById('getDirectionsBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        const biz = window.JOWEFCO.business;
        if (!biz) {
            utils.showToast('Workshop location not configured yet.', 'error');
            return;
        }
        const destLat = biz.latitude;
        const destLng = biz.longitude;
        if (!destLat || !destLng) {
            // Use the mapsUrl if provided, else show a message
            if (biz.mapsUrl) {
                window.open(biz.mapsUrl, '_blank');
            } else {
                utils.showToast('Workshop coordinates not configured yet. Please contact JOWEFCO for directions.', 'error');
            }
            return;
        }

        utils.showLoading(true, 'Getting directions...');
        // Try to get the user's location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    utils.showLoading(false);
                    const origin = `${pos.coords.latitude},${pos.coords.longitude}`;
                    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destLat},${destLng}&travelmode=driving`;
                    window.open(url, '_blank');
                },
                (err) => {
                    utils.showLoading(false);
                    // Permission denied or unavailable — open with destination only
                    // (Google Maps will prompt the user to enter their starting point)
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;
                    window.open(url, '_blank');
                },
                { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
            );
        } else {
            utils.showLoading(false);
            const url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;
            window.open(url, '_blank');
        }
    });

    // Show workshop address text
    const addrEl = document.getElementById('workshopAddressDisplay');
    if (addrEl && window.JOWEFCO.business?.workshopAddress) {
        addrEl.textContent = `Workshop address: ${window.JOWEFCO.business.workshopAddress}`;
    }
}

// ==================== INIT ====================
function initProductPage() {
    const productId = getProductIdFromUrl();
    loadProduct(productId);
    setupDirectionsButton();
    // Re-check workshop address after common.js has finished loading settings
    setTimeout(() => {
        const addrEl = document.getElementById('workshopAddressDisplay');
        if (addrEl && window.JOWEFCO.business?.workshopAddress) {
            addrEl.textContent = `Workshop address: ${window.JOWEFCO.business.workshopAddress}`;
        }
        // Show the "Not in Port Harcourt?" section (always visible on product page)
        document.getElementById('notInPhcSection').style.display = 'block';
    }, 1500);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProductPage);
} else {
    initProductPage();
}

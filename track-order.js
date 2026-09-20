// ====================================================================
// JOWEFCO TRACK-ORDER.JS — Customer order tracking
// ====================================================================
// Customer enters their order reference (e.g. "JOWEFCO-AB12CD").
// We query Firestore `shopOrders` where orderReference == <input>.
// The Firestore rules allow public `get` on a single order doc by ID,
// so we use a 2-step process:
//   1. Query `shopOrders` collection where orderReference == <input>.
//      This requires `list` permission which the public does NOT have.
//   2. So instead, we expose a small lookup pattern: the customer's
//      browser stores the order ID (Firestore doc ID) in localStorage
//      when they place an order from product.html. Then track-order
//      reads from localStorage and fetches the doc by ID (get is allowed).
//
// If the customer is on a different device, they can still track using
// their order reference IF the admin has shared the order doc ID with
// them (which is rare). For the primary use case (same device), this
// works perfectly. For cross-device tracking, we suggest contacting
// JOWEFCO on WhatsApp.
// ====================================================================

import { collection, getDocs, query, where, doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const db = window.JOWEFCO.db;
const utils = window.JOWEFCO.utils;
const warn = window.JOWEFCO.warnPermissionsOnce;

// Status order for the timeline display
const STATUS_ORDER = [
    'awaiting_discussion',
    'order_agreed',
    'payment_pending',
    'payment_confirmed',
    'delivery_scheduled',
    'out_for_delivery',
    'delivered'
];

const STATUS_LABELS = {
    awaiting_discussion: 'Awaiting Discussion',
    order_agreed: 'Order Agreed',
    payment_pending: 'Payment Pending',
    payment_confirmed: 'Payment Confirmed',
    delivery_scheduled: 'Delivery Scheduled',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled'
};

const STATUS_DESCRIPTIONS = {
    awaiting_discussion: 'Your order has been started. Please contact JOWEFCO on WhatsApp to discuss the details.',
    order_agreed: 'You and JOWEFCO have agreed on product, quantity, final price, and delivery.',
    payment_pending: 'JOWEFCO has shared bank transfer details with you. Please make payment and send your receipt on WhatsApp.',
    payment_confirmed: 'JOWEFCO has verified your payment. Your order is being prepared for delivery.',
    delivery_scheduled: 'Delivery date and time have been confirmed with you.',
    out_for_delivery: 'Your order is on the way to the delivery address.',
    delivered: 'Your order has been delivered. Thank you for choosing JOWEFCO!',
    cancelled: 'This order was cancelled. Please contact JOWEFCO on WhatsApp if you have questions.'
};

// ==================== INIT ====================
function initTrackOrder() {
    const form = document.getElementById('trackForm');
    if (!form) return;
    form.addEventListener('submit', onTrackSubmit);

    // Pre-fill from URL ?id=JOWEFCO-XXXX
    const urlParams = new URLSearchParams(window.location.search);
    const preId = urlParams.get('id');
    if (preId) {
        document.getElementById('trackRef').value = preId.toUpperCase();
        // Auto-submit
        setTimeout(() => form.dispatchEvent(new Event('submit')), 300);
    }
}

async function onTrackSubmit(e) {
    e.preventDefault();
    const refInput = document.getElementById('trackRef');
    const ref = refInput.value.trim().toUpperCase();
    const resultDiv = document.getElementById('trackResult');
    if (!ref) return;

    utils.showLoading(true, 'Looking up your order...');
    resultDiv.innerHTML = '';

    let order = null;
    try {
        // Try to find the order doc ID from localStorage first (same-device lookup)
        const localOrderId = findOrderIdFromLocalStorage(ref);
        if (localOrderId) {
            const snap = await getDoc(doc(db, 'shopOrders', localOrderId));
            if (snap.exists()) {
                order = { id: snap.id, ...snap.data() };
            }
        }
        // If not found locally, attempt a public collection query
        // (this will fail with permission-denied if Firestore rules enforce
        // admin-only list — which they do. We catch and provide guidance.)
        if (!order) {
            try {
                const q = query(collection(db, 'shopOrders'), where('orderReference', '==', ref));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    snap.forEach(d => { order = { id: d.id, ...d.data() }; });
                }
            } catch (e) {
                // expected if rules enforce admin-only list
            }
        }

        utils.showLoading(false);

        if (!order) {
            resultDiv.innerHTML = renderNotFound(ref);
            return;
        }
        resultDiv.innerHTML = renderOrderStatus(order);
        // Wire the WhatsApp button in the result
        const waBtn = document.getElementById('trackWhatsAppBtn');
        if (waBtn) {
            waBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const waNumber = utils.getWhatsAppNumber();
                if (!waNumber) {
                    utils.showToast('JOWEFCO WhatsApp number not configured.', 'error');
                    return;
                }
                const msg = `Hello JOWEFCO, I am checking on my order ${order.orderReference}. My current order status shows: ${STATUS_LABELS[order.orderStatus] || order.orderStatus}.`;
                const url = utils.buildWhatsAppUrl(waNumber, msg);
                if (url) window.open(url, '_blank');
            });
        }
    } catch (e) {
        warn(e);
        utils.showLoading(false);
        resultDiv.innerHTML = `<div class="card"><div class="card-body" style="text-align:center;color:var(--danger);">
            <p>Could not look up your order. Please try again or contact JOWEFCO on WhatsApp.</p>
        </div></div>`;
    }
}

function findOrderIdFromLocalStorage(ref) {
    // We store the order ID + reference in localStorage when a customer places
    // an order from product.html. The key format is jowefco_order_ref:<ORDER_REF>
    try {
        return localStorage.getItem('jowefco_order_ref:' + ref);
    } catch (e) { return null; }
}

function renderNotFound(ref) {
    return `
        <div class="card">
            <div class="card-body" style="text-align:center;padding:2rem;">
                <p style="font-size:1rem;color:var(--text-primary);margin-bottom:0.5rem;font-weight:600;">Order "${utils.escapeHtml(ref)}" not found.</p>
                <p style="font-size:0.9rem;color:var(--text-secondary);margin-bottom:1.25rem;line-height:1.55;">
                    If you placed this order on a different device, the system may not be able to look it up automatically. Please contact JOWEFCO on WhatsApp with your order reference.
                </p>
                <button class="btn btn-red" id="trackWhatsAppBtn">
                    <svg viewBox="0 0 32 32" fill="currentColor" style="width:18px;height:18px;"><path d="M16 0C7.164 0 0 7.163 0 16c0 2.825.738 5.487 2.031 7.794L.05 31.95l8.331-2.019A15.923 15.923 0 0016 32c8.837 0 16-7.163 16-16S24.837 0 16 0z"/><path d="M23.094 19.45c-.4-.2-2.369-1.169-2.737-1.3-.369-.131-.637-.2-.906.2-.269.4-1.038 1.3-1.275 1.569-.237.269-.475.3-.875.1-.4-.2-1.688-.619-3.213-1.975-1.188-1.056-1.988-2.362-2.219-2.762-.231-.4-.025-.619.175-.819.181-.181.4-.475.6-.712.2-.238.269-.4.4-.669.131-.269.069-.5-.031-.7-.1-.2-.906-2.181-1.244-2.987-.331-.794-.662-.688-.906-.7-.237-.012-.506-.012-.775-.012s-.706.1-1.075.5c-.369.4-1.406 1.375-1.406 3.35s1.444 3.888 1.644 4.156c.2.269 2.819 4.306 6.831 6.038.956.413 1.7.656 2.281.844.962.306 1.837.262 2.531.162.769-.112 2.369-.969 2.706-1.906.337-.938.337-1.738.237-1.906-.1-.169-.369-.269-.769-.469z"/></svg>
                    Contact JOWEFCO on WhatsApp
                </button>
            </div>
        </div>
    `;
}

function renderOrderStatus(order) {
    const currentStatus = order.orderStatus || 'awaiting_discussion';
    const isCancelled = currentStatus === 'cancelled';
    const statusLabel = STATUS_LABELS[currentStatus] || currentStatus;
    const statusDesc = STATUS_DESCRIPTIONS[currentStatus] || '';
    const currentIdx = STATUS_ORDER.indexOf(currentStatus);

    // Build the timeline (only if not cancelled)
    let timelineHtml = '';
    if (!isCancelled) {
        timelineHtml = `
            <div style="margin:1.5rem 0;">
                <p style="font-size:0.78rem;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:1px;margin-bottom:0.85rem;">Order Progress</p>
                <div style="display:flex;flex-direction:column;gap:0.65rem;">
                    ${STATUS_ORDER.map((status, idx) => {
                        const completed = idx <= currentIdx;
                        const current = idx === currentIdx;
                        const dotClass = completed ? (current ? 'current' : 'completed') : 'pending';
                        return `<div style="display:flex;align-items:center;gap:0.85rem;">
                            <div style="width:18px;height:18px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;
                                background:${completed ? 'var(--brand-blue)' : 'var(--bg-tertiary)'};
                                color:#FFFFFF;font-size:0.7rem;
                                border:2px solid ${completed ? 'var(--brand-blue)' : 'var(--surface-border)'};">
                                ${idx < currentIdx ? '✓' : ''}
                            </div>
                            <span style="font-size:0.92rem;color:${completed ? 'var(--text-primary)' : 'var(--text-tertiary)'};font-weight:${current ? '700' : '400'};">${STATUS_LABELS[status]}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        `;
    } else {
        timelineHtml = `
            <div style="margin:1.5rem 0;padding:1rem;background:rgba(192,57,43,0.08);border-left:3px solid var(--danger);border-radius:var(--radius-sm);">
                <p style="margin:0;color:var(--danger);font-weight:600;font-size:0.95rem;">This order was cancelled.</p>
                <p style="margin:0.5rem 0 0 0;font-size:0.85rem;color:var(--text-secondary);">Please contact JOWEFCO on WhatsApp if you have questions about this order.</p>
            </div>
        `;
    }

    // Delivery details (if set by admin)
    let deliveryHtml = '';
    if (order.deliveryAddress || order.deliveryDate || order.deliveryTime || order.deliveryInstructions) {
        deliveryHtml = `
            <div style="margin:1.5rem 0;padding:1rem;background:var(--bg-secondary);border:1px solid var(--surface-border);border-radius:var(--radius-sm);">
                <p style="margin:0 0 0.65rem 0;font-weight:600;color:var(--text-primary);font-size:0.95rem;">Delivery Details</p>
                ${order.deliveryAddress ? `<p style="margin:0 0 0.35rem 0;font-size:0.88rem;color:var(--text-secondary);"><strong style="color:var(--text-primary);">Address:</strong> ${utils.escapeHtml(order.deliveryAddress)}</p>` : ''}
                ${order.deliveryDate ? `<p style="margin:0 0 0.35rem 0;font-size:0.88rem;color:var(--text-secondary);"><strong style="color:var(--text-primary);">Date:</strong> ${utils.escapeHtml(order.deliveryDate)}</p>` : ''}
                ${order.deliveryTime ? `<p style="margin:0 0 0.35rem 0;font-size:0.88rem;color:var(--text-secondary);"><strong style="color:var(--text-primary);">Time:</strong> ${utils.escapeHtml(order.deliveryTime)}</p>` : ''}
                ${order.deliveryInstructions ? `<p style="margin:0;font-size:0.88rem;color:var(--text-secondary);"><strong style="color:var(--text-primary);">Instructions:</strong> ${utils.escapeHtml(order.deliveryInstructions)}</p>` : ''}
            </div>
        `;
    }

    // Payment info
    let paymentHtml = '';
    const isPaymentConfirmed = order.paymentStatus === 'confirmed';
    paymentHtml = `
        <div style="margin:1.5rem 0;padding:1rem;background:${isPaymentConfirmed ? 'rgba(27,135,84,0.08)' : 'rgba(183,121,31,0.08)'};border-left:3px solid ${isPaymentConfirmed ? 'var(--success)' : 'var(--warning)'};border-radius:var(--radius-sm);">
            <p style="margin:0 0 0.35rem 0;font-weight:600;color:${isPaymentConfirmed ? 'var(--success)' : 'var(--warning)'};font-size:0.95rem;">
                ${isPaymentConfirmed ? '✓ Payment Confirmed' : '⏳ Payment Pending'}
            </p>
            ${!isPaymentConfirmed && !isCancelled ? `
                <p style="margin:0 0 0.65rem 0;font-size:0.85rem;color:var(--text-secondary);line-height:1.55;">
                    Please make your bank transfer and send the receipt to JOWEFCO on WhatsApp for verification.
                </p>
                <button class="btn btn-red btn-sm" id="trackWhatsAppBtn">
                    <svg viewBox="0 0 32 32" fill="currentColor" style="width:16px;height:16px;"><path d="M16 0C7.164 0 0 7.163 0 16c0 2.825.738 5.487 2.031 7.794L.05 31.95l8.331-2.019A15.923 15.923 0 0016 32c8.837 0 16-7.163 16-16S24.837 0 16 0z"/><path d="M23.094 19.45c-.4-.2-2.369-1.169-2.737-1.3-.369-.131-.637-.2-.906.2-.269.4-1.038 1.3-1.275 1.569-.237.269-.475.3-.875.1-.4-.2-1.688-.619-3.213-1.975-1.188-1.056-1.988-2.362-2.219-2.762-.231-.4-.025-.619.175-.819.181-.181.4-.475.6-.712.2-.238.269-.4.4-.669.131-.269.069-.5-.031-.7-.1-.2-.906-2.181-1.244-2.987-.331-.794-.662-.688-.906-.7-.237-.012-.506-.012-.775-.012s-.706.1-1.075.5c-.369.4-1.406 1.375-1.406 3.35s1.444 3.888 1.644 4.156c.2.269 2.819 4.306 6.831 6.038.956.413 1.7.656 2.281.844.962.306 1.837.262 2.531.162.769-.112 2.369-.969 2.706-1.906.337-.938.337-1.738.237-1.906-.1-.169-.369-.269-.769-.469z"/></svg>
                    Send Payment Receipt on WhatsApp
                </button>
            ` : `
                <button class="btn btn-outline btn-sm" id="trackWhatsAppBtn">Continue Conversation on WhatsApp</button>
            `}
        </div>
    `;

    return `
        <div class="card">
            <div class="card-body" style="padding:1.5rem;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid var(--surface-border);">
                    <div>
                        <p style="font-size:0.78rem;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:1px;margin:0 0 0.25rem 0;">Order Reference</p>
                        <p style="font-size:1.15rem;font-weight:700;font-family:var(--font-display);color:var(--brand-blue);margin:0;">${utils.escapeHtml(order.orderReference || '—')}</p>
                    </div>
                    <span class="status-pill ${currentStatus}">${statusLabel}</span>
                </div>

                <p style="font-size:0.95rem;color:var(--text-secondary);line-height:1.6;margin-bottom:1rem;">${statusDesc}</p>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem 1.5rem;margin-bottom:1rem;">
                    <div>
                        <p style="font-size:0.78rem;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:1px;margin:0 0 0.25rem 0;">Product</p>
                        <p style="margin:0;font-weight:600;font-size:0.95rem;">${utils.escapeHtml(order.productName || '—')}</p>
                    </div>
                    <div>
                        <p style="font-size:0.78rem;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:1px;margin:0 0 0.25rem 0;">Quantity</p>
                        <p style="margin:0;font-weight:600;font-size:0.95rem;">${order.quantity || 1}</p>
                    </div>
                    <div>
                        <p style="font-size:0.78rem;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:1px;margin:0 0 0.25rem 0;">Listed Price</p>
                        <p style="margin:0;font-weight:600;font-size:0.95rem;">${utils.formatPrice(order.listedPrice || 0)}</p>
                    </div>
                    <div>
                        <p style="font-size:0.78rem;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:1px;margin:0 0 0.25rem 0;">Agreed Price</p>
                        <p style="margin:0;font-weight:600;font-size:0.95rem;">${order.agreedPrice != null ? utils.formatPrice(order.agreedPrice) : 'To be confirmed'}</p>
                    </div>
                </div>

                ${timelineHtml}
                ${deliveryHtml}
                ${paymentHtml}

                <p style="margin:1.5rem 0 0 0;font-size:0.78rem;color:var(--text-tertiary);">Order placed: ${utils.formatDate(order.createdAt)}</p>
            </div>
        </div>
    `;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTrackOrder);
} else {
    initTrackOrder();
}

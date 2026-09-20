// ====================================================================
// JOWEFCO SHOP.JS — Simple product catalog
// ====================================================================
// Loads products from Firestore `shopItems` and renders them as
// "View Details" cards that link to product.html?id=<productId>.
// The old cart + checkout flow has been removed — every order goes
// through WhatsApp from the product detail page.
// ====================================================================

import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

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
    select.innerHTML = '<option value="">All Categories</option>' +
        cats.map(c => `<option value="${utils.escapeHtml(c)}">${utils.escapeHtml(c)}</option>`).join('');
    if (currentFilter.category) select.value = currentFilter.category;
}

function priceOf(p) {
    if (typeof p.price === 'number') return p.price;
    if (typeof p.priceMin === 'number') return p.priceMin;
    return 0;
}

function isAvailable(p) {
    if (typeof p.available === 'boolean') return p.available;
    if (typeof p.stock === 'number') return p.stock > 0;
    return true;
}

function renderProducts() {
    const grid = document.getElementById('shopGrid');
    if (!grid) return;
    let filtered = allProducts.slice();
    if (currentFilter.search) {
        const q = currentFilter.search.toLowerCase();
        filtered = filtered.filter(p =>
            (p.name || '').toLowerCase().includes(q) ||
            (p.description || '').toLowerCase().includes(q) ||
            (p.category || '').toLowerCase().includes(q)
        );
    }
    if (currentFilter.category) {
        filtered = filtered.filter(p => p.category === currentFilter.category);
    }
    switch (currentFilter.sort) {
        case 'price-low': filtered.sort((a,b) => priceOf(a) - priceOf(b)); break;
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

function buildProductCard(item) {
    const div = document.createElement('div');
    div.className = 'product-card';
    const available = isAvailable(item);
    const media = item.mediaType === 'video'
        ? `<video src="${item.media}" muted></video>`
        : `<img src="${item.media || ''}" alt="${utils.escapeHtml(item.name)}" loading="lazy" onerror="this.style.opacity=0.2">`;
    const priceText = (typeof item.price === 'number')
        ? utils.formatPrice(item.price)
        : (typeof item.priceMin === 'number' && typeof item.priceMax === 'number')
            ? (item.priceMin === item.priceMax
                ? utils.formatPrice(item.priceMin)
                : `${utils.formatPrice(item.priceMin)} – ${utils.formatPrice(item.priceMax)}`)
            : 'Price on request';
    div.innerHTML = `
        <div class="product-image" onclick="window.location.href='product.html?id=${item.id}'" style="cursor:pointer;">
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
                <a href="product.html?id=${item.id}" class="btn btn-primary btn-sm">View Details</a>
            </div>
        </div>
    `;
    return div;
}

// ==================== INIT ====================
function initShopPage() {
    loadShopItems();
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
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShopPage);
} else {
    initShopPage();
}

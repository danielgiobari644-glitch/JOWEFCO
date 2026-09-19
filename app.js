// ====================================================================
// JOWEFCO APP.JS — Homepage-specific script
// Loads hero content, stats, portfolio preview, testimonials.
// Depends on common.js (which initializes Firebase + theme + navbar).
// ====================================================================

import {
    collection, getDocs, doc, getDoc, onSnapshot,
    query, orderBy, limit
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const db = window.JOWEFCO.db;
const utils = window.JOWEFCO.utils;
const warn = window.JOWEFCO.warnPermissionsOnce;

// ==================== LOAD HERO CONTENT ====================
async function loadHeroContent() {
    try {
        const snap = await getDoc(doc(db, 'settings', 'hero'));
        if (!snap.exists()) return;
        const data = snap.data();
        const title = document.getElementById('heroTitle');
        const subtitle = document.getElementById('heroSubtitle');
        const heroBg = document.getElementById('heroBgImage');

        if (data.title && title) {
            title.innerHTML = data.title;
        }
        if (data.subtitle && subtitle) {
            subtitle.textContent = data.subtitle;
        }
        if (data.backgroundMedia && heroBg) {
            heroBg.style.backgroundImage = `url("${data.backgroundMedia}")`;
            heroBg.style.display = 'block';
        }
    } catch (e) { warn(e); }
}

// ==================== LOAD PORTFOLIO PREVIEW (3 latest) ====================
async function loadPortfolio() {
    const grid = document.getElementById('portfolioGrid');
    if (!grid) return;
    try {
        const snap = await getDocs(collection(db, 'portfolio'));
        if (snap.empty) {
            grid.innerHTML = '<p class="loading-message">No projects published yet.</p>';
            return;
        }
        const items = [];
        snap.forEach(d => items.push({ id: d.id, ...d.data() }));
        // Sort by createdAt desc
        items.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
        // Show only the 3 most recent
        const recent = items.slice(0, 3);
        grid.innerHTML = '';
        recent.forEach(item => grid.appendChild(buildPortfolioCard(item)));
    } catch (e) {
        warn(e);
        grid.innerHTML = '<p class="loading-message">Could not load projects. Please try again later.</p>';
    }
}

function buildPortfolioCard(item) {
    const div = document.createElement('div');
    div.className = 'portfolio-item';
    div.onclick = () => window.openPortfolioModal && window.openPortfolioModal(item);
    const media = item.mediaType === 'video'
        ? `<video src="${item.media}" muted></video>`
        : `<img src="${item.media}" alt="${utils.escapeHtml(item.title)}" loading="lazy">`;
    div.innerHTML = `
        ${media}
        <div class="portfolio-item-overlay">
            <h4>${utils.escapeHtml(item.title)}</h4>
            <p>${utils.escapeHtml(item.category || 'Project')}</p>
        </div>
    `;
    return div;
}

// ==================== INIT ====================
async function init() {
    await Promise.all([
        loadHeroContent(),
        loadPortfolio()
    ]);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

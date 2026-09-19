// ====================================================================
// JOWEFCO PROJECTS.JS
// Used on projects.html — loads portfolio items from Firestore,
// handles category filtering, opens a portfolio detail modal, and
// handles the "Start a Project" inquiry form submission to the
// `projectBookings` collection.
//
// Depends on common.js (which exposes window.JOWEFCO.db,
// window.JOWEFCO.utils, and window.JOWEFCO.warnPermissionsOnce).
// ====================================================================

import {
    collection, getDocs, addDoc, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

const db = window.JOWEFCO.db;
const utils = window.JOWEFCO.utils;
const warn = window.JOWEFCO.warnPermissionsOnce;

let allPortfolioItems = [];
let currentFilter = 'all';

// ==================== LOAD PORTFOLIO ====================
async function loadPortfolio() {
    const grid = document.getElementById('portfolioGrid');
    if (!grid) return;
    try {
        const snap = await getDocs(collection(db, 'portfolio'));
        allPortfolioItems = [];
        if (snap.empty) {
            grid.innerHTML = '<p class="loading-message">No projects published yet. Check back soon.</p>';
            return;
        }
        snap.forEach(d => allPortfolioItems.push({ id: d.id, ...d.data() }));
        // Sort by createdAt desc
        allPortfolioItems.sort((a, b) => {
            const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
        renderPortfolio();
    } catch (e) {
        warn(e);
        grid.innerHTML = '<p class="loading-message">Could not load projects. Please try again later.</p>';
    }
}

function renderPortfolio() {
    const grid = document.getElementById('portfolioGrid');
    if (!grid) return;
    let filtered = allPortfolioItems.slice();
    if (currentFilter !== 'all') {
        filtered = filtered.filter(item => {
            const cat = (item.category || item.type || '').toLowerCase();
            // Match either explicit category or service-type field
            return cat === currentFilter ||
                (item.serviceType || '').toLowerCase() === currentFilter ||
                (Array.isArray(item.tags) && item.tags.map(t => String(t).toLowerCase()).includes(currentFilter));
        });
    }
    if (filtered.length === 0) {
        grid.innerHTML = '<p class="loading-message">No projects in this category yet.</p>';
        return;
    }
    grid.innerHTML = '';
    filtered.forEach(item => grid.appendChild(buildPortfolioCard(item)));
}

function buildPortfolioCard(item) {
    const div = document.createElement('div');
    div.className = 'portfolio-item';
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');
    div.setAttribute('aria-label', `View project: ${item.title || 'Untitled project'}`);
    const onActivate = () => openPortfolioModal(item);
    div.addEventListener('click', onActivate);
    div.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onActivate();
        }
    });
    const media = item.mediaType === 'video'
        ? `<video src="${item.media || ''}" muted></video>`
        : `<img src="${item.media || ''}" alt="${utils.escapeHtml(item.title || 'Project')}" loading="lazy" onerror="this.style.opacity=0.2">`;
    div.innerHTML = `
        ${media}
        <div class="portfolio-item-overlay">
            <h4>${utils.escapeHtml(item.title || 'Untitled project')}</h4>
            <p>${utils.escapeHtml(item.category || item.serviceType || 'Project')}</p>
        </div>
    `;
    return div;
}

// ==================== PORTFOLIO MODAL ====================
function openPortfolioModal(item) {
    const body = document.getElementById('portfolioModalBody');
    const modal = document.getElementById('portfolioModal');
    if (!body || !modal) return;
    const media = item.mediaType === 'video'
        ? `<video src="${item.media || ''}" controls style="width:100%;border-radius:10px;margin-bottom:1rem;"></video>`
        : `<img src="${item.media || ''}" alt="${utils.escapeHtml(item.title || 'Project')}" style="width:100%;border-radius:10px;margin-bottom:1rem;" onerror="this.style.background='var(--bg-tertiary)';this.style.minHeight='200px';">`;
    body.innerHTML = `
        ${media}
        <span class="section-badge">${utils.escapeHtml(item.category || item.serviceType || 'Project')}</span>
        <h2 style="margin:0.5rem 0 1rem 0;">${utils.escapeHtml(item.title || 'Untitled project')}</h2>
        <p style="color:var(--text-secondary);line-height:1.7;">${utils.escapeHtml(item.description || '')}</p>
        ${item.location ? `<p style="font-size:0.85rem;color:var(--text-tertiary);margin-top:0.75rem;">Location: ${utils.escapeHtml(item.location)}</p>` : ''}
        ${item.completedAt ? `<p style="font-size:0.85rem;color:var(--text-tertiary);">Completed: ${utils.formatDate(item.completedAt)}</p>` : ''}
    `;
    modal.classList.add('active');
}

// ==================== FILTER BAR ====================
function initFilterBar() {
    const bar = document.getElementById('filterBar');
    if (!bar) return;
    bar.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter || 'all';
            renderPortfolio();
        });
    });
}

// ==================== PROJECT INQUIRY FORM ====================
async function submitProjectInquiry(e) {
    e.preventDefault();
    const name = document.getElementById('projectName').value.trim();
    const phone = document.getElementById('projectPhone').value.trim();
    const projectType = document.getElementById('projectType').value;
    const location = document.getElementById('projectLocation').value.trim();
    const title = document.getElementById('projectTitle').value.trim();
    const description = document.getElementById('projectDescription').value.trim();
    const budgetRaw = document.getElementById('projectBudget').value.trim();
    const timeline = document.getElementById('projectTimeline').value;
    const hasDrawing = document.getElementById('projectHasDrawing').checked;

    if (!name || !phone || !projectType || !location || !title || !description || !timeline) {
        utils.showToast('Please fill in all required fields', 'error');
        return;
    }

    // Ensure user is registered
    let user = utils.getUserFromStorage();
    if (!user) {
        user = { id: utils.generateUserId(), name, phone };
        utils.saveUserToStorage(user);
        await utils.registerUserInFirestore(user);
    } else {
        // Update stored name/phone if the user just typed different ones
        if (user.name !== name || user.phone !== phone) {
            user.name = name;
            user.phone = phone;
            utils.saveUserToStorage(user);
            await utils.registerUserInFirestore(user);
        }
    }

    const budget = budgetRaw ? Number(budgetRaw) : null;

    utils.showLoading(true, 'Submitting your project inquiry...');
    try {
        await addDoc(collection(db, 'projectBookings'), {
            userId: user.id,
            customerName: name,
            customerPhone: phone,
            projectType: projectType,
            projectLocation: location,
            title: title,
            description: description,
            budget: (budget && !Number.isNaN(budget)) ? budget : null,
            timeline: timeline,
            hasDrawing: !!hasDrawing,
            status: 'pending',
            createdAt: Timestamp.now()
        });
        utils.showLoading(false);
        utils.showToast('Project inquiry submitted! We will contact you within 1 business day.', 'success');
        document.getElementById('projectInquiryForm').reset();
    } catch (err) {
        warn(err);
        utils.showLoading(false);
        utils.showToast('Could not submit your inquiry. Please try again or contact us directly.', 'error');
        console.error('[projects.js] submission error:', err);
    }
}

// ==================== INIT ====================
function initProjectsPage() {
    initFilterBar();
    loadPortfolio();
    const form = document.getElementById('projectInquiryForm');
    if (form) form.addEventListener('submit', submitProjectInquiry);

    // If URL has #start-project, scroll there
    if (window.location.hash === '#start-project') {
        setTimeout(() => {
            document.getElementById('start-project')?.scrollIntoView({ behavior: 'smooth' });
        }, 300);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProjectsPage);
} else {
    initProjectsPage();
}

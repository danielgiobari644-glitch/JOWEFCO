// ==================== FIREBASE CONFIGURATION ====================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getFirestore, collection, getDocs, addDoc, doc, getDoc, setDoc, Timestamp, query, where } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js';

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
let currentPortfolioFilter = 'all';

// ==================== SVG ICON LIBRARY ====================
const SOCIAL_ICONS = {
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
    twitter: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>'
};

// ==================== UTILITY FUNCTIONS ====================
function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function getUserFromStorage() {
    const userId = localStorage.getItem('jowefco_user_id');
    const userName = localStorage.getItem('jowefco_user_name');
    const userPhone = localStorage.getItem('jowefco_user_phone');
    if (userId && userName && userPhone) {
        return { id: userId, name: userName, phone: userPhone };
    }
    return null;
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

async function updateUserLastVisit(userId) {
    try {
        await setDoc(doc(db, 'users', userId), {
            lastVisit: Timestamp.now()
        }, { merge: true });
    } catch (error) {
        console.error('Error updating last visit:', error);
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 3500);
}

function showLoading(show = true) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-NG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
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

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        if (navToggle) navToggle.classList.remove('active');
        if (navMenu) navMenu.classList.remove('active');
    });
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href && href !== '#' && href.length > 1) {
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    });
});

// Navbar scroll effect
window.addEventListener('scroll', () => {
    if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 30);

    const sections = document.querySelectorAll('section[id]');
    const scrollY = window.pageYOffset;
    sections.forEach(section => {
        const sectionTop = section.offsetTop - 120;
        const sectionHeight = section.offsetHeight;
        const sectionId = section.getAttribute('id');
        const link = document.querySelector(`.nav-link[href="#${sectionId}"]`);
        if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            if (link) link.classList.add('active');
        }
    });
});

// ==================== USER REGISTRATION ====================
async function checkAndRegisterUser() {
    currentUser = getUserFromStorage();
    const modal = document.getElementById('userRegistrationModal');

    if (!currentUser && modal) {
        modal.classList.add('active');

        const form = document.getElementById('userRegistrationForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('regName').value.trim();
                const phone = document.getElementById('regPhone').value.trim();
                if (!name || !phone) {
                    showToast('Please fill in all fields', 'error');
                    return;
                }
                const userId = generateUserId();
                currentUser = { id: userId, name, phone };
                saveUserToStorage(currentUser);
                await registerUserInFirestore(currentUser);
                modal.classList.remove('active');
                showToast('Welcome to JOWEFCO!', 'success');
            });
        }
    } else if (currentUser) {
        await updateUserLastVisit(currentUser.id);
    }
}

// ==================== LOAD HERO CONTENT ====================
let currentSlide = 0;
let slideshowInterval = null;
let heroMedia = [];

async function loadHeroContent() {
    try {
        const heroDoc = await getDoc(doc(db, 'settings', 'hero'));
        if (heroDoc.exists()) {
            const data = heroDoc.data();
            const titleEl = document.getElementById('heroTitle');
            const descEl = document.getElementById('heroDescription');
            if (titleEl) titleEl.textContent = data.title || 'Precision Welding & Metal Fabrication';
            if (descEl) descEl.textContent = data.description || 'Industrial-grade craftsmanship for bespoke technical solutions.';

            if (data.media && Array.isArray(data.media) && data.media.length > 0) {
                heroMedia = data.media;
                displayHeroMedia();
            } else {
                document.getElementById('heroMediaContainer').innerHTML = '<div class="hero-background"></div>';
            }
        } else {
            document.getElementById('heroMediaContainer').innerHTML = '<div class="hero-background"></div>';
        }
    } catch (error) {
        console.error('Error loading hero content:', error);
        document.getElementById('heroMediaContainer').innerHTML = '<div class="hero-background"></div>';
    }
}

function displayHeroMedia() {
    const container = document.getElementById('heroMediaContainer');
    const navElement = document.getElementById('slideshowNav');
    const dotsContainer = document.getElementById('slideshowDots');

    container.innerHTML = '';
    if (dotsContainer) dotsContainer.innerHTML = '';

    if (heroMedia.length === 0) {
        container.innerHTML = '<div class="hero-background"></div>';
        return;
    }

    heroMedia.forEach((media, index) => {
        const slide = document.createElement('div');
        slide.className = `hero-media-slide ${index === 0 ? 'active' : ''}`;
        const mediaSrc = media.url || media.data;

        if (media.type === 'video') {
            slide.innerHTML = `<video autoplay muted loop playsinline>
                <source src="${mediaSrc}" type="video/mp4">
            </video>`;
        } else {
            slide.innerHTML = `<img src="${mediaSrc}" alt="JOWEFCO project showcase ${index + 1}" onerror="this.style.display='none'">`;
        }
        container.appendChild(slide);

        if (heroMedia.length > 1 && dotsContainer) {
            const dot = document.createElement('div');
            dot.className = `slideshow-dot ${index === 0 ? 'active' : ''}`;
            dot.onclick = () => goToSlide(index);
            dotsContainer.appendChild(dot);
        }
    });

    if (heroMedia.length > 1) {
        if (navElement) navElement.style.display = 'flex';
        startSlideshow();
    } else {
        if (navElement) navElement.style.display = 'none';
    }
}

function goToSlide(index) {
    const slides = document.querySelectorAll('.hero-media-slide');
    const dots = document.querySelectorAll('.slideshow-dot');
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));
    currentSlide = index;
    if (slides[currentSlide]) slides[currentSlide].classList.add('active');
    if (dots[currentSlide]) dots[currentSlide].classList.add('active');
}

function nextSlide() {
    currentSlide = (currentSlide + 1) % heroMedia.length;
    goToSlide(currentSlide);
}

function prevSlide() {
    currentSlide = (currentSlide - 1 + heroMedia.length) % heroMedia.length;
    goToSlide(currentSlide);
}

function startSlideshow() {
    if (slideshowInterval) clearInterval(slideshowInterval);
    slideshowInterval = setInterval(nextSlide, 7000);
}

document.getElementById('nextSlide')?.addEventListener('click', () => {
    nextSlide();
    startSlideshow();
});
document.getElementById('prevSlide')?.addEventListener('click', () => {
    prevSlide();
    startSlideshow();
});

// ==================== LOAD STATS ====================
async function loadStats() {
    try {
        const portfolioSnapshot = await getDocs(collection(db, 'portfolio'));
        const countEl = document.getElementById('projectsCount');
        if (countEl) {
            const target = portfolioSnapshot.size || 0;
            animateCount(countEl, target);
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function animateCount(element, target) {
    const duration = 1500;
    const start = parseInt(element.textContent) || 0;
    const startTime = performance.now();
    function update(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const value = Math.floor(start + (target - start) * progress);
        element.textContent = value;
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

// ==================== LOAD PORTFOLIO ====================
async function loadPortfolio() {
    const grid = document.getElementById('portfolioGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="loading-message">Loading portfolio...</div>';

    try {
        const portfolioSnapshot = await getDocs(collection(db, 'portfolio'));
        if (portfolioSnapshot.empty) {
            grid.innerHTML = '<div class="loading-message">No portfolio items yet. Check back soon!</div>';
            return;
        }

        window.portfolioItems = [];
        portfolioSnapshot.forEach((doc) => {
            const item = { ...doc.data(), id: doc.id };
            window.portfolioItems.push(item);
        });

        window.portfolioItems.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
        });

        filterPortfolio(currentPortfolioFilter);
    } catch (error) {
        console.error('Error loading portfolio:', error);
        grid.innerHTML = '<div class="loading-message">Unable to load portfolio. Please try again later.</div>';
    }
}

function filterPortfolio(filter) {
    const grid = document.getElementById('portfolioGrid');
    if (!grid || !window.portfolioItems) return;
    grid.innerHTML = '';

    const filtered = filter === 'all'
        ? window.portfolioItems
        : window.portfolioItems.filter(item => item.category === filter);

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="loading-message">No items in this category.</div>';
        return;
    }

    filtered.forEach((item, index) => {
        const itemElement = createPortfolioItem(item);
        itemElement.style.animationDelay = `${index * 0.08}s`;
        grid.appendChild(itemElement);
    });
}

function createPortfolioItem(item) {
    const div = document.createElement('div');
    div.className = 'portfolio-item';
    div.style.animation = 'fadeInUp 0.6s ease-out backwards';
    div.onclick = () => showPortfolioModal(item);

    let mediaHtml;
    if (item.mediaType === 'video') {
        mediaHtml = `<video class="portfolio-item-media" src="${item.media}" muted loop playsinline></video>`;
    } else {
        mediaHtml = `<img class="portfolio-item-media" src="${item.media}" alt="${item.title}" loading="lazy">`;
    }

    const categoryLabel = item.category ? item.category.toUpperCase() : 'PROJECT';

    div.innerHTML = `
        ${mediaHtml}
        <div class="portfolio-item-overlay">
            <span class="portfolio-item-category">${categoryLabel}</span>
            <h3 class="portfolio-item-title">${item.title}</h3>
            <p class="portfolio-item-description">${item.description}</p>
        </div>
    `;
    return div;
}

function showPortfolioModal(item) {
    const modal = document.getElementById('portfolioModal');
    const mediaContainer = document.getElementById('portfolioModalMedia');

    let mediaHtml;
    if (item.mediaType === 'video') {
        mediaHtml = `<video controls autoplay loop style="width: 100%; height: 100%; object-fit: cover;">
            <source src="${item.media}" type="video/mp4">
        </video>`;
    } else {
        mediaHtml = `<img src="${item.media}" alt="${item.title}" style="width: 100%; height: 100%; object-fit: cover;">`;
    }

    mediaContainer.innerHTML = mediaHtml;
    document.getElementById('portfolioModalCategory').textContent = item.category ? item.category.toUpperCase() : 'PROJECT';
    document.getElementById('portfolioModalTitle').textContent = item.title;
    document.getElementById('portfolioModalDescription').textContent = item.description;
    document.getElementById('portfolioModalDate').textContent = formatDate(item.createdAt);
    document.getElementById('portfolioModalType').textContent = item.category || 'General';

    modal.classList.add('active');
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.onclick = () => modal.classList.remove('active');
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
}

document.querySelectorAll('.portfolio-filter .filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.portfolio-filter .filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filterPortfolio(btn.dataset.filter);
    });
});

// ==================== LOAD CONTACT INFO ====================
async function loadContactInfo() {
    try {
        const contactDoc = await getDoc(doc(db, 'settings', 'contact'));
        if (contactDoc.exists()) {
            const data = contactDoc.data();
            const phone = data.phone || 'Not available';
            const email = data.email || 'Not available';
            const address = data.address || 'Not available';

            const phoneEl = document.getElementById('contactPhone');
            const emailEl = document.getElementById('contactEmail');
            const addrEl = document.getElementById('contactAddress');
            if (phoneEl) phoneEl.textContent = phone;
            if (emailEl) emailEl.textContent = email;
            if (addrEl) addrEl.textContent = address;

            const footerPhone = document.getElementById('footerPhone');
            const footerEmail = document.getElementById('footerEmail');
            const footerAddr = document.getElementById('footerAddress');
            if (footerPhone) footerPhone.querySelector('span').textContent = phone;
            if (footerEmail) footerEmail.querySelector('span').textContent = email;
            if (footerAddr) footerAddr.querySelector('span').textContent = address;

            const callLink = document.getElementById('callLink');
            const emailLink = document.getElementById('emailLink');
            const locationLink = document.getElementById('locationLink');
            if (callLink) callLink.href = `tel:${phone}`;
            if (emailLink) emailLink.href = `mailto:${email}`;
            if (locationLink) locationLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
        }
    } catch (error) {
        console.error('Error loading contact info:', error);
    }
}

// ==================== LOAD SOCIAL LINKS ====================
async function loadSocialLinks() {
    const footerSocial = document.getElementById('footerSocial');
    if (!footerSocial) return;

    try {
        const socialDoc = await getDoc(doc(db, 'settings', 'social'));
        const links = socialDoc.exists() ? socialDoc.data() : {};

        footerSocial.innerHTML = '';
        const platforms = ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok'];
        let hasAny = false;

        platforms.forEach(platform => {
            const url = links[platform];
            if (url && url.trim()) {
                hasAny = true;
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

        if (!hasAny) {
            footerSocial.innerHTML = '<p style="color: var(--text-tertiary); font-size: 0.85rem;">Follow us on social media soon!</p>';
        }
    } catch (error) {
        console.error('Error loading social links:', error);
    }
}

// ==================== TESTIMONIALS ====================
async function loadTestimonials() {
    const grid = document.getElementById('testimonialsGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="loading-message">Loading reviews...</div>';

    try {
        const testimonialsSnapshot = await getDocs(
            query(collection(db, 'testimonials'), where('approved', '==', true))
        );
        if (testimonialsSnapshot.empty) {
            grid.innerHTML = '<div class="loading-message">No reviews yet. Be the first to share your experience!</div>';
            return;
        }

        const testimonials = [];
        testimonialsSnapshot.forEach((doc) => {
            const testimonial = { ...doc.data(), id: doc.id };
            testimonials.push(testimonial);
        });
        testimonials.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
        });

        grid.innerHTML = '';
        testimonials.forEach((testimonial, index) => {
            const card = createTestimonialCard(testimonial);
            card.style.animationDelay = `${index * 0.1}s`;
            grid.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading testimonials:', error);
    }
}

function createTestimonialCard(testimonial) {
    const div = document.createElement('div');
    div.className = 'testimonial-card';
    div.style.animation = 'fadeInUp 0.6s ease-out backwards';
    const stars = '★'.repeat(testimonial.rating) + '☆'.repeat(5 - testimonial.rating);
    const initial = testimonial.name.charAt(0).toUpperCase();
    div.innerHTML = `
        <div class="testimonial-header">
            <div class="testimonial-avatar">${initial}</div>
            <div class="testimonial-info">
                <h4>${testimonial.name}</h4>
                ${testimonial.company ? `<p class="testimonial-company">${testimonial.company}</p>` : ''}
            </div>
        </div>
        <div class="testimonial-stars">${stars}</div>
        <p class="testimonial-text">"${testimonial.text}"</p>
    `;
    return div;
}

document.getElementById('addTestimonialBtn')?.addEventListener('click', () => {
    const modal = document.getElementById('testimonialModal');
    if (modal) {
        const userName = localStorage.getItem('jowefco_user_name');
        if (userName) document.getElementById('testimonialName').value = userName;
        modal.classList.add('active');
    }
});

document.querySelectorAll('#starRating .star').forEach(star => {
    star.addEventListener('click', function () {
        const rating = parseInt(this.dataset.rating);
        document.getElementById('testimonialRating').value = rating;
        document.querySelectorAll('#starRating .star').forEach((s, index) => {
            s.classList.toggle('active', index < rating);
        });
    });
});

document.getElementById('testimonialForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('testimonialName').value.trim();
    const company = document.getElementById('testimonialCompany').value.trim();
    const rating = parseInt(document.getElementById('testimonialRating').value);
    const text = document.getElementById('testimonialText').value.trim();

    if (!name || !text) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    try {
        showLoading(true);
        await addDoc(collection(db, 'testimonials'), {
            name,
            company: company || null,
            rating,
            text,
            approved: false,
            createdAt: Timestamp.now()
        });
        showLoading(false);
        document.getElementById('testimonialModal').classList.remove('active');
        document.getElementById('testimonialForm').reset();
        document.querySelectorAll('#starRating .star').forEach((s, i) => s.classList.toggle('active', i < 5));
        document.getElementById('testimonialRating').value = 5;
        showToast('Thank you! Your review will appear after approval.', 'success');
    } catch (error) {
        showLoading(false);
        console.error('Error submitting review:', error);
        showToast('Could not submit review. Please try again.', 'error');
    }
});

document.querySelector('#testimonialModal .modal-close')?.addEventListener('click', () => {
    document.getElementById('testimonialModal').classList.remove('active');
});
document.getElementById('testimonialModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        e.currentTarget.classList.remove('active');
    }
});

// ==================== WHATSAPP ====================
function initWhatsApp() {
    const whatsappBtn = document.getElementById('whatsappBtn');
    if (!whatsappBtn) return;

    getDoc(doc(db, 'settings', 'contact')).then(contactDoc => {
        let phone = '08012345678';
        if (contactDoc.exists()) {
            phone = contactDoc.data().phone || phone;
        }
        const cleanPhone = phone.replace(/\D/g, '');
        whatsappBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const message = encodeURIComponent('Hi! I would like to inquire about your premium technical services.');
            window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
        });
    }).catch(err => console.error('WhatsApp init error:', err));
}

// ==================== REVEAL ANIMATIONS ====================
function initReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ==================== INITIALIZATION ====================
async function init() {
    await checkAndRegisterUser();
    await Promise.all([
        loadHeroContent(),
        loadStats(),
        loadPortfolio(),
        loadContactInfo(),
        loadTestimonials(),
        loadSocialLinks()
    ]);
    initWhatsApp();
    initReveal();
}

init();

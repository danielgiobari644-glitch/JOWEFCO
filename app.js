/* ============================================
   JOWEFCO - Main App Logic
   ============================================ */

// ---- State ----
let cart = [];
let shopItems = [];
let currentItemDetail = null;
let paymentGateways = {};
let activeFilter = 'all';

// ---- Page Loader ----
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('pageLoader').classList.add('hidden');
  }, 600);
  initApp();
});

function initApp() {
  initNavbar();
  initScrollAnimations();
  loadShopItems();
  loadSocialLinks();
  loadPaymentGateways();
  loadCartFromStorage();
  updateCartUI();

  // Contact form
  document.getElementById('contactForm').addEventListener('submit', handleContactForm);

  // Hamburger
  document.getElementById('navHamburger').addEventListener('click', toggleMobileNav);
  document.getElementById('navHamburger').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMobileNav(); }
  });

  // Cart button
  document.getElementById('cartBtn').addEventListener('click', openCart);
}

// ---- Navbar ----
function initNavbar() {
  window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    const scrollTop = document.getElementById('scrollTop');
    if (window.scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    if (window.scrollY > 400) {
      scrollTop.classList.add('visible');
    } else {
      scrollTop.classList.remove('visible');
    }
    updateActiveNavLink();
  });

  // Smooth scroll for nav links
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function updateActiveNavLink() {
  const sections = document.querySelectorAll('section[id]');
  let current = '';
  sections.forEach(section => {
    const top = section.offsetTop - 120;
    if (window.scrollY >= top) current = section.getAttribute('id');
  });
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('href') === '#' + current) link.classList.add('active');
  });
}

// ---- Mobile Nav ----
function toggleMobileNav() {
  const hamburger = document.getElementById('navHamburger');
  const mobileNav = document.getElementById('mobileNav');
  hamburger.classList.toggle('active');
  mobileNav.classList.toggle('active');
  document.body.style.overflow = mobileNav.classList.contains('active') ? 'hidden' : '';
}

function closeMobileNav() {
  document.getElementById('navHamburger').classList.remove('active');
  document.getElementById('mobileNav').classList.remove('active');
  document.body.style.overflow = '';
}

// ---- Scroll Animations ----
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
}

// ---- Toast Notifications ----
function showToast(title, message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const icons = {
    success: 'fas fa-check',
    error: 'fas fa-xmark',
    warning: 'fas fa-exclamation',
    info: 'fas fa-info'
  };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon"><i class="${icons[type]}"></i></div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <span class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-xmark"></i></span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// ---- Auth ----
function openAuthModal() {
  if (window.currentUser) {
    if (confirm('You are signed in as ' + window.currentUser.email + '. Sign out?')) {
      auth.signOut();
    }
    return;
  }
  document.getElementById('authModal').classList.add('active');
  switchAuthTab('login');
}

function closeAuthModal() {
  document.getElementById('authModal').classList.remove('active');
}

function switchAuthTab(tab) {
  const tabs = document.querySelectorAll('.modal-tab');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  tabs.forEach(t => t.classList.remove('active'));
  if (tab === 'login') {
    tabs[0].classList.add('active');
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
  } else {
    tabs[1].classList.add('active');
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
  }
}

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) return showToast('Error', 'Please fill in all fields.', 'error');

  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      closeAuthModal();
      showToast('Welcome back!', 'You have signed in successfully.', 'success');
    })
    .catch(err => {
      showToast('Sign In Failed', err.message, 'error');
    });
}

function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  if (!name || !email || !password) return showToast('Error', 'Please fill in all fields.', 'error');

  auth.createUserWithEmailAndPassword(email, password)
    .then((cred) => {
      return db.collection('users').doc(cred.user.uid).set({
        name: name,
        email: email,
        role: 'customer',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    })
    .then(() => {
      closeAuthModal();
      showToast('Account Created!', 'Welcome to Jowefco!', 'success');
    })
    .catch(err => {
      showToast('Registration Failed', err.message, 'error');
    });
}

function onAuthStateReady(user) {
  const authBtn = document.getElementById('authBtn');
  if (user) {
    authBtn.innerHTML = '<i class="fas fa-user-check"></i> Sign Out';
    authBtn.onclick = null;
    authBtn.addEventListener('click', () => {
      if (confirm('Sign out of ' + user.email + '?')) {
        auth.signOut();
      }
    });
  } else {
    authBtn.innerHTML = '<i class="fas fa-user"></i> Sign In';
    authBtn.onclick = openAuthModal;
  }
}

function onUserLoggedOut() {
  const authBtn = document.getElementById('authBtn');
  authBtn.innerHTML = '<i class="fas fa-user"></i> Sign In';
  authBtn.onclick = openAuthModal;
  showToast('Signed Out', 'You have been signed out.', 'info');
}

// ---- Shop Items ----
function loadShopItems() {
  db.collection('shopItems').orderBy('createdAt', 'desc').get()
    .then(snapshot => {
      shopItems = [];
      const categories = new Set();
      snapshot.forEach(doc => {
        const data = doc.data();
        data.id = doc.id;
        if (data.active !== false) {
          shopItems.push(data);
          if (data.category) categories.add(data.category);
        }
      });
      renderShopFilters(categories);
      renderShopItems();
    })
    .catch(err => {
      console.error('Error loading shop items:', err);
      document.getElementById('shopEmpty').style.display = 'block';
    });
}

function renderShopFilters(categories) {
  const container = document.getElementById('shopFilters');
  const existing = container.querySelectorAll('[data-category]:not([data-category="all"])');
  existing.forEach(el => el.remove());
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'shop-filter-btn';
    btn.dataset.category = cat;
    btn.textContent = cat;
    btn.onclick = () => filterShop(cat);
    container.appendChild(btn);
  });
}

function filterShop(category) {
  activeFilter = category;
  document.querySelectorAll('.shop-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category);
  });
  renderShopItems();
}

function renderShopItems() {
  const grid = document.getElementById('shopGrid');
  const emptyEl = document.getElementById('shopEmpty');
  const filtered = activeFilter === 'all' ? shopItems : shopItems.filter(i => i.category === activeFilter);

  // Clear existing cards (not the empty state)
  grid.querySelectorAll('.shop-card').forEach(el => el.remove());

  if (filtered.length === 0) {
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'shop-card';
    card.onclick = () => openItemDetail(item);

    let badgeHtml = '';
    if (item.badge === 'sale') badgeHtml = '<span class="shop-card-badge sale">Sale</span>';
    else if (item.badge === 'new') badgeHtml = '<span class="shop-card-badge new">New</span>';
    else if (item.badge === 'featured') badgeHtml = '<span class="shop-card-badge featured">Featured</span>';

    const stock = item.stock || 0;
    let stockClass = 'in-stock';
    let stockText = 'In Stock';
    if (stock === 0) { stockClass = 'out-of-stock'; stockText = 'Out of Stock'; }
    else if (stock <= 5) { stockClass = 'low-stock'; stockText = 'Only ' + stock + ' left'; }

    const icon = item.icon || 'fas fa-box-open';
    const oldPriceHtml = item.oldPrice ? `<span class="old-price">$${parseFloat(item.oldPrice).toFixed(2)}</span>` : '';

    card.innerHTML = `
      ${badgeHtml}
      <div class="shop-card-image"><i class="${icon}"></i></div>
      <div class="shop-card-body">
        <div class="shop-card-category">${escapeHtml(item.category || 'General')}</div>
        <div class="shop-card-title">${escapeHtml(item.name)}</div>
        <div class="shop-card-desc">${escapeHtml(item.description || '')}</div>
        <div class="shop-card-footer">
          <div class="shop-card-price">$${parseFloat(item.price).toFixed(2)} ${oldPriceHtml}</div>
          <div class="shop-card-stock ${stockClass}">${stockText}</div>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ---- Item Detail Modal ----
function openItemDetail(item) {
  currentItemDetail = item;
  document.getElementById('itemDetailImage').innerHTML = `<i class="${item.icon || 'fas fa-box-open'}"></i>`;
  document.getElementById('itemDetailCategory').textContent = item.category || 'General';
  document.getElementById('itemDetailTitle').textContent = item.name;
  document.getElementById('itemDetailDesc').textContent = item.description || '';
  document.getElementById('itemDetailPrice').innerHTML = `$${parseFloat(item.price).toFixed(2)}` +
    (item.oldPrice ? ` <span class="old-price" style="font-size:1rem;">$${parseFloat(item.oldPrice).toFixed(2)}</span>` : '');

  const outOfStock = (item.stock || 0) === 0;
  document.getElementById('itemDetailAddCart').disabled = outOfStock;
  document.getElementById('itemDetailBuyNow').disabled = outOfStock;

  document.getElementById('itemDetailModal').classList.add('active');
}

function closeItemDetail() {
  document.getElementById('itemDetailModal').classList.remove('active');
  currentItemDetail = null;
}

function addToCartFromDetail() {
  if (!currentItemDetail) return;
  addToCart(currentItemDetail);
  closeItemDetail();
}

function buyNowFromDetail() {
  if (!currentItemDetail) return;
  addToCart(currentItemDetail);
  closeItemDetail();
  openCart();
}

// ---- Cart ----
function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem('jowefco_cart');
    if (saved) cart = JSON.parse(saved);
  } catch (e) { cart = []; }
}

function saveCartToStorage() {
  localStorage.setItem('jowefco_cart', JSON.stringify(cart));
}

function addToCart(item) {
  const existing = cart.find(c => c.id === item.id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: item.id, name: item.name, price: item.price, icon: item.icon || 'fas fa-box-open', qty: 1 });
  }
  saveCartToStorage();
  updateCartUI();
  showToast('Added to Cart', item.name + ' has been added to your cart.', 'success');
}

function removeFromCart(itemId) {
  cart = cart.filter(c => c.id !== itemId);
  saveCartToStorage();
  updateCartUI();
}

function updateCartQty(itemId, delta) {
  const item = cart.find(c => c.id === itemId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    removeFromCart(itemId);
    return;
  }
  saveCartToStorage();
  updateCartUI();
}

function updateCartUI() {
  const count = cart.reduce((sum, c) => sum + c.qty, 0);
  const total = cart.reduce((sum, c) => sum + (c.price * c.qty), 0);

  // Nav cart count (visual indicator)
  const cartBtn = document.getElementById('cartBtn');
  // Use a badge approach
  let badge = cartBtn.querySelector('.cart-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'cart-badge';
    badge.style.cssText = 'position:absolute;top:-4px;right:-4px;background:var(--secondary);color:white;font-size:0.65rem;font-weight:700;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;';
    cartBtn.style.position = 'relative';
    cartBtn.appendChild(badge);
  }
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';

  // Drawer
  document.getElementById('cartDrawerCount').textContent = count;
  document.getElementById('cartTotalPrice').textContent = '$' + total.toFixed(2);

  const body = document.getElementById('cartDrawerBody');
  const emptyEl = document.getElementById('cartEmpty');
  const footer = document.getElementById('cartDrawerFooter');

  body.querySelectorAll('.cart-item').forEach(el => el.remove());

  if (cart.length === 0) {
    emptyEl.style.display = 'block';
    footer.style.display = 'none';
  } else {
    emptyEl.style.display = 'none';
    footer.style.display = 'block';
    cart.forEach(item => {
      const div = document.createElement('div');
      div.className = 'cart-item';
      div.innerHTML = `
        <div class="cart-item-image"><i class="${item.icon}"></i></div>
        <div class="cart-item-info">
          <div class="cart-item-title">${escapeHtml(item.name)}</div>
          <div class="cart-item-price">$${(item.price * item.qty).toFixed(2)}</div>
          <div class="cart-item-qty">
            <button onclick="event.stopPropagation();updateCartQty('${item.id}',-1)"><i class="fas fa-minus"></i></button>
            <span>${item.qty}</span>
            <button onclick="event.stopPropagation();updateCartQty('${item.id}',1)"><i class="fas fa-plus"></i></button>
          </div>
        </div>
        <span class="cart-item-remove" onclick="event.stopPropagation();removeFromCart('${item.id}')"><i class="fas fa-trash-can"></i></span>
      `;
      body.appendChild(div);
    });
  }
}

function openCart() {
  document.getElementById('cartDrawer').classList.add('active');
  document.getElementById('cartDrawerOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cartDrawer').classList.remove('active');
  document.getElementById('cartDrawerOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

// ---- Payment Gateways (load config for checkout) ----
function loadPaymentGateways() {
  db.collection('config').doc('paymentGateways').get()
    .then(doc => {
      if (doc.exists) {
        paymentGateways = doc.data();
      }
    })
    .catch(err => console.error('Error loading payment gateways:', err));
}

// ---- Social Links ----
function loadSocialLinks() {
  db.collection('config').doc('socialLinks').get()
    .then(doc => {
      if (doc.exists) {
        const links = doc.data();
        const platforms = ['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'whatsapp', 'telegram', 'tiktok'];
        platforms.forEach(p => {
          const linkEl = document.querySelector(`.social-link[data-platform="${p}"]`);
          if (linkEl && links[p]) {
            linkEl.href = links[p];
            linkEl.target = '_blank';
            linkEl.rel = 'noopener noreferrer';
          }
        });
      }
    })
    .catch(err => console.error('Error loading social links:', err));
}

// ---- Checkout ----
function openCheckout() {
  if (cart.length === 0) {
    showToast('Empty Cart', 'Add some items before checking out.', 'warning');
    return;
  }
  closeCart();

  // Build summary
  const summary = document.getElementById('checkoutSummary');
  let html = '';
  cart.forEach(item => {
    html += `<div class="checkout-item"><span>${escapeHtml(item.name)} x${item.qty}</span><span class="price">$${(item.price * item.qty).toFixed(2)}</span></div>`;
  });
  const total = cart.reduce((sum, c) => sum + (c.price * c.qty), 0);
  html += `<div class="checkout-item total"><span>Total</span><span class="price">$${total.toFixed(2)}</span></div>`;
  summary.innerHTML = html;

  // Build payment options
  const optionsContainer = document.getElementById('paymentGatewayOptions');
  const warning = document.getElementById('checkoutWarning');
  const payBtn = document.getElementById('checkoutPayBtn');
  optionsContainer.innerHTML = '';

  const gatewayNames = {
    paypal: { name: 'PayPal', icon: 'fab fa-paypal', cssClass: 'paypal' },
    stripe: { name: 'Stripe', icon: 'fab fa-stripe-s', cssClass: 'stripe' },
    paystack: { name: 'Paystack', icon: 'fas fa-naira-sign', cssClass: 'paystack' },
    coinbase: { name: 'Coinbase Commerce', icon: 'fab fa-bitcoin', cssClass: 'coinbase' }
  };

  let hasGateway = false;
  let firstGatewayKey = null;

  Object.keys(gatewayNames).forEach(key => {
    const gw = paymentGateways[key] || {};
    if (gw.enabled && gw.clientId) {
      hasGateway = true;
      if (!firstGatewayKey) firstGatewayKey = key;
      const info = gatewayNames[key];
      const option = document.createElement('label');
      option.className = 'payment-gateway-option';
      option.innerHTML = `
        <input type="radio" name="gateway" value="${key}">
        <span class="radio-dot"></span>
        <span class="gateway-logo ${info.cssClass}" style="width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:0.9rem;"><i class="${info.icon}"></i></span>
        <span style="font-weight:600;">${info.name}</span>
      `;
      option.onclick = function () {
        document.querySelectorAll('.payment-gateway-option').forEach(o => o.classList.remove('selected'));
        this.classList.add('selected');
        this.querySelector('input').checked = true;
        payBtn.disabled = false;
      };
      optionsContainer.appendChild(option);
    }
  });

  if (!hasGateway) {
    warning.style.display = 'flex';
    payBtn.disabled = true;
  } else {
    warning.style.display = 'none';
    payBtn.disabled = false;
    // Auto-select first
    const firstOption = optionsContainer.querySelector('.payment-gateway-option');
    if (firstOption) firstOption.click();
  }

  document.getElementById('checkoutModal').classList.add('active');
}

function closeCheckout() {
  document.getElementById('checkoutModal').classList.remove('active');
}

function processPayment() {
  const selected = document.querySelector('input[name="gateway"]:checked');
  if (!selected) {
    showToast('No Gateway', 'Please select a payment method.', 'warning');
    return;
  }

  const gatewayKey = selected.value;
  const gw = paymentGateways[gatewayKey] || {};
  const total = cart.reduce((sum, c) => sum + (c.price * c.qty), 0);
  const user = window.currentUser;

  if (!user) {
    showToast('Sign In Required', 'Please sign in to complete your purchase.', 'warning');
    closeCheckout();
    openAuthModal();
    return;
  }

  // Save order to Firestore
  const order = {
    userId: user.uid,
    userEmail: user.email,
    userName: user.displayName || user.email,
    items: cart.map(c => ({ id: c.id, name: c.name, price: c.price, qty: c.qty })),
    total: total,
    gateway: gatewayKey,
    status: 'pending',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  db.collection('orders').add(order)
    .then(docRef => {
      showToast('Order Created!', 'Your order #' + docRef.id.substring(0, 8) + ' has been placed. You will be redirected to payment.', 'success');

      // Attempt to redirect to the payment gateway
      redirectTopaymentGateway(gatewayKey, gw, order, docRef.id);
    })
    .catch(err => {
      showToast('Order Failed', err.message, 'error');
    });
}

function redirectTopaymentGateway(gatewayKey, gwConfig, order, orderId) {
  // Gateway-agnostic redirect logic
  // Each gateway has its own SDK / redirect pattern
  // This function handles the redirect based on which gateway was selected

  const returnUrl = window.location.href;
  const cancelUrl = window.location.href;

  switch (gatewayKey) {
    case 'paypal':
      // PayPal: In production, you'd use the PayPal JS SDK with the client ID
      // For now, redirect to PayPal with the client ID as a query parameter indicator
      // The admin must set up PayPal Business SDK integration on their server
      showToast('PayPal Payment', 'Redirecting to PayPal... (Configure PayPal SDK for full integration)', 'info');
      // Example redirect (actual implementation needs server-side order creation):
      // window.location.href = `https://www.paypal.com/cgi-bin/webscr?cmd=_express-checkout&token=...`;
      closeCheckout();
      cart = [];
      saveCartToStorage();
      updateCartUI();
      break;

    case 'stripe':
      // Stripe: In production, you'd use Stripe.js with the publishable key
      showToast('Stripe Payment', 'Redirecting to Stripe... (Configure Stripe.js for full integration)', 'info');
      closeCheckout();
      cart = [];
      saveCartToStorage();
      updateCartUI();
      break;

    case 'paystack':
      // Paystack: In production, you'd use Paystack inline JS with the public key
      showToast('Paystack Payment', 'Redirecting to Paystack... (Configure Paystack.js for full integration)', 'info');
      closeCheckout();
      cart = [];
      saveCartToStorage();
      updateCartUI();
      break;

    case 'coinbase':
      // Coinbase Commerce: In production, use Coinbase Commerce JS SDK
      showToast('Coinbase Payment', 'Redirecting to Coinbase... (Configure Coinbase Commerce SDK for full integration)', 'info');
      closeCheckout();
      cart = [];
      saveCartToStorage();
      updateCartUI();
      break;

    default:
      showToast('Payment', 'Payment gateway not recognized.', 'error');
  }
}

// ---- Contact Form ----
function handleContactForm(e) {
  e.preventDefault();
  const name = document.getElementById('contactName').value.trim();
  const email = document.getElementById('contactEmail').value.trim();
  const subject = document.getElementById('contactSubject').value.trim();
  const message = document.getElementById('contactMessage').value.trim();

  if (!name || !email || !subject || !message) {
    return showToast('Error', 'Please fill in all fields.', 'error');
  }

  db.collection('messages').add({
    name: name,
    email: email,
    subject: subject,
    message: message,
    read: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  })
  .then(() => {
    showToast('Message Sent!', 'Thank you for reaching out. We will get back to you soon.', 'success');
    e.target.reset();
  })
  .catch(err => {
    showToast('Failed to Send', err.message, 'error');
  });
}

// ---- Utility ----
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- Close modals on overlay click ----
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  });
});

// ---- Keyboard: Escape to close modals ----
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    closeCart();
    closeMobileNav();
    document.body.style.overflow = '';
  }
});
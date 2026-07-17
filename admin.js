/* ============================================
   JOWEFCO - Admin Panel Logic
   ============================================ */

let currentMessageId = null;

// ---- Init ----
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('pageLoader').classList.add('hidden');
  }, 400);

  // Wait for auth state
  auth.onAuthStateChanged((user) => {
    if (user) {
      checkAdminRole(user);
    } else {
      showAdminLogin();
    }
  });
});

function showAdminLogin() {
  document.getElementById('adminLoginGate').style.display = 'flex';
  document.getElementById('adminLayout').style.display = 'none';
}

function showAdminPanel() {
  document.getElementById('adminLoginGate').style.display = 'none';
  document.getElementById('adminLayout').style.display = 'grid';
  loadDashboardStats();
  loadAdminItems();
  loadAllOrders();
  loadGatewayConfigs();
  loadSocialConfig();
  loadUsers();
  loadMessages();
}

function checkAdminRole(user) {
  db.collection('users').doc(user.uid).get()
    .then(doc => {
      if (doc.exists && (doc.data().role === 'admin' || doc.data().role === 'superadmin')) {
        showAdminPanel();
        document.getElementById('adminWelcomeText').textContent = 'Welcome, ' + (doc.data().name || user.email);
      } else {
        // If no user doc yet, allow first user to be admin (bootstrap)
        if (!doc.exists) {
          db.collection('users').doc(user.uid).set({
            name: user.displayName || user.email,
            email: user.email,
            role: 'admin',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }).then(() => {
            showAdminPanel();
            showToast('Admin Created', 'You have been set up as the first admin.', 'success');
          });
        } else {
          showToast('Access Denied', 'You do not have admin privileges.', 'error');
          auth.signOut();
        }
      }
    })
    .catch(err => {
      console.error('Error checking admin role:', err);
      showAdminLogin();
    });
}

function handleAdminLogin(e) {
  e.preventDefault();
  const email = document.getElementById('adminLoginEmail').value.trim();
  const password = document.getElementById('adminLoginPassword').value;
  if (!email || !password) return showToast('Error', 'Please fill in all fields.', 'error');

  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      showToast('Signed In', 'Welcome to the admin panel.', 'success');
    })
    .catch(err => {
      showToast('Login Failed', err.message, 'error');
    });
}

function handleAdminLogout() {
  if (confirm('Are you sure you want to sign out?')) {
    auth.signOut();
    showToast('Signed Out', 'You have been signed out.', 'info');
  }
}

// ---- Tabs ----
function switchAdminTab(tabName, navItem) {
  document.querySelectorAll('.admin-tab-content').forEach(t => t.style.display = 'none');
  document.querySelectorAll('.admin-nav-item').forEach(n => n.classList.remove('active'));
  const tabEl = document.getElementById('tab-' + tabName);
  if (tabEl) tabEl.style.display = 'block';
  if (navItem) navItem.classList.add('active');

  // Refresh data for tab
  if (tabName === 'dashboard') loadDashboardStats();
  if (tabName === 'shop') loadAdminItems();
  if (tabName === 'orders') loadAllOrders();
  if (tabName === 'users') loadUsers();
  if (tabName === 'messages') loadMessages();
}

// ---- Dashboard Stats ----
function loadDashboardStats() {
  let items = 0, orders = 0, users = 0, messages = 0;

  db.collection('shopItems').get().then(s => { items = s.size; updateStat('statTotalItems', items); });
  db.collection('orders').get().then(s => {
    orders = s.size;
    updateStat('statTotalOrders', orders);
    renderRecentOrders(s);
  });
  db.collection('users').get().then(s => { users = s.size; updateStat('statTotalUsers', users); });
  db.collection('messages').get().then(s => { messages = s.size; updateStat('statTotalMessages', messages); });
}

function updateStat(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderRecentOrders(snapshot) {
  const body = document.getElementById('recentOrdersBody');
  body.innerHTML = '';
  const orders = [];
  snapshot.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));
  orders.sort((a, b) => {
    const ta = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
    const tb = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
    return tb - ta;
  });
  const recent = orders.slice(0, 5);
  if (recent.length === 0) {
    body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:40px;">No orders yet</td></tr>';
    return;
  }
  recent.forEach(order => {
    const date = order.createdAt ? (order.createdAt.toDate ? order.createdAt.toDate().toLocaleDateString() : 'N/A') : 'N/A';
    const statusClass = order.status === 'completed' ? 'active' : order.status === 'cancelled' ? 'inactive' : 'pending';
    const itemNames = (order.items || []).map(i => i.name).join(', ') || 'N/A';
    body.innerHTML += `
      <tr>
        <td style="font-family:monospace;font-size:0.8rem;">#${order.id.substring(0, 8)}</td>
        <td>${escapeHtml(order.userName || 'Guest')}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(itemNames)}</td>
        <td style="color:var(--accent);font-weight:700;">$${parseFloat(order.total || 0).toFixed(2)}</td>
        <td><span class="status-badge ${statusClass}">${order.status || 'pending'}</span></td>
        <td style="color:var(--text-muted);font-size:0.85rem;">${date}</td>
      </tr>`;
  });
}

// ---- Shop Item Management ----
function toggleItemForm(show) {
  const form = document.getElementById('adminItemForm');
  if (show === false || form.classList.contains('active')) {
    form.classList.remove('active');
    resetItemForm();
  } else {
    form.classList.add('active');
  }
}

function resetItemForm() {
  document.getElementById('editItemId').value = '';
  document.getElementById('itemName').value = '';
  document.getElementById('itemCategory').value = '';
  document.getElementById('itemPrice').value = '';
  document.getElementById('itemOldPrice').value = '';
  document.getElementById('itemStock').value = '';
  document.getElementById('itemBadge').value = '';
  document.getElementById('itemIcon').value = 'fas fa-box-open';
  document.getElementById('itemDescription').value = '';
  document.getElementById('itemActive').checked = true;
  document.getElementById('itemFormTitle').innerHTML = '<i class="fas fa-plus-circle" style="color:var(--primary-light);margin-right:8px;"></i>Add New Item';
}

function handleSaveItem(e) {
  e.preventDefault();
  const editId = document.getElementById('editItemId').value;
  const itemData = {
    name: document.getElementById('itemName').value.trim(),
    category: document.getElementById('itemCategory').value.trim(),
    price: parseFloat(document.getElementById('itemPrice').value) || 0,
    oldPrice: parseFloat(document.getElementById('itemOldPrice').value) || null,
    stock: parseInt(document.getElementById('itemStock').value) || 0,
    badge: document.getElementById('itemBadge').value,
    icon: document.getElementById('itemIcon').value.trim() || 'fas fa-box-open',
    description: document.getElementById('itemDescription').value.trim(),
    active: document.getElementById('itemActive').checked,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (!itemData.name || !itemData.category) {
    return showToast('Error', 'Name and category are required.', 'error');
  }

  let promise;
  if (editId) {
    promise = db.collection('shopItems').doc(editId).update(itemData);
  } else {
    itemData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    promise = db.collection('shopItems').add(itemData);
  }

  promise.then(() => {
    showToast('Saved!', editId ? 'Item updated successfully.' : 'Item added successfully.', 'success');
    toggleItemForm(false);
    loadAdminItems();
    loadDashboardStats();
  }).catch(err => {
    showToast('Error', err.message, 'error');
  });
}

function loadAdminItems() {
  db.collection('shopItems').orderBy('createdAt', 'desc').get()
    .then(snapshot => {
      const body = document.getElementById('adminItemsBody');
      body.innerHTML = '';
      if (snapshot.empty) {
        body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:40px;">No items yet. Click "Add New Item" to get started.</td></tr>';
        return;
      }
      snapshot.forEach(doc => {
        const item = doc.data();
        item.id = doc.id;
        const statusClass = item.active !== false ? 'active' : 'inactive';
        const statusText = item.active !== false ? 'Active' : 'Inactive';
        const badgeDisplay = item.badge ? `<span class="shop-card-badge ${item.badge}" style="font-size:0.7rem;">${item.badge}</span>` : '<span style="color:var(--text-muted);">—</span>';
        body.innerHTML += `
          <tr>
            <td><strong>${escapeHtml(item.name)}</strong></td>
            <td>${escapeHtml(item.category)}</td>
            <td style="color:var(--accent);font-weight:700;">$${parseFloat(item.price).toFixed(2)}</td>
            <td>${item.stock || 0}</td>
            <td>${badgeDisplay}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td class="actions">
              <button class="btn btn-sm btn-secondary" onclick="editItem('${doc.id}')" title="Edit"><i class="fas fa-pen"></i></button>
              <button class="btn btn-sm btn-danger" onclick="deleteItem('${doc.id}')" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
          </tr>`;
      });
    })
    .catch(err => {
      showToast('Error', 'Failed to load items: ' + err.message, 'error');
    });
}

function editItem(docId) {
  db.collection('shopItems').doc(docId).get()
    .then(doc => {
      if (!doc.exists) return showToast('Error', 'Item not found.', 'error');
      const item = doc.data();
      document.getElementById('editItemId').value = docId;
      document.getElementById('itemName').value = item.name || '';
      document.getElementById('itemCategory').value = item.category || '';
      document.getElementById('itemPrice').value = item.price || '';
      document.getElementById('itemOldPrice').value = item.oldPrice || '';
      document.getElementById('itemStock').value = item.stock || 0;
      document.getElementById('itemBadge').value = item.badge || '';
      document.getElementById('itemIcon').value = item.icon || 'fas fa-box-open';
      document.getElementById('itemDescription').value = item.description || '';
      document.getElementById('itemActive').checked = item.active !== false;
      document.getElementById('itemFormTitle').innerHTML = '<i class="fas fa-pen-to-square" style="color:var(--primary-light);margin-right:8px;"></i>Edit Item';
      document.getElementById('adminItemForm').classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function deleteItem(docId) {
  if (!confirm('Are you sure you want to delete this item? This cannot be undone.')) return;
  db.collection('shopItems').doc(docId).delete()
    .then(() => {
      showToast('Deleted', 'Item has been deleted.', 'success');
      loadAdminItems();
      loadDashboardStats();
    })
    .catch(err => showToast('Error', err.message, 'error'));
}

// ---- Orders ----
function loadAllOrders() {
  db.collection('orders').orderBy('createdAt', 'desc').get()
    .then(snapshot => {
      const body = document.getElementById('allOrdersBody');
      body.innerHTML = '';
      if (snapshot.empty) {
        body.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:40px;">No orders yet</td></tr>';
        return;
      }
      snapshot.forEach(doc => {
        const order = doc.data();
        const date = order.createdAt ? (order.createdAt.toDate ? order.createdAt.toDate().toLocaleDateString() : 'N/A') : 'N/A';
        const itemNames = (order.items || []).map(i => i.name).join(', ') || 'N/A';
        const statusClass = order.status === 'completed' ? 'active' : order.status === 'cancelled' ? 'inactive' : 'pending';
        body.innerHTML += `
          <tr>
            <td style="font-family:monospace;font-size:0.8rem;">#${doc.id.substring(0, 8)}</td>
            <td>${escapeHtml(order.userName || 'Guest')}</td>
            <td style="font-size:0.85rem;color:var(--text-muted);">${escapeHtml(order.userEmail || 'N/A')}</td>
            <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(itemNames)}</td>
            <td style="color:var(--accent);font-weight:700;">$${parseFloat(order.total || 0).toFixed(2)}</td>
            <td style="text-transform:capitalize;">${escapeHtml(order.gateway || 'N/A')}</td>
            <td><span class="status-badge ${statusClass}">${order.status || 'pending'}</span></td>
            <td style="font-size:0.85rem;color:var(--text-muted);">${date}</td>
            <td class="actions">
              ${order.status !== 'completed' ? `<button class="btn btn-sm btn-primary" onclick="updateOrderStatus('${doc.id}','completed')" title="Mark Completed"><i class="fas fa-check"></i></button>` : ''}
              ${order.status !== 'cancelled' ? `<button class="btn btn-sm btn-danger" onclick="updateOrderStatus('${doc.id}','cancelled')" title="Cancel"><i class="fas fa-xmark"></i></button>` : ''}
            </td>
          </tr>`;
      });
    })
    .catch(err => showToast('Error', err.message, 'error'));
}

function updateOrderStatus(orderId, status) {
  db.collection('orders').doc(orderId).update({ status: status })
    .then(() => {
      showToast('Updated', 'Order status changed to ' + status + '.', 'success');
      loadAllOrders();
      loadDashboardStats();
    })
    .catch(err => showToast('Error', err.message, 'error'));
}

// ---- Payment Gateway Config ----
function loadGatewayConfigs() {
  db.collection('config').doc('paymentGateways').get()
    .then(doc => {
      if (doc.exists) {
        const data = doc.data();
        // PayPal
        if (data.paypal) {
          document.getElementById('paypalClientId').value = data.paypal.clientId || '';
          document.getElementById('paypalSecret').value = data.paypal.secret || '';
          document.getElementById('paypalEnabled').checked = data.paypal.enabled || false;
          updateGatewayStatus('paypal', data.paypal.enabled && data.paypal.clientId);
        }
        // Stripe
        if (data.stripe) {
          document.getElementById('stripePublishableKey').value = data.stripe.publishableKey || '';
          document.getElementById('stripeSecretKey').value = data.stripe.secretKey || '';
          document.getElementById('stripeEnabled').checked = data.stripe.enabled || false;
          updateGatewayStatus('stripe', data.stripe.enabled && data.stripe.publishableKey);
        }
        // Paystack
        if (data.paystack) {
          document.getElementById('paystackPublicKey').value = data.paystack.publicKey || '';
          document.getElementById('paystackSecretKey').value = data.paystack.secretKey || '';
          document.getElementById('paystackEnabled').checked = data.paystack.enabled || false;
          updateGatewayStatus('paystack', data.paystack.enabled && data.paystack.publicKey);
        }
        // Coinbase
        if (data.coinbase) {
          document.getElementById('coinbaseApiKey').value = data.coinbase.apiKey || '';
          document.getElementById('coinbaseEnabled').checked = data.coinbase.enabled || false;
          updateGatewayStatus('coinbase', data.coinbase.enabled && data.coinbase.apiKey);
        }
      }
    })
    .catch(err => console.error('Error loading gateway config:', err));
}

function updateGatewayStatus(gateway, isActive) {
  const el = document.getElementById(gateway + 'Status');
  if (!el) return;
  if (isActive) {
    el.innerHTML = '<span class="dot on"></span> Active';
    el.style.color = 'var(--success)';
  } else {
    el.innerHTML = '<span class="dot off"></span> Inactive';
    el.style.color = 'var(--text-muted)';
  }
}

function saveGatewayConfig(gateway) {
  let config = {};

  switch (gateway) {
    case 'paypal':
      config = {
        clientId: document.getElementById('paypalClientId').value.trim(),
        secret: document.getElementById('paypalSecret').value.trim(),
        enabled: document.getElementById('paypalEnabled').checked
      };
      break;
    case 'stripe':
      config = {
        publishableKey: document.getElementById('stripePublishableKey').value.trim(),
        secretKey: document.getElementById('stripeSecretKey').value.trim(),
        enabled: document.getElementById('stripeEnabled').checked
      };
      break;
    case 'paystack':
      config = {
        publicKey: document.getElementById('paystackPublicKey').value.trim(),
        secretKey: document.getElementById('paystackSecretKey').value.trim(),
        enabled: document.getElementById('paystackEnabled').checked
      };
      break;
    case 'coinbase':
      config = {
        apiKey: document.getElementById('coinbaseApiKey').value.trim(),
        enabled: document.getElementById('coinbaseEnabled').checked
      };
      break;
  }

  // Use merge to not overwrite other gateway configs
  const updateObj = {};
  updateObj[gateway] = config;

  db.collection('config').doc('paymentGateways').set(updateObj, { merge: true })
    .then(() => {
      const hasKey = config.clientId || config.publishableKey || config.publicKey || config.apiKey;
      updateGatewayStatus(gateway, config.enabled && hasKey);
      showToast('Saved!', gateway.charAt(0).toUpperCase() + gateway.slice(1) + ' configuration saved.', 'success');
    })
    .catch(err => {
      showToast('Error', 'Failed to save: ' + err.message, 'error');
    });
}

// ---- Social Links Config ----
function loadSocialConfig() {
  db.collection('config').doc('socialLinks').get()
    .then(doc => {
      if (doc.exists) {
        const data = doc.data();
        document.getElementById('socialFacebook').value = data.facebook || '';
        document.getElementById('socialTwitter').value = data.twitter || '';
        document.getElementById('socialInstagram').value = data.instagram || '';
        document.getElementById('socialLinkedin').value = data.linkedin || '';
        document.getElementById('socialYoutube').value = data.youtube || '';
        document.getElementById('socialTiktok').value = data.tiktok || '';
        document.getElementById('socialWhatsapp').value = data.whatsapp || '';
        document.getElementById('socialTelegram').value = data.telegram || '';
      }
    })
    .catch(err => console.error('Error loading social config:', err));
}

function saveSocialLinks() {
  const links = {
    facebook: document.getElementById('socialFacebook').value.trim(),
    twitter: document.getElementById('socialTwitter').value.trim(),
    instagram: document.getElementById('socialInstagram').value.trim(),
    linkedin: document.getElementById('socialLinkedin').value.trim(),
    youtube: document.getElementById('socialYoutube').value.trim(),
    tiktok: document.getElementById('socialTiktok').value.trim(),
    whatsapp: document.getElementById('socialWhatsapp').value.trim(),
    telegram: document.getElementById('socialTelegram').value.trim()
  };

  db.collection('config').doc('socialLinks').set(links, { merge: true })
    .then(() => {
      showToast('Saved!', 'Social links have been updated on the website.', 'success');
    })
    .catch(err => {
      showToast('Error', 'Failed to save: ' + err.message, 'error');
    });
}

// ---- Users ----
function loadUsers() {
  db.collection('users').orderBy('createdAt', 'desc').get()
    .then(snapshot => {
      const body = document.getElementById('usersBody');
      body.innerHTML = '';
      if (snapshot.empty) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:40px;">No users found</td></tr>';
        return;
      }
      snapshot.forEach(doc => {
        const user = doc.data();
        const date = user.createdAt ? (user.createdAt.toDate ? user.createdAt.toDate().toLocaleDateString() : 'N/A') : 'N/A';
        const roleClass = user.role === 'admin' || user.role === 'superadmin' ? 'active' : 'inactive';
        const roleText = user.role || 'customer';
        body.innerHTML += `
          <tr>
            <td><strong>${escapeHtml(user.name || 'N/A')}</strong></td>
            <td style="font-size:0.85rem;color:var(--text-muted);">${escapeHtml(user.email || 'N/A')}</td>
            <td><span class="status-badge ${roleClass}">${roleText}</span></td>
            <td style="font-size:0.85rem;color:var(--text-muted);">${date}</td>
            <td class="actions">
              <button class="btn btn-sm ${user.role === 'admin' ? 'btn-danger' : 'btn-primary'}" onclick="toggleUserRole('${doc.id}', '${user.role || 'customer'}')" title="Toggle Role">
                <i class="fas fa-user-shield"></i> ${user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
              </button>
            </td>
          </tr>`;
      });
    })
    .catch(err => showToast('Error', err.message, 'error'));
}

function toggleUserRole(uid, currentRole) {
  const newRole = (currentRole === 'admin' || currentRole === 'superadmin') ? 'customer' : 'admin';
  db.collection('users').doc(uid).update({ role: newRole })
    .then(() => {
      showToast('Updated', 'User role changed to ' + newRole + '.', 'success');
      loadUsers();
    })
    .catch(err => showToast('Error', err.message, 'error'));
}

// ---- Messages ----
function loadMessages() {
  db.collection('messages').orderBy('createdAt', 'desc').get()
    .then(snapshot => {
      const body = document.getElementById('messagesBody');
      body.innerHTML = '';
      if (snapshot.empty) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:40px;">No messages yet</td></tr>';
        return;
      }
      snapshot.forEach(doc => {
        const msg = doc.data();
        const date = msg.createdAt ? (msg.createdAt.toDate ? msg.createdAt.toDate().toLocaleString() : 'N/A') : 'N/A';
        const unreadBadge = !msg.read ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--accent);margin-right:8px;"></span>' : '';
        body.innerHTML += `
          <tr>
            <td>${unreadBadge}${escapeHtml(msg.name || 'N/A')}</td>
            <td style="font-size:0.85rem;color:var(--text-muted);">${escapeHtml(msg.email || 'N/A')}</td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(msg.subject || 'N/A')}</td>
            <td style="font-size:0.85rem;color:var(--text-muted);">${date}</td>
            <td class="actions">
              <button class="btn btn-sm btn-secondary" onclick="viewMessage('${doc.id}')" title="View"><i class="fas fa-eye"></i></button>
              <button class="btn btn-sm btn-danger" onclick="deleteMessageById('${doc.id}')" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
          </tr>`;
      });
    })
    .catch(err => showToast('Error', err.message, 'error'));
}

function viewMessage(docId) {
  currentMessageId = docId;
  db.collection('messages').doc(docId).get()
    .then(doc => {
      if (!doc.exists) return showToast('Error', 'Message not found.', 'error');
      const msg = doc.data();
      const date = msg.createdAt ? (msg.createdAt.toDate ? msg.createdAt.toDate().toLocaleString() : 'N/A') : 'N/A';
      document.getElementById('msgFrom').textContent = msg.name || 'N/A';
      document.getElementById('msgEmail').textContent = msg.email || 'N/A';
      document.getElementById('msgSubject').textContent = msg.subject || 'N/A';
      document.getElementById('msgBody').textContent = msg.message || 'No content';
      document.getElementById('msgDate').textContent = date;
      document.getElementById('messageModal').classList.add('active');

      // Mark as read
      if (!msg.read) {
        db.collection('messages').doc(docId).update({ read: true }).catch(() => {});
        loadMessages();
      }
    })
    .catch(err => showToast('Error', err.message, 'error'));
}

function closeMessageModal() {
  document.getElementById('messageModal').classList.remove('active');
  currentMessageId = null;
}

function deleteMessage() {
  if (!currentMessageId) return;
  deleteMessageById(currentMessageId);
  closeMessageModal();
}

function deleteMessageById(docId) {
  if (!confirm('Delete this message?')) return;
  db.collection('messages').doc(docId).delete()
    .then(() => {
      showToast('Deleted', 'Message has been deleted.', 'success');
      loadMessages();
      loadDashboardStats();
    })
    .catch(err => showToast('Error', err.message, 'error'));
}

// ---- Toast (shared util) ----
function showToast(title, message, type) {
  type = type || 'info';
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const icons = {
    success: 'fas fa-check',
    error: 'fas fa-xmark',
    warning: 'fas fa-exclamation',
    info: 'fas fa-info'
  };
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.innerHTML = '<div class="toast-icon"><i class="' + (icons[type] || icons.info) + '"></i></div>' +
    '<div class="toast-content"><div class="toast-title">' + title + '</div>' +
    '<div class="toast-message">' + message + '</div></div>' +
    '<span class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-xmark"></i></span>';
  container.appendChild(toast);
  setTimeout(function () {
    toast.classList.add('removing');
    setTimeout(function () { toast.remove(); }, 400);
  }, 4000);
}

// ---- Utility ----
function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- Close modals on overlay click ----
document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) {
      overlay.classList.remove('active');
    }
  });
});

// ---- Keyboard: Escape to close ----
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(function (m) { m.classList.remove('active'); });
  }
});
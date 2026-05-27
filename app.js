(function() {
  'use strict';

  // Store the original showPage function
  const originalShowPage = window.showPage;

  // Override showPage to save the current page
  window.showPage = function(page) {
    // Call the original function
    if (originalShowPage) {
      originalShowPage.apply(this, arguments);
    }
    // Save to localStorage
    localStorage.setItem('currentPage', page);
  };

  // On page load, check for saved page
  document.addEventListener('DOMContentLoaded', function() {
    const savedPage = localStorage.getItem('currentPage');
    if (savedPage && savedPage !== 'menu') { // Don't override if it's the default
      // Wait a bit for the app to initialize
      setTimeout(() => {
        if (window.showPage) {
          window.showPage(savedPage);
          // Also update mobile nav if applicable
          if (window.setMobNav) {
            window.setMobNav(savedPage);
          }
        }
      }, 100);
    }
  });
})();
function getNum(v){return Number(String(v||'0').replace(/[^0-9.]/g,''))||0;}
function calculateFinalTotal(){
  const cartEl=document.getElementById('om-subtotal') || document.getElementById('cart-total') || document.querySelector('.cart-total');
  const deliveryEl=document.getElementById('delivery-fee') || document.getElementById('om-delivery-fee');
  const grandEl=document.getElementById('grand-total') || document.querySelector('[data-grand-total]');
  const cartAmount=getNum(cartEl ? cartEl.innerText : 0);
  const deliveryAmount=getNum(deliveryEl ? deliveryEl.innerText : (window.currentDeliveryFee||0));
  const finalTotal=cartAmount + deliveryAmount;

  if(grandEl){
    grandEl.innerText='₹'+finalTotal.toFixed(0);
  }

  window.finalGrandTotal=finalTotal;
  return finalTotal;
}

function patchUPIPayment(){
  const total=calculateFinalTotal();
  if(!total || total<=0) return;

  document.querySelectorAll('a[href*="upi://pay"]').forEach(function(link){
    try{
      let href=link.getAttribute('href') || '';
      if(href.includes('am=')){
        href=href.replace(/am=([0-9.]+)/,'am='+total);
      }else{
        href += (href.includes('?') ? '&':'?') + 'am='+total;
      }
      link.setAttribute('href',href);
    }catch(e){}
  });

  if(window.Razorpay){
    const originalOpen=window.Razorpay;
    window.Razorpay=function(options){
      try{
        options.amount=Math.round(total*100);
      }catch(e){}
      return new originalOpen(options);
    }
  }
}

setInterval(function(){
  calculateFinalTotal();
  patchUPIPayment();
},1000);

window.addEventListener('load',function(){
  calculateFinalTotal();
  patchUPIPayment();
});
})();
(function(){
  function getGrandTotal(){
    if (typeof window.getGrandTotal === 'function') {
      const g = window.getGrandTotal();
      if (g > 0) return g;
    }
    let el = document.getElementById('om-grand-total') || document.getElementById('grand-total') || document.getElementById('om-total') || document.querySelector('.grand-total') || document.querySelector('[data-grand-total]');
    if(!el) return 0;
    let amt = parseFloat((el.innerText || el.textContent || '0').replace(/[^\d.]/g,''));
    return isNaN(amt) ? 0 : amt;
  }

  function syncUPIAmounts(){
    const total = getGrandTotal();
    if(!total || total <= 0) return;

    // Update all UPI links/buttons
    document.querySelectorAll('a[href^="upi://pay"]').forEach(link=>{
      try{
        let href = link.getAttribute('href') || '';
        if(href.includes('&am=')){
          href = href.replace(/([&?]am=)(\d+(\.\d+)?)/, '$1' + total.toFixed(2));
        } else {
          href += '&am=' + total.toFixed(2);
        }
        link.setAttribute('href', href);
      }catch(e){}
    });

    // Razorpay global amount sync
    window.finalGrandTotal = total;

    // Hidden payment amount fields
    document.querySelectorAll('input[name="amount"], #payment-amount, .payment-amount').forEach(el=>{
      el.value = total.toFixed(2);
      el.setAttribute('value', total.toFixed(2));
    });

    console.log('UPI Grand Total Synced:', total);
  }

  // Auto sync whenever totals change
  setInterval(syncUPIAmounts, 500);

  // Override Razorpay open if available
  const oldRazorpay = window.Razorpay;
  if(oldRazorpay){
    window.Razorpay = function(options){
      try{
        const total = getGrandTotal();
        if(total > 0){
          options.amount = Math.round(total * 100);
        }
      }catch(e){}
      return new oldRazorpay(options);
    }
  }
})();
document.addEventListener("DOMContentLoaded", function(){
  const toggle = document.getElementById("newBusinessToggle");
  const status = document.getElementById("customerBusinessStatus");
  const badge = document.getElementById("business-status-badge");

  // Main sync function called dynamically
  window.updateBusinessUI = function() {
    const settings = window.getDeliverySettings ? window.getDeliverySettings() : {};
    const isOpen = window.isStoreOpen ? window.isStoreOpen(settings) : true;

    // 1. Sync admin toggle checked state
    if (toggle) {
      toggle.checked = settings.businessOpen !== false;
    }

    // 2. Sync admin text display if it exists on page-business-hours
    const adminStatusText = document.getElementById("status-text");
    const adminStatusDot = document.querySelector(".bh-status .status-dot");
    if (adminStatusText) {
      adminStatusText.innerText = (settings.businessOpen !== false) ? "Open" : "Closed";
    }
    if (adminStatusDot) {
      adminStatusDot.style.background = (settings.businessOpen !== false) ? "#2e7d32" : "#c62828";
    }

    // 3. Sync customer status badge
    if (status) {
      status.innerText = isOpen ? "OPEN NOW" : "CLOSED NOW";
    }
    if (badge) {
      badge.style.display = "inline-flex";
      if (isOpen) {
        badge.classList.remove("closed");
        badge.classList.add("open");
      } else {
        badge.classList.remove("open");
        badge.classList.add("closed");
      }
    }

    // 4. Disable / Enable action buttons
    document.querySelectorAll(".add-btn, .checkout-btn, .fob-btn").forEach(btn => {
      btn.disabled = !isOpen;
      btn.style.opacity = isOpen ? "1" : "0.5";
      btn.style.pointerEvents = isOpen ? "auto" : "none";
    });
  };

  // Handle Admin Toggle changes
  if (toggle) {
    toggle.addEventListener("change", function() {
      const isOpen = toggle.checked;

      // Sync to local storage
      const existing = window.getDeliverySettings ? window.getDeliverySettings() : {};
      const settings = {
        ...existing,
        businessOpen: isOpen,
        updatedAt: new Date().toISOString()
      };
      if (window.DELIVERY_SETTINGS_KEY) {
        localStorage.setItem(window.DELIVERY_SETTINGS_KEY, JSON.stringify(settings));
      }
      localStorage.setItem("perfect_business_status", isOpen ? "true" : "false");
      localStorage.setItem("business_open_status_v2", isOpen ? "true" : "false");

      // Sync UI locally
      window.updateBusinessUI();
      if (typeof window.updateBusinessHoursStatus === 'function') {
        window.updateBusinessHoursStatus();
      }

      // Save to Firestore in real-time (Write to BOTH primary and fallback documents for instant multi-listener trigger)
      const firestore = (typeof db !== 'undefined' && db) ? db : (typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null);
      if (firestore) {
        const batch = firestore.batch ? firestore.batch() : null;
        if (batch) {
          const docRef1 = firestore.collection('app_settings').doc('delivery_settings');
          const docRef2 = firestore.collection('settings').doc('delivery');
          batch.set(docRef1, { businessOpen: isOpen, updatedAt: settings.updatedAt, savedBy: window.currentUser?.email || 'admin-toggle' }, { merge: true });
          batch.set(docRef2, { businessOpen: isOpen, updatedAt: settings.updatedAt }, { merge: true });
          batch.commit()
            .then(() => console.log('[DeliverySettings] ✓ Store status saved to both Firestore locations'))
            .catch(err => {
              console.error('[DeliverySettings] Firestore batch toggle error:', err);
              docRef1.set({ businessOpen: isOpen, updatedAt: settings.updatedAt }, { merge: true }).catch(()=>{});
              docRef2.set({ businessOpen: isOpen, updatedAt: settings.updatedAt }, { merge: true }).catch(()=>{});
            });
        } else {
          firestore.collection('app_settings').doc('delivery_settings').set({ businessOpen: isOpen, updatedAt: settings.updatedAt }, { merge: true }).catch(()=>{});
          firestore.collection('settings').doc('delivery').set({ businessOpen: isOpen, updatedAt: settings.updatedAt }, { merge: true }).catch(()=>{});
        }
      }
    });
  }

  // Dedicated, super-robust Firestore real-time listener for instant sync on all pages
  function startSyncListeners(dbInstance) {
    console.log('[RealtimeSync] Starting dedicated listeners for status badge...');
    
    // 1. Listen to app_settings/delivery_settings
    dbInstance.collection('app_settings').doc('delivery_settings').onSnapshot(snap => {
      if (snap.exists) {
        const data = snap.data();
        if (data.businessOpen !== undefined) {
          console.log('[RealtimeSync] app_settings/delivery_settings changed:', data.businessOpen);
          syncToLocal(data.businessOpen, data);
        }
      }
    }, err => {
      console.warn('[RealtimeSync] Primary listener error:', err);
    });

    // 2. Listen to settings/delivery
    dbInstance.collection('settings').doc('delivery').onSnapshot(snap => {
      if (snap.exists) {
        const data = snap.data();
        if (data.businessOpen !== undefined) {
          console.log('[RealtimeSync] settings/delivery changed:', data.businessOpen);
          syncToLocal(data.businessOpen, data);
        }
      }
    }, err => {
      console.warn('[RealtimeSync] Fallback listener error:', err);
    });
  }

  function syncToLocal(isOpen, data) {
    const existing = window.getDeliverySettings ? window.getDeliverySettings() : {};
    const settings = {
      ...existing,
      businessOpen: isOpen,
      updatedAt: data.updatedAt || new Date().toISOString()
    };
    if (window.DELIVERY_SETTINGS_KEY) {
      localStorage.setItem(window.DELIVERY_SETTINGS_KEY, JSON.stringify(settings));
    }
    localStorage.setItem("perfect_business_status", isOpen ? "true" : "false");
    localStorage.setItem("business_open_status_v2", isOpen ? "true" : "false");

    window.updateBusinessUI();
    if (typeof window.updateBusinessHoursStatus === 'function') {
      window.updateBusinessHoursStatus();
    }
  }

  // Wait for Firestore db to be ready and initialize listeners
  var checkTimer = setInterval(function() {
    const activeDb = (typeof db !== 'undefined' && db) ? db : (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && firebase.firestore ? firebase.firestore() : null);
    if (activeDb) {
      clearInterval(checkTimer);
      startSyncListeners(activeDb);
    }
  }, 400);

  // Listen to local storage updates across tabs
  window.addEventListener("storage", function(e) {
    if (e.key === "perfect_business_status" || e.key === "delivery_settings_v3" || e.key === "business_open_status_v2") {
      window.updateBusinessUI();
    }
  });

  // Fallback interval to ensure dynamically generated products are styled correctly
  setInterval(window.updateBusinessUI, 500);

  // Initial run
  window.updateBusinessUI();
});
(function(){
  const ADMIN_WHATSAPP_NUMBER = '919154092906';
  const CALLMEBOT_API_KEY = 'REPLACE_WITH_CALLMEBOT_API_KEY';
  const processedOrders = new Set(JSON.parse(sessionStorage.getItem('processedOrders') || '[]'));
  let adminOrderListenerAttached = false;

  function isStoreOpenSafe(){
    try{
      if(typeof window.storeOpen !== 'undefined') return !!window.storeOpen;
      const local = localStorage.getItem('storeOpen');
      return local !== 'false';
    }catch(e){ return true; }
  }

  window.playNotificationSound = function(){
    try{
      const audio = new Audio('notification.mp3');
      audio.volume = 1;
      audio.play().catch(()=>{
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 1);
        osc.stop(ctx.currentTime + 1);
      });
    }catch(err){console.log(err)}
  };

  window.showBrowserNotification = function(order){
    try{
      const body = `Order: ${order.orderId || order.id || 'N/A'}
Customer: ${order.customerName || order.name || 'Customer'}
Grand Total: ₹${order.grandTotal || order.total || 0}
Payment: ${order.paymentMethod || 'N/A'}`;
      const showNow = () => {
        new Notification('🛒 New Order Received', { body, icon: './favicon.jpg' });
      };
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          showNow();
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(p => { if (p === 'granted') showNow(); });
        }
      }
    } catch(err){ console.log(err); }
  };

  window.sendWhatsAppNotification = async function(order){
    try{
      if(!CALLMEBOT_API_KEY || CALLMEBOT_API_KEY === 'REPLACE_WITH_CALLMEBOT_API_KEY'){
        console.warn('Add CallMeBot API key to enable WhatsApp notifications');
        return;
      }
      const items = (order.items || []).map(i => `- ${i.name || i.title} x${i.qty || i.quantity || 1}`).join('%0A');
      const msg = `🛒 New Order Received%0A%0AOrder ID: #${order.orderId || order.id || 'N/A'}%0ACustomer: ${order.customerName || order.name || ''}%0APhone: ${order.phone || ''}%0A%0AItems:%0A${items}%0A%0AGrand Total: ₹${order.grandTotal || order.total || 0}%0APayment: ${order.paymentMethod || 'N/A'}%0A%0AAddress:%0A${order.address || order.deliveryAddress || ''}%0A%0APlease check admin panel.`;
      const url = `https://api.callmebot.com/whatsapp.php?phone=${ADMIN_WHATSAPP_NUMBER}&text=${msg}&apikey=${CALLMEBOT_API_KEY}`;
      await fetch(url, {mode:'no-cors'});
    }catch(err){ console.log('WhatsApp notification failed', err); }
  };

  window.notifyNewOrder = async function(order){
    try{
      if(!isStoreOpenSafe()) return;
      const orderKey = order.orderId || order.id;
      if(!orderKey || processedOrders.has(orderKey)) return;
      processedOrders.add(orderKey);
      sessionStorage.setItem('processedOrders', JSON.stringify(Array.from(processedOrders).slice(-100)));

      playNotificationSound();
      showBrowserNotification(order);
      sendWhatsAppNotification(order);

      const popup = document.getElementById('admin-order-popup');
      if(popup){
        popup.style.display = 'block';
        const title = popup.querySelector('.popup-title');
        if(title) title.textContent = `🛒 New Order #${orderKey}`;
        setTimeout(()=>{ popup.style.display = 'none'; }, 15000);
      }

      if(typeof showToast === 'function'){
        showToast(`🛒 New Order Received - ₹${order.grandTotal || order.total || 0}`, 6000, 'info');
      }
    }catch(err){ console.log(err); }
  };

  async function attachAdminOrderNotifications(){
    try{
      if(adminOrderListenerAttached) return;
      const firestore = (typeof db !== 'undefined' && db) ? db : (typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null);
      if(!firestore) return;

      // Only attach if current user role is admin
      if(typeof currentRole === 'undefined' || currentRole !== 'admin') {
        setTimeout(attachAdminOrderNotifications, 2000);
        return;
      }
      adminOrderListenerAttached = true;

      firestore.collection('orders').orderBy('createdAt','desc').limit(20)
      .onSnapshot((snapshot)=>{
        snapshot.docChanges().forEach((change)=>{
          if(change.type === 'added'){
            const order = {id: change.doc.id, ...change.doc.data()};
            const createdAt = order.createdAt && order.createdAt.toDate ? order.createdAt.toDate().getTime() : Date.now();
            if(Date.now() - createdAt < 120000){
              notifyNewOrder(order);
            }
          }
        });
      }, (error) => {
        console.log('Realtime admin notification snap error', error);
      });
    }catch(err){ console.log('Realtime admin notification error', err); }
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    if('Notification' in window && Notification.permission !== 'granted'){
      Notification.requestPermission().catch(()=>{});
    }
    setTimeout(attachAdminOrderNotifications, 4000);
  });
})();
function toggleSidebar() {
    if (typeof toggleUserMenu === 'function') {
        toggleUserMenu();
    } else {
        document.getElementById('user-menu-popup')?.classList.toggle('open');
    }
}
  document.addEventListener('contextmenu', event => event.preventDefault());
  document.addEventListener('keydown', event => {

      if (event.keyCode == 123) { // F12
          event.preventDefault();
          return false;
      }
      if (event.ctrlKey && event.shiftKey && (event.key === 'I' || event.key === 'i')) { // Ctrl+Shift+I
          event.preventDefault();
          return false;
      }
      if (event.ctrlKey && event.shiftKey && (event.key === 'J' || event.key === 'j')) { // Ctrl+Shift+J
          event.preventDefault();
          return false;
      }
      if (event.ctrlKey && (event.key === 'U' || event.key === 'u')) { // Ctrl+U
          event.preventDefault();
          return false;
      }
  });
(function patchSupportTickets() {
  'use strict';

  /* ── helpers ── */
  const $ = id => document.getElementById(id);
  const ticketsList  = () => $('support-tickets-list');
  const formSection  = () => $('support-form-section');
  const newBtn       = () => $('support-new-btn');
  const cancelBtn    = () => $('support-cancel-btn');

  /* ── show ticket list, hide form ── */
  function showTicketList() {
    const tl = ticketsList(), fs = formSection();
    if (tl) { tl.style.display = 'grid'; }
    if (fs) { fs.style.display = 'none'; }
    if (newBtn())   newBtn().style.display   = 'inline-flex';
    if (cancelBtn()) cancelBtn().style.display = 'none';
  }

  /* ── show form (for new ticket) ── */
  function showTicketForm() {
    const tl = ticketsList(), fs = formSection();
    if (tl && tl.innerHTML.trim() !== '' && !tl.innerHTML.includes('Loading')) {
      if (tl) tl.style.display = 'grid';   // keep list visible above form
    }
    if (fs) { fs.style.display = 'grid'; }
    if (cancelBtn()) cancelBtn().style.display = 'inline-flex';
    if (newBtn())    newBtn().style.display    = 'none';
  }

  /* ── render a single ticket card ── */
  function renderTicketCard(docSnap) {
    const d   = docSnap.data ? docSnap.data() : docSnap;
    const id  = docSnap.id || d.id || '';
    const ts  = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleString('en-IN', {dateStyle:'medium',timeStyle:'short'}) : '';
    const statusColor = { open:'#00b04e', resolved:'#2e7d32', pending:'#1565c0' };
    const col = statusColor[d.status] || '#888';
    const ticketReply = d.reply || d.adminReply || '';
    const adminReply = ticketReply
      ? `<div style="margin-top:8px;background:#f0fff4;border:1px solid #b2dfdb;border-radius:8px;padding:8px 11px;font-size:.8rem"><strong style="color:#2e7d32">💬 Admin Reply:</strong> ${ticketReply}</div>`
      : '';
    return `
      <div style="background:#fff;border:1.5px solid var(--border);border-radius:14px;padding:14px 16px;box-shadow:var(--shadow)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
          <div>
            <div style="font-weight:800;color:var(--brown);font-size:.92rem">${d.type || 'Issue'}</div>
            <div style="font-size:.75rem;color:#888;margin-top:2px">${ts}${d.orderId ? ' · Order: '+d.orderId : ''}</div>
          </div>
          <span style="background:${col}18;color:${col};border:1.5px solid ${col};border-radius:12px;padding:3px 10px;font-size:.7rem;font-weight:800;text-transform:uppercase">${(d.status||'open').toUpperCase()}</span>
        </div>
        <div style="margin-top:8px;font-size:.85rem;color:#444;line-height:1.5">${d.desc || d.description || ''}</div>
        ${adminReply}
      </div>`;
  }

  /* ── load tickets from Firestore for current user ── */
  async function loadTickets() {
    const tl = ticketsList();
    if (!tl) return;

    // Wait for db + auth to be ready (Firebase loads deferred)
    if (typeof db === 'undefined' || !db) {
      tl.innerHTML = '<div class="empty-cat-msg"><div class="big">⏳</div>Loading...</div>';
      tl.style.display = 'grid';
      setTimeout(loadTickets, 1200);
      return;
    }

    const user = typeof currentUser !== 'undefined' ? currentUser : null;
    if (!user || !user.uid) {
      // Not signed in — just show the form
      if (formSection()) formSection().style.display = 'grid';
      tl.style.display = 'none';
      if (newBtn()) newBtn().style.display = 'none';
      return;
    }

    // Signed in — show the "Create Ticket" button
    if (newBtn()) newBtn().style.display = 'inline-flex';

    tl.innerHTML = '<div class="empty-cat-msg"><div class="big">⏳</div>Loading your tickets...</div>';
    tl.style.display = 'grid';

    try {
      const snap = await db.collection('support')
        .where('customerUid', '==', user.uid)
        .orderBy('createdAt', 'desc')
        .get();

      if (snap.empty) {
        // No tickets — show the form directly
        tl.style.display = 'none';
        if (formSection()) formSection().style.display = 'grid';
        if (newBtn()) newBtn().style.display = 'none';
      } else {
        let html = '';
        snap.forEach(doc => { html += renderTicketCard(doc); });
        tl.innerHTML = html;
        showTicketList();
      }
    } catch (err) {
      console.warn('[SupportPatch] Ticket load error:', err && (err.code || err.message));
      // Firestore rules may be blocking — show form as fallback
      tl.style.display = 'none';
      if (formSection()) formSection().style.display = 'grid';
      if (newBtn()) newBtn().style.display = 'none';
      // Helpful console hint for the developer
      if (err && err.code === 'permission-denied') {
        console.warn(
          '%c[SupportPatch] Firestore permission denied for support.\n' +
          'Add these rules in Firebase Console → Firestore → Rules:\n\n' +
          'match /support/{id} {\n' +
          '  allow read, write: if request.auth != null\n' +
          '    && request.auth.uid == resource.data.customerUid;\n' +
          '  allow create: if request.auth != null;\n' +
          '}',
          'color:#00b04e;font-weight:bold'
        );
      }
    }
  }

  const PAGE_STORAGE_KEY = 'activePage';

  function saveActivePage(page) {
    try {
      if (!page) return;
      localStorage.setItem(PAGE_STORAGE_KEY, page);
    } catch (_error) {
      // Ignore storage errors in private mode or restricted browsers
    }
  }

  function restoreLastActivePage() {
    try {
      const saved = localStorage.getItem(PAGE_STORAGE_KEY);
      if (!saved) return;
      if (typeof window.showPage !== 'function') {
        setTimeout(restoreLastActivePage, 300);
        return;
      }
      const validPages = ['menu', 'tracking', 'support', 'dashboard', 'orders', 'payments', 'customers', 'manage', 'admin-support', 'business-hours'];
      if (validPages.includes(saved)) {
        window.showPage(saved);
      }
    } catch (_error) {
      // Ignore restore errors
    }
  }

  /* ── patch showPage to trigger ticket loading and persist page state ── */
  function hookShowPage() {
    const original = window.showPage;
    if (typeof original !== 'function') {
      // showPage not yet defined — retry
      setTimeout(hookShowPage, 400);
      return;
    }
    window.showPage = function(page, ...rest) {
      original.call(this, page, ...rest);
      saveActivePage(page);
      if (page === 'support') {
        // Small delay so the page element is visible first
        setTimeout(loadTickets, 80);
      }
    };
  }

  /* ── patch openSupportForm so it shows the ticket form ── */
  function hookOpenSupportForm() {
    const origOpen  = window.openSupportForm;
    const origClose = window.closeSupportForm;

    window.openSupportForm = function(...args) {
      if (typeof origOpen === 'function') origOpen.apply(this, args);
      showTicketForm();
    };

    window.closeSupportForm = function(...args) {
      if (typeof origClose === 'function') origClose.apply(this, args);
      // After closing form, reload tickets so the list shows
      setTimeout(loadTickets, 100);
    };
  }

  /* ── patch submitSupportTicket to reload list after submit ── */
  function hookSubmitTicket() {
    window.submitSupportTicket = async function(...args) {
      console.log('[TicketSubmit] 📝 Support ticket submission initiated');
      try {
        const result = await submitSupportTicketInternal(...args);
        console.log('[TicketSubmit] ✅ Submission completed successfully');
        // Reload after a short delay to let Firestore write settle
        setTimeout(() => { loadTickets(); }, 800);
        return result;
      } catch (err) {
        // Only show a toast for unexpected errors (validation already shows its own)
        const msg = err && (err.message || err.code || String(err));
        console.error('[TicketSubmit] ❌ Error:', msg, err);
        const knownErrors = ['Missing support description','Missing order ID','Firestore not ready',
          'Not a valid order ID','Order does not belong to current customer',
          'Active support ticket already exists for this order'];
        if (!knownErrors.includes(msg)) {
          showToast('⚠️ Could not submit ticket. Please try again.', 4000);
        }
      }
    };
  }

  async function submitSupportTicketInternal() {
    // Safe access to currentUser (may be defined in obfuscated global scope)
    const _cu = (typeof currentUser !== 'undefined') ? currentUser : null;

    const type    = document.getElementById('support-type')?.value || 'Other';
    const desc    = (document.getElementById('support-desc')?.value || '').trim();
    const orderId = (document.getElementById('support-order-id')?.value || '').trim();

    if (!desc) {
      showToast('⚠️ Please describe your issue');
      throw new Error('Missing support description');
    }
    if (!orderId) {
      showToast('⚠️ Please enter your Order ID (e.g. CE-XXXXXX)');
      throw new Error('Missing order ID');
    }

    // Wait for Firestore (db comes from obfuscated code)
    if (typeof db === 'undefined' || !db) {
      showToast('⚠️ Not connected. Please refresh the page and try again.', 4000);
      throw new Error('Firestore not ready');
    }

    // Gather customer identity
    let customerEmail = _cu ? (_cu.email || '') : '';
    let customerUid   = _cu ? (_cu.uid   || null) : null;
    if (!customerEmail) {
      try {
        const lastOrder = JSON.parse(localStorage.getItem('lastOrder') || 'null');
        if (lastOrder && lastOrder.email) customerEmail = lastOrder.email;
      } catch (_e) {}
    }

    // Validate order exists in Firestore
    let orderDoc = null;
    try {
      const orderSnap = await db.collection('orders').where('orderId', '==', orderId).get();
      if (!orderSnap || orderSnap.empty || !orderSnap.docs.length) {
        showToast('⚠️ Order ID not found. Please check and try again.');
        throw new Error('Not a valid order ID');
      }
      orderDoc = orderSnap.docs[0].data();
    } catch (err) {
      if (err.message === 'Not a valid order ID') throw err;
      // Firestore query itself failed (rules / network) — still allow submit
      console.warn('[TicketSubmit] Order lookup failed (Firestore rules?):', err.code || err.message);
    }

    // Only verify ownership when we got the order doc
    if (orderDoc) {
      const orderEmail = (orderDoc.customerEmail || '').toLowerCase();
      const orderUid   = orderDoc.customerUid || null;
      const matches = _cu
        ? (orderUid === _cu.uid || orderEmail === (_cu.email || '').toLowerCase())
        : (customerEmail && orderEmail && orderEmail === customerEmail.toLowerCase());
      if (!matches) {
        showToast('⚠️ This Order ID does not belong to your account.');
        throw new Error('Order does not belong to current customer');
      }
    }

    // Check for duplicate open ticket
    try {
      const supportSnap = await db.collection('support').where('orderId', '==', orderId).get();
      const hasOpen = supportSnap && supportSnap.docs.some(d => {
        return (d.data().status || '').toLowerCase() !== 'resolved';
      });
      if (hasOpen) {
        showToast('⚠️ A ticket for this order is already open. Please wait for a response.');
        throw new Error('Active support ticket already exists for this order');
      }
    } catch (err) {
      if (err.message === 'Active support ticket already exists for this order') throw err;
      // Duplicate check failed — proceed anyway
      console.warn('[TicketSubmit] Duplicate check failed:', err.code || err.message);
    }

    // Build server timestamp with safe fallback
    const _ts = () => (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
      ? firebase.firestore.FieldValue.serverTimestamp()
      : new Date();

    // Write ticket to Firestore
    const ticketData = {
      type,
      desc,
      orderId,
      customerEmail,
      customerUid,
      createdAt: _ts(),
      status: 'open'
    };
    const supportDoc = await db.collection('support').add(ticketData);

    // Write admin notification (best-effort)
    try {
      await db.collection('admin_notifications').add({
        title: 'New Support Ticket',
        message: `Support ticket for order ${orderId} has been submitted.`,
        ticketId: supportDoc.id,
        orderId,
        customerEmail,
        customerUid,
        type: 'support',
        createdAt: _ts(),
        read: false
      });
    } catch (notifErr) {
      console.warn('[TicketSubmit] Admin notification failed:', notifErr.code || notifErr.message);
    }

    // Success feedback
    showToast('✅ Ticket submitted! We\'ll get back to you soon.', 4000);

    // Clear form
    const descEl    = document.getElementById('support-desc');
    const orderEl   = document.getElementById('support-order-id');
    if (descEl)  descEl.value  = '';
    if (orderEl) orderEl.value = '';

    // Switch to ticket list view
    if (typeof window.closeSupportForm === 'function') window.closeSupportForm();
    showTicketList();

    return supportDoc;
  }

  function filterAdminSupportTickets() {
    const query = document.getElementById('admin-support-search')?.value.trim().toLowerCase() || '';
    const list = document.getElementById('admin-support-list');
    if (!list) return;
    Array.from(list.children).forEach(card => {
      const text = (card.innerText || '').toLowerCase();
      card.style.display = !query || text.includes(query) ? '' : 'none';
    });
  }

  const DELIVERY_SETTINGS_KEY = 'deliverySettings';
  const DEFAULT_DELIVERY_SETTINGS = {
    feeEnabled: false,
    feeAmount: 0,
    freeAbove: 200,
    freeOffer: false,
    highDemandEnabled: false,
    highDemandAmount: 0,
    highDemandMessage: 'Delivery partner demand is high due to heavy rain or hot weather. Extra fee applies.',
    businessHoursEnabled: false,
    openHour: 6,
    closeHour: 20,
    outOfServiceMessage: 'Orders are only accepted during business hours. Please try again later.',
    businessOpen: true,
    updatedAt: ''
  };
  
  var _deliverySettingsListener = null; // Real-time listener unsubscriber

  function getDeliverySettings() {
    try {
      const saved = localStorage.getItem(DELIVERY_SETTINGS_KEY);
      if (!saved) return { ...DEFAULT_DELIVERY_SETTINGS };
      const parsed = JSON.parse(saved);
      // Only merge with defaults for missing properties, don't override with defaults
      return {
        feeEnabled: parsed.feeEnabled !== undefined ? parsed.feeEnabled : DEFAULT_DELIVERY_SETTINGS.feeEnabled,
        feeAmount: parsed.feeAmount !== undefined ? parsed.feeAmount : DEFAULT_DELIVERY_SETTINGS.feeAmount,
        freeAbove: parsed.freeAbove !== undefined ? parsed.freeAbove : DEFAULT_DELIVERY_SETTINGS.freeAbove,
        freeOffer: parsed.freeOffer !== undefined ? parsed.freeOffer : DEFAULT_DELIVERY_SETTINGS.freeOffer,
        highDemandEnabled: parsed.highDemandEnabled !== undefined ? parsed.highDemandEnabled : DEFAULT_DELIVERY_SETTINGS.highDemandEnabled,
        highDemandAmount: parsed.highDemandAmount !== undefined ? parsed.highDemandAmount : DEFAULT_DELIVERY_SETTINGS.highDemandAmount,
        highDemandMessage: parsed.highDemandMessage || DEFAULT_DELIVERY_SETTINGS.highDemandMessage,
        businessHoursEnabled: parsed.businessHoursEnabled !== undefined ? (parsed.businessHoursEnabled === true || parsed.businessHoursEnabled === 'true') : DEFAULT_DELIVERY_SETTINGS.businessHoursEnabled,
        openHour: parsed.openHour !== undefined ? parsed.openHour : DEFAULT_DELIVERY_SETTINGS.openHour,
        closeHour: parsed.closeHour !== undefined ? parsed.closeHour : DEFAULT_DELIVERY_SETTINGS.closeHour,
        outOfServiceMessage: parsed.outOfServiceMessage || DEFAULT_DELIVERY_SETTINGS.outOfServiceMessage,
        businessOpen: parsed.businessOpen !== undefined ? (parsed.businessOpen === true || parsed.businessOpen === 'true') : DEFAULT_DELIVERY_SETTINGS.businessOpen,
        updatedAt: parsed.updatedAt || ''
      };
    } catch (_err) {
      console.warn('[DeliverySettings] Failed to parse localStorage:', _err);
      return { ...DEFAULT_DELIVERY_SETTINGS };
    }
  }

  function saveDeliverySettings() {
    // ── Business Hours branch ──────────────────────────────────────────────
    // When called from the Business Hours page the delivery-fee fields don't
    // exist.  Detect that and save only the business-hours settings.
    const bhEnabledEl    = document.getElementById('svc-business-hours-enabled');
    const businessOpenEl = document.getElementById('svc-business-open');
    const openHourEl     = document.getElementById('svc-open-hour');
    const closeHourEl    = document.getElementById('svc-close-hour');
    const outMsgEl       = document.getElementById('svc-outofservice-msg');

    if (bhEnabledEl && openHourEl && closeHourEl) {
      // ── We're on the Business Hours page ──────────────────────────────
      if (typeof currentRole !== 'undefined' && currentRole !== 'admin') {
        showToast('⚠️ Only admin can change these settings', 3000);
        return;
      }
      if (!currentUser) {
        showToast('⚠️ Please sign in as admin first', 3000);
        return;
      }

      const bhEnabled     = !!bhEnabledEl.checked;
      const businessOpen  = businessOpenEl ? !!businessOpenEl.checked : (existing.businessOpen !== undefined ? existing.businessOpen : true);
      const openHour      = Math.min(23, Math.max(0, parseInt(openHourEl.value, 10) || 6));
      const closeHour     = Math.min(23, Math.max(0, parseInt(closeHourEl.value, 10) || 20));
      const outOfSvcMsg   = outMsgEl ? outMsgEl.value.trim() : '';

      // Merge into existing localStorage settings (don't wipe fee settings)
      const existing = getDeliverySettings();
      const merged = {
        ...existing,
        businessHoursEnabled: bhEnabled,
        businessOpen,
        openHour,
        closeHour,
        outOfServiceMessage: outOfSvcMsg || existing.outOfServiceMessage,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(DELIVERY_SETTINGS_KEY, JSON.stringify(merged));
      console.log('[DeliverySettings] Business hours saved to localStorage:', merged);
      if (typeof updateBusinessUI === 'function') updateBusinessUI();
      if (typeof updateBusinessHoursStatus === 'function') updateBusinessHoursStatus();

      // Persist to Firestore
      const firestore = (typeof db !== 'undefined' && db) ? db
        : (typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null);
      if (firestore) {
        const payload = {
          businessHoursEnabled: bhEnabled,
          businessOpen,
          openHour,
          closeHour,
          outOfServiceMessage: merged.outOfServiceMessage,
          updatedAt: new Date().toISOString(),
          savedBy: currentUser?.email || 'unknown'
        };
        firestore.collection('app_settings').doc('delivery_settings')
          .set(payload, { merge: true })
          .then(() => console.log('[DeliverySettings] ✓ Business hours saved to app_settings'))
          .catch(err => console.error('[DeliverySettings] Business hours Firestore error:', err.code || err.message));
      }

      showToast('✅ Business hours saved!', 2500);
      return;
    }

    // ── Delivery-fee branch (original path) ───────────────────────────────
    const feeEnabledEl = document.getElementById('svc-fee-enabled');
    const feeAmountEl  = document.getElementById('svc-fee-amount');

    if (!feeEnabledEl || !feeAmountEl) {
      console.warn('[DeliverySettings] Required form elements not found');
      showToast('⚠️ Form elements not found', 2000);
      return;
    }

    const feeEnabled = !!feeEnabledEl.checked;
    const feeAmountRaw = (feeAmountEl.value || '').trim();
    const feeAmount = Math.max(0, parseInt(feeAmountRaw, 10) || 0);

    const settings = {
      feeEnabled,
      feeAmount,
      updatedAt: new Date().toISOString()
    };

    // Validate delivery fee amount before persisting
    if (feeEnabled && feeAmount <= 0) {
      console.warn('[DeliverySettings] Invalid fee amount when fee is enabled');
      showToast('⚠️ Please enter a valid delivery fee amount (must be ≥ 0)', 2500);
      feeAmountEl.focus();
      return;
    }

    // Admin permission check
    if (typeof currentRole !== 'undefined' && currentRole !== 'admin') {
      console.warn('[DeliverySettings] Non-admin tried to save settings');
      showToast('⚠️ Only admin can change these settings', 3000);
      return;
    }
    if (!currentUser) {
      console.warn('[DeliverySettings] Unauthenticated user tried to save');
      showToast('⚠️ Please sign in as admin first', 3000);
      return;
    }

    // Save local state immediately so UI persistence remains stable even if Firestore save is blocked.
    localStorage.setItem(DELIVERY_SETTINGS_KEY, JSON.stringify(settings));
    console.log('[DeliverySettings] Saved to localStorage:', settings);
    
    // Apply fee immediately to delivery fee system
    if (feeEnabled && feeAmount > 0) {
      console.log('[DeliverySettings] Applying fee immediately:', feeAmount);
      window.currentDeliveryFee = feeAmount;
      if (typeof applyFee === 'function') {
        applyFee(feeAmount);
      }
      if (typeof updateCartTotal === 'function') {
        updateCartTotal();
      }
    } else {
      console.log('[DeliverySettings] Fee not enabled, clearing delivery fee');
      window.currentDeliveryFee = 0;
      if (typeof applyFee === 'function') {
        applyFee(0);
      }
      if (typeof updateCartTotal === 'function') {
        updateCartTotal();
      }
    }
    
    // Update UI immediately
    if (typeof dsUpdateUI === 'function') {
      dsUpdateUI();
    }

    // Save to Firestore with robust error handling and fallbacks
    const firestore = (typeof db !== 'undefined' && db) ? db : (typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null);
    if (firestore) {
      const settingsWithAdmin = {
        ...settings,
        savedBy: currentUser?.email || 'unknown',
        updatedAt: new Date().toISOString()
      };

      const checkoutSettings = {
        fee: feeAmount,
        enabled: feeEnabled,
        businessOpen: settings.businessOpen !== undefined ? settings.businessOpen : DEFAULT_DELIVERY_SETTINGS.businessOpen,
        updatedAt: new Date().toISOString(),
        savedBy: currentUser?.email || 'unknown'
      };

      let successCount = 0;
      let errors = [];

      firestore.collection('app_settings').doc('delivery_settings')
        .set(settingsWithAdmin, { merge: true })
        .then(() => {
          successCount++;
          console.log('[DeliverySettings] ✓ Saved to app_settings/delivery_settings');
        })
        .catch(err => {
          console.error('[DeliverySettings] app_settings save failed:', err.code, err.message);
          errors.push('app_settings: ' + (err.code || err.message));
          if (err.code === 'permission-denied') {
            console.log('[DeliverySettings] Retrying with reduced data for app_settings...');
            firestore.collection('app_settings').doc('delivery_settings')
              .set({ feeEnabled, feeAmount, updatedAt: new Date().toISOString() }, { merge: true })
              .then(() => {
                successCount++;
                console.log('[DeliverySettings] ✓ Saved to app_settings (reduced)');
              })
              .catch(err2 => console.error('[DeliverySettings] Retry failed:', err2.code));
          }
        });

      firestore.collection('settings').doc('delivery')
        .set(checkoutSettings, { merge: true })
        .then(() => {
          successCount++;
          console.log('[DeliverySettings] ✓ Saved to settings/delivery');
        })
        .catch(err => {
          console.error('[DeliverySettings] settings/delivery save failed:', err.code, err.message);
          errors.push('settings/delivery: ' + (err.code || err.message));
          if (err.code === 'permission-denied') {
            console.log('[DeliverySettings] Retrying with reduced data for settings/delivery...');
            firestore.collection('settings').doc('delivery')
              .set({ fee: feeAmount, enabled: feeEnabled, updatedAt: new Date().toISOString() }, { merge: true })
              .then(() => {
                successCount++;
                console.log('[DeliverySettings] ✓ Saved to settings/delivery (reduced)');
              })
              .catch(err2 => console.error('[DeliverySettings] Retry failed:', err2.code));
          }
        });

      setTimeout(() => {
        console.log('[DeliverySettings] Save complete - success count:', successCount, 'errors:', errors);

        if (successCount >= 1) {
          console.log('[DeliverySettings] Saved successfully to Firestore');
          showToast('✅ Delivery fee settings saved & synced!', 2500);
          if (typeof renderDeliverySettings === 'function') {
            setTimeout(() => renderDeliverySettings(), 500);
          }
        } else if (errors.length > 0) {
          console.warn('[DeliverySettings] All Firestore saves failed:', errors);
          showToast('⚠️ Saved locally (Firestore access limited). Check Firestore rules.', 3500);
          console.log('[DeliverySettings] TROUBLESHOOTING: You may need to add these Firestore security rules:', {
            'app_settings': 'allow write if request.auth.token.admin == true;',
            'settings': 'allow write if request.auth.token.admin == true;'
          });
        }
      }, 1500);
    } else {
      console.log('[DeliverySettings] Firestore not ready');
      showToast('⚠️ Settings saved locally. Firestore will sync when ready.', 3000);
    }
  }
  
  function setBusinessOpenStatus(isOpen) {
    if (typeof currentRole !== 'undefined' && currentRole !== 'admin') {
      showToast('⚠️ Only admin can change store status', 3000);
      return;
    }
    if (!currentUser) {
      showToast('⚠️ Please sign in as admin first', 3000);
      return;
    }

    const existing = getDeliverySettings();
    const settings = {
      ...existing,
      businessOpen: !!isOpen,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(DELIVERY_SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem('business_open_status_v2', settings.businessOpen ? 'true' : 'false');
    if (typeof setManualClosedStatus === 'function') {
      setManualClosedStatus(!isOpen);
    }
    if (typeof updateBusinessUI === 'function') updateBusinessUI();
    if (typeof updateBusinessHoursStatus === 'function') updateBusinessHoursStatus();

    const firestore = (typeof db !== 'undefined' && db) ? db : (typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null);
    if (firestore) {
      firestore.collection('app_settings').doc('delivery_settings')
        .set({ businessOpen: settings.businessOpen, updatedAt: settings.updatedAt, savedBy: currentUser?.email || 'unknown' }, { merge: true })
        .then(() => console.log('[DeliverySettings] ✓ Business open status saved'))
        .catch(err => console.error('[DeliverySettings] Business open status Firestore error:', err.code || err.message));
    }
  }

  // Expose saveDeliverySettings to global scope for HTML onclick handlers
  window.saveDeliverySettings = saveDeliverySettings;
  window.setBusinessOpenStatus = setBusinessOpenStatus;
  window.DELIVERY_SETTINGS_KEY = DELIVERY_SETTINGS_KEY;
  window.getDeliverySettings = getDeliverySettings;
  window.isStoreOpen = isStoreOpen;
  window.DEFAULT_DELIVERY_SETTINGS = DEFAULT_DELIVERY_SETTINGS;
  window.renderDeliverySettings = renderDeliverySettings;

  async function renderDeliverySettings() {
    console.log('[DeliverySettings] renderDeliverySettings called');
    
    // Unsubscribe from previous listener if it exists
    if (_deliverySettingsListener && typeof _deliverySettingsListener === 'function') {
      console.log('[DeliverySettings] Unsubscribing from previous listener');
      _deliverySettingsListener();
      _deliverySettingsListener = null;
    }

    // Check if Firestore is available
    if (typeof db === 'undefined' || !db) {
      console.log('[DeliverySettings] Firestore not available, using localStorage only');
      loadDeliverySettingsToUI(getDeliverySettings());
      return;
    }

    try {
      // First, load the primary source (app_settings/delivery_settings)
      const docSnap = await db.collection('app_settings').doc('delivery_settings').get();
      
      if (docSnap.exists) {
        const firestoreData = docSnap.data();
        console.log('[DeliverySettings] Loaded from Firestore (primary):', firestoreData);
        
        // Update localStorage with Firestore data (fee + business hours)
        const settings = {
          ...getDeliverySettings(), // Keep any properties not stored in Firestore
          feeEnabled: firestoreData.feeEnabled !== undefined ? firestoreData.feeEnabled : false,
          feeAmount: firestoreData.feeAmount !== undefined ? firestoreData.feeAmount : 0,
          businessHoursEnabled: firestoreData.businessHoursEnabled !== undefined ? firestoreData.businessHoursEnabled : false,
          businessOpen: firestoreData.businessOpen !== undefined ? firestoreData.businessOpen : DEFAULT_DELIVERY_SETTINGS.businessOpen,
          openHour: firestoreData.openHour !== undefined ? firestoreData.openHour : 6,
          closeHour: firestoreData.closeHour !== undefined ? firestoreData.closeHour : 20,
          outOfServiceMessage: firestoreData.outOfServiceMessage || DEFAULT_DELIVERY_SETTINGS.outOfServiceMessage,
          updatedAt: firestoreData.updatedAt || new Date().toISOString()
        };
        
        localStorage.setItem(DELIVERY_SETTINGS_KEY, JSON.stringify(settings));
        console.log('[DeliverySettings] Updated localStorage with Firestore data');
        loadDeliverySettingsToUI(settings);
        if (typeof updateBusinessUI === 'function') updateBusinessUI();
      } else {
        // Try fallback collection (settings/delivery)
        console.log('[DeliverySettings] Primary doc not found, trying fallback...');
        try {
          const fallbackSnap = await db.collection('settings').doc('delivery').get();
          if (fallbackSnap.exists) {
            const fallbackData = fallbackSnap.data();
            console.log('[DeliverySettings] Loaded from Firestore (fallback):', fallbackData);
            
            const settings = {
              ...getDeliverySettings(),
              feeEnabled: fallbackData.enabled === true,
              feeAmount: Number(fallbackData.fee) || 0,
              businessOpen: fallbackData.businessOpen !== undefined ? fallbackData.businessOpen : DEFAULT_DELIVERY_SETTINGS.businessOpen,
              updatedAt: fallbackData.updatedAt || new Date().toISOString()
            };
            
            localStorage.setItem(DELIVERY_SETTINGS_KEY, JSON.stringify(settings));
            console.log('[DeliverySettings] Updated localStorage with fallback data');
            loadDeliverySettingsToUI(settings);
            if (typeof updateBusinessUI === 'function') updateBusinessUI();
          } else {
            // Use localStorage as last resort
            console.log('[DeliverySettings] No Firestore data found, using localStorage');
            loadDeliverySettingsToUI(getDeliverySettings());
          }
        } catch (err) {
          console.warn('[DeliverySettings] Fallback load failed:', err);
          loadDeliverySettingsToUI(getDeliverySettings());
        }
      }
      
      // Set up real-time listener for future updates
      setupDeliverySettingsListener();
      
    } catch (err) {
      console.error('[DeliverySettings] Failed to load from Firestore:', err);
      console.log('[DeliverySettings] Falling back to localStorage');
      loadDeliverySettingsToUI(getDeliverySettings());
    }
  }
  
  function loadDeliverySettingsToUI(settings) {
    console.log('[DeliverySettings] Updating UI with settings:', settings);

    // ── Delivery-fee fields ────────────────────────────────────────────────
    const feeEnabledEl = document.getElementById('svc-fee-enabled');
    const feeAmountEl  = document.getElementById('svc-fee-amount');

    if (feeEnabledEl) {
      feeEnabledEl.checked = !!settings.feeEnabled;
      console.log('[DeliverySettings] Set fee enabled toggle to:', feeEnabledEl.checked);
    }
    if (feeAmountEl) {
      feeAmountEl.value = settings.feeAmount || 0;
      console.log('[DeliverySettings] Set fee amount to:', feeAmountEl.value);
    }

    // ── Business Hours fields ──────────────────────────────────────────────
    const bhEnabledEl = document.getElementById('svc-business-hours-enabled');
    const openHourEl  = document.getElementById('svc-open-hour');
    const closeHourEl = document.getElementById('svc-close-hour');
    const outMsgEl    = document.getElementById('svc-outofservice-msg');

    if (bhEnabledEl) {
      bhEnabledEl.checked = settings.businessHoursEnabled !== undefined
        ? !!settings.businessHoursEnabled
        : false; // default: disabled
      console.log('[DeliverySettings] Set business hours enabled to:', bhEnabledEl.checked);
    }
    if (openHourEl) {
      openHourEl.value = (settings.openHour !== undefined && settings.openHour !== null)
        ? settings.openHour : 6;
      console.log('[DeliverySettings] Set open hour to:', openHourEl.value);
    }
    if (closeHourEl) {
      closeHourEl.value = (settings.closeHour !== undefined && settings.closeHour !== null)
        ? settings.closeHour : 20;
      console.log('[DeliverySettings] Set close hour to:', closeHourEl.value);
    }
    if (outMsgEl) {
      outMsgEl.value = settings.outOfServiceMessage || '';
      console.log('[DeliverySettings] Set out-of-service message');
    }
    const businessOpenEl = document.getElementById('svc-business-open');
    if (businessOpenEl) {
      businessOpenEl.checked = settings.businessOpen !== undefined
        ? !!settings.businessOpen
        : DEFAULT_DELIVERY_SETTINGS.businessOpen;
      console.log('[DeliverySettings] Set business open status to:', businessOpenEl.checked);
    }

    // Apply fee to the delivery fee system
    if (settings.feeEnabled && settings.feeAmount > 0) {
      console.log('[DeliverySettings] Applying fee:', settings.feeAmount);
      if (typeof applyFee === 'function') {
        applyFee(settings.feeAmount);
      }
      window.currentDeliveryFee = settings.feeAmount;
      if (typeof updateCartTotal === 'function') {
        updateCartTotal();
      }
    }

    // Update UI components
    if (typeof dsUpdateUI === 'function') {
      dsUpdateUI();
    }
    if (typeof updateBusinessUI === 'function') {
      updateBusinessUI();
    }
  }
  
  function setupDeliverySettingsListener() {
    if (typeof db === 'undefined' || !db) {
      console.log('[DeliverySettings] Firestore not available for listener');
      return;
    }
    
    console.log('[DeliverySettings] Setting up real-time listener');
    
    try {
      // Listen to primary collection
      _deliverySettingsListener = db.collection('app_settings').doc('delivery_settings').onSnapshot(
        (docSnap) => {
          if (docSnap.exists) {
            const firestoreData = docSnap.data();
            console.log('[DeliverySettings] Real-time update from Firestore:', firestoreData);
            
            // Update localStorage (fee + business hours)
            const settings = {
              ...getDeliverySettings(),
              feeEnabled: firestoreData.feeEnabled !== undefined ? firestoreData.feeEnabled : false,
              feeAmount: firestoreData.feeAmount !== undefined ? firestoreData.feeAmount : 0,
              businessHoursEnabled: firestoreData.businessHoursEnabled !== undefined ? firestoreData.businessHoursEnabled : false,
              businessOpen: firestoreData.businessOpen !== undefined ? firestoreData.businessOpen : DEFAULT_DELIVERY_SETTINGS.businessOpen,
              openHour: firestoreData.openHour !== undefined ? firestoreData.openHour : 6,
              closeHour: firestoreData.closeHour !== undefined ? firestoreData.closeHour : 20,
              outOfServiceMessage: firestoreData.outOfServiceMessage || DEFAULT_DELIVERY_SETTINGS.outOfServiceMessage,
              updatedAt: firestoreData.updatedAt || new Date().toISOString()
            };
            
            localStorage.setItem(DELIVERY_SETTINGS_KEY, JSON.stringify(settings));
            console.log('[DeliverySettings] Real-time: Updated UI');
            loadDeliverySettingsToUI(settings);
            if (typeof updateBusinessUI === 'function') updateBusinessUI();
          }
        },
        (err) => {
          console.error('[DeliverySettings] Real-time listener error:', err);
        }
      );
    } catch (err) {
      console.error('[DeliverySettings] Failed to setup listener:', err);
    }
  }

  function updateDeliveryFeeUI() {
    const feeEnabled = !!document.getElementById('svc-fee-enabled')?.checked;
    const feeFields = document.getElementById('svc-fee-fields');
    const statusLabel = document.getElementById('svc-fee-status-label');

    if (feeFields) feeFields.style.display = feeEnabled ? '' : 'none';

    // Status badge
    if (statusLabel) {
      if (feeEnabled) {
        statusLabel.textContent = '💰 Delivery Fee ON';
        statusLabel.style.color = '#1e7a3a';
      } else {
        statusLabel.textContent = '💰 Delivery Fee OFF';
        statusLabel.style.color = '#888';
      }
    }
  }
  // Expose globally so inline onchange can reach it
  window.updateDeliveryFeeUI = updateDeliveryFeeUI;

  function calcDeliveryFee(subtotal = 0) {

    if (!_dsSettings.enabled) return 0;

    if (
      _dsSettings.freeAbove > 0 &&
      subtotal >= _dsSettings.freeAbove
    ) {
      return 0;
    }

    return Number(_dsSettings.fee) || 0;
  }

  function updateCartDeliveryFee() {

    const totalEl = document.getElementById('om-total');

    const subtotal =
      totalEl
        ? parseInt(totalEl.textContent.replace(/[^\d]/g,'')) || 0
        : 0;

    const fee = calcDeliveryFee(subtotal);

    const grand = subtotal + fee;

    const feeEl = document.getElementById('om-delivery-fee-display');

    const grandEl = document.getElementById('om-grand-total');

    if (feeEl) {

      if (fee === 0) {

        feeEl.textContent = '🎁 Free';

      } else {

        feeEl.textContent = '₹' + fee;

      }
    }

    if (grandEl) {
      grandEl.textContent = '₹' + grand;
    }
  }

  function updateDeliveryInfoDisplay() {
    updateCartDeliveryFee();
  }

  function isWithinBusinessHours(settings) {
    if (!settings?.businessHoursEnabled) return true;
    const now = new Date();
    const currentHour = now.getHours();
    const openHour = Number(settings.openHour ?? 0);
    const closeHour = Number(settings.closeHour ?? 24);
    if (openHour === closeHour) return true;
    if (openHour < closeHour) {
      return currentHour >= openHour && currentHour < closeHour;
    }
    return currentHour >= openHour || currentHour < closeHour;
  }

  function isStoreOpen(settings) {
    if (settings?.businessOpen === false || settings?.businessOpen === 'false') return false;
    return isWithinBusinessHours(settings);
  }

  function getBusinessHoursText(settings) {
    const formatHour = h => String(h).padStart(2, '0') + ':00';
    const openHour = Number(settings.openHour ?? 0);
    const closeHour = Number(settings.closeHour ?? 24);
    return `${formatHour(openHour)} - ${formatHour(closeHour)}`;
  }

  function updateBusinessHoursStatus() {
    let statusIndicator = document.getElementById('business-hours-status');

    if (!statusIndicator) {
      statusIndicator = document.createElement('div');
      statusIndicator.id = 'business-hours-status';
      statusIndicator.style.cssText = 'padding:10px;margin:10px 0;border-radius:6px;text-align:center;font-weight:bold;font-size:0.9rem;display:none;';
      const header = document.querySelector('header');
      if (header) header.appendChild(statusIndicator);
    }

    // Always hidden by default — only reveal after Firestore confirms
    const applySettings = (settings) => {
      const businessOpen = settings.businessOpen !== undefined ? settings.businessOpen : DEFAULT_DELIVERY_SETTINGS.businessOpen;
      const hoursText = getBusinessHoursText(settings);
      if (!businessOpen) {
        statusIndicator.style.display = '';
        statusIndicator.style.background = '#ffcdd2';
        statusIndicator.style.color = '#c62828';
        statusIndicator.innerHTML = `🔴 Store is CLOSED${settings.businessHoursEnabled ? ` (Opens at ${hoursText})` : ''}`;
        return;
      }
      if (!settings.businessHoursEnabled) {
        statusIndicator.style.display = 'none';
        return;
      }
      const isOpen = isWithinBusinessHours(settings);
      if (isOpen) {
        statusIndicator.style.display = '';
        statusIndicator.style.background = '#c8e6c9';
        statusIndicator.style.color = '#1e7a3a';
        statusIndicator.innerHTML = `✅ Store is OPEN (${hoursText})`;
      } else {
        statusIndicator.style.display = '';
        statusIndicator.style.background = '#ffcdd2';
        statusIndicator.style.color = '#c62828';
        statusIndicator.innerHTML = `🔴 Store is CLOSED (Opens at ${hoursText})`;
      }
    };

    // Fetch fresh Firestore data first — prevents stale localStorage flash
    if (typeof db !== 'undefined' && db) {
      db.collection('app_settings').doc('delivery_settings').get()
        .then(docSnap => {
          if (docSnap.exists) {
            const fresh = { ...DEFAULT_DELIVERY_SETTINGS, ...docSnap.data() };
            localStorage.setItem(DELIVERY_SETTINGS_KEY, JSON.stringify(fresh));
            applySettings(fresh);
          } else {
            applySettings(getDeliverySettings());
          }
        })
        .catch(() => applySettings(getDeliverySettings()));
    } else {
      // Firestore not ready yet — use localStorage but keep hidden if not enabled
      applySettings(getDeliverySettings());
    }
  }

  function hookOpenOrderModal() {
    const original = window.openOrderModal;
    if (typeof original !== 'function') {
      setTimeout(hookOpenOrderModal, 400);
      return;
    }

    window.openOrderModal = function(...args) {
      // Fetch fresh delivery settings from Firestore before opening modal
      const showModal = () => {
        const settings = getDeliverySettings();
        if (!isStoreOpen(settings)) {
          showToast('⚠️ Store is currently closed.', 5000);
          return;
        }
        original.apply(this, args);
        // Fire multiple times to ensure we override obfuscated code's delivery fee
        [150, 450, 900, 1600, 2800].forEach(ms =>
          setTimeout(updateDeliveryInfoDisplay, ms)
        );
      };
      // Fetch fresh settings from Firestore first
      if (typeof db !== 'undefined' && db) {
        db.collection('app_settings').doc('delivery_settings').get()
          .then(docSnap => {
            if (docSnap.exists) {
              const fresh = { ...DEFAULT_DELIVERY_SETTINGS, ...docSnap.data() };
              localStorage.setItem(DELIVERY_SETTINGS_KEY, JSON.stringify(fresh));
            }
          })
          .catch(() => {})
          .finally(() => showModal());
      } else {
        showModal();
      }
    };
  }

  function hookUpdateCartForDelivery() {
    const original = window.updateCart;
    if (typeof original !== 'function') {
      setTimeout(hookUpdateCartForDelivery, 400);
      return;
    }

    window.updateCart = function(...args) {
      original.apply(this, args);
      updateDeliveryInfoDisplay();
    };
  }

  /* ── bootstrap: run after DOM + Firebase ready ── */
  function bootstrap() {
    hookShowPage();
    restoreLastActivePage();
    hookOpenSupportForm();
    hookSubmitTicket();
    renderDeliverySettings();
    hookOpenOrderModal();
    hookUpdateCartForDelivery();

    // Real-time Firestore listener: instantly push delivery setting changes to all clients
    const waitForDb = setInterval(() => {
      if (typeof db !== 'undefined' && db) {
        clearInterval(waitForDb);
        // onSnapshot for instant updates
        db.collection('app_settings').doc('delivery_settings').onSnapshot(docSnap => {
          if (docSnap.exists) {
            const fresh = { ...DEFAULT_DELIVERY_SETTINGS, ...docSnap.data() };
            localStorage.setItem(DELIVERY_SETTINGS_KEY, JSON.stringify(fresh));
            // Overwrite with multiple retries in case obfuscated code re-renders after us
            [0, 300, 700, 1400].forEach(ms =>
              setTimeout(updateDeliveryInfoDisplay, ms)
            );
            // Update admin panel UI if admin is viewing settings
            if (typeof renderDeliverySettings === 'function') {
              renderDeliverySettings().catch(err => console.warn('Failed to render delivery settings:', err));
            }
            // Update business hours status display
            if (typeof updateBusinessHoursStatus === 'function') {
              updateBusinessHoursStatus();
            }
            if (typeof updateBusinessUI === 'function') {
              updateBusinessUI();
            }
          }
        }, err => console.warn('Delivery settings listener error:', err));
        // Fallback polling every 20s
        setInterval(() => {
          db.collection('app_settings').doc('delivery_settings').get()
            .then(docSnap => {
              if (docSnap.exists) {
                const fresh = { ...DEFAULT_DELIVERY_SETTINGS, ...docSnap.data() };
                localStorage.setItem(DELIVERY_SETTINGS_KEY, JSON.stringify(fresh));
              }
            }).catch(() => {});
        }, 20000);
      }
    }, 500);

    // MutationObserver: whenever obfuscated code updates om-total, recalculate our fees
    const omTotalEl = document.getElementById('om-total');
    if (omTotalEl && typeof MutationObserver !== 'undefined') {
      new MutationObserver(() => {
        setTimeout(updateDeliveryInfoDisplay, 50);
      }).observe(omTotalEl, { childList: true, subtree: true, characterData: true });
    }

    // Re-fetch from Firestore when customer returns to the tab
    window.addEventListener('focus', () => {
      if (typeof db !== 'undefined' && db) {
        db.collection('app_settings').doc('delivery_settings').get()
          .then(docSnap => {
            if (docSnap.exists) {
              const fresh = { ...DEFAULT_DELIVERY_SETTINGS, ...docSnap.data() };
              localStorage.setItem(DELIVERY_SETTINGS_KEY, JSON.stringify(fresh));
              updateDeliveryInfoDisplay();
            }
          }).catch(() => {});
      }
    });

    // Update business hours status every minute (as time passes, status may change)
    setInterval(() => {
      if (typeof updateBusinessHoursStatus === 'function') {
        updateBusinessHoursStatus();
      }
    }, 60000);

    // Watch for page changes and load settings for admin pages
    const adminPages = ['page-business-hours', 'page-delivery-settings'];
    adminPages.forEach(pageId => {
      const page = document.getElementById(pageId);
      if (page && typeof MutationObserver !== 'undefined') {
        new MutationObserver(() => {
          if (page.style.display !== 'none' && page.offsetParent !== null) {
            // Page is visible, load current settings
            if (typeof renderDeliverySettings === 'function') {
              renderDeliverySettings();
            }
          }
        }).observe(page, { attributes: true, attributeFilter: ['style'] });
      }
    });

    // Initial update
    setTimeout(() => {
      if (typeof updateBusinessHoursStatus === 'function') {
        updateBusinessHoursStatus();
      }
    }, 1000);

    // If page loads directly on the support tab, trigger loading
    const activePage = document.querySelector('.page.active');
    if (activePage && activePage.id === 'page-support') {
      setTimeout(loadTickets, 500);
    }

    // Also trigger when auth state is known (covers the refresh case)
    const authCheckInterval = setInterval(() => {
      if (typeof auth !== 'undefined' && auth) {
        clearInterval(authCheckInterval);
        auth.onAuthStateChanged(() => {
          const ap = document.querySelector('.page.active');
          if (ap && ap.id === 'page-support') {
            setTimeout(loadTickets, 300);
          }
        });
      }
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    // DOMContentLoaded already fired
    setTimeout(bootstrap, 50);
  }
})();
(function patchRazorpayUPI() {
  'use strict';

  var RZP_KEY = 'rzp_live_SmqNRvEpkEJ49k';

  /* ── QR fallback: shows static QR modal ── */
  function showQRModal(amount) {
    var amtEl = document.getElementById('upi-amount-display');
    if (amtEl) amtEl.textContent = '\u20B9' + amount;
    var overlay = document.getElementById('upi-redirect-overlay');
    if (overlay) overlay.classList.add('open');
    window._pendingUPIAmount = amount;
  }

  /* ── Save payment + finalize order ── */
  function onPaymentSuccess(paymentId, amount, name, phone, email) {
    if (typeof showToast === 'function') {
      showToast('\u2705 Payment successful! Placing your order...', 2500);
    }

    if (typeof db !== 'undefined' && db) {
      var uid = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.uid : null;
      var userEmail = email || (typeof currentUser !== 'undefined' && currentUser ? currentUser.email : null);

      db.collection('razorpay_payments').add({
        razorpayPaymentId: paymentId,
        amount: amount,
        customerName: name || '',
        customerPhone: phone || '',
        customerEmail: userEmail,
        customerUid: uid,
        status: 'captured',
        paidAt: firebase.firestore.FieldValue.serverTimestamp(),
        source: 'razorpay_checkout'
      }).catch(function() {});

      db.collection('admin_notifications').add({
        type: 'payment_received',
        paymentId: paymentId,
        amount: amount,
        customerName: name || '',
        customerPhone: phone || '',
        customerEmail: userEmail,
        customerUid: uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        read: false
      }).catch(function() {});
    }

    setTimeout(function() {
      if (typeof finalizeOrder === 'function') {
        finalizeOrder('upi', true, paymentId);
      }
    }, 600);
  }

  /* ── Main: override openRazorpayCheckout with LIVE Razorpay popup ── */
  function patchRazorpayCheckout() {
    window.openRazorpayCheckout = function(amount, name, phone) {
      /* Read customer info from order modal fields */
      var nameEl  = document.getElementById('om-name');
      var phoneEl = document.getElementById('om-phone');
      var emailEl = document.getElementById('om-email');
      name  = name  || (nameEl  ? nameEl.value.trim()  : '');
      phone = phone || (phoneEl ? phoneEl.value.trim() : '');
      var email = emailEl ? emailEl.value.trim().toLowerCase() : '';

      /* Fallback to QR if Razorpay SDK not loaded */
      if (typeof Razorpay === 'undefined') {
        console.warn('[RazorpayUPI] SDK not loaded, falling back to QR modal');
        showQRModal(amount);
        return;
      }

      var options = {
        key:         RZP_KEY,
        amount:      Math.round(amount * 100),   /* paise */
        currency:    'INR',
        name:        'Grocery For You Sircilla',
        description: 'Grocery Order Payment',
        prefill: {
          name:    name,
          contact: phone,
          email:   email
        },
        notes: { city: 'Sircilla, Telangana' },
        theme: { color: '#00b04e' },
        modal: {
          ondismiss: function() {
            if (typeof showToast === 'function') {
              showToast('\u274C Payment cancelled. Try again or use QR code.', 2500);
            }
          }
        },
        handler: function(response) {
          onPaymentSuccess(
            response.razorpay_payment_id || ('RZP-' + Date.now()),
            amount, name, phone, email
          );
        }
      };

      try {
        var rzp = new Razorpay(options);
        rzp.on('payment.failed', function(resp) {
          var msg = (resp.error && resp.error.description) ? resp.error.description : 'Payment failed';
          if (typeof showToast === 'function') {
            showToast('\u274C ' + msg + '. Try again.', 3000);
          }
          /* Offer QR as fallback */
          setTimeout(function() { showQRModal(amount); }, 1500);
        });
        rzp.open();
      } catch (e) {
        console.error('[RazorpayUPI] Checkout error:', e);
        showQRModal(amount);
      }
    };
    console.log('[RazorpayUPI] \u2705 openRazorpayCheckout \u2192 Live Razorpay popup active');
  }

  /* ── confirmUPIPaid: for QR fallback "I've Paid" button ── */
  function patchConfirmUPIPaid() {
    window.confirmUPIPaid = function() {
      var overlay = document.getElementById('upi-redirect-overlay');
      if (overlay) overlay.classList.remove('open');
      var amount = window._pendingUPIAmount || 0;
      onPaymentSuccess('UPI-QR-' + Date.now(), amount, '', '', '');
    };
  }

  /* ── showUPIRedirect: keep amount in sync ── */
  function patchShowUPIRedirect() {
    var orig = window.showUPIRedirect;
    window.showUPIRedirect = function(amount) {
      window._pendingUPIAmount = amount;
      if (orig) orig.apply(this, arguments);
    };
  }

  function tryPatch() {
    patchRazorpayCheckout();
    patchConfirmUPIPaid();
    patchShowUPIRedirect();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      [0, 300, 800, 1500, 3000].forEach(function(ms) { setTimeout(tryPatch, ms); });
    });
  } else {
    [0, 300, 800, 1500, 3000].forEach(function(ms) { setTimeout(tryPatch, ms); });
  }

  console.log('[RazorpayUPI] \ud83d\ude80 Live Razorpay checkout loaded \u2014 Key: rzp_live_SmqN...');
})();
(function() {
  'use strict';

  /* ── 1. Offline / Online detection ── */
  function updateOnlineStatus() {
    var banner = document.getElementById('offline-banner');
    if (!banner) return;
    if (!navigator.onLine) {
      banner.classList.add('visible');
    } else {
      banner.classList.remove('visible');
    }
  }
  window.addEventListener('online',  updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  /* ── 2. Mobile Admin Sidebar Toggle ── */
  window.toggleMobileAdminSidebar = function() {
    var sidebar  = document.querySelector('.admin-sidebar');
    var overlay  = document.getElementById('admin-sidebar-overlay');
    if (!sidebar) return;
    var open = sidebar.classList.contains('visible');
    if (open) {
      sidebar.classList.remove('visible');
      if (overlay) overlay.classList.remove('visible');
      document.body.style.overflow = '';
    } else {
      sidebar.classList.add('visible');
      if (overlay) overlay.classList.add('visible');
      document.body.style.overflow = 'hidden';
    }
  };
  window.closeMobileAdminSidebar = function() {
    var sidebar = document.querySelector('.admin-sidebar');
    var overlay = document.getElementById('admin-sidebar-overlay');
    if (sidebar) sidebar.classList.remove('visible');
    if (overlay) overlay.classList.remove('visible');
    document.body.style.overflow = '';
  };

  /* ── 3. Double-click prevention guard ── */
  window.mobileOneClick = function(btn, fn, resetMs) {
    if (!btn || btn.dataset.loading === 'true') return;
    btn.dataset.loading = 'true';
    var origText = btn.innerHTML;
    btn.innerHTML = '<span style="display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:spinPTR .7s linear infinite;vertical-align:middle"></span>';
    var reset = function() {
      btn.dataset.loading = 'false';
      btn.innerHTML = origText;
    };
    var timeout = setTimeout(reset, resetMs || 10000);
    try {
      var result = fn(function() { clearTimeout(timeout); reset(); });
      if (result && typeof result.then === 'function') {
        result.then(function() { clearTimeout(timeout); reset(); })
               .catch(function() { clearTimeout(timeout); reset(); });
      }
    } catch(e) {
      clearTimeout(timeout);
      reset();
    }
  };

  /* ── 4. Pull-to-Refresh visual indicator ── */
  (function initPTR() {
    var indicator = document.getElementById('ptr-indicator');
    if (!indicator) return;

    var startY = 0, pulling = false;
    var threshold = 240;
    var minVisible = 120;
    var isMobile = window.matchMedia('(max-width:768px)').matches;
    if (!isMobile) return;

    document.addEventListener('touchstart', function(e) {
      if (window.scrollY === 0 && e.touches[0].clientY < 30) {
        startY = e.touches[0].clientY;
        pulling = true;
      }
    }, { passive: true });

    document.addEventListener('touchmove', function(e) {
      if (!pulling) return;
      var dy = e.touches[0].clientY - startY;
      if (window.scrollY > 0 || dy < 0) {
        pulling = false;
        indicator.classList.remove('ptr-visible');
        return;
      }
      if (dy > minVisible) {
        indicator.classList.add('ptr-visible');
        if (dy > threshold) {
          indicator.querySelector('.ptr-arrow').textContent = '⟲';
        } else {
          indicator.querySelector('.ptr-arrow').textContent = '↓';
        }
      } else {
        indicator.classList.remove('ptr-visible');
        indicator.querySelector('.ptr-arrow').textContent = '↓';
      }
    }, { passive: true });

    document.addEventListener('touchend', function(e) {
      if (!pulling) return;
      pulling = false;
      var dy = e.changedTouches[0].clientY - startY;
      if (dy > threshold && window.scrollY === 0) {
        indicator.classList.add('ptr-refreshing');
        indicator.querySelector('.ptr-arrow').textContent = '';
        setTimeout(function() {
          indicator.classList.remove('ptr-visible');
          indicator.classList.remove('ptr-refreshing');
          indicator.querySelector('.ptr-arrow').textContent = '↓';
        }, 1200);
      } else {
        indicator.classList.remove('ptr-visible');
        indicator.querySelector('.ptr-arrow').textContent = '↓';
      }
    }, { passive: true });
  })();

  /* ── 5. Body scroll lock when cart/modal open ── */
  var _scrollPos = 0;
  window.lockBodyScroll = function() {
    _scrollPos = window.scrollY;
    document.body.classList.add('modal-open');
    document.body.style.top = '-' + _scrollPos + 'px';
  };
  window.unlockBodyScroll = function() {
    document.body.classList.remove('modal-open');
    document.body.style.top = '';
    window.scrollTo(0, _scrollPos);
  };

  /* ── 6. Input font-size fix — already handled in CSS (16px) ── */
  /* ── 7. Prevent double-tap zoom on buttons ── */
  document.addEventListener('dblclick', function(e) {
    if (e.target.closest('button,a,.menu-card,.cart-item')) {
      e.preventDefault();
    }
  }, { passive: false });

  /* ── 8. Close admin sidebar when an admin menu item is clicked ── */
  document.addEventListener('click', function(e) {
    var item = e.target.closest('.admin-sb-item');
    if (item && window.innerWidth <= 768) {
      window.closeMobileAdminSidebar();
    }
  });

})();
(function () {
'use strict';

if (window.__GFY_TOTAL_FIX_APPLIED__) return;
window.__GFY_TOTAL_FIX_APPLIED__ = true;

function safeNumber(value) {
    const num = Number(String(value || 0).replace(/[^\d.]/g, ''));
    return isNaN(num) ? 0 : num;
}

function getCartItems() {
    try {
        if (Array.isArray(window.cart)) {
            return window.cart;
        }

        if (window.cart && typeof window.cart === 'object') {
            return Object.values(window.cart);
        }

        const stored =
            localStorage.getItem('cart') ||
            localStorage.getItem('gfy_cart') ||
            '[]';

        const parsed = JSON.parse(stored);

        if (Array.isArray(parsed)) {
            return parsed;
        }

        if (parsed && typeof parsed === 'object') {
            return Object.values(parsed);
        }
    } catch (e) {}

    return [];
}

function calculateTotals() {
    let subtotal = 0;

    const items = getCartItems();

    items.forEach(function(item) {
        const price = safeNumber(item.price);
        const quantity = safeNumber(item.quantity || item.qty || 1);

        subtotal += price * quantity;
    });

    subtotal = Number(subtotal.toFixed(2));

    // Get current delivery fee dynamically from configuration/state/storage
    let deliveryFee = 30; // default fallback
    if (typeof _dsSettings !== 'undefined' && _dsSettings) {
        if (!_dsSettings.enabled) {
            deliveryFee = 0;
        } else if (_dsSettings.freeAbove > 0 && subtotal >= _dsSettings.freeAbove) {
            deliveryFee = 0;
        } else {
            deliveryFee = Number(_dsSettings.fee) || 0;
        }
    } else if (typeof window._gfyDeliveryFee !== 'undefined') {
        deliveryFee = window._gfyDeliveryFee;
    } else if (typeof window.currentDeliveryFee !== 'undefined') {
        deliveryFee = window.currentDeliveryFee;
    } else {
        try {
            const stored = localStorage.getItem('deliverySettings') || localStorage.getItem('perfect_delivery_settings');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed) {
                    const enabled = parsed.feeEnabled !== undefined ? parsed.feeEnabled : parsed.enabled;
                    const fee = parsed.feeAmount !== undefined ? parsed.feeAmount : parsed.fee;
                    const freeAbove = parsed.freeAbove;
                    if (enabled === false) {
                        deliveryFee = 0;
                    } else if (freeAbove > 0 && subtotal >= freeAbove) {
                        deliveryFee = 0;
                    } else {
                        deliveryFee = Number(fee) || 0;
                    }
                }
            }
        } catch(e) {}
    }

    const grandTotal = Number((subtotal + deliveryFee).toFixed(2));

    window.currentSubtotal = subtotal;
    window.currentDeliveryFee = deliveryFee;
    window.currentGrandTotal = grandTotal;
    window.finalAmount = grandTotal;
    window._pendingUPIAmount = grandTotal;
    window._gfyGrandTotal = grandTotal;

    return {
        subtotal,
        deliveryFee,
        grandTotal
    };
}

function updateElement(id, value) {
    const el = document.getElementById(id);

    if (!el) return;

    const formatted = '₹' + value;

    if (el.textContent !== formatted) {
        el.textContent = formatted;
    }
}

function syncTotalsUI() {
    const totals = calculateTotals();

    updateElement('om-subtotal', totals.subtotal);
    updateElement('subtotal', totals.subtotal);
    updateElement('cart-total', totals.subtotal);
    updateElement('items-total', totals.subtotal);

    updateElement('deliveryFee', totals.deliveryFee);
    updateElement('delivery-fee', totals.deliveryFee);
    updateElement('om-delivery-fee', totals.deliveryFee);

    if (totals.deliveryFee === 0) {
        const el = document.getElementById('om-delivery-fee-display');
        if (el) el.textContent = '🎁 Free';
    } else {
        updateElement('om-delivery-fee-display', totals.deliveryFee);
    }

    updateElement('om-total', totals.subtotal); // Set items total (subtotal)
    updateElement('om-grand-total', totals.grandTotal); // Set grand total
    updateElement('grand-total', totals.grandTotal);
    updateElement('totalAmount', totals.grandTotal);

    updateElement('upi-amount-display', totals.grandTotal);
    updateElement('phonepe-qr-amount', totals.grandTotal);

    document.querySelectorAll(
        'input[name="amount"], #payment-amount, .payment-amount'
    ).forEach(function(el) {
        el.value = totals.grandTotal;
    });

    return totals;
}

window.calculateTotals = calculateTotals;
window.syncTotalsUI = syncTotalsUI;
window.getGrandTotal = function() {
    return calculateTotals().grandTotal;
};

window.getSubtotal = function() {
    return calculateTotals().subtotal;
};

window.deepLinkUPI = function(app) {
    const totals = calculateTotals();
    const upiAmount = totals.grandTotal;

    const UPI_ID =
        window.UPI_ID ||
        'groceryforyousircilla@ybl'; // Dynamic from configuration/Firestore

    const baseLink =
        'upi://pay?pa=' +
        encodeURIComponent(UPI_ID) +
        '&pn=' +
        encodeURIComponent('GroceryForYou') +
        '&am=' +
        upiAmount +
        '&cu=INR';

    const links = {
        gpay: 'tez://upi/pay?' + baseLink.replace('upi://pay?', ''),
        phonepe: 'phonepe://pay?' + baseLink.replace('upi://pay?', ''),
        paytm: 'paytmmp://pay?' + baseLink.replace('upi://pay?', ''),
        bhim: baseLink
    };

    const targetUrl = links[app] || baseLink;

    // Detect Android WebView
    const ua = navigator.userAgent;
    const isAndroid = /Android/i.test(ua);
    const isWebView = isAndroid && (/wv/i.test(ua) || /Version\/[0-9.]+/i.test(ua));

    if (isWebView) {
        // Safe intent deep-linking to prevent ERR_UNKNOWN_URL_SCHEME crash in WebView
        let intentUrl = '';
        if (app === 'gpay') {
            intentUrl = 'intent://pay?' + baseLink.replace('upi://pay?', '') + '#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end';
        } else if (app === 'phonepe') {
            intentUrl = 'intent://pay?' + baseLink.replace('upi://pay?', '') + '#Intent;scheme=upi;package=com.phonepe.app;end';
        } else if (app === 'paytm') {
            intentUrl = 'intent://pay?' + baseLink.replace('upi://pay?', '') + '#Intent;scheme=upi;package=net.one97.paytm;end';
        } else {
            // Bhim / Generic UPI intent
            intentUrl = 'intent://pay?' + baseLink.replace('upi://pay?', '') + '#Intent;scheme=upi;end';
        }

        try {
            window.location.href = intentUrl;
        } catch (e) {
            console.error('[WebViewPayment] Intent failed, falling back', e);
            window.location.href = targetUrl;
        }
    } else {
        // Standard Chrome/desktop browser
        window.location.href = targetUrl;
    }
};

if (typeof window.openRazorpayCheckout === 'function') {
    const originalCheckout = window.openRazorpayCheckout;

    window.openRazorpayCheckout = function(amount, name, phone) {
        const totals = calculateTotals();

        return originalCheckout(
            totals.grandTotal,
            name,
            phone
        );
    };
}

let rafScheduled = false;

function requestTotalsRefresh() {
    if (rafScheduled) return;

    rafScheduled = true;

    requestAnimationFrame(function() {
        syncTotalsUI();
        rafScheduled = false;
    });
}

document.addEventListener('click', function(event) {
    const target = event.target;

    if (
        target.closest('.qty-btn') ||
        target.closest('.card-qty-btn') ||
        target.closest('.add-btn') ||
        target.closest('.checkout-btn')
    ) {
        setTimeout(requestTotalsRefresh, 0);
    }
}, true);

window.addEventListener('storage', requestTotalsRefresh);

const observer = new MutationObserver(function() {
    requestTotalsRefresh();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

document.addEventListener('DOMContentLoaded', function() {
    syncTotalsUI();
    setTimeout(syncTotalsUI, 300);

    // Prevent duplicate order placement from multiple clicks (double-submitting)
    let _realSubmitOrder = window.submitOrder;
    Object.defineProperty(window, 'submitOrder', {
      get: function() {
        return function(...args) {
          if (window._isSubmittingOrder) return;
          if (typeof _realSubmitOrder !== 'function') {
            console.warn('[submitOrder] Native handler not ready');
            return;
          }
          window._isSubmittingOrder = true;
          const btn = document.querySelector('.om-place');
          const originalText = btn ? btn.innerText : '🛍️ Place Order';
          if (btn) {
              btn.disabled = true;
              btn.innerText = '⏳ Placing...';
              btn.style.opacity = '0.7';
          }
          try {
              const res = _realSubmitOrder.apply(this, args);
              if (res instanceof Promise) {
                  res.finally(() => {
                      window._isSubmittingOrder = false;
                      if (btn) {
                          btn.disabled = false;
                          btn.innerText = originalText;
                          btn.style.opacity = '';
                      }
                  });
              } else {
                  setTimeout(() => {
                      window._isSubmittingOrder = false;
                      if (btn) {
                          btn.disabled = false;
                          btn.innerText = originalText;
                          btn.style.opacity = '';
                      }
                  }, 6000);
              }
              return res;
          } catch (err) {
              window._isSubmittingOrder = false;
              if (btn) {
                  btn.disabled = false;
                  btn.innerText = originalText;
                  btn.style.opacity = '';
              }
              throw err;
          }
        };
      },
      set: function(val) {
        _realSubmitOrder = val;
      },
      configurable: true
    });
});

window.addEventListener('load', function() {
    syncTotalsUI();
});

// Generic deep link URL scheme click interceptor for Android WebView compatibility
document.addEventListener('click', function(e) {
    const anchor = e.target.closest('a');
    if (!anchor) return;
    
    const href = anchor.getAttribute('href');
    if (!href) return;
    
    const isCustomScheme = href.startsWith('whatsapp:') || 
                           href.startsWith('tel:') || 
                           href.startsWith('upi:') || 
                           href.startsWith('intent:') || 
                           href.startsWith('mailto:') || 
                           href.startsWith('sms:');
                           
    if (isCustomScheme) {
        const ua = navigator.userAgent;
        const isAndroid = /Android/i.test(ua);
        const isWebView = isAndroid && (/wv/i.test(ua) || /Version\/[0-9.]+/i.test(ua));
        
        if (isWebView) {
            // Intercept custom scheme click to prevent ERR_UNKNOWN_URL_SCHEME crash
            e.preventDefault();
            // Try standard window.open or window.location redirect safely
            try {
                window.open(href, '_system');
            } catch(err) {
                console.error('[WebViewRedirect] window.open failed', err);
            }
            setTimeout(function() {
                try {
                    window.location.href = href;
                } catch(err) {}
            }, 100);
        }
    }
}, { passive: false });

})();

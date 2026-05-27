(function patchSignIn() {
  function doSignIn() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
      setTimeout(doSignIn, 400);
      return;
    }
    const authInst = firebase.auth();
    // Initialize the provider
    const provider = new firebase.auth.GoogleAuthProvider();

    // FORCE your verified Web Client ID into the provider settings
    provider.setCustomParameters({
        'client_id': '513928226780-99k0sfj6ltv4s49jsllk4614smk1r60f.apps.googleusercontent.com'
    });

    // Handle redirect result first (fires after redirect-based sign-in)
    authInst.getRedirectResult().then(result => {
      if (result && result.user) {
        if (typeof showToast === 'function') showToast('✅ Signed in as ' + result.user.email, 2500);
      }
    }).catch(err => {
      if (err && err.code !== 'auth/no-auth-event') {
        if (typeof showToast === 'function') showToast('❌ Sign in error: ' + (err.message || err.code), 3000);
      }
    });

    // Override the global signInWithGoogle function
    window.signInWithGoogle = function () {
      if (!authInst) {
        if (typeof showToast === 'function') showToast('⚠️ Firebase loading...', 2000);
        return;
      }
      // Close the auth modal immediately
      const overlay = document.getElementById('auth-overlay');
      if (overlay) overlay.classList.remove('open');

      authInst.signInWithPopup(provider)
        .then(result => {
          if (typeof showToast === 'function') showToast('✅ Signed in as ' + result.user.email, 2500);
        })
        .catch(err => {
          const code = err && err.code ? err.code : '';
          // Fallback to redirect for blocked popups or unauthorized domain
          if (
            code === 'auth/popup-blocked' ||
            code === 'auth/popup-closed-by-user' ||
            code === 'auth/unauthorized-domain' ||
            code === 'auth/operation-not-allowed' ||
            code === 'auth/cancelled-popup-request'
          ) {
            if (typeof showToast === 'function') showToast('🔄 Redirecting for sign-in...', 2000);
            authInst.signInWithRedirect(provider);
          } else {
            const msg = (err && err.message) ? err.message : code;
            if (typeof showToast === 'function') showToast('❌ Sign in failed: ' + msg, 3000);
            console.error('[SignIn]', err);
          }
        });
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doSignIn);
  } else {
    setTimeout(doSignIn, 300);
  }
})();
// ===== GFY ENHANCED FIRESTORE INTEGRATION =====
(function(){
'use strict';
let currentRole = 'customer';
let currentUser = null;
function waitFor(check,cb,n){if(n===undefined)n=0;if(check())return cb();if(n<40)setTimeout(()=>waitFor(check,cb,n+1),500);}
function gfyDB(){return(typeof firebase!=='undefined'&&firebase.apps&&firebase.apps.length)?firebase.firestore():null;}

// ── 1. CLEAR LEGACY STATIC ARRAYS & OVERRIDE CATEGORIES ─────────────────
if (typeof items !== 'undefined') {
  items.length = 0;
}
if (typeof window.items !== 'undefined') {
  window.items.length = 0;
}

if (typeof categories !== 'undefined') {
  categories.length = 0;
  categories.push(
    { id: 'vegetables', name: 'Vegetables', emoji: '🥦' },
    { id: 'fruits', name: 'Fruits', emoji: '🍎' },
    { id: 'dairy', name: 'Dairy', emoji: '🥛' },
    { id: 'grocery', name: 'Grocery', emoji: '🌾' },
    { id: 'leafy', name: 'Leafy', emoji: '🥬' },
    { id: 'snacks', name: 'Snacks', emoji: '🍿' },
    { id: 'beverages', name: 'Beverages', emoji: '🥤' }
  );
}

// ── 2. ADMIN ORDER WATCHER ───────────────────────────────────────────────
let _adminOrderUnsub=null,_adminInit=false,_adminSeen=new Set();
function setupAdminOrderWatch(db){
  if(_adminOrderUnsub)return;
  try{
    _adminOrderUnsub=db.collection('orders')
      .where('status','==','placed')
      .onSnapshot(snap=>{
        snap.docChanges().forEach(ch=>{
          if(ch.type==='added'&&!_adminInit)return;
          if(ch.type==='added'){
            const oid=ch.doc.id;
            if(_adminSeen.has(oid))return;
            _adminSeen.add(oid);
            const o=ch.doc.data();
            if(typeof stopZomatoRingtone==='function')stopZomatoRingtone();
            if(typeof playZomatoRingtone==='function')playZomatoRingtone();
            if(typeof showToast==='function')showToast('🔔 New Order! '+( o.customerName||'Customer')+' — ₹'+(o.total||''),10000);
            gfyNotif('🔔 New Order!','Customer: '+(o.customerName||'')+'  ₹'+(o.total||''));
            if(typeof showAdminOrderPopup==='function')showAdminOrderPopup({id:oid,...o});
          }
        });
        _adminInit=true;
      },e=>console.error('[Admin Watch]',e));
  }catch(e){console.error('[Admin Watch setup]',e);}
}

// ── 3. CUSTOMER ORDER STATUS WATCHER ────────────────────────────────────
let _custUnsub=null,_custSeen={};
function setupCustomerWatch(db,email){
  if(_custUnsub){_custUnsub();_custUnsub=null;}
  if(!email)return;
  const MSGS={
    'accepted':'✅ Your order was accepted! Preparing now 🍳',
    'rejected':'❌ Sorry, your order was rejected.',
    'preparing':'🍳 Your order is being prepared!',
    'ready':'📦 Order packed! Delivery partner picking up soon.',
    'out_for_delivery':'🚴 Your order is out for delivery!',
    'completed':'🎉 Order delivered! Enjoy your groceries!',
    'delivered':'🎉 Order delivered! Enjoy your groceries!',
    'cancelled':'🚫 Your order was cancelled.'
  };
  try{
    _custUnsub=db.collection('orders')
      .where('customerEmail','==',email)
      .orderBy('createdAt','desc')
      .limit(10)
      .onSnapshot(snap=>{
        snap.docChanges().forEach(ch=>{
          if(ch.type!=='modified')return;
          const o=ch.doc.data(),s=o.status,key=ch.doc.id+'_'+s;
          if(_custSeen[key])return;
          _custSeen[key]=true;
          const msg=MSGS[s];
          if(msg){
            if(typeof showToast==='function')showToast(msg,6000);
            gfyNotif('Grocery For You 🛒',msg);
          }
        });
      },e=>console.error('[Cust Watch]',e));
  }catch(e){console.error('[Cust Watch setup]',e);}
}

// ── 4. RATING WITH EMAIL ─────────────────────────────────────────────────
window.GFY_submitRating=async function(itemId,stars,reviewText){
  if(!window.currentUser){
    if(typeof showToast==='function')showToast('⚠️ Please sign in to rate',2000);
    return false;
  }
  try{
    const db=gfyDB();if(!db)return false;
    const email=window.currentUser.email;
    const safeMail=email.replace(/[.@]/g,'_');
    const itemRef=db.collection('menuItems').doc(itemId);
    await itemRef.collection('reviews').doc(safeMail).set({
      email,name:window.currentUser.displayName||email,
      rating:stars,review:reviewText||'',
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    },{merge:true});
    const allRevs=await itemRef.collection('reviews').get();
    let total=0;allRevs.forEach(d=>{total+=d.data().rating||0;});
    const avg=allRevs.size?Math.round((total/allRevs.size)*10)/10:0;
    await itemRef.update({rating:avg,reviewsCount:allRevs.size,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
    if(typeof showToast==='function')showToast('⭐ Thanks for your review!',2000);
    return true;
  }catch(e){
    console.error('[Rating]',e);
    if(typeof showToast==='function')showToast('❌ Could not save rating',2000);
    return false;
  }
};

// ── 5. BROWSER NOTIFICATION HELPER ──────────────────────────────────────
function gfyNotif(title,body){
  if(!('Notification'in window))return;
  if(Notification.permission==='granted'){
    try{new Notification(title,{body,icon:'https://groceryforyou.github.io/favicon.ico'});}catch(e){}
  }else if(Notification.permission==='default'){
    Notification.requestPermission().then(p=>{
      if(p==='granted')try{new Notification(title,{body});}catch(e){}
    });
  }
}

// ── 6. REQUEST NOTIFICATION PERMISSION ──────────────────────────────────
if('Notification'in window&&Notification.permission==='default'){
  document.addEventListener('click',function ask(){
    Notification.requestPermission();
    document.removeEventListener('click',ask);
  },{once:true});
}

// ── 7. WIRE INTO AUTH STATE ───────────────────────────────────────────────
waitFor(
  ()=>typeof firebase!=='undefined'&&firebase.apps&&firebase.apps.length>0,
  ()=>{
    const db=firebase.firestore();
    window.db=db; // Expose db to window.db
    firebase.auth().onAuthStateChanged(async user=>{
      if(!user){
        if(_custUnsub){_custUnsub();_custUnsub=null;}
        if(_adminOrderUnsub){_adminOrderUnsub();_adminOrderUnsub=null;_adminInit=false;}
        return;
      }
      const isAdmin=(window.currentRole==='admin');
      if(isAdmin){
        setTimeout(()=>setupAdminOrderWatch(db),1500);
      } else {
        setupCustomerWatch(db,user.email);
      }
    });
  }
);

window.items = items;
window.categories = categories;
window.cart = cart;
window.refreshInventoryUI = refreshInventoryUI;
window.renderMenuPage = renderMenuPage;
window.refreshManageList = refreshManageList;
window.updateCart = updateCart;
Object.defineProperty(window, 'currentRole', {
  get: function() { return currentRole; },
  set: function(val) { currentRole = val; },
  configurable: true
});
Object.defineProperty(window, 'currentUser', {
  get: function() { return currentUser; },
  set: function(val) { currentUser = val; },
  configurable: true
});
})();
(function GFYDeliveryFeeSystem() {
  'use strict';

  /* ── State ── */
  var _fee         = 0;   // current delivery fee
  var _unsub       = null; // onSnapshot unsubscriber
  var _db          = null; // Firestore instance
  let currentDeliveryFee = 0;

  /* ── Global references from patchSupportTickets IIFE ── */
  var getDeliverySettings = function() {
    return typeof window.getDeliverySettings === 'function' ? window.getDeliverySettings() : {};
  };
  var DELIVERY_SETTINGS_KEY = window.DELIVERY_SETTINGS_KEY || 'deliverySettings';
  var DEFAULT_DELIVERY_SETTINGS = window.DEFAULT_DELIVERY_SETTINGS || {
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
  };
  var renderDeliverySettings = function() {
    if (typeof window.renderDeliverySettings === 'function') {
      return window.renderDeliverySettings.apply(null, arguments);
    }
  };

  /* ── Helpers ── */
  function fmt(n) { return '\u20B9' + Math.max(0, Number(n) || 0); }

  function numFrom(el) {
    if (!el) return 0;
    return parseInt((el.innerText || el.textContent || '0').replace(/\D/g, ''), 10) || 0;
  }

  /* ── Apply fee to all UI elements ── */
  function applyFee(fee) {
    fee = Number(fee) || 0;
    _fee = fee;
    currentDeliveryFee = fee; // Ensure obfuscated order code uses correct fee
    window._gfyDeliveryFee = fee;
    console.log('[DeliveryFee] applyFee:', fee);

    updateCartDeliveryFee();

    /* Sync admin input without stealing focus */
    var adminInput = document.getElementById('gfy-delivery-fee-input')
                  || document.getElementById('svc-fee-amount');
    if (adminInput && document.activeElement !== adminInput) {
      adminInput.value = fee;
    }

    /* Update cart display if available */
    updateCartTotal();
  }

  function updateCartTotal(){
     const subtotal = getCartSubtotal();
     const total = subtotal + _fee;

     // Update cart display elements
     const deliveryFeeEl = document.getElementById("deliveryFee");
     const totalAmountEl = document.getElementById("totalAmount");
     
     if (deliveryFeeEl) deliveryFeeEl.innerText = "₹"+_fee;
     if (totalAmountEl) totalAmountEl.innerText = "₹"+total;

     // Update order modal elements
     const omTotalEl = document.getElementById('om-total');
      if (omTotalEl) {
        // Do not overwrite the order modal subtotal directly here.
        // Let the main checkout flow manage the om-total value.
      }

     window.finalAmount = total;
     console.log('[DeliveryFee] Cart total updated:', subtotal, '+', _fee, '=', total);
  }

  function getCartSubtotal(){
     if(typeof cart !== 'undefined'){
        return Object.keys(cart).reduce((sum, id) => sum + cart[id].price * cart[id].qty, 0);
     }
     return 0;
  }

  /* ── Start Firestore real-time listener (singleton) ── */
  function startListener(db) {
    if (_unsub) { 
      console.log('[DeliveryFee] listener already active'); 
      return; 
    }
    console.log('[DeliveryFee] Starting real-time listener on settings/delivery');

    // Clean up any existing listener
    if(window.deliveryListener){
       window.deliveryListener();
       window.deliveryListener = null;
    }

    _unsub = db.collection('settings').doc('delivery').onSnapshot(
     (snap)=>{
       if(snap.exists){
          const data = snap.data();
          const fee = Number(data.fee) || 0;
          const enabled = data.enabled === undefined ? true : data.enabled === true;
          
          // Validate the fee value and respect the enabled toggle
          if (enabled && (isNaN(fee) || fee < 0)) {
            console.warn('[DeliveryFee] Invalid fee value received:', fee, ', using 0');
            currentDeliveryFee = 0;
            _fee = 0;
          } else {
            currentDeliveryFee = enabled ? fee : 0;
            _fee = fee; // keep raw amount stored even when delivery is disabled
          }
          
          console.log('[DeliveryFee] Real-time update received: enabled=%s fee=%d', enabled, currentDeliveryFee);
          
          // Apply the fee to the cart
          applyFee(currentDeliveryFee);
          updateCartTotal();
       } else {
          // Document doesn't exist, try to load from app_settings
          console.log('[DeliveryFee] settings/delivery not found, checking app_settings');
          
          // Attempt to fallback to app_settings
          if (db && db.collection) {
            db.collection('app_settings').doc('delivery_settings').get()
              .then(docSnap => {
                if (docSnap.exists) {
                  const data = docSnap.data();
                  const fee = Number(data.feeAmount) || 0;
                  const enabled = data.feeEnabled === true;
                  
                  if (enabled && (isNaN(fee) || fee < 0)) {
                    console.warn('[DeliveryFee] Invalid fee value from app_settings:', fee);
                    currentDeliveryFee = 0;
                  } else {
                    currentDeliveryFee = enabled ? fee : 0;
                  }
                  _fee = fee; // preserve stored amount even when disabled
                  
                  console.log('[DeliveryFee] Loaded from app_settings: enabled=%s fee=%d', enabled, currentDeliveryFee);
                  applyFee(currentDeliveryFee);
                  updateCartTotal();
                } else {
                  console.log('[DeliveryFee] No delivery settings found anywhere, setting fee to 0');
                  currentDeliveryFee = 0;
                  _fee = 0;
                  applyFee(0);
                  updateCartTotal();
                }
              })
              .catch(err => console.warn('[DeliveryFee] Error loading from app_settings:', err));
          } else {
            currentDeliveryFee = 0;
            _fee = 0;
            applyFee(0);
            updateCartTotal();
          }
       }
     },
     (error) => {
       console.error('[DeliveryFee] Listener error:', error);
       // On error, try to use localStorage fallback
       try {
         const saved = localStorage.getItem('deliverySettings');
         if (saved) {
           const settings = JSON.parse(saved);
           currentDeliveryFee = settings.feeEnabled ? settings.feeAmount : 0;
           _fee = currentDeliveryFee;
           console.log('[DeliveryFee] Using localStorage fallback: fee=%d', currentDeliveryFee);
           applyFee(currentDeliveryFee);
           updateCartTotal();
         }
       } catch (e) {
         console.warn('[DeliveryFee] localStorage fallback failed:', e);
       }
     }
    );
    
    window.deliveryListener = _unsub;
  }

  /* ── Admin: save fee to Firestore ── */
  async function saveFee() {
    if (!_db) { 
      console.warn('[DeliveryFee] DB not ready'); 
      if (typeof showToast === 'function') {
        showToast('⚠️ Database not ready yet. Please try again.', 2500);
      }
      return; 
    }

    // Get delivery fee and enabled status from admin UI
    var feeInput = document.getElementById('gfy-delivery-fee-input')
                || document.getElementById('svc-fee-amount');
    var feeToggle = document.getElementById('svc-fee-enabled');
    
    var fee = feeInput ? Number(feeInput.value) : _fee;
    var enabled = feeToggle ? feeToggle.checked : true;
    
    // Validate inputs
    if (isNaN(fee) || fee < 0) fee = 0;
    if (enabled && fee <= 0) {
      console.warn('[DeliveryFee] Invalid fee amount when enabled');
      if (typeof showToast === 'function') {
        showToast('⚠️ Please enter a valid delivery fee amount (must be > 0)', 2500);
      }
      return;
    }

    console.log('[DeliveryFee] Saving: enabled=%s fee=%d', enabled, fee);
    // Keep a local copy so the admin UI can restore even if Firestore is temporarily unavailable.
    try {
      localStorage.setItem('deliverySettings', JSON.stringify({
        feeEnabled: enabled,
        feeAmount: fee,
        updatedAt: new Date().toISOString()
      }));
      console.log('[DeliveryFee] localStorage persisted delivery fee state');
    } catch (err) {
      console.warn('[DeliveryFee] localStorage save failed:', err);
    }

    let successCount = 0;
    let errors = [];

    // Save to settings/delivery (for real-time checkout)
    _db.collection('settings').doc('delivery').set({
      fee: fee,
      enabled: enabled,
      updatedAt: new Date().toISOString()
    }, {merge: true})
      .then(() => {
        successCount++;
        console.log('[DeliveryFee] ✓ Saved to settings/delivery');
      })
      .catch(e => {
        console.error('[DeliveryFee] settings/delivery save error:', e.code, e.message);
        errors.push('settings/delivery: ' + (e.code || e.message));
        
        // Retry with simpler data if permission denied
        if (e.code === 'permission-denied') {
          console.log('[DeliveryFee] Retrying settings/delivery with minimal data...');
          _db.collection('settings').doc('delivery').set({
            fee: fee,
            enabled: enabled,
            updatedAt: new Date().toISOString()
          }, {merge: true})
            .then(() => {
              successCount++;
              console.log('[DeliveryFee] ✓ Saved to settings/delivery (retry)');
            })
            .catch(e2 => console.error('[DeliveryFee] Retry failed:', e2.code));
        }
      });

    // Save to app_settings (for admin panel UI)
    _db.collection('app_settings').doc('delivery_settings').set({
      feeEnabled: enabled,
      feeAmount: fee,
      updatedAt: new Date().toISOString(),
      savedBy: typeof currentUser !== 'undefined' && currentUser ? currentUser.email : 'system'
    }, {merge: true})
      .then(() => {
        successCount++;
        console.log('[DeliveryFee] ✓ Saved to app_settings/delivery_settings');
      })
      .catch(e => {
        console.error('[DeliveryFee] app_settings save error:', e.code, e.message);
        errors.push('app_settings: ' + (e.code || e.message));
        
        // Retry with simpler data if permission denied
        if (e.code === 'permission-denied') {
          console.log('[DeliveryFee] Retrying app_settings with minimal data...');
          _db.collection('app_settings').doc('delivery_settings').set({
            feeEnabled: enabled,
            feeAmount: fee,
            updatedAt: new Date().toISOString()
          }, {merge: true})
            .then(() => {
              successCount++;
              console.log('[DeliveryFee] ✓ Saved to app_settings (retry)');
            })
            .catch(e2 => console.error('[DeliveryFee] Retry failed:', e2.code));
        }
      });

    // Show result after a brief delay
    setTimeout(() => {
      console.log('[DeliveryFee] Save complete - success count:', successCount, 'errors:', errors);
      
      // Immediately update local state
      currentDeliveryFee = enabled ? fee : 0;
      _fee = currentDeliveryFee;
      applyFee(currentDeliveryFee);
      updateCartTotal();

      if (successCount >= 1) {
        console.log('[DeliveryFee] Saved successfully: enabled=%s fee=%d', enabled, currentDeliveryFee);
        if (typeof showToast === 'function') {
          showToast('✅ Delivery fee updated & synced successfully', 2500);
        }
      } else if (errors.length > 0) {
        console.warn('[DeliveryFee] All saves failed:', errors);
        if (typeof showToast === 'function') {
          showToast('⚠️ Permission denied. Check Firestore security rules.', 3000);
        }
        console.log('[DeliveryFee] FIRESTORE RULES NEEDED:', {
          'rule1': 'match /settings/{document=**} { allow write if request.auth.token.admin == true; }',
          'rule2': 'match /app_settings/{document=**} { allow write if request.auth.token.admin == true; }'
        });
      }
    }, 800);
  }

  /* ── Patch openOrderModal: reapply fee after modal opens ── */
  function patchOpenOrderModal() {
    var orig = window.openOrderModal;
    if (typeof orig !== 'function') { setTimeout(patchOpenOrderModal, 400); return; }

    window.openOrderModal = function() {
      // Ensure delivery fee is loaded before opening modal
      if (window.currentDeliveryFee === undefined || window.currentDeliveryFee === null) {
        var settings = typeof getDeliverySettings === 'function' ? getDeliverySettings() : {};
        window.currentDeliveryFee = settings.feeEnabled ? (settings.feeAmount || 0) : 0;
        _fee = window.currentDeliveryFee;
        console.log('[DeliveryFee] Initialized currentDeliveryFee from settings:', window.currentDeliveryFee);
      }
      
      orig.apply(this, arguments);
      [100, 350, 700, 1200, 2000].forEach(function(ms) {
        setTimeout(function() { applyFee(_fee); }, ms);
      });
    };

    console.log('[DeliveryFee] openOrderModal patched');
  }

  /* ── Wire admin save buttons ── */
  function wireAdminUI() {
    /* Override global function used by existing save buttons */
    if (typeof saveDeliverySettings !== 'undefined') {
      window.saveDeliverySettings = saveDeliverySettings;
    } else {
      console.warn('[DeliveryFee] saveDeliverySettings not yet defined, will be wired on demand');
    }
    
    if (typeof saveFee !== 'undefined') {
      window.gfySaveDeliveryFee = saveFee;
    }

    /* Wire any existing or new save button */
    ['svc-save-btn', 'gfy-save-delivery-fee'].forEach(function(id) {
      var btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', function(e) { 
        e.preventDefault(); 
        if (typeof saveDeliverySettings === 'function') {
          saveDeliverySettings();
        } else {
          console.error('[DeliveryFee] saveDeliverySettings function not found');
          showToast('⚠️ Delivery settings function not loaded. Please refresh the page.', 3000);
        }
      });
    });

    /* Wire existing fee amount input for live preview */
    ['svc-fee-amount', 'gfy-delivery-fee-input'].forEach(function(id) {
      var inp = document.getElementById(id);
      if (inp) {
        inp.addEventListener('input', function() {
          var v = Number(inp.value) || 0;
          /* Live preview only — does not save */
          var feeEl = document.getElementById('om-delivery-fee-display');
          if (feeEl) feeEl.innerText = fmt(v);
        });
      }
    });

    console.log('[DeliveryFee] Admin UI wired');
  }

  /* ── Wait for Firestore to be ready ── */
  function waitForDB(cb) {
    var t = 0;
    var iv = setInterval(function() {
      t += 300;
      if (typeof firebase !== 'undefined'
          && firebase.apps && firebase.apps.length
          && typeof firebase.firestore === 'function') {
        clearInterval(iv);
        var db = firebase.firestore();
        _db = db;
        cb(db);
      } else if (t > 15000) {
        clearInterval(iv);
        console.error('[DeliveryFee] Timed out waiting for Firebase');
      }
    }, 300);
  }

  /* ── Bootstrap ── */
  function bootstrap() {
    console.log('[DeliveryFee] Bootstrap start');
    wireAdminUI();
    patchOpenOrderModal();

    waitForDB(function(db) {
      // Sync and load delivery settings from Firestore at bootstrap
      setTimeout(async () => {
        try {
          // Load from app_settings (admin settings)
          const appSettingsSnap = await db.collection('app_settings').doc('delivery_settings').get();
          // Load from settings/delivery (checkout system)
          const checkoutSettingsSnap = await db.collection('settings').doc('delivery').get();
          
          let freshSettings = { ...DEFAULT_DELIVERY_SETTINGS };
          let source = 'default';
          const appData = appSettingsSnap.exists ? appSettingsSnap.data() : null;
          const checkoutData = checkoutSettingsSnap.exists ? checkoutSettingsSnap.data() : null;

          function normalizeCheckoutData(data) {
            return {
              feeEnabled: data.enabled === true,
              feeAmount: Number(data.fee) || 0,
              freeAbove: Number(data.freeAbove) || 0,
              freeOffer: data.freeOffer === true,
              highDemandEnabled: data.highDemandEnabled === true,
              highDemandAmount: Number(data.highDemandAmount) || 0,
              businessHoursEnabled: data.businessHoursEnabled === true,
              businessOpen: data.businessOpen !== undefined ? data.businessOpen : DEFAULT_DELIVERY_SETTINGS.businessOpen,
              openHour: Number(data.openHour) || 6,
              closeHour: Number(data.closeHour) || 20,
              outOfServiceMessage: data.outOfServiceMessage || DEFAULT_DELIVERY_SETTINGS.outOfServiceMessage,
              updatedAt: data.updatedAt || new Date().toISOString()
            };
          }

          if (appData && checkoutData) {
            const appTime = new Date(appData.updatedAt || 0).getTime();
            const checkoutTime = new Date(checkoutData.updatedAt || 0).getTime();
            if (checkoutTime > appTime) {
              freshSettings = { ...DEFAULT_DELIVERY_SETTINGS, ...normalizeCheckoutData(checkoutData) };
              source = 'checkout';
            } else {
              freshSettings = { ...DEFAULT_DELIVERY_SETTINGS, ...appData };
              source = 'app_settings';
            }
          } else if (appData) {
            freshSettings = { ...DEFAULT_DELIVERY_SETTINGS, ...appData };
            source = 'app_settings';
          } else if (checkoutData) {
            freshSettings = { ...DEFAULT_DELIVERY_SETTINGS, ...normalizeCheckoutData(checkoutData) };
            source = 'checkout';
          }

          const localSettings = getDeliverySettings();
          const freshTime = new Date(freshSettings.updatedAt || 0);
          const localTime = new Date(localSettings.updatedAt || 0);
          if (source !== 'default' && freshTime >= localTime) {
            localStorage.setItem(DELIVERY_SETTINGS_KEY, JSON.stringify(freshSettings));
            console.log('[DeliverySettings] Loaded from', source, 'at bootstrap:', freshSettings);
            if (typeof renderDeliverySettings === 'function') {
              await renderDeliverySettings();
            }
          } else if (source !== 'default') {
            console.log('[DeliverySettings] Local settings are newer than', source, 'keeping localStorage');
          }

          const desiredSettings = {
            fee: freshSettings.feeEnabled ? freshSettings.feeAmount : 0,
            enabled: freshSettings.feeEnabled,
            freeAbove: freshSettings.freeAbove || 0,
            freeOffer: freshSettings.freeOffer || false,
            highDemandEnabled: freshSettings.highDemandEnabled || false,
            highDemandAmount: freshSettings.highDemandAmount || 0,
            businessHoursEnabled: freshSettings.businessHoursEnabled || false,
            businessOpen: freshSettings.businessOpen !== undefined ? freshSettings.businessOpen : DEFAULT_DELIVERY_SETTINGS.businessOpen,
            openHour: freshSettings.openHour || 6,
            closeHour: freshSettings.closeHour || 20,
            outOfServiceMessage: freshSettings.outOfServiceMessage || DEFAULT_DELIVERY_SETTINGS.outOfServiceMessage,
            updatedAt: new Date().toISOString()
          };

          const appSettingsSync = {
            ...freshSettings,
            updatedAt: new Date().toISOString()
          };

          const shouldSyncCheckout = !checkoutData
            || checkoutData.fee !== desiredSettings.fee
            || checkoutData.enabled !== desiredSettings.enabled
            || checkoutData.freeAbove !== desiredSettings.freeAbove
            || checkoutData.freeOffer !== desiredSettings.freeOffer
            || checkoutData.highDemandEnabled !== desiredSettings.highDemandEnabled
            || checkoutData.highDemandAmount !== desiredSettings.highDemandAmount
            || checkoutData.businessOpen !== desiredSettings.businessOpen;

          const shouldSyncApp = !appData
            || appData.feeEnabled !== freshSettings.feeEnabled
            || appData.feeAmount !== freshSettings.feeAmount
            || appData.freeAbove !== freshSettings.freeAbove
            || appData.freeOffer !== freshSettings.freeOffer
            || appData.highDemandEnabled !== freshSettings.highDemandEnabled
            || appData.highDemandAmount !== freshSettings.highDemandAmount
            || appData.businessOpen !== freshSettings.businessOpen;

          if (shouldSyncCheckout || shouldSyncApp) {
            console.log('[DeliveryFee] Settings mismatch detected at bootstrap, syncing collections...');
            const batchOps = [];
            if (shouldSyncCheckout) {
              batchOps.push(db.collection('settings').doc('delivery').set(desiredSettings, { merge: true }));
            }
            if (shouldSyncApp) {
              batchOps.push(db.collection('app_settings').doc('delivery_settings').set(appSettingsSync, { merge: true }));
            }
            await Promise.all(batchOps);
            console.log('[DeliveryFee] Collections synced successfully');
          } else {
            console.log('[DeliveryFee] Collections already in sync');
          }
        } catch (err) {
          console.warn('[DeliverySettings] Sync error at bootstrap:', err);
        }

        startListener(db);

        /* Restart listener if tab regains focus after sleep */
        window.addEventListener('focus', function() {
          if (!_unsub) { console.log('[DeliveryFee] Tab focused, restarting listener'); startListener(db); }
        });
      }, 500);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    setTimeout(bootstrap, 100);
  }

  console.log('[DeliveryFee] 🚀 System loaded');
})();
(function GFYUnifiedFirestoreSync() {
  'use strict';

  // ── 1. MODULAR-TO-NAMESPACE SDK COMPATIBILITY LAYER ──────────────────
  function doc(dbInstance, collectionPath, documentPath) {
    return dbInstance.collection(collectionPath).doc(documentPath);
  }
  function collection(dbInstance, collectionPath) {
    return dbInstance.collection(collectionPath);
  }
  async function setDoc(docRef, data) {
    return docRef.set(data, { merge: true });
  }
  async function updateDoc(docRef, data) {
    return docRef.update(data);
  }
  function onSnapshot(ref, callback, errorCallback) {
    return ref.onSnapshot(callback, errorCallback);
  }

  // ── 2. ADMIN EDIT ITEM MODAL SETUP ──────────────────────────────────
  function injectEditItemModal() {
    if (document.getElementById('edit-item-modal-overlay')) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'cat-modal-overlay';
    overlay.id = 'edit-item-modal-overlay';
    overlay.innerHTML = `
      <div class="cat-modal">
        <div class="cat-modal-head" style="background: linear-gradient(135deg, var(--brown), #1e7a3a);">
          <h3>✏️ Edit Item</h3>
          <button class="cat-modal-close" onclick="closeEditItemModal()">✕</button>
        </div>
        <div class="cat-modal-body" style="padding: 20px; max-height: 75dvh; overflow-y: auto;">
          <div style="margin-bottom: 12px;">
            <label class="aip-label" style="font-size: .72rem; font-weight: 800; color: var(--brown); text-transform: uppercase; letter-spacing: .5px; display: block; margin-bottom: 5px;">Item Name</label>
            <input type="text" id="edit-item-name" class="aip-input" style="width: 100%; border: 1.5px solid var(--border); border-radius: 10px; padding: 9px 12px; font-size: .88rem; outline: none; background: #fff;" />
          </div>
          <div style="margin-bottom: 12px;">
            <label class="aip-label" style="font-size: .72rem; font-weight: 800; color: var(--brown); text-transform: uppercase; letter-spacing: .5px; display: block; margin-bottom: 5px;">Price (₹)</label>
            <input type="number" id="edit-item-price" class="aip-input" style="width: 100%; border: 1.5px solid var(--border); border-radius: 10px; padding: 9px 12px; font-size: .88rem; outline: none; background: #fff;" />
          </div>
          <div style="margin-bottom: 12px;">
            <label class="aip-label" style="font-size: .72rem; font-weight: 800; color: var(--brown); text-transform: uppercase; letter-spacing: .5px; display: block; margin-bottom: 5px;">Stock Status</label>
            <select id="edit-item-stock" class="aip-select" style="width: 100%; border: 1.5px solid var(--border); border-radius: 10px; padding: 9px 12px; font-size: .88rem; outline: none; background: #fff; cursor: pointer;">
              <option value="1">✅ In Stock</option>
              <option value="0">❌ Out Of Stock</option>
            </select>
          </div>
          <input type="hidden" id="edit-item-id" />
          <div class="cat-modal-actions" style="display: flex; gap: 8px; margin-top: 20px;">
            <button class="cat-cancel-btn" onclick="closeEditItemModal()" style="flex: 1; background: var(--cream); border: 1.5px solid var(--border); color: var(--brown); border-radius: 10px; padding: 11px; font-weight: 700; cursor: pointer;">Cancel</button>
            <button class="cat-save-btn" onclick="saveEditedItem()" style="flex: 2; background: linear-gradient(90deg, var(--brown), var(--saffron)); color: #fff; border: none; border-radius: 10px; padding: 11px; font-family: 'Yeseva One', serif; font-size: .9rem; cursor: pointer;">Save Changes</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  window.openEditItemModal = function(itemId) {
    const allItems = (typeof window.items !== 'undefined') ? window.items : [];
    const item = allItems.find(i => i.id === itemId);
    if (!item) {
      if (typeof showToast === 'function') showToast('⚠️ Item not found', 2500);
      return;
    }
    
    injectEditItemModal();
    
    document.getElementById('edit-item-name').value = item.name || '';
    document.getElementById('edit-item-price').value = item.price || 0;
    document.getElementById('edit-item-stock').value = item.inStock ? '1' : '0';
    document.getElementById('edit-item-id').value = itemId;

    // Dynamically prefill choices for current categories list
    const editItemCat = document.getElementById('edit-item-cat');
    if (editItemCat) {
      const allCats = (typeof window.categories !== 'undefined') ? window.categories : [];
      editItemCat.innerHTML = allCats.map(cat => 
        `<option value="${cat.id}">${cat.emoji} ${cat.name}</option>`
      ).join('');
      editItemCat.value = item.category || item.catId || '';
    }
    
    document.getElementById('edit-item-modal-overlay').classList.add('open');
    if (typeof window.lockBodyScroll === 'function') window.lockBodyScroll();
  };

  window.closeEditItemModal = function() {
    const overlay = document.getElementById('edit-item-modal-overlay');
    if (overlay) {
      overlay.classList.remove('open');
      if (typeof window.unlockBodyScroll === 'function') window.unlockBodyScroll();
    }
  };

  // ── 3. ADMINISTRATIVE ACTIONS ──────────────────────────────────────────
  
  // Add New Item Function using setDoc
  window.saveNewItem = async function() {
    if (typeof currentRole !== 'undefined' && currentRole !== 'admin') {
      if (typeof showToast === 'function') showToast('⚠️ Only admin can add items');
      return;
    }

    const nameInput = document.getElementById('aip-name');
    const priceInput = document.getElementById('aip-price');
    const catSelect = document.getElementById('aip-cat');
    const emojiCustom = document.getElementById('aip-emoji-custom');
    const stockSelect = document.getElementById('aip-stock');

    const name = nameInput ? nameInput.value.trim() : '';
    const price = priceInput ? parseFloat(priceInput.value) : 0;
    const category = catSelect ? catSelect.value : '';
    const emoji = (emojiCustom && emojiCustom.value.trim()) || window.selectedEmoji || '🍎';
    const inStock = stockSelect ? stockSelect.value === '1' : true;

    if (!name) {
      if (nameInput) nameInput.focus();
      if (typeof showToast === 'function') showToast('⚠️ Please enter an item name');
      return;
    }
    if (isNaN(price) || price <= 0) {
      if (priceInput) priceInput.focus();
      if (typeof showToast === 'function') showToast('⚠️ Please enter a valid price');
      return;
    }
    if (!category) {
      if (typeof showToast === 'function') showToast('⚠️ Please select a category');
      return;
    }

    const firebaseDB = (typeof db !== 'undefined' && db) ? db : 
                       (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && typeof firebase.firestore === 'function') ? firebase.firestore() : null;

    if (!firebaseDB) {
      if (typeof showToast === 'function') showToast('⚠️ Database not ready');
      return;
    }

    const itemId = 'item_' + Date.now();

    try {
      await setDoc(doc(firebaseDB, "menuItems", itemId), {
        id: itemId,
        name,
        price,
        category,
        catId: category,
        inStock,
        emoji,
        description: '',
        type: '',
        image: '',
        discount: 0,
        rating: 5.0,
        ratingCount: 5,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      if (typeof showToast === 'function') showToast(`🎉 ${name} added successfully!`, 3000);

      // Reset fields
      if (nameInput) nameInput.value = '';
      if (priceInput) priceInput.value = '';
      if (emojiCustom) emojiCustom.value = '';
      if (stockSelect) stockSelect.value = '1';
      
      window.selectedEmoji = '🍽';
      const emojiOpts = document.querySelectorAll('.emoji-opt');
      emojiOpts.forEach(opt => opt.classList.toggle('selected', opt.textContent === '🍽'));

    } catch (err) {
      console.error('[AddItem] Firestore write failed:', err);
      const user = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
      const emailInfo = user ? ` (Logged in as: ${user.email})` : ' (Not logged in)';
      if (typeof showToast === 'function') showToast('⚠️ Write failed: ' + (err.message || err) + emailInfo, 5000);
    }
  };

  // Edit Item Function using updateDoc
  window.saveEditedItem = async function() {
    const itemId = document.getElementById('edit-item-id').value;
    const name = document.getElementById('edit-item-name').value.trim();
    const price = parseFloat(document.getElementById('edit-item-price').value);
    const inStock = document.getElementById('edit-item-stock').value === '1';

    if (!name) {
      if (typeof showToast === 'function') showToast('⚠️ Please enter an item name');
      return;
    }
    if (isNaN(price) || price <= 0) {
      if (typeof showToast === 'function') showToast('⚠️ Please enter a valid price');
      return;
    }

    const firebaseDB = (typeof db !== 'undefined' && db) ? db : 
                       (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && typeof firebase.firestore === 'function') ? firebase.firestore() : null;

    if (!firebaseDB) {
      if (typeof showToast === 'function') showToast('⚠️ Database not ready');
      return;
    }

    try {
      await updateDoc(doc(firebaseDB, "menuItems", itemId), {
        name,
        price,
        inStock,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      if (typeof showToast === 'function') showToast('🎉 Item updated successfully!', 3000);
      window.closeEditItemModal();
    } catch (err) {
      console.error('[EditItem] Firestore write failed:', err);
      const user = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
      const emailInfo = user ? ` (Logged in as: ${user.email})` : ' (Not logged in)';
      if (typeof showToast === 'function') showToast('⚠️ Update failed: ' + (err.message || err) + emailInfo, 5000);
    }
  };

  // Toggle Item Stock Function using updateDoc
  window.toggleItemStock = async function(itemId) {
    if (currentRole !== 'admin') {
      if (typeof showToast === 'function') showToast('⚠️ Only admin can change stock');
      return;
    }

    const allItems = (typeof window.items !== 'undefined') ? window.items : [];
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;

    const firebaseDB = (typeof db !== 'undefined' && db) ? db : 
                       (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && typeof firebase.firestore === 'function') ? firebase.firestore() : null;

    if (!firebaseDB) {
      if (typeof showToast === 'function') showToast('⚠️ Database not ready');
      return;
    }

    const inStock = !item.inStock;

    try {
      await updateDoc(doc(firebaseDB, "menuItems", itemId), {
        name: item.name,
        price: item.price,
        inStock: inStock
      });
      if (typeof showToast === 'function') showToast(inStock ? '✅ Marked In Stock' : '❌ Marked Out of Stock', 2000);
    } catch (err) {
      console.error('[StockToggle] Firestore update failed:', err);
      if (typeof showToast === 'function') showToast('⚠️ Could not update stock', 2500);
    }
  };

  // Delete Item Function
  window.deleteItem = async function(itemId) {
    if (currentRole !== 'admin') {
      if (typeof showToast === 'function') showToast('⚠️ Only admin can delete items');
      return;
    }
    if (!confirm('Delete this item?')) return;

    const firebaseDB = (typeof db !== 'undefined' && db) ? db : 
                       (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && typeof firebase.firestore === 'function') ? firebase.firestore() : null;

    if (!firebaseDB) {
      if (typeof showToast === 'function') showToast('⚠️ Database not ready');
      return;
    }

    try {
      await firebaseDB.collection('menuItems').doc(itemId).delete();
      if (typeof showToast === 'function') showToast('🗑️ Item deleted successfully!', 2000);
    } catch (err) {
      console.error('[DeleteItem] Firestore delete failed:', err);
      if (typeof showToast === 'function') showToast('⚠️ Could not delete item', 2500);
    }
  };

  // Add New Category Function writing directly to Firestore
  window.saveNewCategory = async function() {
    if (currentRole !== 'admin') {
      if (typeof showToast === 'function') showToast('⚠️ Only admin can add categories');
      return;
    }
    const nameInput = document.getElementById('new-cat-name');
    const emojiInput = document.getElementById('new-cat-emoji-custom');
    
    const name = nameInput ? nameInput.value.trim() : '';
    const emoji = (emojiInput && emojiInput.value.trim()) || window.selectedCatEmoji || '📂';

    if (!name) {
      if (nameInput) nameInput.focus();
      if (typeof showToast === 'function') showToast('⚠️ Enter category name');
      return;
    }

    const catId = 'cat-' + name.replace(/\s+/g, '-').toLowerCase();

    const firebaseDB = (typeof db !== 'undefined' && db) ? db : 
                       (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && typeof firebase.firestore === 'function') ? firebase.firestore() : null;

    if (!firebaseDB) {
      if (typeof showToast === 'function') showToast('⚠️ Database not ready');
      return;
    }

    try {
      await firebaseDB.collection('categories').doc(catId).set({
        id: catId,
        name: name,
        emoji: emoji,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      if (typeof showToast === 'function') showToast(`🎉 Category "${name}" added successfully!`, 3000);
      
      if (typeof closeCatModal === 'function') closeCatModal();
      if (nameInput) nameInput.value = '';
      if (emojiInput) emojiInput.value = '';
    } catch (err) {
      console.error('[AddCategory] Firestore write failed:', err);
      const user = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
      const emailInfo = user ? ` (Logged in as: ${user.email})` : ' (Not logged in)';
      if (typeof showToast === 'function') showToast('⚠️ Category save failed: ' + (err.message || err) + emailInfo, 5000);
    }
  };

  // Manage Categories Modal & Edit/Delete Operations
  window.openManageCatsModal = function() {
    const listContainer = document.getElementById('manage-cats-list');
    if (!listContainer) return;

    const allCats = (typeof window.categories !== 'undefined') ? window.categories : [];
    
    listContainer.innerHTML = allCats.map(cat => `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:var(--cream); border:1.5px solid var(--border); border-radius:12px; gap:10px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:1.3rem;">${cat.emoji}</span>
          <span style="font-weight:700; color:var(--brown); font-size:.9rem;">${cat.name}</span>
        </div>
        <div style="display:flex; gap:6px;">
          <button onclick="openEditCatModal('${cat.id}')" style="background:#eef7f2; border:1.5px solid #c8e6c9; color:var(--brown); width:32px; height:32px; border-radius:8px; cursor:pointer; font-size:.9rem; display:flex; align-items:center; justify-content:center;" title="Edit Category">✏️</button>
          <button onclick="deleteCategory('${cat.id}')" style="background:#ffebee; border:1.5px solid #ffcdd2; color:#c62828; width:32px; height:32px; border-radius:8px; cursor:pointer; font-size:.9rem; display:flex; align-items:center; justify-content:center;" title="Delete Category">🗑️</button>
        </div>
      </div>
    `).join('');

    document.getElementById('manage-cats-modal-overlay').classList.add('open');
    if (typeof window.lockBodyScroll === 'function') window.lockBodyScroll();
  };

  window.closeManageCatsModal = function() {
    const overlay = document.getElementById('manage-cats-modal-overlay');
    if (overlay) {
      overlay.classList.remove('open');
      if (typeof window.unlockBodyScroll === 'function') window.unlockBodyScroll();
    }
  };

  window.openEditCatModal = function(catId) {
    const allCats = (typeof window.categories !== 'undefined') ? window.categories : [];
    const cat = allCats.find(c => c.id === catId);
    if (!cat) return;

    document.getElementById('edit-cat-id').value = cat.id;
    document.getElementById('edit-cat-name').value = cat.name;
    document.getElementById('edit-cat-emoji-custom').value = cat.emoji;
    window.selectedEditCatEmoji = cat.emoji;

    // Render emojis in the row
    const emojiRow = document.getElementById('edit-cat-emoji-row');
    if (emojiRow) {
      const catEmojis = ['🍽','🛒','🍛','🥘','🫘','🥗','🥙','🌮','🍚','🍲','☕','🥤','🍰','🧆','🫔'];
      emojiRow.innerHTML = catEmojis.map(emoji => `
        <span class="cat-emoji-opt ${emoji === cat.emoji ? 'selected' : ''}" onclick="selectEditCatEmoji('${emoji}')">${emoji}</span>
      `).join('');
    }

    // Close manage modal first so only one modal is open
    document.getElementById('manage-cats-modal-overlay').classList.remove('open');

    document.getElementById('edit-cat-modal-overlay').classList.add('open');
  };

  window.selectEditCatEmoji = function(emoji) {
    window.selectedEditCatEmoji = emoji;
    document.querySelectorAll('#edit-cat-emoji-row .cat-emoji-opt').forEach(opt => {
      opt.classList.toggle('selected', opt.textContent === emoji);
    });
    const customInput = document.getElementById('edit-cat-emoji-custom');
    if (customInput) customInput.value = emoji;
  };

  window.closeEditCatModal = function() {
    document.getElementById('edit-cat-modal-overlay').classList.remove('open');
    // Reopen manage modal
    window.openManageCatsModal();
  };

  window.saveEditedCategory = async function() {
    if (currentRole !== 'admin') {
      if (typeof showToast === 'function') showToast('⚠️ Only admin can edit categories');
      return;
    }

    const catId = document.getElementById('edit-cat-id').value;
    const nameInput = document.getElementById('edit-cat-name');
    const emojiInput = document.getElementById('edit-cat-emoji-custom');

    const name = nameInput ? nameInput.value.trim() : '';
    const emoji = (emojiInput && emojiInput.value.trim()) || window.selectedEditCatEmoji || '📂';

    if (!name) {
      if (typeof showToast === 'function') showToast('⚠️ Category name is required');
      return;
    }

    const firebaseDB = (typeof db !== 'undefined' && db) ? db : 
                       (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && typeof firebase.firestore === 'function') ? firebase.firestore() : null;

    if (!firebaseDB) {
      if (typeof showToast === 'function') showToast('⚠️ Database not ready');
      return;
    }

    try {
      await firebaseDB.collection('categories').doc(catId).set({
        id: catId,
        name: name,
        emoji: emoji,
        deleted: false,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      if (typeof showToast === 'function') showToast('🎉 Category updated successfully!', 3000);
      document.getElementById('edit-cat-modal-overlay').classList.remove('open');
      window.openManageCatsModal();
    } catch(err) {
      console.error('[EditCategory] Firestore write failed:', err);
      if (typeof showToast === 'function') showToast('⚠️ Update failed: ' + (err.message || err), 5000);
    }
  };

  window.deleteCategory = async function(catId) {
    if (currentRole !== 'admin') {
      if (typeof showToast === 'function') showToast('⚠️ Only admin can delete categories');
      return;
    }

    const allCats = (typeof window.categories !== 'undefined') ? window.categories : [];
    const cat = allCats.find(c => c.id === catId);
    if (!cat) return;

    if (!confirm(`⚠️ Are you sure you want to delete the category "${cat.name}"?\nItems in this category will remain, but won't belong to any category on the menu.`)) {
      return;
    }

    const firebaseDB = (typeof db !== 'undefined' && db) ? db : 
                       (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && typeof firebase.firestore === 'function') ? firebase.firestore() : null;

    if (!firebaseDB) {
      if (typeof showToast === 'function') showToast('⚠️ Database not ready');
      return;
    }

    const defaultIds = ['vegetables', 'fruits', 'dairy', 'grocery', 'leafy', 'snacks', 'beverages'];

    try {
      if (defaultIds.includes(catId)) {
        // For default categories, mark as deleted in Firestore
        await firebaseDB.collection('categories').doc(catId).set({
          id: catId,
          deleted: true,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } else {
        // For custom categories, delete the document entirely
        await firebaseDB.collection('categories').doc(catId).delete();
      }

      if (typeof showToast === 'function') showToast('🗑️ Category deleted successfully!', 2000);
      window.openManageCatsModal();
    } catch(err) {
      console.error('[DeleteCategory] Firestore delete failed:', err);
      if (typeof showToast === 'function') showToast('⚠️ Delete failed: ' + (err.message || err), 2500);
    }
  };

  // ── 4. FAILSURE / ENHANCE ADMIN PANEL UI ───────────────────────────────
  function enhanceManageListWithEditButtons() {
    const container = document.getElementById('manage-items-list');
    if (!container) return;

    const cards = container.querySelectorAll('.mng-card');
    cards.forEach(card => {
      const delBtn = card.querySelector('.mng-del');
      if (!delBtn) return;

      const onclickStr = delBtn.getAttribute('onclick') || '';
      const match = onclickStr.match(/deleteItem\(['"]([^'"]+)['"]\)/);
      if (!match) return;
      
      const itemId = match[1];

      if (card.querySelector('.mng-edit')) return;

      const actions = card.querySelector('.mng-actions');
      if (!actions) return;

      const editBtn = document.createElement('button');
      editBtn.className = 'mng-edit';
      editBtn.innerHTML = '✏️';
      editBtn.title = 'Edit Item';
      editBtn.setAttribute('style', 'background: #eef7f2; border: 1.5px solid #c8e6c9; color: var(--brown); width: 30px; height: 30px; border-radius: 8px; cursor: pointer; font-size: .8rem; display: flex; align-items: center; justify-content: center; transition: all .2s;');

      editBtn.onmouseenter = function() {
        editBtn.style.background = 'var(--saffron)';
        editBtn.style.color = '#fff';
        editBtn.style.transform = 'scale(1.05)';
      };
      editBtn.onmouseleave = function() {
        editBtn.style.background = '#eef7f2';
        editBtn.style.color = 'var(--brown)';
        editBtn.style.transform = 'scale(1)';
      };

      editBtn.onclick = function(e) {
        e.stopPropagation();
        window.openEditItemModal(itemId);
      };

      actions.insertBefore(editBtn, delBtn);
    });
  }

  function setupFailsafeEnhancer() {
    const manageList = document.getElementById('manage-items-list');
    if (!manageList) {
      setTimeout(setupFailsafeEnhancer, 300);
      return;
    }

    const observer = new MutationObserver(function() {
      enhanceManageListWithEditButtons();
    });
    observer.observe(manageList, { childList: true, subtree: true });

    setInterval(enhanceManageListWithEditButtons, 500);
    enhanceManageListWithEditButtons();
  }

  // ── 5. REALTIME SNAPSHOT LISTENERS ─────────────────────────────────────
  const defaultCategories = [
    { id: 'vegetables', name: 'Vegetables', emoji: '🥦' },
    { id: 'fruits', name: 'Fruits', emoji: '🍎' },
    { id: 'dairy', name: 'Dairy', emoji: '🥛' },
    { id: 'grocery', name: 'Grocery', emoji: '🌾' },
    { id: 'leafy', name: 'Leafy', emoji: '🥬' },
    { id: 'snacks', name: 'Snacks', emoji: '🍿' },
    { id: 'beverages', name: 'Beverages', emoji: '🥤' }
  ];

  function startCategoriesSync(firebaseDB) {
    console.log('[FirestoreSync] Initializing realtime categories sync listener...');

    onSnapshot(collection(firebaseDB, "categories"), (snapshot) => {
      try {
        const loadedCats = [];
        if (snapshot && !snapshot.empty) {
          snapshot.forEach(doc => {
            const data = doc.data();
            loadedCats.push({
              id: doc.id,
              name: data.name || '',
              emoji: data.emoji || '📂',
              deleted: data.deleted === true
            });
          });
        }

        const mergedCats = defaultCategories.map(dc => {
          const matched = loadedCats.find(lc => lc.id === dc.id);
          return matched ? matched : dc;
        }).filter(cat => {
          const matched = loadedCats.find(lc => lc.id === cat.id);
          return !(matched && matched.deleted === true);
        });
        loadedCats.forEach(lc => {
          if (lc.deleted !== true && !mergedCats.some(mc => mc.id === lc.id)) {
            mergedCats.push(lc);
          }
        });

        // Update arrays in-place to preserve references
        if (typeof categories !== 'undefined' && Array.isArray(categories)) {
          categories.length = 0;
          mergedCats.forEach(c => categories.push(c));
        }
        if (typeof window.categories !== 'undefined' && Array.isArray(window.categories)) {
          window.categories.length = 0;
          mergedCats.forEach(c => window.categories.push(c));
        }

        // Update Add Item Dropdown
        const aipCat = document.getElementById('aip-cat');
        if (aipCat) {
          const currentVal = aipCat.value;
          aipCat.innerHTML = mergedCats.map(cat => 
            `<option value="${cat.id}">${cat.emoji} ${cat.name}</option>`
          ).join('');
          if (currentVal && mergedCats.some(c => c.id === currentVal)) {
            aipCat.value = currentVal;
          }
        }

        // Update Edit Item Dropdown (dynamic on load anyway but good for live feedback)
        const editItemCat = document.getElementById('edit-item-cat');
        if (editItemCat) {
          const currentVal = editItemCat.value;
          editItemCat.innerHTML = mergedCats.map(cat => 
            `<option value="${cat.id}">${cat.emoji} ${cat.name}</option>`
          ).join('');
          if (currentVal && mergedCats.some(c => c.id === currentVal)) {
            editItemCat.value = currentVal;
          }
        }

        // Refresh UI
        if (typeof renderMenuPage === 'function') renderMenuPage(window._currentMenuFilter || 'all');
        if (typeof refreshManageList === 'function') refreshManageList();
        if (typeof renderManagePage === 'function') renderManagePage();

      } catch (err) {
        console.error('[FirestoreSync] Categories sync apply error:', err);
      }
    }, (error) => {
      console.error('[FirestoreSync] Categories listener error:', error);
    });
  }

  function startRealtimeSync() {
    const firebaseDB = (typeof db !== 'undefined' && db) ? db : 
                       (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && typeof firebase.firestore === 'function') ? firebase.firestore() : null;

    if (!firebaseDB) {
      setTimeout(startRealtimeSync, 500);
      return;
    }

    // Start category realtime sync
    startCategoriesSync(firebaseDB);

    console.log('[FirestoreSync] Initializing realtime menuItems sync listener...');

    onSnapshot(collection(firebaseDB, "menuItems"), (snapshot) => {
      try {
        if (!snapshot) return;

        console.log('[FirestoreSync] Realtime menu update received. Documents count:', snapshot.size);

        const firestoreItems = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          const category = data.category || 'grocery';
          
          firestoreItems.push({
            id: doc.id,
            name: data.name || '',
            price: Number(data.price) || 0,
            category: category,
            catId: category, // compatibility catId mapping
            inStock: data.inStock !== false,
            emoji: data.emoji || '🍎',
            description: data.description || '',
            type: data.description || '', // backward compatible description holder
            rating: typeof data.rating === 'number' ? data.rating : 5.0,
            ratingCount: typeof data.ratingCount === 'number' ? data.ratingCount : 5,
            image: data.image || '',
            discount: Number(data.discount) || 0
          });
        });

        // Update items arrays in-place to preserve application references
        if (Array.isArray(window.items)) {
          window.items.length = 0;
          firestoreItems.forEach(item => window.items.push(item));
        }
        if (Array.isArray(window.menuItems)) {
          window.menuItems.length = 0;
          firestoreItems.forEach(item => window.menuItems.push(item));
        }
        if (Array.isArray(window.allItems)) {
          window.allItems.length = 0;
          firestoreItems.forEach(item => window.allItems.push(item));
        }
        if (Array.isArray(window.products)) {
          window.products.length = 0;
          firestoreItems.forEach(item => window.products.push(item));
        }
        if (Array.isArray(window.menuData)) {
          window.menuData.length = 0;
          firestoreItems.forEach(item => window.menuData.push(item));
        }

        // Sync active cart in case of out of stock or price changes
        if (window.cart) {
          Object.keys(window.cart).forEach(itemId => {
            const matched = firestoreItems.find(i => i.id === itemId);
            if (matched) {
              if (!matched.inStock) {
                delete window.cart[itemId];
              } else {
                window.cart[itemId].name = matched.name;
                window.cart[itemId].price = matched.price;
              }
            }
          });
        }

        // Instantly refresh UI components
        if (typeof window.refreshInventoryUI === 'function') {
          window.refreshInventoryUI();
        } else {
          if (typeof renderMenuPage === 'function') renderMenuPage(window._currentMenuFilter || 'all');
          if (typeof refreshManageList === 'function') refreshManageList();
          if (typeof updateCart === 'function') updateCart();
        }

        console.log('[FirestoreSync] Customer & Admin UI updated instantly');

      } catch (err) {
        console.error('[FirestoreSync] Realtime sync apply error:', err);
      }
    }, (error) => {
      console.error('[FirestoreSync] Realtime menuItems collection listener error:', error);
    });
  }

  // Bootstrap execution
  function init() {
    injectEditItemModal();
    setupFailsafeEnhancer();
    startRealtimeSync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

})();

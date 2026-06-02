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

  console.log('[RazorpayUPI] 🚀 Live Razorpay checkout loaded — Key: rzp_live_SmqN...');
})();

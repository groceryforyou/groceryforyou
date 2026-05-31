// WebView patch for Grocery For You APK
(function() {
  // Run fix now and after delays for late-loading content
  [0, 500, 1500, 3000].forEach(function(delay) {
    setTimeout(fix, delay);
  });

  function fix() {
    // Watch for class changes on ALL elements
    if (!window.__gfyPatchObserver) {
      window.__gfyPatchObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(m) {
          var el = m.target;
          var cls = (el.className || '').toLowerCase();
          // Sidebar/drawer opened
          if (/sidebar|drawer|nav|menu|offcanvas/i.test(cls)) {
            if (/open|active|show|visible|expanded/i.test(cls)) {
              el.style.setProperty('display', 'block', 'important');
              el.style.setProperty('transform', 'none', 'important');
              el.style.setProperty('opacity', '1', 'important');
              el.style.setProperty('visibility', 'visible', 'important');
              el.style.setProperty('pointer-events', 'auto', 'important');
              el.style.setProperty('z-index', '99999', 'important');
              el.style.setProperty('overflow-y', 'auto', 'important');
              el.style.setProperty('-webkit-overflow-scrolling', 'touch', 'important');
            }
          }
          // Cart opened
          if (/cart|basket/i.test(cls)) {
            el.style.setProperty('display', 'block', 'important');
            el.style.setProperty('visibility', 'visible', 'important');
            el.style.setProperty('pointer-events', 'auto', 'important');
            el.style.setProperty('max-height', 'none', 'important');
            el.style.setProperty('overflow-y', 'auto', 'important');
          }
          // Unlock body if no menu open
          if (el === document.body) {
            var menuOpen = document.querySelector(
              '[class*=open],[class*=active],[class*=show]'
            );
            if (!menuOpen) {
              el.style.overflow = '';
              el.style.position = '';
              el.style.top = '';
            }
          }
        });
      });
      window.__gfyPatchObserver.observe(document.documentElement, {
        attributes: true,
        subtree: true,
        attributeFilter: ['class', 'style']
      });
    }

    // Force pointer-events on all interactive elements
    document.querySelectorAll(
      'button, .btn, [role="button"], [onclick], a, ' +
      '[class*="order"], [class*="cart"], [class*="checkout"], ' +
      '[class*="menu"], [class*="toggle"]'
    ).forEach(function(el) {
      el.style.setProperty('pointer-events', 'auto', 'important');
      el.style.setProperty('touch-action', 'manipulation', 'important');
    });
  }
})();

/**
 * Grocery For You - Android WebView Compatibility Patch (JavaScript)
 * 
 * Load this script inside your website's index.html inside the <head> tag
 * to ensure maximum interaction speed, smooth scrolling, and bulletproof event execution
 * when running inside the Android WebView APK, while preserving normal browser behavior.
 */
(function() {
    'use strict';

    // 1. Detect if the website is running inside the Android WebView APK
    var userAgent = navigator.userAgent || navigator.vendor || window.opera;
    var isWebView = /wv|Android.*Version\/[0-9.]+/i.test(userAgent) || (window.AndroidInterface !== undefined);
    
    // Attach status to window for site-wide access
    window.isAndroidWebView = isWebView;

    if (isWebView) {
        console.log("Grocery For You: WebView Environment Detected. Activating Compatibility Patches...");

        // Add a helper class to body for targeted WebView styling/fixing
        document.addEventListener("DOMContentLoaded", function() {
            document.body.classList.add("is-android-webview");
            
            // Re-apply viewport configurations in case they were altered
            var viewport = document.querySelector('meta[name="viewport"]');
            if (viewport) {
                viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
            }
        });

        // 2. Safe Local/Session Storage Wrapper
        // Prevents the website from freezing or crashing if strict security filters
        // temporarily block DOM storage access.
        try {
            var storageTest = window.localStorage;
            storageTest.setItem('__webview_test__', '1');
            storageTest.removeItem('__webview_test__');
        } catch (e) {
            console.warn("localStorage not fully accessible. Polyfilling for WebView session stability...");
            
            // Temporary memory storage polyfill to prevent JavaScript crashes
            var memoryStorage = {};
            var storagePolyfill = {
                getItem: function(key) { return memoryStorage[key] || null; },
                setItem: function(key, val) { memoryStorage[key] = String(val); },
                removeItem: function(key) { delete memoryStorage[key]; },
                clear: function() { memoryStorage = {}; },
                key: function(i) { return Object.keys(memoryStorage)[i] || null; },
                get length() { return Object.keys(memoryStorage).length; }
            };
            
            Object.defineProperty(window, 'localStorage', { value: storagePolyfill, writable: true });
            Object.defineProperty(window, 'sessionStorage', { value: storagePolyfill, writable: true });
        }

        // 3. Fast Click / Touch Action optimization
        // Instead of overriding touch events which might conflict with React/Vue synthetic events,
        // we add custom styling flags to prevent click delays.
        document.addEventListener("DOMContentLoaded", function() {
            // Apply touch-action manipulation to all buttons and links
            var interactiveElements = document.querySelectorAll("button, a, .hamburger-menu, .cart-btn, .place-order, .payment-btn");
            interactiveElements.forEach(function(el) {
                el.style.touchAction = "manipulation";
            });
        });

        // 4. Prevent Window Open block fallback
        // If external JavaScript scripts (e.g. payment platforms) attempt to use window.open
        // and it gets caught by WebView window controls, redirect gracefully.
        var originalWindowOpen = window.open;
        window.open = function(url, target, features) {
            if (url) {
                console.log("WebView Patch: Redirecting window.open to location.href for URL: " + url);
                window.location.href = url;
                return window;
            }
            return originalWindowOpen.apply(this, arguments);
        };
    }
})();

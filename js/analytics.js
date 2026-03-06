/**
 * KollabX Analytics Helper
 * Wraps gtag() calls with consent checking.
 * Only fires events if the user has accepted cookies.
 */

const KX_ANALYTICS_CONSENT_KEY = 'kollabx_cookie_consent';

function trackEvent(eventName, params = {}) {
    try {
        const consent = localStorage.getItem(KX_ANALYTICS_CONSENT_KEY);
        if (consent !== 'accepted') return;
        if (typeof gtag !== 'function') return;

        gtag('event', eventName, params);
    } catch (e) {
        // Silently fail — analytics should never break the app
    }
}

// Export globally
window.kxAnalytics = { trackEvent };

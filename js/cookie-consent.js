/**
 * KollabX Cookie Consent Banner
 * GDPR-compliant: GA4 only loads after user accepts.
 */

(function () {
    const CONSENT_KEY = 'kollabx_cookie_consent';
    const GA_ID = 'G-Z73KBZEV44';

    function getConsent() {
        return localStorage.getItem(CONSENT_KEY);
    }

    function setConsent(value) {
        localStorage.setItem(CONSENT_KEY, value);
    }

    function loadGA() {
        // Avoid double-loading
        if (document.querySelector('script[src*="googletagmanager.com/gtag"]')) return;

        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
        document.head.appendChild(script);

        window.dataLayer = window.dataLayer || [];
        function gtag() { dataLayer.push(arguments); }
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', GA_ID);
    }

    function createBanner() {
        const banner = document.createElement('div');
        banner.id = 'cookie-consent-banner';
        banner.setAttribute('role', 'dialog');
        banner.setAttribute('aria-label', 'Cookie consent');
        banner.innerHTML = `
      <div class="cookie-consent-inner">
        <div class="cookie-consent-text">
          <i data-lucide="cookie" class="cookie-icon"></i>
          <div>
            <p class="cookie-title">We value your privacy</p>
            <p class="cookie-desc">We use cookies to analyze traffic and improve your experience. You can accept or decline analytics cookies.</p>
          </div>
        </div>
        <div class="cookie-consent-actions">
          <button id="cookie-decline" class="cookie-btn cookie-btn-decline">Decline</button>
          <button id="cookie-accept" class="cookie-btn cookie-btn-accept">Accept</button>
        </div>
      </div>
    `;
        document.body.appendChild(banner);

        // Initialize lucide icon if available
        if (window.lucide) {
            try { lucide.createIcons({ nodes: [banner] }); } catch (e) { /* ignore */ }
        }

        // Animate in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                banner.classList.add('visible');
            });
        });

        document.getElementById('cookie-accept').addEventListener('click', () => {
            setConsent('accepted');
            closeBanner(banner);
            loadGA();
        });

        document.getElementById('cookie-decline').addEventListener('click', () => {
            setConsent('declined');
            closeBanner(banner);
        });
    }

    function closeBanner(banner) {
        banner.classList.remove('visible');
        banner.classList.add('hiding');
        banner.addEventListener('transitionend', () => banner.remove(), { once: true });
        // Fallback removal
        setTimeout(() => { if (banner.parentNode) banner.remove(); }, 500);
    }

    // --- Init ---
    function init() {
        const consent = getConsent();
        if (consent === 'accepted') {
            loadGA();
        } else if (!consent) {
            // No decision yet — show banner after a short delay for better UX
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => setTimeout(createBanner, 800));
            } else {
                setTimeout(createBanner, 800);
            }
        }
        // If 'declined', do nothing
    }

    init();
})();

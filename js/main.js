/* Main JS */
document.addEventListener('DOMContentLoaded', () => {

    const navItems = document.querySelectorAll('.nav-item');
    const indicator = document.querySelector('.nav-indicator');
    const navList = document.querySelector('.nav-links');

    function moveIndicator(element, disableTransition = false) {
        if (!element || !indicator || !navList) return;

        // Skip if the element or its parent is hidden (auth-only not yet visible)
        const li = element.closest('li');
        if (li && (li.offsetParent === null || getComputedStyle(li).display === 'none')) {
            indicator.style.opacity = '0';
            return;
        }

        if (disableTransition) {
            indicator.style.transition = 'none';
        }

        const navListRect = navList.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();

        const left = elementRect.left - navListRect.left;
        const width = elementRect.width;

        indicator.style.width = `${width}px`;
        indicator.style.transform = `translateX(${left}px)`;
        indicator.style.opacity = '1';

        if (disableTransition) {
            // Force reflow
            void indicator.offsetWidth;
            // Restore transition
            setTimeout(() => {
                indicator.style.transition = '';
            }, 50);
        }
    }

    // Find the active link based on current URL
    function getActiveLink() {
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        let link = document.querySelector(`.nav-item[href="${currentPath}"]`);

        // Fallback for root path
        if (!link && (currentPath === '' || currentPath === '/')) {
            link = document.querySelector('.nav-item[href="index.html"]');
        }

        return link;
    }

    // Position indicator — called on load and whenever auth state changes
    function positionIndicator(disableTransition = false) {
        const activeLink = getActiveLink();

        // Reset all nav item colors
        navItems.forEach(item => {
            item.style.color = '';
        });

        if (activeLink) {
            activeLink.style.color = 'var(--primary-color)';
            moveIndicator(activeLink, disableTransition);
        } else {
            // Current page is not in the nav (profile, portfolio, chat, etc.)
            if (indicator) {
                indicator.style.opacity = '0';
            }
        }
    }

    // Initial positioning (no transition)
    positionIndicator(true);

    // Reposition after auth UI updates show/hide nav items
    // Uses a MutationObserver on the nav list watching for style/display changes
    if (navList) {
        const observer = new MutationObserver(() => {
            // Small delay to let DOM settle after auth changes
            setTimeout(() => positionIndicator(true), 50);
        });
        observer.observe(navList, { attributes: true, subtree: true, attributeFilter: ['style'] });
    }

    // Reposition on window resize (layout may shift)
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => positionIndicator(true), 100);
    });

    // We only set the indicator once based on the current URL.
    // Clicks no longer animate the indicator, avoiding the brief “jump” before navigation.

    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Mobile menu toggle
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navLinksMenu = document.querySelector('.nav-links');
    const mobileOverlay = document.querySelector('.mobile-overlay');

    if (mobileMenuToggle && navLinksMenu) {
        mobileMenuToggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const isActive = navLinksMenu.classList.contains('active');

            navLinksMenu.classList.toggle('active');
            mobileMenuToggle.classList.toggle('active');
            if (mobileOverlay) {
                mobileOverlay.classList.toggle('active');
            }
            mobileMenuToggle.setAttribute('aria-expanded', !isActive);

            // Prevent body scroll when menu is open
            if (!isActive) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        });

        // Close menu when clicking overlay
        if (mobileOverlay) {
            mobileOverlay.addEventListener('click', () => {
                navLinksMenu.classList.remove('active');
                mobileMenuToggle.classList.remove('active');
                mobileOverlay.classList.remove('active');
                mobileMenuToggle.setAttribute('aria-expanded', 'false');
                document.body.style.overflow = '';
            });
        }



        // Close menu on window resize (if resizing to desktop)
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                navLinksMenu.classList.remove('active');
                mobileMenuToggle.classList.remove('active');
                if (mobileOverlay) {
                    mobileOverlay.classList.remove('active');
                }
                mobileMenuToggle.setAttribute('aria-expanded', 'false');
                document.body.style.overflow = '';
            }
        });
    }
});

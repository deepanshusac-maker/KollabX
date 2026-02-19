/* Main JS */
document.addEventListener('DOMContentLoaded', () => {
    console.log('Kollabx Main JS Loaded');

    const navItems = document.querySelectorAll('.nav-item');
    const indicator = document.querySelector('.nav-indicator');
    const navList = document.querySelector('.nav-links');

    function moveIndicator(element, disableTransition = false) {
        if (!element || !indicator || !navList) return;

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

    // Initialize position based on active link (if any) or current URL
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    let activeLink = document.querySelector(`.nav-item[href="${currentPath}"]`);

    // Fallback for root path
    if (!activeLink && (currentPath === '' || currentPath === '/')) {
        activeLink = document.querySelector('.nav-item[href="index.html"]');
    }

    // Only set active state on page load based on URL or click
    // Hover effects are removed per user request
    if (activeLink) {
        activeLink.style.color = 'var(--primary-color)';
        // Call immediately with transition disabled to avoid "double animation"
        moveIndicator(activeLink, true);
    }

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

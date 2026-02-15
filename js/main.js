/* Main JS */
document.addEventListener('DOMContentLoaded', () => {
    console.log('Kollabx Main JS Loaded');

    const navLinks = document.querySelectorAll('.nav-item');
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

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // Allow opening in new tab/window without delay
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

            e.preventDefault();
            const targetUrl = link.getAttribute('href');

            // Animate to clicked link
            moveIndicator(e.target);
            link.style.color = 'var(--primary-color)';

            // Reset others
            navLinks.forEach(l => {
                if (l !== link) l.style.color = 'var(--text-color)';
            });

            // Delay navigation to show animation
            setTimeout(() => {
                window.location.href = targetUrl;
            }, 350); // Slightly longer than CSS transition (0.3s)
        });
    });
    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
});

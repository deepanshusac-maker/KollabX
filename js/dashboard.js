
// Dashboard Animations
const dashboardAnimations = {
    /**
     * Animates a numerical value with a "scramble" effect
     * @param {HTMLElement} element - The element to animate
     * @param {number} targetValue - The final value to reach
     * @param {number} duration - Duration of the animation in ms
     */
    animateStatValue(element, targetValue, duration = 1000) {
        if (!element) return;

        const startTimestamp = performance.now();
        const target = parseInt(targetValue) || 0;

        const step = (timestamp) => {
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);

            if (progress < 1) {
                // Scramble effect: show random numbers before settling
                const randomValue = Math.floor(Math.random() * (target + 10));
                element.textContent = randomValue;
                requestAnimationFrame(step);
            } else {
                element.textContent = target;
            }
        };

        requestAnimationFrame(step);
    }
};

window.dashboardAnimations = dashboardAnimations;

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-item');
    const cards = document.querySelectorAll('.horizontal-card');
    const statsGrid = document.querySelector('.stats-grid');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab UI
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const category = tab.getAttribute('data-tab');

            // Show/Hide stats grid: Only show in "all" section
            if (statsGrid) {
                if (category === 'all') {
                    statsGrid.style.display = 'grid';
                } else {
                    statsGrid.style.display = 'none';
                }
            }

            // Filter cards
            cards.forEach(card => {
                if (category === 'all') {
                    card.style.display = 'flex';
                } else if (card.getAttribute('data-category') === category) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });

    // Handle initial tab selection from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam) {
        const targetTab = document.querySelector(`.tab-item[data-tab="${tabParam}"]`);
        if (targetTab) {
            targetTab.click();
        }
    }
});

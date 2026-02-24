
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

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab UI
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const category = tab.getAttribute('data-tab');

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
});

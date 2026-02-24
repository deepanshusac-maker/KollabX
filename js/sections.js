// Sections JavaScript - FAQ Accordion & Scroll Animations

// FAQ Accordion
document.addEventListener('DOMContentLoaded', () => {
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');

        question.addEventListener('click', () => {
            // Close other items
            faqItems.forEach(otherItem => {
                if (otherItem !== item && otherItem.classList.contains('active')) {
                    otherItem.classList.remove('active');
                }
            });

            // Toggle current item
            item.classList.toggle('active');
        });
    });

    // Scroll Animations - Intersection Observer
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
            }
        });
    }, observerOptions);

    // Observe all scroll-animated elements
    const animateElements = document.querySelectorAll('.fade-in-up, .fade-in-left, .fade-in-right, .kx-timeline-item');
    animateElements.forEach(el => {
        observer.observe(el);
    });

    // Initialize Lucide Icons
    if (window.lucide) {
        lucide.createIcons();
    }
});

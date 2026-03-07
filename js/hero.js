/* Split Text Animation Logic */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Split Headline (Characters)
    const heading = document.querySelector('.split-text-heading');
    if (heading) {
        const text = heading.textContent;
        heading.textContent = '';
        const chars = text.split('');

        chars.forEach((char, index) => {
            const span = document.createElement('span');
            span.textContent = char === ' ' ? '\u00A0' : char; // Preserve spaces
            span.className = 'split-char';
            span.style.animationDelay = `${index * 0.03}s`; // Stagger 30ms
            heading.appendChild(span);
        });
    }

    // 2. Split Subheading (Words)
    const subHeading = document.querySelector('.hero-subtitle');
    if (subHeading) {
        const text = subHeading.innerHTML.trim(); /* InnerHTML preserves line breaks if any, though words split by space */
        const plainText = subHeading.innerText.trim();
        subHeading.textContent = '';
        const words = plainText.split(/\s+/); /* Split by whitespace */

        words.forEach((word, index) => {
            const span = document.createElement('span');
            span.textContent = word + ' '; // Add space back
            span.className = 'split-word';
            span.style.display = 'inline-block'; // Ensure transforms work
            span.style.animationDelay = `${0.3 + (index * 0.05)}s`; // Start after heading, stagger 50ms
            subHeading.appendChild(span);
        });
    }

    // 3. Pause Background Video When Out of View (CPU Optimization)
    const heroVideo = document.querySelector('.hero-video-bg');
    if (heroVideo) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Play video when visible
                    heroVideo.play().catch(e => console.warn('Video auto-play suppressed:', e));
                } else {
                    // Pause video to save CPU/GPU when user scrolls down
                    heroVideo.pause();
                }
            });
        }, {
            // Trigger when even a small part of the video is still visible or just hidden
            threshold: 0,
            rootMargin: "50px"
        });

        // Ensure video has a wrapping element or observe the video itself
        // The .hero section is a good container to observe, or the video itself
        const heroSection = document.querySelector('.hero');
        if (heroSection) {
            observer.observe(heroSection);
        } else {
            observer.observe(heroVideo);
        }
    }
});

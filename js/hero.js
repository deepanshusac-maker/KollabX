/* Split Text Animation Logic */
document.addEventListener('DOMContentLoaded', () => {
    // Optimization: Removed JS character/word splitting to prevent DOM bloat (30+ nodes)
    // The CSS animation will now handle the whole text block instead.
    const heading = document.querySelector('.split-text-heading');
    if (heading) {
        // Just ensure it's visible, CSS handles the fade-in
        heading.style.opacity = '1';
        heading.classList.add('animate-heading');
    }

    const subHeading = document.querySelector('.hero-subtitle');
    if (subHeading) {
        subHeading.style.opacity = '1';
        subHeading.classList.add('animate-subheading');
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

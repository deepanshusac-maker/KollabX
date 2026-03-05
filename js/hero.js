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
});

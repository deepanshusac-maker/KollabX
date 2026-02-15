/* Smoke Animation JS - Light Theme */
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('smokeCanvas');
    if (!canvas) {
        console.error('Smoke canvas not found!');
        return;
    }

    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }

    window.addEventListener('resize', resize);
    resize();

    class SmokeParticle {
        constructor() {
            this.reset(true);
        }

        reset(initial = false) {
            this.x = Math.random() * width;
            this.y = initial ? Math.random() * height : height + Math.random() * 100;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = -(Math.random() * 0.5 + 0.2); // Faster upward movement
            this.size = Math.random() * 150 + 100;
            this.alpha = 0;
            this.targetAlpha = Math.random() * 0.15 + 0.05; // Lower opacity for dark smoke
            this.life = Math.random() * 2000 + 1000;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            // Fade in/out logic
            if (this.alpha < this.targetAlpha && this.y > height * 0.8) {
                this.alpha += 0.005;
            }
            if (this.y < height * 0.2) {
                this.alpha -= 0.005;
            }

            if (this.alpha <= 0 && this.y < height * 0.5) {
                this.reset();
            } else if (this.y < -this.size) {
                this.reset();
            }
        }

        draw() {
            ctx.save();
            ctx.globalAlpha = Math.max(0, this.alpha);

            // Gray/Dark smoke for Light Background
            const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0.2)'); // Dark center
            gradient.addColorStop(0.5, 'rgba(100, 100, 100, 0.05)'); // Grey mid
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)'); // Transparent edge

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    function init() {
        particles = [];
        const count = 80;
        for (let i = 0; i < count; i++) {
            particles.push(new SmokeParticle());
        }
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);
        // Standard blending (multiply not strictly needed if using rgba correctly, but source-over is fine)
        ctx.globalCompositeOperation = 'source-over';

        particles.forEach(p => {
            p.update();
            p.draw();
        });

        requestAnimationFrame(animate);
    }

    init();
    animate();
});

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

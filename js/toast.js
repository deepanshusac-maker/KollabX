// Toast Notification System
// Provides elegant, non-intrusive notifications for user actions

(function() {
    'use strict';

    // Toast container (created once)
    let toastContainer = null;

    // Initialize toast container
    function initToastContainer() {
        if (toastContainer) return toastContainer;

        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        toastContainer.setAttribute('aria-live', 'polite');
        toastContainer.setAttribute('aria-atomic', 'true');
        document.body.appendChild(toastContainer);
        return toastContainer;
    }

    // Create a toast notification
    function createToast(message, type = 'success', duration = 4000) {
        initToastContainer();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');

        // Icon based on type
        let icon = '';
        switch(type) {
            case 'success':
                icon = '<i data-lucide="check-circle"></i>';
                break;
            case 'error':
                icon = '<i data-lucide="x-circle"></i>';
                break;
            case 'info':
                icon = '<i data-lucide="info"></i>';
                break;
            case 'warning':
                icon = '<i data-lucide="alert-triangle"></i>';
                break;
            default:
                icon = '<i data-lucide="bell"></i>';
        }

        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">
                <p class="toast-message">${escapeHtml(message)}</p>
            </div>
            <button class="toast-close" aria-label="Close notification">
                <i data-lucide="x"></i>
            </button>
        `;

        // Add to container
        toastContainer.appendChild(toast);

        // Initialize Lucide icons
        if (window.lucide) {
            lucide.createIcons();
        }

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('toast-show');
        });

        // Close button handler
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            removeToast(toast);
        });

        // Auto-remove after duration
        if (duration > 0) {
            setTimeout(() => {
                removeToast(toast);
            }, duration);
        }

        return toast;
    }

    // Remove toast with animation
    function removeToast(toast) {
        if (!toast || !toast.parentNode) return;

        toast.classList.remove('toast-show');
        toast.classList.add('toast-hide');

        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 300); // Match CSS animation duration
    }

    // Escape HTML helper
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Public API
    window.toast = {
        success: (message, duration) => createToast(message, 'success', duration),
        error: (message, duration) => createToast(message, 'error', duration),
        info: (message, duration) => createToast(message, 'info', duration),
        warning: (message, duration) => createToast(message, 'warning', duration),
        show: (message, type, duration) => createToast(message, type, duration)
    };

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initToastContainer);
    } else {
        initToastContainer();
    }
})();

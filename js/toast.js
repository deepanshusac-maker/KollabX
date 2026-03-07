// Toast Notification System
// Provides elegant, non-intrusive notifications for user actions

(function () {
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
        switch (type) {
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

        // Initialize Lucide icons (scoped to this toast only)
        if (window.lucide) {
            lucide.createIcons({ nodes: [toast] });
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

    // Create a confirmation modal dialog
    function createConfirm(message, onConfirm, onCancel = null, options = {}) {
        const { confirmText = 'Confirm', cancelText = 'Cancel', type = 'warning' } = options;

        // Modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'toast-modal-overlay';

        let iconHtml = '';
        if (type === 'danger' || type === 'warning') {
            iconHtml = '<i data-lucide="alert-triangle" style="color: #ef4444; width: 32px; height: 32px; margin-bottom: 12px; display: block;"></i>';
        } else {
            iconHtml = '<i data-lucide="info" style="color: #3b82f6; width: 32px; height: 32px; margin-bottom: 12px; display: block;"></i>';
        }

        const modal = document.createElement('div');
        modal.className = 'toast-modal';
        modal.innerHTML = `
            <div class="toast-modal-content">
                ${iconHtml}
                <div class="toast-modal-message">${escapeHtml(message)}</div>
                <div class="toast-modal-actions">
                    <button class="btn-cancel">${escapeHtml(cancelText)}</button>
                    <button class="btn-confirm ${type === 'danger' || type === 'warning' ? 'btn-danger' : 'btn-primary'}">${escapeHtml(confirmText)}</button>
                </div>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        if (window.lucide) {
            lucide.createIcons({ nodes: [overlay] });
        }

        // Animate in
        requestAnimationFrame(() => {
            overlay.classList.add('toast-modal-show');
            modal.classList.add('toast-modal-show');
        });

        // Cleanup function
        const closeBox = () => {
            overlay.classList.remove('toast-modal-show');
            modal.classList.remove('toast-modal-show');
            setTimeout(() => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }, 300);
        };

        // Event listeners
        const btnCancel = modal.querySelector('.btn-cancel');
        const btnConfirm = modal.querySelector('.btn-confirm');

        btnCancel.addEventListener('click', () => {
            closeBox();
            if (onCancel) onCancel();
        });

        btnConfirm.addEventListener('click', () => {
            closeBox();
            if (onConfirm) onConfirm();
        });

        // Optional clicking outside cancels
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeBox();
                if (onCancel) onCancel();
            }
        });
    }

    // Public API
    window.toast = {
        success: (message, duration) => createToast(message, 'success', duration),
        error: (message, duration) => createToast(message, 'error', duration),
        info: (message, duration) => createToast(message, 'info', duration),
        warning: (message, duration) => createToast(message, 'warning', duration),
        show: (message, type, duration) => createToast(message, type, duration),
        confirm: createConfirm
    };

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initToastContainer);
    } else {
        initToastContainer();
    }
})();

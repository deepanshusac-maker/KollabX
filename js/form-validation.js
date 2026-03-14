/* Form Validation and Feedback Utility */

// Validation rules
const validators = {
    required: (value) => {
        if (!value || value.trim() === '') {
            return 'This field is required';
        }
        return null;
    },
    email: (value) => {
        if (!value) return null; // Let required handle empty
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            return 'Please enter a valid email address';
        }
        return null;
    },
    minLength: (min) => (value) => {
        if (!value) return null;
        if (value.length < min) {
            return `Must be at least ${min} characters`;
        }
        return null;
    },
    url: (value) => {
        if (!value) return null;
        try {
            new URL(value);
            return null;
        } catch {
            return 'Please enter a valid URL';
        }
    },
    number: (value) => {
        if (!value) return null;
        if (isNaN(value) || value <= 0) {
            return 'Please enter a valid positive number';
        }
        return null;
    },
    minNumber: (min) => (value) => {
        if (!value) return null;
        const num = parseFloat(value);
        if (isNaN(num) || num < min) {
            return `Must be at least ${min}`;
        }
        return null;
    },
    matchField: (targetId, message) => (value) => {
        if (!value) return null;
        const targetField = document.getElementById(targetId);
        if (targetField && value !== targetField.value) {
            return message || 'Fields do not match';
        }
        return null;
    },
    maxWords: (max) => (value) => {
        if (!value) return null;
        const words = value.trim().split(/\s+/).filter(w => w.length > 0);
        if (words.length > max) {
            return `Must not exceed ${max} words`;
        }
        return null;
    }
};


// Show error message
function showError(input, message) {
    const formGroup = input.closest('.form-group') || input.parentElement;
    let errorElement = formGroup.querySelector('.error-message');

    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'error-message text-xs mt-1 text-red-500';
        formGroup.appendChild(errorElement);
    }

    errorElement.textContent = message;
    input.classList.remove('input-success');
    input.classList.add('error', 'input-error');
    input.setAttribute('aria-invalid', 'true');
}

// Clear error message
function clearError(input) {
    const formGroup = input.closest('.form-group') || input.parentElement;
    const errorElement = formGroup.querySelector('.error-message');

    if (errorElement) {
        errorElement.remove();
    }

    input.classList.remove('error', 'input-error');
    input.removeAttribute('aria-invalid');
}

// Show success state
function showSuccessState(input) {
    input.classList.remove('error', 'input-error');
    input.classList.add('input-success');
    input.setAttribute('aria-invalid', 'false');
}

// Validate single field
function validateField(input, rules = []) {
    const value = input.value;
    let error = null;

    // Use built-in validation if no custom rules provided but has required/pattern etc.
    if (rules.length === 0) {
        if (input.hasAttribute('required')) rules.push(validators.required);
        if (input.type === 'email') rules.push(validators.email);
        if (input.type === 'url') rules.push(validators.url);
        if (input.type === 'number') rules.push(validators.number);
    }

    for (const rule of rules) {
        if (typeof rule === 'function') {
            error = rule(value);
        } else if (typeof rule === 'string' && validators[rule]) {
            error = validators[rule](value);
        }

        if (error) break;
    }

    if (error) {
        showError(input, error);
        return false;
    } else if (value.trim() !== '') {
        showSuccessState(input);
        return true;
    } else {
        clearError(input); // Just clear if empty but not required/no error
        return true;
    }
}

// Character counter utility
function setupCharacterCounters() {
    const textAreas = document.querySelectorAll('textarea[maxlength], input[maxlength], textarea[data-max-length], input[data-max-length]');
    textAreas.forEach(field => {
        const maxLength = field.getAttribute('data-max-length') || field.getAttribute('maxlength');
        const container = field.closest('.form-group') || field.parentElement;

        // Find or create counter element
        let counter = container.querySelector('.char-counter');
        if (!counter) {
            counter = document.createElement('div');
            counter.className = 'char-counter';
            container.appendChild(counter);
        }

        const updateCounter = () => {
            const limitType = field.getAttribute('data-limit-type') || 'chars';
            const value = field.value.trim();

            if (limitType === 'words') {
                const wordCount = value.length === 0 ? 0 : value.split(/\s+/).filter(w => w.length > 0).length;
                counter.innerHTML = `<span>${wordCount}</span>/${maxLength} words`;

                counter.classList.remove('near-limit', 'over-limit');
                if (wordCount >= maxLength) {
                    counter.classList.add('over-limit');
                } else if (wordCount >= maxLength * 0.9) {
                    counter.classList.add('near-limit');
                }
            } else {
                const length = field.value.length;
                counter.innerHTML = `<span>${length}</span>/${maxLength} characters`;

                // Visual feedback categories
                counter.classList.remove('near-limit', 'over-limit');
                if (length >= maxLength) {
                    counter.classList.add('over-limit');
                } else if (length >= maxLength * 0.9) {
                    counter.classList.add('near-limit');
                }
            }
        };

        field.addEventListener('input', updateCounter);
        updateCounter(); // Initial call
    });
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
    setupCharacterCounters();
});

// Real-time validation on input
function setupRealTimeValidation(form, fieldRules = {}) {
    const inputs = form.querySelectorAll('input, textarea, select');

    inputs.forEach(input => {
        const getRules = () => {
            const rules = [...(fieldRules[input.id] || fieldRules[input.name] || [])];
            if (input.hasAttribute('required') && !rules.includes(validators.required)) {
                rules.unshift(validators.required);
            }
            return rules;
        };

        // Validate on blur
        input.addEventListener('blur', () => {
            validateField(input, getRules());
        });


        // Live validation on input (with small delay if typing)
        let timeout;
        input.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                validateField(input, getRules());
            }, 500);
        });
    });
}

// Validate entire form
function validateForm(form, fieldRules = {}) {
    let isValid = true;
    const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');

    inputs.forEach(input => {
        const rules = fieldRules[input.id] || fieldRules[input.name] || [];

        // Add required rule if field has required attribute
        if (input.hasAttribute('required')) {
            rules.unshift(validators.required);
        }

        // Add type-specific validators
        if (input.type === 'email') {
            rules.push(validators.email);
        }
        if (input.type === 'url') {
            rules.push(validators.url);
        }
        if (input.type === 'number') {
            rules.push(validators.number);
        }

        if (!validateField(input, rules)) {
            isValid = false;
        }
    });

    return isValid;
}

// Show loading state
function showLoading(button, originalText = null) {
    if (!originalText) {
        originalText = button.textContent;
        button.dataset.originalText = originalText;
    }

    button.disabled = true;
    button.classList.add('loading');
    button.innerHTML = '<span class="spinner"></span> ' + originalText;
}

// Hide loading state
function hideLoading(button) {
    button.disabled = false;
    button.classList.remove('loading');
    button.textContent = button.dataset.originalText || button.textContent;
}

// Show success message
function showSuccess(message, container = document.body) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    successDiv.setAttribute('role', 'alert');
    successDiv.setAttribute('aria-live', 'polite');

    container.insertBefore(successDiv, container.firstChild);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        successDiv.remove();
    }, 5000);

    // Scroll to top to show message
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Export showSuccess globally
window.showSuccess = showSuccess;

// Show error message (for form-level errors)
function showFormError(message, container = document.body) {
    // Remove existing error messages
    const existingErrors = container.querySelectorAll('.form-error-message');
    existingErrors.forEach(err => err.remove());

    const errorDiv = document.createElement('div');
    errorDiv.className = 'form-error-message';
    errorDiv.textContent = message;
    errorDiv.setAttribute('role', 'alert');
    errorDiv.setAttribute('aria-live', 'assertive');

    // Try to insert after form, otherwise at top
    const form = container.querySelector('form');
    if (form) {
        form.insertBefore(errorDiv, form.firstChild);
    } else {
        container.insertBefore(errorDiv, container.firstChild);
    }

    // Auto-remove after 7 seconds (longer for important errors)
    setTimeout(() => {
        errorDiv.remove();
    }, 7000);

    // Scroll to error message
    setTimeout(() => {
        errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
}

// Helper function to get user-friendly error messages
function getUserFriendlyError(error) {
    if (!error) return 'An unexpected error occurred. Please try again.';

    const errorStr = error.toString().toLowerCase();

    // Network errors
    if (errorStr.includes('network') || errorStr.includes('fetch')) {
        return 'Network error. Please check your internet connection and try again.';
    }

    // Authentication errors
    if (errorStr.includes('invalid login') || errorStr.includes('invalid credentials')) {
        return 'Invalid email or password. Please check your credentials and try again.';
    }
    if (errorStr.includes('email not confirmed') || errorStr.includes('email not verified')) {
        return 'Please verify your email address. Check your inbox for a confirmation email.';
    }
    if (errorStr.includes('user already registered')) {
        return 'An account with this email already exists. If you previously joined using Google, please use the "Continue with Google" button instead.';
    }

    // Database errors
    if (errorStr.includes('duplicate') || errorStr.includes('unique')) {
        return 'This information already exists. Please use different values.';
    }
    if (errorStr.includes('foreign key') || errorStr.includes('constraint')) {
        return 'Invalid data provided. Please check your input and try again.';
    }

    // Permission errors
    if (errorStr.includes('permission') || errorStr.includes('unauthorized') || errorStr.includes('forbidden')) {
        return 'You don\'t have permission to perform this action. Please sign in or check your account.';
    }

    // Validation errors
    if (errorStr.includes('required') || errorStr.includes('missing')) {
        return 'Please fill in all required fields.';
    }
    if (errorStr.includes('invalid') || errorStr.includes('format')) {
        return 'Invalid format. Please check your input and try again.';
    }

    // Rate limiting
    if (errorStr.includes('rate limit') || errorStr.includes('too many')) {
        return 'Too many requests. Please wait a moment and try again.';
    }

    // Storage errors
    if (errorStr.includes('bucket not found')) {
        return 'The storage bucket "avatars" was not found. Please create it in your Supabase dashboard.';
    }

    // Return original error if no match
    return error.message || error.toString();
}

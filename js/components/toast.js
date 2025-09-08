/**
 * Toast Notification Component
 * Shows temporary notification messages
 */

const Toast = (() => {
  let container = null;
  let toastQueue = [];
  let activeToasts = [];
  const MAX_TOASTS = 3;

  /**
   * Initialize toast system
   */
  const init = () => {
    // Create container if doesn't exist
    container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    // Listen for toast events
    Events.on('toast', show);
    Events.on('toast:clear', clearAll);
  };

  /**
   * Show a toast notification
   * @param {string|object} options - Message string or options object
   */
  const show = (options) => {
    // Normalize options
    if (typeof options === 'string') {
      options = { message: options };
    }

    const {
      message = '',
      type = 'default', // default, success, error, warning, info
      duration = 3000,
      action = null, // { text: 'Undo', handler: () => {} }
      persistent = false
    } = options;

    // Create toast object
    const toast = {
      id: `toast-${Date.now()}-${Math.random()}`,
      message,
      type,
      duration,
      action,
      persistent
    };

    // Add to queue if max toasts reached
    if (activeToasts.length >= MAX_TOASTS) {
      toastQueue.push(toast);
      return;
    }

    // Create and show toast
    createToast(toast);
  };

  /**
   * Create and display a toast
   */
  const createToast = (toast) => {
    // Create toast element
    const toastEl = document.createElement('div');
    toastEl.id = toast.id;
    toastEl.className = `toast ${toast.type}`;
    
    // Build content
    let content = `<span>${toast.message}</span>`;
    
    if (toast.action) {
      content += `
        <button class="toast-action" data-toast-id="${toast.id}">
          ${toast.action.text}
        </button>
      `;
    }
    
    if (toast.persistent) {
      content += `
        <button class="toast-close" data-toast-id="${toast.id}">
          ×
        </button>
      `;
    }
    
    toastEl.innerHTML = content;

    // Add to container
    container.appendChild(toastEl);
    activeToasts.push(toast);

    // Animate in
    requestAnimationFrame(() => {
      toastEl.classList.add('show');
    });

    // Set up action handler
    if (toast.action) {
      toastEl.querySelector('.toast-action').addEventListener('click', () => {
        toast.action.handler();
        remove(toast.id);
      });
    }

    // Set up close handler
    if (toast.persistent) {
      toastEl.querySelector('.toast-close').addEventListener('click', () => {
        remove(toast.id);
      });
    }

    // Auto remove after duration
    if (!toast.persistent) {
      toast.timeout = setTimeout(() => {
        remove(toast.id);
      }, toast.duration);
    }
  };

  /**
   * Remove a toast
   */
  const remove = (toastId) => {
    const toastEl = document.getElementById(toastId);
    if (!toastEl) return;

    // Find and remove from active toasts
    const index = activeToasts.findIndex(t => t.id === toastId);
    if (index !== -1) {
      const toast = activeToasts[index];
      
      // Clear timeout if exists
      if (toast.timeout) {
        clearTimeout(toast.timeout);
      }
      
      activeToasts.splice(index, 1);
    }

    // Animate out
    toastEl.classList.remove('show');
    toastEl.classList.add('hide');

    // Remove element after animation
    setTimeout(() => {
      toastEl.remove();
      
      // Process queue if any
      if (toastQueue.length > 0) {
        const next = toastQueue.shift();
        createToast(next);
      }
    }, 300);
  };

  /**
   * Clear all toasts
   */
  const clearAll = () => {
    // Clear queue
    toastQueue = [];
    
    // Remove all active toasts
    activeToasts.forEach(toast => {
      if (toast.timeout) {
        clearTimeout(toast.timeout);
      }
      const el = document.getElementById(toast.id);
      if (el) el.remove();
    });
    
    activeToasts = [];
  };

  /**
   * Show success toast
   */
  const success = (message, options = {}) => {
    show({ ...options, message, type: 'success' });
  };

  /**
   * Show error toast
   */
  const error = (message, options = {}) => {
    show({ ...options, message, type: 'error' });
  };

  /**
   * Show warning toast
   */
  const warning = (message, options = {}) => {
    show({ ...options, message, type: 'warning' });
  };

  /**
   * Show info toast
   */
  const info = (message, options = {}) => {
    show({ ...options, message, type: 'info' });
  };

  // Public API
  return {
    init,
    show,
    remove,
    clearAll,
    success,
    error,
    warning,
    info
  };
})();

// Make available globally
window.Toast = Toast;
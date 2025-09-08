/**
 * Modal Component
 * Handles all modal functionality
 */

const Modal = (() => {
  let currentModal = null;
  let modalStack = [];

  /**
   * Initialize modal system
   */
  const init = () => {
    // Listen for modal events
    Events.on('modal:open', open);
    Events.on('modal:close', close);
    Events.on('modal:closeAll', closeAll);
    
    // ESC key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && currentModal) {
        close();
      }
    });
  };

  /**
   * Open a modal
   * @param {object} options - Modal options
   */
  const open = (options = {}) => {
    const {
      content = '',
      title = '',
      size = 'medium', // small, medium, large
      closable = true,
      onClose = null,
      id = 'main-modal'
    } = options;

    // Get modal element
    const modal = document.getElementById(id);
    if (!modal) {
      console.error(`Modal not found: ${id}`);
      return;
    }

    // Save current modal to stack if opening new one
    if (currentModal && currentModal !== modal) {
      modalStack.push(currentModal);
    }

    // Set modal size
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
      modalContent.className = `modal-content modal-${size}`;
    }

    // Set content
    const modalBody = modal.querySelector('#modal-body') || modal.querySelector('.modal-body');
    if (modalBody) {
      if (typeof content === 'string') {
        modalBody.innerHTML = content;
      } else if (content instanceof HTMLElement) {
        modalBody.innerHTML = '';
        modalBody.appendChild(content);
      }
    }

    // Show/hide close button
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.style.display = closable ? 'flex' : 'none';
    }

    // Store callback
    modal._onClose = onClose;

    // Show modal
    modal.classList.remove('hidden');
    currentModal = modal;

    // Focus trap
    trapFocus(modal);

    // Emit opened event
    Events.emit('modal:opened', { id, title });
  };

  /**
   * Close current modal
   */
  const close = () => {
    if (!currentModal) return;

    // Call onClose callback if exists
    if (currentModal._onClose) {
      currentModal._onClose();
    }

    // Hide modal
    currentModal.classList.add('hidden');
    
    // Clear content
    const modalBody = currentModal.querySelector('#modal-body') || currentModal.querySelector('.modal-body');
    if (modalBody) {
      modalBody.innerHTML = '';
    }

    // Emit closed event
    Events.emit('modal:closed', { id: currentModal.id });

    // Restore previous modal from stack
    if (modalStack.length > 0) {
      currentModal = modalStack.pop();
    } else {
      currentModal = null;
    }
  };

  /**
   * Close all modals
   */
  const closeAll = () => {
    modalStack = [];
    
    document.querySelectorAll('.modal').forEach(modal => {
      modal.classList.add('hidden');
      const body = modal.querySelector('#modal-body') || modal.querySelector('.modal-body');
      if (body) body.innerHTML = '';
    });
    
    currentModal = null;
  };

  /**
   * Focus trap for accessibility
   */
  const trapFocus = (modal) => {
    const focusableElements = modal.querySelectorAll(
      'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
    );
    
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // Focus first element
    if (firstFocusable) {
      firstFocusable.focus();
    }

    // Trap focus
    modal.addEventListener('keydown', function trapHandler(e) {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          lastFocusable.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          firstFocusable.focus();
          e.preventDefault();
        }
      }
    });
  };

  /**
   * Show confirmation modal
   */
  const confirm = (options) => {
    const {
      title = 'Confirm',
      message = 'Are you sure?',
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      onConfirm = () => {},
      onCancel = () => {},
      danger = false
    } = options;

    const content = `
      <div style="padding: 32px;">
        <h2 style="margin-bottom: 16px;">${title}</h2>
        <p style="color: var(--text-light); margin-bottom: 24px;">${message}</p>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button class="btn btn-secondary" data-action="modal-cancel">
            ${cancelText}
          </button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="modal-confirm">
            ${confirmText}
          </button>
        </div>
      </div>
    `;

    // Set up handlers
    const confirmHandler = () => {
      onConfirm();
      Events.off('action:modal-confirm', confirmHandler);
      Events.off('action:modal-cancel', cancelHandler);
      close();
    };

    const cancelHandler = () => {
      onCancel();
      Events.off('action:modal-confirm', confirmHandler);
      Events.off('action:modal-cancel', cancelHandler);
      close();
    };

    Events.once('action:modal-confirm', confirmHandler);
    Events.once('action:modal-cancel', cancelHandler);

    open({ content, size: 'small' });
  };

  /**
   * Show alert modal
   */
  const alert = (options) => {
    const {
      title = 'Alert',
      message = '',
      buttonText = 'OK',
      type = 'info' // info, success, warning, error
    } = options;

    const icons = {
      info: '💡',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };

    const content = `
      <div style="padding: 32px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 16px;">${icons[type]}</div>
        <h2 style="margin-bottom: 16px;">${title}</h2>
        <p style="color: var(--text-light); margin-bottom: 24px;">${message}</p>
        <button class="btn btn-primary" data-action="modal-close">
          ${buttonText}
        </button>
      </div>
    `;

    Events.once('action:modal-close', close);
    
    open({ content, size: 'small' });
  };

  // Public API
  return {
    init,
    open,
    close,
    closeAll,
    confirm,
    alert
  };
})();

// Make available globally
window.Modal = Modal;
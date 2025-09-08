/**
 * Event Bus Module
 * Centralized event system for component communication
 */

const EventBus = (() => {
  // Event listeners registry
  const events = new Map();
  
  // Event history for debugging
  const eventHistory = [];
  const MAX_HISTORY = 100;
  
  // Prevent infinite loops
  const eventStack = [];
  const MAX_STACK_DEPTH = 10;

  /**
   * Subscribe to an event
   * @param {string} eventName - Name of event
   * @param {function} callback - Event handler
   * @param {object} options - { once: boolean, priority: number }
   * @returns {function} Unsubscribe function
   */
  const on = (eventName, callback, options = {}) => {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    if (!events.has(eventName)) {
      events.set(eventName, []);
    }

    const handler = {
      callback,
      once: options.once || false,
      priority: options.priority || 0,
      id: Math.random().toString(36).substr(2, 9)
    };

    const handlers = events.get(eventName);
    handlers.push(handler);
    
    // Sort by priority (higher first)
    handlers.sort((a, b) => b.priority - a.priority);

    // Return unsubscribe function
    return () => off(eventName, handler.id);
  };

  /**
   * Subscribe to an event once
   */
  const once = (eventName, callback) => {
    return on(eventName, callback, { once: true });
  };

  /**
   * Unsubscribe from an event
   * @param {string} eventName - Event name
   * @param {string} handlerId - Handler ID returned from 'on'
   */
  const off = (eventName, handlerId) => {
    const handlers = events.get(eventName);
    if (!handlers) return;

    const index = handlers.findIndex(h => h.id === handlerId);
    if (index !== -1) {
      handlers.splice(index, 1);
    }

    if (handlers.length === 0) {
      events.delete(eventName);
    }
  };

  /**
   * Emit an event
   * @param {string} eventName - Event name
   * @param {any} data - Event data
   * @returns {boolean} - True if event was handled
   */
  const emit = (eventName, data = null) => {
    // Check for infinite loops
    if (eventStack.includes(eventName)) {
      if (eventStack.filter(e => e === eventName).length > MAX_STACK_DEPTH) {
        console.error(`Event loop detected for: ${eventName}`);
        return false;
      }
    }

    eventStack.push(eventName);

    // Record in history
    if (eventHistory.length >= MAX_HISTORY) {
      eventHistory.shift();
    }
    eventHistory.push({
      timestamp: Date.now(),
      event: eventName,
      data: data
    });

    const handlers = events.get(eventName);
    let handled = false;

    if (handlers) {
      // Create a copy to avoid mutation during iteration
      const handlersCopy = [...handlers];
      
      for (const handler of handlersCopy) {
        try {
          handler.callback(data);
          handled = true;

          if (handler.once) {
            off(eventName, handler.id);
          }
        } catch (error) {
          console.error(`Error in event handler for ${eventName}:`, error);
        }
      }
    }

    eventStack.pop();
    return handled;
  };

  /**
   * Clear all event listeners
   */
  const clear = (eventName = null) => {
    if (eventName) {
      events.delete(eventName);
    } else {
      events.clear();
    }
  };

  /**
   * Get event history for debugging
   */
  const getHistory = () => [...eventHistory];

  /**
   * Get registered events
   */
  const getEvents = () => {
    const result = {};
    events.forEach((handlers, name) => {
      result[name] = handlers.length;
    });
    return result;
  };

  // Public API
  return {
    on,
    once,
    off,
    emit,
    clear,
    getHistory,
    getEvents
  };
})();

/**
 * DOM Event Delegation System
 * Handles all DOM events efficiently
 */
const DOMEvents = (() => {
  // Delegated event handlers
  const handlers = new Map();

  /**
   * Initialize DOM event delegation
   */
  const init = () => {
    // Main click delegation
    document.addEventListener('click', handleClick, true);
    
    // Form events
    document.addEventListener('change', handleChange, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('submit', handleSubmit, true);
    
    // Focus events
    document.addEventListener('focusin', handleFocus, true);
    document.addEventListener('focusout', handleBlur, true);
  };

  /**
   * Handle delegated clicks
   */
  const handleClick = (e) => {
    const target = e.target;
    
    // Check for data-action attribute
    const action = target.closest('[data-action]')?.dataset.action;
    if (action) {
      const data = { ...target.closest('[data-action]').dataset };
      delete data.action;
      
      EventBus.emit(`action:${action}`, {
        event: e,
        target: target,
        data: data
      });
    }
    
    // Check for page navigation
    const page = target.closest('[data-page]')?.dataset.page;
    if (page) {
      e.preventDefault();
      EventBus.emit('navigate', { page });
    }
    
    // Check for modal close
    if (target.closest('.modal-close') || 
        (target.classList.contains('modal') && !target.closest('.modal-content'))) {
      EventBus.emit('modal:close');
    }
  };

  /**
   * Handle form changes
   */
  const handleChange = (e) => {
    const target = e.target;
    
    if (target.dataset.bind) {
      EventBus.emit('form:change', {
        path: target.dataset.bind,
        value: target.type === 'checkbox' ? target.checked : target.value,
        target: target
      });
    }
  };

  /**
   * Handle input events
   */
  const handleInput = (e) => {
    const target = e.target;
    
    // Character counting
    if (target.hasAttribute('maxlength')) {
      const counter = target.parentElement.querySelector('.char-count');
      if (counter) {
        counter.textContent = `${target.value.length}/${target.maxLength}`;
      }
    }
    
    // Live binding
    if (target.dataset.bindLive) {
      EventBus.emit('form:input', {
        path: target.dataset.bindLive,
        value: target.value,
        target: target
      });
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = (e) => {
    const form = e.target;
    
    if (form.dataset.handler) {
      e.preventDefault();
      
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      
      EventBus.emit(`form:${form.dataset.handler}`, {
        event: e,
        form: form,
        data: data
      });
    }
  };

  /**
   * Handle focus events
   */
  const handleFocus = (e) => {
    if (e.target.dataset.focusHandler) {
      EventBus.emit(`focus:${e.target.dataset.focusHandler}`, e.target);
    }
  };

  /**
   * Handle blur events
   */
  const handleBlur = (e) => {
    if (e.target.dataset.blurHandler) {
      EventBus.emit(`blur:${e.target.dataset.blurHandler}`, e.target);
    }
  };

  // Public API
  return {
    init
  };
})();

// Make available globally
window.Events = EventBus;
window.DOMEvents = DOMEvents;
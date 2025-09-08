/**
 * State Management Module
 * Single source of truth for application state
 */

const StateManager = (() => {
  // Private state object
  let state = {
    // App-level state
    currentPage: 'feed',
    currentUser: null,
    isLoading: false,
    
    // UI state
    modals: {
      main: { isOpen: false, content: null },
      stop: { isOpen: false, content: null }
    },
    
    // Data collections
    wishlist: [],
    itineraries: [],
    users: [],
    
    // Create flow state
    create: {
      currentStep: 1,
      selectedDayId: null,
      draft: {
        title: '',
        destination: '',
        duration: 0,
        description: '',
        price: 9,
        coverImage: null,
        days: []
      }
    },
    
    // Feed filters
    filters: {
      tab: 'for-you',
      destination: 'all',
      duration: 'any',
      price: 'any'
    }
  };

  // Subscribers for state changes
  const subscribers = new Map();

  // State change history for debugging
  const history = [];
  const MAX_HISTORY = 50;

  /**
   * Get current state or a specific path
   * @param {string} path - Dot notation path (e.g., 'create.draft.title')
   */
  const get = (path = null) => {
    if (!path) return { ...state };
    
    return path.split('.').reduce((obj, key) => {
      return obj?.[key];
    }, state);
  };

  /**
   * Set state at a specific path
   * @param {string} path - Dot notation path
   * @param {any} value - New value
   * @param {boolean} silent - Skip notifying subscribers
   */
  const set = (path, value, silent = false) => {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, key) => {
      if (!obj[key]) obj[key] = {};
      return obj[key];
    }, state);
    
    const oldValue = target[lastKey];
    target[lastKey] = value;
    
    // Record history
    if (history.length >= MAX_HISTORY) history.shift();
    history.push({
      timestamp: Date.now(),
      path,
      oldValue,
      newValue: value
    });
    
    if (!silent) {
      notify(path, value, oldValue);
    }
    
    return value;
  };

  /**
   * Merge object into state at path
   * @param {string} path - Dot notation path
   * @param {object} updates - Object to merge
   */
  const merge = (path, updates) => {
    const current = get(path);
    if (typeof current !== 'object' || current === null) {
      throw new Error(`Cannot merge into non-object at path: ${path}`);
    }
    
    set(path, { ...current, ...updates });
  };

  /**
   * Subscribe to state changes
   * @param {string} path - Path to watch (supports wildcards: 'create.*')
   * @param {function} callback - Called with (newValue, oldValue, path)
   * @returns {function} Unsubscribe function
   */
  const subscribe = (path, callback) => {
    if (!subscribers.has(path)) {
      subscribers.set(path, new Set());
    }
    
    subscribers.get(path).add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = subscribers.get(path);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          subscribers.delete(path);
        }
      }
    };
  };

  /**
   * Notify subscribers of state change
   */
  const notify = (path, newValue, oldValue) => {
    // Exact path subscribers
    const exactSubs = subscribers.get(path);
    if (exactSubs) {
      exactSubs.forEach(callback => {
        callback(newValue, oldValue, path);
      });
    }
    
    // Wildcard subscribers
    subscribers.forEach((callbacks, subscriberPath) => {
      if (subscriberPath.includes('*')) {
        const regex = new RegExp('^' + subscriberPath.replace('*', '.*'));
        if (regex.test(path)) {
          callbacks.forEach(callback => {
            callback(newValue, oldValue, path);
          });
        }
      }
    });
  };

  /**
   * Reset state to initial values
   */
  const reset = (path = null) => {
    if (path) {
      // Reset specific path
      const keys = path.split('.');
      const lastKey = keys.pop();
      const target = keys.reduce((obj, key) => obj?.[key], state);
      
      if (target && lastKey in target) {
        // Define initial values for known paths
        const initialValues = {
          'create.draft': {
            title: '',
            destination: '',
            duration: 0,
            description: '',
            price: 9,
            coverImage: null,
            days: []
          },
          'filters': {
            tab: 'for-you',
            destination: 'all',
            duration: 'any',
            price: 'any'
          },
          'wishlist': [],
          'create.currentStep': 1,
          'create.selectedDayId': null
        };
        
        const initialValue = initialValues[path];
        if (initialValue !== undefined) {
          set(path, initialValue);
        }
      }
    } else {
      // Reset everything - reload page is safer
      window.location.reload();
    }
  };

  /**
   * Get state history for debugging
   */
  const getHistory = () => [...history];

  /**
   * Create computed value that auto-updates
   * @param {function} computeFn - Function that returns computed value
   * @param {array} deps - Array of state paths to watch
   */
  const computed = (computeFn, deps = []) => {
    let value = computeFn();
    
    deps.forEach(path => {
      subscribe(path, () => {
        value = computeFn();
      });
    });
    
    return () => value;
  };

  // Public API
  return {
    get,
    set,
    merge,
    subscribe,
    reset,
    getHistory,
    computed
  };
})();

// Make available globally for now (we'll modularize later)
window.State = StateManager;
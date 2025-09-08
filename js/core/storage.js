/**
 * Storage Module
 * Wrapper for localStorage with JSON serialization and error handling
 */

const Storage = (() => {
  // Prefix for all storage keys
  const PREFIX = 'wanderlist_';
  
  // Storage quota management
  const QUOTA_WARNING_THRESHOLD = 0.9; // Warn at 90% full
  
  /**
   * Get item from storage
   * @param {string} key - Storage key
   * @param {any} defaultValue - Default if not found
   */
  const get = (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(PREFIX + key);
      if (item === null) return defaultValue;
      
      // Try to parse as JSON
      try {
        return JSON.parse(item);
      } catch {
        // Return as string if not valid JSON
        return item;
      }
    } catch (error) {
      console.error(`Storage.get error for key ${key}:`, error);
      return defaultValue;
    }
  };

  /**
   * Set item in storage
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @returns {boolean} Success
   */
  const set = (key, value) => {
    try {
      const serialized = typeof value === 'string' 
        ? value 
        : JSON.stringify(value);
      
      localStorage.setItem(PREFIX + key, serialized);
      
      // Check storage quota
      checkQuota();
      
      return true;
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.error('Storage quota exceeded');
        Events.emit('storage:quota-exceeded');
        
        // Try to clean up old data
        cleanup();
        
        // Retry once
        try {
          const serialized = typeof value === 'string' 
            ? value 
            : JSON.stringify(value);
          localStorage.setItem(PREFIX + key, serialized);
          return true;
        } catch {
          return false;
        }
      }
      
      console.error(`Storage.set error for key ${key}:`, error);
      return false;
    }
  };

  /**
   * Remove item from storage
   * @param {string} key - Storage key
   */
  const remove = (key) => {
    try {
      localStorage.removeItem(PREFIX + key);
      return true;
    } catch (error) {
      console.error(`Storage.remove error for key ${key}:`, error);
      return false;
    }
  };

  /**
   * Clear all items with our prefix
   */
  const clear = () => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      return true;
    } catch (error) {
      console.error('Storage.clear error:', error);
      return false;
    }
  };

  /**
   * Get all keys with our prefix
   */
  const keys = () => {
    try {
      return Object.keys(localStorage)
        .filter(key => key.startsWith(PREFIX))
        .map(key => key.substring(PREFIX.length));
    } catch (error) {
      console.error('Storage.keys error:', error);
      return [];
    }
  };

  /**
   * Check if key exists
   */
  const has = (key) => {
    return localStorage.getItem(PREFIX + key) !== null;
  };

  /**
   * Get storage size in bytes
   */
  const getSize = () => {
    let size = 0;
    
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(PREFIX)) {
          const item = localStorage.getItem(key);
          size += item ? item.length + key.length : 0;
        }
      });
    } catch (error) {
      console.error('Storage.getSize error:', error);
    }
    
    return size;
  };

  /**
   * Check storage quota
   */
  const checkQuota = async () => {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        const percentUsed = estimate.usage / estimate.quota;
        
        if (percentUsed > QUOTA_WARNING_THRESHOLD) {
          Events.emit('storage:quota-warning', {
            usage: estimate.usage,
            quota: estimate.quota,
            percent: percentUsed
          });
        }
        
        return {
          usage: estimate.usage,
          quota: estimate.quota,
          percent: percentUsed
        };
      } catch (error) {
        console.error('Storage.checkQuota error:', error);
      }
    }
    
    return null;
  };

  /**
   * Clean up old/unused data
   */
  const cleanup = () => {
    try {
      // Remove old drafts (older than 30 days)
      const drafts = get('drafts', []);
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      const recentDrafts = drafts.filter(draft => {
        return draft.updatedAt && draft.updatedAt > thirtyDaysAgo;
      });
      
      if (recentDrafts.length < drafts.length) {
        set('drafts', recentDrafts);
        console.log(`Cleaned up ${drafts.length - recentDrafts.length} old drafts`);
      }
      
      // Remove orphaned data
      const keysToCheck = ['temp_', 'cache_', 'old_'];
      keys().forEach(key => {
        if (keysToCheck.some(prefix => key.startsWith(prefix))) {
          remove(key);
        }
      });
      
      return true;
    } catch (error) {
      console.error('Storage.cleanup error:', error);
      return false;
    }
  };

  /**
   * Sync state with storage
   * Saves specific state paths to storage
   */
  const syncState = () => {
    // Define what state to persist
    const persistPaths = [
      { path: 'currentUser', key: 'user' },
      { path: 'wishlist', key: 'wishlist' },
      { path: 'create.draft', key: 'current_draft' },
      { path: 'filters', key: 'filters' }
    ];
    
    persistPaths.forEach(({ path, key }) => {
      const value = State.get(path);
      if (value !== null && value !== undefined) {
        set(key, value);
      }
    });
  };

  /**
   * Load state from storage
   * Restores persisted state on app init
   */
  const loadState = () => {
    // Define what state to restore
    const restorePaths = [
      { path: 'currentUser', key: 'user' },
      { path: 'wishlist', key: 'wishlist', default: [] },
      { path: 'create.draft', key: 'current_draft' },
      { path: 'filters', key: 'filters' }
    ];
    
    restorePaths.forEach(({ path, key, default: defaultValue }) => {
      const value = get(key, defaultValue);
      if (value !== null && value !== undefined) {
        State.set(path, value, true); // Silent update
      }
    });
  };

  /**
   * Export all data (for backup)
   */
  const exportData = () => {
    const data = {};
    
    keys().forEach(key => {
      data[key] = get(key);
    });
    
    return {
      version: '1.0',
      timestamp: Date.now(),
      data: data
    };
  };

  /**
   * Import data (from backup)
   */
  const importData = (backup) => {
    if (!backup || !backup.data) {
      throw new Error('Invalid backup format');
    }
    
    Object.entries(backup.data).forEach(([key, value]) => {
      set(key, value);
    });
    
    // Reload state from imported data
    loadState();
    
    return true;
  };

  // Public API
  return {
    get,
    set,
    remove,
    clear,
    keys,
    has,
    getSize,
    checkQuota,
    cleanup,
    syncState,
    loadState,
    exportData,
    importData
  };
})();

// Auto-sync state changes to storage
State.subscribe('*', () => {
  // Debounce to avoid excessive writes
  clearTimeout(Storage._syncTimeout);
  Storage._syncTimeout = setTimeout(() => {
    Storage.syncState();
  }, 500);
});

// Make available globally
window.Storage = Storage;
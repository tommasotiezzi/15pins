/**
 * Feed Page Controller
 * Handles the main feed UI and interactions with Supabase
 */

const FeedPage = (() => {
  let currentFilter = 'for-you';
  let isLoading = false;
  let currentPage = 1;
  const ITEMS_PER_PAGE = 12;
  let searchTimeout = null;

  /**
   * Initialize feed page
   */
  const init = () => {
    // Listen for page activation
    Events.on('page:feed:activate', activate);
    Events.on('page:feed:deactivate', deactivate);
    
    // Filter events
    Events.on('action:filter-tab', handleFilterChange);
    Events.on('action:filter-select', handleFilterSelect);
    Events.on('action:load-more', loadMore);
    Events.on('action:search-itineraries', handleSearch);
    
    // Wishlist state changes
    State.subscribe('wishlist', () => {
      // Re-render cards to update wishlist states
      const grid = document.getElementById('itinerary-grid');
      if (grid && grid.children.length > 0) {
        renderCards();
      }
    });
  };

  /**
   * Activate feed page
   */
  const activate = async () => {
    setupFilters();
    setupSearch();
    await renderCards();
    await updateStats();
  };

  /**
   * Deactivate feed page
   */
  const deactivate = () => {
    // Clear search timeout if exists
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
  };

  /**
   * Setup filter controls
   */
  const setupFilters = () => {
    // Set active filter tab
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.filter === currentFilter);
    });

    // Restore filter values from state
    const filters = State.get('filters') || {};
    Object.keys(filters).forEach(key => {
      const select = document.querySelector(`[data-filter-type="${key}"]`);
      if (select) {
        select.value = filters[key] || '';
      }
    });
  };

  /**
   * Setup search input
   */
  const setupSearch = () => {
    const searchInput = document.getElementById('feed-search');
    if (searchInput) {
      const savedSearch = State.get('filters.searchQuery') || '';
      searchInput.value = savedSearch;
    }
  };

  /**
   * Debounce utility function
   */
  const debounce = (func, delay) => {
    return (...args) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => func(...args), delay);
    };
  };

  /**
   * Handle search input
   */
  const handleSearch = debounce(({ target }) => {
    const searchQuery = target.value.trim();
    State.merge('filters', { searchQuery });
    currentPage = 1;
    renderCards();
  }, 300);

  /**
   * Handle filter tab change
   */
  const handleFilterChange = ({ data }) => {
    currentFilter = data.filter;
    currentPage = 1;
    
    // Update UI
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.filter === currentFilter);
    });
    
    State.set('filters.tab', currentFilter);
    renderCards();
  };

  /**
   * Handle filter select change
   */
  const handleFilterSelect = ({ target }) => {
    const filterType = target.dataset.filterType;
    const value = target.value;
    
    State.merge('filters', { [filterType]: value });
    currentPage = 1;
    renderCards();
  };

  /**
   * Build query parameters for API
   */
  const buildQueryParams = () => {
    const filters = State.get('filters') || {};
    const params = {
      page: currentPage,
      limit: ITEMS_PER_PAGE
    };

    // Search query
    if (filters.searchQuery) {
      params.search = filters.searchQuery;
    }

    // Destination filter
    if (filters.destination && filters.destination !== 'all') {
      params.destination = filters.destination;
    }

    // Duration filter
    if (filters.duration && filters.duration !== 'any') {
      const durationMap = {
        'weekend': { min: 2, max: 3 },
        'week': { min: 4, max: 7 },
        'two-weeks': { min: 8, max: 14 },
        'month': { min: 15, max: 90 }
      };
      
      if (durationMap[filters.duration]) {
        params.min_duration = durationMap[filters.duration].min;
        params.max_duration = durationMap[filters.duration].max;
      }
    }

    // Price filter
    if (filters.price && filters.price !== 'any') {
      params.price_tier = parseInt(filters.price);
    }

    // Characteristic filters
    ['physical_demand', 'budget_level', 'pace', 'best_for'].forEach(char => {
      if (filters[char] && filters[char] !== 'any') {
        params[char] = parseInt(filters[char]);
      }
    });

    // Sort based on current tab
    switch (currentFilter) {
      case 'trending':
        params.sort_by = 'purchase_count';
        params.sort_order = 'desc';
        break;
      case 'new':
        params.sort_by = 'published_at';
        params.sort_order = 'desc';
        break;
      case 'nearby':
        // Would need geolocation implementation
        // For now, just use default
        break;
      case 'following':
        // Would need to filter by followed creators
        params.following_only = true;
        break;
      case 'for-you':
      default:
        // Default sorting - could be personalized based on user history
        params.sort_by = 'view_count';
        params.sort_order = 'desc';
        break;
    }

    return params;
  };

  /**
   * Render itinerary cards
   */
  const renderCards = async () => {
    const grid = document.getElementById('itinerary-grid');
    if (!grid) return;

    // Show loading state
    if (currentPage === 1) {
      grid.innerHTML = `
        <div class="loading-state" style="grid-column: 1/-1; text-align: center; padding: var(--space-3xl);">
          <div class="spinner"></div>
          <p>Loading itineraries...</p>
        </div>
      `;
    }

    // Add loading class to search container if searching
    const searchContainer = document.querySelector('.search-container');
    if (searchContainer && State.get('filters.searchQuery')) {
      searchContainer.classList.add('searching');
    }

    try {
      // Build query parameters
      const params = buildQueryParams();
      
      // Fetch from Supabase
      const { data, error } = await API.itineraries.list(params);
      
      if (error) throw error;

      // Handle empty state
      if (!data || data.length === 0) {
        if (currentPage === 1) {
          grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
              <svg width="48" height="48" fill="none" opacity="0.3">
                <path d="M24 12C18 12 13 17 13 23C13 29 24 40 24 40C24 40 35 29 35 23C35 17 30 12 24 12Z" 
                      stroke="currentColor" stroke-width="2"/>
              </svg>
              <h3>No itineraries found</h3>
              <p>${State.get('filters.searchQuery') 
                ? 'Try adjusting your search terms or filters' 
                : 'Check back later for new travel inspiration!'}</p>
            </div>
          `;
        }
        updateLoadMoreButton(false);
        return;
      }

      // Render cards using the ItineraryCard component
      if (currentPage === 1) {
        grid.innerHTML = ItineraryCard.renderCards(data, 'feed');
      } else {
        // Append for pagination
        grid.insertAdjacentHTML('beforeend', ItineraryCard.renderCards(data, 'feed'));
      }

      // Update load more button
      updateLoadMoreButton(data.length === ITEMS_PER_PAGE);

    } catch (error) {
      console.error('Failed to load itineraries:', error);
      
      if (currentPage === 1) {
        grid.innerHTML = `
          <div class="error-state" style="grid-column: 1/-1; text-align: center; padding: var(--space-3xl);">
            <svg width="48" height="48" fill="none" opacity="0.3">
              <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2"/>
              <path d="M24 14v10m0 4v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <h3>Failed to load itineraries</h3>
            <p>Please try again later</p>
            <button class="btn btn-primary" onclick="FeedPage.renderCards()">Retry</button>
          </div>
        `;
      }
      
      Toast.error('Failed to load itineraries');
    } finally {
      // Remove searching class
      if (searchContainer) {
        searchContainer.classList.remove('searching');
      }
      isLoading = false;
    }
  };

  /**
   * Update load more button visibility
   */
  const updateLoadMoreButton = (hasMore) => {
    const loadMoreBtn = document.getElementById('load-more');
    if (loadMoreBtn) {
      loadMoreBtn.style.display = hasMore ? 'block' : 'none';
    }
  };

  /**
   * Load more itineraries
   */
  const loadMore = async () => {
    if (isLoading) return;
    
    isLoading = true;
    currentPage++;
    
    const loadMoreBtn = document.getElementById('load-more');
    if (loadMoreBtn) {
      loadMoreBtn.innerHTML = 'Loading...';
      loadMoreBtn.disabled = true;
    }
    
    await renderCards();
    
    if (loadMoreBtn) {
      loadMoreBtn.innerHTML = 'Load More';
      loadMoreBtn.disabled = false;
    }
  };

  /**
   * Update hero stats
   */
  const updateStats = async () => {
    try {
      // Get total counts from API (you might need to add these endpoints)
      const totalItineraries = document.getElementById('total-itineraries');
      const totalCreators = document.getElementById('total-creators');
      
      // For now, we'll use placeholder numbers
      // In production, you'd fetch these from your API
      if (totalItineraries) {
        totalItineraries.textContent = '150+';
      }
      if (totalCreators) {
        totalCreators.textContent = '50+';
      }
    } catch (error) {
      console.error('Failed to update stats:', error);
    }
  };

  // Public API
  return {
    init,
    renderCards // Expose for retry button
  };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', FeedPage.init);
} else {
  FeedPage.init();
}
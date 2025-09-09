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
  let allItineraries = [];

  /**
   * Initialize feed page
   */
  const init = async () => {
    console.log('FeedPage: Initializing');
    
    // Set up event listeners
    setupEventListeners();
    
    // Load initial data
    await loadItineraries();
  };

  /**
   * Set up all event listeners
   */
  const setupEventListeners = () => {
    // Filter tabs
    document.querySelectorAll('[data-action="filter-tab"]').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const filter = e.target.dataset.filter;
        handleFilterChange(filter);
      });
    });

    // Filter selects
    document.querySelectorAll('[data-action="filter-select"]').forEach(select => {
      select.addEventListener('change', handleFilterSelect);
    });

    // Search input
    const searchInput = document.getElementById('feed-search');
    if (searchInput) {
      searchInput.addEventListener('input', debounce(handleSearch, 300));
    }

    // Load more button
    const loadMoreBtn = document.getElementById('load-more');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', loadMore);
    }
  };

  /**
   * Debounce utility
   */
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  };

  /**
   * Handle search input
   */
  const handleSearch = async (e) => {
    const searchQuery = e.target.value.trim();
    currentPage = 1;
    await loadItineraries(searchQuery);
  };

  /**
   * Handle filter tab change
   */
  const handleFilterChange = async (filter) => {
    currentFilter = filter;
    currentPage = 1;
    
    // Update UI
    document.querySelectorAll('[data-action="filter-tab"]').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.filter === currentFilter);
    });
    
    await loadItineraries();
  };

  /**
   * Handle filter select change
   */
  const handleFilterSelect = async (e) => {
    currentPage = 1;
    await loadItineraries();
  };

  /**
   * Build query parameters for API
   */
  const buildQueryParams = (searchQuery = '') => {
    const params = {
      page: currentPage,
      limit: ITEMS_PER_PAGE
    };

    // Add search query
    if (searchQuery) {
      params.search = searchQuery;
    } else {
      const searchInput = document.getElementById('feed-search');
      if (searchInput && searchInput.value.trim()) {
        params.search = searchInput.value.trim();
      }
    }

    // Get filter values
    const filters = {};
    document.querySelectorAll('[data-action="filter-select"]').forEach(select => {
      const filterType = select.dataset.filterType;
      const value = select.value;
      if (value && value !== 'any' && value !== 'all') {
        filters[filterType] = value;
      }
    });

    // Apply destination filter
    if (filters.destination) {
      // Map regions to countries or use as search term
      params.search = filters.destination;
    }

    // Apply duration filter
    if (filters.duration) {
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

    // Apply price filter
    if (filters.price) {
      params.price_tier = parseInt(filters.price);
    }

    // Apply characteristic filters
    if (filters.physical_demand) {
      params.physical_demand = parseInt(filters.physical_demand);
    }
    if (filters.budget_level) {
      params.budget_level = parseInt(filters.budget_level);
    }
    if (filters.pace) {
      params.pace = parseInt(filters.pace);
    }
    if (filters.best_for) {
      params.best_for = parseInt(filters.best_for);
    }

    // Sort based on current tab
    switch (currentFilter) {
      case 'trending':
        params.sort_by = 'total_sales';
        params.sort_order = 'desc';
        break;
      case 'new':
        params.sort_by = 'published_at';
        params.sort_order = 'desc';
        break;
      case 'nearby':
        // Would need geolocation
        params.sort_by = 'published_at';
        break;
      case 'following':
        // Would need following logic
        params.sort_by = 'published_at';
        break;
      case 'for-you':
      default:
        params.sort_by = 'view_count';
        params.sort_order = 'desc';
        break;
    }

    return params;
  };

  /**
   * Load itineraries from API
   */
  const loadItineraries = async (searchQuery = '') => {
    if (isLoading) return;
    
    const grid = document.getElementById('itinerary-grid');
    if (!grid) return;

    // Show loading state for first page
    if (currentPage === 1) {
      grid.innerHTML = `
        <div class="loading-state" style="grid-column: 1/-1; text-align: center; padding: 3rem;">
          <div class="spinner"></div>
          <p>Loading amazing trips...</p>
        </div>
      `;
    }

    isLoading = true;

    try {
      // Build query parameters
      const params = buildQueryParams(searchQuery);
      
      // Fetch from API
      const { data, error } = await API.itineraries.list(params);
      
      if (error) {
        throw error;
      }

      // Store data
      if (currentPage === 1) {
        allItineraries = data || [];
      } else {
        allItineraries = [...allItineraries, ...(data || [])];
      }

      // Render cards
      renderCards();
      
      // Update load more button
      const hasMore = data && data.length === ITEMS_PER_PAGE;
      updateLoadMoreButton(hasMore);
      
      // Update stats
      updateStats();

    } catch (error) {
      console.error('Failed to load itineraries:', error);
      
      if (currentPage === 1) {
        grid.innerHTML = `
          <div class="error-state" style="grid-column: 1/-1; text-align: center; padding: 3rem;">
            <h3>Failed to load itineraries</h3>
            <p>Please try again later</p>
            <button class="btn btn-primary" onclick="FeedPage.init()">Retry</button>
          </div>
        `;
      }
      
      Toast.error('Failed to load itineraries');
    } finally {
      isLoading = false;
    }
  };

  /**
   * Render itinerary cards
   * FIXED: Use renderCardsUnwrapped to avoid nested grids
   */
  const renderCards = () => {
    const grid = document.getElementById('itinerary-grid');
    if (!grid) return;

    // Handle empty state
    if (allItineraries.length === 0) {
      const searchInput = document.getElementById('feed-search');
      const hasSearch = searchInput && searchInput.value.trim();
      
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 3rem;">
          <h3>No itineraries found</h3>
          <p>${hasSearch 
            ? 'Try adjusting your search or filters' 
            : 'Be the first to create an itinerary!'}</p>
          ${!hasSearch ? '<a href="#create" class="btn btn-primary">Create Itinerary</a>' : ''}
        </div>
      `;
      return;
    }

    // Use ItineraryCard component to render WITHOUT wrapper
    if (typeof ItineraryCard !== 'undefined' && ItineraryCard.renderCardsUnwrapped) {
      // Use the unwrapped version to avoid nested grids
      grid.innerHTML = ItineraryCard.renderCardsUnwrapped(allItineraries, 'feed');
    } else if (typeof ItineraryCard !== 'undefined') {
      // Fallback: render cards individually
      grid.innerHTML = allItineraries.map(itinerary => 
        ItineraryCard.create(itinerary, 'feed')
      ).join('');
    } else {
      console.error('ItineraryCard component not loaded');
      grid.innerHTML = '<p>Error: Card component not loaded</p>';
    }
  };

  /**
   * Update load more button
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
    
    const loadMoreBtn = document.getElementById('load-more');
    if (loadMoreBtn) {
      loadMoreBtn.textContent = 'Loading...';
      loadMoreBtn.disabled = true;
    }
    
    currentPage++;
    await loadItineraries();
    
    if (loadMoreBtn) {
      loadMoreBtn.textContent = 'Load More';
      loadMoreBtn.disabled = false;
    }
  };

  /**
   * Update hero stats
   */
  const updateStats = () => {
    // Update total itineraries count if element exists
    const totalElement = document.getElementById('total-itineraries');
    if (totalElement) {
      // You could get this from a separate API call or use a rough estimate
      totalElement.textContent = allItineraries.length > 0 ? `${allItineraries.length}+` : '0';
    }
    
    // Update creators count (would need separate API call)
    const creatorsElement = document.getElementById('total-creators');
    if (creatorsElement && allItineraries.length > 0) {
      const uniqueCreators = new Set(allItineraries.map(i => i.creator_id)).size;
      creatorsElement.textContent = uniqueCreators;
    }
  };

  // Public API
  return {
    init,
    loadItineraries
  };
})();

// Make available globally
window.FeedPage = FeedPage;

// Auto-initialize if on feed page
if (window.location.hash === '#feed' || window.location.hash === '') {
  document.addEventListener('DOMContentLoaded', FeedPage.init);
}
/**
 * Feed Page Controller
 * Handles the main feed UI and interactions
 */

const FeedPage = (() => {
  let currentFilter = 'for-you';
  let isLoading = false;
  let currentPage = 1;
  const ITEMS_PER_PAGE = 6;

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
    
    // Wishlist state changes
    State.subscribe('wishlist', renderCards);
  };

  /**
   * Activate feed page
   */
  const activate = () => {
    renderCards();
    setupFilters();
  };

  /**
   * Deactivate feed page
   */
  const deactivate = () => {
    // Clean up if needed
  };

  /**
   * Setup filter controls
   */
  const setupFilters = () => {
    // Set active filter tab
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.filter === currentFilter);
    });
  };

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
   * Render itinerary cards
   */
  const renderCards = () => {
    const grid = document.getElementById('itinerary-grid');
    if (!grid) return;
    
    // Get and filter itineraries
    let itineraries = getFilteredItineraries();
    
    // Sort based on current filter
    itineraries = sortItineraries(itineraries, currentFilter);
    
    // Paginate
    const start = 0;
    const end = currentPage * ITEMS_PER_PAGE;
    const visible = itineraries.slice(start, end);
    
    // Render cards
    grid.innerHTML = visible.map(it => createCard(it)).join('');
    
    // Update load more button
    const loadMoreBtn = document.getElementById('load-more');
    if (loadMoreBtn) {
      const hasMore = end < itineraries.length;
      loadMoreBtn.style.display = hasMore ? 'block' : 'none';
    }
  };

  /**
   * Get filtered itineraries
   */
  const getFilteredItineraries = () => {
    let itineraries = [...DB.itineraries];
    const filters = State.get('filters');
    
    // Apply destination filter
    if (filters.destination && filters.destination !== 'all') {
      itineraries = itineraries.filter(it => 
        it.location.toLowerCase().includes(filters.destination.toLowerCase())
      );
    }
    
    // Apply duration filter
    if (filters.duration && filters.duration !== 'any') {
      const ranges = {
        'weekend': [2, 3],
        'week': [4, 7],
        'two-weeks': [8, 14],
        'month': [15, 31]
      };
      
      if (ranges[filters.duration]) {
        const [min, max] = ranges[filters.duration];
        itineraries = itineraries.filter(it => 
          it.duration_days >= min && it.duration_days <= max
        );
      }
    }
    
    // Apply price filter
    if (filters.price && filters.price !== 'any') {
      const priceValue = parseInt(filters.price);
      itineraries = itineraries.filter(it => 
        Math.floor(it.price_cents / 100) === priceValue
      );
    }
    
    return itineraries;
  };

  /**
   * Sort itineraries based on filter
   */
  const sortItineraries = (itineraries, filter) => {
    const sorted = [...itineraries];
    
    switch (filter) {
      case 'trending':
        return sorted.sort((a, b) => b.total_sales - a.total_sales);
      
      case 'new':
        return sorted.sort((a, b) => 
          new Date(b.created_at) - new Date(a.created_at)
        );
      
      case 'nearby':
        // In production, would use user's location
        return sorted;
      
      case 'for-you':
      default:
        // Mix of popularity and recency
        return sorted.sort((a, b) => {
          const scoreA = a.total_sales + (a.rating * 100);
          const scoreB = b.total_sales + (b.rating * 100);
          return scoreB - scoreA;
        });
    }
  };

  /**
   * Create itinerary card HTML
   */
  const createCard = (itinerary) => {
    const creator = DB.users.find(u => u.id === itinerary.creator_id);
    const wishlist = State.get('wishlist') || [];
    const isWishlisted = wishlist.includes(itinerary.id);
    
    return `
      <div class="itinerary-card" data-action="view-itinerary" data-id="${itinerary.id}">
        <div class="card-image">
          <img src="${itinerary.cover_image_url}" 
               alt="${itinerary.title}"
               loading="lazy">
          <span class="card-badge">${itinerary.duration_days} days</span>
          <span class="card-price">€${Math.floor(itinerary.price_cents / 100)}</span>
        </div>
        <div class="card-content">
          <h3 class="card-title">${itinerary.title}</h3>
          <div class="card-location">
            <svg width="16" height="16" fill="none">
              <path d="M8 8.5C9.1 8.5 10 7.6 10 6.5C10 5.4 9.1 4.5 8 4.5C6.9 4.5 6 5.4 6 6.5C6 7.6 6.9 8.5 8 8.5Z" 
                    stroke="currentColor"/>
              <path d="M8 1C5 1 2.5 3.5 2.5 6.5C2.5 10.5 8 15 8 15C8 15 13.5 10.5 13.5 6.5C13.5 3.5 11 1 8 1Z" 
                    stroke="currentColor"/>
            </svg>
            ${itinerary.location}
          </div>
          ${renderStopPreviews(itinerary)}
        </div>
        <div class="card-footer">
          <div class="creator-info">
            <img src="${creator.avatar_url}" 
                 alt="${creator.username}" 
                 class="creator-avatar"
                 loading="lazy">
            <div class="creator-details">
              <span class="creator-name">${creator.username}</span>
              <span class="card-stats">
                ${itinerary.total_sales} sold • ${itinerary.rating}★
              </span>
            </div>
          </div>
          <div class="card-actions">
            <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" 
                    data-action="wishlist" 
                    data-id="${itinerary.id}"
                    aria-label="${isWishlisted ? 'Remove from' : 'Add to'} wishlist">
              <svg width="16" height="16" fill="${isWishlisted ? 'currentColor' : 'none'}">
                <path d="M8 14L2 8C0 6 1 2 4 3L8 7L12 3C15 2 16 6 14 8L8 14Z" 
                      stroke="currentColor" 
                      stroke-width="2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  };

  /**
   * Render stop previews (mock data)
   */
  const renderStopPreviews = (itinerary) => {
    // In production, would fetch actual stops
    const mockStops = [
      { icon: '🏛️', name: 'Temple visits' },
      { icon: '🍜', name: 'Local food markets' },
      { icon: '🏖️', name: 'Beach time' }
    ];
    
    return `
      <div class="card-stops">
        ${mockStops.map(stop => `
          <div class="stop-preview">
            <span class="stop-icon">${stop.icon}</span>
            <span>${stop.name}</span>
          </div>
        `).join('')}
      </div>
    `;
  };

  /**
   * Load more itineraries
   */
  const loadMore = () => {
    if (isLoading) return;
    
    isLoading = true;
    const loadMoreBtn = document.getElementById('load-more');
    
    if (loadMoreBtn) {
      loadMoreBtn.textContent = 'Loading...';
      loadMoreBtn.disabled = true;
    }
    
    // Simulate loading delay
    setTimeout(() => {
      currentPage++;
      renderCards();
      
      if (loadMoreBtn) {
        loadMoreBtn.textContent = 'Load More';
        loadMoreBtn.disabled = false;
      }
      
      isLoading = false;
    }, 500);
  };

  // Public API
  return {
    init,
    renderCards
  };
})();

// Initialize
FeedPage.init();
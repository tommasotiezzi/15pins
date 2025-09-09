/**
 * Itinerary Card Component
 * Self-contained component that always fetches its own data
 * Place in: js/components/itinerary-card.js
 */

const ItineraryCard = (() => {
  
  /**
   * Create an itinerary card HTML
   * @param {Object} itinerary - The itinerary data with characteristics as DB columns
   * @param {String} context - 'feed', 'preview', 'dashboard'
   * @returns {String} HTML string for the card
   */
  const create = (itinerary, context = 'feed') => {
    // Validate data
    if (!itinerary) {
      return '<div class="error-card">Invalid itinerary data</div>';
    }
    
    // Calculate stats
    const stats = calculateStats(itinerary);
    
    // Build card HTML
    return `
      <div class="itinerary-card enhanced" 
           data-itinerary-id="${itinerary.id}"
           data-context="${context}">
        
        ${renderCardImage(itinerary)}
        
        <div class="card-content-enhanced">
          ${renderCardHeader(itinerary)}
          ${renderCharacteristics(itinerary)}
          ${renderCardStats(stats, itinerary)}
          ${renderCardFooter(itinerary, context)}
        </div>
      </div>
    `;
  };
  
  /**
   * Calculate statistics from itinerary data
   */
  const calculateStats = (itinerary) => {
    let totalStops = 0;
    
    if (itinerary.days && Array.isArray(itinerary.days)) {
      itinerary.days.forEach(day => {
        if (day.stops && Array.isArray(day.stops)) {
          totalStops += day.stops.length;
        }
      });
    }
    
    const avgStopsPerDay = itinerary.duration_days > 0 ? 
      Math.round(totalStops / itinerary.duration_days) : 0;
    
    return {
      totalStops,
      avgStopsPerDay
    };
  };
  
  /**
   * Render card image section with badges
   */
  const renderCardImage = (itinerary) => {
    const price = itinerary.price_tier || itinerary.price || 9;
    const tierLabel = price === 19 ? 'DETAILED' : 'ESSENTIAL';
    
    return `
      <div class="card-image-enhanced">
        ${itinerary.cover_image_url ? 
          `<img src="${itinerary.cover_image_url}" 
                alt="${itinerary.title}" 
                loading="lazy"
                onerror="this.parentElement.innerHTML='<div class=\\'card-image-placeholder\\'><svg width=\\'60\\' height=\\'60\\' fill=\\'none\\' opacity=\\'0.3\\'><path d=\\'M30 15C23 15 17 21 17 28C17 35 30 50 30 50C30 50 43 35 43 28C43 21 37 15 30 15Z\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'/></svg></div>'">` :
          `<div class="card-image-placeholder">
            <svg width="60" height="60" fill="none" opacity="0.3">
              <path d="M30 15C23 15 17 21 17 28C17 35 30 50 30 50C30 50 43 35 43 28C43 21 37 15 30 15Z" 
                    stroke="currentColor" stroke-width="2"/>
            </svg>
          </div>`
        }
        <div class="card-badges-overlay">
          <span class="card-badge-duration">📅 ${itinerary.duration_days || 0} days</span>
          <span class="card-badge-price tier-${tierLabel.toLowerCase()}">
            €${price}
            <span class="tier-label">${tierLabel}</span>
          </span>
        </div>
      </div>
    `;
  };
  
  /**
   * Render card header with title and location
   */
  const renderCardHeader = (itinerary) => {
    return `
      <div class="card-header-enhanced">
        <h3 class="card-title-enhanced">
          ${itinerary.title || 'Untitled Itinerary'}
        </h3>
        <div class="card-location-enhanced">
          <svg width="14" height="14" fill="none">
            <path d="M7 1C4 1 2 3 2 6C2 9 7 13 7 13C7 13 12 9 12 6C12 3 10 1 7 1Z" 
                  stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <span>${itinerary.destination || 'Unknown'}</span>
        </div>
      </div>
    `;
  };
  
  /**
   * Render characteristics badges
   * Reads from database columns: physical_demand, cultural_immersion, pace, budget_level, social_style
   */
  const renderCharacteristics = (itinerary) => {
    const specs = [
      { 
        key: 'physical_demand', 
        icon: '💪', 
        labels: ['V.Easy', 'Easy', 'Moderate', 'Active', 'Hard'] 
      },
      { 
        key: 'cultural_immersion', 
        icon: '🌍', 
        labels: ['Tourist', 'Mixed', 'Balanced', 'Local', 'Immersive'] 
      },
      { 
        key: 'pace', 
        icon: '⚡', 
        labels: ['V.Slow', 'Relaxed', 'Moderate', 'Fast', 'Packed'] 
      },
      { 
        key: 'budget_level', 
        icon: '💰', 
        labels: ['Budget', 'Economy', 'Mid', 'Upscale', 'Luxury'] 
      },
      { 
        key: 'social_style', 
        icon: '👥', 
        labels: ['Solo', 'Couples', 'Friends', 'Family', 'Groups'] 
      }
    ];
    
    // Build badges for characteristics that have values
    const badges = [];
    
    specs.forEach(spec => {
      const value = itinerary[spec.key];
      
      // Check if value exists and is valid (1-5)
      if (value && value >= 1 && value <= 5) {
        const labelIndex = parseInt(value) - 1;
        const label = spec.labels[labelIndex];
        
        if (label) {
          badges.push(`
            <span class="char-badge">
              ${spec.icon} ${label}
            </span>
          `);
        }
      }
    });
    
    // Return badges or empty state
    if (badges.length > 0) {
      return `<div class="card-characteristics-subtle">${badges.join('')}</div>`;
    } else {
      return '<div class="card-characteristics-empty">No characteristics set</div>';
    }
  };
  
  /**
   * Render card statistics
   */
  const renderCardStats = (stats, itinerary) => {
    return `
      <div class="card-stats-enhanced">
        <div class="stat-item">
          <span class="stat-icon">📍</span>
          <span class="stat-value">${stats.totalStops}</span>
          <span class="stat-label">stops</span>
        </div>
        <div class="stat-item">
          <span class="stat-icon">⏱️</span>
          <span class="stat-value">${stats.avgStopsPerDay}</span>
          <span class="stat-label">per day</span>
        </div>
        ${itinerary.total_sales > 0 ? `
          <div class="stat-item">
            <span class="stat-icon">⭐</span>
            <span class="stat-value">${itinerary.total_sales}</span>
            <span class="stat-label">sold</span>
          </div>
        ` : ''}
      </div>
    `;
  };
  
  /**
   * Render card footer based on context
   */
  const renderCardFooter = (itinerary, context) => {
    if (context === 'preview') {
      return `
        <div class="card-footer-enhanced preview-mode">
          <button class="btn btn-secondary btn-sm" data-action="preview-modal">
            👁️ Preview Modal
          </button>
          <button class="btn btn-primary btn-sm" data-action="back-to-build">
            Continue Editing
          </button>
        </div>
      `;
    } else if (context === 'dashboard') {
      return `
        <div class="card-footer-enhanced dashboard-mode">
          <div class="creator-stats">
            <span>👁️ ${itinerary.view_count || 0}</span>
            <span>🛒 ${itinerary.total_sales || 0}</span>
          </div>
          <button class="icon-btn" data-action="edit-itinerary" data-id="${itinerary.id}">
            ✏️
          </button>
        </div>
      `;
    } else {
      // Feed context
      return `
        <div class="card-footer-enhanced">
          ${itinerary.creator ? `
            <div class="creator-info-enhanced">
              <img src="${itinerary.creator.avatar_url || '/images/default-avatar.png'}" 
                   alt="${itinerary.creator.username || 'Creator'}" 
                   class="creator-avatar-small"
                   onerror="this.src='/images/default-avatar.png'">
              <span class="creator-name">${itinerary.creator.username || 'Anonymous'}</span>
            </div>
          ` : ''}
          <button class="wishlist-btn ${itinerary.is_wishlisted ? 'active' : ''}" 
                  data-action="wishlist" 
                  data-id="${itinerary.id}">
            ${itinerary.is_wishlisted ? '❤️' : '🤍'}
          </button>
        </div>
      `;
    }
  };
  
  /**
   * Open modal with itinerary data
   * Always fetches fresh data from API
   */
  const openModal = async (itineraryId, context) => {
    if (!itineraryId) {
      console.error('No itinerary ID provided');
      return;
    }
    
    try {
      // Always fetch fresh data
      // Use drafts API for draft itineraries, regular API for published
      const response = context === 'preview' ? 
        await API.drafts.getPreview(itineraryId) :
        await API.itineraries.get(itineraryId);
      
      if (response.error || !response.data) {
        console.error('Failed to load itinerary:', response.error);
        Toast.error('Failed to load itinerary');
        return;
      }
      
      const itinerary = response.data;
      
      console.log('Opening modal with itinerary:', itinerary);
      
      // Emit event to open modal
      Events.emit('trip-modal:open', { 
        itinerary, 
        context 
      });
      
    } catch (error) {
      console.error('Error opening modal:', error);
      Toast.error('Failed to open itinerary');
    }
  };
  
  /**
   * Toggle wishlist status
   */
  const toggleWishlist = async (itineraryId) => {
    if (!itineraryId) return;
    
    try {
      const response = await API.wishlists.toggle(itineraryId);
      
      if (response.success) {
        // Update button UI
        const button = document.querySelector(`[data-action="wishlist"][data-id="${itineraryId}"]`);
        if (button) {
          button.classList.toggle('active');
          button.textContent = button.classList.contains('active') ? '❤️' : '🤍';
        }
        
        Toast.success(response.is_wishlisted ? 'Added to wishlist' : 'Removed from wishlist');
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error);
      Toast.error('Failed to update wishlist');
    }
  };
  
  /**
   * Render multiple cards as a grid
   */
  const renderCards = (itineraries, context = 'feed') => {
    if (!itineraries || itineraries.length === 0) {
      return `
        <div class="empty-state">
          <h3>No itineraries found</h3>
          <p>Check back later for new travel inspiration!</p>
        </div>
      `;
    }
    
    return `
      <div class="itinerary-cards-grid">
        ${itineraries.map(itinerary => create(itinerary, context)).join('')}
      </div>
    `;
  };
  
  /**
   * Initialize component and set up event listeners
   */
  const init = () => {
    console.log('ItineraryCard component initialized');
    
    // Event delegation for all card interactions
    document.addEventListener('click', handleCardClick);
  };
  
  /**
   * Handle all card click events
   */
  const handleCardClick = (e) => {
    // Preview modal button
    if (e.target.closest('[data-action="preview-modal"]')) {
      e.preventDefault();
      e.stopPropagation();
      
      const card = e.target.closest('.itinerary-card');
      const id = card?.dataset.itineraryId;
      
      if (id) {
        openModal(id, 'preview');
      }
      return;
    }
    
    // Back to build button
    if (e.target.closest('[data-action="back-to-build"]')) {
      e.preventDefault();
      e.stopPropagation();
      
      Events.emit('action:back-to-build');
      return;
    }
    
    // Wishlist button
    if (e.target.closest('[data-action="wishlist"]')) {
      e.preventDefault();
      e.stopPropagation();
      
      const button = e.target.closest('[data-action="wishlist"]');
      const id = button.dataset.id;
      
      if (id) {
        toggleWishlist(id);
      }
      return;
    }
    
    // Edit button (dashboard)
    if (e.target.closest('[data-action="edit-itinerary"]')) {
      e.preventDefault();
      e.stopPropagation();
      
      const button = e.target.closest('[data-action="edit-itinerary"]');
      const id = button.dataset.id;
      
      if (id) {
        // Navigate to edit page
        window.location.href = `#create?draft=${id}`;
      }
      return;
    }
    
    // Card click (open modal)
    const card = e.target.closest('.itinerary-card.enhanced');
    if (card && !e.target.closest('button')) {
      e.preventDefault();
      
      const id = card.dataset.itineraryId;
      const context = card.dataset.context || 'feed';
      
      if (id) {
        openModal(id, context);
      }
    }
  };
  
  // Public API
  return {
    create,
    renderCards,
    openModal,
    toggleWishlist,
    init
  };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ItineraryCard.init);
} else {
  ItineraryCard.init();
}

// Make available globally
window.ItineraryCard = ItineraryCard;
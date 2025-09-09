/**
 * Itinerary Card Component
 * Displays itinerary summary cards with characteristics
 * Place in: js/components/itinerary-card.js
 */

const ItineraryCard = (() => {
  /**
   * Create an itinerary card HTML
   * @param {Object} itinerary - The itinerary data from database
   * @param {String} context - 'feed', 'preview', 'dashboard'
   * @returns {String} HTML string for the card
   */
  const create = (itinerary, context = 'feed') => {
    // Calculate stats from the data
    const stats = calculateStats(itinerary);
    
    return `
      <div class="itinerary-card enhanced" 
           data-itinerary-id="${itinerary.id || 'preview'}"
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
    
    // Handle both draft format and regular format
    if (itinerary.days) {
      itinerary.days.forEach(day => {
        if (day.stops) {
          totalStops += day.stops.length;
        }
      });
    }
    
    return {
      totalStops,
      avgStopsPerDay: itinerary.duration_days ? 
        Math.round(totalStops / itinerary.duration_days) : 0
    };
  };

  /**
   * Render card image with badges
   */
  const renderCardImage = (itinerary) => {
    const price = itinerary.price_tier || itinerary.price || 9;
    const tierLabel = price === 19 ? 'DETAILED' : 'ESSENTIAL';
    
    return `
      <div class="card-image-enhanced">
        ${itinerary.cover_image_url ? 
          `<img src="${itinerary.cover_image_url}" alt="${itinerary.title}" loading="lazy">` :
          `<div class="card-image-placeholder">
            <svg width="60" height="60" fill="none" opacity="0.3">
              <path d="M30 15C23 15 17 21 17 28C17 35 30 50 30 50C30 50 43 35 43 28C43 21 37 15 30 15Z" 
                    stroke="currentColor" stroke-width="2"/>
            </svg>
          </div>`
        }
        <div class="card-badges-overlay">
          <span class="card-badge-duration">📅 ${itinerary.duration_days} days</span>
          <span class="card-badge-price tier-${tierLabel.toLowerCase()}">
            €${price}
            <span class="tier-label">${tierLabel}</span>
          </span>
        </div>
      </div>
    `;
  };

  /**
   * Render card header
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
   * Render characteristics as subtle badges
   */
  const renderCharacteristics = (itinerary) => {
    // Try both field names - API might strip 'draft_' prefix
    const chars = itinerary.characteristics || 
                  itinerary.draft_characteristics || 
                  {};
    
    console.log('Card received itinerary:', itinerary);
    console.log('Looking for characteristics, found:', chars);
    
    if (!chars || Object.keys(chars).length === 0) {
      return '<div class="card-characteristics-empty">No characteristics set</div>';
    }
    
    const specs = [
      { key: 'physical_demand', icon: '💪', labels: ['V.Easy', 'Easy', 'Moderate', 'Active', 'Hard'] },
      { key: 'cultural_immersion', icon: '🌍', labels: ['Tourist', 'Mixed', 'Balanced', 'Local', 'Immersive'] },
      { key: 'pace', icon: '⚡', labels: ['V.Slow', 'Relaxed', 'Moderate', 'Fast', 'Packed'] },
      { key: 'budget_level', icon: '💰', labels: ['Budget', 'Economy', 'Mid', 'Upscale', 'Luxury'] },
      { key: 'social_style', icon: '👥', labels: ['Solo', 'Couples', 'Friends', 'Family', 'Groups'] }
    ];
    
    const badges = specs
      .filter(spec => chars[spec.key])
      .map(spec => {
        const value = chars[spec.key];
        console.log(`Creating badge for ${spec.key}: ${value}`);
        return `
          <span class="char-badge">
            ${spec.icon} ${spec.labels[value - 1]}
          </span>
        `;
      });
    
    console.log('Created badges:', badges);
    
    return badges.length > 0 ? 
      `<div class="card-characteristics-subtle">${badges.join('')}</div>` : 
      '<div class="card-characteristics-empty">No characteristics set</div>';
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
        ${itinerary.total_sales ? `
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
      // Feed context - show creator info
      return `
        <div class="card-footer-enhanced">
          ${itinerary.creator ? `
            <div class="creator-info-enhanced">
              <img src="${itinerary.creator.avatar_url || '/images/default-avatar.png'}" 
                   alt="${itinerary.creator.username}" 
                   class="creator-avatar-small"
                   onerror="this.src='/images/default-avatar.png'">
              <span class="creator-name">${itinerary.creator.username}</span>
            </div>
          ` : ''}
          <button class="wishlist-btn" data-action="wishlist" data-id="${itinerary.id}">
            ❤️
          </button>
        </div>
      `;
    }
  };

  /**
   * Open modal with proper data
   */
  const openModal = async (itineraryId, context) => {
    try {
      let itinerary;
      
      if (context === 'preview') {
        // Get draft data from Step 4
        itinerary = window.CreatePage?.getCurrentDraft?.();
        if (!itinerary) {
          console.error('No draft data available');
          return;
        }
      } else {
        // Fetch from database
        const response = await API.itineraries.get(itineraryId);
        if (response.error || !response.data) {
          Toast.error('Failed to load itinerary');
          return;
        }
        itinerary = response.data;
      }
      
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
    // Implementation for wishlist toggle
    console.log('Toggle wishlist for:', itineraryId);
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
        ${itineraries.map(it => create(it, context)).join('')}
      </div>
    `;
  };

  /**
   * Initialize component
   */
  const init = () => {
    console.log('ItineraryCard component initialized');
    
    // Set up delegated event listeners
    document.addEventListener('click', (e) => {
      // Handle card clicks
      const card = e.target.closest('.itinerary-card.enhanced');
      if (card && !e.target.closest('button')) {
        const id = card.dataset.itineraryId;
        const context = card.dataset.context;
        openModal(id, context);
        return;
      }
      
      // Handle preview modal button
      if (e.target.closest('[data-action="preview-modal"]')) {
        e.stopPropagation();
        openModal('preview', 'preview');
        return;
      }
      
      // Handle continue editing button
      if (e.target.closest('[data-action="back-to-build"]')) {
        e.stopPropagation();
        console.log('Continue editing clicked');
        Events.emit('create:continue-editing');
        // Also emit navigation event
        Events.emit('action:back-to-build');
        return;
      }
      
      // Handle wishlist button
      if (e.target.closest('[data-action="wishlist"]')) {
        e.stopPropagation();
        const button = e.target.closest('[data-action="wishlist"]');
        const id = button.dataset.id;
        toggleWishlist(id);
        return;
      }
    });
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
document.addEventListener('DOMContentLoaded', ItineraryCard.init);

// Make available globally
window.ItineraryCard = ItineraryCard;
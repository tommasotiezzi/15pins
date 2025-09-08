/**
 * Itinerary Card Component
 * Reusable card for displaying itinerary summaries
 * Place in: js/components/itinerary-card.js
 */

const ItineraryCard = (() => {
  /**
   * Create an itinerary card HTML
   * @param {Object} itinerary - The itinerary data
   * @param {String} context - 'feed', 'preview', 'dashboard'
   * @returns {String} HTML string for the card
   */
  const create = (itinerary, context = 'feed') => {
    const stats = calculateStats(itinerary);
    const characteristics = getCharacteristicBadges(itinerary.characteristics);
    const isWishlisted = checkWishlistStatus(itinerary.id);
    
    return `
      <div class="itinerary-card enhanced" 
           data-itinerary-id="${itinerary.id || 'preview'}"
           data-context="${context}">
        
        ${renderCardImage(itinerary)}
        
        <div class="card-content-enhanced">
          ${renderCardHeader(itinerary)}
          ${renderCharacteristicBadges(characteristics)}
          ${renderCardStats(stats, itinerary)}
          ${renderCardFooter(itinerary, context, isWishlisted)}
        </div>
      </div>
    `;
  };

  /**
   * Calculate statistics for the itinerary
   */
  const calculateStats = (itinerary) => {
    let totalStops = 0;
    
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
   * Get characteristic badges to display
   */
  const getCharacteristicBadges = (characteristics) => {
    if (!characteristics) return [];
    
    const badges = [];
    const labels = {
      physical_demand: ['Very Easy', 'Easy', 'Moderate', 'Active', 'Challenging'],
      pace: ['Relaxed', 'Easy', 'Moderate', 'Fast', 'Packed'],
      budget_level: ['Budget', 'Economy', 'Mid-Range', 'Upscale', 'Luxury']
    };
    
    // Physical demand badge
    if (characteristics.physical_demand) {
      badges.push({
        type: 'physical',
        label: labels.physical_demand[characteristics.physical_demand - 1],
        value: characteristics.physical_demand
      });
    }
    
    // Pace badge
    if (characteristics.pace) {
      badges.push({
        type: 'pace',
        label: labels.pace[characteristics.pace - 1],
        value: characteristics.pace
      });
    }
    
    // Budget badge
    if (characteristics.budget_level) {
      badges.push({
        type: 'budget',
        label: labels.budget_level[characteristics.budget_level - 1],
        value: characteristics.budget_level
      });
    }
    
    return badges;
  };

  /**
   * Check if itinerary is wishlisted
   */
  const checkWishlistStatus = (itineraryId) => {
    const wishlist = State.get('wishlist') || [];
    return wishlist.includes(itineraryId);
  };

  /**
   * Render card image section
   */
  const renderCardImage = (itinerary) => {
    return `
      <div class="card-image-enhanced" 
           onclick="ItineraryCard.handleCardClick('${itinerary.id}', '${itinerary.context || 'feed'}')">
        ${itinerary.cover_image_url ? 
          `<img src="${itinerary.cover_image_url}" 
                alt="${itinerary.title}"
                loading="lazy">` :
          `<div class="card-image-placeholder">
            <svg width="60" height="60" fill="none" opacity="0.3">
              <path d="M30 15C23 15 17 21 17 28C17 35 30 50 30 50C30 50 43 35 43 28C43 21 37 15 30 15Z" 
                    stroke="currentColor" stroke-width="2"/>
            </svg>
          </div>`
        }
        <div class="card-badges-overlay">
          <span class="card-badge-duration">${itinerary.duration_days} days</span>
          <span class="card-badge-price">€${itinerary.price_tier}</span>
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
        <h3 class="card-title-enhanced" 
            onclick="ItineraryCard.handleCardClick('${itinerary.id}', '${itinerary.context || 'feed'}')">
          ${itinerary.title || 'Untitled Itinerary'}
        </h3>
        <div class="card-location-enhanced">
          <svg width="16" height="16" fill="none">
            <path d="M8 8.5C9.1 8.5 10 7.6 10 6.5C10 5.4 9.1 4.5 8 4.5C6.9 4.5 6 5.4 6 6.5C6 7.6 6.9 8.5 8 8.5Z" 
                  stroke="currentColor"/>
            <path d="M8 1C5 1 2.5 3.5 2.5 6.5C2.5 10.5 8 15 8 15C8 15 13.5 10.5 13.5 6.5C13.5 3.5 11 1 8 1Z" 
                  stroke="currentColor"/>
          </svg>
          ${itinerary.destination || 'Unknown'}
        </div>
      </div>
    `;
  };

  /**
   * Render characteristic badges
   */
  const renderCharacteristicBadges = (badges) => {
    if (!badges || badges.length === 0) return '';
    
    return `
      <div class="card-characteristics">
        ${badges.map(badge => `
          <span class="char-badge char-badge-${badge.type}" 
                data-value="${badge.value}">
            ${badge.label}
          </span>
        `).join('')}
      </div>
    `;
  };

  /**
   * Render card statistics
   */
  const renderCardStats = (stats, itinerary) => {
    return `
      <div class="card-stats-enhanced">
        <div class="stat-item">
          <span class="stat-icon">📍</span>
          <span class="stat-text">${stats.totalStops} stops</span>
        </div>
        <div class="stat-item">
          <span class="stat-icon">⏱️</span>
          <span class="stat-text">${stats.avgStopsPerDay}/day</span>
        </div>
        ${itinerary.total_sales ? `
          <div class="stat-item">
            <span class="stat-icon">⭐</span>
            <span class="stat-text">${itinerary.total_sales} sold</span>
          </div>
        ` : ''}
      </div>
    `;
  };

  /**
   * Render card footer
   */
  const renderCardFooter = (itinerary, context, isWishlisted) => {
    if (context === 'preview') {
      return `
        <div class="card-footer-enhanced">
          <button class="btn btn-secondary btn-sm" 
                  onclick="ItineraryCard.handleCardClick('${itinerary.id}', 'preview')">
            <svg width="16" height="16" fill="none">
              <path d="M1 8C1 8 3.5 2 8 2C12.5 2 15 8 15 8C15 8 12.5 14 8 14C3.5 14 1 8 1 8Z" 
                    stroke="currentColor" stroke-width="1.5"/>
              <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            Full Preview
          </button>
          <button class="btn btn-primary btn-sm" 
                  data-action="back-to-build">
            Continue Editing
          </button>
        </div>
      `;
    } else if (context === 'dashboard') {
      return `
        <div class="card-footer-enhanced">
          <div class="creator-stats">
            <span>${itinerary.view_count || 0} views</span>
            <span>${itinerary.total_sales || 0} sales</span>
          </div>
          <div class="card-actions">
            <button class="icon-btn" data-action="edit-itinerary" 
                    data-id="${itinerary.id}" aria-label="Edit">
              <svg width="16" height="16" fill="none">
                <path d="M11 2L14 5L5 14L2 14L2 11L11 2Z" 
                      stroke="currentColor" stroke-width="1.5"/>
              </svg>
            </button>
            <button class="icon-btn" data-action="view-stats" 
                    data-id="${itinerary.id}" aria-label="Stats">
              <svg width="16" height="16" fill="none">
                <path d="M2 14V7M8 14V2M14 14V9" 
                      stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    } else {
      // Default feed context
      return `
        <div class="card-footer-enhanced">
          <div class="creator-info-enhanced">
            ${itinerary.creator ? `
              <img src="${itinerary.creator.avatar_url || 'https://i.pravatar.cc/32'}" 
                   alt="${itinerary.creator.username}" 
                   class="creator-avatar-small"
                   loading="lazy">
              <span class="creator-name">${itinerary.creator.username}</span>
            ` : ''}
          </div>
          <button class="wishlist-btn-enhanced ${isWishlisted ? 'active' : ''}" 
                  data-action="wishlist" 
                  data-id="${itinerary.id}"
                  aria-label="${isWishlisted ? 'Remove from' : 'Add to'} wishlist">
            <svg width="18" height="18" fill="${isWishlisted ? 'currentColor' : 'none'}">
              <path d="M9 16L2 9C0 7 1 3 4 4L9 9L14 4C17 3 18 7 16 9L9 16Z" 
                    stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </button>
        </div>
      `;
    }
  };

  /**
   * Handle card click
   */
  const handleCardClick = (itineraryId, context) => {
    event.stopPropagation(); // Prevent event bubbling
    
    if (context === 'preview') {
      // For preview, use the current draft data
      const currentDraft = window.CreatePage?.getCurrentDraft?.();
      if (currentDraft) {
        Events.emit('trip-modal:open', { 
          itinerary: currentDraft, 
          context: 'preview' 
        });
      }
    } else {
      // For feed/dashboard, fetch the full itinerary
      fetchAndOpenModal(itineraryId, context);
    }
  };

  /**
   * Fetch itinerary and open modal
   */
  const fetchAndOpenModal = async (itineraryId, context) => {
    try {
      const { data: itinerary, error } = await API.itineraries.get(itineraryId);
      
      if (error || !itinerary) {
        Toast.error('Failed to load itinerary details');
        return;
      }
      
      Events.emit('trip-modal:open', { 
        itinerary, 
        context: context === 'dashboard' ? 'edit' : 'view' 
      });
    } catch (err) {
      console.error('Error loading itinerary:', err);
      Toast.error('Failed to load itinerary');
    }
  };

  /**
   * Render multiple cards
   */
  const renderCards = (itineraries, context = 'feed') => {
    if (!itineraries || itineraries.length === 0) {
      return `
        <div class="empty-state">
          <svg width="48" height="48" fill="none" opacity="0.3">
            <path d="M24 12C18 12 13 17 13 23C13 29 24 40 24 40C24 40 35 29 35 23C35 17 30 12 24 12Z" 
                  stroke="currentColor" stroke-width="2"/>
          </svg>
          <h3>No itineraries found</h3>
          <p>Check back later for new travel inspiration!</p>
        </div>
      `;
    }
    
    return itineraries.map(it => create(it, context)).join('');
  };

  /**
   * Initialize card interactions
   */
  const init = () => {
    // This can be called to set up any global card listeners if needed
    console.log('ItineraryCard component initialized');
  };

  // Public API
  return {
    create,
    renderCards,
    handleCardClick,
    init
  };
})();

// Make available globally
window.ItineraryCard = ItineraryCard;
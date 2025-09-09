/**
 * Itinerary Card Component
 * Reusable card for displaying itinerary summaries with full transparency
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
    const isWishlisted = checkWishlistStatus(itinerary.id);
    
    return `
      <div class="itinerary-card enhanced" 
           data-itinerary-id="${itinerary.id || 'preview'}"
           data-context="${context}">
        
        ${renderCardImage(itinerary)}
        
        <div class="card-content-enhanced">
          ${renderCardHeader(itinerary)}
          ${renderFullCharacteristics(itinerary.characteristics)}
          ${renderCardStats(stats, itinerary)}
          ${renderCardFooter(itinerary, context, isWishlisted)}
        </div>
      </div>
    `;
  };

  /**
   * Calculate comprehensive statistics for the itinerary
   */
  const calculateStats = (itinerary) => {
    let totalStops = 0;
    let totalCost = 0;
    let stopTypes = new Set();
    
    if (itinerary.days) {
      itinerary.days.forEach(day => {
        if (day.stops) {
          totalStops += day.stops.length;
          day.stops.forEach(stop => {
            if (stop.cost_cents) {
              totalCost += stop.cost_cents;
            }
            if (stop.type) {
              stopTypes.add(stop.type);
            }
          });
        }
      });
    }
    
    return {
      totalStops,
      avgStopsPerDay: itinerary.duration_days ? 
        Math.round(totalStops / itinerary.duration_days) : 0,
      totalCost,
      hasAccommodation: stopTypes.has('accommodation'),
      hasTransport: stopTypes.has('transport'),
      uniqueStopTypes: stopTypes.size
    };
  };

  /**
   * Check if itinerary is wishlisted
   */
  const checkWishlistStatus = (itineraryId) => {
    const wishlist = State.get('wishlist') || [];
    return wishlist.includes(itineraryId);
  };

  /**
   * Render card image section with price tier indicator
   */
  const renderCardImage = (itinerary) => {
    const tierLabel = itinerary.price_tier === 19 ? 'DETAILED' : 'ESSENTIAL';
    const tierClass = itinerary.price_tier === 19 ? 'detailed' : 'basic';
    
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
          <span class="card-badge-duration">📅 ${itinerary.duration_days} days</span>
          <span class="card-badge-price tier-${tierClass}">
            €${itinerary.price_tier}
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
        <h3 class="card-title-enhanced" 
            onclick="ItineraryCard.handleCardClick('${itinerary.id}', '${itinerary.context || 'feed'}')">
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
   * Render all 5 characteristics with visual indicators
   */
  const renderFullCharacteristics = (characteristics) => {
    if (!characteristics) return '';
    
    const specs = [
      {
        key: 'physical_demand',
        icon: '💪',
        labels: ['Very Easy', 'Easy', 'Moderate', 'Active', 'Challenging'],
        shortLabels: ['V.Easy', 'Easy', 'Moderate', 'Active', 'Hard']
      },
      {
        key: 'cultural_immersion',
        icon: '🌍',
        labels: ['Tourist Path', 'Some Local', 'Balanced', 'Mostly Local', 'Full Immersion'],
        shortLabels: ['Tourist', 'Mixed', 'Balanced', 'Local', 'Immersive']
      },
      {
        key: 'pace',
        icon: '⚡',
        labels: ['Very Relaxed', 'Relaxed', 'Moderate', 'Fast', 'Packed'],
        shortLabels: ['V.Slow', 'Relaxed', 'Moderate', 'Fast', 'Packed']
      },
      {
        key: 'budget_level',
        icon: '💰',
        labels: ['Backpacker', 'Budget', 'Mid-Range', 'Upscale', 'Luxury'],
        shortLabels: ['Backpack', 'Budget', 'Mid', 'Upscale', 'Luxury']
      },
      {
        key: 'social_style',
        icon: '👥',
        labels: ['Solo', 'Couples', 'Friends', 'Families', 'Groups'],
        shortLabels: ['Solo', 'Couples', 'Friends', 'Family', 'Groups']
      }
    ];
    
    return `
      <div class="card-characteristics-full">
        ${specs.map(spec => {
          const value = characteristics[spec.key];
          if (!value) return '';
          
          return `
            <div class="char-item" title="${spec.labels[value - 1]}">
              <span class="char-icon">${spec.icon}</span>
              <span class="char-label">${spec.shortLabels[value - 1]}</span>
              <div class="char-dots">
                ${Array.from({length: 5}, (_, i) => 
                  `<span class="dot ${i < value ? 'filled' : ''}"></span>`
                ).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  };

  /**
   * Render comprehensive card statistics
   */
  const renderCardStats = (stats, itinerary) => {
    const includesLabels = [];
    if (stats.hasAccommodation) includesLabels.push('🏨 Stay');
    if (stats.hasTransport) includesLabels.push('🚌 Transport');
    
    return `
      <div class="card-stats-enhanced">
        <div class="primary-stats">
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
            <div class="stat-item highlight">
              <span class="stat-icon">⭐</span>
              <span class="stat-value">${itinerary.total_sales}</span>
              <span class="stat-label">sold</span>
            </div>
          ` : ''}
        </div>
        ${includesLabels.length > 0 ? `
          <div class="includes-labels">
            ${includesLabels.map(label => `<span class="include-tag">${label}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  };

  /**
   * Render card footer with creator info and actions
   */
  const renderCardFooter = (itinerary, context, isWishlisted) => {
    if (context === 'preview') {
      return `
        <div class="card-footer-enhanced preview-mode">
          <div class="preview-notice">
            <svg width="16" height="16" fill="none">
              <path d="M8 4v4m0 4h.01M14 8A6 6 0 112 8a6 6 0 0112 0z" 
                    stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span>Preview Mode</span>
          </div>
          <div class="preview-actions">
            <button class="btn btn-secondary btn-sm" 
                    onclick="ItineraryCard.handleCardClick('${itinerary.id}', 'preview')">
              <svg width="16" height="16" fill="none">
                <path d="M1 8C1 8 3.5 2 8 2C12.5 2 15 8 15 8C15 8 12.5 14 8 14C3.5 14 1 8 1 8Z" 
                      stroke="currentColor" stroke-width="1.5"/>
                <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              Preview
            </button>
            <button class="btn btn-primary btn-sm" 
                    data-action="back-to-build">
              Continue
            </button>
          </div>
        </div>
      `;
    } else if (context === 'dashboard') {
      return `
        <div class="card-footer-enhanced dashboard-mode">
          <div class="creator-stats">
            <span class="stat-mini">
              <svg width="14" height="14" fill="none">
                <path d="M1 7C1 7 3 2 7 2C11 2 13 7 13 7C13 7 11 12 7 12C3 12 1 7 1 7Z" 
                      stroke="currentColor"/>
                <circle cx="7" cy="7" r="2" stroke="currentColor"/>
              </svg>
              ${itinerary.view_count || 0}
            </span>
            <span class="stat-mini">
              <svg width="14" height="14" fill="none">
                <path d="M3 13h8l-1-9H4l-1 9zM7 2v2M5 4h4" 
                      stroke="currentColor" stroke-linecap="round"/>
              </svg>
              ${itinerary.total_sales || 0}
            </span>
            ${itinerary.revenue_cents ? `
              <span class="stat-mini revenue">
                €${(itinerary.revenue_cents / 100).toFixed(0)}
              </span>
            ` : ''}
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
                    data-id="${itinerary.id}" aria-label="Analytics">
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
              <div class="creator-details">
                <span class="creator-name">${itinerary.creator.username}</span>
                ${itinerary.creator.trip_count ? `
                  <span class="creator-meta">${itinerary.creator.trip_count} trips</span>
                ` : ''}
              </div>
            ` : ''}
          </div>
          <button class="wishlist-btn-enhanced ${isWishlisted ? 'active' : ''}" 
                  data-action="wishlist" 
                  data-id="${itinerary.id}"
                  aria-label="${isWishlisted ? 'Remove from' : 'Add to'} wishlist">
            <svg width="20" height="20" fill="${isWishlisted ? 'currentColor' : 'none'}">
              <path d="M10 17L3 10C1 8 2 4 5 5L10 10L15 5C18 4 19 8 17 10L10 17Z" 
                    stroke="currentColor" stroke-width="1.5"/>
            </svg>
          </button>
        </div>
      `;
    }
  };

  /**
   * Handle card click event
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
      // Show loading state on card
      const card = document.querySelector(`[data-itinerary-id="${itineraryId}"]`);
      if (card) {
        card.classList.add('loading');
      }
      
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
    } finally {
      // Remove loading state
      const card = document.querySelector(`[data-itinerary-id="${itineraryId}"]`);
      if (card) {
        card.classList.remove('loading');
      }
    }
  };

  /**
   * Handle wishlist toggle
   */
  const handleWishlistToggle = async (itineraryId, button) => {
    const isActive = button.classList.contains('active');
    
    try {
      if (isActive) {
        await API.wishlists.remove(itineraryId);
        button.classList.remove('active');
        const svg = button.querySelector('svg');
        if (svg) svg.setAttribute('fill', 'none');
        Toast.success('Removed from wishlist');
      } else {
        await API.wishlists.add(itineraryId);
        button.classList.add('active');
        const svg = button.querySelector('svg');
        if (svg) svg.setAttribute('fill', 'currentColor');
        Toast.success('Added to wishlist');
      }
      
      // Update local state
      const wishlist = State.get('wishlist') || [];
      if (isActive) {
        State.set('wishlist', wishlist.filter(id => id !== itineraryId));
      } else {
        State.set('wishlist', [...wishlist, itineraryId]);
      }
    } catch (error) {
      console.error('Wishlist error:', error);
      Toast.error('Failed to update wishlist');
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
            <circle cx="24" cy="23" r="3" stroke="currentColor" stroke-width="2"/>
          </svg>
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
   * Initialize card interactions
   */
  const init = () => {
    // Set up delegated event listeners
    document.addEventListener('click', (e) => {
      // Handle wishlist button clicks
      if (e.target.closest('[data-action="wishlist"]')) {
        e.stopPropagation();
        const button = e.target.closest('[data-action="wishlist"]');
        const itineraryId = button.dataset.id;
        handleWishlistToggle(itineraryId, button);
      }
      
      // Handle back to build button
      if (e.target.closest('[data-action="back-to-build"]')) {
        e.stopPropagation();
        Events.emit('create:continue-editing');
        // Also close modal if open
        if (typeof TripModal !== 'undefined' && TripModal.close) {
          TripModal.close();
        }
      }
      
      // Handle edit button
      if (e.target.closest('[data-action="edit-itinerary"]')) {
        e.stopPropagation();
        const button = e.target.closest('[data-action="edit-itinerary"]');
        const itineraryId = button.dataset.id;
        window.location.href = `/create?edit=${itineraryId}`;
      }
      
      // Handle stats button
      if (e.target.closest('[data-action="view-stats"]')) {
        e.stopPropagation();
        const button = e.target.closest('[data-action="view-stats"]');
        const itineraryId = button.dataset.id;
        Events.emit('analytics:open', { itineraryId });
      }
    });
    
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', ItineraryCard.init);

// Make available globally
window.ItineraryCard = ItineraryCard;
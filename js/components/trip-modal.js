/**
 * Trip Details Modal Component
 * Displays complete or partial itinerary information based on purchase status
 * Place in: js/components/trip-modal.js
 */

const TripModal = (() => {
  let currentItinerary = null;
  let currentContext = 'view'; // 'preview', 'view', 'edit'
  let currentUser = null;
  let isPurchased = false;
  let modalElement = null;

  /**
   * Initialize the modal component
   */
  const init = () => {
    // Listen for modal events
    Events.on('trip-modal:open', open);
    Events.on('trip-modal:close', close);
    
    // Create modal element on init
    createModalElement();
    
    // Set up event delegation for modal actions
    document.addEventListener('click', handleModalClicks);
    
    // Set up keyboard handler
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalElement?.classList.contains('active')) {
        close();
      }
    });
  };

  /**
   * Handle all modal click events
   */
  const handleModalClicks = (e) => {
    // Close modal when clicking overlay
    if (e.target.classList.contains('trip-modal-overlay')) {
      close();
      return;
    }
    
    // Close button
    if (e.target.closest('.trip-modal-close')) {
      close();
      return;
    }
    
    // Continue Editing button in preview mode
    if (e.target.closest('[data-action="back-to-build"]')) {
      close();
      Events.emit('create:continue-editing');
      return;
    }
    
    // Purchase button
    if (e.target.closest('.btn-purchase')) {
      handlePurchase();
      return;
    }
    
    // Wishlist button
    if (e.target.closest('[data-action="wishlist"]')) {
      const button = e.target.closest('[data-action="wishlist"]');
      const itineraryId = button.dataset.id;
      handleWishlist(itineraryId, button);
      return;
    }
  };

  /**
   * Open the trip modal
   * @param {Object} data - Contains itinerary and context
   */
  const open = async (data) => {
    currentItinerary = data.itinerary;
    currentContext = data.context || 'view';
    
    // Get current user to check ownership
    try {
      currentUser = await API.auth.getUser();
    } catch (error) {
      currentUser = null;
    }
    
    // Check if user owns this itinerary or has purchased it
    const isOwner = currentUser && currentItinerary.creator_id === currentUser.id;
    const isPreviewMode = currentContext === 'preview';
    
    // For now, assume not purchased unless it's owner or preview mode
    // In production, you'd check the purchases table
    isPurchased = isOwner || isPreviewMode;
    
    if (!modalElement) {
      createModalElement();
    }
    
    renderContent();
    modalElement.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  /**
   * Close the modal
   */
  const close = () => {
    if (modalElement) {
      modalElement.classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  /**
   * Create the modal element if it doesn't exist
   */
  const createModalElement = () => {
    // Remove existing modal if present
    const existing = document.getElementById('trip-modal');
    if (existing) {
      existing.remove();
    }
    
    modalElement = document.createElement('div');
    modalElement.id = 'trip-modal';
    modalElement.className = 'trip-modal';
    modalElement.innerHTML = `
      <div class="trip-modal-overlay"></div>
      <div class="trip-modal-content">
        <button class="trip-modal-close" aria-label="Close">
          <svg width="24" height="24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <div id="trip-modal-body"></div>
      </div>
    `;
    document.body.appendChild(modalElement);
  };

  /**
   * Calculate statistics for the itinerary
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
      totalCost,
      hasAccommodation: stopTypes.has('accommodation'),
      hasTransport: stopTypes.has('transport'),
      avgStopsPerDay: itinerary.duration_days ? (totalStops / itinerary.duration_days).toFixed(1) : 0
    };
  };

  /**
   * Determine which days to show in preview
   */
  const getPreviewDays = () => {
    const totalDays = currentItinerary.duration_days || 0;
    
    // For trips 5 days or less, only show day 1
    if (totalDays <= 5) {
      return [0]; // Just first day
    }
    
    // For longer trips, show day 1 and a middle day
    const middleDay = Math.floor(totalDays / 2);
    return [0, middleDay]; // First day and middle day
  };

  /**
   * Render the modal content
   */
  const renderContent = () => {
    const body = document.getElementById('trip-modal-body');
    if (!body || !currentItinerary) return;
    
    const stats = calculateStats(currentItinerary);
    const isDetailed = currentItinerary.price_tier === 19;
    
    body.innerHTML = `
      ${renderHeader()}
      ${renderCharacteristics()}
      ${renderQuickStats(stats)}
      ${!isPurchased && currentContext !== 'preview' ? renderPurchasePrompt() : ''}
      ${renderDayByDay(isDetailed)}
      ${renderEssentials()}
      ${renderFooter()}
    `;
    
    // Set up collapsible day sections
    setupDayToggles();
  };

  /**
   * Render purchase prompt for unpurchased itineraries
   */
  const renderPurchasePrompt = () => {
    const previewDays = getPreviewDays();
    const daysText = previewDays.length === 1 ? 'Day 1' : `Day 1 and Day ${previewDays[1] + 1}`;
    
    return `
      <div class="purchase-prompt-banner">
        <div class="prompt-content">
          <h3>🔍 Preview Mode</h3>
          <p>You're viewing a preview with ${daysText} unlocked. Purchase to access all ${currentItinerary.duration_days} days, insider tips, and travel essentials.</p>
          <button class="btn btn-primary btn-purchase">
            Unlock Full Itinerary - €${currentItinerary.price_tier}
          </button>
        </div>
      </div>
    `;
  };

  /**
   * Render modal header
   */
  const renderHeader = () => {
    const it = currentItinerary;
    
    return `
      <div class="trip-modal-header">
        ${it.cover_image_url ? 
          `<img src="${it.cover_image_url}" alt="${it.title}" class="trip-modal-cover">` :
          `<div class="trip-modal-cover-placeholder">
            <svg width="80" height="80" fill="none" opacity="0.2">
              <path d="M40 20C30 20 22 28 22 38C22 48 40 68 40 68C40 68 58 48 58 38C58 28 50 20 40 20Z" 
                    stroke="currentColor" stroke-width="2"/>
            </svg>
          </div>`
        }
        
        <div class="trip-modal-title-section">
          <h1>${it.title || 'Untitled Itinerary'}</h1>
          <div class="trip-modal-meta">
            <span>📍 ${it.destination || 'Unknown'}</span>
            <span>📅 ${it.duration_days || 0} days</span>
            <span class="trip-modal-price">€${it.price_tier || 0}</span>
          </div>
          ${it.description ? `<p class="trip-modal-description">${it.description}</p>` : ''}
        </div>
        
        ${currentContext === 'preview' ? 
          '<div class="preview-badge">Creator Preview</div>' : 
          (!isPurchased ? '<div class="preview-badge">Preview Mode</div>' : '')
        }
      </div>
    `;
  };

  /**
   * Render characteristics section with full details
   */
  const renderCharacteristics = () => {
    const chars = currentItinerary.characteristics;
    if (!chars) return '';
    
    const specs = [
      {
        key: 'physical_demand',
        title: 'Physical Demand',
        icon: '💪',
        labels: ['Very Easy', 'Easy', 'Moderate', 'Challenging', 'Very Challenging'],
        descriptions: [
          'Minimal walking, suitable for all ages',
          'Light walking, mostly flat terrain',
          'Moderate activity, some hills/stairs',
          'Active pace, significant walking/hiking',
          'Strenuous activities, high fitness required'
        ]
      },
      {
        key: 'cultural_immersion',
        title: 'Cultural Immersion',
        icon: '🌍',
        labels: ['Tourist Path', 'Some Local', 'Balanced', 'Mostly Local', 'Full Immersion'],
        descriptions: [
          'Popular tourist attractions and areas',
          'Mix of tourist sites and local spots',
          'Equal tourist and authentic experiences',
          'Mostly local neighborhoods and culture',
          'Complete cultural immersion, off the beaten path'
        ]
      },
      {
        key: 'pace',
        title: 'Trip Pace',
        icon: '⚡',
        labels: ['Very Relaxed', 'Relaxed', 'Moderate', 'Fast', 'Packed'],
        descriptions: [
          '1-2 activities per day, lots of free time',
          '2-3 stops daily, leisurely exploration',
          'Balanced schedule with rest breaks',
          'Full days with multiple activities',
          'Dawn to dusk, maximizing every moment'
        ]
      },
      {
        key: 'budget_level',
        title: 'Budget Level',
        icon: '💰',
        labels: ['Backpacker', 'Budget', 'Mid-Range', 'Upscale', 'Luxury'],
        descriptions: [
          'Hostels, street food, public transport',
          'Budget hotels, local restaurants',
          'Comfortable hotels, mix of dining',
          'Quality hotels, nice restaurants',
          'Premium accommodation and experiences'
        ]
      },
      {
        key: 'social_style',
        title: 'Best For',
        icon: '👥',
        labels: ['Solo', 'Couples', 'Friends', 'Families', 'Groups'],
        descriptions: [
          'Perfect for solo travelers',
          'Romantic spots for couples',
          'Fun activities for friend groups',
          'Family-friendly with all ages',
          'Large group accommodations and activities'
        ]
      }
    ];
    
    return `
      <div class="trip-characteristics-display">
        <h2>Trip Characteristics</h2>
        <div class="characteristics-grid">
          ${specs.map(spec => {
            const value = chars[spec.key];
            if (!value) return '';
            
            return renderCharacteristic(
              spec.title,
              spec.icon,
              value,
              spec.labels,
              spec.descriptions[value - 1]
            );
          }).join('')}
        </div>
      </div>
    `;
  };

  /**
   * Render individual characteristic with description
   */
  const renderCharacteristic = (title, icon, value, labels, description) => {
    const dots = Array.from({length: 5}, (_, i) => 
      `<span class="char-dot ${i < value ? 'filled' : ''}"></span>`
    ).join('');
    
    return `
      <div class="characteristic-item">
        <div class="char-header">
          <span class="char-icon">${icon}</span>
          <span class="char-title">${title}</span>
        </div>
        <div class="char-value">
          <div class="char-dots">${dots}</div>
          <span class="char-label">${labels[value - 1]}</span>
        </div>
        <p class="char-description">${description}</p>
      </div>
    `;
  };

  /**
   * Render quick stats
   */
  const renderQuickStats = (stats) => {
    return `
      <div class="trip-quick-stats">
        <div class="stat-item">
          <span class="stat-value">${stats.totalStops}</span>
          <span class="stat-label">Total Stops</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${stats.avgStopsPerDay}</span>
          <span class="stat-label">Stops/Day</span>
        </div>
        ${isPurchased && stats.totalCost > 0 ? `
          <div class="stat-item">
            <span class="stat-value">€${(stats.totalCost / 100).toFixed(0)}</span>
            <span class="stat-label">Est. Cost</span>
          </div>
        ` : ''}
        ${currentItinerary.total_sales ? `
          <div class="stat-item">
            <span class="stat-value">${currentItinerary.total_sales}</span>
            <span class="stat-label">Sold</span>
          </div>
        ` : ''}
      </div>
    `;
  };

  /**
   * Render day by day breakdown
   */
  const renderDayByDay = (isDetailed) => {
    const days = currentItinerary.days || [];
    if (days.length === 0) return '<p>No days added yet.</p>';
    
    const previewDays = (isPurchased || currentContext === 'preview') ? null : getPreviewDays();
    
    return `
      <div class="trip-days-section">
        <h2>Day by Day Itinerary</h2>
        ${previewDays ? `
          <p class="preview-notice">
            🔓 Showing preview of ${previewDays.length === 1 ? '1 day' : '2 days'} out of ${days.length} total days
          </p>
        ` : ''}
        <div class="days-container">
          ${days.map((day, index) => {
            const isUnlocked = !previewDays || previewDays.includes(index);
            return renderDay(day, index, isDetailed, isUnlocked);
          }).join('')}
        </div>
      </div>
    `;
  };

  /**
   * Render individual day
   */
  const renderDay = (day, index, isDetailed, isUnlocked) => {
    const stopCount = day.stops?.length || 0;
    
    if (!isUnlocked) {
      // Locked day - show minimal info
      return `
        <div class="trip-day-item locked">
          <div class="day-header locked-header">
            <div class="day-title">
              <span class="day-number">Day ${day.day_number}</span>
              <strong>${day.title || `Day ${day.day_number}`}</strong>
              <span class="day-stops-count">${stopCount} stops</span>
            </div>
            <svg class="lock-icon" width="20" height="20" fill="none">
              <rect x="5" y="9" width="10" height="8" rx="1" stroke="currentColor" stroke-width="2"/>
              <path d="M7 9V6a3 3 0 016 0v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="day-content locked-content">
            <p class="locked-message">
              🔒 This day includes ${stopCount} carefully selected stops. 
              Purchase to unlock detailed information, tips, and insider knowledge.
            </p>
          </div>
        </div>
      `;
    }
    
    // Unlocked day - show full content
    return `
      <div class="trip-day-item ${isUnlocked ? 'unlocked' : ''}">
        <div class="day-header" data-day-index="${index}">
          <div class="day-title">
            <span class="day-number">Day ${day.day_number}</span>
            <strong>${day.title || `Day ${day.day_number}`}</strong>
            <span class="day-stops-count">${stopCount} stops</span>
            ${previewDays && !isPurchased ? '<span class="preview-badge-small">Preview</span>' : ''}
          </div>
          <svg class="day-toggle-icon" width="20" height="20" fill="none">
            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="day-content" style="display: none;">
          ${day.description ? `<p class="day-description">${day.description}</p>` : ''}
          <div class="stops-list">
            ${day.stops?.map((stop, i) => renderStop(stop, i, isDetailed)).join('') || 
              '<p class="no-stops">No stops added for this day.</p>'}
          </div>
        </div>
      </div>
    `;
  };

  /**
   * Render individual stop
   */
  const renderStop = (stop, index, isDetailed) => {
    const typeIcons = {
      attraction: '🏛️',
      food: '🍜',
      accommodation: '🏨',
      transport: '🚌',
      beach: '🏖️',
      nightlife: '🌃',
      shopping: '🛍️',
      activity: '🎯'
    };
    
    return `
      <div class="stop-detail">
        <div class="stop-header">
          <span class="stop-number">${index + 1}</span>
          <span class="stop-icon">${typeIcons[stop.type] || '📍'}</span>
          <strong class="stop-name">${stop.name || 'Unnamed stop'}</strong>
        </div>
        
        ${isDetailed ? `
          <div class="stop-meta">
            ${stop.time_period ? `<span class="meta-item">⏰ ${stop.time_period}</span>` : ''}
            ${stop.start_time ? `<span class="meta-item">🕐 ${stop.start_time}</span>` : ''}
            ${stop.duration_minutes ? `<span class="meta-item">⏱️ ${stop.duration_minutes} min</span>` : ''}
            ${stop.cost_cents ? `<span class="meta-item">💶 €${(stop.cost_cents / 100).toFixed(2)}</span>` : ''}
          </div>
        ` : ''}
        
        ${stop.tip || stop.description ? `
          <p class="stop-description">${stop.tip || stop.description}</p>
        ` : ''}
        
        ${stop.location ? `
          <p class="stop-location">📍 ${stop.location}</p>
        ` : ''}
      </div>
    `;
  };

  /**
   * Render travel essentials - fully visible in preview mode
   */
  const renderEssentials = () => {
    const { transportation, accommodation, travel_tips } = currentItinerary;
    
    if (!transportation && !accommodation && !travel_tips) return '';
    
    // For unpurchased (not preview mode), show that essentials exist but lock content
    if (!isPurchased && currentContext !== 'preview') {
      return `
        <div class="trip-essentials-section locked">
          <h2>Travel Essentials</h2>
          <div class="essentials-locked">
            ${transportation ? `
              <div class="locked-essential-item">
                <span class="essential-icon">🚕</span>
                <div>
                  <strong>Transportation Guide</strong>
                  <p>✓ Getting there instructions</p>
                  <p>✓ Local transport tips</p>
                </div>
                <span class="lock-icon">🔒</span>
              </div>
            ` : ''}
            ${accommodation ? `
              <div class="locked-essential-item">
                <span class="essential-icon">🏨</span>
                <div>
                  <strong>Accommodation Tips</strong>
                  <p>✓ Best areas to stay</p>
                  <p>✓ Booking recommendations</p>
                </div>
                <span class="lock-icon">🔒</span>
              </div>
            ` : ''}
            ${travel_tips ? `
              <div class="locked-essential-item">
                <span class="essential-icon">💡</span>
                <div>
                  <strong>Insider Travel Tips</strong>
                  <p>✓ Best time to visit</p>
                  <p>✓ Budget breakdown</p>
                  <p>✓ Packing suggestions</p>
                </div>
                <span class="lock-icon">🔒</span>
              </div>
            ` : ''}
            <p class="unlock-message">
              Purchase to unlock all travel essentials and insider knowledge
            </p>
          </div>
        </div>
      `;
    }
    
    // Full content for purchased/preview
    return `
      <div class="trip-essentials-section">
        <h2>Travel Essentials</h2>
        
        ${transportation ? `
          <div class="essential-block">
            <h3>🚕 Transportation</h3>
            ${transportation.getting_there ? 
              `<div class="essential-item">
                <strong>Getting There:</strong>
                <p>${transportation.getting_there}</p>
              </div>` : ''}
            ${transportation.getting_around ? 
              `<div class="essential-item">
                <strong>Getting Around:</strong>
                <p>${transportation.getting_around}</p>
              </div>` : ''}
            ${transportation.local_transport_tips ? 
              `<div class="essential-item">
                <strong>Transport Tips:</strong>
                <p>${transportation.local_transport_tips}</p>
              </div>` : ''}
          </div>
        ` : ''}
        
        ${accommodation ? `
          <div class="essential-block">
            <h3>🏨 Accommodation</h3>
            ${accommodation.area_recommendations ? 
              `<div class="essential-item">
                <strong>Best Areas to Stay:</strong>
                <p>${accommodation.area_recommendations}</p>
              </div>` : ''}
            ${accommodation.booking_tips ? 
              `<div class="essential-item">
                <strong>Booking Tips:</strong>
                <p>${accommodation.booking_tips}</p>
              </div>` : ''}
          </div>
        ` : ''}
        
        ${travel_tips ? `
          <div class="essential-block">
            <h3>💡 Travel Tips</h3>
            ${travel_tips.best_time_to_visit ? 
              `<div class="essential-item">
                <strong>Best Time to Visit:</strong>
                <p>${travel_tips.best_time_to_visit}</p>
              </div>` : ''}
            ${travel_tips.visa_requirements ? 
              `<div class="essential-item">
                <strong>Visa Requirements:</strong>
                <p>${travel_tips.visa_requirements}</p>
              </div>` : ''}
            ${travel_tips.packing_suggestions ? 
              `<div class="essential-item">
                <strong>What to Pack:</strong>
                <p>${travel_tips.packing_suggestions}</p>
              </div>` : ''}
            ${travel_tips.budget_breakdown ? 
              `<div class="essential-item">
                <strong>Budget Breakdown:</strong>
                <p>${travel_tips.budget_breakdown}</p>
              </div>` : ''}
            ${travel_tips.other_tips ? 
              `<div class="essential-item">
                <strong>Other Tips:</strong>
                <p>${travel_tips.other_tips}</p>
              </div>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  };

  /**
   * Render modal footer with properly positioned actions
   */
  const renderFooter = () => {
    if (currentContext === 'preview') {
      return `
        <div class="trip-modal-footer preview-footer">
          <div class="preview-note">
            <svg width="20" height="20" fill="none">
              <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2"/>
              <path d="M10 6v4M10 14h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <p>This is how buyers will see your itinerary. They'll have access to ${
              currentItinerary.duration_days <= 5 ? 'Day 1 only' : 'Day 1 and Day ' + (Math.floor(currentItinerary.duration_days / 2) + 1)
            } as a preview.</p>
          </div>
          <div class="footer-actions">
            <button class="btn btn-secondary" onclick="TripModal.close()">
              Close Preview
            </button>
            <button class="btn btn-primary" data-action="back-to-build">
              Continue Editing
            </button>
          </div>
        </div>
      `;
    } else if (currentContext === 'view') {
      return `
        <div class="trip-modal-footer">
          <div class="creator-info">
            ${currentItinerary.creator ? `
              <img src="${currentItinerary.creator.avatar_url || 'https://i.pravatar.cc/60'}" 
                   alt="${currentItinerary.creator.username}" 
                   class="creator-avatar">
              <div>
                <strong>${currentItinerary.creator.username}</strong>
                ${currentItinerary.creator.bio ? 
                  `<p>${currentItinerary.creator.bio}</p>` : ''}
              </div>
            ` : ''}
          </div>
          <div class="action-buttons">
            ${!isPurchased ? `
              <button class="btn btn-secondary" data-action="wishlist" 
                      data-id="${currentItinerary.id}">
                Save to Wishlist
              </button>
              <button class="btn btn-primary btn-purchase">
                Purchase €${currentItinerary.price_tier}
              </button>
            ` : `
              <button class="btn btn-secondary" onclick="TripModal.close()">
                Close
              </button>
            `}
          </div>
        </div>
      `;
    }
    
    return '';
  };

  /**
   * Set up day toggle functionality
   */
  const setupDayToggles = () => {
    document.querySelectorAll('.day-header:not(.locked-header)').forEach(header => {
      header.addEventListener('click', () => {
        const content = header.nextElementSibling;
        const icon = header.querySelector('.day-toggle-icon');
        
        if (content.style.display === 'none' || !content.style.display) {
          content.style.display = 'block';
          if (icon) icon.style.transform = 'rotate(180deg)';
        } else {
          content.style.display = 'none';
          if (icon) icon.style.transform = 'rotate(0)';
        }
      });
    });
  };

  /**
   * Handle purchase action
   */
  const handlePurchase = () => {
    Events.emit('purchase:initiate', { itinerary: currentItinerary });
  };

  /**
   * Handle wishlist action
   */
  const handleWishlist = async (itineraryId, button) => {
    // Implementation would go here
    console.log('Wishlist action for:', itineraryId);
  };

  // Public API
  return {
    init,
    open,
    close
  };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', TripModal.init);
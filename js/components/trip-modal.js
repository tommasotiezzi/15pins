/**
 * Trip Details Modal Component
 * Displays complete itinerary information in a modal
 * Place in: js/components/trip-modal.js
 */

const TripModal = (() => {
  let currentItinerary = null;
  let currentContext = 'view'; // 'preview', 'view', 'edit'

  /**
   * Initialize the modal component
   */
  const init = () => {
    // Listen for modal events
    Events.on('trip-modal:open', open);
    Events.on('trip-modal:close', close);
    
    // Set up close handlers
    document.addEventListener('click', (e) => {
      if (e.target.id === 'trip-modal' || e.target.classList.contains('trip-modal-close')) {
        close();
      }
    });
    
    // Set up keyboard handler
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('trip-modal')?.classList.contains('active')) {
        close();
      }
    });
  };

  /**
   * Open the trip modal
   * @param {Object} data - Contains itinerary and context
   */
  const open = (data) => {
    currentItinerary = data.itinerary;
    currentContext = data.context || 'view';
    
    let modal = document.getElementById('trip-modal');
    if (!modal) {
      createModalElement();
      modal = document.getElementById('trip-modal');
    }
    
    renderContent();
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  /**
   * Close the modal
   */
  const close = () => {
    const modal = document.getElementById('trip-modal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  /**
   * Create the modal element if it doesn't exist
   */
  const createModalElement = () => {
    const modal = document.createElement('div');
    modal.id = 'trip-modal';
    modal.className = 'trip-modal';
    modal.innerHTML = `
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
    document.body.appendChild(modal);
  };

  /**
   * Calculate statistics for the itinerary
   */
  const calculateStats = (itinerary) => {
    let totalStops = 0;
    let totalCost = 0;
    let hasAccommodation = false;
    let hasTransport = false;
    
    if (itinerary.days) {
      itinerary.days.forEach(day => {
        if (day.stops) {
          totalStops += day.stops.length;
          day.stops.forEach(stop => {
            if (stop.cost_cents) {
              totalCost += stop.cost_cents;
            }
            if (stop.type === 'accommodation') hasAccommodation = true;
            if (stop.type === 'transport') hasTransport = true;
          });
        }
      });
    }
    
    return {
      totalStops,
      totalCost,
      hasAccommodation,
      hasTransport,
      avgStopsPerDay: itinerary.duration_days ? (totalStops / itinerary.duration_days).toFixed(1) : 0
    };
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
      ${renderDayByDay(isDetailed)}
      ${renderEssentials()}
      ${renderFooter()}
    `;
    
    // Set up collapsible day sections
    setupDayToggles();
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
          '<div class="preview-badge">Preview Mode</div>' : ''
        }
      </div>
    `;
  };

  /**
   * Render characteristics section
   */
  const renderCharacteristics = () => {
    const chars = currentItinerary.characteristics;
    if (!chars) return '';
    
    const labels = {
      physical_demand: ['Very Easy', 'Easy', 'Moderate', 'Challenging', 'Very Challenging'],
      cultural_immersion: ['Tourist Path', 'Some Local', 'Balanced', 'Mostly Local', 'Full Immersion'],
      pace: ['Very Relaxed', 'Relaxed', 'Moderate', 'Fast', 'Packed'],
      budget_level: ['Backpacker', 'Budget', 'Mid-Range', 'Upscale', 'Luxury'],
      social_style: ['Solo', 'Couples', 'Friends', 'Families', 'Groups']
    };
    
    const icons = {
      physical_demand: '💪',
      cultural_immersion: '🌍',
      pace: '⚡',
      budget_level: '💰',
      social_style: '👥'
    };
    
    return `
      <div class="trip-characteristics-display">
        <h2>Trip Characteristics</h2>
        <div class="characteristics-grid">
          ${renderCharacteristic('Physical Demand', icons.physical_demand, 
            chars.physical_demand, labels.physical_demand)}
          ${renderCharacteristic('Cultural Immersion', icons.cultural_immersion, 
            chars.cultural_immersion, labels.cultural_immersion)}
          ${renderCharacteristic('Pace', icons.pace, 
            chars.pace, labels.pace)}
          ${renderCharacteristic('Budget Level', icons.budget_level, 
            chars.budget_level, labels.budget_level)}
          ${renderCharacteristic('Best For', icons.social_style, 
            chars.social_style, labels.social_style)}
        </div>
      </div>
    `;
  };

  /**
   * Render individual characteristic
   */
  const renderCharacteristic = (title, icon, value, labels) => {
    if (!value) return '';
    
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
        ${stats.totalCost > 0 ? `
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
    
    return `
      <div class="trip-days-section">
        <h2>Day by Day Itinerary</h2>
        <div class="days-container">
          ${days.map((day, index) => renderDay(day, index, isDetailed)).join('')}
        </div>
      </div>
    `;
  };

  /**
   * Render individual day
   */
  const renderDay = (day, index, isDetailed) => {
    const stopCount = day.stops?.length || 0;
    
    return `
      <div class="trip-day-item">
        <div class="day-header" data-day-index="${index}">
          <div class="day-title">
            <span class="day-number">Day ${day.day_number}</span>
            <strong>${day.title || `Day ${day.day_number}`}</strong>
            <span class="day-stops-count">${stopCount} stops</span>
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
   * Render travel essentials
   */
  const renderEssentials = () => {
    const { transportation, accommodation, travel_tips } = currentItinerary;
    
    if (!transportation && !accommodation && !travel_tips) return '';
    
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
   * Render modal footer with actions
   */
  const renderFooter = () => {
    if (currentContext === 'preview') {
      return `
        <div class="trip-modal-footer">
          <button class="btn btn-secondary" onclick="TripModal.close()">
            Close Preview
          </button>
          <button class="btn btn-primary" data-action="back-to-build">
            Continue Editing
          </button>
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
            <button class="btn btn-secondary" data-action="wishlist" 
                    data-id="${currentItinerary.id}">
              Save to Wishlist
            </button>
            <button class="btn btn-primary btn-purchase">
              Purchase €${currentItinerary.price_tier}
            </button>
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
    document.querySelectorAll('.day-header').forEach(header => {
      header.addEventListener('click', () => {
        const content = header.nextElementSibling;
        const icon = header.querySelector('.day-toggle-icon');
        
        if (content.style.display === 'none' || !content.style.display) {
          content.style.display = 'block';
          icon.style.transform = 'rotate(180deg)';
        } else {
          content.style.display = 'none';
          icon.style.transform = 'rotate(0)';
        }
      });
    });
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
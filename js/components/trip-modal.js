/**
 * Trip Details Modal Component
 * Displays complete itinerary information with proper creator/buyer logic
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
    
    // Create modal element
    createModalElement();
    
    // Set up keyboard handler
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalElement?.classList.contains('active')) {
        close();
      }
    });
  };

  /**
   * Create the modal element
   */
  const createModalElement = () => {
    const existing = document.getElementById('trip-modal');
    if (existing) existing.remove();
    
    modalElement = document.createElement('div');
    modalElement.id = 'trip-modal';
    modalElement.className = 'trip-modal';
    modalElement.innerHTML = `
      <div class="trip-modal-overlay" onclick="TripModal.close()"></div>
      <div class="trip-modal-content">
        <button class="trip-modal-close" onclick="TripModal.close()">
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
   * Open the modal
   */
  const open = async (data) => {
    currentItinerary = data.itinerary;
    currentContext = data.context || 'view';
    
    // Get current user
    try {
      currentUser = await API.auth.getUser();
    } catch (error) {
      currentUser = null;
    }
    
    // Determine if this is creator's preview or a purchased item
    const isOwner = currentUser && currentItinerary.creator_id === currentUser.id;
    const isCreatorPreview = currentContext === 'preview';
    
    // In preview mode or if owner, show everything
    isPurchased = isOwner || isCreatorPreview;
    
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
   * Get which days to preview for unpurchased users
   */
  const getPreviewDays = () => {
    const totalDays = currentItinerary.duration_days || 0;
    if (totalDays <= 5) {
      return [0]; // Just day 1
    }
    const middleDay = Math.floor(totalDays / 2);
    return [0, middleDay]; // Day 1 and middle day
  };

  /**
   * Render modal content
   */
  const renderContent = () => {
    const body = document.getElementById('trip-modal-body');
    if (!body || !currentItinerary) return;
    
    body.innerHTML = `
      ${renderHeader()}
      ${renderCharacteristics()}
      ${renderStats()}
      ${!isPurchased && currentContext !== 'preview' ? renderPurchasePrompt() : ''}
      ${renderDays()}
      ${renderEssentials()}
      ${renderFooter()}
    `;
    
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
          `<div class="trip-modal-cover-placeholder"></div>`
        }
        
        <div class="trip-modal-title-section">
          <h1>${it.title || 'Untitled Itinerary'}</h1>
          <div class="trip-modal-meta">
            <span>📍 ${it.destination || 'Unknown'}</span>
            <span>📅 ${it.duration_days || 0} days</span>
            <span class="trip-modal-price">€${it.price_tier || it.price || 9}</span>
          </div>
          ${it.description ? `<p class="trip-modal-description">${it.description}</p>` : ''}
        </div>
        
        ${currentContext === 'preview' ? 
          '<div class="preview-badge">Creator Preview - Full Access</div>' : 
          (!isPurchased ? '<div class="preview-badge">Preview Mode - Limited Access</div>' : '')
        }
      </div>
    `;
  };

  /**
   * Render characteristics with full details
   */
  const renderCharacteristics = () => {
    const chars = currentItinerary.characteristics || currentItinerary.draft_characteristics || {};
    
    if (!chars || Object.keys(chars).length === 0) return '';
    
    const specs = [
      {
        key: 'physical_demand',
        title: 'Physical Demand',
        icon: '💪',
        labels: ['Very Easy', 'Easy', 'Moderate', 'Challenging', 'Very Challenging']
      },
      {
        key: 'cultural_immersion',
        title: 'Cultural Immersion',
        icon: '🌍',
        labels: ['Tourist Path', 'Some Local', 'Balanced', 'Mostly Local', 'Full Immersion']
      },
      {
        key: 'pace',
        title: 'Trip Pace',
        icon: '⚡',
        labels: ['Very Relaxed', 'Relaxed', 'Moderate', 'Fast', 'Packed']
      },
      {
        key: 'budget_level',
        title: 'Budget Level',
        icon: '💰',
        labels: ['Backpacker', 'Budget', 'Mid-Range', 'Upscale', 'Luxury']
      },
      {
        key: 'social_style',
        title: 'Best For',
        icon: '👥',
        labels: ['Solo', 'Couples', 'Friends', 'Families', 'Groups']
      }
    ];
    
    return `
      <div class="trip-characteristics-display">
        <h2>Trip Characteristics</h2>
        <div class="characteristics-grid">
          ${specs.map(spec => {
            const value = chars[spec.key];
            if (!value) return '';
            
            const dots = Array.from({length: 5}, (_, i) => 
              `<span class="char-dot ${i < value ? 'filled' : ''}"></span>`
            ).join('');
            
            return `
              <div class="characteristic-item">
                <div class="char-header">
                  <span class="char-icon">${spec.icon}</span>
                  <span class="char-title">${spec.title}</span>
                </div>
                <div class="char-value">
                  <div class="char-dots">${dots}</div>
                  <span class="char-label">${spec.labels[value - 1]}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  };

  /**
   * Render statistics
   */
  const renderStats = () => {
    let totalStops = 0;
    if (currentItinerary.days) {
      currentItinerary.days.forEach(day => {
        totalStops += (day.stops?.length || 0);
      });
    }
    
    const avgStopsPerDay = currentItinerary.duration_days ? 
      (totalStops / currentItinerary.duration_days).toFixed(1) : 0;
    
    return `
      <div class="trip-quick-stats">
        <div class="stat-item">
          <span class="stat-value">${totalStops}</span>
          <span class="stat-label">Total Stops</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${avgStopsPerDay}</span>
          <span class="stat-label">Stops/Day</span>
        </div>
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
   * Render purchase prompt
   */
  const renderPurchasePrompt = () => {
    const previewDaysIndices = getPreviewDays();
    const daysText = previewDaysIndices.length === 1 ? 'Day 1' : `Day 1 and Day ${previewDaysIndices[1] + 1}`;
    
    return `
      <div class="purchase-prompt-banner">
        <h3>🔍 Preview Mode</h3>
        <p>You're viewing ${daysText} as a preview. Purchase to unlock all ${currentItinerary.duration_days} days and travel essentials.</p>
        <button class="btn btn-primary" onclick="Events.emit('purchase:initiate', { itinerary: currentItinerary })">
          Unlock Full Itinerary - €${currentItinerary.price_tier || currentItinerary.price || 9}
        </button>
      </div>
    `;
  };

  /**
   * Render days section
   */
  const renderDays = () => {
    const days = currentItinerary.days || [];
    if (days.length === 0) return '<p>No days added yet.</p>';
    
    const previewDaysIndices = (isPurchased || currentContext === 'preview') ? null : getPreviewDays();
    
    return `
      <div class="trip-days-section">
        <h2>Day by Day Itinerary</h2>
        ${previewDaysIndices ? `
          <p class="preview-notice">
            🔓 Preview: ${previewDaysIndices.length === 1 ? '1 day' : '2 days'} out of ${days.length} total
          </p>
        ` : ''}
        <div class="days-container">
          ${days.map((day, index) => {
            const isUnlocked = !previewDaysIndices || previewDaysIndices.includes(index);
            return renderDay(day, index, isUnlocked);
          }).join('')}
        </div>
      </div>
    `;
  };

  /**
   * Render individual day
   */
  const renderDay = (day, index, isUnlocked) => {
    const stopCount = day.stops?.length || 0;
    
    if (!isUnlocked) {
      return `
        <div class="trip-day-item locked">
          <div class="day-header locked-header">
            <div class="day-title">
              <span class="day-number">Day ${day.day_number || index + 1}</span>
              <strong>${day.title || `Day ${index + 1}`}</strong>
              <span class="day-stops-count">${stopCount} stops</span>
            </div>
            <span class="lock-icon">🔒</span>
          </div>
          <div class="day-content locked-content">
            <p>Purchase to unlock ${stopCount} stops with detailed information and insider tips.</p>
          </div>
        </div>
      `;
    }
    
    return `
      <div class="trip-day-item unlocked">
        <div class="day-header" data-day-index="${index}">
          <div class="day-title">
            <span class="day-number">Day ${day.day_number || index + 1}</span>
            <strong>${day.title || `Day ${index + 1}`}</strong>
            <span class="day-stops-count">${stopCount} stops</span>
          </div>
          <svg class="day-toggle-icon" width="20" height="20" fill="none">
            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="day-content" style="display: none;">
          ${day.description ? `<p class="day-description">${day.description}</p>` : ''}
          <div class="stops-list">
            ${day.stops?.map((stop, i) => renderStop(stop, i)).join('') || 
              '<p class="no-stops">No stops added for this day.</p>'}
          </div>
        </div>
      </div>
    `;
  };

  /**
   * Render individual stop
   */
  const renderStop = (stop, index) => {
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
        ${stop.tip || stop.description ? `
          <p class="stop-description">${stop.tip || stop.description}</p>
        ` : ''}
        ${stop.duration_minutes ? `
          <span class="stop-meta">⏱️ ${stop.duration_minutes} min</span>
        ` : ''}
        ${stop.cost_cents ? `
          <span class="stop-meta">💶 €${(stop.cost_cents / 100).toFixed(2)}</span>
        ` : ''}
      </div>
    `;
  };

  /**
   * Render travel essentials
   */
  const renderEssentials = () => {
    const trans = currentItinerary.transportation || currentItinerary.draft_transportation;
    const accom = currentItinerary.accommodation || currentItinerary.draft_accommodation;
    const tips = currentItinerary.travel_tips || currentItinerary.draft_travel_tips;
    
    if (!trans && !accom && !tips) return '';
    
    // Lock for unpurchased users (not in preview)
    if (!isPurchased && currentContext !== 'preview') {
      return `
        <div class="trip-essentials-section locked">
          <h2>Travel Essentials</h2>
          <div class="essentials-locked">
            ${trans ? '<div class="locked-item">🚕 Transportation Guide - Locked</div>' : ''}
            ${accom ? '<div class="locked-item">🏨 Accommodation Tips - Locked</div>' : ''}
            ${tips ? '<div class="locked-item">💡 Insider Tips - Locked</div>' : ''}
            <p>Purchase to unlock all travel essentials</p>
          </div>
        </div>
      `;
    }
    
    // Full content for purchased/preview
    return `
      <div class="trip-essentials-section">
        <h2>Travel Essentials</h2>
        
        ${trans ? `
          <div class="essential-block">
            <h3>🚕 Transportation</h3>
            ${trans.getting_there ? `<p><strong>Getting There:</strong> ${trans.getting_there}</p>` : ''}
            ${trans.getting_around ? `<p><strong>Getting Around:</strong> ${trans.getting_around}</p>` : ''}
            ${trans.local_transport_tips ? `<p><strong>Tips:</strong> ${trans.local_transport_tips}</p>` : ''}
          </div>
        ` : ''}
        
        ${accom ? `
          <div class="essential-block">
            <h3>🏨 Accommodation</h3>
            ${accom.area_recommendations ? `<p><strong>Best Areas:</strong> ${accom.area_recommendations}</p>` : ''}
            ${accom.booking_tips ? `<p><strong>Booking Tips:</strong> ${accom.booking_tips}</p>` : ''}
          </div>
        ` : ''}
        
        ${tips ? `
          <div class="essential-block">
            <h3>💡 Travel Tips</h3>
            ${tips.best_time_to_visit ? `<p><strong>Best Time:</strong> ${tips.best_time_to_visit}</p>` : ''}
            ${tips.visa_requirements ? `<p><strong>Visa:</strong> ${tips.visa_requirements}</p>` : ''}
            ${tips.packing_suggestions ? `<p><strong>Packing:</strong> ${tips.packing_suggestions}</p>` : ''}
            ${tips.budget_breakdown ? `<p><strong>Budget:</strong> ${tips.budget_breakdown}</p>` : ''}
            ${tips.other_tips ? `<p><strong>Other:</strong> ${tips.other_tips}</p>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  };

  /**
   * Render modal footer
   */
  const renderFooter = () => {
    if (currentContext === 'preview') {
      return `
        <div class="trip-modal-footer preview-footer">
          <div class="preview-note">
            ℹ️ This is how your itinerary will appear to buyers. They'll see ${
              currentItinerary.duration_days <= 5 ? 'Day 1' : 'Day 1 and the middle day'
            } as a preview.
          </div>
          <button class="btn btn-secondary" onclick="TripModal.close()">Close Preview</button>
          <button class="btn btn-primary" onclick="TripModal.close(); Events.emit('create:continue-editing')">
            Continue Editing
          </button>
        </div>
      `;
    } else if (currentContext === 'view') {
      return `
        <div class="trip-modal-footer">
          ${currentItinerary.creator ? `
            <div class="creator-info">
              <img src="${currentItinerary.creator.avatar_url || 'https://i.pravatar.cc/60'}" 
                   alt="${currentItinerary.creator.username}" 
                   class="creator-avatar">
              <div>
                <strong>${currentItinerary.creator.username}</strong>
                ${currentItinerary.creator.bio ? `<p>${currentItinerary.creator.bio}</p>` : ''}
              </div>
            </div>
          ` : ''}
          <div class="action-buttons">
            ${!isPurchased ? `
              <button class="btn btn-primary">Purchase €${currentItinerary.price_tier || 9}</button>
            ` : `
              <button class="btn btn-secondary" onclick="TripModal.close()">Close</button>
            `}
          </div>
        </div>
      `;
    }
    
    return '';
  };

  /**
   * Setup day toggle functionality
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

  // Public API
  return {
    init,
    open,
    close
  };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', TripModal.init);

// Make available globally
window.TripModal = TripModal;
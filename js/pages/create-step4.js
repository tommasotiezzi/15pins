/**
 * Create Step 4 - Review & Publish
 * Fixed preview that uses draft data, improved UI
 */

const CreateStep4 = (() => {
  
  // ============= INITIALIZATION =============
  const init = () => {
    // Publishing events
    Events.on('action:publish', handlePublish);
    Events.on('action:save-as-draft', handleSaveAsDraft);
    
    // Navigation - back to build from card/modal goes to step 2
    Events.on('action:back-to-build', () => {
      // Close modal if open
      if (typeof TripModal !== 'undefined') {
        TripModal.close();
      }
      CreateController.handleStepTransition(4, 2);
    });
  };

  // ============= RENDER STEP =============
  const render = () => {
    const draft = CreateController.getCurrentDraft();
    if (!draft) return;
    
    const container = document.getElementById('step-4');
    if (!container) return;
    
    // Get current user for creator info
    const currentUser = State.get('currentUser');
    
    // Check completion status
    const checks = getChecklistStatus(draft);
    
    container.innerHTML = `
      <div class="review-container">
        <!-- Two Column Layout -->
        <div class="review-grid">
          
          <!-- Left Column: Preview -->
          <div class="preview-column">
            <div class="preview-header">
              <h2>📱 Marketplace Preview</h2>
              <p>This is how buyers will see your itinerary</p>
            </div>
            
            <div class="preview-card-wrapper">
              ${renderMarketplaceCard(draft, currentUser)}
            </div>
            
            <div class="preview-tip">
              💡 <strong>Tip:</strong> Click the card to see the full modal view that buyers will experience
            </div>
          </div>
          
          <!-- Right Column: Checklist & Actions -->
          <div class="checklist-column">
            <!-- Quality Checklist -->
            <div class="quality-checklist ${checks.isReady ? 'complete' : 'incomplete'}">
              <div class="checklist-header">
                <h3>${checks.isReady ? '✅' : '📋'} Quality Checklist</h3>
                <span class="checklist-status">
                  ${Object.values(checks).filter(v => v === true).length - 1}/5 Complete
                </span>
              </div>
              
              <div class="checklist-items">
                ${renderChecklistItem('Each day has 3+ stops', checks.hasEnoughStops, 
                  draft.days?.length ? `You have ${draft.days.map(d => d.stops?.length || 0).join(', ')} stops per day` : 'Add stops to each day')}
                
                ${renderChecklistItem('Personal tips included', checks.hasTips,
                  checks.hasTips ? 'All stops have tips' : 'Add tips to each stop')}
                
                ${renderChecklistItem('Transportation explained', checks.hasTransport,
                  checks.hasTransport ? 'Transport info added' : 'Add getting there/around info')}
                
                ${renderChecklistItem('Accommodation covered', checks.hasAccommodation,
                  checks.hasAccommodation ? 'Areas recommended' : 'Add area recommendations')}
                
                ${renderChecklistItem('Characteristics defined', checks.hasCharacteristics,
                  checks.hasCharacteristics ? 'All characteristics set' : 'Define trip characteristics')}
              </div>
              
              ${!checks.isReady ? `
                <div class="checklist-footer warning">
                  <span>⚠️ Complete all items to publish</span>
                </div>
              ` : `
                <div class="checklist-footer success">
                  <span>🎉 Ready to publish!</span>
                </div>
              `}
            </div>
            
            <!-- Earnings Preview -->
            <div class="earnings-preview">
              <h3>💰 Earnings Potential</h3>
              
              <div class="earnings-grid">
                <div class="earning-row">
                  <span>Price:</span>
                  <strong>€${draft.price_tier}</strong>
                </div>
                <div class="earning-row highlight">
                  <span>Your earnings (85%):</span>
                  <strong>€${(draft.price_tier * 0.85).toFixed(2)}</strong>
                </div>
                <div class="earning-row">
                  <span>Platform fee (15%):</span>
                  <span>€${(draft.price_tier * 0.15).toFixed(2)}</span>
                </div>
              </div>
              
              <div class="earnings-projections">
                <p><strong>Monthly projections:</strong></p>
                <div class="projection-bars">
                  <div class="projection-bar">
                    <div class="bar" style="width: 40%"></div>
                    <span>Conservative: €${((draft.price_tier * 0.85) * 10).toFixed(0)}</span>
                    <small>10 sales/month</small>
                  </div>
                  <div class="projection-bar">
                    <div class="bar" style="width: 70%"></div>
                    <span>Average: €${((draft.price_tier * 0.85) * 25).toFixed(0)}</span>
                    <small>25 sales/month</small>
                  </div>
                  <div class="projection-bar">
                    <div class="bar" style="width: 100%"></div>
                    <span>Top Creator: €${((draft.price_tier * 0.85) * 50).toFixed(0)}</span>
                    <small>50+ sales/month</small>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Action Buttons -->
            <div class="review-actions">
              <button type="button" class="btn btn-ghost" data-action="back-to-build">
                ← Back to Edit
              </button>
              
              <div class="primary-actions">
                <button type="button" class="btn btn-secondary" data-action="save-as-draft">
                  Save as Draft
                </button>
                
                <button type="button" 
                        class="btn btn-primary btn-publish ${checks.isReady ? 'ready' : 'disabled'}" 
                        data-action="publish"
                        ${!checks.isReady ? 'disabled' : ''}>
                  ${checks.isReady ? '🚀 Publish Now' : '🔒 Complete Checklist'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Initialize card click handler for preview
    setupCardPreview(draft, currentUser);
  };

  // ============= RENDER CHECKLIST ITEM =============
  const renderChecklistItem = (label, isComplete, helpText) => {
    return `
      <div class="checklist-item ${isComplete ? 'complete' : 'incomplete'}">
        <div class="item-main">
          <span class="item-check">${isComplete ? '✅' : '⭕'}</span>
          <span class="item-label">${label}</span>
        </div>
        <span class="item-help">${helpText}</span>
      </div>
    `;
  };

  // ============= RENDER MARKETPLACE CARD =============
  const renderMarketplaceCard = (draft, currentUser) => {
    // Transform draft to match itinerary structure for the card
    const itineraryPreview = {
      id: 'preview',
      title: draft.title || 'Untitled Itinerary',
      destination: draft.destination || 'Unknown',
      duration_days: draft.duration_days || 0,
      description: draft.description || '',
      price_tier: draft.price_tier || 9,
      cover_image_url: draft.cover_image_url || '',
      days: draft.days || [],
      characteristics: draft.characteristics || {},
      transportation: draft.transportation || null,
      accommodation: draft.accommodation || null,
      travel_tips: draft.travel_tips || null,
      total_sales: 0,
      view_count: 0,
      creator: {
        username: currentUser?.username || currentUser?.profile?.username || 'You',
        avatar_url: currentUser?.avatar_url || currentUser?.profile?.avatar_url || 'https://i.pravatar.cc/32',
        bio: currentUser?.bio || currentUser?.profile?.bio || ''
      }
    };
    
    // Use ItineraryCard component if available
    if (typeof ItineraryCard !== 'undefined') {
      return ItineraryCard.create(itineraryPreview, 'preview');
    } else {
      // Fallback if component not loaded
      return renderFallbackCard(itineraryPreview);
    }
  };

  // ============= FALLBACK CARD RENDER =============
  const renderFallbackCard = (itinerary) => {
    return `
      <div class="itinerary-card-fallback" onclick="CreateStep4.openPreviewModal()">
        <div class="card-image">
          ${itinerary.cover_image_url ? 
            `<img src="${itinerary.cover_image_url}" alt="${itinerary.title}">` :
            `<div class="image-placeholder">
              <svg width="60" height="60" fill="none" opacity="0.3">
                <path d="M30 15C23 15 17 21 17 28C17 35 30 50 30 50C30 50 43 35 43 28C43 21 37 15 30 15Z" 
                      stroke="currentColor" stroke-width="2"/>
              </svg>
            </div>`
          }
          <div class="price-badge">€${itinerary.price_tier}</div>
          <div class="duration-badge">${itinerary.duration_days} days</div>
        </div>
        <div class="card-content">
          <h3>${itinerary.title}</h3>
          <p class="location">📍 ${itinerary.destination}</p>
          <div class="card-stats">
            <span>📍 ${itinerary.days?.reduce((sum, d) => sum + (d.stops?.length || 0), 0)} stops</span>
            <span>⏱️ ${Math.round((itinerary.days?.reduce((sum, d) => sum + (d.stops?.length || 0), 0) / itinerary.duration_days) || 0)}/day</span>
          </div>
          <button class="preview-btn">Click to Preview</button>
        </div>
      </div>
    `;
  };

  // ============= SETUP CARD PREVIEW =============
  const setupCardPreview = (draft, currentUser) => {
    // Override the card click to use draft data directly
    const card = document.querySelector('.itinerary-card[data-itinerary-id="preview"]');
    if (card) {
      card.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openPreviewModal(draft, currentUser);
      };
    }
  };

  // ============= OPEN PREVIEW MODAL =============
  const openPreviewModal = (draft, currentUser) => {
    if (!draft) return;
    
    // Transform draft for modal
    const itineraryPreview = {
      id: 'preview',
      title: draft.title,
      destination: draft.destination,
      duration_days: draft.duration_days,
      description: draft.description,
      price_tier: draft.price_tier,
      cover_image_url: draft.cover_image_url,
      days: draft.days || [],
      characteristics: draft.characteristics,
      transportation: draft.transportation,
      accommodation: draft.accommodation,
      travel_tips: draft.travel_tips,
      creator: {
        username: currentUser?.username || currentUser?.profile?.username || 'You',
        avatar_url: currentUser?.avatar_url || currentUser?.profile?.avatar_url,
        bio: currentUser?.bio || currentUser?.profile?.bio
      }
    };
    
    // Emit event for TripModal
    Events.emit('trip-modal:open', { 
      itinerary: itineraryPreview, 
      context: 'preview' 
    });
  };

  // ============= GET CHECKLIST STATUS =============
  const getChecklistStatus = (draft) => {
    // Check if each day has enough stops
    const hasEnoughStops = draft.days?.length > 0 && 
      draft.days.every(day => day.stops && day.stops.length >= 3);
    
    // Check if stops have tips/descriptions
    const hasTips = draft.days?.length > 0 && 
      draft.days.every(day => 
        day.stops?.length > 0 && 
        day.stops.every(stop => 
          stop.tip?.trim() || stop.description?.trim()
        )
      );
    
    // Check transportation
    const hasTransport = !!(
      draft.transportation?.getting_there?.trim() || 
      draft.transportation?.getting_around?.trim() ||
      draft.transportation?.local_transport_tips?.trim()
    );
    
    // Check accommodation
    const hasAccommodation = !!(
      draft.accommodation?.area_recommendations?.trim() ||
      draft.accommodation?.booking_tips?.trim()
    );
    
    // Check characteristics
    const hasCharacteristics = !!(
      draft.characteristics?.physical_demand &&
      draft.characteristics?.pace &&
      draft.characteristics?.budget_level &&
      draft.characteristics?.cultural_immersion &&
      draft.characteristics?.social_style
    );
    
    const isReady = hasEnoughStops && hasTips && hasTransport && 
                    hasAccommodation && hasCharacteristics;
    
    return {
      hasEnoughStops,
      hasTips,
      hasTransport,
      hasAccommodation,
      hasCharacteristics,
      isReady
    };
  };

  // ============= HANDLE PUBLISH =============
  const handlePublish = async () => {
    const draft = CreateController.getCurrentDraft();
    const checks = getChecklistStatus(draft);
    
    if (!checks.isReady) {
      Toast.error('Please complete all checklist items');
      return;
    }
    
    // Confirm publication
    const confirmed = await new Promise(resolve => {
      if (typeof Modal !== 'undefined') {
        Modal.confirm({
          title: '🚀 Ready to Publish?',
          message: `Your ${draft.duration_days}-day ${draft.destination} itinerary will go live at €${draft.price_tier}. You'll earn €${(draft.price_tier * 0.85).toFixed(2)} per sale.`,
          confirmText: 'Publish Now',
          cancelText: 'Review Again',
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false)
        });
      } else {
        resolve(confirm('Publish your itinerary now?'));
      }
    });
    
    if (!confirmed) return;
    
    const button = document.querySelector('[data-action="publish"]');
    if (button) {
      button.disabled = true;
      button.innerHTML = '<span>Publishing...</span>';
    }
    
    try {
      CreateController.showLoadingOverlay('Publishing your itinerary...');
      
      const draftId = CreateController.getCurrentDraftId();
      const { data, error } = await API.drafts.publish(draftId);
      
      if (error) throw error;
      
      CreateController.hideLoadingOverlay();
      
      // Success message
      if (typeof Modal !== 'undefined') {
        Modal.alert({
          title: '🎉 Published Successfully!',
          message: `Your itinerary is now live! Start earning €${(draft.price_tier * 0.85).toFixed(2)} per sale.`,
          type: 'success',
          buttonText: 'View Dashboard'
        });
      } else {
        Toast.success('Published successfully!');
      }
      
      // Clear draft and redirect
      CreateController.setDraftId(null);
      CreateController.setDraft(null);
      
      setTimeout(() => {
        Router.navigateTo('dashboard');
      }, 2000);
      
    } catch (error) {
      CreateController.hideLoadingOverlay();
      console.error('Publish error:', error);
      Toast.error('Failed to publish. Please try again.');
      
      if (button) {
        button.disabled = false;
        button.innerHTML = '🚀 Publish Now';
      }
    }
  };

  // ============= HANDLE SAVE AS DRAFT =============
  const handleSaveAsDraft = async () => {
    try {
      const draftId = CreateController.getCurrentDraftId();
      if (draftId) {
        await API.drafts.update(draftId, { current_step: 4 });
        Toast.success('Draft saved');
      }
    } catch (error) {
      Toast.error('Failed to save draft');
    }
  };

  // ============= SAVE STEP (Called by Controller) =============
  const saveStep = async () => {
    const draftId = CreateController.getCurrentDraftId();
    if (draftId) {
      await API.drafts.update(draftId, { current_step: 4 });
    }
    return true;
  };

  // ============= VALIDATION =============
  const validateStep = () => {
    return true;
  };

  // ============= PUBLIC API =============
  return {
    init,
    render,
    saveStep,
    validateStep,
    openPreviewModal // Expose for fallback onclick
  };
})();

// Auto-initialize with controller
// CreateStep4 will be initialized by CreateController
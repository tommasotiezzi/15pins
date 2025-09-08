/**
 * Create Step 4 - Review & Publish
 * Final review with marketplace preview card and modal
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
    
    // Initialize modal component if available
    if (typeof TripModal !== 'undefined') {
      TripModal.init();
    }
  };

  // ============= RENDER STEP =============
  const render = () => {
    const draft = CreateController.getCurrentDraft();
    if (!draft) return;
    
    const container = document.getElementById('step-4');
    if (!container) return;
    
    // Get current user for creator info
    const currentUser = State.get('currentUser');
    
    container.innerHTML = `
      <!-- Marketplace Preview Section -->
      <div class="marketplace-preview-section">
        <h2>📱 Marketplace Preview</h2>
        <p class="preview-description">
          This is how your itinerary will appear to potential buyers in the marketplace.
          Click the card to see the full modal view.
        </p>
        
        <div class="preview-card-container">
          ${renderMarketplaceCard(draft, currentUser)}
        </div>
      </div>
      
      <!-- Publishing Checklist -->
      <div class="publish-checklist">
        ${renderPublishChecklist(draft)}
      </div>
      
      <!-- Earnings Recap -->
      ${renderEarningsRecap(draft)}
      
      <!-- Action Buttons -->
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" data-action="back-to-build">
          ← Back to Edit
        </button>
        <div>
          <button type="button" class="btn btn-secondary" data-action="save-as-draft">
            Save as Draft
          </button>
          <button type="button" class="btn btn-primary btn-publish" data-action="publish">
            <span>Publish Itinerary</span>
          </button>
        </div>
      </div>
    `;
    
    // Update publish button state based on checklist
    updatePublishButton();
    
    // Attach event listeners for checklist
    attachChecklistListeners();
  };

  // ============= RENDER MARKETPLACE CARD =============
  const renderMarketplaceCard = (draft, currentUser) => {
    // Transform draft to match itinerary structure expected by ItineraryCard
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
        username: currentUser?.username || 'You',
        avatar_url: currentUser?.avatar_url || 'https://i.pravatar.cc/32',
        bio: currentUser?.bio || ''
      }
    };
    
    // Use ItineraryCard component if available, otherwise fallback
    if (typeof ItineraryCard !== 'undefined') {
      return ItineraryCard.create(itineraryPreview, 'preview');
    } else {
      // Fallback HTML if component not loaded
      return `
        <div class="itinerary-card-fallback">
          <div class="card-image">
            ${draft.cover_image_url ? 
              `<img src="${draft.cover_image_url}" alt="${draft.title}">` :
              '<div class="placeholder">No cover image</div>'
            }
          </div>
          <div class="card-content">
            <h3>${draft.title || 'Untitled'}</h3>
            <p>📍 ${draft.destination} • 📅 ${draft.duration_days} days</p>
            <p class="price">€${draft.price_tier}</p>
            <button class="btn btn-primary" onclick="CreateStep4.openPreviewModal()">
              Preview Full Details
            </button>
          </div>
        </div>
      `;
    }
  };

  // ============= RENDER PUBLISH CHECKLIST =============
  const renderPublishChecklist = (draft) => {
    const checks = getChecklistStatus(draft);
    
    return `
      <h3>✅ Quality Checklist</h3>
      <p>Ensure your itinerary meets our standards:</p>
      
      <label class="checkbox">
        <input type="checkbox" id="check-1" ${checks.hasEnoughStops ? 'checked' : ''}>
        <span>Each day has at least 3-5 stops ${checks.hasEnoughStops ? '✓' : '❌'}</span>
      </label>
      
      <label class="checkbox">
        <input type="checkbox" id="check-2" ${checks.hasTips ? 'checked' : ''}>
        <span>Every stop includes a personal tip ${checks.hasTips ? '✓' : '❌'}</span>
      </label>
      
      <label class="checkbox">
        <input type="checkbox" id="check-3" ${checks.hasTransport ? 'checked' : ''}>
        <span>Transportation is explained ${checks.hasTransport ? '✓' : '❌'}</span>
      </label>
      
      <label class="checkbox">
        <input type="checkbox" id="check-4" ${checks.hasAccommodation ? 'checked' : ''}>
        <span>Accommodation areas recommended ${checks.hasAccommodation ? '✓' : '❌'}</span>
      </label>
      
      <label class="checkbox">
        <input type="checkbox" id="check-5" ${checks.hasCharacteristics ? 'checked' : ''}>
        <span>Trip characteristics defined ${checks.hasCharacteristics ? '✓' : '❌'}</span>
      </label>
      
      ${!checks.isReady ? `
        <div class="checklist-warning">
          ⚠️ Please complete all items before publishing
        </div>
      ` : `
        <div class="checklist-success">
          🎉 Your itinerary is ready to publish!
        </div>
      `}
    `;
  };

  // ============= RENDER EARNINGS RECAP =============
  const renderEarningsRecap = (draft) => {
    const commission = 0.85; // 85% to creator
    const earnings = (draft.price_tier * commission).toFixed(2);
    const avgMonthlySales = draft.price_tier === 19 ? 20 : 25;
    const monthlyEarnings = (earnings * avgMonthlySales).toFixed(0);
    
    return `
      <div class="earnings-recap">
        <h3>💰 Earnings Potential</h3>
        <div class="earnings-breakdown">
          <div class="earning-item">
            <span class="earning-label">Price:</span>
            <span class="earning-value">€${draft.price_tier}</span>
          </div>
          <div class="earning-item">
            <span class="earning-label">Your commission (85%):</span>
            <span class="earning-value highlight">€${earnings}/sale</span>
          </div>
          <div class="earning-item">
            <span class="earning-label">Average monthly sales:</span>
            <span class="earning-value">${avgMonthlySales} sales</span>
          </div>
          <div class="earning-item total">
            <span class="earning-label">Potential monthly earnings:</span>
            <span class="earning-value">€${monthlyEarnings}</span>
          </div>
        </div>
        <p class="earnings-note">
          Top creators in your category earn 2-3x the average!
        </p>
      </div>
    `;
  };

  // ============= GET CHECKLIST STATUS =============
  const getChecklistStatus = (draft) => {
    // Check if each day has enough stops
    const hasEnoughStops = draft.days?.length > 0 && 
      draft.days.every(day => day.stops && day.stops.length >= 3);
    
    // Check if stops have tips/descriptions based on tier
    const hasTips = draft.days?.length > 0 && 
      draft.days.every(day => 
        day.stops?.length > 0 && 
        day.stops.every(stop => 
          (draft.price_tier === 9 && stop.tip?.trim()) || 
          (draft.price_tier === 19 && (stop.description?.trim() || stop.tip?.trim()))
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
      draft.accommodation?.booking_tips?.trim() ||
      draft.destination?.toLowerCase().includes('day trip')
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

  // ============= ATTACH CHECKLIST LISTENERS =============
  const attachChecklistListeners = () => {
    const checkboxes = document.querySelectorAll('.publish-checklist input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', updatePublishButton);
    });
  };

  // ============= UPDATE PUBLISH BUTTON =============
  const updatePublishButton = () => {
    const publishBtn = document.querySelector('[data-action="publish"]');
    if (!publishBtn) return;
    
    const checkboxes = document.querySelectorAll('.publish-checklist input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    publishBtn.disabled = !allChecked;
    
    if (allChecked) {
      publishBtn.innerHTML = '<span>🚀 Publish Itinerary</span>';
      publishBtn.classList.add('ready');
    } else {
      publishBtn.innerHTML = '<span>Complete Checklist First</span>';
      publishBtn.classList.remove('ready');
    }
  };

  // ============= HANDLE PUBLISH =============
  const handlePublish = async () => {
    // Verify all checkboxes
    const checkboxes = document.querySelectorAll('.publish-checklist input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    if (!allChecked) {
      Toast.error('Please complete all checklist items');
      return;
    }
    
    const draft = CreateController.getCurrentDraft();
    
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
        button.innerHTML = '<span>Publish Itinerary</span>';
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

  // ============= OPEN PREVIEW MODAL (Fallback) =============
  const openPreviewModal = () => {
    const draft = CreateController.getCurrentDraft();
    if (!draft) return;
    
    // Transform and emit event for TripModal
    const currentUser = State.get('currentUser');
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
        username: currentUser?.username || 'You',
        avatar_url: currentUser?.avatar_url,
        bio: currentUser?.bio
      }
    };
    
    Events.emit('trip-modal:open', { 
      itinerary: itineraryPreview, 
      context: 'preview' 
    });
  };

  // ============= SAVE STEP (Called by Controller) =============
  const saveStep = async () => {
    // Step 4 is review-only, just update current step
    const draftId = CreateController.getCurrentDraftId();
    if (draftId) {
      await API.drafts.update(draftId, { current_step: 4 });
    }
    return true;
  };

  // ============= VALIDATION =============
  const validateStep = () => {
    // Step 4 doesn't need validation, publishing has its own
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
/**
 * Create Step 4 - Review & Publish
 * Fixed preview with manual checklist and dynamic colors
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

  // ============= GET CHECKLIST COLOR CLASS =============
  const getChecklistColorClass = (checkedCount) => {
    if (checkedCount === 0) return 'checklist-red';
    if (checkedCount === 5) return 'checklist-green';
    return 'checklist-yellow'; // partial completion
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
            <!-- Manual Quality Checklist -->
            <div class="publish-checklist checklist-red" id="quality-checklist">
              <h3>📋 Final Quality Check</h3>
              <p>Please confirm you've completed these items:</p>
              
              <label class="checkbox">
                <input type="checkbox" id="check-stops">
                <span>Each day has at least 3 meaningful stops</span>
              </label>
              
              <label class="checkbox">
                <input type="checkbox" id="check-tips">
                <span>Added personal tips & insider knowledge for each stop</span>
              </label>
              
              <label class="checkbox">
                <input type="checkbox" id="check-transport">
                <span>Explained how to get there and get around</span>
              </label>
              
              <label class="checkbox">
                <input type="checkbox" id="check-accommodation">
                <span>Recommended areas to stay for each location</span>
              </label>
              
              <label class="checkbox">
                <input type="checkbox" id="check-value">
                <span>My itinerary is worth €${draft.price_tier} and provides real value</span>
              </label>
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
                        class="btn btn-primary btn-publish disabled" 
                        data-action="publish"
                        disabled>
                  🔒 Complete Checklist
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Add CSS for checklist colors -->
      <style>
        .publish-checklist.checklist-red {
          background: #ffebee !important;
          border-color: #ffcdd2 !important;
        }
        
        .publish-checklist.checklist-yellow {
          background: #fff8e1 !important;
          border-color: #ffe082 !important;
        }
        
        .publish-checklist.checklist-green {
          background: #e8f5e9 !important;
          border-color: #a5d6a7 !important;
        }
      </style>
    `;
    
    // Initialize card click handler for preview
    setupCardPreview(draft, currentUser);
    
    // Initialize manual checkbox handlers
    setupChecklistHandlers();
  };

  // ============= SETUP CHECKLIST HANDLERS =============
  const setupChecklistHandlers = () => {
    const checkboxes = document.querySelectorAll('.publish-checklist input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', updateChecklistState);
    });
    
    // Initial state
    updateChecklistState();
  };

  // ============= UPDATE CHECKLIST STATE =============
  const updateChecklistState = () => {
    const publishBtn = document.querySelector('[data-action="publish"]');
    const checklist = document.getElementById('quality-checklist');
    if (!publishBtn || !checklist) return;
    
    const checkboxes = document.querySelectorAll('.publish-checklist input[type="checkbox"]');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const allChecked = checkedCount === 5;
    
    // Update checklist background color
    checklist.className = `publish-checklist ${getChecklistColorClass(checkedCount)}`;
    
    // Update publish button
    publishBtn.disabled = !allChecked;
    
    if (allChecked) {
      publishBtn.innerHTML = '🚀 Publish Now';
      publishBtn.classList.remove('disabled');
      publishBtn.classList.add('ready');
    } else {
      publishBtn.innerHTML = '🔒 Complete Checklist';
      publishBtn.classList.add('disabled');
      publishBtn.classList.remove('ready');
    }
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
      },
      context: 'preview' // Important: set context
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
      <div class="itinerary-card-fallback" data-itinerary-id="preview" data-context="preview">
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
    // Add a small delay to ensure DOM is ready
    setTimeout(() => {
      // Setup click handler for the card container
      const cardWrapper = document.querySelector('.preview-card-wrapper');
      if (cardWrapper) {
        cardWrapper.addEventListener('click', (e) => {
          // Don't trigger on certain button clicks
          if (e.target.closest('[data-action="back-to-build"]')) return;
          if (e.target.closest('[data-action="wishlist"]')) return;
          
          // Check if clicking on the card itself or Full Preview button
          const isCard = e.target.closest('.itinerary-card, .itinerary-card-fallback');
          const isPreviewBtn = e.target.closest('.btn-secondary') || e.target.textContent.includes('Full Preview');
          
          if (isCard || isPreviewBtn) {
            e.preventDefault();
            e.stopPropagation();
            openPreviewModal(draft, currentUser);
          }
        });
      }
      
      // Also add direct click handler to fallback card
      const fallbackCard = document.querySelector('.itinerary-card-fallback');
      if (fallbackCard) {
        fallbackCard.style.cursor = 'pointer';
        fallbackCard.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openPreviewModal(draft, currentUser);
        });
      }
    }, 100);
  };

  // ============= OPEN PREVIEW MODAL (SIMPLIFIED) =============
  const openPreviewModal = (draft, currentUser) => {
    if (!draft) {
      console.error('No draft data for preview');
      return;
    }
    
    // Transform draft for modal
    const itineraryForModal = {
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
    
    console.log('Opening modal with draft data:', itineraryForModal);
    
    // Try multiple methods to open the modal
    if (typeof TripModal !== 'undefined' && TripModal.open) {
      // Direct method if TripModal has an open method
      TripModal.open(itineraryForModal, 'preview');
    } else if (typeof ItineraryModal !== 'undefined' && ItineraryModal.open) {
      // Try ItineraryModal if available
      ItineraryModal.open(itineraryForModal, 'preview');
    } else {
      // Use Events system
      Events.emit('trip-modal:open', { 
        itinerary: itineraryForModal, 
        context: 'preview',
        isDraft: true
      });
      
      // Also try alternate event names
      Events.emit('itinerary-modal:open', { 
        itinerary: itineraryForModal, 
        context: 'preview',
        isDraft: true
      });
    }
  };

  // ============= HANDLE PUBLISH =============
  const handlePublish = async () => {
    const draft = CreateController.getCurrentDraft();
    
    // Check if all checkboxes are checked
    const checkboxes = document.querySelectorAll('.publish-checklist input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    if (!allChecked) {
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
    validateStep
  };
})();

// Auto-initialize with controller
// CreateStep4 will be initialized by CreateController
/**
 * Create Step 4 - Review & Publish
 * Database is the single source of truth - no local storage
 */

const CreateStep4 = (() => {
  
  let currentDraftData = null; // Cache for current render
  
  // ============= INITIALIZATION =============
  const init = () => {
    // Publishing events
    Events.on('action:publish', handlePublish);
    Events.on('action:save-as-draft', handleSaveAsDraft);
    
    // Navigation
    Events.on('action:back-to-build', handleBackToBuild);
    Events.on('create:continue-editing', handleBackToBuild);
  };

  // ============= RENDER STEP (ASYNC) =============
  const render = async () => {
    const draftId = CreateController.getCurrentDraftId();
    if (!draftId) {
      Toast.error('No draft found');
      return;
    }
    
    try {
      // Fetch complete draft data from database
      const { data: draft, error } = await API.drafts.getPreview(draftId);
      
      if (error || !draft) {
        Toast.error('Failed to load draft for preview');
        return;
      }
      
      // Store for later use
      currentDraftData = draft;
      
      // Get current user
      const currentUser = await API.auth.getUser();
      
      renderPreview(draft, currentUser);
      
    } catch (error) {
      console.error('Error rendering Step 4:', error);
      Toast.error('Failed to load preview');
    }
  };

  // ============= GET CHECKLIST COLOR CLASS =============
  const getChecklistColorClass = (checkedCount) => {
    if (checkedCount === 0) return 'checklist-red';
    if (checkedCount === 5) return 'checklist-green';
    return 'checklist-yellow';
  };

  // ============= RENDER PREVIEW =============
  const renderPreview = (draft, currentUser) => {
    const container = document.getElementById('step-4');
    if (!container) return;
    
    container.innerHTML = `
      <div class="review-container">
        <!-- Two Column Layout -->
        <div class="review-grid">
          
          <!-- Left Column: Preview -->
          <div class="preview-column">
            <div class="preview-header">
              <h2>📱 Marketplace Preview</h2>
              <p>This is exactly how buyers will see your itinerary card</p>
            </div>
            
            <div class="preview-card-wrapper">
              ${renderMarketplaceCard(draft, currentUser)}
            </div>
            
            <div class="preview-tips-grid">
              <div class="preview-tip-card">
                <span class="tip-icon">👁️</span>
                <div>
                  <strong>Full Transparency</strong>
                  <p>All 5 trip characteristics are visible so buyers know exactly what type of trip this is</p>
                </div>
              </div>
              <div class="preview-tip-card">
                <span class="tip-icon">🔓</span>
                <div>
                  <strong>Preview Access</strong>
                  <p>Buyers can preview ${draft.duration_days <= 5 ? 'Day 1' : 'Day 1 and Day ' + (Math.floor(draft.duration_days / 2) + 1)} before purchasing</p>
                </div>
              </div>
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
      
      <!-- Add CSS for enhanced preview -->
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
        
        .preview-card-wrapper {
          margin-bottom: 20px;
        }
        
        .preview-tips-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 16px;
        }
        
        .preview-tip-card {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 8px;
          border: 1px solid #e0e0e0;
        }
        
        .tip-icon {
          font-size: 24px;
          flex-shrink: 0;
        }
        
        .preview-tip-card p {
          margin: 4px 0 0;
          font-size: 12px;
          color: #666;
          line-height: 1.4;
        }
        
        .preview-tip-card strong {
          font-size: 13px;
          color: #333;
        }
      </style>
    `;
    
    // Setup handlers after DOM is ready
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
/**
 * REPLACE the renderMarketplaceCard function in your Step 4 with this:
 */

// ============= RENDER MARKETPLACE CARD =============
const renderMarketplaceCard = (draft, currentUser) => {
  console.log('🔴 Step 4: Starting renderMarketplaceCard');
  console.log('🔴 Step 4: Draft ID:', draft.id);
  console.log('🔴 Step 4: Draft characteristic columns:', {
    physical_demand: draft.physical_demand,
    cultural_immersion: draft.cultural_immersion,
    pace: draft.pace,
    budget_level: draft.budget_level,
    social_style: draft.social_style
  });
  
  // Create the full itinerary object for the modal
  const itineraryPreview = {
    ...draft, // Spread ALL draft fields first (includes characteristic columns)
    id: draft.id || CreateController.getCurrentDraftId(), 
    title: draft.title || 'Untitled Itinerary',
    destination: draft.destination || 'Unknown',
    duration_days: draft.duration_days || 0,
    description: draft.description || '',
    price_tier: draft.price_tier || 9,
    cover_image_url: draft.cover_image_url || '',
    days: draft.days || [],
    // Explicitly include characteristic columns to make sure they're passed
    physical_demand: draft.physical_demand,
    cultural_immersion: draft.cultural_immersion,
    pace: draft.pace,
    budget_level: draft.budget_level,
    social_style: draft.social_style,
    // Transportation, accommodation, travel tips
    transportation: draft.transportation || {},
    accommodation: draft.accommodation || {},
    travel_tips: draft.travel_tips || {},
    total_sales: 0,
    view_count: 0,
    creator: {
      username: currentUser?.username || currentUser?.profile?.username || 'You',
      avatar_url: currentUser?.avatar_url || currentUser?.profile?.avatar_url || '/images/default-avatar.png',
      bio: currentUser?.bio || currentUser?.profile?.bio || '',
      trip_count: 1
    },
    context: 'preview'
  };
  
  console.log('🔵 Step 4: Created itineraryPreview for modal with characteristics:', {
    physical_demand: itineraryPreview.physical_demand,
    cultural_immersion: itineraryPreview.cultural_immersion,
    pace: itineraryPreview.pace,
    budget_level: itineraryPreview.budget_level,
    social_style: itineraryPreview.social_style
  });
  
  // Store for modal access (KEEP THIS FOR THE MODAL!)
  window.CreatePage = window.CreatePage || {};
  window.CreatePage.getCurrentDraft = () => itineraryPreview;
  
  // Use ItineraryCard component if available
  if (typeof ItineraryCard !== 'undefined') {
    console.log('🟢 Step 4: Passing data to ItineraryCard.create()');
    
    // Pass the complete data to the card
    const cardHtml = ItineraryCard.create(itineraryPreview, 'preview');
    
    console.log('✅ Step 4: Card HTML created');
    return cardHtml;
    
  } else {
    console.log('❌ Step 4: Card component not available, using fallback');
    // Fallback if component not loaded
    return renderFallbackCard(itineraryPreview);
  }
};

  // ============= FALLBACK CARD RENDER =============
  const renderFallbackCard = (itinerary) => {
    const totalStops = itinerary.days?.reduce((sum, d) => sum + (d.stops?.length || 0), 0) || 0;
    const stopsPerDay = itinerary.duration_days > 0 ? Math.round(totalStops / itinerary.duration_days) : 0;
    
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
            <span>📍 ${totalStops} stops</span>
            <span>⏱️ ${stopsPerDay}/day</span>
          </div>
          <button class="preview-btn">Click to Preview</button>
        </div>
      </div>
    `;
  };

  // ============= NAVIGATION =============
  const handleBackToBuild = async () => {
    // Close modal if open
    if (typeof TripModal !== 'undefined' && TripModal.close) {
      TripModal.close();
    }
    
    // Navigate back to Step 2 (days builder)
    await CreateController.navigateToStep(2);
  };

  // ============= HANDLE PUBLISH =============
  const handlePublish = async () => {
    // Check if all checkboxes are checked
    const checkboxes = document.querySelectorAll('.publish-checklist input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    if (!allChecked) {
      Toast.error('Please complete all checklist items');
      return;
    }
    
    if (!currentDraftData) {
      Toast.error('No draft data available');
      return;
    }
    
    // Confirm publication
    const confirmed = await new Promise(resolve => {
      if (typeof Modal !== 'undefined' && Modal.confirm) {
        Modal.confirm({
          title: '🚀 Ready to Publish?',
          message: `Your ${currentDraftData.duration_days}-day ${currentDraftData.destination} itinerary will go live at €${currentDraftData.price_tier}. You'll earn €${(currentDraftData.price_tier * 0.85).toFixed(2)} per sale.`,
          confirmText: 'Publish Now',
          cancelText: 'Review Again',
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false)
        });
      } else {
        resolve(confirm(`Publish your ${currentDraftData.duration_days}-day ${currentDraftData.destination} itinerary for €${currentDraftData.price_tier}?`));
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
      if (typeof Modal !== 'undefined' && Modal.alert) {
        Modal.alert({
          title: '🎉 Published Successfully!',
          message: `Your itinerary is now live! Start earning €${(currentDraftData.price_tier * 0.85).toFixed(2)} per sale.`,
          type: 'success',
          buttonText: 'View Dashboard'
        });
      } else {
        Toast.success('Published successfully!');
      }
      
      // Clear draft ID and URL
      const url = new URL(window.location);
      url.searchParams.delete('draft');
      window.history.replaceState({}, '', url);
      
      // Redirect to dashboard after a delay
      setTimeout(() => {
        if (typeof Router !== 'undefined' && Router.navigate) {
          Router.navigate('dashboard');
        } else {
          window.location.hash = '#dashboard';
        }
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
        
        // Update saved indicator
        const statusEl = document.getElementById('draft-status');
        if (statusEl) {
          statusEl.style.display = 'inline-flex';
          statusEl.textContent = '✓ Saved';
          statusEl.classList.remove('unsaved');
          setTimeout(() => {
            statusEl.style.display = 'none';
          }, 2000);
        }
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
    // No validation needed for review step
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
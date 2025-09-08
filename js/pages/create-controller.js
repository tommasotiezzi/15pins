/**
 * Create Controller - Main Orchestrator
 * Handles navigation, state management, and coordination between steps
 */

const CreateController = (() => {
  // ============= STATE VARIABLES =============
  let currentDraftId = null;
  let currentDraft = null;
  let currentStep = 1;
  let selectedDayId = null;
  let hasUnsavedChanges = false;
  
  // Loading & error handling
  let isTransitioning = false;
  let saveTimeout = null;
  let lastSaveAttempt = null;
  const SAVE_TIMEOUT_MS = 30000; // 30 seconds

  // ============= INITIALIZATION =============
  const init = () => {
    console.log('CreateController initialized');
    
    // Page lifecycle
    Events.on('page:create:activate', activate);
    Events.on('page:create:deactivate', deactivate);
    
    // Creation flow
    Events.on('create:new', startNewItinerary);
    Events.on('create:continue', continueDraft);
    
    // Navigation events
    Events.on('action:back-to-setup', () => handleStepTransition(currentStep, 1));
    Events.on('action:back-to-days', () => handleStepTransition(currentStep, 2));
    Events.on('action:back-to-build', () => handleStepTransition(currentStep, 2));
    Events.on('action:go-to-details', () => handleStepTransition(2, 3));
    Events.on('action:continue-to-review', () => handleStepTransition(3, 4));
    
    // Save events
    Events.on('action:manual-save', handleManualSave);
    Events.on('action:view-drafts', handleViewDrafts);
    
    // Navigation button handlers
    document.getElementById('next-button')?.addEventListener('click', handleNextButton);
    document.getElementById('back-button')?.addEventListener('click', handleBackButton);
    document.getElementById('save-button')?.addEventListener('click', handleManualSave);
    
    // Initialize step modules
    CreateStep1.init();
    CreateStep2.init();
    CreateStep3.init();
    CreateStep4.init();
    
    // Setup router guard
    Router.addGuard((to, from) => {
      if (from?.name === 'create' && hasUnsavedChanges) {
        return confirm('You have unsaved changes. Leave anyway?');
      }
      return true;
    });
    
    // Track changes globally
    document.addEventListener('input', (e) => {
      if (e.target && currentDraftId && !isTransitioning) {
        markAsUnsaved();
      }
    });
  };

  // ============= NAVIGATION BUTTON HANDLERS =============
  const handleNextButton = async () => {
    const nextStep = currentStep + 1;
    if (nextStep > 4) return;
    
    // Special handling for Step 4 (Publish)
    if (currentStep === 4) {
      await handlePublish();
      return;
    }
    
    // Validate current step before proceeding
    if (!await validateCurrentStep()) {
      return;
    }
    
    await handleStepTransition(currentStep, nextStep);
  };

  const handleBackButton = async () => {
    const prevStep = currentStep - 1;
    if (prevStep < 1) return;
    
    await handleStepTransition(currentStep, prevStep);
  };

  const validateCurrentStep = async () => {
    switch (currentStep) {
      case 1:
        return CreateStep1.validate ? await CreateStep1.validate() : true;
      case 2:
        return CreateStep2.validate ? await CreateStep2.validate() : true;
      case 3:
        return CreateStep3.validate ? await CreateStep3.validate() : true;
      default:
        return true;
    }
  };

  const handlePublish = async () => {
    if (!currentDraftId) {
      Toast.error('No draft to publish');
      return;
    }
    
    const button = document.getElementById('next-button');
    if (button) {
      button.disabled = true;
      button.textContent = 'Publishing...';
    }
    
    try {
      const { data, error } = await API.drafts.publish(currentDraftId);
      
      if (!error && data) {
        Toast.success('🎉 Itinerary published successfully!');
        
        // Clear current draft
        currentDraftId = null;
        currentDraft = null;
        hasUnsavedChanges = false;
        
        // Navigate to dashboard
        setTimeout(() => {
          Router.navigateTo('dashboard');
        }, 2000);
      } else {
        throw new Error(error?.message || 'Failed to publish');
      }
    } catch (error) {
      console.error('Publish error:', error);
      Toast.error('Failed to publish itinerary');
      if (button) {
        button.disabled = false;
        button.textContent = 'Publish Itinerary';
      }
    }
  };

  // ============= PAGE LIFECYCLE =============
  const activate = async () => {
    const user = State.get('currentUser');
    if (!user) {
      Toast.error('Please sign in to create itineraries');
      Router.navigateTo('feed');
      return;
    }
    
    Events.emit('page:drafts:show');
  };

  const deactivate = () => {
    if (hasUnsavedChanges && currentDraftId) {
      if (confirm('Save your changes before leaving?')) {
        saveCurrentStep();
      }
    }
  };

  // ============= CORE NAVIGATION HANDLER =============
  const handleStepTransition = async (fromStep, toStep) => {
    if (isTransitioning) return;
    
    // Check if going backward
    const isGoingBack = toStep < fromStep;
    
    // Handle back navigation with unsaved changes
    if (isGoingBack && hasUnsavedChanges) {
      const confirmed = await showDiscardModal();
      if (!confirmed) return;
      
      // User confirmed, proceed without saving
      isTransitioning = true;
      showLoadingOverlay(`Loading Step ${toStep}...`);
      
      try {
        await loadStepData(toStep);
        renderStep(toStep);
      } catch (error) {
        handleLoadError(error);
      } finally {
        hideLoadingOverlay();
        isTransitioning = false;
      }
      return;
    }
    
    // Forward navigation - save current step first
    if (!isGoingBack) {
      isTransitioning = true;
      showLoadingOverlay(`Saving Step ${fromStep}...`);
      
      try {
        // Save with timeout
        const saved = await saveCurrentStepWithTimeout();
        if (!saved) {
          hideLoadingOverlay();
          isTransitioning = false;
          return;
        }
        
        // Update step in database
        await API.drafts.update(currentDraftId, { current_step: toStep });
        
        // Load new step data
        showLoadingOverlay(`Loading Step ${toStep}...`);
        await loadStepData(toStep);
        
        // Render new step
        renderStep(toStep);
        
      } catch (error) {
        handleLoadError(error);
        isTransitioning = false;
        return;
      } finally {
        hideLoadingOverlay();
        isTransitioning = false;
      }
    }
  };

  // ============= SAVE WITH TIMEOUT =============
  const saveCurrentStepWithTimeout = () => {
    return new Promise((resolve) => {
      lastSaveAttempt = { step: currentStep, timestamp: Date.now() };
      
      // Set timeout
      saveTimeout = setTimeout(() => {
        hideLoadingOverlay();
        Modal.alert({
          title: 'Save Timeout',
          message: 'Something went wrong. Please try again later.',
          type: 'error'
        });
        resolve(false);
      }, SAVE_TIMEOUT_MS);
      
      // Attempt save
      saveCurrentStep()
        .then(() => {
          clearTimeout(saveTimeout);
          resolve(true);
        })
        .catch((error) => {
          clearTimeout(saveTimeout);
          console.error('Save error:', error);
          
          Modal.confirm({
            title: 'Save Failed',
            message: 'Failed to save your changes. Retry?',
            confirmText: 'Retry',
            cancelText: 'Cancel',
            onConfirm: () => {
              saveCurrentStepWithTimeout().then(resolve);
            },
            onCancel: () => resolve(false)
          });
        });
    });
  };

  // ============= SAVE CURRENT STEP =============
  const saveCurrentStep = async () => {
    if (!currentDraftId || !currentDraft) return;
    
    switch (currentStep) {
      case 1:
        return CreateStep1.saveStep();
      case 2:
        return CreateStep2.saveStep();
      case 3:
        return CreateStep3.saveStep();
      case 4:
        // Step 4 is review-only, nothing to save
        return Promise.resolve();
      default:
        return Promise.resolve();
    }
  };

  // ============= LOAD STEP DATA =============
  const loadStepData = async (step) => {
    if (!currentDraftId) return;
    
    // For Step 4, fetch complete draft from DB
    if (step === 4) {
      const { data: fullDraft, error } = await API.drafts.getPreview(currentDraftId);
      if (error) throw error;
      
      // Transform to UI structure
      currentDraft = transformDraftForUI(fullDraft);
      return;
    }
    
    // For other steps, load specific data if needed
    switch (step) {
      case 3:
        // Load characteristics and essentials
        const [chars, essentials] = await Promise.all([
          API.drafts.getCharacteristics(currentDraftId),
          API.drafts.getAllEssentials(currentDraftId)
        ]);
        
        if (chars.data) currentDraft.characteristics = chars.data;
        if (essentials) {
          currentDraft.transportation = essentials.transportation;
          currentDraft.accommodation = essentials.accommodation;
          currentDraft.travel_tips = essentials.travel_tips;
        }
        break;
    }
  };

  // ============= RENDER STEP =============
  const renderStep = (step) => {
    currentStep = step;
    
    // Update progress bar
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
      progressBar.style.width = `${(step / 4) * 100}%`;
    }
    
    // Update step indicators
    document.querySelectorAll('.step').forEach((s, index) => {
      const stepNum = index + 1;
      s.classList.toggle('active', stepNum === step);
      s.classList.toggle('completed', stepNum < step);
    });
    
    // Update navigation buttons
    const backBtn = document.getElementById('back-button');
    const saveBtn = document.getElementById('save-button');
    const nextBtn = document.getElementById('next-button');
    
    if (backBtn) backBtn.style.display = step > 1 ? 'inline-flex' : 'none';
    if (saveBtn) saveBtn.style.display = step > 1 && step < 4 ? 'inline-flex' : 'none';
    
    if (nextBtn) {
      if (step === 4) {
        nextBtn.textContent = 'Publish Itinerary';
        nextBtn.className = 'btn btn-primary btn-publish';
      } else {
        nextBtn.textContent = 'Continue →';
        nextBtn.className = 'btn btn-primary';
      }
    }
    
    // Hide all step content
    document.querySelectorAll('.create-step-content').forEach(content => {
      content.style.display = 'none';
    });
    
    // Show current step
    const currentStepEl = document.getElementById(`step-${step}`);
    if (currentStepEl) {
      currentStepEl.style.display = 'block';
    }
    
    // Initialize step-specific content
    switch (step) {
      case 1:
        CreateStep1.render();
        break;
      case 2:
        CreateStep2.render();
        break;
      case 3:
        CreateStep3.render();
        break;
      case 4:
        CreateStep4.render();
        break;
    }
    
    hasUnsavedChanges = false;
    updateDraftInfoBar();
  };

  // ============= UI HELPERS =============
  const showLoadingOverlay = (message = 'Loading...') => {
    let overlay = document.getElementById('create-loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'create-loading-overlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `
        <div class="loading-content">
          <div class="spinner"></div>
          <p class="loading-message">${message}</p>
        </div>
      `;
      document.body.appendChild(overlay);
    } else {
      overlay.querySelector('.loading-message').textContent = message;
    }
    overlay.classList.add('active');
  };

  const hideLoadingOverlay = () => {
    const overlay = document.getElementById('create-loading-overlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
  };

  const showDiscardModal = () => {
    return new Promise((resolve) => {
      Modal.confirm({
        title: 'Discard Changes?',
        message: 'Going back will discard your recent changes. Are you sure?',
        confirmText: 'Discard & Go Back',
        cancelText: 'Stay Here',
        danger: true,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      });
    });
  };

  // ============= ERROR HANDLING =============
  const handleLoadError = (error) => {
    console.error('Step transition error:', error);
    hideLoadingOverlay();
    
    Modal.alert({
      title: 'Error',
      message: 'Failed to load the step. Please try again.',
      type: 'error'
    });
  };

  // ============= MANUAL SAVE =============
  const handleManualSave = async () => {
    if (!currentDraftId || !currentDraft) {
      Toast.error('No draft to save');
      return;
    }
    
    const button = document.getElementById('save-button');
    const originalText = button?.textContent || 'Save Draft';
    
    if (button) {
      button.disabled = true;
      button.textContent = 'Saving...';
    }
    
    try {
      await saveCurrentStep();
      hasUnsavedChanges = false;
      Toast.success('Draft saved');
      updateDraftInfoBar();
    } catch (error) {
      console.error('Save error:', error);
      Toast.error('Failed to save draft');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  };

  // ============= VIEW DRAFTS =============
  const handleViewDrafts = () => {
    if (hasUnsavedChanges && confirm('Save before viewing drafts?')) {
      saveCurrentStep().then(() => {
        Events.emit('page:drafts:show');
      });
    } else {
      Events.emit('page:drafts:show');
    }
  };

  // ============= START NEW ITINERARY =============
  const startNewItinerary = () => {
    currentDraftId = null;
    currentDraft = null;
    currentStep = 1;
    hasUnsavedChanges = false;
    selectedDayId = null;
    
    showCreationFlow();
    renderStep(1);
    updateDraftInfoBar();
  };

  // ============= CONTINUE DRAFT =============
  const continueDraft = async ({ draftId }) => {
    showLoadingOverlay('Loading draft...');
    
    try {
      const { data: draft, error } = await API.drafts.get(draftId);
      if (error || !draft) throw new Error('Failed to load draft');
      
      currentDraftId = draftId;
      currentDraft = transformDraftForUI(draft);
      currentStep = draft.current_step || 1;
      hasUnsavedChanges = false;
      
      showCreationFlow();
      renderStep(currentStep);
      updateDraftInfoBar();
      
    } catch (error) {
      console.error('Load draft error:', error);
      Toast.error('Failed to load draft');
      Events.emit('page:drafts:show');
    } finally {
      hideLoadingOverlay();
    }
  };

  // ============= UTILITIES =============
  const transformDraftForUI = (draft) => {
    return {
      ...draft,
      title: draft.title || '',
      destination: draft.destination || '',
      duration_days: draft.duration_days || 0,
      description: draft.description || '',
      price_tier: draft.price_tier || 9,
      cover_image_url: draft.cover_image_url || '',
      
      // Transform draft_days to days
      days: (draft.draft_days || draft.days || []).map(day => ({
        day_number: day.day_number,
        title: day.title || `Day ${day.day_number}`,
        description: day.description || '',
        stops: (day.draft_stops || day.stops || []).map(stop => ({
          name: stop.name || '',
          type: stop.type || 'attraction',
          position: stop.position,
          tip: stop.tip || '',
          time_period: stop.time_period || '',
          location: stop.location || '',
          start_time: stop.start_time || '',
          duration_minutes: stop.duration_minutes || 60,
          cost_cents: stop.cost_cents || 0,
          description: stop.description || '',
          link: stop.link || '',
          lat: stop.lat,
          lng: stop.lng
        }))
      })),
      
      // Include Step 3 data if exists
      characteristics: draft.draft_characteristics?.[0] || draft.characteristics || null,
      transportation: draft.draft_transportation?.[0] || draft.transportation || null,
      accommodation: draft.draft_accommodation?.[0] || draft.accommodation || null,
      travel_tips: draft.draft_travel_tips?.[0] || draft.travel_tips || null
    };
  };

  const showCreationFlow = () => {
    const selector = document.getElementById('draft-selector');
    const flow = document.getElementById('creation-flow');
    
    if (selector) selector.style.display = 'none';
    if (flow) flow.style.display = 'block';
  };

  const markAsUnsaved = () => {
    if (!hasUnsavedChanges && !isTransitioning) {
      hasUnsavedChanges = true;
      updateDraftInfoBar();
    }
  };

  const updateDraftInfoBar = () => {
    const bar = document.getElementById('draft-info-bar');
    const titleEl = document.getElementById('draft-title');
    const statusEl = document.getElementById('draft-status');
    
    if (!bar) return;
    
    if (currentDraft && currentDraftId && currentStep > 1) {
      bar.style.display = 'flex';
      
      if (titleEl) {
        titleEl.textContent = currentDraft.title || 'Untitled Itinerary';
      }
      
      if (statusEl) {
        if (hasUnsavedChanges) {
          statusEl.textContent = '• Unsaved changes';
          statusEl.className = 'draft-status unsaved';
          statusEl.style.display = 'inline-flex';
        } else {
          statusEl.textContent = '✓ Saved';
          statusEl.className = 'draft-status saved';
          statusEl.style.display = 'inline-flex';
          
          setTimeout(() => {
            if (statusEl && !hasUnsavedChanges) {
              statusEl.style.display = 'none';
            }
          }, 2000);
        }
      }
    } else {
      bar.style.display = 'none';
    }
  };

  // ============= PUBLIC API =============
  return {
    init,
    
    // State getters
    getCurrentDraftId: () => currentDraftId,
    getCurrentDraft: () => currentDraft,
    getCurrentStep: () => currentStep,
    getSelectedDayId: () => selectedDayId,
    setSelectedDayId: (id) => { selectedDayId = id; },
    
    // State setters
    setDraftId: (id) => { currentDraftId = id; },
    setDraft: (draft) => { currentDraft = draft; },
    markAsUnsaved,
    
    // Navigation
    handleStepTransition,
    renderStep,
    
    // UI helpers
    showLoadingOverlay,
    hideLoadingOverlay,
    updateDraftInfoBar,
    
    // Utilities
    transformDraftForUI
  };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', CreateController.init);
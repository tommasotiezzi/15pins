/**
 * Create Controller - Manages the creation flow
 * Database is the single source of truth - no local storage or in-memory caching
 */

const CreateController = (() => {
  // Current state - only tracking IDs, not data
  let currentDraftId = null;
  let currentStep = 1;
  let loadingOverlay = null;
  let isSaving = false; // Prevent multiple saves

  // ============= INITIALIZATION =============
  const init = () => {
    console.log('CreateController initialized');
    
    // Setup event listeners
    Events.on('page:create:activate', handlePageActivate);
    Events.on('action:start-new-itinerary', startNewItinerary);
    Events.on('action:continue-draft', continueDraft);
    Events.on('action:delete-draft', deleteDraft);
    Events.on('action:view-drafts', viewDrafts);
    
    // Add save draft button handler
    Events.on('action:save-draft', handleSaveDraft);
    
    // Add navigation handlers
    Events.on('action:go-to-step', handleGoToStep);
    Events.on('action:previous-step', handlePreviousStep);
    Events.on('action:next-step', handleNextStep);
    
    // Initialize step modules
    CreateStep1.init();
    CreateStep2.init();
    CreateStep3.init();
    CreateStep4.init();
  };

  // ============= PAGE ACTIVATION =============
  const handlePageActivate = async () => {
    console.log('Create page activated');
    
    // Check URL for draft ID
    const urlParams = new URLSearchParams(window.location.search);
    const draftIdFromUrl = urlParams.get('draft');
    
    if (draftIdFromUrl) {
      // Load specific draft from URL
      await loadDraft(draftIdFromUrl);
    } else {
      // Show draft selector
      showDraftSelector();
    }
  };

  // ============= DRAFT SELECTOR =============
  const showDraftSelector = async () => {
    const selector = document.getElementById('draft-selector');
    const flow = document.getElementById('creation-flow');
    
    if (selector) selector.style.display = 'block';
    if (flow) flow.style.display = 'none';
    
    // Load user's drafts from database
    await loadUserDrafts();
  };

  const loadUserDrafts = async () => {
    const user = await API.auth.getUser();
    if (!user) {
      Toast.error('Please log in to continue');
      Router.navigate('feed');
      return;
    }
    
    const { data: drafts, error } = await API.drafts.list(user.id);
    if (error) {
      console.error('Error loading drafts:', error);
      Toast.error('Failed to load drafts');
      return;
    }
    
    renderDraftsList(drafts || []);
  };

  const renderDraftsList = (drafts) => {
    const container = document.getElementById('drafts-list');
    if (!container) return;
    
    if (drafts.length === 0) {
      container.innerHTML = `
        <div class="empty-drafts">
          <svg width="64" height="64" fill="none" opacity="0.3">
            <path d="M32 8v48M8 32h48" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <h3>No drafts yet</h3>
          <p>Start creating your first itinerary!</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = drafts.map(draft => `
      <div class="draft-card">
        <div class="draft-info">
          <h3>${draft.title || 'Untitled Itinerary'}</h3>
          <p>${draft.destination || 'No destination'} • ${draft.duration_days || 0} days</p>
          <span class="draft-date">Last edited: ${formatDate(draft.updated_at)}</span>
        </div>
        <div class="draft-actions">
          <button class="btn btn-primary" data-action="continue-draft" data-draft-id="${draft.id}">
            Continue
          </button>
          <button class="btn btn-ghost btn-danger" data-action="delete-draft" data-draft-id="${draft.id}">
            Delete
          </button>
        </div>
      </div>
    `).join('');
  };

  // ============= START NEW ITINERARY =============
  const startNewItinerary = async () => {
    // Clear any existing draft ID
    currentDraftId = null;
    currentStep = 1;
    
    // Show creation flow
    const selector = document.getElementById('draft-selector');
    const flow = document.getElementById('creation-flow');
    
    if (selector) selector.style.display = 'none';
    if (flow) flow.style.display = 'block';
    
    // Hide info bar for new draft
    const infoBar = document.getElementById('draft-info-bar');
    if (infoBar) infoBar.style.display = 'none';
    
    // Render step 1 with empty state
    await renderStep(1);
  };

  // ============= CONTINUE DRAFT =============
  const continueDraft = async ({ data }) => {
    const draftId = data.draftId;
    if (!draftId) return;
    
    await loadDraft(draftId);
  };

  // ============= LOAD DRAFT FROM DATABASE =============
  const loadDraft = async (draftId) => {
    showLoadingOverlay('Loading draft...');
    
    try {
      // Fetch fresh data from database
      const { data: draft, error } = await API.drafts.get(draftId);
      
      if (error || !draft) {
        Toast.error('Draft not found');
        showDraftSelector();
        return;
      }
      
      // Set current draft ID
      currentDraftId = draftId;
      currentStep = draft.current_step || 1;
      
      // Show creation flow
      const selector = document.getElementById('draft-selector');
      const flow = document.getElementById('creation-flow');
      
      if (selector) selector.style.display = 'none';
      if (flow) flow.style.display = 'block';
      
      // Update info bar
      updateDraftInfoBar(draft);
      
      // Update URL to include draft ID
      const url = new URL(window.location);
      url.searchParams.set('draft', draftId);
      window.history.replaceState({}, '', url);
      
      // Render the appropriate step
      await renderStep(currentStep);
      
    } catch (error) {
      console.error('Error loading draft:', error);
      Toast.error('Failed to load draft');
      showDraftSelector();
    } finally {
      hideLoadingOverlay();
    }
  };

  // ============= DELETE DRAFT =============
  const deleteDraft = async ({ data }) => {
    const draftId = data.draftId;
    if (!draftId) return;
    
    if (!confirm('Are you sure you want to delete this draft?')) return;
    
    const { error } = await API.drafts.delete(draftId);
    
    if (error) {
      Toast.error('Failed to delete draft');
      return;
    }
    
    Toast.success('Draft deleted');
    
    // If we deleted the current draft, clear it
    if (draftId === currentDraftId) {
      currentDraftId = null;
      
      // Clear URL params
      const url = new URL(window.location);
      url.searchParams.delete('draft');
      window.history.replaceState({}, '', url);
    }
    
    // Reload drafts list
    await loadUserDrafts();
  };

  // ============= VIEW DRAFTS =============
  const viewDrafts = () => {
    // Clear current draft
    currentDraftId = null;
    currentStep = 1;
    
    // Clear URL params
    const url = new URL(window.location);
    url.searchParams.delete('draft');
    window.history.replaceState({}, '', url);
    
    // Show selector
    showDraftSelector();
  };

  // ============= RENDER STEP (ASYNC) =============
  const renderStep = async (step) => {
    console.log(`Rendering step ${step}`);
    currentStep = step;
    
    // Update progress bar
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
      progressBar.style.width = `${(step / 4) * 100}%`;
    }
    
    // Update step indicators
    document.querySelectorAll('.create-steps .step').forEach((s, index) => {
      const stepNum = index + 1;
      s.classList.toggle('active', stepNum === step);
      s.classList.toggle('completed', stepNum < step);
    });
    
    // Hide all step content
    document.querySelectorAll('.create-step-content').forEach(content => {
      content.style.display = 'none';
      content.classList.remove('active');
    });
    
    // Show current step
    const stepContent = document.getElementById(`step-${step}`);
    if (stepContent) {
      stepContent.style.display = 'block';
      stepContent.classList.add('active');
    }
    
    // If we have a draft ID, fetch fresh data from database
    if (currentDraftId) {
      showLoadingOverlay('Loading step data...');
      
      try {
        const { data: draft, error } = await API.drafts.get(currentDraftId);
        
        if (error || !draft) {
          Toast.error('Failed to load draft data');
          hideLoadingOverlay();
          return;
        }
        
        // Update info bar with latest data
        updateDraftInfoBar(draft);
        
        // Pass fresh data to step render - AWAIT async renders!
        switch(step) {
          case 1:
            CreateStep1.render(draft);
            break;
          case 2:
            await CreateStep2.render(draft); // AWAIT!
            break;
          case 3:
            await CreateStep3.render(draft); // AWAIT if async
            break;
          case 4:
            await CreateStep4.render(draft); // AWAIT if async
            break;
        }
        
        // Update current step in database if different
        if (draft.current_step !== step) {
          await API.drafts.update(currentDraftId, { current_step: step });
        }
        
      } catch (error) {
        console.error('Error loading step data:', error);
        Toast.error('Failed to load step data');
      } finally {
        hideLoadingOverlay();
      }
    } else {
      // New draft - render empty step
      try {
        switch(step) {
          case 1:
            CreateStep1.render({});
            break;
          case 2:
            await CreateStep2.render({}); // AWAIT!
            break;
          case 3:
            await CreateStep3.render({}); // AWAIT if async
            break;
          case 4:
            await CreateStep4.render({}); // AWAIT if async
            break;
        }
      } catch (error) {
        console.error('Error rendering step:', error);
        Toast.error('Failed to render step');
      }
    }
  };

  // ============= UPDATE DRAFT INFO BAR =============
  const updateDraftInfoBar = (draft) => {
    const infoBar = document.getElementById('draft-info-bar');
    if (!infoBar) return;
    
    infoBar.style.display = 'flex';
    
    const titleSpan = document.getElementById('draft-title');
    if (titleSpan) {
      titleSpan.textContent = draft?.title || 'Untitled Itinerary';
    }
    
    // Clear any unsaved indicator
    const statusEl = document.getElementById('draft-status');
    if (statusEl) {
      statusEl.style.display = 'none';
      statusEl.classList.remove('unsaved');
    }
  };

  // ============= SAVE HANDLERS =============
  const handleSaveDraft = async () => {
    await saveCurrentStep();
  };

  const saveCurrentStep = async () => {
    // Prevent multiple simultaneous saves
    if (isSaving) {
      console.log('Save already in progress');
      return false;
    }
    
    if (!currentDraftId) {
      Toast.error('No draft to save');
      return false;
    }
    
    isSaving = true;
    showLoadingOverlay('Saving...');
    
    try {
      let success = false;
      
      switch(currentStep) {
        case 1:
          success = await CreateStep1.saveStep();
          break;
        case 2:
          success = await CreateStep2.saveStep();
          break;
        case 3:
          success = await CreateStep3.saveStep();
          break;
        case 4:
          success = await CreateStep4.saveStep();
          break;
      }
      
      if (success) {
        Toast.success('Draft saved');
        
        // Update the saved indicator
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
      
      return success;
      
    } catch (error) {
      console.error('Save error:', error);
      Toast.error(error.message || 'Failed to save');
      return false;
    } finally {
      hideLoadingOverlay();
      isSaving = false;
    }
  };

  // ============= NAVIGATION HANDLERS =============
  const handleGoToStep = async ({ data }) => {
    const targetStep = parseInt(data.step);
    if (!targetStep || targetStep < 1 || targetStep > 4) return;
    
    await navigateToStep(targetStep);
  };

  const handlePreviousStep = async () => {
    if (currentStep > 1) {
      await navigateToStep(currentStep - 1);
    }
  };

  const handleNextStep = async () => {
    if (currentStep < 4) {
      await navigateToStep(currentStep + 1);
    }
  };

  const navigateToStep = async (step) => {
    // Save current step first if moving forward
    if (step > currentStep) {
      // Validate current step
      let canNavigate = true;
      
      switch(currentStep) {
        case 1:
          canNavigate = CreateStep1.validateStep ? CreateStep1.validateStep() : true;
          break;
        case 2:
          canNavigate = CreateStep2.validateDays ? CreateStep2.validateDays() : true;
          break;
        case 3:
          canNavigate = CreateStep3.validateStep ? CreateStep3.validateStep() : true;
          break;
      }
      
      if (!canNavigate) {
        return false;
      }
      
      // Save current step before moving
      const saved = await saveCurrentStep();
      if (!saved) {
        Toast.error('Please save your changes before continuing');
        return false;
      }
    }
    
    // Update step in database
    if (currentDraftId) {
      await API.drafts.update(currentDraftId, { current_step: step });
    }
    
    // Render the new step
    await renderStep(step);
    return true;
  };

  // ============= GET CURRENT DRAFT FROM DATABASE =============
  const getCurrentDraft = async () => {
    if (!currentDraftId) return null;
    
    const { data: draft, error } = await API.drafts.get(currentDraftId);
    
    if (error) {
      console.error('Error fetching current draft:', error);
      return null;
    }
    
    return draft;
  };

  // ============= LOADING OVERLAY =============
  const showLoadingOverlay = (message = 'Loading...') => {
    if (!loadingOverlay) {
      loadingOverlay = document.createElement('div');
      loadingOverlay.className = 'loading-overlay';
      loadingOverlay.innerHTML = `
        <div class="loading-content">
          <div class="spinner"></div>
          <p>${message}</p>
        </div>
      `;
      document.body.appendChild(loadingOverlay);
    } else {
      const messageEl = loadingOverlay.querySelector('p');
      if (messageEl) messageEl.textContent = message;
    }
    
    loadingOverlay.classList.add('active');
  };

  const hideLoadingOverlay = () => {
    if (loadingOverlay) {
      loadingOverlay.classList.remove('active');
    }
  };

  // ============= MARK AS UNSAVED =============
  const markAsUnsaved = () => {
    const statusEl = document.getElementById('draft-status');
    if (statusEl) {
      statusEl.style.display = 'inline-flex';
      statusEl.textContent = '• Unsaved changes';
      statusEl.classList.add('unsaved');
    }
  };

  // ============= UTILITY FUNCTIONS =============
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  // ============= PUBLIC API =============
  return {
    init,
    renderStep,
    navigateToStep,
    getCurrentDraftId: () => currentDraftId,
    setDraftId: (id) => { currentDraftId = id; },
    getCurrentStep: () => currentStep,
    getCurrentDraft,
    saveCurrentStep,
    showLoadingOverlay,
    hideLoadingOverlay,
    markAsUnsaved,
    updateDraftInfoBar
  };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', CreateController.init);
} else {
  CreateController.init();
}
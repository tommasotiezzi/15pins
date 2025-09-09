/**
 * Create Controller - Manages the creation flow
 * Database is the single source of truth - no local storage or in-memory caching
 */

const CreateController = (() => {
  // Current state - only tracking IDs, not data
  let currentDraftId = null;
  let currentStep = 1;
  let loadingOverlay = null;

  // ============= INITIALIZATION =============
  const init = () => {
    console.log('CreateController initialized');
    
    // Setup event listeners
    Events.on('page:create:activate', handlePageActivate);
    Events.on('action:start-new-itinerary', startNewItinerary);
    Events.on('action:continue-draft', continueDraft);
    Events.on('action:delete-draft', deleteDraft);
    Events.on('action:view-drafts', viewDrafts);
    
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
  const startNewItinerary = () => {
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
    
    // Render step 1
    renderStep(1);
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
      
      // Render the appropriate step
      renderStep(currentStep);
      
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
    }
    
    // Reload drafts list
    await loadUserDrafts();
  };

  // ============= VIEW DRAFTS =============
  const viewDrafts = () => {
    // Clear current draft
    currentDraftId = null;
    currentStep = 1;
    
    // Show selector
    showDraftSelector();
  };

  // ============= RENDER STEP =============
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
          return;
        }
        
        // Pass fresh data to step render
        switch(step) {
          case 1:
            CreateStep1.render(draft);
            break;
          case 2:
            CreateStep2.render(draft);
            break;
          case 3:
            CreateStep3.render(draft);
            break;
          case 4:
            CreateStep4.render(draft);
            break;
        }
        
      } catch (error) {
        console.error('Error loading step data:', error);
        Toast.error('Failed to load step data');
      } finally {
        hideLoadingOverlay();
      }
    } else {
      // New draft - render empty step
      switch(step) {
        case 1:
          CreateStep1.render({});
          break;
        case 2:
          CreateStep2.render({});
          break;
        case 3:
          CreateStep3.render({});
          break;
        case 4:
          CreateStep4.render({});
          break;
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
  };

  // ============= SAVE CURRENT STEP =============
  const saveCurrentStep = async () => {
    if (!currentDraftId) {
      Toast.error('No draft to save');
      return false;
    }
    
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
        Toast.success('Saved');
        
        // Update the saved indicator
        const statusEl = document.getElementById('draft-status');
        if (statusEl) {
          statusEl.style.display = 'inline-flex';
          statusEl.textContent = '✓ Saved';
          setTimeout(() => {
            statusEl.style.display = 'none';
          }, 2000);
        }
      }
      
      return success;
      
    } catch (error) {
      console.error('Save error:', error);
      Toast.error('Failed to save');
      return false;
    } finally {
      hideLoadingOverlay();
    }
  };

  // ============= NAVIGATION =============
  const navigateToStep = async (step) => {
    // Validate current step before moving
    let canNavigate = true;
    
    switch(currentStep) {
      case 1:
        canNavigate = CreateStep1.validateStep();
        break;
      case 2:
        canNavigate = CreateStep2.validateStep();
        break;
      case 3:
        canNavigate = CreateStep3.validateStep();
        break;
    }
    
    if (!canNavigate && step > currentStep) {
      return false;
    }
    
    // Update step in database
    if (currentDraftId) {
      await API.drafts.update(currentDraftId, { current_step: step });
    }
    
    renderStep(step);
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
    getCurrentDraft,  // Now always fetches from DB
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
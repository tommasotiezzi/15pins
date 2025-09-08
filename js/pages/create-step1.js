/**
 * Create Step 1 - Basic Setup
 * Handles initial itinerary setup: title, destination, duration, price tier
 */

const CreateStep1 = (() => {
  
  // ============= INITIALIZATION =============
  const init = () => {
    // Setup form events
    Events.on('action:continue-setup', handleContinue);
    Events.on('form:setup', handleFormSubmit);
  };

  // ============= RENDER STEP =============
  const render = () => {
    const draft = CreateController.getCurrentDraft();
    if (!draft) return;
    
    populateForm(draft);
    updateCharacterCounts();
    
    // Lock price tier if already set
    if (draft.tier_locked) {
      const radios = document.querySelectorAll('input[name="product_type"]');
      radios.forEach(radio => radio.disabled = true);
    }
  };

  // ============= CONTINUE TO STEP 2 =============
  const handleContinue = async () => {
    const form = document.getElementById('setup-form');
    if (!form) {
      console.error('Setup form not found');
      return;
    }
    
    // Validate form
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // Get or create draft
    let draftId = CreateController.getCurrentDraftId();
    let draft = CreateController.getCurrentDraft();
    
    if (!draftId) {
      // Create new draft
      CreateController.showLoadingOverlay('Creating draft...');
      
      try {
        const { data: newDraft, error } = await API.drafts.create(parseInt(data.product_type));
        if (error) throw error;
        
        draftId = newDraft.id;
        draft = newDraft;
        CreateController.setDraftId(draftId);
        CreateController.setDraft(draft);
        
      } catch (error) {
        CreateController.hideLoadingOverlay();
        Toast.error('Failed to create draft');
        console.error('Draft creation error:', error);
        return;
      }
    }
    
    // Update draft with form data
    draft.title = data.title;
    draft.destination = data.destination;
    draft.duration_days = parseInt(data.duration);
    draft.description = data.description;
    draft.price_tier = parseInt(data.product_type);
    
    // Save and continue
    try {
      CreateController.showLoadingOverlay('Saving setup...');
      
      const draftData = {
        title: data.title,
        destination: data.destination,
        duration_days: parseInt(data.duration),
        description: data.description,
        price_tier: parseInt(data.product_type),
        current_step: 2,
        days: draft.days || createDefaultDays(parseInt(data.duration))
      };
      
      const { error } = await API.drafts.saveComplete(draftId, draftData);
      if (error) throw error;
      
      // Update local state
      draft.days = draftData.days;
      CreateController.setDraft(draft);
      
      Toast.success('Setup saved');
      
      // Navigate to Step 2
      CreateController.renderStep(2);
      
    } catch (error) {
      Toast.error('Failed to save setup');
      console.error('Save error:', error);
    } finally {
      CreateController.hideLoadingOverlay();
    }
  };

  // ============= FORM SUBMIT HANDLER =============
  const handleFormSubmit = async ({ form }) => {
    // This is the same as handleContinue but triggered by form submit
    await handleContinue();
  };

  // ============= SAVE STEP (Called by Controller) =============
  const saveStep = async () => {
    const form = document.getElementById('setup-form');
    if (!form || !form.checkValidity()) {
      throw new Error('Invalid form data');
    }
    
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const draftId = CreateController.getCurrentDraftId();
    
    if (!draftId) {
      throw new Error('No draft to save');
    }
    
    const draftData = {
      title: data.title,
      destination: data.destination,
      duration_days: parseInt(data.duration),
      description: data.description,
      price_tier: parseInt(data.product_type),
      current_step: CreateController.getCurrentStep()
    };
    
    const { error } = await API.drafts.update(draftId, draftData);
    if (error) throw error;
    
    // Update local draft
    const draft = CreateController.getCurrentDraft();
    Object.assign(draft, draftData);
    
    return true;
  };

  // ============= POPULATE FORM =============
  const populateForm = (draft) => {
    const form = document.getElementById('setup-form');
    if (!form) return;
    
    // Basic fields
    if (form.title) form.title.value = draft.title || '';
    if (form.destination) form.destination.value = draft.destination || '';
    if (form.duration) form.duration.value = draft.duration_days || '';
    if (form.description) form.description.value = draft.description || '';
    
    // Price tier
    const priceRadio = form.querySelector(`input[name="product_type"][value="${draft.price_tier}"]`);
    if (priceRadio) priceRadio.checked = true;
    
    // Add change listeners
    form.addEventListener('input', (e) => {
      CreateController.markAsUnsaved();
      updateCharacterCounts();
      
      // Update draft title in real-time for the info bar
      if (e.target.id === 'title') {
        const draft = CreateController.getCurrentDraft();
        if (draft) {
          draft.title = e.target.value;
          CreateController.updateDraftInfoBar();
        }
      }
    });
  };

  // ============= CHARACTER COUNTER =============
  const updateCharacterCounts = () => {
    const form = document.getElementById('setup-form');
    if (!form) return;
    
    // Title counter
    const titleInput = form.title;
    if (titleInput) {
      const counter = titleInput.parentElement.querySelector('.char-count');
      if (counter) {
        const length = titleInput.value.length;
        const max = titleInput.maxLength || 100;
        counter.textContent = `${length}/${max}`;
        counter.classList.toggle('warning', length > max * 0.8);
        counter.classList.toggle('danger', length >= max);
      }
    }
    
    // Description counter
    const descInput = form.description;
    if (descInput) {
      const counter = descInput.parentElement.querySelector('.char-count');
      if (counter) {
        const length = descInput.value.length;
        const max = descInput.maxLength || 500;
        counter.textContent = `${length}/${max}`;
        counter.classList.toggle('warning', length > max * 0.8);
        counter.classList.toggle('danger', length >= max);
      }
    }
  };

  // ============= CREATE DEFAULT DAYS =============
  const createDefaultDays = (duration) => {
    const days = [];
    
    for (let i = 1; i <= duration; i++) {
      days.push({
        day_number: i,
        title: `Day ${i}`,
        description: '',
        stops: []
      });
    }
    
    return days;
  };

  // ============= VALIDATION =============
  const validateStep = () => {
    const form = document.getElementById('setup-form');
    if (!form) return false;
    
    // Check required fields
    const required = ['title', 'destination', 'duration', 'description'];
    for (const field of required) {
      if (!form[field]?.value?.trim()) {
        Toast.error(`Please fill in ${field}`);
        form[field]?.focus();
        return false;
      }
    }
    
    // Check price tier
    const priceSelected = form.querySelector('input[name="product_type"]:checked');
    if (!priceSelected) {
      Toast.error('Please select a guide type');
      return false;
    }
    
    // Check duration range
    const duration = parseInt(form.duration.value);
    if (duration < 1 || duration > 90) {
      Toast.error('Duration must be between 1 and 90 days');
      form.duration.focus();
      return false;
    }
    
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
// CreateStep1 will be initialized by CreateController
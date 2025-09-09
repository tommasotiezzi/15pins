/**
 * Create Step 3 - Trip Details
 * Database is the single source of truth - no local storage
 */

const CreateStep3 = (() => {
  
  // ============= INITIALIZATION =============
  const init = () => {
    // Essential section toggles
    Events.on('action:toggle-essential', toggleEssentialSection);
    
    // Save events
    Events.on('action:save-step3', handleManualSave);
    
    // Navigation
    Events.on('action:continue-to-review', handleContinueToReview);
    Events.on('action:back-to-days', handleBackToDays);
  };

  // ============= RENDER STEP (ASYNC) =============
  const render = async () => {
    const draftId = CreateController.getCurrentDraftId();
    if (!draftId) {
      Toast.error('No draft found');
      return;
    }
    
    // Load existing data from database
    await loadExistingData();
    
    // Setup listeners
    setupCharacteristicListeners();
    setupEssentialListeners();
    
    // Update UI
    updateCompletionChecklist();
  };

  // ============= LOAD EXISTING DATA =============
  const loadExistingData = async () => {
    const draftId = CreateController.getCurrentDraftId();
    if (!draftId) return;
    
    try {
      // Load characteristics
      const { data: characteristics } = await API.drafts.getCharacteristics(draftId);
      if (characteristics) {
        populateCharacteristics(characteristics);
      }
      
      // Load essentials
      const essentials = await API.drafts.getAllEssentials(draftId);
      if (essentials.transportation) {
        populateTransportation(essentials.transportation);
      }
      if (essentials.accommodation) {
        populateAccommodation(essentials.accommodation);
      }
      if (essentials.travel_tips) {
        populateTravelTips(essentials.travel_tips);
      }
      
    } catch (error) {
      console.error('Error loading Step 3 data:', error);
    }
  };

  // ============= SAVE STEP (Called by Controller) =============
  const saveStep = async () => {
    const draftId = CreateController.getCurrentDraftId();
    if (!draftId) {
      throw new Error('No draft to save');
    }
    
    try {
      // Save characteristics if filled
      if (validateCharacteristics()) {
        const characteristics = getCharacteristicsData();
        await API.drafts.saveCharacteristics(draftId, characteristics);
      }
      
      // Save transportation if has content
      const transportData = getTransportationData();
      if (Object.values(transportData).some(v => v?.trim())) {
        await API.drafts.saveTransportation(draftId, transportData);
      }
      
      // Save accommodation if has content
      const accommodationData = getAccommodationData();
      if (Object.values(accommodationData).some(v => v?.trim())) {
        await API.drafts.saveAccommodation(draftId, accommodationData);
      }
      
      // Save travel tips if has content
      const tipsData = getTravelTipsData();
      if (Object.values(tipsData).some(v => v?.trim())) {
        await API.drafts.saveTravelTips(draftId, tipsData);
      }
      
      // Update step in draft
      await API.drafts.update(draftId, { current_step: 3 });
      
      return true;
      
    } catch (error) {
      console.error('Error saving Step 3:', error);
      throw error;
    }
  };

  // ============= NAVIGATION =============
  const handleContinueToReview = async () => {
    if (!validateCharacteristics()) {
      Toast.error('Please complete all trip characteristics (required)');
      
      // Scroll to characteristics section
      const charSection = document.querySelector('.characteristics-section');
      if (charSection) {
        charSection.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }
    
    // Save before continuing
    try {
      await saveStep();
      // Use the controller's navigation method
      await CreateController.navigateToStep(4);
    } catch (error) {
      Toast.error('Failed to save trip details');
    }
  };

  const handleBackToDays = async () => {
    // Save current state before going back
    try {
      await saveStep();
    } catch (error) {
      console.error('Error saving before navigation:', error);
    }
    
    // Navigate back to step 2
    await CreateController.navigateToStep(2);
  };

  // ============= MANUAL SAVE =============
  const handleManualSave = async () => {
    const button = document.querySelector('[data-action="save-step3"]');
    const originalText = button ? button.textContent : 'Save Trip Details';
    
    if (button) {
      button.disabled = true;
      button.textContent = 'Saving...';
    }
    
    try {
      await saveStep();
      Toast.success('Trip details saved');
      
      // Update UI to show saved state
      const statusEl = document.getElementById('draft-status');
      if (statusEl) {
        statusEl.style.display = 'inline-flex';
        statusEl.textContent = '✓ Saved';
        statusEl.classList.remove('unsaved');
        setTimeout(() => {
          statusEl.style.display = 'none';
        }, 2000);
      }
      
      updateCompletionChecklist();
      
    } catch (error) {
      Toast.error('Failed to save trip details');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  };

  // ============= CHARACTERISTICS =============
  const populateCharacteristics = (characteristics) => {
    const fields = ['physical_demand', 'cultural_immersion', 'pace', 'budget_level', 'social_style'];
    
    fields.forEach(field => {
      if (characteristics[field]) {
        const radio = document.querySelector(`input[name="${field}"][value="${characteristics[field]}"]`);
        if (radio) {
          radio.checked = true;
          // Add visual feedback
          const parent = radio.closest('.radio-card-content');
          if (parent) {
            radio.closest('.characteristic-options')
              ?.querySelectorAll('.radio-card-content')
              .forEach(card => card.classList.remove('selected'));
            parent.classList.add('selected');
          }
        }
      }
    });
  };

  const getCharacteristicsData = () => {
    return {
      physical_demand: parseInt(document.querySelector('input[name="physical_demand"]:checked')?.value) || null,
      cultural_immersion: parseInt(document.querySelector('input[name="cultural_immersion"]:checked')?.value) || null,
      pace: parseInt(document.querySelector('input[name="pace"]:checked')?.value) || null,
      budget_level: parseInt(document.querySelector('input[name="budget_level"]:checked')?.value) || null,
      social_style: parseInt(document.querySelector('input[name="social_style"]:checked')?.value) || null
    };
  };

  const validateCharacteristics = () => {
    const data = getCharacteristicsData();
    return Object.values(data).every(v => v !== null && !isNaN(v));
  };

  // ============= TRANSPORTATION =============
  const populateTransportation = (data) => {
    if (data.getting_there) {
      const field = document.getElementById('getting_there');
      if (field) field.value = data.getting_there;
    }
    if (data.getting_around) {
      const field = document.getElementById('getting_around');
      if (field) field.value = data.getting_around;
    }
    if (data.local_transport_tips) {
      const field = document.getElementById('local_transport_tips');
      if (field) field.value = data.local_transport_tips;
    }
    
    // Open section if has content
    const hasContent = data.getting_there || data.getting_around || data.local_transport_tips;
    if (hasContent) {
      const section = document.getElementById('transportation-section');
      const content = section?.querySelector('.section-content');
      if (content) {
        content.style.display = 'block';
        const icon = section.querySelector('.toggle-icon');
        if (icon) icon.textContent = '▲';
      }
    }
    
    updateEssentialIndicator('transportation-section');
  };

  const getTransportationData = () => {
    return {
      getting_there: document.getElementById('getting_there')?.value || '',
      getting_around: document.getElementById('getting_around')?.value || '',
      local_transport_tips: document.getElementById('local_transport_tips')?.value || ''
    };
  };

  // ============= ACCOMMODATION =============
  const populateAccommodation = (data) => {
    if (data.area_recommendations) {
      const field = document.getElementById('area_recommendations');
      if (field) field.value = data.area_recommendations;
    }
    if (data.booking_tips) {
      const field = document.getElementById('booking_tips');
      if (field) field.value = data.booking_tips;
    }
    
    // Open section if has content
    const hasContent = data.area_recommendations || data.booking_tips;
    if (hasContent) {
      const section = document.getElementById('accommodation-section');
      const content = section?.querySelector('.section-content');
      if (content) {
        content.style.display = 'block';
        const icon = section.querySelector('.toggle-icon');
        if (icon) icon.textContent = '▲';
      }
    }
    
    updateEssentialIndicator('accommodation-section');
  };

  const getAccommodationData = () => {
    return {
      area_recommendations: document.getElementById('area_recommendations')?.value || '',
      booking_tips: document.getElementById('booking_tips')?.value || ''
    };
  };

  // ============= TRAVEL TIPS =============
  const populateTravelTips = (data) => {
    const fields = ['best_time_to_visit', 'visa_requirements', 'packing_suggestions', 'budget_breakdown', 'other_tips'];
    
    let hasContent = false;
    fields.forEach(field => {
      if (data[field]) {
        const element = document.getElementById(field);
        if (element) {
          element.value = data[field];
          hasContent = true;
        }
      }
    });
    
    // Open section if has content
    if (hasContent) {
      const section = document.getElementById('tips-section');
      const content = section?.querySelector('.section-content');
      if (content) {
        content.style.display = 'block';
        const icon = section.querySelector('.toggle-icon');
        if (icon) icon.textContent = '▲';
      }
    }
    
    updateEssentialIndicator('tips-section');
  };

  const getTravelTipsData = () => {
    return {
      best_time_to_visit: document.getElementById('best_time_to_visit')?.value || '',
      visa_requirements: document.getElementById('visa_requirements')?.value || '',
      packing_suggestions: document.getElementById('packing_suggestions')?.value || '',
      budget_breakdown: document.getElementById('budget_breakdown')?.value || '',
      other_tips: document.getElementById('other_tips')?.value || ''
    };
  };

  // ============= ESSENTIAL SECTIONS =============
  const toggleEssentialSection = ({ data }) => {
    const section = document.getElementById(`${data.section}-section`);
    if (!section) return;
    
    const content = section.querySelector('.section-content');
    const icon = section.querySelector('.toggle-icon');
    
    if (!content || !icon) return;
    
    if (content.style.display === 'none' || !content.style.display) {
      content.style.display = 'block';
      icon.textContent = '▲';
      
      // Focus first textarea when opening
      setTimeout(() => {
        const firstTextarea = content.querySelector('textarea');
        if (firstTextarea) firstTextarea.focus();
      }, 100);
    } else {
      content.style.display = 'none';
      icon.textContent = '▼';
    }
  };

  // ============= UPDATE INDICATORS =============
  const updateCompletionChecklist = () => {
    // Check characteristics
    const hasAllCharacteristics = validateCharacteristics();
    
    const charCheck = document.getElementById('characteristics-check');
    if (charCheck) {
      if (hasAllCharacteristics) {
        charCheck.classList.add('completed');
        const icon = charCheck.querySelector('.check-icon');
        if (icon) icon.textContent = '✓';
      } else {
        charCheck.classList.remove('completed');
        const icon = charCheck.querySelector('.check-icon');
        if (icon) icon.textContent = '○';
      }
    }
    
    // Check essentials
    updateEssentialIndicator('transportation-section');
    updateEssentialIndicator('accommodation-section');
    updateEssentialIndicator('tips-section');
  };

  const updateEssentialIndicator = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    
    const textareas = section.querySelectorAll('textarea');
    const hasContent = Array.from(textareas).some(t => t.value?.trim().length > 0);
    
    let checkId, indicator;
    if (sectionId === 'transportation-section') {
      checkId = 'transport-check';
      indicator = document.getElementById('transport-indicator');
    } else if (sectionId === 'accommodation-section') {
      checkId = 'accommodation-check';
      indicator = document.getElementById('accommodation-indicator');
    } else if (sectionId === 'tips-section') {
      checkId = 'tips-check';
      indicator = document.getElementById('tips-indicator');
    }
    
    const checkItem = document.getElementById(checkId);
    if (checkItem) {
      if (hasContent) {
        section.classList.add('has-content');
        checkItem.classList.add('completed');
        const icon = checkItem.querySelector('.check-icon');
        if (icon) icon.textContent = '✓';
        if (indicator) {
          indicator.textContent = '✓ Added';
          indicator.className = 'completion-indicator completed';
        }
      } else {
        section.classList.remove('has-content');
        checkItem.classList.remove('completed');
        const icon = checkItem.querySelector('.check-icon');
        if (icon) icon.textContent = '○';
        if (indicator) {
          indicator.textContent = '';
          indicator.className = 'completion-indicator';
        }
      }
    }
  };

  // ============= SETUP LISTENERS =============
  const setupCharacteristicListeners = () => {
    document.querySelectorAll('.characteristics-section input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', () => {
        CreateController.markAsUnsaved();
        updateCompletionChecklist();
        
        // Visual feedback
        const parent = radio.closest('.radio-card-content');
        if (parent) {
          // Remove active from siblings
          radio.closest('.characteristic-options')
            ?.querySelectorAll('.radio-card-content')
            .forEach(card => card.classList.remove('selected'));
          
          // Add active to selected
          parent.classList.add('selected');
        }
      });
    });
  };

  const setupEssentialListeners = () => {
    document.querySelectorAll('.essentials-section textarea').forEach(textarea => {
      textarea.addEventListener('input', () => {
        CreateController.markAsUnsaved();
        updateEssentialIndicator(textarea.closest('.essentials-section').id);
      });
      
      // Add character counter for longer fields
      if (textarea.maxLength && textarea.maxLength > 500) {
        let counter = textarea.parentElement.querySelector('.char-count');
        if (!counter) {
          counter = document.createElement('div');
          counter.className = 'char-count';
          counter.textContent = `0/${textarea.maxLength}`;
          textarea.parentElement.appendChild(counter);
        }
        
        // Update counter on input
        const updateCounter = () => {
          counter.textContent = `${textarea.value.length}/${textarea.maxLength}`;
          counter.classList.toggle('warning', textarea.value.length > textarea.maxLength * 0.8);
        };
        
        updateCounter(); // Initial count
        textarea.addEventListener('input', updateCounter);
      }
    });
  };

  // ============= VALIDATION =============
  const validateStep = () => {
    if (!validateCharacteristics()) {
      Toast.error('Please complete all trip characteristics');
      return false;
    }
    
    // Essentials are optional, so no validation needed
    return true;
  };

  // ============= PUBLIC API =============
  return {
    init,
    render,
    saveStep,
    validateStep,
    validateCharacteristics
  };
})();

// Auto-initialize with controller
// CreateStep3 will be initialized by CreateController
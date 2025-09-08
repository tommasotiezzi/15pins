/**
 * Create Page Controller
 * Handles itinerary creation flow with Supabase backend
 * Updated with Step 3: Trip Details
 */

const CreatePage = (() => {
  // State
  let currentDraftId = null;
  let currentDraft = null;
  let currentStep = 1;
  let selectedDayId = null;
  let hasUnsavedChanges = false;

  /**
   * Initialize create page
   */
  const init = () => {
    console.log('CreatePage init called');
    
    // Page lifecycle
    Events.on('page:create:activate', activate);
    Events.on('page:create:deactivate', deactivate);
    
    // Creation events from drafts page
    Events.on('create:new', startNewItinerary);
    Events.on('create:continue', continueDraft);
    
    // Draft management
    Events.on('action:save-draft', (eventData) => {
      console.log('Save draft triggered with:', eventData);
      saveDraft(eventData);
    });
    Events.on('action:view-drafts', () => {
      if (hasUnsavedChanges && confirm('You have unsaved changes. Save before viewing drafts?')) {
        saveDraft();
      }
      Events.emit('page:drafts:show');
    });
    
    // Setup continue button
    Events.on('action:continue-setup', () => {
      console.log('Continue setup action triggered');
      handleSetupContinue();
    });
    
    // Form submission
    Events.on('form:setup', handleSetupSubmit);
    
    // Navigation - UPDATED FOR 4 STEPS
    Events.on('action:back-to-setup', () => goToStep(1));
    Events.on('action:back-to-days', () => goToStep(2));
    Events.on('action:go-to-review', () => goToStep(3)); // Now goes to Step 3
    Events.on('action:back-to-build', () => goToStep(2));
    Events.on('action:continue-to-review', handleContinueToReview); // NEW: Step 3 -> 4
    
    // Step 3 specific events
    Events.on('action:toggle-essential', toggleEssentialSection);
    Events.on('action:save-step3', saveStep3);
    
    // Day management
    Events.on('action:add-day', addDay);
    Events.on('action:select-day', selectDay);
    Events.on('action:duplicate-day', duplicateDay);
    
    // Stop management
    Events.on('action:add-stop', addStop);
    Events.on('action:remove-stop', removeStop);
    Events.on('action:update-stop-field', updateStopField);
    
    // Publishing
    Events.on('action:publish', publish);
    
    // Navigation guard for unsaved changes
    Router.addGuard((to, from) => {
      if (from?.name === 'create' && hasUnsavedChanges) {
        return confirm('You have unsaved changes. Leave anyway?');
      }
      return true;
    });
    
    // Listen for any input changes to track unsaved changes
    document.addEventListener('input', (e) => {
      if (e.target && currentDraftId) {
        // Update title in real-time
        if (e.target.id === 'title') {
          currentDraft.title = e.target.value;
        }
        
        // Mark as having unsaved changes
        if (!hasUnsavedChanges) {
          hasUnsavedChanges = true;
        }
        
        updateDraftInfoBar();
      }
    });
  };

  /**
   * Activate create page
   */
  const activate = async () => {
    console.log('Create page activated');
    
    const user = State.get('currentUser');
    if (!user) {
      Toast.error('Please sign in to create itineraries');
      Router.navigateTo('feed');
      return;
    }

    // Show drafts page which will handle loading drafts
    Events.emit('page:drafts:show');
  };

  /**
   * Deactivate create page
   */
  const deactivate = () => {
    // Prompt to save if there are unsaved changes
    if (hasUnsavedChanges && currentDraftId) {
      if (confirm('Save your changes before leaving?')) {
        saveDraft();
      }
    }
  };

  /**
   * Show creation flow
   */
  const showCreationFlow = () => {
    const selector = document.getElementById('draft-selector');
    const flow = document.getElementById('creation-flow');
    
    if (selector) selector.style.display = 'none';
    if (flow) flow.style.display = 'block';
  };

  /**
   * Start new itinerary (called from drafts page)
   */
  const startNewItinerary = () => {
    currentDraftId = null;
    currentDraft = null;
    currentStep = 1;
    hasUnsavedChanges = false;
    selectedDayId = null;
    
    showCreationFlow();
    renderStep(1);
    
    // Update info bar
    updateDraftInfoBar();
  };

  /**
   * Continue existing draft (called from drafts page)
   * FIXED: Properly transforms Supabase structure to UI structure
   */
  const continueDraft = async ({ draftId }) => {
    // Load draft from backend
    const { data: draft, error } = await API.drafts.get(draftId);
    
    if (error || !draft) {
      Toast.error('Failed to load draft');
      Events.emit('page:drafts:show');
      return;
    }
    
    currentDraftId = draftId;
    
    // Transform the Supabase structure (draft_days/draft_stops) to UI structure (days/stops)
    currentDraft = {
      ...draft,
      // Preserve these important fields
      title: draft.title || '',
      destination: draft.destination || '',
      duration_days: draft.duration_days || 0,
      description: draft.description || '',
      price_tier: draft.price_tier || 9,
      cover_image_url: draft.cover_image_url || '',
      // Map draft_days to days for UI compatibility
      days: (draft.draft_days || []).map(day => ({
        day_number: day.day_number,
        title: day.title || `Day ${day.day_number}`,
        description: day.description || '',
        // Map draft_stops to stops
        stops: (day.draft_stops || []).map(stop => ({
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
      // Store Step 3 data if it exists
      characteristics: draft.draft_characteristics?.[0] || null,
      transportation: draft.draft_transportation?.[0] || null,
      accommodation: draft.draft_accommodation?.[0] || null,
      travel_tips: draft.draft_travel_tips?.[0] || null
    };
    
    currentStep = draft.current_step || 2;
    hasUnsavedChanges = false;
    
    showCreationFlow();
    renderStep(currentStep);
    populateDraftData();
    updateDraftInfoBar();
  };

  /**
   * Handle setup continue button (Step 1 -> Step 2)
   */
  const handleSetupContinue = async () => {
    console.log('handleSetupContinue called');
    
    const form = document.getElementById('setup-form');
    if (!form) {
      console.error('Form not found!');
      return;
    }
    
    // Validate form
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // Get selected price tier
    const priceTier = parseInt(data.product_type);
    
    console.log('Creating/updating draft with tier:', priceTier);
    
    if (!currentDraftId) {
      // Create new draft
      const { data: draft, error } = await API.drafts.create(priceTier);
      
      console.log('Draft creation result:', { draft, error });
      
      if (error) {
        console.error('Draft creation error:', error);
        Toast.error('Failed to create draft: ' + (error.message || 'Unknown error'));
        return;
      }
      
      currentDraftId = draft.id;
      currentDraft = draft;
    }
    
    // Update current draft with form data
    currentDraft.title = data.title;
    currentDraft.destination = data.destination;
    currentDraft.duration_days = parseInt(data.duration);
    currentDraft.description = data.description;
    currentDraft.price_tier = priceTier;
    
    // Prepare draft data for saving
    const draftData = {
      title: data.title,
      destination: data.destination,
      duration_days: parseInt(data.duration),
      description: data.description,
      price_tier: priceTier,
      current_step: 2,
      days: currentDraft.days || createDefaultDays(parseInt(data.duration), priceTier)
    };
    
    // Save to backend
    const { error } = await API.drafts.saveComplete(currentDraftId, draftData);
    
    if (error) {
      Toast.error('Failed to save draft');
      return;
    }
    
    // Update local state
    currentDraft = { ...currentDraft, ...draftData };
    hasUnsavedChanges = false;
    
    Toast.success('Draft saved');
    
    // Move to step 2
    goToStep(2);
    updateDraftInfoBar();
  };

  /**
   * Handle setup form submission (Step 1)
   */
  const handleSetupSubmit = async ({ form }) => {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // Get selected price tier
    const priceTier = parseInt(data.product_type);
    
    if (!currentDraftId) {
      // Create new draft
      const { data: draft, error } = await API.drafts.create(priceTier);
      
      if (error) {
        Toast.error('Failed to create draft');
        return;
      }
      
      currentDraftId = draft.id;
      currentDraft = draft;
    }
    
    // Prepare draft data
    const draftData = {
      title: data.title,
      destination: data.destination,
      duration_days: parseInt(data.duration),
      description: data.description,
      price_tier: priceTier,
      current_step: 2,
      days: createDefaultDays(parseInt(data.duration), priceTier)
    };
    
    // Save to backend
    const { error } = await API.drafts.saveComplete(currentDraftId, draftData);
    
    if (error) {
      Toast.error('Failed to save draft');
      return;
    }
    
    // Update local state
    currentDraft = { ...currentDraft, ...draftData };
    hasUnsavedChanges = false;
    
    Toast.success('Draft saved');
    
    // Move to step 2
    goToStep(2);
    updateDraftInfoBar();
  };

  /**
   * Create default days based on duration
   */
  const createDefaultDays = (duration, priceTier) => {
    const days = [];
    
    for (let i = 1; i <= duration; i++) {
      const day = {
        day_number: i,
        title: `Day ${i}`,
        description: '',
        stops: []
      };
      
      days.push(day);
    }
    
    return days;
  };

  /**
   * Render current step - UPDATED FOR 4 STEPS
   */
  const renderStep = (step) => {
    currentStep = step;
    
    // Update progress bar for 4 steps
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
    
    // Show/hide step content
    document.querySelectorAll('.create-step-content').forEach(content => {
      content.classList.remove('active');
    });
    
    const currentStepEl = document.getElementById(`step-${step}`);
    if (currentStepEl) {
      currentStepEl.classList.add('active');
    }
    
    // Step-specific setup
    if (step === 2) {
      initializeDaysBuilder();
    } else if (step === 3) {
      initializeTripDetails(); // NEW: Initialize Step 3
    } else if (step === 4) {
      renderPreview();
    }
  };

  /**
   * Go to specific step - UPDATED FOR 4 STEPS
   */
  const goToStep = (step) => {
    // Save current form values before changing steps
    if (currentStep === 2) {
      saveCurrentFormValues();
    }
    
    if (step === 2 && !currentDraftId) {
      Toast.error('Please complete setup first');
      return;
    }
    
    if (step === 3 && !validateDays()) {
      Toast.error('Please add at least one stop to each day');
      return;
    }
    
    if (step === 4 && !validateCharacteristics()) {
      Toast.error('Please complete trip characteristics');
      return;
    }
    
    renderStep(step);
  };

  /**
   * NEW: Initialize Step 3 - Trip Details
   */
  const initializeTripDetails = async () => {
    if (!currentDraftId) return;
    
    // Load existing characteristics
    const { data: characteristics } = await API.drafts.getCharacteristics(currentDraftId);
    if (characteristics) {
      populateCharacteristics(characteristics);
    }
    
    // Load existing essentials
    const essentials = await API.drafts.getAllEssentials(currentDraftId);
    if (essentials.transportation) {
      populateTransportation(essentials.transportation);
    }
    if (essentials.accommodation) {
      populateAccommodation(essentials.accommodation);
    }
    if (essentials.travel_tips) {
      populateTravelTips(essentials.travel_tips);
    }
    
    updateCompletionChecklist();
    
    // Add change listeners to update checklist in real-time
    document.querySelectorAll('input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', updateCompletionChecklist);
    });
    
    document.querySelectorAll('.essentials-section textarea').forEach(textarea => {
      textarea.addEventListener('input', () => {
        updateEssentialIndicator(textarea.closest('.essentials-section').id);
      });
    });
  };

  /**
   * NEW: Populate characteristics from saved data
   */
  const populateCharacteristics = (characteristics) => {
    if (characteristics.physical_demand) {
      const radio = document.querySelector(`input[name="physical_demand"][value="${characteristics.physical_demand}"]`);
      if (radio) radio.checked = true;
    }
    if (characteristics.cultural_immersion) {
      const radio = document.querySelector(`input[name="cultural_immersion"][value="${characteristics.cultural_immersion}"]`);
      if (radio) radio.checked = true;
    }
    if (characteristics.pace) {
      const radio = document.querySelector(`input[name="pace"][value="${characteristics.pace}"]`);
      if (radio) radio.checked = true;
    }
    if (characteristics.budget_level) {
      const radio = document.querySelector(`input[name="budget_level"][value="${characteristics.budget_level}"]`);
      if (radio) radio.checked = true;
    }
    if (characteristics.social_style) {
      const radio = document.querySelector(`input[name="social_style"][value="${characteristics.social_style}"]`);
      if (radio) radio.checked = true;
    }
  };

  /**
   * NEW: Populate transportation section
   */
  const populateTransportation = (data) => {
    if (data.getting_there) {
      document.getElementById('getting_there').value = data.getting_there;
    }
    if (data.getting_around) {
      document.getElementById('getting_around').value = data.getting_around;
    }
    if (data.local_transport_tips) {
      document.getElementById('local_transport_tips').value = data.local_transport_tips;
    }
    updateEssentialIndicator('transportation-section');
  };

  /**
   * NEW: Populate accommodation section
   */
  const populateAccommodation = (data) => {
    if (data.area_recommendations) {
      document.getElementById('area_recommendations').value = data.area_recommendations;
    }
    if (data.booking_tips) {
      document.getElementById('booking_tips').value = data.booking_tips;
    }
    updateEssentialIndicator('accommodation-section');
  };

  /**
   * NEW: Populate travel tips section
   */
  const populateTravelTips = (data) => {
    if (data.best_time_to_visit) {
      document.getElementById('best_time_to_visit').value = data.best_time_to_visit;
    }
    if (data.visa_requirements) {
      document.getElementById('visa_requirements').value = data.visa_requirements;
    }
    if (data.packing_suggestions) {
      document.getElementById('packing_suggestions').value = data.packing_suggestions;
    }
    if (data.budget_breakdown) {
      document.getElementById('budget_breakdown').value = data.budget_breakdown;
    }
    if (data.other_tips) {
      document.getElementById('other_tips').value = data.other_tips;
    }
    updateEssentialIndicator('tips-section');
  };

  /**
   * NEW: Toggle essential section open/closed
   */
  const toggleEssentialSection = ({ data }) => {
    const section = document.getElementById(`${data.section}-section`);
    const content = section.querySelector('.section-content');
    const icon = section.querySelector('.toggle-icon');
    
    if (content.style.display === 'none') {
      content.style.display = 'block';
      icon.textContent = '▲';
    } else {
      content.style.display = 'none';
      icon.textContent = '▼';
    }
  };

  /**
   * NEW: Update completion checklist
   */
  const updateCompletionChecklist = () => {
    // Check characteristics
    const hasAllCharacteristics = 
      document.querySelector('input[name="physical_demand"]:checked') &&
      document.querySelector('input[name="cultural_immersion"]:checked') &&
      document.querySelector('input[name="pace"]:checked') &&
      document.querySelector('input[name="budget_level"]:checked') &&
      document.querySelector('input[name="social_style"]:checked');
    
    const charCheck = document.getElementById('characteristics-check');
    if (charCheck) {
      if (hasAllCharacteristics) {
        charCheck.classList.add('completed');
        charCheck.querySelector('.check-icon').textContent = '✓';
      } else {
        charCheck.classList.remove('completed');
        charCheck.querySelector('.check-icon').textContent = '○';
      }
    }
    
    // Check essentials
    updateEssentialIndicator('transportation-section');
    updateEssentialIndicator('accommodation-section');
    updateEssentialIndicator('tips-section');
  };

  /**
   * NEW: Update indicator for an essential section
   */
  const updateEssentialIndicator = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    
    const textareas = section.querySelectorAll('textarea');
    const hasContent = Array.from(textareas).some(t => t.value.trim().length > 0);
    
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
        checkItem.querySelector('.check-icon').textContent = '✓';
        if (indicator) indicator.textContent = '✓ Added';
      } else {
        section.classList.remove('has-content');
        checkItem.classList.remove('completed');
        checkItem.querySelector('.check-icon').textContent = '○';
        if (indicator) indicator.textContent = '';
      }
    }
  };

  /**
   * NEW: Validate characteristics are complete
   */
  const validateCharacteristics = () => {
    return !!(
      document.querySelector('input[name="physical_demand"]:checked') &&
      document.querySelector('input[name="cultural_immersion"]:checked') &&
      document.querySelector('input[name="pace"]:checked') &&
      document.querySelector('input[name="budget_level"]:checked') &&
      document.querySelector('input[name="social_style"]:checked')
    );
  };

  /**
   * NEW: Save Step 3 data
   */
  const saveStep3 = async () => {
    if (!currentDraftId) {
      Toast.error('No draft to save');
      return;
    }
    
    const button = document.querySelector('[data-action="save-step3"]');
    const originalText = button ? button.textContent : 'Save Trip Details';
    if (button) {
      button.disabled = true;
      button.textContent = 'Saving...';
    }
    
    try {
      // Save characteristics if filled
      if (validateCharacteristics()) {
        const characteristics = {
          physical_demand: parseInt(document.querySelector('input[name="physical_demand"]:checked').value),
          cultural_immersion: parseInt(document.querySelector('input[name="cultural_immersion"]:checked').value),
          pace: parseInt(document.querySelector('input[name="pace"]:checked').value),
          budget_level: parseInt(document.querySelector('input[name="budget_level"]:checked').value),
          social_style: parseInt(document.querySelector('input[name="social_style"]:checked').value)
        };
        
        await API.drafts.saveCharacteristics(currentDraftId, characteristics);
      }
      
      // Save transportation if has content
      const transportData = {
        getting_there: document.getElementById('getting_there').value,
        getting_around: document.getElementById('getting_around').value,
        local_transport_tips: document.getElementById('local_transport_tips').value
      };
      
      if (Object.values(transportData).some(v => v.trim())) {
        await API.drafts.saveTransportation(currentDraftId, transportData);
      }
      
      // Save accommodation if has content
      const accommodationData = {
        area_recommendations: document.getElementById('area_recommendations').value,
        booking_tips: document.getElementById('booking_tips').value
      };
      
      if (Object.values(accommodationData).some(v => v.trim())) {
        await API.drafts.saveAccommodation(currentDraftId, accommodationData);
      }
      
      // Save travel tips if has content
      const tipsData = {
        best_time_to_visit: document.getElementById('best_time_to_visit').value,
        visa_requirements: document.getElementById('visa_requirements').value,
        packing_suggestions: document.getElementById('packing_suggestions').value,
        budget_breakdown: document.getElementById('budget_breakdown').value,
        other_tips: document.getElementById('other_tips').value
      };
      
      if (Object.values(tipsData).some(v => v.trim())) {
        await API.drafts.saveTravelTips(currentDraftId, tipsData);
      }
      
      // Update current step in draft
      await API.drafts.update(currentDraftId, { current_step: 3 });
      
      hasUnsavedChanges = false;
      Toast.success('Trip details saved');
      updateCompletionChecklist();
      
    } catch (error) {
      console.error('Error saving step 3:', error);
      Toast.error('Failed to save trip details');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  };

  /**
   * NEW: Handle continue from Step 3 to Step 4
   */
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
    await saveStep3();
    
    // Move to step 4 (review)
    goToStep(4);
  };

  /**
   * Initialize days builder
   */
  const initializeDaysBuilder = () => {
    if (!currentDraft) return;
    
    showPriceTierNotice();
    renderDaysList();
    
    // Select first day if none selected
    if (selectedDayId === null && currentDraft.days?.length > 0) {
      selectDay({ data: { dayId: 0 } });
    }
  };

  /**
   * Show price tier notice
   */
  const showPriceTierNotice = () => {
    const notice = document.getElementById('tier-notice');
    if (!notice || !currentDraft) return;
    
    const isDetailed = currentDraft.price_tier === 19;
    
    notice.className = isDetailed ? 'price-tier-notice detailed' : 'price-tier-notice';
    notice.innerHTML = isDetailed ? 
      `💎 <strong>Detailed Blueprint (€19)</strong> - Include times, costs, and organize by morning/afternoon/evening` :
      `✨ <strong>Basic Guide (€9)</strong> - Simple list of places with personal tips`;
  };

  /**
   * Render days list sidebar
   */
  const renderDaysList = () => {
    const container = document.getElementById('days-list');
    if (!container || !currentDraft) return;
    
    const days = currentDraft.days || [];
    
    container.innerHTML = days.map((day, index) => {
      const stopCount = day.stops?.length || 0;
      
      return `
        <div class="day-item ${selectedDayId === index ? 'active' : ''}" 
             data-action="select-day" 
             data-day-id="${index}">
          <div>
            <strong>${day.title}</strong>
            ${day.description ? `<div class="text-light">${day.description}</div>` : ''}
          </div>
          <div class="day-count">${stopCount} stops</div>
        </div>
      `;
    }).join('');
  };

  /**
   * Select a day for editing
   */
  const selectDay = ({ data }) => {
    // Save current form values before switching days
    if (selectedDayId !== null) {
      saveCurrentFormValues();
    }
    
    selectedDayId = parseInt(data.dayId);
    renderDaysList();
    renderDayEditor();
  };

  /**
   * Save current form values before re-rendering
   * THIS IS THE KEY FIX FOR DATA LOSS
   */
  const saveCurrentFormValues = () => {
    if (!currentDraft || selectedDayId === null) return;
    
    const day = currentDraft.days[selectedDayId];
    if (!day) return;
    
    // Save day title and description
    const dayTitle = document.querySelector('.day-title-input');
    if (dayTitle) {
      day.title = dayTitle.value;
    }
    
    const dayDesc = document.querySelector('input[placeholder*="Brief description"]');
    if (dayDesc) {
      day.description = dayDesc.value;
    }
    
    // Save all stop values
    document.querySelectorAll('.stop-item').forEach((stopEl, index) => {
      if (!day.stops || !day.stops[index]) return;
      
      const stop = day.stops[index];
      
      // Save all input fields for this stop
      stopEl.querySelectorAll('input, textarea, select').forEach(input => {
        const field = input.dataset.field;
        if (!field) return;
        
        let value = input.value;
        
        // Handle special fields
        if (field === 'cost_cents' && value) {
          value = parseFloat(value) * 100; // Convert euros to cents
        } else if (input.type === 'number' && value) {
          value = parseFloat(value) || 0;
        }
        
        stop[field] = value;
      });
    });
  };

  /**
   * Render day editor
   */
  const renderDayEditor = () => {
    const container = document.getElementById('day-editor-content');
    if (!container || !currentDraft) return;
    
    const day = currentDraft.days[selectedDayId];
    if (!day) return;
    
    const isDetailed = currentDraft.price_tier === 19;
    
    container.innerHTML = `
      <div>
        <input type="text" 
               class="day-title-input" 
               value="${day.title || ''}" 
               placeholder="Day ${day.day_number}"
               onchange="CreatePage.updateDayField(${selectedDayId}, 'title', this.value)">
        
        <input type="text" 
               class="form-control" 
               style="margin-bottom: 24px;"
               value="${day.description || ''}" 
               placeholder="Brief description of this day (optional)"
               onchange="CreatePage.updateDayField(${selectedDayId}, 'description', this.value)">
        
        <div class="flex justify-between items-center mb-3">
          <h3>Stops for ${day.title}</h3>
          <button class="btn btn-sm btn-secondary" 
                  data-action="duplicate-day" 
                  data-day-id="${selectedDayId}">
            Duplicate Day
          </button>
        </div>
        
        <div id="stops-container">
          ${renderStops(day.stops || [], isDetailed)}
        </div>
        
        <button class="btn btn-primary" 
                data-action="add-stop" 
                data-day-id="${selectedDayId}">
          + Add Stop
        </button>
      </div>
    `;
    
    // Set up change handlers for all stop fields
    container.querySelectorAll('[data-action="update-stop-field"]').forEach(input => {
      input.addEventListener('change', (e) => {
        Events.emit('action:update-stop-field', { 
          data: e.target.dataset, 
          target: e.target 
        });
      });
    });
    
    // Mark as having changes when editing
    container.addEventListener('input', () => {
      hasUnsavedChanges = true;
    });
  };

  /**
   * Render stops
   */
  const renderStops = (stops, isDetailed) => {
    if (stops.length === 0) {
      return `
        <div class="empty-state" style="padding: 40px; background: var(--gray-50); border-radius: 12px;">
          <p>No stops added yet. Start building your perfect day!</p>
        </div>
      `;
    }
    
    return stops.map((stop, index) => renderStop(stop, index, isDetailed)).join('');
  };

  /**
   * Render individual stop
   */
  const renderStop = (stop, index, isDetailed) => {
    const stopTypes = [
      { value: 'attraction', icon: '🏛️', label: 'Attraction' },
      { value: 'food', icon: '🍜', label: 'Food' },
      { value: 'accommodation', icon: '🏨', label: 'Accommodation' },
      { value: 'transport', icon: '🚌', label: 'Transport' },
      { value: 'beach', icon: '🏖️', label: 'Beach' },
      { value: 'nightlife', icon: '🌃', label: 'Nightlife' },
      { value: 'shopping', icon: '🛍️', label: 'Shopping' },
      { value: 'activity', icon: '🎯', label: 'Activity' }
    ];
    
    if (isDetailed) {
      // Detailed stop for €19
      return `
        <div class="stop-item detailed" data-stop-index="${index}">
          <div class="stop-header">
            <div>
              <span class="stop-number">${index + 1}</span>
              <div class="stop-content">
                <input type="text" 
                       class="form-control" 
                       placeholder="Place name" 
                       value="${stop.name || ''}"
                       data-action="update-stop-field"
                       data-stop-index="${index}"
                       data-field="name"
                       style="font-weight: 600; margin-bottom: 8px;">
              </div>
            </div>
            <button class="btn-ghost" 
                    data-action="remove-stop" 
                    data-stop-index="${index}">
              Remove
            </button>
          </div>
          
          <div class="form-row" style="margin-top: 16px;">
            <div class="form-group">
              <label>Time Period</label>
              <select class="form-control"
                      data-action="update-stop-field"
                      data-stop-index="${index}"
                      data-field="time_period">
                <option value="">Select...</option>
                <option value="morning" ${stop.time_period === 'morning' ? 'selected' : ''}>Morning</option>
                <option value="afternoon" ${stop.time_period === 'afternoon' ? 'selected' : ''}>Afternoon</option>
                <option value="evening" ${stop.time_period === 'evening' ? 'selected' : ''}>Evening</option>
              </select>
            </div>
            <div class="form-group">
              <label>Start Time</label>
              <input type="time" 
                     class="form-control"
                     value="${stop.start_time || ''}"
                     data-action="update-stop-field"
                     data-stop-index="${index}"
                     data-field="start_time">
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Duration (minutes)</label>
              <input type="number" 
                     class="form-control" 
                     placeholder="60"
                     value="${stop.duration_minutes || ''}"
                     data-action="update-stop-field"
                     data-stop-index="${index}"
                     data-field="duration_minutes">
            </div>
            <div class="form-group">
              <label>Cost (€)</label>
              <input type="number" 
                     class="form-control" 
                     placeholder="0"
                     value="${stop.cost_cents ? stop.cost_cents / 100 : ''}"
                     data-action="update-stop-field"
                     data-stop-index="${index}"
                     data-field="cost_cents">
            </div>
          </div>
          
          <div class="form-group">
            <label>Description/Tips</label>
            <textarea class="form-control" 
                      placeholder="What to see/do here? Any insider tips?"
                      data-action="update-stop-field"
                      data-stop-index="${index}"
                      data-field="description"
                      style="min-height: 80px;">${stop.description || ''}</textarea>
          </div>
        </div>
      `;
    } else {
      // Basic stop for €9
      return `
        <div class="stop-item" data-stop-index="${index}">
          <div class="stop-header">
            <div>
              <span class="stop-number">${index + 1}</span>
              <div class="stop-content">
                <input type="text" 
                       class="form-control" 
                       placeholder="Stop name (e.g., Tegallalang Rice Terraces)" 
                       value="${stop.name || ''}"
                       data-action="update-stop-field"
                       data-stop-index="${index}"
                       data-field="name"
                       style="font-weight: 600; margin-bottom: 8px;">
                
                <select class="form-control" 
                        style="width: auto; display: inline-block;"
                        data-action="update-stop-field"
                        data-stop-index="${index}"
                        data-field="type">
                  ${stopTypes.map(type => `
                    <option value="${type.value}" ${stop.type === type.value ? 'selected' : ''}>
                      ${type.icon} ${type.label}
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>
            <button class="btn-ghost" 
                    data-action="remove-stop" 
                    data-stop-index="${index}">
              Remove
            </button>
          </div>
          
          <div class="form-group" style="margin-top: 16px;">
            <label>Your insider tip (required)</label>
            <textarea class="form-control" 
                      placeholder="What makes this special? Best time to visit? Hidden spots?"
                      data-action="update-stop-field"
                      data-stop-index="${index}"
                      data-field="tip"
                      style="min-height: 80px;">${stop.tip || ''}</textarea>
          </div>
        </div>
      `;
    }
  };

  /**
   * Add stop - FIXED with saveCurrentFormValues
   */
  const addStop = ({ data }) => {
    if (!currentDraft) return;
    
    // CRITICAL FIX: Save current form values before re-rendering
    saveCurrentFormValues();
    
    const dayIndex = selectedDayId;
    const day = currentDraft.days[dayIndex];
    
    if (!day.stops) {
      day.stops = [];
    }
    
    const newStop = {
      name: '',
      type: 'attraction',
      position: day.stops.length + 1
    };
    
    if (currentDraft.price_tier === 19) {
      // Add detailed fields
      Object.assign(newStop, {
        time_period: '',
        start_time: '',
        duration_minutes: 60,
        cost_cents: 0,
        description: ''
      });
    } else {
      // Basic fields
      newStop.tip = '';
    }
    
    day.stops.push(newStop);
    hasUnsavedChanges = true;
    
    renderDaysList();
    renderDayEditor();
  };

  /**
   * Remove stop - FIXED with saveCurrentFormValues
   */
  const removeStop = ({ data }) => {
    if (!currentDraft) return;
    
    // CRITICAL FIX: Save current values first
    saveCurrentFormValues();
    
    const day = currentDraft.days[selectedDayId];
    day.stops.splice(data.stopIndex, 1);
    
    // Update positions
    day.stops.forEach((stop, index) => {
      stop.position = index + 1;
    });
    
    hasUnsavedChanges = true;
    
    renderDaysList();
    renderDayEditor();
  };

  /**
   * Update stop field
   */
  const updateStopField = ({ data, target }) => {
    if (!currentDraft) return;
    
    const day = currentDraft.days[selectedDayId];
    const stop = day.stops[data.stopIndex];
    
    if (!stop) return;
    
    let value = target.value;
    
    // Handle special fields
    if (data.field === 'cost_cents') {
      value = parseFloat(value) * 100; // Convert euros to cents
    } else if (target.type === 'number') {
      value = parseFloat(value) || 0;
    }
    
    stop[data.field] = value;
    hasUnsavedChanges = true;
    
    // Update sidebar count if name changed
    if (data.field === 'name') {
      renderDaysList();
    }
  };

  /**
   * Add day
   */
  const addDay = () => {
    if (!currentDraft) return;
    
    // Save current form values first
    saveCurrentFormValues();
    
    const newDay = {
      day_number: currentDraft.days.length + 1,
      title: `Day ${currentDraft.days.length + 1}`,
      description: '',
      stops: []
    };
    
    currentDraft.days.push(newDay);
    hasUnsavedChanges = true;
    
    renderDaysList();
    selectDay({ data: { dayId: currentDraft.days.length - 1 } });
  };

  /**
   * Duplicate day
   */
  const duplicateDay = ({ data }) => {
    if (!currentDraft) return;
    
    // Save current form values first
    saveCurrentFormValues();
    
    const dayToDuplicate = currentDraft.days[data.dayId];
    if (!dayToDuplicate) return;
    
    const newDay = {
      ...dayToDuplicate,
      day_number: currentDraft.days.length + 1,
      title: `${dayToDuplicate.title} (Copy)`,
      stops: dayToDuplicate.stops.map(stop => ({ ...stop }))
    };
    
    currentDraft.days.push(newDay);
    hasUnsavedChanges = true;
    
    renderDaysList();
    selectDay({ data: { dayId: currentDraft.days.length - 1 } });
  };

  /**
   * Save draft - FIXED with better error handling and event management
   */
  const saveDraft = async (eventData) => {
    // Prevent default if it's from a form
    if (eventData && eventData.event && eventData.event.preventDefault) {
      eventData.event.preventDefault();
    }
    
    if (!currentDraftId || !currentDraft) {
      Toast.error('No draft to save');
      return;
    }
    
    // Save current form values before saving
    saveCurrentFormValues();
    
    // If we're on step 1, also save the form values
    if (currentStep === 1) {
      const form = document.getElementById('setup-form');
      if (form) {
        currentDraft.title = form.title.value;
        currentDraft.destination = form.destination.value;
        currentDraft.duration_days = parseInt(form.duration.value) || currentDraft.duration_days;
        currentDraft.description = form.description.value;
      }
    }
    
    // Get the button that was clicked
    const button = eventData?.target || document.querySelector('[data-action="save-draft"]');
    const originalText = button ? button.textContent : 'Save Draft';
    
    if (button) {
      button.disabled = true;
      button.textContent = 'Saving...';
    }
    
    try {
      // Prepare the data - use the transformed 'days' structure
      const draftData = {
        title: currentDraft.title || '',
        destination: currentDraft.destination || '',
        duration_days: currentDraft.duration_days || 0,
        description: currentDraft.description || '',
        cover_image_url: currentDraft.cover_image_url || '',
        current_step: currentStep,
        price_tier: currentDraft.price_tier || 9,
        days: currentDraft.days || []  // This is already in the right format from our UI operations
      };
      
      console.log('Saving draft data:', draftData);
      console.log('Draft ID:', currentDraftId);
      
      const { error } = await API.drafts.saveComplete(currentDraftId, draftData);
      
      if (error) {
        console.error('Save draft error:', error);
        Toast.error('Failed to save draft: ' + (error.message || 'Unknown error'));
        
        if (button) {
          button.disabled = false;
          button.textContent = originalText;
        }
        return;
      }
      
      hasUnsavedChanges = false;
      Toast.success('Draft saved');
      
      // Update last saved time
      currentDraft.last_saved_at = new Date().toISOString();
      updateDraftInfoBar();
      
    } catch (err) {
      console.error('Unexpected error saving draft:', err);
      Toast.error('Failed to save draft: ' + (err.message || 'Unknown error'));
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  };

  /**
   * Validate days have required content
   */
  const validateDays = () => {
    if (!currentDraft || !currentDraft.days) return false;
    
    // Check each day has at least one stop
    return currentDraft.days.every(day => day.stops && day.stops.length > 0);
  };

  /**
   * Render preview - UPDATED FOR STEP 4
   */
  const renderPreview = () => {
    // Save current form values before rendering preview
    saveCurrentFormValues();
    
    const container = document.getElementById('itinerary-preview');
    if (!container || !currentDraft) return;
    
    const isDetailed = currentDraft.price_tier === 19;
    
    container.innerHTML = `
      <div class="preview">
        <h2>${currentDraft.title || 'Untitled Itinerary'}</h2>
        <p style="color: var(--text-light); margin-bottom: 24px;">
          📍 ${currentDraft.destination || 'Unknown'} • 
          ${currentDraft.duration_days || 0} days • 
          €${currentDraft.price_tier}
        </p>
        
        <p style="margin-bottom: 32px;">${currentDraft.description || 'No description provided'}</p>
        
        <h3>Day by Day Breakdown</h3>
        ${currentDraft.days.map(day => renderPreviewDay(day, isDetailed)).join('')}
        
        <div class="earnings-box">
          <h3>Expected Earnings</h3>
          <p style="margin: 8px 0 0;">
            €${currentDraft.price_tier} × 85% = <strong>€${(currentDraft.price_tier * 0.85).toFixed(2)}</strong> per sale
          </p>
        </div>
      </div>
    `;
  };

  /**
   * Render preview day
   */
  const renderPreviewDay = (day, isDetailed) => {
    return `
      <div class="preview-day">
        <h4>${day.title}</h4>
        ${day.description ? `<p style="color: var(--text-light);">${day.description}</p>` : ''}
        <p style="color: var(--text-light);">
          ${day.stops?.length || 0} stops
        </p>
        ${day.stops?.length > 0 ? `
          <ul style="margin-top: 12px;">
            ${day.stops.map(stop => `
              <li>
                <strong>${stop.name || 'Unnamed stop'}</strong>
                ${isDetailed && stop.time_period ? `(${stop.time_period})` : ''}
                ${isDetailed && stop.cost_cents ? ` • €${(stop.cost_cents / 100).toFixed(2)}` : ''}
                ${!isDetailed && stop.tip ? `<br><small style="color: var(--text-light);">${stop.tip}</small>` : ''}
                ${isDetailed && stop.description ? `<br><small style="color: var(--text-light);">${stop.description}</small>` : ''}
              </li>
            `).join('')}
          </ul>
        ` : '<p style="color: var(--text-light);">No stops added yet</p>'}
      </div>
    `;
  };

  /**
   * Publish itinerary
   */
  const publish = async () => {
    // Check all checkboxes
    const checkboxes = document.querySelectorAll('.publish-checklist input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    if (!allChecked) {
      Toast.error('Please complete all checklist items');
      return;
    }
    
    const button = event?.target || document.querySelector('[data-action="publish"]');
    if (button) {
      button.disabled = true;
      button.textContent = 'Publishing...';
    }
    
    const { data, error } = await API.drafts.publish(currentDraftId);
    
    if (!error && data) {
      Toast.success('🎉 Itinerary published successfully!');
      
      // Clear current draft
      currentDraftId = null;
      currentDraft = null;
      hasUnsavedChanges = false;
      
      // Navigate to dashboard or feed
      setTimeout(() => {
        Router.navigateTo('dashboard');
      }, 2000);
    } else {
      Toast.error('Failed to publish itinerary');
      if (button) {
        button.disabled = false;
        button.textContent = 'Publish Itinerary';
      }
    }
  };

  /**
   * Update draft info bar
   */
  const updateDraftInfoBar = () => {
    const bar = document.getElementById('draft-info-bar');
    const titleEl = document.getElementById('draft-title');
    const statusEl = document.getElementById('draft-status');
    
    if (!bar) return;
    
    if (currentDraft && currentDraftId) {
      // Only show the bar if we're in step 2, 3, or 4 (not during initial setup)
      if (currentStep > 1) {
        bar.style.display = 'flex';
        
        if (titleEl) {
          // Update with current title from draft or form
          const formTitle = document.getElementById('title');
          let displayTitle = currentDraft.title || formTitle?.value || '';
          
          // Don't show test/debug titles or empty titles
          if (!displayTitle || displayTitle.includes('test') || displayTitle.includes('te4st')) {
            displayTitle = 'Untitled Itinerary';
          }
          
          titleEl.textContent = displayTitle;
        }
        
        // Update save status
        if (statusEl) {
          if (hasUnsavedChanges) {
            statusEl.textContent = '• Unsaved changes';
            statusEl.className = 'draft-status unsaved';
            statusEl.style.display = 'inline-flex';
          } else if (currentDraft.last_saved_at) {
            statusEl.textContent = '✓ Saved';
            statusEl.className = 'draft-status saved';
            statusEl.style.display = 'inline-flex';
            
            // Hide the saved indicator after 2 seconds
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
    } else {
      bar.style.display = 'none';
    }
  };

  /**
   * Populate draft data into forms
   */
  const populateDraftData = () => {
    if (!currentDraft) return;
    
    // Populate step 1 if we're there
    if (currentStep === 1) {
      const form = document.getElementById('setup-form');
      if (form) {
        if (form.title) {
          form.title.value = currentDraft.title || '';
          // Add input listener for title changes
          form.title.addEventListener('input', (e) => {
            currentDraft.title = e.target.value;
            hasUnsavedChanges = true;
          });
        }
        if (form.destination) {
          form.destination.value = currentDraft.destination || '';
          form.destination.addEventListener('input', () => {
            hasUnsavedChanges = true;
          });
        }
        if (form.duration) {
          form.duration.value = currentDraft.duration_days || '';
          form.duration.addEventListener('input', () => {
            hasUnsavedChanges = true;
          });
        }
        if (form.description) {
          form.description.value = currentDraft.description || '';
          form.description.addEventListener('input', () => {
            hasUnsavedChanges = true;
          });
        }
        
        // Set price tier radio
        const priceRadio = form.querySelector(`input[name="product_type"][value="${currentDraft.price_tier}"]`);
        if (priceRadio) {
          priceRadio.checked = true;
          // Lock it if tier_locked is true
          if (currentDraft.tier_locked) {
            const allRadios = form.querySelectorAll('input[name="product_type"]');
            allRadios.forEach(radio => radio.disabled = true);
          }
        }
        
        // Update character counts
        const titleInput = form.title;
        if (titleInput) {
          const counter = titleInput.parentElement.querySelector('.char-count');
          if (counter) {
            counter.textContent = `${titleInput.value.length}/${titleInput.maxLength || 100}`;
          }
        }
        
        const descInput = form.description;
        if (descInput) {
          const counter = descInput.parentElement.querySelector('.char-count');
          if (counter) {
            counter.textContent = `${descInput.value.length}/${descInput.maxLength || 500}`;
          }
        }
      }
    }
  };

  /**
   * Format date helper
   */
  const formatDate = (dateString) => {
    if (!dateString) return 'never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  /**
   * Update day field (exposed for inline handlers)
   */
  const updateDayField = (dayIndex, field, value) => {
    if (!currentDraft) return;
    
    currentDraft.days[dayIndex][field] = value;
    hasUnsavedChanges = true;
    updateDraftInfoBar();
    
    if (field === 'title') {
      renderDaysList();
    }
  };

  /**
   * Test continue function for onclick
   */
  const testContinue = () => {
    console.log('Test continue called from CreatePage');
    handleSetupContinue();
  };

  // Public API
  return {
    init,
    updateDayField,
    testContinue
  };
})();

// Initialize
CreatePage.init();
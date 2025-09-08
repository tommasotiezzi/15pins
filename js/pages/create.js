/**
 * Create Page Controller
 * Handles itinerary creation flow with Supabase backend
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
    Events.on('action:save-draft', saveDraft);
    
    // Form submission
    Events.on('form:setup', handleSetupSubmit);
    
    // Navigation
    Events.on('action:back-to-setup', () => goToStep(1));
    Events.on('action:go-to-review', () => goToStep(3));
    Events.on('action:back-to-build', () => goToStep(2));
    
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
    currentDraft = draft;
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
    
    console.log('Creating draft with tier:', priceTier);
    
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
   * Render current step
   */
  const renderStep = (step) => {
    currentStep = step;
    
    // Update progress bar
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
      progressBar.style.width = `${(step / 3) * 100}%`;
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
      renderPreview();
    }
  };

  /**
   * Go to specific step
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
    
    renderStep(step);
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
   * Save draft - FIXED with proper data structure
   */
  const saveDraft = async () => {
    if (!currentDraftId || !currentDraft) {
      Toast.error('No draft to save');
      return;
    }
    
    // Save current form values before saving
    saveCurrentFormValues();
    
    const button = event?.target || document.querySelector('[data-action="save-draft"]');
    if (button) {
      button.disabled = true;
      button.textContent = 'Saving...';
    }
    
    // Prepare the data in the format the API expects
    const draftData = {
      title: currentDraft.title,
      destination: currentDraft.destination,
      duration_days: currentDraft.duration_days,
      description: currentDraft.description,
      cover_image_url: currentDraft.cover_image_url,
      current_step: currentStep,
      price_tier: currentDraft.price_tier,
      days: currentDraft.days.map(day => ({
        day_number: day.day_number,
        title: day.title,
        description: day.description,
        stops: (day.stops || []).map((stop, index) => ({
          ...stop,
          position: index + 1
        }))
      }))
    };
    
    console.log('Saving draft data:', draftData);
    
    const { error } = await API.drafts.saveComplete(currentDraftId, draftData);
    
    if (!error) {
      hasUnsavedChanges = false;
      Toast.success('Draft saved');
      
      // Update last saved time
      currentDraft.last_saved_at = new Date().toISOString();
      updateDraftInfoBar();
    } else {
      console.error('Save draft error:', error);
      Toast.error('Failed to save draft: ' + (error.message || 'Unknown error'));
    }
    
    if (button) {
      button.disabled = false;
      button.textContent = 'Save Draft';
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
   * Render preview
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
    
    if (!bar) return;
    
    if (currentDraft) {
      bar.style.display = 'flex';
      if (titleEl) {
        titleEl.textContent = currentDraft.title || 'Untitled Itinerary';
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
        form.title.value = currentDraft.title || '';
        form.destination.value = currentDraft.destination || '';
        form.duration.value = currentDraft.duration_days || '';
        form.description.value = currentDraft.description || '';
        
        // Set price tier radio
        const priceRadio = form.querySelector(`input[name="product_type"][value="${currentDraft.price_tier}"]`);
        if (priceRadio) {
          priceRadio.checked = true;
          priceRadio.disabled = true; // Lock it since it can't be changed
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
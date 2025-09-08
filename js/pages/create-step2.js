/**
 * Create Step 2 - Days Builder
 * Handles day-by-day itinerary building with stops
 */

const CreateStep2 = (() => {
  
  // ============= INITIALIZATION =============
  const init = () => {
    // Day management events
    Events.on('action:add-day', addDay);
    Events.on('action:select-day', selectDay);
    Events.on('action:duplicate-day', duplicateDay);
    
    // Stop management events
    Events.on('action:add-stop', addStop);
    Events.on('action:remove-stop', removeStop);
    Events.on('action:update-stop-field', updateStopField);
    
    // Navigation
    Events.on('action:go-to-review', handleGoToReview);
  };

  // ============= RENDER STEP =============
  const render = () => {
    const draft = CreateController.getCurrentDraft();
    if (!draft) return;
    
    showPriceTierNotice();
    renderDaysList();
    
    // Select first day if none selected
    const selectedId = CreateController.getSelectedDayId();
    if (selectedId === null && draft.days?.length > 0) {
      selectDay({ data: { dayId: 0 } });
    } else if (selectedId !== null) {
      renderDayEditor();
    }
  };

  // ============= SAVE STEP (Called by Controller) =============
  const saveStep = async () => {
    // Save current form values before saving
    saveCurrentFormValues();
    
    const draft = CreateController.getCurrentDraft();
    const draftId = CreateController.getCurrentDraftId();
    
    if (!draft || !draftId) {
      throw new Error('No draft to save');
    }
    
    // Prepare data for save
    const draftData = {
      title: draft.title,
      destination: draft.destination,
      duration_days: draft.duration_days,
      description: draft.description,
      cover_image_url: draft.cover_image_url || '',
      current_step: 2,
      price_tier: draft.price_tier,
      days: draft.days || []
    };
    
    const { error } = await API.drafts.saveComplete(draftId, draftData);
    if (error) throw error;
    
    return true;
  };

  // ============= NAVIGATION =============
  const handleGoToReview = async () => {
    if (!validateDays()) {
      Toast.error('Please add at least one stop to each day');
      return;
    }
    
    // Save current form values
    saveCurrentFormValues();
    
    // Transition to Step 3
    CreateController.handleStepTransition(2, 3);
  };

  // ============= PRICE TIER NOTICE =============
  const showPriceTierNotice = () => {
    const notice = document.getElementById('tier-notice');
    const draft = CreateController.getCurrentDraft();
    if (!notice || !draft) return;
    
    const isDetailed = draft.price_tier === 19;
    
    notice.className = isDetailed ? 'price-tier-notice detailed' : 'price-tier-notice';
    notice.innerHTML = isDetailed ? 
      `💎 <strong>Detailed Blueprint (€19)</strong> - Include times, costs, and organize by morning/afternoon/evening` :
      `✨ <strong>Basic Guide (€9)</strong> - Simple list of places with personal tips`;
  };

  // ============= DAYS LIST SIDEBAR =============
  const renderDaysList = () => {
    const container = document.getElementById('days-list');
    const draft = CreateController.getCurrentDraft();
    if (!container || !draft) return;
    
    const days = draft.days || [];
    const selectedId = CreateController.getSelectedDayId();
    
    container.innerHTML = days.map((day, index) => {
      const stopCount = day.stops?.length || 0;
      
      return `
        <div class="day-item ${selectedId === index ? 'active' : ''}" 
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

  // ============= SELECT DAY =============
  const selectDay = ({ data }) => {
    // Save current form values before switching
    const currentId = CreateController.getSelectedDayId();
    if (currentId !== null) {
      saveCurrentFormValues();
    }
    
    const dayId = parseInt(data.dayId);
    CreateController.setSelectedDayId(dayId);
    
    renderDaysList();
    renderDayEditor();
  };

  // ============= DAY EDITOR =============
  const renderDayEditor = () => {
    const container = document.getElementById('day-editor-content');
    const draft = CreateController.getCurrentDraft();
    const selectedId = CreateController.getSelectedDayId();
    
    if (!container || !draft || selectedId === null) return;
    
    const day = draft.days[selectedId];
    if (!day) return;
    
    const isDetailed = draft.price_tier === 19;
    
    container.innerHTML = `
      <div>
        <input type="text" 
               class="day-title-input" 
               value="${day.title || ''}" 
               placeholder="Day ${day.day_number}"
               data-field="title">
        
        <input type="text" 
               class="form-control" 
               style="margin-bottom: 24px;"
               value="${day.description || ''}" 
               placeholder="Brief description of this day (optional)"
               data-field="description">
        
        <div class="flex justify-between items-center mb-3">
          <h3>Stops for ${day.title}</h3>
          <button class="btn btn-sm btn-secondary" 
                  data-action="duplicate-day" 
                  data-day-id="${selectedId}">
            Duplicate Day
          </button>
        </div>
        
        <div id="stops-container">
          ${renderStops(day.stops || [], isDetailed)}
        </div>
        
        <button class="btn btn-primary" 
                data-action="add-stop" 
                data-day-id="${selectedId}">
          + Add Stop
        </button>
      </div>
    `;
    
    // Set up change handlers
    setupDayEditorHandlers();
  };

  // ============= RENDER STOPS =============
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

  // ============= RENDER INDIVIDUAL STOP =============
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
                     data-field="cost_cents"
                     step="0.01">
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

  // ============= SAVE CURRENT FORM VALUES =============
  const saveCurrentFormValues = () => {
    const draft = CreateController.getCurrentDraft();
    const selectedId = CreateController.getSelectedDayId();
    
    if (!draft || selectedId === null) return;
    
    const day = draft.days[selectedId];
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

  // ============= ADD DAY =============
  const addDay = () => {
    const draft = CreateController.getCurrentDraft();
    if (!draft) return;
    
    // Save current values first
    saveCurrentFormValues();
    
    const newDay = {
      day_number: draft.days.length + 1,
      title: `Day ${draft.days.length + 1}`,
      description: '',
      stops: []
    };
    
    draft.days.push(newDay);
    CreateController.markAsUnsaved();
    
    renderDaysList();
    selectDay({ data: { dayId: draft.days.length - 1 } });
  };

  // ============= DUPLICATE DAY =============
  const duplicateDay = ({ data }) => {
    const draft = CreateController.getCurrentDraft();
    if (!draft) return;
    
    // Save current values first
    saveCurrentFormValues();
    
    const dayToDuplicate = draft.days[data.dayId];
    if (!dayToDuplicate) return;
    
    const newDay = {
      ...dayToDuplicate,
      day_number: draft.days.length + 1,
      title: `${dayToDuplicate.title} (Copy)`,
      stops: dayToDuplicate.stops.map(stop => ({ ...stop }))
    };
    
    draft.days.push(newDay);
    CreateController.markAsUnsaved();
    
    renderDaysList();
    selectDay({ data: { dayId: draft.days.length - 1 } });
    
    Toast.success('Day duplicated');
  };

  // ============= ADD STOP =============
  const addStop = ({ data }) => {
    const draft = CreateController.getCurrentDraft();
    const selectedId = CreateController.getSelectedDayId();
    
    if (!draft || selectedId === null) return;
    
    // Save current values first
    saveCurrentFormValues();
    
    const day = draft.days[selectedId];
    if (!day.stops) {
      day.stops = [];
    }
    
    const newStop = {
      name: '',
      type: 'attraction',
      position: day.stops.length + 1
    };
    
    if (draft.price_tier === 19) {
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
    CreateController.markAsUnsaved();
    
    renderDaysList();
    renderDayEditor();
    
    // Scroll to new stop
    setTimeout(() => {
      const newStopEl = document.querySelector(`.stop-item:last-child`);
      if (newStopEl) {
        newStopEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  // ============= REMOVE STOP =============
  const removeStop = ({ data }) => {
    const draft = CreateController.getCurrentDraft();
    const selectedId = CreateController.getSelectedDayId();
    
    if (!draft || selectedId === null) return;
    
    // Save current values first
    saveCurrentFormValues();
    
    const day = draft.days[selectedId];
    day.stops.splice(data.stopIndex, 1);
    
    // Update positions
    day.stops.forEach((stop, index) => {
      stop.position = index + 1;
    });
    
    CreateController.markAsUnsaved();
    
    renderDaysList();
    renderDayEditor();
    
    Toast.show('Stop removed');
  };

  // ============= UPDATE STOP FIELD =============
  const updateStopField = ({ data, target }) => {
    const draft = CreateController.getCurrentDraft();
    const selectedId = CreateController.getSelectedDayId();
    
    if (!draft || selectedId === null) return;
    
    const day = draft.days[selectedId];
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
    CreateController.markAsUnsaved();
    
    // Update sidebar count if name changed
    if (data.field === 'name') {
      renderDaysList();
    }
  };

  // ============= SETUP HANDLERS =============
  const setupDayEditorHandlers = () => {
    const container = document.getElementById('day-editor-content');
    if (!container) return;
    
    // Day title/description handlers
    container.querySelectorAll('[data-field]').forEach(input => {
      input.addEventListener('change', (e) => {
        const draft = CreateController.getCurrentDraft();
        const selectedId = CreateController.getSelectedDayId();
        if (!draft || selectedId === null) return;
        
        const day = draft.days[selectedId];
        const field = e.target.dataset.field;
        
        if (field === 'title') {
          day.title = e.target.value;
          renderDaysList(); // Update sidebar
        } else if (field === 'description') {
          day.description = e.target.value;
        }
        
        CreateController.markAsUnsaved();
      });
    });
    
    // Stop field handlers
    container.querySelectorAll('[data-action="update-stop-field"]').forEach(input => {
      input.addEventListener('change', (e) => {
        Events.emit('action:update-stop-field', { 
          data: e.target.dataset, 
          target: e.target 
        });
      });
    });
    
    // Mark as unsaved on any input
    container.addEventListener('input', () => {
      CreateController.markAsUnsaved();
    });
  };

  // ============= VALIDATION =============
  const validateDays = () => {
    const draft = CreateController.getCurrentDraft();
    if (!draft || !draft.days) return false;
    
    // Check each day has at least one stop
    const emptyDays = draft.days.filter(day => !day.stops || day.stops.length === 0);
    
    if (emptyDays.length > 0) {
      const dayNumbers = emptyDays.map(d => d.day_number).join(', ');
      Toast.error(`Please add stops to Day(s): ${dayNumbers}`);
      return false;
    }
    
    // Check that stops have required fields
    for (const day of draft.days) {
      for (const stop of day.stops) {
        if (!stop.name?.trim()) {
          Toast.error(`All stops must have a name (${day.title})`);
          return false;
        }
        
        // For basic tier, check tips
        if (draft.price_tier === 9 && !stop.tip?.trim()) {
          Toast.error(`All stops must have insider tips (${day.title})`);
          return false;
        }
      }
    }
    
    return true;
  };

  // ============= PUBLIC API =============
  return {
    init,
    render,
    saveStep,
    validateDays,
    saveCurrentFormValues
  };
})();

// Auto-initialize with controller
// CreateStep2 will be initialized by CreateController
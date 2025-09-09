/**
 * Create Step 2 - Days Builder
 * Database is the single source of truth, UI state is local only
 */

const CreateStep2 = (() => {
  
  // ============= LOCAL UI STATE (EPHEMERAL) =============
  let selectedDayIndex = 0; // Which day is currently being edited (UI only)
  let currentDraft = null; // Cache of current draft data from DB
  
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

  // ============= RENDER STEP (ASYNC NOW) =============
  const render = async () => {
    const draftId = CreateController.getCurrentDraftId();
    if (!draftId) {
      Toast.error('No draft found');
      return;
    }
    
    // Fetch fresh data from database
    const { data: draft, error } = await API.drafts.get(draftId);
    if (error || !draft) {
      Toast.error('Failed to load draft');
      return;
    }
    
    currentDraft = draft;
    
    // Reset UI state when rendering fresh (no persistence of selection)
    selectedDayIndex = 0;
    
    showPriceTierNotice();
    renderDaysList();
    
    // Select first day if we have days
    if (draft.draft_days && draft.draft_days.length > 0) {
      renderDayEditor();
    } else {
      // No days yet - shouldn't happen after Step 1 but handle gracefully
      await initializeDays();
    }
  };

  // ============= INITIALIZE DAYS IF MISSING =============
  const initializeDays = async () => {
    if (!currentDraft) return;
    
    const draftId = CreateController.getCurrentDraftId();
    const days = [];
    
    for (let i = 1; i <= currentDraft.duration_days; i++) {
      days.push({
        day_number: i,
        title: `Day ${i}`,
        description: '',
        stops: []
      });
    }
    
    // Save to database
    const { error } = await API.drafts.saveComplete(draftId, {
      ...currentDraft,
      days: days
    });
    
    if (error) {
      Toast.error('Failed to initialize days');
      return;
    }
    
    // Reload draft with new days
    const { data: updatedDraft } = await API.drafts.get(draftId);
    currentDraft = updatedDraft;
    
    renderDaysList();
    renderDayEditor();
  };

  // ============= SAVE STEP (Called by Controller) =============
  const saveStep = async () => {
    const draftId = CreateController.getCurrentDraftId();
    if (!draftId || !currentDraft) {
      throw new Error('No draft to save');
    }
    
    // Transform draft_days/draft_stops back to the format saveComplete expects
    const days = currentDraft.draft_days.map(day => ({
      day_number: day.day_number,
      title: day.title,
      description: day.description,
      stops: (day.draft_stops || []).map(stop => ({
        name: stop.name,
        type: stop.type,
        tip: stop.tip,
        time_period: stop.time_period,
        start_time: stop.start_time,
        duration_minutes: stop.duration_minutes,
        cost_cents: stop.cost_cents,
        description: stop.description,
        link: stop.link,
        location: stop.location,
        lat: stop.lat,
        lng: stop.lng,
        place_id: stop.place_id,
        formatted_address: stop.formatted_address
      }))
    }));
    
    const draftData = {
      title: currentDraft.title,
      destination: currentDraft.destination,
      duration_days: currentDraft.duration_days,
      description: currentDraft.description,
      cover_image_url: currentDraft.cover_image_url || '',
      price_tier: currentDraft.price_tier,
      current_step: 2,
      days: days
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
    
    // Save before transitioning
    try {
      await saveStep();
      CreateController.renderStep(3);
    } catch (error) {
      Toast.error('Failed to save progress');
    }
  };

  // ============= PRICE TIER NOTICE =============
  const showPriceTierNotice = () => {
    const notice = document.getElementById('tier-notice');
    if (!notice || !currentDraft) return;
    
    const isDetailed = currentDraft.price_tier === 19;
    
    notice.className = isDetailed ? 'price-tier-notice detailed' : 'price-tier-notice';
    notice.innerHTML = isDetailed ? 
      `💎 <strong>Detailed Blueprint (€19)</strong> - Include times, costs, and organize by morning/afternoon/evening` :
      `✨ <strong>Basic Guide (€9)</strong> - Simple list of places with personal tips`;
  };

  // ============= DAYS LIST SIDEBAR =============
  const renderDaysList = () => {
    const container = document.getElementById('days-list');
    if (!container || !currentDraft) return;
    
    const days = currentDraft.draft_days || [];
    
    container.innerHTML = days.map((day, index) => {
      const stopCount = day.draft_stops?.length || 0;
      
      return `
        <div class="day-item ${selectedDayIndex === index ? 'active' : ''}" 
             data-action="select-day" 
             data-day-index="${index}">
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
    selectedDayIndex = parseInt(data.dayIndex);
    renderDaysList();
    renderDayEditor();
  };

  // ============= DAY EDITOR =============
  const renderDayEditor = () => {
    const container = document.getElementById('day-editor-content');
    if (!container || !currentDraft) return;
    
    const day = currentDraft.draft_days[selectedDayIndex];
    if (!day) return;
    
    const isDetailed = currentDraft.price_tier === 19;
    
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
                  data-day-index="${selectedDayIndex}">
            Duplicate Day
          </button>
        </div>
        
        <div id="stops-container">
          ${renderStops(day.draft_stops || [], isDetailed)}
        </div>
        
        <button class="btn btn-primary" 
                data-action="add-stop" 
                data-day-index="${selectedDayIndex}">
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

  // ============= ADD DAY =============
  const addDay = async () => {
    if (!currentDraft) return;
    
    const newDayNumber = currentDraft.draft_days.length + 1;
    const newDay = {
      day_number: newDayNumber,
      title: `Day ${newDayNumber}`,
      description: '',
      stops: []
    };
    
    // Add to local state
    currentDraft.draft_days.push({
      ...newDay,
      draft_stops: []
    });
    
    // Save to database
    await saveStep();
    
    // Refresh from database to get new IDs
    const draftId = CreateController.getCurrentDraftId();
    const { data: updatedDraft } = await API.drafts.get(draftId);
    currentDraft = updatedDraft;
    
    // Select the new day
    selectedDayIndex = currentDraft.draft_days.length - 1;
    
    renderDaysList();
    renderDayEditor();
  };

  // ============= DUPLICATE DAY =============
  const duplicateDay = async ({ data }) => {
    if (!currentDraft) return;
    
    const dayToDuplicate = currentDraft.draft_days[data.dayIndex];
    if (!dayToDuplicate) return;
    
    const newDayNumber = currentDraft.draft_days.length + 1;
    
    // Create new day with duplicated stops
    const newDay = {
      day_number: newDayNumber,
      title: `${dayToDuplicate.title} (Copy)`,
      description: dayToDuplicate.description,
      stops: (dayToDuplicate.draft_stops || []).map(stop => ({
        name: stop.name,
        type: stop.type,
        tip: stop.tip,
        time_period: stop.time_period,
        start_time: stop.start_time,
        duration_minutes: stop.duration_minutes,
        cost_cents: stop.cost_cents,
        description: stop.description,
        link: stop.link,
        location: stop.location,
        lat: stop.lat,
        lng: stop.lng,
        place_id: stop.place_id,
        formatted_address: stop.formatted_address
      }))
    };
    
    // Add to local state temporarily
    currentDraft.draft_days.push({
      ...newDay,
      draft_stops: newDay.stops
    });
    
    // Save to database
    await saveStep();
    
    // Refresh from database
    const draftId = CreateController.getCurrentDraftId();
    const { data: updatedDraft } = await API.drafts.get(draftId);
    currentDraft = updatedDraft;
    
    // Select the new day
    selectedDayIndex = currentDraft.draft_days.length - 1;
    
    renderDaysList();
    renderDayEditor();
    
    Toast.success('Day duplicated');
  };

  // ============= ADD STOP =============
  const addStop = async ({ data }) => {
    if (!currentDraft) return;
    
    const day = currentDraft.draft_days[selectedDayIndex];
    if (!day) return;
    
    if (!day.draft_stops) {
      day.draft_stops = [];
    }
    
    const newStop = {
      name: '',
      type: 'attraction',
      position: day.draft_stops.length + 1
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
    
    day.draft_stops.push(newStop);
    
    // Don't save immediately - just update UI
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
  const removeStop = async ({ data }) => {
    if (!currentDraft) return;
    
    const day = currentDraft.draft_days[selectedDayIndex];
    if (!day || !day.draft_stops) return;
    
    day.draft_stops.splice(data.stopIndex, 1);
    
    // Update positions
    day.draft_stops.forEach((stop, index) => {
      stop.position = index + 1;
    });
    
    CreateController.markAsUnsaved();
    
    renderDaysList();
    renderDayEditor();
    
    Toast.show('Stop removed');
  };

  // ============= UPDATE STOP FIELD =============
  const updateStopField = ({ data, target }) => {
    if (!currentDraft) return;
    
    const day = currentDraft.draft_days[selectedDayIndex];
    if (!day || !day.draft_stops) return;
    
    const stop = day.draft_stops[data.stopIndex];
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
      if (!input.dataset.action) { // Only for day-level fields
        input.addEventListener('change', (e) => {
          if (!currentDraft) return;
          
          const day = currentDraft.draft_days[selectedDayIndex];
          if (!day) return;
          
          const field = e.target.dataset.field;
          
          if (field === 'title') {
            day.title = e.target.value;
            renderDaysList(); // Update sidebar
          } else if (field === 'description') {
            day.description = e.target.value;
          }
          
          CreateController.markAsUnsaved();
        });
      }
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
    if (!currentDraft || !currentDraft.draft_days) return false;
    
    // Check each day has at least one stop
    const emptyDays = currentDraft.draft_days.filter(day => 
      !day.draft_stops || day.draft_stops.length === 0
    );
    
    if (emptyDays.length > 0) {
      const dayNumbers = emptyDays.map(d => d.day_number).join(', ');
      Toast.error(`Please add stops to Day(s): ${dayNumbers}`);
      return false;
    }
    
    // Check that stops have required fields
    for (const day of currentDraft.draft_days) {
      for (const stop of (day.draft_stops || [])) {
        if (!stop.name?.trim()) {
          Toast.error(`All stops must have a name (${day.title})`);
          return false;
        }
        
        // For basic tier, check tips
        if (currentDraft.price_tier === 9 && !stop.tip?.trim()) {
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
    validateDays
  };
})();

// Auto-initialize with controller
// CreateStep2 will be initialized by CreateController
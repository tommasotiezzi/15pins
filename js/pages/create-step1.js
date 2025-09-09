/**
 * Create Step 1 - Basic Setup with Google Places Integration
 * Database is the single source of truth - no local storage
 */

const CreateStep1 = (() => {
  let selectedPlace = null; // Store the selected place data
  let currentSuggestions = []; // Store current suggestions
  
  // ============= INITIALIZATION =============
  const init = () => {
    // Setup form events
    Events.on('action:continue-setup', handleContinue);
    Events.on('action:clear-destination', handleClearDestination);
    Events.on('form:setup', handleFormSubmit);
  };

  // ============= RENDER STEP =============
  const render = (draft = {}) => {
    populateForm(draft);
    updateCharacterCounts();
    setupDestinationAutocomplete();
    
    // Lock price tier if already set
    if (draft.tier_locked) {
      const radios = document.querySelectorAll('input[name="product_type"]');
      radios.forEach(radio => radio.disabled = true);
    }
  };

  // ============= SETUP DESTINATION AUTOCOMPLETE =============
  const setupDestinationAutocomplete = () => {
    const input = document.getElementById('destination');
    const suggestionsDiv = document.getElementById('destination-suggestions');
    
    if (!input || !suggestionsDiv) {
      console.warn('Destination input or suggestions div not found');
      return;
    }

    // Remove any existing listeners first
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    
    // Add event listener with proper error handling
    newInput.addEventListener('input', (e) => {
      try {
        handleDestinationInput(e);
      } catch (error) {
        console.error('Error in destination input handler:', error);
      }
    });
    
    newInput.addEventListener('focus', handleDestinationFocus);
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.destination-input-wrapper')) {
        const suggestions = document.getElementById('destination-suggestions');
        if (suggestions) suggestions.classList.remove('active');
      }
    });
    
    // Handle keyboard navigation
    newInput.addEventListener('keydown', handleDestinationKeydown);
  };

  // ============= HANDLE DESTINATION INPUT =============
  const handleDestinationInput = async (e) => {
    if (!e || !e.target) return;
    
    const value = e.target.value || '';
    const query = value.trim();
    const suggestionsDiv = document.getElementById('destination-suggestions');
    
    if (!suggestionsDiv) return;
    
    if (query.length < 3) {
      suggestionsDiv.classList.remove('active');
      suggestionsDiv.innerHTML = '';
      currentSuggestions = [];
      return;
    }
    
    // Show loading state
    suggestionsDiv.innerHTML = '<div class="autocomplete-loading">Searching...</div>';
    suggestionsDiv.classList.add('active');
    
    try {
      // Search for destinations (cities, regions, countries)
      const suggestions = await GooglePlacesService.searchPlaces(query, {
        types: ["locality", "administrative_area_level_1", "country", "sublocality"],
        maxSuggestions: 5
      });
      
      console.log('Received suggestions:', suggestions);
      currentSuggestions = suggestions || [];
      
      if (!suggestions || suggestions.length === 0) {
        suggestionsDiv.innerHTML = '<div class="autocomplete-no-results">No destinations found</div>';
      } else {
        renderSuggestions(suggestions);
      }
    } catch (error) {
      console.error('Places search error:', error);
      suggestionsDiv.innerHTML = '<div class="autocomplete-no-results">Search failed. Please try again.</div>';
      currentSuggestions = [];
    }
  };

  // ============= HANDLE DESTINATION FOCUS =============
  const handleDestinationFocus = () => {
    const suggestionsDiv = document.getElementById('destination-suggestions');
    if (currentSuggestions.length > 0) {
      suggestionsDiv.classList.add('active');
    }
  };

  // ============= HANDLE KEYBOARD NAVIGATION =============
  const handleDestinationKeydown = (e) => {
    const suggestionsDiv = document.getElementById('destination-suggestions');
    const suggestions = suggestionsDiv.querySelectorAll('.autocomplete-suggestion');
    const selected = suggestionsDiv.querySelector('.autocomplete-suggestion.selected');
    
    if (!suggestionsDiv.classList.contains('active')) return;
    
    let index = -1;
    if (selected) {
      index = Array.from(suggestions).indexOf(selected);
    }
    
    switch(e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (index < suggestions.length - 1) {
          if (selected) selected.classList.remove('selected');
          suggestions[index + 1].classList.add('selected');
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (index > 0) {
          if (selected) selected.classList.remove('selected');
          suggestions[index - 1].classList.add('selected');
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (selected) {
          const placeId = selected.dataset.placeId;
          const suggestion = currentSuggestions.find(s => s.placeId === placeId);
          if (suggestion) {
            selectPlace(suggestion);
          }
        }
        break;
      case 'Escape':
        suggestionsDiv.classList.remove('active');
        break;
    }
  };

  // ============= RENDER SUGGESTIONS =============
  const renderSuggestions = (suggestions) => {
    const suggestionsDiv = document.getElementById('destination-suggestions');
    
    if (!suggestionsDiv) {
      console.error('Suggestions div not found');
      return;
    }
    
    console.log('Rendering suggestions:', suggestions);
    
    suggestionsDiv.innerHTML = suggestions.map(suggestion => `
      <div class="autocomplete-suggestion" data-place-id="${suggestion.placeId}">
        <svg class="suggestion-icon" width="20" height="20" fill="none">
          <path d="M10 2C6 2 3 5 3 9C3 13 10 20 10 20C10 20 17 13 17 9C17 5 14 2 10 2Z" 
                stroke="currentColor" stroke-width="1.5"/>
        </svg>
        <div class="suggestion-text">
          <div class="suggestion-main">${suggestion.mainText}</div>
          ${suggestion.secondaryText ? 
            `<div class="suggestion-secondary">${suggestion.secondaryText}</div>` : ''}
        </div>
      </div>
    `).join('');
    
    // Make sure the dropdown is visible
    suggestionsDiv.classList.add('active');
    console.log('Suggestions div active class added');
    
    // Add click handlers
    suggestionsDiv.querySelectorAll('.autocomplete-suggestion').forEach(el => {
      el.addEventListener('click', () => {
        const placeId = el.dataset.placeId;
        const suggestion = suggestions.find(s => s.placeId === placeId);
        if (suggestion) {
          selectPlace(suggestion);
        }
      });
      
      el.addEventListener('mouseenter', () => {
        suggestionsDiv.querySelectorAll('.selected').forEach(s => s.classList.remove('selected'));
        el.classList.add('selected');
      });
    });
  };

  // ============= SELECT PLACE =============
  const selectPlace = async (suggestion) => {
    const input = document.getElementById('destination');
    const suggestionsDiv = document.getElementById('destination-suggestions');
    const selectedDiv = document.getElementById('selected-destination');
    const displaySpan = document.getElementById('destination-display');
    
    // Hide suggestions
    suggestionsDiv.classList.remove('active');
    
    // Show loading state
    input.disabled = true;
    
    try {
      // Get full place details
      const placeDetails = await GooglePlacesService.getPlaceDetails(suggestion.placeId);
      
      if (placeDetails) {
        selectedPlace = placeDetails;
        
        // Update display
        input.value = placeDetails.displayName || suggestion.description;
        
        // Show selected destination badge
        const flagEmoji = getFlagEmoji(placeDetails.countryCode);
        displaySpan.textContent = `${flagEmoji} ${placeDetails.city || placeDetails.displayName}, ${placeDetails.country}`;
        selectedDiv.style.display = 'block';
        
        // Populate hidden fields
        document.getElementById('place_id').value = placeDetails.placeId || '';
        document.getElementById('country').value = placeDetails.country || '';
        document.getElementById('country_code').value = placeDetails.countryCode || '';
        document.getElementById('region').value = placeDetails.region || '';
        // Use the main location name as city if no specific city is found
        document.getElementById('city').value = placeDetails.city || placeDetails.displayName || placeDetails.region || '';
        document.getElementById('lat').value = placeDetails.lat || '';
        document.getElementById('lng').value = placeDetails.lng || '';
        
        // Mark as unsaved
        CreateController.markAsUnsaved();
      }
    } catch (error) {
      console.error('Failed to get place details:', error);
      Toast.error('Failed to get destination details');
    } finally {
      input.disabled = false;
    }
  };

  // ============= CLEAR DESTINATION =============
  const handleClearDestination = () => {
    selectedPlace = null;
    
    // Clear visible elements
    document.getElementById('destination').value = '';
    document.getElementById('selected-destination').style.display = 'none';
    
    // Clear hidden fields
    document.getElementById('place_id').value = '';
    document.getElementById('country').value = '';
    document.getElementById('country_code').value = '';
    document.getElementById('region').value = '';
    document.getElementById('city').value = '';
    document.getElementById('lat').value = '';
    document.getElementById('lng').value = '';
    
    // Focus back on input
    document.getElementById('destination').focus();
    
    // Mark as unsaved
    CreateController.markAsUnsaved();
  };

  // ============= GET FLAG EMOJI =============
  const getFlagEmoji = (countryCode) => {
    if (!countryCode || countryCode.length !== 2) return '';
    
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt());
    
    return String.fromCodePoint(...codePoints);
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
    
    // Validate that a place was selected
    if (!selectedPlace && !document.getElementById('place_id').value) {
      Toast.error('Please select a destination from the dropdown');
      document.getElementById('destination').focus();
      return;
    }
    
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // Get current draft ID
    let draftId = CreateController.getCurrentDraftId();
    
    if (!draftId) {
      // Create new draft
      CreateController.showLoadingOverlay('Creating draft...');
      
      try {
        const { data: newDraft, error } = await API.drafts.create(parseInt(data.product_type));
        if (error) throw error;
        
        draftId = newDraft.id;
        CreateController.setDraftId(draftId);
        
      } catch (error) {
        CreateController.hideLoadingOverlay();
        Toast.error('Failed to create draft');
        console.error('Draft creation error:', error);
        return;
      }
    }
    
    // Save and continue
    try {
      CreateController.showLoadingOverlay('Saving setup...');
      
      const draftData = {
        title: data.title,
        destination: data.destination,
        duration_days: parseInt(data.duration),
        description: data.description,
        price_tier: parseInt(data.product_type),
        // Add location fields
        place_id: data.place_id,
        country: data.country,
        country_code: data.country_code,
        region: data.region,
        city: data.city,
        lat: data.lat ? parseFloat(data.lat) : null,
        lng: data.lng ? parseFloat(data.lng) : null,
        current_step: 2,
        days: createDefaultDays(parseInt(data.duration))
      };
      
      const { error } = await API.drafts.saveComplete(draftId, draftData);
      if (error) throw error;
      
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
    
    // Validate that a place was selected
    if (!selectedPlace && !document.getElementById('place_id').value) {
      throw new Error('Please select a destination from the dropdown');
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
      // Add location fields
      place_id: data.place_id,
      country: data.country,
      country_code: data.country_code,
      region: data.region,
      city: data.city,
      lat: data.lat ? parseFloat(data.lat) : null,
      lng: data.lng ? parseFloat(data.lng) : null,
      current_step: CreateController.getCurrentStep()
    };
    
    const { error } = await API.drafts.update(draftId, draftData);
    if (error) throw error;
    
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
    
    // Populate location fields if they exist
    if (draft.place_id) {
      document.getElementById('place_id').value = draft.place_id;
      document.getElementById('country').value = draft.country || '';
      document.getElementById('country_code').value = draft.country_code || '';
      document.getElementById('region').value = draft.region || '';
      document.getElementById('city').value = draft.city || '';
      document.getElementById('lat').value = draft.lat || '';
      document.getElementById('lng').value = draft.lng || '';
      
      // Show selected destination badge
      if (draft.city || draft.country) {
        const selectedDiv = document.getElementById('selected-destination');
        const displaySpan = document.getElementById('destination-display');
        const flagEmoji = getFlagEmoji(draft.country_code);
        displaySpan.textContent = `${flagEmoji} ${draft.city || draft.destination}, ${draft.country}`;
        selectedDiv.style.display = 'block';
        
        // Store as selected place
        selectedPlace = {
          placeId: draft.place_id,
          country: draft.country,
          countryCode: draft.country_code,
          region: draft.region,
          city: draft.city,
          lat: draft.lat,
          lng: draft.lng
        };
      }
    }
    
    // Add change listeners
    form.addEventListener('input', (e) => {
      CreateController.markAsUnsaved();
      updateCharacterCounts();
      
      // Update draft title in real-time for the info bar
      if (e.target.id === 'title') {
        const titleSpan = document.getElementById('draft-title');
        if (titleSpan) {
          titleSpan.textContent = e.target.value || 'Untitled Itinerary';
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
    
    // Check that a place was selected
    if (!selectedPlace && !document.getElementById('place_id').value) {
      Toast.error('Please select a destination from the dropdown');
      document.getElementById('destination').focus();
      return false;
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
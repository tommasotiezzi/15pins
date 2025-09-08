/**
 * Create Step 4 - Review & Publish
 * Final review and publishing of the itinerary
 */

const CreateStep4 = (() => {
  
  // ============= INITIALIZATION =============
  const init = () => {
    // Publishing events
    Events.on('action:publish', handlePublish);
    Events.on('action:preview-full', handlePreviewFull);
    Events.on('action:save-as-draft', handleSaveAsDraft);
    
    // Navigation
    Events.on('action:back-to-edit', () => CreateController.handleStepTransition(4, 2));
  };

  // ============= RENDER STEP =============
  const render = () => {
    const draft = CreateController.getCurrentDraft();
    if (!draft) return;
    
    renderPreview();
    renderPublishChecklist();
    updatePublishButton();
  };

  // ============= SAVE STEP (Called by Controller) =============
  const saveStep = async () => {
    // Step 4 is review-only, nothing to save
    // Just ensure the draft is marked as being on step 4
    const draftId = CreateController.getCurrentDraftId();
    if (draftId) {
      await API.drafts.update(draftId, { current_step: 4 });
    }
    return true;
  };

  // ============= RENDER PREVIEW =============
  const renderPreview = () => {
    const container = document.getElementById('itinerary-preview');
    const draft = CreateController.getCurrentDraft();
    
    if (!container || !draft) return;
    
    const isDetailed = draft.price_tier === 19;
    const stats = calculateStats(draft);
    
    container.innerHTML = `
      <div class="preview">
        <!-- Header Section -->
        <div class="preview-header">
          <h2>${draft.title || 'Untitled Itinerary'}</h2>
          <p class="preview-meta">
            📍 ${draft.destination || 'Unknown'} • 
            📅 ${draft.duration_days || 0} days • 
            💰 €${draft.price_tier}
          </p>
          
          ${draft.description ? `
            <p class="preview-description">${draft.description}</p>
          ` : ''}
        </div>

        <!-- Quick Stats -->
        <div class="preview-stats">
          <div class="stat-box">
            <span class="stat-value">${stats.totalStops}</span>
            <span class="stat-label">Total Stops</span>
          </div>
          <div class="stat-box">
            <span class="stat-value">${stats.avgStopsPerDay}</span>
            <span class="stat-label">Stops/Day</span>
          </div>
          ${isDetailed ? `
            <div class="stat-box">
              <span class="stat-value">€${stats.estimatedCost}</span>
              <span class="stat-label">Est. Cost</span>
            </div>
          ` : ''}
          <div class="stat-box">
            <span class="stat-value">${stats.completionScore}%</span>
            <span class="stat-label">Complete</span>
          </div>
        </div>

        <!-- Characteristics Display -->
        ${renderCharacteristicsPreview(draft.characteristics)}

        <!-- Day by Day Breakdown -->
        <div class="preview-days">
          <h3>Day by Day Itinerary</h3>
          ${draft.days.map(day => renderPreviewDay(day, isDetailed)).join('')}
        </div>

        <!-- Travel Essentials -->
        ${renderEssentialsPreview(draft)}

        <!-- Earnings Box -->
        <div class="earnings-box">
          <h3>💰 Expected Earnings</h3>
          <p>
            €${draft.price_tier} × 85% commission = 
            <strong>€${(draft.price_tier * 0.85).toFixed(2)}</strong> per sale
          </p>
          <p class="earnings-note">
            Average creator earns €${draft.price_tier === 19 ? '380' : '180'}/month 
            with ${draft.price_tier === 19 ? '20' : '20'} sales
          </p>
        </div>

        <!-- Preview Button -->
        <div class="preview-actions">
          <button class="btn btn-secondary" data-action="preview-full">
            <svg width="16" height="16" fill="none">
              <path d="M1 8C1 8 3.5 2 8 2C12.5 2 15 8 15 8C15 8 12.5 14 8 14C3.5 14 1 8 1 8Z" 
                    stroke="currentColor" stroke-width="1.5"/>
              <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            Preview as Buyer
          </button>
        </div>
      </div>
    `;
  };

  // ============= RENDER CHARACTERISTICS PREVIEW =============
  const renderCharacteristicsPreview = (characteristics) => {
    if (!characteristics) return '';
    
    const labels = {
      physical_demand: ['Very Easy', 'Easy', 'Moderate', 'Active', 'Challenging'],
      cultural_immersion: ['Tourist Path', 'Some Local', 'Balanced', 'Mostly Local', 'Full Immersion'],
      pace: ['Very Relaxed', 'Relaxed', 'Moderate', 'Fast', 'Packed'],
      budget_level: ['Backpacker', 'Budget', 'Mid-Range', 'Upscale', 'Luxury'],
      social_style: ['Solo', 'Couples', 'Friends', 'Families', 'Groups']
    };
    
    return `
      <div class="preview-characteristics">
        <h3>Trip Characteristics</h3>
        <div class="characteristics-summary">
          ${characteristics.physical_demand ? `
            <span class="char-badge">
              💪 ${labels.physical_demand[characteristics.physical_demand - 1]}
            </span>
          ` : ''}
          ${characteristics.pace ? `
            <span class="char-badge">
              ⚡ ${labels.pace[characteristics.pace - 1]}
            </span>
          ` : ''}
          ${characteristics.budget_level ? `
            <span class="char-badge">
              💰 ${labels.budget_level[characteristics.budget_level - 1]}
            </span>
          ` : ''}
          ${characteristics.cultural_immersion ? `
            <span class="char-badge">
              🌍 ${labels.cultural_immersion[characteristics.cultural_immersion - 1]}
            </span>
          ` : ''}
          ${characteristics.social_style ? `
            <span class="char-badge">
              👥 Best for ${labels.social_style[characteristics.social_style - 1]}
            </span>
          ` : ''}
        </div>
      </div>
    `;
  };

  // ============= RENDER DAY PREVIEW =============
  const renderPreviewDay = (day, isDetailed) => {
    const hasStops = day.stops && day.stops.length > 0;
    
    return `
      <div class="preview-day">
        <div class="day-header">
          <h4>${day.title}</h4>
          <span class="stop-count">${day.stops?.length || 0} stops</span>
        </div>
        
        ${day.description ? `
          <p class="day-description">${day.description}</p>
        ` : ''}
        
        ${hasStops ? `
          <ul class="stops-list">
            ${day.stops.map(stop => renderPreviewStop(stop, isDetailed)).join('')}
          </ul>
        ` : `
          <p class="no-stops-message">No stops added yet</p>
        `}
      </div>
    `;
  };

  // ============= RENDER STOP PREVIEW =============
  const renderPreviewStop = (stop, isDetailed) => {
    const typeIcons = {
      attraction: '🏛️',
      food: '🍜',
      accommodation: '🏨',
      transport: '🚌',
      beach: '🏖️',
      nightlife: '🌃',
      shopping: '🛍️',
      activity: '🎯'
    };
    
    return `
      <li class="preview-stop">
        <div class="stop-main">
          <span class="stop-icon">${typeIcons[stop.type] || '📍'}</span>
          <strong>${stop.name || 'Unnamed stop'}</strong>
          ${isDetailed && stop.time_period ? 
            `<span class="stop-time">${stop.time_period}</span>` : ''}
          ${isDetailed && stop.cost_cents ? 
            `<span class="stop-cost">€${(stop.cost_cents / 100).toFixed(2)}</span>` : ''}
        </div>
        ${!isDetailed && stop.tip ? `
          <div class="stop-tip">${stop.tip}</div>
        ` : ''}
        ${isDetailed && stop.description ? `
          <div class="stop-description">${stop.description}</div>
        ` : ''}
      </li>
    `;
  };

  // ============= RENDER ESSENTIALS PREVIEW =============
  const renderEssentialsPreview = (draft) => {
    const hasEssentials = draft.transportation || draft.accommodation || draft.travel_tips;
    if (!hasEssentials) return '';
    
    let essentialsHtml = '<div class="preview-essentials"><h3>Travel Essentials</h3>';
    
    // Transportation
    if (draft.transportation) {
      const t = draft.transportation;
      if (t.getting_there || t.getting_around || t.local_transport_tips) {
        essentialsHtml += '<div class="essential-section"><h4>🚕 Transportation</h4>';
        if (t.getting_there) {
          essentialsHtml += `<p><strong>Getting There:</strong> ${t.getting_there}</p>`;
        }
        if (t.getting_around) {
          essentialsHtml += `<p><strong>Getting Around:</strong> ${t.getting_around}</p>`;
        }
        if (t.local_transport_tips) {
          essentialsHtml += `<p><strong>Tips:</strong> ${t.local_transport_tips}</p>`;
        }
        essentialsHtml += '</div>';
      }
    }
    
    // Accommodation
    if (draft.accommodation) {
      const a = draft.accommodation;
      if (a.area_recommendations || a.booking_tips) {
        essentialsHtml += '<div class="essential-section"><h4>🏨 Accommodation</h4>';
        if (a.area_recommendations) {
          essentialsHtml += `<p><strong>Best Areas:</strong> ${a.area_recommendations}</p>`;
        }
        if (a.booking_tips) {
          essentialsHtml += `<p><strong>Booking Tips:</strong> ${a.booking_tips}</p>`;
        }
        essentialsHtml += '</div>';
      }
    }
    
    // Travel Tips
    if (draft.travel_tips) {
      const tips = draft.travel_tips;
      const hasTips = Object.values(tips).some(v => v && v.trim());
      if (hasTips) {
        essentialsHtml += '<div class="essential-section"><h4>💡 Travel Tips</h4>';
        if (tips.best_time_to_visit) {
          essentialsHtml += `<p><strong>Best Time:</strong> ${tips.best_time_to_visit}</p>`;
        }
        if (tips.visa_requirements) {
          essentialsHtml += `<p><strong>Visa:</strong> ${tips.visa_requirements}</p>`;
        }
        if (tips.packing_suggestions) {
          essentialsHtml += `<p><strong>Packing:</strong> ${tips.packing_suggestions}</p>`;
        }
        if (tips.budget_breakdown) {
          essentialsHtml += `<p><strong>Budget:</strong> ${tips.budget_breakdown}</p>`;
        }
        if (tips.other_tips) {
          essentialsHtml += `<p><strong>Other Tips:</strong> ${tips.other_tips}</p>`;
        }
        essentialsHtml += '</div>';
      }
    }
    
    essentialsHtml += '</div>';
    return essentialsHtml;
  };

  // ============= RENDER PUBLISH CHECKLIST =============
  const renderPublishChecklist = () => {
    const container = document.querySelector('.publish-checklist');
    if (!container) return;
    
    const draft = CreateController.getCurrentDraft();
    const checks = getChecklistStatus(draft);
    
    container.innerHTML = `
      <h3>🚀 Publishing Checklist</h3>
      <p>Ensure your itinerary meets our quality standards:</p>
      
      <label class="checkbox">
        <input type="checkbox" id="check-1" ${checks.hasEnoughStops ? 'checked' : ''}>
        <span>Each day has at least 3-5 stops ${checks.hasEnoughStops ? '✓' : ''}</span>
      </label>
      
      <label class="checkbox">
        <input type="checkbox" id="check-2" ${checks.hasTips ? 'checked' : ''}>
        <span>Every stop includes a personal tip ${checks.hasTips ? '✓' : ''}</span>
      </label>
      
      <label class="checkbox">
        <input type="checkbox" id="check-3" ${checks.hasTransport ? 'checked' : ''}>
        <span>Transportation between areas is explained ${checks.hasTransport ? '✓' : ''}</span>
      </label>
      
      <label class="checkbox">
        <input type="checkbox" id="check-4" ${checks.hasAccommodation ? 'checked' : ''}>
        <span>Accommodation areas are recommended ${checks.hasAccommodation ? '✓' : ''}</span>
      </label>
      
      <label class="checkbox">
        <input type="checkbox" id="check-5" ${checks.hasCharacteristics ? 'checked' : ''}>
        <span>Trip characteristics are defined ${checks.hasCharacteristics ? '✓' : ''}</span>
      </label>
      
      ${!checks.isReady ? `
        <div class="checklist-warning">
          ⚠️ Please complete all checklist items before publishing
        </div>
      ` : `
        <div class="checklist-success">
          ✅ Your itinerary is ready to publish!
        </div>
      `}
    `;
    
    // Add change handlers to checkboxes
    container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', updatePublishButton);
    });
  };

  // ============= GET CHECKLIST STATUS =============
  const getChecklistStatus = (draft) => {
    const hasEnoughStops = draft.days.every(day => 
      day.stops && day.stops.length >= 3
    );
    
    const hasTips = draft.days.every(day => 
      day.stops?.every(stop => 
        (draft.price_tier === 9 && stop.tip?.trim()) || 
        (draft.price_tier === 19 && stop.description?.trim())
      )
    );
    
    const hasTransport = !!(
      draft.transportation?.getting_there?.trim() || 
      draft.transportation?.getting_around?.trim()
    );
    
    const hasAccommodation = !!(
      draft.accommodation?.area_recommendations?.trim() || 
      draft.destination?.includes('day trip')
    );
    
    const hasCharacteristics = !!(
      draft.characteristics?.physical_demand &&
      draft.characteristics?.pace &&
      draft.characteristics?.budget_level
    );
    
    const isReady = hasEnoughStops && hasTips && hasTransport && 
                    hasAccommodation && hasCharacteristics;
    
    return {
      hasEnoughStops,
      hasTips,
      hasTransport,
      hasAccommodation,
      hasCharacteristics,
      isReady
    };
  };

  // ============= UPDATE PUBLISH BUTTON =============
  const updatePublishButton = () => {
    const publishBtn = document.querySelector('[data-action="publish"]');
    if (!publishBtn) return;
    
    const checkboxes = document.querySelectorAll('.publish-checklist input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    publishBtn.disabled = !allChecked;
    
    if (allChecked) {
      publishBtn.innerHTML = `
        <span>🎉 Publish Itinerary</span>
      `;
      publishBtn.classList.add('ready');
    } else {
      publishBtn.innerHTML = `
        <span>Complete Checklist to Publish</span>
      `;
      publishBtn.classList.remove('ready');
    }
  };

  // ============= CALCULATE STATS =============
  const calculateStats = (draft) => {
    let totalStops = 0;
    let totalCost = 0;
    
    draft.days.forEach(day => {
      if (day.stops) {
        totalStops += day.stops.length;
        day.stops.forEach(stop => {
          if (stop.cost_cents) {
            totalCost += stop.cost_cents;
          }
        });
      }
    });
    
    const avgStopsPerDay = draft.duration_days ? 
      (totalStops / draft.duration_days).toFixed(1) : 0;
    
    const estimatedCost = (totalCost / 100).toFixed(0);
    
    // Calculate completion score
    const checks = getChecklistStatus(draft);
    const completionItems = [
      draft.title?.trim(),
      draft.description?.trim(),
      totalStops >= draft.duration_days * 3,
      checks.hasCharacteristics,
      checks.hasTransport || checks.hasAccommodation
    ];
    const completionScore = Math.round(
      (completionItems.filter(Boolean).length / completionItems.length) * 100
    );
    
    return {
      totalStops,
      avgStopsPerDay,
      estimatedCost,
      completionScore
    };
  };

  // ============= HANDLE PUBLISH =============
  const handlePublish = async () => {
    // Check all checkboxes
    const checkboxes = document.querySelectorAll('.publish-checklist input[type="checkbox"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    if (!allChecked) {
      Toast.error('Please complete all checklist items before publishing');
      return;
    }
    
    // Confirm publication
    const confirmed = await new Promise(resolve => {
      Modal.confirm({
        title: '🚀 Ready to Publish?',
        message: `Your ${CreateController.getCurrentDraft().duration_days}-day ${CreateController.getCurrentDraft().destination} itinerary will go live immediately and be available for purchase at €${CreateController.getCurrentDraft().price_tier}.`,
        confirmText: 'Publish Now',
        cancelText: 'Review Again',
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      });
    });
    
    if (!confirmed) return;
    
    const button = document.querySelector('[data-action="publish"]');
    if (button) {
      button.disabled = true;
      button.innerHTML = '<span>Publishing...</span>';
    }
    
    try {
      CreateController.showLoadingOverlay('Publishing your itinerary...');
      
      const draftId = CreateController.getCurrentDraftId();
      const { data, error } = await API.drafts.publish(draftId);
      
      if (error) throw error;
      
      CreateController.hideLoadingOverlay();
      
      // Show success modal
      Modal.alert({
        title: '🎉 Published Successfully!',
        message: `Your itinerary is now live! You'll earn €${(CreateController.getCurrentDraft().price_tier * 0.85).toFixed(2)} for each sale.`,
        type: 'success',
        buttonText: 'View My Itineraries'
      });
      
      // Clear draft state
      CreateController.setDraftId(null);
      CreateController.setDraft(null);
      
      // Navigate to dashboard after a delay
      setTimeout(() => {
        Router.navigateTo('dashboard');
      }, 2000);
      
    } catch (error) {
      CreateController.hideLoadingOverlay();
      console.error('Publish error:', error);
      Toast.error('Failed to publish. Please try again.');
      
      if (button) {
        button.disabled = false;
        button.innerHTML = '<span>Publish Itinerary</span>';
      }
    }
  };

  // ============= HANDLE SAVE AS DRAFT =============
  const handleSaveAsDraft = async () => {
    try {
      await CreateController.handleManualSave();
      Toast.success('Draft saved successfully');
    } catch (error) {
      Toast.error('Failed to save draft');
    }
  };

  // ============= HANDLE FULL PREVIEW =============
  const handlePreviewFull = () => {
    const draft = CreateController.getCurrentDraft();
    if (!draft) return;
    
    // Open trip modal in preview mode
    Events.emit('trip-modal:open', { 
      itinerary: draft, 
      context: 'preview' 
    });
  };

  // ============= VALIDATION =============
  const validateStep = () => {
    // Step 4 doesn't need validation as it's just review
    // Publishing has its own validation via checklist
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
// CreateStep4 will be initialized by CreateController
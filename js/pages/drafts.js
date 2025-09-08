/**
 * Drafts Page Controller
 * Handles draft management and selection
 */

const DraftsPage = (() => {
  let currentUserId = null;

  /**
   * Initialize drafts page
   */
  const init = () => {
    console.log('DraftsPage initialized');
    
    // Listen for events
    Events.on('page:drafts:show', show);
    Events.on('action:start-new-itinerary', startNewItinerary);
    Events.on('action:continue-draft', continueDraft);
    Events.on('action:delete-draft', deleteDraft);
  };

  /**
   * Show drafts page
   */
  const show = async () => {
    const user = State.get('currentUser');
    if (!user) {
      Toast.error('Please sign in to create itineraries');
      Router.navigateTo('feed');
      return;
    }

    currentUserId = user.id;
    
    // Show the draft selector
    const selector = document.getElementById('draft-selector');
    const flow = document.getElementById('creation-flow');
    
    if (selector) selector.style.display = 'block';
    if (flow) flow.style.display = 'none';
    
    // Load and render drafts
    await loadDrafts();
  };

  /**
   * Hide drafts page
   */
  const hide = () => {
    const selector = document.getElementById('draft-selector');
    if (selector) selector.style.display = 'none';
  };

  /**
   * Load user's drafts from backend
   */
  const loadDrafts = async () => {
    if (!currentUserId) return;

    try {
      const { data: drafts, error } = await API.drafts.list(currentUserId);
      
      if (!error && drafts) {
        State.set('drafts.list', drafts);
        renderDraftsList(drafts);
      } else {
        console.error('Failed to load drafts:', error);
        renderDraftsList([]);
      }
    } catch (err) {
      console.error('Error loading drafts:', err);
      renderDraftsList([]);
    }
  };

  /**
   * Render drafts list
   */
  const renderDraftsList = (drafts) => {
    const container = document.getElementById('drafts-list');
    if (!container) return;
    
    if (!drafts || drafts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" fill="none" opacity="0.3">
            <path d="M12 2L2 7V12C2 16.5 4.5 20.7 12 22C19.5 20.7 22 16.5 22 12V7L12 2Z" stroke="currentColor" stroke-width="2"/>
          </svg>
          <h3>No drafts yet</h3>
          <p>Start creating your first itinerary and share your travel expertise!</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = drafts.map(draft => `
      <div class="draft-card" data-draft-id="${draft.id}">
        <div class="draft-image">
          ${draft.cover_image_url ? 
            `<img src="${draft.cover_image_url}" alt="${draft.title || 'Draft'}">` :
            `<div class="draft-placeholder">
              <svg width="40" height="40" fill="none" opacity="0.2">
                <path d="M20 10C15 10 11 14 11 19C11 24 20 34 20 34C20 34 29 24 29 19C29 14 25 10 20 10Z" stroke="currentColor" stroke-width="2"/>
                <circle cx="20" cy="19" r="3" stroke="currentColor" stroke-width="2"/>
              </svg>
            </div>`
          }
        </div>
        <div class="draft-info">
          <h3>${draft.title || 'Untitled Itinerary'}</h3>
          <p class="draft-meta">
            <span>📍 ${draft.destination || 'No destination'}</span>
            <span>📅 ${draft.duration_days || 0} days</span>
            <span>💰 €${draft.price_tier}</span>
          </p>
          <p class="draft-updated">Last saved ${formatDate(draft.last_saved_at || draft.updated_at)}</p>
        </div>
        <div class="draft-actions">
          <button class="btn btn-primary" data-action="continue-draft" data-draft-id="${draft.id}">
            Continue Editing
          </button>
          <button class="btn btn-ghost" data-action="delete-draft" data-draft-id="${draft.id}">
            <svg width="20" height="20" fill="none">
              <path d="M3 5h14M8 5V3h4v2M6 5v12h8V5M9 9v5M11 9v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    `).join('');
  };

  /**
   * Start new itinerary
   */
  const startNewItinerary = () => {
    hide();
    Events.emit('create:new');
  };

  /**
   * Continue existing draft
   */
  const continueDraft = async ({ data }) => {
    const draftId = data.draftId;
    
    // Hide drafts page
    hide();
    
    // Let create page handle loading the draft
    Events.emit('create:continue', { draftId });
  };

  /**
   * Delete draft
   */
  const deleteDraft = async ({ data }) => {
    if (!confirm('Are you sure you want to delete this draft?')) {
      return;
    }
    
    const { error } = await API.drafts.delete(data.draftId);
    
    if (!error) {
      Toast.success('Draft deleted');
      await loadDrafts(); // Reload the list
    } else {
      Toast.error('Failed to delete draft');
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

  // Public API
  return {
    init,
    show,
    hide,
    loadDrafts
  };
})();

// Initialize
DraftsPage.init();
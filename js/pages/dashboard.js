/**
 * Dashboard Page - Shows user's published itineraries
 * Place in: js/pages/dashboard.js
 */

const DashboardPage = (() => {
  let currentUser = null;
  let publishedItineraries = [];
  let stats = {
    totalViews: 0,
    totalSales: 0,
    totalEarnings: 0,
    totalItineraries: 0
  };

  /**
   * Initialize the dashboard
   */
  const init = async () => {
    console.log('Dashboard: Initializing');
    
    // Check authentication
    currentUser = await API.auth.getUser();
    if (!currentUser) {
      window.location.hash = '#signin';
      return;
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Load and render
    await loadDashboardData();
  };

  /**
   * Set up event listeners
   */
  const setupEventListeners = () => {
    // Listen for edit events from cards
    Events.on('dashboard:edit-itinerary', handleEditItinerary);
    Events.on('dashboard:refresh', loadDashboardData);
  };

  /**
   * Load dashboard data
   */
  const loadDashboardData = async () => {
    try {
      showLoading();
      
      // Fetch user's published itineraries
      const { data, error } = await API.itineraries.list({
        creator_id: currentUser.id,
        sort_by: 'published_at',
        sort_order: 'desc'
      });
      
      if (error) {
        console.error('Error loading itineraries:', error);
        showError('Failed to load your itineraries');
        return;
      }
      
      publishedItineraries = data || [];
      calculateStats();
      render();
      
    } catch (error) {
      console.error('Dashboard error:', error);
      showError('Failed to load dashboard');
    }
  };

  /**
   * Calculate dashboard statistics
   */
  const calculateStats = () => {
    stats = {
      totalViews: 0,
      totalSales: 0,
      totalEarnings: 0,
      totalItineraries: publishedItineraries.length
    };
    
    publishedItineraries.forEach(itinerary => {
      stats.totalViews += itinerary.view_count || 0;
      stats.totalSales += itinerary.total_sales || 0;
      // Calculate earnings (85% of sales)
      const price = itinerary.price_tier || 9;
      const earnings = (itinerary.total_sales || 0) * price * 0.85;
      stats.totalEarnings += earnings;
    });
  };

  /**
   * Render the dashboard
   */
  const render = () => {
    const container = document.getElementById('page-content');
    if (!container) return;
    
    container.innerHTML = `
      <div class="dashboard-container">
        ${renderHeader()}
        ${renderStats()}
        ${renderItinerariesSection()}
      </div>
    `;
  };

  /**
   * Render dashboard header
   */
  const renderHeader = () => {
    return `
      <div class="dashboard-header">
        <div class="header-content">
          <h1>My Published Work</h1>
          <p>Manage and track your published itineraries</p>
        </div>
        <div class="header-actions">
          <a href="#create" class="btn btn-primary">
            <span>+</span> Create New Itinerary
          </a>
        </div>
      </div>
    `;
  };

  /**
   * Render statistics cards
   */
  const renderStats = () => {
    return `
      <div class="dashboard-stats">
        <div class="stat-card">
          <div class="stat-icon">📚</div>
          <div class="stat-content">
            <div class="stat-value">${stats.totalItineraries}</div>
            <div class="stat-label">Published</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">👁️</div>
          <div class="stat-content">
            <div class="stat-value">${formatNumber(stats.totalViews)}</div>
            <div class="stat-label">Total Views</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">🛒</div>
          <div class="stat-content">
            <div class="stat-value">${stats.totalSales}</div>
            <div class="stat-label">Total Sales</div>
          </div>
        </div>
        
        <div class="stat-card highlight">
          <div class="stat-icon">💰</div>
          <div class="stat-content">
            <div class="stat-value">€${stats.totalEarnings.toFixed(2)}</div>
            <div class="stat-label">Total Earnings</div>
          </div>
        </div>
      </div>
    `;
  };

  /**
   * Render itineraries section
   */
  const renderItinerariesSection = () => {
    if (publishedItineraries.length === 0) {
      return renderEmptyState();
    }
    
    // Add performance metrics to each itinerary for dashboard context
    const itinerariesWithMetrics = publishedItineraries.map(itinerary => ({
      ...itinerary,
      earnings: ((itinerary.total_sales || 0) * (itinerary.price_tier || 9) * 0.85).toFixed(2)
    }));
    
    return `
      <div class="dashboard-itineraries">
        <div class="section-header">
          <h2>Your Itineraries</h2>
          <div class="filter-options">
            <select id="sort-select" onchange="DashboardPage.handleSort(this.value)">
              <option value="published_at">Newest First</option>
              <option value="total_sales">Best Sellers</option>
              <option value="view_count">Most Viewed</option>
              <option value="price_tier">Highest Price</option>
            </select>
          </div>
        </div>
        
        <div class="itineraries-grid">
          ${ItineraryCard.renderCards(itinerariesWithMetrics, 'dashboard')}
        </div>
      </div>
    `;
  };

  /**
   * Render empty state
   */
  const renderEmptyState = () => {
    return `
      <div class="dashboard-empty-state">
        <div class="empty-icon">🗺️</div>
        <h2>No Published Itineraries Yet</h2>
        <p>Start earning by creating and publishing your first travel itinerary!</p>
        <a href="#create" class="btn btn-primary">
          Create Your First Itinerary
        </a>
        
        <div class="empty-state-tips">
          <h3>Tips for Success:</h3>
          <ul>
            <li>📸 Use high-quality cover images</li>
            <li>✍️ Write detailed, personal tips for each stop</li>
            <li>🎯 Set clear trip characteristics</li>
            <li>💡 Include insider knowledge only locals would know</li>
            <li>📍 Add at least 3-5 stops per day</li>
          </ul>
        </div>
      </div>
    `;
  };

  /**
   * Show loading state
   */
  const showLoading = () => {
    const container = document.getElementById('page-content');
    if (!container) return;
    
    container.innerHTML = `
      <div class="dashboard-loading">
        <div class="spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    `;
  };

  /**
   * Show error state
   */
  const showError = (message) => {
    const container = document.getElementById('page-content');
    if (!container) return;
    
    container.innerHTML = `
      <div class="dashboard-error">
        <div class="error-icon">⚠️</div>
        <h2>Error Loading Dashboard</h2>
        <p>${message}</p>
        <button class="btn btn-primary" onclick="DashboardPage.init()">
          Try Again
        </button>
      </div>
    `;
  };

  /**
   * Handle edit itinerary
   * For now, we'll create a new draft from the published version
   */
  const handleEditItinerary = async (itineraryId) => {
    try {
      // TODO: Implement edit flow
      // Options:
      // 1. Create a draft copy of the published itinerary
      // 2. Navigate to create page with that draft
      // 3. On publish, update the existing itinerary instead of creating new
      
      Toast.info('Edit functionality coming soon!');
      
      // For now, just open the modal to view
      if (typeof ItineraryCard !== 'undefined') {
        ItineraryCard.openModal(itineraryId, 'view');
      }
      
    } catch (error) {
      console.error('Error editing itinerary:', error);
      Toast.error('Failed to edit itinerary');
    }
  };

  /**
   * Handle sort change
   */
  const handleSort = async (sortBy) => {
    try {
      showLoading();
      
      const { data, error } = await API.itineraries.list({
        creator_id: currentUser.id,
        sort_by: sortBy,
        sort_order: sortBy === 'published_at' ? 'desc' : 'desc'
      });
      
      if (!error && data) {
        publishedItineraries = data;
        calculateStats();
        render();
      }
      
    } catch (error) {
      console.error('Sort error:', error);
    }
  };

  /**
   * Format large numbers
   */
  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  // Public API
  return {
    init,
    handleSort,
    handleEditItinerary
  };
})();

// Initialize when the page loads
if (window.location.hash === '#dashboard') {
  document.addEventListener('DOMContentLoaded', DashboardPage.init);
}

// Make available globally
window.DashboardPage = DashboardPage;
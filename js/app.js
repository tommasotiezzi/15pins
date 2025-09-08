/**
 * Main Application Entry Point
 * Updated to use Supabase Auth instead of mock DB
 */

const App = (() => {
  
  /**
   * Initialize the application
   */
  const init = async () => {
    console.log('Initializing Wanderlist...');
    
    // Initialize core modules
    DOMEvents.init();
    Modal.init();
    Toast.init();
    
    // Check for existing session
    await checkAuthSession();
    
    // Set up auth state listener
    API.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      if (event === 'SIGNED_IN') {
        await handleAuthSuccess(session);
      } else if (event === 'SIGNED_OUT') {
        handleSignOut();
      }
    });
    
    // Initialize router
    Router.init();
    
    // Set up global event handlers
    setupEventHandlers();
    
    // Update UI based on initial state
    updateAuthUI();
    
    console.log('Wanderlist initialized successfully');
  };

  /**
   * Check for existing auth session on app load
   */
  const checkAuthSession = async () => {
    const session = await API.auth.getSession();
    if (session) {
      const user = await API.auth.getUser();
      if (user) {
        State.set('currentUser', user);
        await loadUserData(user.id);
      }
    }
  };

  /**
   * Load user-specific data
   */
  const loadUserData = async (userId) => {
    // Load user's drafts
    const { data: drafts } = await API.drafts.list(userId);
    if (drafts) {
      State.set('drafts.list', drafts);
    }

    // Load user's wishlist
    const { data: wishlist } = await API.wishlist.list(userId);
    if (wishlist) {
      const wishlistIds = wishlist.map(item => item.itinerary_id);
      State.set('wishlist', wishlistIds);
    }
  };

  /**
   * Set up global event handlers
   */
  const setupEventHandlers = () => {
    // Authentication
    Events.on('action:login', handleLogin);
    Events.on('action:signup', handleSignup);
    Events.on('action:logout', handleLogout);
    
    // Auth form submissions
    Events.on('form:login', handleLoginSubmit);
    Events.on('form:signup', handleSignupSubmit);
    
    // Wishlist
    Events.on('action:wishlist', handleWishlistToggle);
    Events.on('action:wishlist-view', handleWishlistView);
    
    // Search
    Events.on('action:search', handleSearch);
    
    // Itinerary actions
    Events.on('action:view-itinerary', handleViewItinerary);
    
    // User menu
    Events.on('action:toggle-user-menu', handleUserMenuToggle);
    
    // State subscriptions
    State.subscribe('currentUser', updateAuthUI);
    State.subscribe('wishlist', updateWishlistBadge);
  };

  /**
   * Show login modal
   */
  const handleLogin = () => {
    Modal.open({
      title: 'Sign In',
      size: 'small',
      content: `
        <div style="padding: 32px;">
          <h2 style="margin-bottom: 24px; text-align: center;">Welcome Back</h2>
          
          <form data-handler="login">
            <div class="form-group">
              <label for="login-email">Email</label>
              <input type="email" 
                     id="login-email" 
                     name="email" 
                     class="form-control" 
                     placeholder="your@email.com" 
                     required>
            </div>
            
            <div class="form-group">
              <label for="login-password">Password</label>
              <input type="password" 
                     id="login-password" 
                     name="password" 
                     class="form-control" 
                     placeholder="••••••••" 
                     required>
            </div>
            
            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 16px;">
              Sign In
            </button>
          </form>
          
          <p style="text-align: center; margin-top: 24px; color: var(--text-light);">
            Don't have an account? 
            <a href="#" data-action="signup" style="color: var(--primary); text-decoration: none;">
              Sign up
            </a>
          </p>
        </div>
      `
    });
  };

  /**
   * Show signup modal
   */
  const handleSignup = () => {
    Modal.open({
      title: 'Create Account',
      size: 'small',
      content: `
        <div style="padding: 32px;">
          <h2 style="margin-bottom: 24px; text-align: center;">Join Wanderlist</h2>
          
          <form data-handler="signup">
            <div class="form-group">
              <label for="signup-username">Username</label>
              <input type="text" 
                     id="signup-username" 
                     name="username" 
                     class="form-control" 
                     placeholder="johndoe" 
                     pattern="[a-zA-Z0-9_]{3,20}"
                     title="3-20 characters, letters, numbers and underscore only"
                     required>
              <small style="color: var(--text-light);">This will be your public name</small>
            </div>
            
            <div class="form-group">
              <label for="signup-email">Email</label>
              <input type="email" 
                     id="signup-email" 
                     name="email" 
                     class="form-control" 
                     placeholder="your@email.com" 
                     required>
            </div>
            
            <div class="form-group">
              <label for="signup-password">Password</label>
              <input type="password" 
                     id="signup-password" 
                     name="password" 
                     class="form-control" 
                     placeholder="••••••••" 
                     minlength="6"
                     required>
              <small style="color: var(--text-light);">At least 6 characters</small>
            </div>
            
            <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 16px;">
              Create Account
            </button>
          </form>
          
          <p style="text-align: center; margin-top: 24px; color: var(--text-light);">
            Already have an account? 
            <a href="#" data-action="login" style="color: var(--primary); text-decoration: none;">
              Sign in
            </a>
          </p>
        </div>
      `
    });
  };

  /**
   * Handle login form submission
   */
  const handleLoginSubmit = async ({ data }) => {
    const button = document.querySelector('button[type="submit"]');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Signing in...';

    const { data: authData, error } = await API.auth.signIn(data.email, data.password);

    if (error) {
      Toast.error(error.message || 'Failed to sign in');
      button.disabled = false;
      button.textContent = originalText;
    } else {
      // Success handled by auth state change listener
      Modal.close();
    }
  };

  /**
   * Handle signup form submission
   */
  const handleSignupSubmit = async ({ data }) => {
    const button = document.querySelector('button[type="submit"]');
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Creating account...';

    const { data: authData, error } = await API.auth.signUp(
      data.email, 
      data.password, 
      data.username
    );

    if (error) {
      Toast.error(error.message || 'Failed to create account');
      button.disabled = false;
      button.textContent = originalText;
    } else {
      Modal.close();
      Toast.success('Account created! Please check your email to verify your account.');
    }
  };

  /**
   * Handle successful authentication
   */
  const handleAuthSuccess = async (session) => {
    const user = await API.auth.getUser();
    if (user) {
      State.set('currentUser', user);
      await loadUserData(user.id);
      Toast.success(`Welcome back, ${user.profile?.username || user.email}!`);
      
      // Check for intended route
      const intendedRoute = State.get('auth.intendedRoute');
      if (intendedRoute) {
        Router.navigateTo(intendedRoute);
        State.set('auth.intendedRoute', null);
      }
    }
  };

  /**
   * Handle logout
   */
  const handleLogout = () => {
    Modal.confirm({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      onConfirm: async () => {
        const { error } = await API.auth.signOut();
        if (!error) {
          handleSignOut();
        }
      }
    });
  };

  /**
   * Handle sign out cleanup
   */
  const handleSignOut = () => {
    State.set('currentUser', null);
    State.set('drafts.list', []);
    State.set('wishlist', []);
    Router.navigateTo('feed');
    Toast.info('You have been signed out');
  };

  /**
   * Toggle wishlist item
   */
  const handleWishlistToggle = async ({ data }) => {
    const user = State.get('currentUser');
    if (!user) {
      Toast.error('Please sign in to save itineraries');
      handleLogin();
      return;
    }

    const wishlist = State.get('wishlist') || [];
    const itineraryId = data.id;
    
    if (wishlist.includes(itineraryId)) {
      const { error } = await API.wishlist.remove(itineraryId);
      if (!error) {
        State.set('wishlist', wishlist.filter(id => id !== itineraryId));
        Toast.show('Removed from wishlist');
      }
    } else {
      const { error } = await API.wishlist.add(itineraryId);
      if (!error) {
        State.set('wishlist', [...wishlist, itineraryId]);
        Toast.success('Added to wishlist');
      }
    }
  };

  /**
   * View wishlist
   */
  const handleWishlistView = async () => {
    const user = State.get('currentUser');
    if (!user) {
      Toast.error('Please sign in to view your wishlist');
      handleLogin();
      return;
    }

    const { data: wishlistItems, error } = await API.wishlist.list(user.id);
    
    if (error) {
      Toast.error('Failed to load wishlist');
      return;
    }

    if (!wishlistItems || wishlistItems.length === 0) {
      Toast.info('Your wishlist is empty');
      return;
    }
    
    Modal.open({
      title: 'My Wishlist',
      size: 'medium',
      content: `
        <div style="padding: 32px;">
          <h2>My Wishlist (${wishlistItems.length})</h2>
          <div style="margin-top: 24px;">
            ${wishlistItems.map(item => {
              const it = item.itinerary;
              return `
                <div style="display: flex; gap: 16px; padding: 16px; background: var(--light-gray); border-radius: 8px; margin-bottom: 12px;">
                  <img src="${it.cover_image_url || 'https://via.placeholder.com/120x80'}" 
                       style="width: 120px; height: 80px; object-fit: cover; border-radius: 8px;">
                  <div style="flex: 1;">
                    <h4>${it.title}</h4>
                    <p style="color: var(--text-light); margin: 4px 0;">
                      ${it.destination} • ${it.duration_days} days • €${(it.price_cents / 100).toFixed(0)}
                    </p>
                    <p style="font-size: 0.875rem; color: var(--text-light);">
                      by ${it.creator?.username || 'Unknown'}
                    </p>
                  </div>
                  <button class="btn btn-primary" 
                          data-action="view-itinerary" 
                          data-id="${it.id}">
                    View
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `
    });
  };

  /**
   * Handle search
   */
  const handleSearch = () => {
    Toast.info('Search coming soon!');
  };

  /**
   * View itinerary details
   */
  const handleViewItinerary = async ({ data }) => {
    const { data: itinerary, error } = await API.itineraries.get(data.id);
    
    if (error || !itinerary) {
      Toast.error('Failed to load itinerary');
      return;
    }
    
    Modal.close(); // Close any existing modal
    
    Modal.open({
      size: 'large',
      content: `
        <div style="padding: 32px;">
          <img src="${itinerary.cover_image_url || 'https://via.placeholder.com/800x300'}" 
               style="width: 100%; height: 300px; object-fit: cover; border-radius: 12px; margin-bottom: 24px;">
          
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 24px;">
            <div>
              <h1 style="margin-bottom: 8px;">${itinerary.title}</h1>
              <div style="display: flex; align-items: center; gap: 16px; color: var(--text-light);">
                <span>📍 ${itinerary.destination}</span>
                <span>📅 ${itinerary.duration_days} days</span>
                <span>👁️ ${itinerary.view_count || 0} views</span>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 2rem; font-weight: 700; color: var(--primary); margin-bottom: 8px;">
                €${(itinerary.price_cents / 100).toFixed(0)}
              </div>
            </div>
          </div>
          
          <p style="font-size: 1.1rem; line-height: 1.6; margin-bottom: 32px;">
            ${itinerary.description}
          </p>
          
          <div style="display: flex; align-items: center; gap: 16px; padding: 20px; background: var(--light-gray); border-radius: 12px;">
            <img src="${itinerary.creator?.avatar_url || 'https://i.pravatar.cc/60'}" 
                 style="width: 60px; height: 60px; border-radius: 50%;">
            <div style="flex: 1;">
              <h4>${itinerary.creator?.username || 'Unknown'}</h4>
              <p style="color: var(--text-light); margin: 0;">${itinerary.creator?.bio || ''}</p>
            </div>
          </div>
        </div>
      `
    });
    
    // Increment view count
    API.itineraries.incrementView(data.id);
  };

  /**
   * Toggle user menu dropdown
   */
  const handleUserMenuToggle = () => {
    const dropdown = document.querySelector('.user-menu .dropdown');
    if (dropdown) {
      dropdown.classList.toggle('hidden');
    }
  };

  /**
   * Update auth UI
   */
  const updateAuthUI = () => {
    const user = State.get('currentUser');
    const loginBtn = document.getElementById('login-btn');
    const userMenu = document.getElementById('user-menu');
    const avatar = document.getElementById('user-avatar');
    
    if (user) {
      if (loginBtn) loginBtn.classList.add('hidden');
      if (userMenu) userMenu.classList.remove('hidden');
      if (avatar && user.profile?.avatar_url) {
        avatar.src = user.profile.avatar_url;
      } else if (avatar) {
        avatar.src = `https://i.pravatar.cc/150?u=${user.id}`;
      }
    } else {
      if (loginBtn) loginBtn.classList.remove('hidden');
      if (userMenu) userMenu.classList.add('hidden');
    }
  };

  /**
   * Update wishlist badge
   */
  const updateWishlistBadge = () => {
    const wishlist = State.get('wishlist') || [];
    const badge = document.getElementById('wishlist-count');
    
    if (badge) {
      badge.textContent = wishlist.length;
      badge.style.display = wishlist.length > 0 ? 'flex' : 'none';
    }
  };

  // Public API
  return {
    init
  };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', App.init);
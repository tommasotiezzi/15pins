/**
 * Router Module
 * Handles page navigation and URL management
 */

const Router = (() => {
  // Route configuration
  const routes = new Map([
    ['feed', { 
      title: 'Explore Itineraries', 
      requiresAuth: false,
      component: 'FeedPage'
    }],
    ['create', { 
      title: 'Create Itinerary', 
      requiresAuth: true,
      component: 'CreatePage'
    }],
    ['following', { 
      title: 'Following', 
      requiresAuth: false,
      component: 'FollowingPage'
    }],
    ['dashboard', { 
      title: 'Creator Dashboard', 
      requiresAuth: true,
      component: 'DashboardPage'
    }],
    ['profile', { 
      title: 'Profile', 
      requiresAuth: true,
      component: 'ProfilePage'
    }],
    ['itinerary', { 
      title: 'View Itinerary', 
      requiresAuth: false,
      component: 'ItineraryPage'
    }]
  ]);

  // Navigation guards
  const guards = [];

  // Current route
  let currentRoute = null;

  /**
   * Initialize router
   */
  const init = () => {
    // Handle browser back/forward
    window.addEventListener('popstate', handlePopState);
    
    // Listen for navigation events
    Events.on('navigate', handleNavigate);
    
    // Initial route
    const initialRoute = getRouteFromURL();
    navigateTo(initialRoute, { skipPush: true });
  };

  /**
   * Get route from current URL
   */
  const getRouteFromURL = () => {
    const hash = window.location.hash.slice(1);
    const [route, ...params] = hash.split('/');
    
    return {
      name: route || 'feed',
      params: params
    };
  };

  /**
   * Handle browser navigation
   */
  const handlePopState = (e) => {
    const route = getRouteFromURL();
    navigateTo(route, { skipPush: true });
  };

  /**
   * Handle navigation event
   */
  const handleNavigate = (data) => {
    if (typeof data === 'string') {
      navigateTo({ name: data, params: [] });
    } else if (data.page) {
      navigateTo({ name: data.page, params: data.params || [] });
    }
  };

  /**
   * Navigate to a route
   * @param {object|string} route - Route object or route name
   * @param {object} options - Navigation options
   */
  const navigateTo = async (route, options = {}) => {
    // Normalize route
    if (typeof route === 'string') {
      route = { name: route, params: [] };
    }

    const routeConfig = routes.get(route.name);
    if (!routeConfig) {
      console.error(`Route not found: ${route.name}`);
      route.name = 'feed';
    }

    // Run navigation guards
    for (const guard of guards) {
      const result = await guard(route, currentRoute);
      if (result === false) {
        return; // Navigation cancelled
      }
      if (typeof result === 'object') {
        route = result; // Redirect
      }
    }

    // Check authentication
    if (routeConfig && routeConfig.requiresAuth) {
      const user = State.get('currentUser');
      if (!user) {
        Toast.error('Please sign in to continue');
        
        // Store intended route for after login
        State.set('auth.intendedRoute', route);
        
        // Show login modal instead of navigating
        Events.emit('action:login');
        return;
      }
    }

    // Update URL
    if (!options.skipPush) {
      const url = route.params.length > 0 
        ? `#${route.name}/${route.params.join('/')}`
        : `#${route.name}`;
      
      window.history.pushState({ route }, '', url);
    }

    // Update document title
    if (routeConfig) {
      document.title = `${routeConfig.title} - Wanderlist`;
    }

    // Deactivate current route
    if (currentRoute) {
      deactivateRoute(currentRoute);
    }

    // Update state
    State.set('currentPage', route.name);
    currentRoute = route;

    // Activate new route
    activateRoute(route);

    // Emit route change event
    Events.emit('route:changed', route);

    // Scroll to top
    if (!options.skipScroll) {
      window.scrollTo(0, 0);
    }
  };

  /**
   * Deactivate current route
   */
  const deactivateRoute = (route) => {
    // Hide ALL pages first
    document.querySelectorAll('.page').forEach(page => {
      page.classList.remove('active');
    });

    // Update nav links
    document.querySelectorAll('[data-page]').forEach(link => {
      link.classList.remove('active');
    });

    // Emit deactivate event
    Events.emit(`page:${route.name}:deactivate`);
  };

  /**
   * Activate new route
   */
  const activateRoute = (route) => {
    // Show new page
    const pageEl = document.getElementById(`${route.name}-page`);
    if (pageEl) {
      // Hide all pages first
      document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
      });
      
      // Show the target page
      pageEl.classList.add('active');
      
      // Update nav links
      document.querySelectorAll('[data-page]').forEach(link => {
        link.classList.toggle('active', link.dataset.page === route.name);
      });
    }

    // Initialize the page component if it exists
    const routeConfig = routes.get(route.name);
    if (routeConfig && routeConfig.component) {
      const componentName = routeConfig.component;
      
      // Check if the component exists and has an init method
      if (window[componentName] && typeof window[componentName].init === 'function') {
        console.log(`Router: Initializing component ${componentName}`);
        // Call the component's init method
        window[componentName].init();
      }
    }

    // Emit activate event
    Events.emit(`page:${route.name}:activate`, route.params);
  };

  /**
   * Add navigation guard
   * @param {function} guard - Guard function (to, from) => boolean|route
   */
  const addGuard = (guard) => {
    guards.push(guard);
  };

  /**
   * Remove navigation guard
   */
  const removeGuard = (guard) => {
    const index = guards.indexOf(guard);
    if (index !== -1) {
      guards.splice(index, 1);
    }
  };

  /**
   * Go back in history
   */
  const back = () => {
    window.history.back();
  };

  /**
   * Go forward in history
   */
  const forward = () => {
    window.history.forward();
  };

  /**
   * Get current route
   */
  const getCurrentRoute = () => currentRoute;

  /**
   * Check if route is active
   */
  const isActive = (routeName) => {
    return currentRoute?.name === routeName;
  };

  /**
   * Generate route URL
   */
  const generateURL = (name, params = []) => {
    return params.length > 0
      ? `#${name}/${params.join('/')}`
      : `#${name}`;
  };

  // Public API
  return {
    init,
    navigateTo,
    back,
    forward,
    addGuard,
    removeGuard,
    getCurrentRoute,
    isActive,
    generateURL
  };
})();

// Make available globally
window.Router = Router;
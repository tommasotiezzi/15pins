/**
 * Google Places (New) API Service
 * Uses Vercel API routes to proxy requests and protect API key
 */

const GooglePlacesService = (() => {
  // Session token for grouping autocomplete requests (billing optimization)
  let sessionToken = null;
  let sessionTimeout = null;

  /**
   * Generate a new session token
   */
  const generateSessionToken = () => {
    // Simple UUID v4 generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  /**
   * Get or create session token
   */
  const getSessionToken = () => {
    if (!sessionToken) {
      sessionToken = generateSessionToken();
      // Reset token after 3 minutes (Google's session window)
      clearTimeout(sessionTimeout);
      sessionTimeout = setTimeout(() => {
        sessionToken = null;
      }, 180000);
    }
    return sessionToken;
  };

  /**
   * Create a debounced version of a function
   */
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      return new Promise((resolve) => {
        timeoutId = setTimeout(async () => {
          const result = await func(...args);
          resolve(result);
        }, delay);
      });
    };
  };

  /**
   * Search for place predictions (autocomplete)
   * Proxied through Vercel API route
   */
  const searchPlaces = async (input, options = {}) => {
    if (!input || input.length < 3) return [];

    try {
      const response = await fetch('/api/places/autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input,
          sessionToken: getSessionToken(),
          types: options.types || ["locality", "administrative_area_level_1", "country"],
          regionCodes: options.regionCodes || [],
          language: options.language || "en",
          maxSuggestions: options.maxSuggestions || 5
        })
      });

      if (!response.ok) {
        throw new Error(`Places API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Raw API response:', data);
      
      // Transform to simpler format - handle both text and structuredFormat
      const suggestions = (data.suggestions || []).map(suggestion => {
        const pred = suggestion.placePrediction;
        if (!pred) return null;
        
        const structured = pred.structuredFormat;
        
        // Use structuredFormat if available, fallback to text
        const mainText = structured?.mainText?.text || pred.text?.text?.split(',')[0] || '';
        const secondaryText = structured?.secondaryText?.text || 
                             pred.text?.text?.split(',').slice(1).join(',').trim() || '';
        
        return {
          placeId: pred.placeId || pred.place,
          description: pred.text?.text || '',
          mainText: mainText,
          secondaryText: secondaryText
        };
      }).filter(Boolean); // Remove any null entries
      
      console.log('Parsed suggestions:', suggestions);
      return suggestions;
    } catch (error) {
      console.error('Places autocomplete error:', error);
      return [];
    }
  };

  /**
   * Get detailed place information
   * Proxied through Vercel API route
   */
  const getPlaceDetails = async (placeId) => {
    if (!placeId) return null;

    try {
      // Clear session token after place selection (billing optimization)
      sessionToken = null;
      clearTimeout(sessionTimeout);

      const response = await fetch('/api/places/details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ placeId })
      });

      if (!response.ok) {
        throw new Error(`Places API error: ${response.status}`);
      }

      const place = await response.json();
      
      // Extract structured data
      const countryComponent = place.addressComponents?.find(
        comp => comp.types.includes('country')
      );
      const regionComponent = place.addressComponents?.find(
        comp => comp.types.includes('administrative_area_level_1')
      );
      const cityComponent = place.addressComponents?.find(
        comp => comp.types.includes('locality') || comp.types.includes('administrative_area_level_2')
      );

      return {
        placeId: place.id,
        formattedAddress: place.formattedAddress,
        shortAddress: place.shortFormattedAddress,
        displayName: place.displayName?.text || '',
        country: countryComponent?.longText || '',
        countryCode: countryComponent?.shortText || '',
        region: regionComponent?.longText || '',
        city: cityComponent?.longText || '',
        lat: place.location?.latitude || null,
        lng: place.location?.longitude || null,
        types: place.types || []
      };
    } catch (error) {
      console.error('Place details error:', error);
      return null;
    }
  };

  /**
   * Search for places suitable for stops (attractions, restaurants, etc.)
   * This is for Step 2 when adding stops to the itinerary
   */
  const searchStopPlaces = async (input, options = {}) => {
    if (!input || input.length < 2) return [];

    try {
      const response = await fetch('/api/places/autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input,
          sessionToken: getSessionToken(),
          types: options.types || [
            "tourist_attraction",
            "restaurant",
            "lodging",
            "museum",
            "park",
            "beach",
            "shopping_mall",
            "night_club",
            "cafe",
            "bar"
          ],
          locationBias: options.locationBias,
          language: options.language || "en",
          maxSuggestions: 8,
          isStopSearch: true // Flag to differentiate in API route
        })
      });

      if (!response.ok) {
        throw new Error(`Places API error: ${response.status}`);
      }

      const data = await response.json();
      
      return (data.suggestions || []).map(suggestion => {
        const pred = suggestion.placePrediction;
        if (!pred) return null;
        
        const structured = pred.structuredFormat;
        const mainText = structured?.mainText?.text || pred.text?.text?.split(',')[0] || '';
        const secondaryText = structured?.secondaryText?.text || 
                             pred.text?.text?.split(',').slice(1).join(',').trim() || '';
        
        return {
          placeId: pred.placeId || pred.place,
          description: pred.text?.text || '',
          types: pred.types || [],
          mainText: mainText,
          secondaryText: secondaryText
        };
      }).filter(Boolean);
    } catch (error) {
      console.error('Stop places autocomplete error:', error);
      return [];
    }
  };

  // Public API
  return {
    searchPlaces: debounce(searchPlaces, 300),
    searchStopPlaces: debounce(searchStopPlaces, 300),
    getPlaceDetails,
    // Export non-debounced versions for testing
    searchPlacesRaw: searchPlaces,
    searchStopPlacesRaw: searchStopPlaces,
    // Export debounce utility for other uses
    debounce
  };
})();

// Make available globally
window.GooglePlacesService = GooglePlacesService;
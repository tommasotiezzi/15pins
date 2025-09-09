/**
 * Vercel API Route: /api/places/autocomplete.js
 * Proxies autocomplete requests to Google Places API (New)
 */

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Enable CORS if needed
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { 
    input, 
    sessionToken, 
    types, 
    regionCodes, 
    language, 
    maxSuggestions,
    locationBias,
    isStopSearch 
  } = req.body;

  // Validate required fields
  if (!input) {
    return res.status(400).json({ error: 'Input is required' });
  }

  try {
    // Build request body according to NEW API format
    const requestBody = {
      input: input
    };

    // Add optional session token
    if (sessionToken) {
      requestBody.sessionToken = sessionToken;
    }

    // Add types for filtering (corrected field name)
    if (types && types.length > 0) {
      requestBody.includedPrimaryTypes = types;
    }

    // Add language code if specified
    if (language) {
      requestBody.languageCode = language;
    }

    // Add region codes if specified
    if (regionCodes && regionCodes.length > 0) {
      requestBody.includedRegionCodes = regionCodes;
    }

    console.log('Request to Google Places API:', JSON.stringify(requestBody, null, 2));

    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API,
        'X-Goog-FieldMask': 'suggestions.placePrediction.place,suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.types'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Google Places API error:', error);
      return res.status(response.status).json({ 
        error: 'Places API error',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Autocomplete error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
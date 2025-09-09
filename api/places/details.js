/**
 * Vercel API Route: /api/places/details.js
 * Fetches detailed place information from Google Places API
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

  const { placeId } = req.body;

  // Validate required fields
  if (!placeId) {
    return res.status(400).json({ error: 'Place ID is required' });
  }

  try {
    const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,addressComponents,location,shortFormattedAddress,types'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Google Places API error:', error);
      
      // Handle specific error cases
      if (response.status === 404) {
        return res.status(404).json({ error: 'Place not found' });
      }
      
      return res.status(response.status).json({ 
        error: 'Places API error',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }

    const data = await response.json();
    
    // Log usage in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`Place details fetched for: ${data.displayName?.text || placeId}`);
    }
    
    res.status(200).json(data);
  } catch (error) {
    console.error('Place details error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
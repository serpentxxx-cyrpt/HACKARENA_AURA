import axios from 'axios';
import { Mistral } from '@mistralai/mistralai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.MISTRAL_API_KEY || 'b5OceDpJ1vV7zI9lSGlMBqj6t4w17xNo';
const client = new Mistral({ apiKey });
const weatherKey = process.env.OPENWEATHER_API_KEY;

if (!apiKey) {
  console.error("WARNING: MISTRAL_API_KEY is not defined in .env");
}
if (!weatherKey) {
  console.error("WARNING: OPENWEATHER_API_KEY is not defined in .env");
}


// Default location for Kolkata (Central)
const DEFAULT_LAT = 22.5726;
const DEFAULT_LNG = 88.3639;

/**
 * Fetch live meteorological data from OpenWeather API for given coordinates.
 */
export async function fetchWeatherData(lat, lng) {
  const latitude = lat ?? DEFAULT_LAT;
  const longitude = lng ?? DEFAULT_LNG;
  
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${weatherKey}&units=metric`;
    console.log(`[AURA Geospatial] Fetching weather from: ${url.replace(weatherKey, '***')}`);
    const response = await axios.get(url, { timeout: 8000 });
    
    const data = response.data || {};
    return {
      temp: data.main?.temp ?? 30.0,
      condition: data.weather?.[0]?.main ?? 'Clear',
      description: data.weather?.[0]?.description ?? 'Clear sky',
      windSpeed: data.wind?.speed ?? 0,
      rain: data.rain?.['1h'] ?? 0,
      humidity: data.main?.humidity ?? 70
    };
  } catch (err) {
    console.error('[AURA Geospatial] OpenWeather API call failed. Using standard climate estimates.', err.message);
    // Fallback standard weather parameters
    return {
      temp: 29.5,
      condition: 'Rain',
      description: 'Moderate monsoonal rainfall',
      windSpeed: 4.2,
      rain: 2.5,
      humidity: 85
    };
  }
}

/**
 * Runs Agent 2: The Geospatial Agent.
 * Analyzes weather conditions and coordinates to map safe high-elevation directions.
 * 
 * @param {Object} inputData
 * @param {Object} inputData.gps - { lat, lng } coordinate of target
 * @param {Object} inputData.triage - Triage details { priority, need, hazard }
 */
export async function runGeospatialAgent(inputData) {
  const lat = inputData.gps?.lat ?? DEFAULT_LAT;
  const lng = inputData.gps?.lng ?? DEFAULT_LNG;
  const triage = inputData.triage || {};

  // 1. Fetch live meteorological weather
  const weather = await fetchWeatherData(lat, lng);

  // 2. Call Gemini 2.5 Flash for spatial analysis
  const systemInstruction = 
    "You are the Geospatial Agent (Agent 2 of 3) for Project AURA, an emergency dispatch system in Kolkata.\n" +
    "Your job is to analyze live weather conditions, GPS coordinates, local flood-risk parameters, " +
    "and known waterlogging zones in Kolkata (e.g. Amherst Street, Thanthania Kalibari, Gariahat underpass, " +
    "Behala, Ultadanga, Central Avenue) to compute a safe, flood-resilient route to safety.\n\n" +
    "You must output strictly in valid JSON format with no markdown formatting.\n" +
    "Determine the following fields based on the input coordinates, triage, and weather:\n" +
    "1. 'weatherAlert': A clear, warning-oriented meteorological notice (e.g. 'Severe thunderstorm active in south Kolkata. Waterlogging risk high.').\n" +
    "2. 'floodRiskScore': Integer 1-5 rating flooding risk at these coordinates (1 = safe, 5 = critical flooding).\n" +
    "3. 'safeDirections': An array of 2-4 clear text steps guiding traversal to the closest dry safety zone or hospital (mentioning specific high-elevation Kolkata streets to follow, and low zones to avoid).\n" +
    "4. 'safeWaypoints': An array of 2-3 coordinate objects `[{\"lat\": float, \"lng\": float}]` mapping a safe route from the starting coordinate to the nearest high-elevation safety point. Ensure these coordinates are realistic adjustments (offsetting by +/- 0.002 to 0.005) away from low-lying areas.";

  const userPrompt = JSON.stringify({
    startCoords: { lat, lng },
    weatherDetails: weather,
    triageInfo: triage
  });

  try {
    const response = await client.chat.complete({
      model: 'mistral-large-latest',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt }
      ],
      responseFormat: { type: 'json_object' }
    });

    const responseText = response.choices[0].message.content || '{}';
    try {
      const cleanJson = responseText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      return {
        weather,
        geospatial: {
          weatherAlert: parsed.weatherAlert || 'Caution: Adverse weather conditions in progress.',
          floodRiskScore: parseInt(parsed.floodRiskScore, 10) || 3,
          safeDirections: parsed.safeDirections || ['Proceed along high ground to the nearest shelter.'],
          safeWaypoints: parsed.safeWaypoints || [
            { lat: lat + 0.002, lng: lng + 0.002 }
          ]
        }
      };
    } catch (parseErr) {
      console.error('[AURA Geospatial] Error parsing Gemini geospatial JSON output:', parseErr);
      console.error('Original response text was:', responseText);
      throw new Error('Failed to parse Geospatial AI response');
    }
  } catch (err) {
    console.error('[AURA Geospatial] Gemini API call failed in geospatial service:', err);
    throw err;
  }
}

/**
 * Standard offline fallback spatial computations for Agent 2.
 */
export function getFallbackGeospatial(lat, lng, weather, triage) {
  console.log('[AURA Geospatial] Operating fallback geospatial router.');

  let floodRiskScore = 3;
  let weatherAlert = 'Standard monsoonal precipitation detected. Wet driving conditions active.';
  let safeDirections = [];
  let safeWaypoints = [];

  // Determine local hotspot hazards using heuristic offsets
  const nearGariahat = Math.abs(lat - 22.5186) < 0.01 && Math.abs(lng - 88.3712) < 0.01;
  const nearSaltLake = Math.abs(lat - 22.5726) < 0.01 && Math.abs(lng - 88.42) < 0.02;

  if (weather.rain > 3 || triage.hazard === 'flooding') {
    floodRiskScore = nearGariahat ? 5 : 4;
    weatherAlert = 'HEAVY FLOOD WARNING: Active severe waterlogging detected at local channels. Low-lying corridors closed.';
    
    if (nearGariahat) {
      safeDirections = [
        'AVOID Gariahat subway and Golpark roundabout due to active 1.8ft waterlogging.',
        'Proceed East along Rashbehari Avenue toward Ballygunge Station overpass (higher elevation).',
        'Check in at Ballygunge assembly camp near Broad Street.'
      ];
      safeWaypoints = [
        { lat: 22.5192, lng: 88.3750 },
        { lat: 22.5220, lng: 88.3785 }
      ];
    } else {
      safeDirections = [
        'Proceed cautiously to the nearest high-elevation multi-story facility.',
        'Avoid waterlogged basements and low underground crossings.',
        'Follow main traffic bypass arteries where storm drainage is operational.'
      ];
      safeWaypoints = [
        { lat: lat + 0.003, lng: lng + 0.003 }
      ];
    }
  } else {
    // Standard baseline response
    safeDirections = [
      'Normal arterial routing is functional.',
      'Check meteorological updates before traversing underpasses.',
      'Report any drain failures to municipal services.'
    ];
    safeWaypoints = [
      { lat: lat + 0.001, lng: lng + 0.001 }
    ];
  }

  return {
    weather,
    geospatial: {
      weatherAlert,
      floodRiskScore,
      safeDirections,
      safeWaypoints
    }
  };
}

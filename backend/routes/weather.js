import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

/**
 * GET /api/weather?lat=...&lng=...
 * Fetches real-time weather from OpenWeatherMap and returns a structured payload
 * for the meteorological alert dashboard.
 */
router.get('/weather', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat) || 22.5726;
    const lng = parseFloat(req.query.lng) || 88.3639;

    if (!OPENWEATHER_API_KEY) {
      console.warn('[AURA Weather] OPENWEATHER_API_KEY not found, returning mock data.');
      return res.status(200).json(getMockWeather(lat, lng));
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    console.log(`[AURA Weather] Fetching from OpenWeatherMap for (${lat}, ${lng})...`);

    const response = await axios.get(url, { timeout: 8000 });
    const data = response.data;

    // Compute flood risk heuristic
    const rainMm = data.rain?.['1h'] || data.rain?.['3h'] || 0;
    const humidity = data.main?.humidity || 70;
    const windSpeed = data.wind?.speed || 0;
    let floodRisk = 1;
    if (rainMm > 10) floodRisk = 5;
    else if (rainMm > 5) floodRisk = 4;
    else if (rainMm > 2) floodRisk = 3;
    else if (rainMm > 0.5) floodRisk = 2;
    if (humidity > 90) floodRisk = Math.min(5, floodRisk + 1);

    // Determine alert level
    let alertLevel = 'NORMAL';
    let alertMessage = 'Clear conditions. Normal operations.';
    if (floodRisk >= 4) {
      alertLevel = 'CRITICAL';
      alertMessage = `Heavy precipitation detected (${rainMm}mm/h). Active waterlogging risk in low-lying corridors. Avoid underpasses.`;
    } else if (floodRisk === 3) {
      alertLevel = 'HIGH';
      alertMessage = `Moderate rainfall (${rainMm}mm/h). Wet driving conditions. Monitor drainage systems.`;
    } else if (floodRisk === 2) {
      alertLevel = 'ELEVATED';
      alertMessage = `Light rainfall detected (${rainMm}mm/h). Exercise caution in known flood zones.`;
    }

    const weatherPayload = {
      location: { lat, lng },
      city: data.name || 'Kolkata',
      timestamp: new Date().toISOString(),
      temperature: Math.round(data.main?.temp || 30),
      feelsLike: Math.round(data.main?.feels_like || 32),
      humidity: humidity,
      condition: data.weather?.[0]?.main || 'Clear',
      description: data.weather?.[0]?.description || 'clear sky',
      icon: data.weather?.[0]?.icon || '01d',
      windSpeed: windSpeed,
      windDeg: data.wind?.deg || 0,
      rainMm: rainMm,
      visibility: (data.visibility || 10000) / 1000, // km
      pressure: data.main?.pressure || 1013,
      floodRisk: floodRisk,
      alertLevel: alertLevel,
      alertMessage: alertMessage,
      isFalseAlarm: false,
      source: 'OpenWeatherMap Live'
    };

    console.log(`[AURA Weather] ${data.name}: ${weatherPayload.temperature}°C, ${weatherPayload.condition}, Rain: ${rainMm}mm/h, Flood Risk: ${floodRisk}/5, Alert: ${alertLevel}`);

    return res.status(200).json(weatherPayload);
  } catch (error) {
    console.error('[AURA Weather] API call failed, returning fallback:', error.message);
    return res.status(200).json(getMockWeather(
      parseFloat(req.query.lat) || 22.5726,
      parseFloat(req.query.lng) || 88.3639
    ));
  }
});

/**
 * POST /api/false-alarm
 * Marks a weather alert as a false alarm and notifies the routing agent.
 */
router.post('/false-alarm', (req, res) => {
  try {
    const { alertLevel, reason } = req.body || {};
    console.log(`\n[AURA FALSE ALARM] ==========================================`);
    console.log(`  ALERT LEVEL  : ${alertLevel || 'UNKNOWN'}`);
    console.log(`  REASON       : ${reason || 'Operator-flagged false alarm'}`);
    console.log(`  TIMESTAMP    : ${new Date().toISOString()}`);
    console.log(`  ACTION       : Routing Agent (Agent 2) notified. Re-routing with updated parameters.`);
    console.log(`============================================================\n`);

    // Emit to socket so Agent 2 (geospatial) is notified in real-time
    const io = req.app.get('io');
    if (io) {
      io.emit('false-alarm-notification', {
        alertLevel,
        reason: reason || 'Operator-flagged false alarm',
        timestamp: new Date().toISOString(),
        message: `[FALSE ALARM] Weather alert level "${alertLevel}" has been marked as FALSE ALARM by HQ operator. Routing Agent recalculating paths without weather penalty.`
      });
      io.emit('geospatial-log', {
        logMessage: `[FALSE ALARM OVERRIDE] Weather alert "${alertLevel}" dismissed by HQ operator. Geospatial Agent recalculating optimal routes without weather avoidance penalties.`
      });
    }

    return res.status(200).json({
      status: 'acknowledged',
      message: 'False alarm flagged. Routing Agent (Agent 2) has been notified.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[AURA False Alarm] Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

function getMockWeather(lat, lng) {
  return {
    location: { lat, lng },
    city: 'Kolkata',
    timestamp: new Date().toISOString(),
    temperature: 29,
    feelsLike: 34,
    humidity: 82,
    condition: 'Rain',
    description: 'moderate rain',
    icon: '10d',
    windSpeed: 4.2,
    windDeg: 180,
    rainMm: 2.5,
    visibility: 6,
    pressure: 1008,
    floodRisk: 3,
    alertLevel: 'HIGH',
    alertMessage: 'Moderate rainfall (2.5mm/h). Wet driving conditions. Monitor drainage systems.',
    isFalseAlarm: false,
    source: 'Fallback (API Offline)'
  };
}

export default router;

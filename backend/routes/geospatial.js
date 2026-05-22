import express from 'express';
import { runGeospatialAgent } from '../services/geospatial.js';
import { getLastKnownLocation, updateLastKnownLocation } from '../utils/locationCache.js';

const router = express.Router();

// POST /api/geospatial
router.post('/geospatial', async (req, res) => {
  try {
    console.log('[AURA Geospatial] Ingesting spatial routing request...');
    const body = req.body || {};
    
    const userId = body.userId || 'Unknown PWA User';
    let gps = body.gps || null;
    const triage = body.triage || {
      language: body.language || 'en',
      priority: body.priority || 3,
      need: body.need || 'assistance',
      hazard: body.hazard || 'none'
    };

    // Check locationCache if coordinates are missing
    if (!gps) {
      const cachedGps = getLastKnownLocation(userId);
      if (cachedGps) {
        gps = cachedGps;
        console.log(`[AURA Geospatial] Resolved last known coordinates for ${userId}: ${JSON.stringify(cachedGps)}`);
      }
    } else {
      updateLastKnownLocation(userId, gps);
    }

    // Execute Geospatial routing calculations
    const spatialResult = await runGeospatialAgent({ gps, triage });

    const combined = {
      userId,
      gps,
      triage,
      weather: spatialResult.weather,
      geospatial: spatialResult.geospatial,
      timestamp: new Date().toISOString()
    };

    // Monospaced Backend Console Log Ledger
    console.log('\n================== AURA COGNITIVE TERMINAL GEOSPATIAL ==================');
    console.log(`TIMESTAMP   : ${combined.timestamp}`);
    console.log(`OPERATOR ID : ${combined.userId}`);
    console.log(`LIVE TEMP   : ${combined.weather.temp}°C | CONDITION: ${combined.weather.condition.toUpperCase()}`);
    console.log(`PRECIP RATE : ${combined.weather.rain} mm/h | WIND: ${combined.weather.windSpeed} m/s`);
    console.log('------------------------- METEOROLOGICAL ALERT -------------------------');
    console.log(`ALERT       : ${combined.geospatial.weatherAlert.toUpperCase()}`);
    console.log(`FLOOD RISK  : [${combined.geospatial.floodRiskScore} / 5] - ${getRiskLevel(combined.geospatial.floodRiskScore)}`);
    console.log('--------------------------- TRAVEL WAYPOINTS ---------------------------');
    combined.geospatial.safeDirections.forEach((step, idx) => {
      console.log(`[STEP ${idx + 1}] : ${step}`);
    });
    console.log(`WAYPOINTS   : ${JSON.stringify(combined.geospatial.safeWaypoints)}`);
    console.log('========================================================================\n');

    // Emit live geospatial update via Socket.io for monospaced UI ledger updates
    const io = req.app.get('io');
    if (io) {
      io.emit('geospatial-log', {
        ...combined,
        logMessage: `[GEOSPATIAL AGENT] Route computed. Weather: ${combined.weather.condition} (${combined.weather.temp}°C) | Flood Risk: ${combined.geospatial.floodRiskScore}/5 | Waypoints calculated.`
      });
    }

    return res.status(200).json(combined);
  } catch (error) {
    console.error('[AURA Geospatial] Route error:', error);
    
    // Emit error to socket
    const io = req.app.get('io');
    if (io) {
      io.emit('geospatial-error', { error: error.message });
    }

    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

function getRiskLevel(score) {
  if (score <= 1) return 'SAFE';
  if (score === 2) return 'LOW RISK';
  if (score === 3) return 'MODERATE ADVERSE';
  if (score === 4) return 'HIGH WATER ALERT';
  return 'CRITICAL SEVERE WATERLOGGING';
}

export default router;

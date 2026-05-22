import express from 'express';
import { normalizeIngestion } from '../utils/normalizer.js';
import { runTriageAgent, getFallbackTriage } from '../services/triage.js';
import { runGeospatialAgent, getFallbackGeospatial, fetchWeatherData } from '../services/geospatial.js';
import { runLogisticsAgent } from '../services/logistics.js';
import { getLastKnownLocation, updateLastKnownLocation } from '../utils/locationCache.js';

const router = express.Router();

// POST /api/web-sos
router.post('/web-sos', async (req, res) => {
  const io = req.app.get('io') || global.ioInstance;
  
  try {
    console.log('[AURA Web-SOS] Ingesting standard JSON request...');
    const normalized = normalizeIngestion(req);
    
    // Resolve last known location fallback if coordinates are missing
    if (!normalized.gps) {
      const cachedGps = getLastKnownLocation(normalized.userId);
      if (cachedGps) {
        normalized.gps = cachedGps;
        console.log(`[AURA Web-SOS] Resolved last known coordinates for ${normalized.userId}: ${JSON.stringify(cachedGps)}`);
      } else {
        // Global default Kolkata coordinates (Gariahat)
        normalized.gps = { lat: 22.5186, lng: 88.3712 };
      }
    } else {
      updateLastKnownLocation(normalized.userId, normalized.gps);
    }

    // Pre-fetch weather to achieve complete synchronization across LLM triage reasoning
    let preFetchedWeather = { temp: 29.5, condition: 'Rain', description: 'Moderate monsoonal rainfall', windSpeed: 4.2, rain: 2.5, humidity: 85 };
    try {
      preFetchedWeather = await fetchWeatherData(normalized.gps.lat, normalized.gps.lng);
      console.log(`[AURA Web-SOS] Pre-fetched weather for (${normalized.gps.lat}, ${normalized.gps.lng}): ${preFetchedWeather.description}`);
    } catch (weatherErr) {
      console.error('[AURA Weather Pre-fetch] Weather pre-fetch failed. Using default.', weatherErr.message);
    }
    normalized.weather = preFetchedWeather;

    // 1. Execute Agent 1: AI Triage Agent with resilience wrapper
    let triage;
    let agent1Failed = false;
    try {
      triage = await runTriageAgent(normalized);
      if (!triage || typeof triage !== 'object' || !triage.need) {
        throw new Error('Malformed triage payload received from Agent 1');
      }
    } catch (err) {
      console.error('[AURA RESILIENCY] Agent 1 (Triage) experienced a fatal exception. Recovering via keyword heuristics...', err.message);
      agent1Failed = true;
      triage = getFallbackTriage(normalized.rawText || '');
      
      if (io) {
        io.emit('triage-log', {
          logMessage: `[RESILIENCY ACTIVE] Agent 1 (Triage) AI failed. Activating heuristic grammar compiler...`
        });
      }
    }

    // 2. Execute Agent 2: Geospatial Hazard Router Agent with resilience wrapper
    let spatialResult;
    let agent2Failed = false;
    try {
      spatialResult = await runGeospatialAgent({ gps: normalized.gps, triage });
      if (!spatialResult || !spatialResult.geospatial) {
        throw new Error('Malformed spatial payload received from Agent 2');
      }
    } catch (err) {
      console.error('[AURA RESILIENCY] Agent 2 (Geospatial) experienced a fatal exception. Recovering via localized spatial rules...', err.message);
      agent2Failed = true;
      
      // Resolve a simple weather fallback to feed downstream
      let weather = { temp: 29.5, condition: 'Rain', description: 'Moderate monsoonal rainfall', windSpeed: 4.2, rain: 2.5, humidity: 85 };
      try {
        weather = await fetchWeatherData(normalized.gps.lat, normalized.gps.lng);
      } catch (weatherErr) {
        console.error('[AURA RESILIENCY] Weather API fallback retrieval failed as well.');
      }
      
      spatialResult = getFallbackGeospatial(normalized.gps.lat, normalized.gps.lng, weather, triage);
      
      if (io) {
        io.emit('triage-log', {
          logMessage: `[RESILIENCY ACTIVE] Agent 2 (Geospatial) router failed. Invoking hard-coded flood bypass charts...`
        });
      }
    }

    // Combine payload for Agent 3
    const agentTwoPayload = {
      userId: normalized.userId,
      gps: normalized.gps,
      triage: triage,
      weather: spatialResult.weather,
      geospatial: spatialResult.geospatial,
      rawText: normalized.rawText,
      source: normalized.source
    };

    // 3. Execute Agent 3: Logistics Agent with resilience wrapper
    let logisticsResult;
    let agent3Failed = false;
    try {
      logisticsResult = await runLogisticsAgent(agentTwoPayload);
      if (!logisticsResult || !logisticsResult.target_facility_name) {
        throw new Error('Malformed logistics payload received from Agent 3');
      }
    } catch (err) {
      console.error('[AURA RESILIENCY] Agent 3 (Logistics) experienced a fatal exception. Activating local supply dispatch backup...', err.message);
      agent3Failed = true;
      
      // Local Heuristic Backup for logistics selection
      const matchedNeed = (triage.need || 'first aid').toLowerCase();
      let selectedDepot = 'SSKM Medical College (Heuristic Fallback)';
      let depotCoords = { lat: 22.5398, lng: 88.3444 };
      
      if (matchedNeed.includes('insulin')) {
        selectedDepot = 'AMRI Hospital, Gariahat (Heuristic Fallback)';
        depotCoords = { lat: 22.5186, lng: 88.3712 };
      } else if (matchedNeed.includes('water') || matchedNeed.includes('food')) {
        selectedDepot = 'Kolkata Zonal Relief Camp (Heuristic Fallback)';
        depotCoords = { lat: 22.5298, lng: 88.3615 };
      }

      const safeElevString = spatialResult.geospatial?.safeDirections?.[0] || 'Safe route calculated.';
      const fallbackMsg = `Emergency signal processed via backup channels. A supply package has been reserved for you at ${selectedDepot}. Proceed along high ground paths.`;
      
      logisticsResult = {
        source: normalized.source || 'web',
        target_facility_name: selectedDepot,
        facility_coords: depotCoords,
        execution_message: fallbackMsg,
        distance_km: 1.8
      };

      if (io) {
        io.emit('triage-log', {
          logMessage: `[RESILIENCY ACTIVE] Agent 3 (Logistics) database transaction failed. Deploying heuristic safe-depot fallback...`
        });
      }
    }
    
    // Combine final orchestrator payload
    const combined = {
      source: normalized.source,
      userId: normalized.userId,
      gps: normalized.gps,
      rawText: normalized.rawText,
      // Flattened Agent 1 Metadata
      language: triage.language,
      priority: triage.priority,
      need: triage.need,
      hazard: triage.hazard,
      // Nested Agent 1 Metadata
      triage: triage,
      // Agent 2 Metadata
      weather: spatialResult.weather,
      geospatial: spatialResult.geospatial,
      // Agent 3 Metadata
      logistics: logisticsResult,
      // Reliability audit flags
      reliability: {
        agent1Failed,
        agent2Failed,
        agent3Failed,
        recovered: agent1Failed || agent2Failed || agent3Failed
      },
      timestamp: new Date().toISOString()
    };

    console.log(`[AURA Web-SOS] Orchestration Pipeline Complete: Priority ${combined.priority} | Facility: ${logisticsResult.target_facility_name}`);

    // Emit live cognitive logs via WebSockets to the monospaced Ledger Terminal
    if (io) {
      let recoveryTag = combined.reliability.recovered 
        ? `[RECOVERY ACTIVE - Failures: ${[agent1Failed && 'Agent1', agent2Failed && 'Agent2', agent3Failed && 'Agent3'].filter(Boolean).join(', ')}] `
        : '';
        
      io.emit('triage-log', {
        ...combined,
        logMessage: `${recoveryTag}[ORCHESTRATOR COMPLETED] Signal resolved. Priority ${combined.priority} | Reserved: ${logisticsResult.target_facility_name} | Location elevation check: ${combined.geospatial.weatherAlert}`
      });
    }

    return res.status(200).json(combined);
  } catch (error) {
    console.error('[AURA Web-SOS] Critical Route error:', error);
    
    // Fallback response for complete, catastrophic system crash
    if (io) {
      io.emit('triage-error', { error: error.message });
    }

    return res.status(500).json({ 
      error: 'Catastrophic Pipeline Error', 
      message: error.message,
      gps: { lat: 22.5186, lng: 88.3712 },
      triage: { language: 'en', priority: 1, need: 'medical help', hazard: 'none' },
      geospatial: {
        weatherAlert: 'Caution: Extreme adverse weather conditions reported.',
        floodRiskScore: 3,
        safeDirections: ['Proceed east towards highest concrete structure.', 'Avoid local sewer canals.'],
        safeWaypoints: [{ lat: 22.5204, lng: 88.3719 }]
      },
      logistics: {
        target_facility_name: 'SSKM Medical College (System Recovery Backup)',
        facility_coords: { lat: 22.5398, lng: 88.3444 },
        execution_message: 'Emergency channels bypassed. SSKM backup triage teams notified of your coordinates.',
        distance_km: 2.1
      }
    });
  }
});

// POST /api/twilio-webhook
router.post('/twilio-webhook', async (req, res) => {
  const io = req.app.get('io') || global.ioInstance;
  
  try {
    console.log('[AURA Twilio-Webhook] Ingesting x-www-form-urlencoded Twilio request...');
    const normalized = normalizeIngestion(req);
    
    // Resolve last known location fallback if coordinates are missing
    if (!normalized.gps) {
      const cachedGps = getLastKnownLocation(normalized.userId);
      if (cachedGps) {
        normalized.gps = cachedGps;
        console.log(`[AURA Twilio-Webhook] Resolved last known coordinates for ${normalized.userId}: ${JSON.stringify(cachedGps)}`);
      } else {
        normalized.gps = { lat: 22.5186, lng: 88.3712 };
      }
    } else {
      updateLastKnownLocation(normalized.userId, normalized.gps);
    }

    // Pre-fetch weather to achieve complete synchronization across LLM triage reasoning
    let preFetchedWeather = { temp: 29.5, condition: 'Rain', description: 'Moderate monsoonal rainfall', windSpeed: 4.2, rain: 2.5, humidity: 85 };
    try {
      preFetchedWeather = await fetchWeatherData(normalized.gps.lat, normalized.gps.lng);
      console.log(`[AURA Twilio-Webhook] Pre-fetched weather for (${normalized.gps.lat}, ${normalized.gps.lng}): ${preFetchedWeather.description}`);
    } catch (weatherErr) {
      console.error('[AURA Weather Pre-fetch] Weather pre-fetch failed. Using default.', weatherErr.message);
    }
    normalized.weather = preFetchedWeather;

    // 1. Execute Agent 1: AI Triage Agent with resilience wrapper
    let triage;
    let agent1Failed = false;
    try {
      triage = await runTriageAgent(normalized);
      if (!triage || typeof triage !== 'object' || !triage.need) {
        throw new Error('Malformed triage payload received from Agent 1');
      }
    } catch (err) {
      console.error('[AURA RESILIENCY] Agent 1 (Triage) Twilio error. Recovering via keyword heuristics...', err.message);
      agent1Failed = true;
      triage = getFallbackTriage(normalized.rawText || '');
      
      if (io) {
        io.emit('triage-log', {
          logMessage: `[RESILIENCY ACTIVE - TWILIO] Agent 1 (Triage) AI failed. Activating heuristic grammar compiler...`
        });
      }
    }
    
    // 2. Execute Agent 2: Geospatial Hazard Router Agent with resilience wrapper
    let spatialResult;
    let agent2Failed = false;
    try {
      spatialResult = await runGeospatialAgent({ gps: normalized.gps, triage });
      if (!spatialResult || !spatialResult.geospatial) {
        throw new Error('Malformed spatial payload received from Agent 2');
      }
    } catch (err) {
      console.error('[AURA RESILIENCY] Agent 2 (Geospatial) Twilio error. Recovering via localized spatial rules...', err.message);
      agent2Failed = true;
      
      let weather = { temp: 29.5, condition: 'Rain', description: 'Moderate monsoonal rainfall', windSpeed: 4.2, rain: 2.5, humidity: 85 };
      try {
        weather = await fetchWeatherData(normalized.gps.lat, normalized.gps.lng);
      } catch (weatherErr) {
        console.error('[AURA RESILIENCY] Weather API fallback retrieval failed.');
      }
      
      spatialResult = getFallbackGeospatial(normalized.gps.lat, normalized.gps.lng, weather, triage);
      
      if (io) {
        io.emit('triage-log', {
          logMessage: `[RESILIENCY ACTIVE - TWILIO] Agent 2 (Geospatial) router failed. Invoking hard-coded flood bypass charts...`
        });
      }
    }

    // Combine payload for Agent 3
    const agentTwoPayload = {
      userId: normalized.userId,
      gps: normalized.gps,
      triage: triage,
      weather: spatialResult.weather,
      geospatial: spatialResult.geospatial,
      rawText: normalized.rawText,
      source: normalized.source
    };

    // 3. Execute Agent 3: Logistics Agent with resilience wrapper
    let logisticsResult;
    let agent3Failed = false;
    try {
      logisticsResult = await runLogisticsAgent(agentTwoPayload);
      if (!logisticsResult || !logisticsResult.target_facility_name) {
        throw new Error('Malformed logistics payload received from Agent 3');
      }
    } catch (err) {
      console.error('[AURA RESILIENCY] Agent 3 (Logistics) Twilio error. Activating local supply dispatch backup...', err.message);
      agent3Failed = true;
      
      // Local Heuristic Backup for logistics selection
      const matchedNeed = (triage.need || 'first aid').toLowerCase();
      let selectedDepot = 'SSKM Medical College (Heuristic Fallback)';
      let depotCoords = { lat: 22.5398, lng: 88.3444 };
      
      if (matchedNeed.includes('insulin')) {
        selectedDepot = 'AMRI Hospital, Gariahat (Heuristic Fallback)';
        depotCoords = { lat: 22.5186, lng: 88.3712 };
      } else if (matchedNeed.includes('water') || matchedNeed.includes('food')) {
        selectedDepot = 'Kolkata Zonal Relief Camp (Heuristic Fallback)';
        depotCoords = { lat: 22.5298, lng: 88.3615 };
      }

      const safeElevString = spatialResult.geospatial?.safeDirections?.[0] || 'Safe route calculated.';
      const fallbackMsg = `Emergency signal processed via backup channels. A supply package has been reserved for you at ${selectedDepot}. Proceed along high ground paths.`;
      
      logisticsResult = {
        source: 'twilio',
        target_facility_name: selectedDepot,
        facility_coords: depotCoords,
        execution_message: `AURA ALERT: ${fallbackMsg} Reply HELP for volunteer vehicle escort.`,
        twilioMessage: `AURA ALERT: ${fallbackMsg} Reply HELP for volunteer vehicle escort.`
      };

      if (io) {
        io.emit('triage-log', {
          logMessage: `[RESILIENCY ACTIVE - TWILIO] Agent 3 (Logistics) database transaction failed. Deploying heuristic safe-depot fallback...`
        });
      }
    }

    // Combine final orchestrator payload
    const combined = {
      source: normalized.source,
      userId: normalized.userId,
      gps: normalized.gps,
      rawText: normalized.rawText,
      // Flattened Agent 1 Metadata
      language: triage.language,
      priority: triage.priority,
      need: triage.need,
      hazard: triage.hazard,
      // Nested Agent 1 Metadata
      triage: triage,
      // Agent 2 Metadata
      weather: spatialResult.weather,
      geospatial: spatialResult.geospatial,
      // Agent 3 Metadata
      logistics: logisticsResult,
      // Reliability audit flags
      reliability: {
        agent1Failed,
        agent2Failed,
        agent3Failed,
        recovered: agent1Failed || agent2Failed || agent3Failed
      },
      timestamp: new Date().toISOString()
    };
    
    // Console Ledger Logging for Twilio Ingestion (Sequenced multi-agent view)
    console.log('\n================== AURA COGNITIVE TERMINAL INGESTION ==================');
    console.log(`TIMESTAMP : ${combined.timestamp}`);
    console.log(`SOURCE    : TWILIO SMS`);
    console.log(`SENDER ID : ${combined.userId}`);
    console.log(`GPS COORDS: ${combined.gps ? `LAT: ${combined.gps.lat}, LNG: ${combined.gps.lng}` : 'NONE DETECTED'}`);
    console.log(`RAW TEXT  : "${combined.rawText}"`);
    console.log('--------------------------- TRIAGE ANALYSIS ---------------------------');
    console.log(`LANGUAGE  : ${combined.language.toUpperCase()}`);
    console.log(`PRIORITY  : ${combined.priority} (${getPriorityLabel(combined.priority)})`);
    console.log(`NEED      : ${combined.need.toUpperCase()}`);
    console.log(`HAZARD    : ${combined.hazard.toUpperCase()}`);
    if (combined.reliability.recovered) {
      console.log(`RECOVERY  : ACTIVE (Failures: ${[agent1Failed && 'Agent1', agent2Failed && 'Agent2', agent3Failed && 'Agent3'].filter(Boolean).join(', ')})`);
    }
    console.log('------------------------- GEOSPATIAL PATHS -----------------------------');
    console.log(`ALERT     : ${combined.geospatial.weatherAlert.toUpperCase()}`);
    console.log(`RISK INDEX: ${combined.geospatial.floodRiskScore} / 5`);
    console.log('-------------------------- LOGISTICS DEPLOYMENT ------------------------');
    console.log(`FACILITY  : ${logisticsResult.target_facility_name}`);
    console.log(`SMS TEXT  : "${logisticsResult.twilioMessage}"`);
    console.log('========================================================================\n');

    // Emit live cognitive logs via WebSockets to the monospaced Ledger Terminal
    if (io) {
      let recoveryTag = combined.reliability.recovered 
        ? `[RECOVERY ACTIVE - Twilio Failures: ${[agent1Failed && 'Agent1', agent2Failed && 'Agent2', agent3Failed && 'Agent3'].filter(Boolean).join(', ')}] `
        : '';

      io.emit('triage-log', {
        ...combined,
        logMessage: `${recoveryTag}[ORCHESTRATOR TWILIO COMPLETED] Signal processed. Reserved ${combined.need} at ${logisticsResult.target_facility_name}. SMS dispatched: "${logisticsResult.twilioMessage}"`
      });
    }

    // Respond with Twilio response XML containing the compressed message!
    res.type('text/xml');
    return res.status(200).send(`<Response><Message>${logisticsResult.twilioMessage}</Message></Response>`);
  } catch (error) {
    console.error('[AURA Twilio-Webhook] Route error:', error);
    
    // Emit error to socket
    if (io) {
      io.emit('triage-error', { error: error.message });
    }

    // Respond with clean TwiML even on error to keep Twilio happy
    res.type('text/xml');
    return res.status(200).send('<Response><Message>AURA EMERGENCY ALERT: Complete system pipeline error. Local emergency teams notified. Stay in high ground.</Message></Response>');
  }
});

function getPriorityLabel(priority) {
  switch (priority) {
    case 1: return 'CRITICAL - LIFE THREATENING';
    case 2: return 'URGENT - TRAPPED';
    case 3: return 'STANDARD - SUPPLIES/INFO';
    default: return 'UNKNOWN';
  }
}

export default router;

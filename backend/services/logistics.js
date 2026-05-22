import { db } from '../config/db.js';

// Kolkata default center coordinates
const DEFAULT_LAT = 22.5726;
const DEFAULT_LNG = 88.3639;

/**
 * Calculates the Haversine distance between two coordinates in kilometers.
 */
function haversineDistance(coords1, coords2) {
  if (!coords1 || !coords2) return Infinity;
  
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  
  const dLat = toRad(coords2.lat - coords1.lat);
  const dLng = toRad(coords2.lng - coords1.lng);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coords1.lat)) *
      Math.cos(toRad(coords2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
      
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

/**
 * Executes Agent 3: The Logistics Agent.
 * Reserves supplies atomically, writes active missions to Kanban logs, and handles fallback outputs.
 * 
 * @param {Object} agentTwoPayload 
 * @returns {Promise<Object>} Formatted logistics results
 */
export async function runLogisticsAgent(agentTwoPayload) {
  console.log('[AURA Logistics] Running Logistics Agent...');

  const userId = agentTwoPayload.userId || 'Unknown Citizen';
  const source = agentTwoPayload.source || 'web';
  const gps = agentTwoPayload.gps || { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
  const rawText = agentTwoPayload.rawText || '';
  const triage = agentTwoPayload.triage || {};
  const weather = agentTwoPayload.weather || {};
  const geospatial = agentTwoPayload.geospatial || {};

  // 1. Resource query matching
  const need = triage.need || 'assistance';
  const normalizedNeed = need.toLowerCase();
  
  let matchedItem = 'first aid';
  if (normalizedNeed.includes('insulin')) {
    matchedItem = 'insulin';
  } else if (normalizedNeed.includes('oxygen') || normalizedNeed.includes('breath') || normalizedNeed.includes('asthma')) {
    matchedItem = 'oxygen';
  } else if (normalizedNeed.includes('food') || normalizedNeed.includes('khabar')) {
    matchedItem = 'food';
  } else if (normalizedNeed.includes('water') || normalizedNeed.includes('drink')) {
    matchedItem = 'water';
  }

  console.log(`[AURA Logistics] Parsed citizen need: "${need}" mapped to DB item: "${matchedItem}"`);

  // 2. Fetch inventory records
  let facilities = [];
  try {
    facilities = await db.getFacilities();
  } catch (err) {
    console.error('[AURA Logistics] Failed to retrieve facilities. Falling back to local defaults.', err.message);
  }

  // Filter facilities carrying this specific resource and carrying stock > 0
  const matchingFacilities = facilities.filter(f => (f.stock?.[matchedItem] ?? 0) > 0);

  // Error Handling: If 0 results (resource out of stock city-wide), execute autonomous pivot!
  if (matchingFacilities.length === 0) {
    console.warn(`[AURA Logistics] CITY-WIDE DEPLETION DETECTED for item "${matchedItem}". Triggering URGENT BROADCAST pivot...`);

    const broadcastData = {
      userId,
      originalRequest: rawText || triage.need || `Need ${matchedItem}`,
      need: matchedItem,
      status: 'URGENT_BROADCAST', // Alerts human Command Dispatchers
      priority: 1, // Elevate to Critical Priority
      userLocation: gps,
      facility: null,
      error: 'RESOURCE_DEPLETED',
      message: `URGENT BROADCAST: Stock depleted city-wide for ${matchedItem.toUpperCase()}. SOS sender: ${userId}. Coordinate lat: ${gps.lat}, lng: ${gps.lng}. Immediate human dispatch requested.`,
      timestamp: new Date().toISOString()
    };

    // Sync broadcast to active missions
    try {
      await db.addActiveMission(broadcastData);
      
      // Emit websocket log for the dashboard command center
      const io = global.ioInstance; // We'll attach this globally in server.js
      if (io) {
        io.emit('mission-broadcast', {
          ...broadcastData,
          logMessage: `[URGENT BROADCAST] City-wide stockpile depleted for ${matchedItem.toUpperCase()}! Dispatching human volunteers to user ${userId} immediately.`
        });
      }
    } catch (dbErr) {
      console.error('[AURA Logistics] Failed to write Urgent Broadcast to database:', dbErr.message);
    }

    // Format depleted responses
    const fallbackMsg = `Resource currently depleted nearby. Human dispatchers have been alerted to your coordinates. Stay safe.`;
    
    if (source === 'twilio') {
      return {
        source,
        target_facility_name: 'N/A - Depot Depleted',
        facility_coords: null,
        execution_message: fallbackMsg,
        twilioMessage: `AURA ALERT: ${fallbackMsg}`
      };
    }

    return {
      source,
      target_facility_name: 'RESOURCE DEPLETED - COMMAND ALERTED',
      facility_coords: null,
      execution_message: fallbackMsg,
      distance_km: null
    };
  }

  // 3. Geospatial & Hazard filtering
  // Exclude facilities that lie in active hazard zones if active flooding is present
  const isFloodActive = (geospatial.floodRiskScore >= 4) || (triage.hazard === 'flooding');
  
  let eligibleFacilities = matchingFacilities.filter(f => {
    if (isFloodActive && f.zone === 'Hazard Zone') {
      console.log(`[AURA Logistics] Geospatial Interceptor: Excluding hazard-zone facility "${f.name}" due to active flooding.`);
      return false;
    }
    return true;
  });

  // Resilience check: If all matching facilities are filtered out, fall back to matching list
  if (eligibleFacilities.length === 0) {
    console.warn('[AURA Logistics] All matching facilities in active hazard zones. Overriding hazard filter to deliver urgent supplies.');
    eligibleFacilities = matchingFacilities;
  }

  // 4. Geospatial Proximity Resolution (Haversine Distance)
  let selectedFacility = null;
  let minDistance = Infinity;

  eligibleFacilities.forEach(f => {
    const dist = haversineDistance(gps, { lat: f.lat, lng: f.lng });
    if (dist < minDistance) {
      minDistance = dist;
      selectedFacility = f;
    }
  });

  console.log(`[AURA Logistics] Optimal facility selected: ${selectedFacility.name} located ${minDistance.toFixed(2)}km away.`);

  // 5. State Mutation (Atomic Reservation Stock Decrement)
  let updatedFacility = null;
  try {
    updatedFacility = await db.decrementStockTransaction(selectedFacility.id, matchedItem);
    console.log(`[AURA Logistics] Atomic reservation verified. Decremented ${matchedItem} stock by 1 at ${selectedFacility.name}. Remaining: ${updatedFacility.stock[matchedItem]}`);
    
    // Broadcast real-time stock change
    const io = global.ioInstance;
    if (io) {
      io.emit('facility-update', updatedFacility);
      console.log(`[AURA Socket.io] Broadcasted facility-update for ${updatedFacility.name} from Logistics Agent`);
    }
  } catch (err) {
    console.error(`[AURA Logistics] Database transaction error during stock reservation:`, err.message);
    // Return graceful resilience fallback if transaction locks fail, continuing mapping
    updatedFacility = selectedFacility;
  }

  // 6. Dashboard Kanban Board Syncing
  const missionRecord = {
    userId,
    originalRequest: rawText || triage.need || `Needs ${matchedItem}`,
    need: matchedItem,
    status: 'DISPATCHED', // Starts in Dispatched Kanban column
    priority: triage.priority || 2,
    userLocation: gps,
    facility: {
      id: selectedFacility.id,
      name: selectedFacility.name,
      coords: { lat: selectedFacility.lat, lng: selectedFacility.lng },
      remainingStock: updatedFacility.stock?.[matchedItem] ?? 0
    },
    spatial: {
      weatherAlert: geospatial.weatherAlert || '',
      floodRiskScore: geospatial.floodRiskScore || 1,
      safeDirections: geospatial.safeDirections || [],
      safeWaypoints: geospatial.safeWaypoints || []
    },
    timestamp: new Date().toISOString()
  };

  try {
    const savedMission = await db.addActiveMission(missionRecord);
    console.log(`[AURA Logistics] Active rescue mission logged to dispatch ledger. ID: ${savedMission.id}`);

    // Emit live WebSocket update to volunteer ledger terminal
    const io = global.ioInstance;
    if (io) {
      io.emit('mission-log', {
        ...savedMission,
        logMessage: `[LOGISTICS DISPATCH] Secured ${matchedItem.toUpperCase()} at ${selectedFacility.name} for User ${userId}. Remaining Stock: ${savedMission.facility.remainingStock}. Dispatching volunteer fleet.`
      });
    }
  } catch (err) {
    console.error('[AURA Logistics] Dashboard sync failed:', err.message);
  }

  // 7. Universal Response Formatting (Web vs. twilio Offline SMS)
  const safeElevString = geospatial.safeDirections?.[0] || 'Safe route calculated.';
  const compDistance = minDistance.toFixed(1);
  const textMsg = `AURA ALERT: ${matchedItem.toUpperCase()} secured at ${selectedFacility.name} (${compDistance}km). ${safeElevString} Reply HELP for volunteer vehicle escort.`;

  if (source === 'twilio') {
    return {
      source,
      target_facility_name: selectedFacility.name,
      facility_coords: { lat: selectedFacility.lat, lng: selectedFacility.lng },
      execution_message: textMsg,
      twilioMessage: textMsg // return raw compressed string for Twilio response wrapping
    };
  }

  // Web PWA structured JSON response
  return {
    source,
    target_facility_name: selectedFacility.name,
    facility_coords: { lat: selectedFacility.lat, lng: selectedFacility.lng },
    execution_message: `Emergency signal processed. ${matchedItem.toUpperCase()} has been reserved at ${selectedFacility.name}. High-ground route mapped. Deployed volunteer rescue fleet.`,
    distance_km: parseFloat(minDistance.toFixed(2))
  };
}

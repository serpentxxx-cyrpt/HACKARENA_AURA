import express from 'express';
import { db as appDb } from '../config/db.js';
import admin from 'firebase-admin';

const router = express.Router();

// In-memory fallback for agent logs if Firestore unavailable
let localAgentLogs = [];

/**
 * POST /api/agent-log
 * Stores an Agent 2 routing decision log in Firestore `agent_audit_logs` collection.
 */
router.post('/agent-log', async (req, res) => {
  try {
    const {
      agentId = 'agent-2-geospatial',
      routeFrom,
      routeTo,
      selectedHospital,
      distanceKm,
      etaMinutes,
      speedKmh = 20,
      avoidedObstacles = [],
      weatherCondition,
      floodRiskScore,
      safeDirections = [],
      routeReasoning
    } = req.body || {};

    const logEntry = {
      agentId,
      routeFrom,
      routeTo,
      selectedHospital,
      distanceKm,
      etaMinutes,
      speedKmh,
      avoidedObstacles,
      weatherCondition,
      floodRiskScore,
      safeDirections,
      routeReasoning,
      timestamp: new Date().toISOString(),
      source: 'AURA_ROUTING_ENGINE'
    };

    console.log(`\n[AURA AGENT LOG] ==========================================`);
    console.log(`  AGENT ID       : ${logEntry.agentId}`);
    console.log(`  ROUTE           : ${JSON.stringify(logEntry.routeFrom)} → ${logEntry.selectedHospital}`);
    console.log(`  DISTANCE        : ${logEntry.distanceKm} km`);
    console.log(`  ETA             : ${logEntry.etaMinutes} min @ ${logEntry.speedKmh} km/h`);
    console.log(`  AVOIDED         : ${logEntry.avoidedObstacles.join(', ') || 'None'}`);
    console.log(`  WEATHER         : ${logEntry.weatherCondition} (Flood Risk: ${logEntry.floodRiskScore}/5)`);
    console.log(`  DIRECTIONS      : ${logEntry.safeDirections.join(' → ')}`);
    console.log(`  REASONING       : ${logEntry.routeReasoning || 'Standard routing'}`);
    console.log(`  TIMESTAMP       : ${logEntry.timestamp}`);
    console.log(`============================================================\n`);

    // Try Firestore first
    if (appDb.isOnline()) {
      try {
        const firestoreDb = admin.firestore();
        const docRef = await firestoreDb.collection('agent_audit_logs').add(logEntry);
        logEntry.id = docRef.id;
        console.log(`[AURA AGENT LOG] Stored in Firestore with ID: ${docRef.id}`);
      } catch (fsErr) {
        console.warn('[AURA AGENT LOG] Firestore write failed, falling back to memory:', fsErr.message);
        logEntry.id = `local-${Date.now()}`;
        localAgentLogs.push(logEntry);
      }
    } else {
      logEntry.id = `local-${Date.now()}`;
      localAgentLogs.push(logEntry);
      console.log('[AURA AGENT LOG] Stored in local memory (Firestore offline).');
    }

    // Emit to Socket.io for real-time UI updates on the HQ Ledger
    const io = req.app.get('io');
    if (io) {
      io.emit('agent-audit-log', {
        ...logEntry,
        logMessage: `[AGENT 2 ROUTING] Route to ${logEntry.selectedHospital} computed. Distance: ${logEntry.distanceKm}km, ETA: ${logEntry.etaMinutes}min @ ${logEntry.speedKmh}km/h. Avoided: ${logEntry.avoidedObstacles.join(', ') || 'None'}. Flood Risk: ${logEntry.floodRiskScore}/5.`
      });
    }

    return res.status(201).json(logEntry);
  } catch (error) {
    console.error('[AURA AGENT LOG] Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

/**
 * GET /api/agent-log
 * Retrieves all agent audit logs (newest first).
 */
router.get('/agent-log', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;

    if (appDb.isOnline()) {
      try {
        const firestoreDb = admin.firestore();
        const snap = await firestoreDb.collection('agent_audit_logs')
          .orderBy('timestamp', 'desc')
          .limit(limit)
          .get();
        const logs = [];
        snap.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));
        return res.status(200).json({ count: logs.length, logs });
      } catch (fsErr) {
        console.warn('[AURA AGENT LOG] Firestore read failed, using local:', fsErr.message);
      }
    }

    // Fallback to local memory
    const sorted = [...localAgentLogs].reverse().slice(0, limit);
    return res.status(200).json({ count: sorted.length, logs: sorted });
  } catch (error) {
    console.error('[AURA AGENT LOG] Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

export default router;

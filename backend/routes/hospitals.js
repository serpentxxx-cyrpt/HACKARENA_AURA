import express from 'express';
import { db } from '../config/db.js';

const router = express.Router();

/**
 * Haversine distance between two lat/lng coordinate pairs (in km).
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * GET /api/mock-nearest-hospitals?lat=...&lng=...&count=6
 * Returns the N nearest hospitals sorted by distance from the user's coordinates.
 */
router.get('/mock-nearest-hospitals', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const count = parseInt(req.query.count, 10) || 6;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        error: 'Missing or invalid lat/lng query parameters.',
        usage: '/api/mock-nearest-hospitals?lat=22.5186&lng=88.3712&count=6'
      });
    }

    console.log(`[AURA Hospitals] Finding ${count} nearest hospitals for (${lat}, ${lng})`);

    const dbFacilities = await db.getFacilities();

    const hospitalsWithDistance = dbFacilities.map(hospital => ({
      ...hospital,
      distanceKm: Math.round(haversineDistance(lat, lng, hospital.lat, hospital.lng) * 100) / 100,
      etaMinutes: Math.round((haversineDistance(lat, lng, hospital.lat, hospital.lng) / 20) * 60) // 20 km/h ambulance speed
    }));

    // Sort by distance ascending, take top N
    hospitalsWithDistance.sort((a, b) => a.distanceKm - b.distanceKm);
    const nearest = hospitalsWithDistance.slice(0, count);

    console.log(`[AURA Hospitals] Returning ${nearest.length} nearest hospitals. Closest: ${nearest[0]?.name} (${nearest[0]?.distanceKm} km)`);

    return res.status(200).json({
      userLocation: { lat, lng },
      count: nearest.length,
      ambulanceSpeedKmh: 20,
      hospitals: nearest
    });
  } catch (error) {
    console.error('[AURA Hospitals] Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

/**
 * PUT /api/hospitals/:id/stock
 * Manually override/update the stock levels for a hospital.
 */
router.put('/hospitals/:id/stock', async (req, res) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;

    if (!stock) {
      return res.status(400).json({ error: 'Missing stock object in body.' });
    }

    console.log(`[AURA Hospitals] Updating stock for facility ${id}:`, stock);
    const updatedHospital = await db.updateFacilityStock(id, stock);

    // Broadcast the stock change in real-time
    const io = req.app.get('io');
    if (io) {
      io.emit('facility-update', updatedHospital);
      console.log(`[AURA Socket.io] Broadcasted facility-update for ${updatedHospital.name}`);
    }

    return res.status(200).json({
      success: true,
      hospital: updatedHospital
    });
  } catch (error) {
    console.error('[AURA Hospitals] Error updating stock:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

export default router;

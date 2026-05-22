/**
 * Simple in-memory cache to store the last known GPS coordinates of AURA users.
 * Maps userId (e.g. phone number or PWA guest ID) to their last known GPS object { lat, lng }.
 */
const cache = new Map();

/**
 * Updates or stores the last known location of a user.
 * @param {string} userId 
 * @param {Object} gps - { lat, lng }
 */
export function updateLastKnownLocation(userId, gps) {
  if (!userId || !gps) return;
  const lat = parseFloat(gps.lat);
  const lng = parseFloat(gps.lng);
  
  if (!isNaN(lat) && !isNaN(lng)) {
    console.log(`[AURA LocationCache] Updating location for user ${userId}: LAT ${lat}, LNG ${lng}`);
    cache.set(userId, { lat, lng });
  }
}

/**
 * Retrieves the last known location of a user.
 * @param {string} userId 
 * @returns {Object|null} { lat, lng } or null if not in cache
 */
export function getLastKnownLocation(userId) {
  if (!userId) return null;
  const loc = cache.get(userId);
  if (loc) {
    console.log(`[AURA LocationCache] Found cached location for user ${userId}: LAT ${loc.lat}, LNG ${loc.lng}`);
    return loc;
  }
  return null;
}

/**
 * Lists all active cached locations (for administrative or debugging views).
 */
export function getAllCachedLocations() {
  return Object.fromEntries(cache.entries());
}

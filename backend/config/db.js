import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const JSON_DB_PATH = path.resolve('data/db.json');

// Global state variables
let isFirestoreOnline = false;
let firestoreDb = null;

// Initialize Firebase Admin SDK if credentials are present
try {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    // Clean escape characters in private key
    privateKey = privateKey.replace(/\\n/g, '\n');
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey
        })
      });
      console.log('[AURA DB] Firebase Admin SDK initialized successfully.');
    }
    
    firestoreDb = admin.firestore();
    // Test connection by fetching a dummy collection
    await firestoreDb.collection('facilities').limit(1).get();
    isFirestoreOnline = true;
    console.log('[AURA DB] Connected to Firebase Firestore successfully.');
  } else {
    console.warn('[AURA DB] Missing Firebase environment variables. Falling back to local JSON database.');
  }
} catch (err) {
  console.error('[AURA DB] Firebase initialization failed. Falling back to local JSON database. Error:', err.message);
  isFirestoreOnline = false;
  firestoreDb = null;
}

// Local JSON Database Helper functions
function readLocalDB() {
  try {
    if (!fs.existsSync(JSON_DB_PATH)) {
      // Re-create from default if somehow deleted
      const defaultData = { facilities: [], active_missions: [] };
      fs.writeFileSync(JSON_DB_PATH, JSON.stringify(defaultData, null, 2), 'utf-8');
      return defaultData;
    }
    const data = fs.readFileSync(JSON_DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('[AURA DB] Error reading local JSON DB:', err.message);
    return { facilities: [], active_missions: [] };
  }
}

function writeLocalDB(data) {
  try {
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[AURA DB] Error writing local JSON DB:', err.message);
  }
}

// Seeding engine to guarantee that both Firestore and Local DB have pre-populated inventories
async function seedDatabase() {
  const localData = readLocalDB();
  const defaultFacilities = localData.facilities || [];

  if (isFirestoreOnline && firestoreDb) {
    try {
      const snap = await firestoreDb.collection('facilities').get();
      if (snap.empty) {
        console.log('[AURA DB] Firestore "facilities" is empty. Seeding initial Kolkata assets...');
        const batch = firestoreDb.batch();
        for (const f of defaultFacilities) {
          const docRef = firestoreDb.collection('facilities').doc(f.id);
          batch.set(docRef, f);
        }
        await batch.commit();
        console.log('[AURA DB] Firestore "facilities" seeded successfully.');
      } else {
        console.log('[AURA DB] Firestore "facilities" already populated. Skipping seed.');
      }
    } catch (err) {
      console.error('[AURA DB] Seeding Firestore failed:', err.message);
    }
  } else {
    console.log('[AURA DB] Local database populated with', defaultFacilities.length, 'facilities. Seed verified.');
  }
}

// Run Seeding immediately on load
await seedDatabase().catch(err => console.error('[AURA DB] Auto-seed failed:', err));

/**
 * Unified Database Access Interface
 */
export const db = {
  isOnline: () => isFirestoreOnline,

  /**
   * Fetch all facilities carrying inventory.
   */
  getFacilities: async () => {
    if (isFirestoreOnline && firestoreDb) {
      const snap = await firestoreDb.collection('facilities').get();
      const list = [];
      snap.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      return list;
    } else {
      const local = readLocalDB();
      return local.facilities || [];
    }
  },

  /**
   * Add a new active mission log to the dispatch dashboard
   */
  addActiveMission: async (mission) => {
    const missionData = {
      ...mission,
      timestamp: mission.timestamp || new Date().toISOString()
    };

    if (isFirestoreOnline && firestoreDb) {
      const docRef = await firestoreDb.collection('active_missions').add(missionData);
      return { id: docRef.id, ...missionData };
    } else {
      const local = readLocalDB();
      const newMission = {
        id: `m-${Date.now()}`,
        ...missionData
      };
      local.active_missions.push(newMission);
      writeLocalDB(local);
      return newMission;
    }
  },

  /**
   * Get all active missions (useful for Volunteer Dashboard Kanban query)
   */
  getActiveMissions: async () => {
    if (isFirestoreOnline && firestoreDb) {
      const snap = await firestoreDb.collection('active_missions').orderBy('timestamp', 'desc').get();
      const list = [];
      snap.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      return list;
    } else {
      const local = readLocalDB();
      return local.active_missions || [];
    }
  },

  /**
   * Execute an atomic transaction to decrement stock of a specific item.
   * This operates either as a real firestore transaction or as a local file lock transaction!
   * 
   * @param {string} facilityId 
   * @param {string} item - e.g. 'insulin', 'oxygen', 'food'
   * @returns {Promise<Object>} The updated facility data
   */
  decrementStockTransaction: async (facilityId, item) => {
    if (isFirestoreOnline && firestoreDb) {
      const facilityRef = firestoreDb.collection('facilities').doc(facilityId);
      
      return await firestoreDb.runTransaction(async (transaction) => {
        const doc = await transaction.get(facilityRef);
        if (!doc.exists) {
          throw new Error(`Facility ${facilityId} does not exist in Firestore.`);
        }
        
        const data = doc.data();
        const currentStock = data.stock?.[item] ?? 0;
        if (currentStock <= 0) {
          throw new Error(`Stock depleted for ${item} at ${data.name}.`);
        }
        
        const updatedStock = {
          ...data.stock,
          [item]: currentStock - 1
        };
        
        transaction.update(facilityRef, { stock: updatedStock });
        return { id: doc.id, ...data, stock: updatedStock };
      });
    } else {
      // Synchronous Local File Transaction to prevent race conditions during MVPs
      const local = readLocalDB();
      const facility = local.facilities.find(f => f.id === facilityId);
      if (!facility) {
        throw new Error(`Facility ${facilityId} does not exist in local DB.`);
      }

      const currentStock = facility.stock?.[item] ?? 0;
      if (currentStock <= 0) {
        throw new Error(`Stock depleted for ${item} at ${facility.name}.`);
      }

      facility.stock[item] = currentStock - 1;
      writeLocalDB(local);
      
      console.log(`[LOCAL DB TRANSACTION] Decremented ${item} stock at ${facility.name}. New stock: ${facility.stock[item]}`);
      return facility;
    }
  },

  /**
   * Manually update the entire stock profile of a facility.
   * Useful for manual overrides in volunteer controls.
   */
  updateFacilityStock: async (facilityId, stock) => {
    if (isFirestoreOnline && firestoreDb) {
      const facilityRef = firestoreDb.collection('facilities').doc(facilityId);
      await facilityRef.update({ stock });
      const doc = await facilityRef.get();
      return { id: doc.id, ...doc.data() };
    } else {
      const local = readLocalDB();
      const facility = local.facilities.find(f => f.id === facilityId);
      if (!facility) {
        throw new Error(`Facility ${facilityId} does not exist in local DB.`);
      }
      facility.stock = { ...facility.stock, ...stock };
      writeLocalDB(local);
      console.log(`[LOCAL DB UPDATE] Updated stock at ${facility.name}:`, facility.stock);
      return facility;
    }
  }
};

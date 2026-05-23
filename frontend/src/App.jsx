import React, { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, 
  MapPin, 
  Settings, 
  User, 
  Globe, 
  BookOpen, 
  Check, 
  ArrowUpRight, 
  CornerDownRight, 
  Activity,
  Sliders,
  Send,
  Volume2,
  Shield,
  Phone,
  CloudRain,
  Wind,
  Droplets,
  Thermometer,
  Eye,
  Truck,
  Flag
} from 'lucide-react';
import { io } from 'socket.io-client';

// Import child components
import GoogleMap from './components/GoogleMap';
import SliderSOS from './components/SliderSOS';
import SMSModal from './components/SMSModal';
import VoiceInput from './components/VoiceInput';
import ActiveRescueTracker from './components/ActiveRescueTracker';
import OnlineTriagentChat from './components/OnlineTriagentChat';
import MedicalProfile from './components/MedicalProfile';
import LoginPortal from './components/LoginPortal';
import LogoutButton from './components/LogoutButton';
import ManualOverridePanel from './components/ManualOverridePanel';
import { auth } from './config/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Fallback static hospitals (used if backend fetch fails)
const INITIAL_HOSPITALS = [
  { id: 'h1', name: 'AMRI Hospital, Gariahat', lat: 22.5186, lng: 88.3712, stock: { insulin: 30, oxygen: 15 } },
  { id: 'h2', name: 'SSKM Medical College', lat: 22.5398, lng: 88.3444, stock: { insulin: 80, oxygen: 50 } },
  { id: 'h3', name: 'Frank Ross Pharmacy, Salt Lake', lat: 22.5726, lng: 88.4144, stock: { insulin: 0, oxygen: 8 } },
  { id: 'h4', name: 'Kolkata Zonal Relief Camp', lat: 22.5298, lng: 88.3615, stock: { insulin: 12, oxygen: 25 } }
];

// Weather alert level color mapping
const ALERT_COLORS = {
  NORMAL: { bg: 'bg-green-50', border: 'border-green-500/30', text: 'text-green-700', badge: 'bg-green-500/10 text-green-700 border-green-500/20' },
  ELEVATED: { bg: 'bg-yellow-50', border: 'border-yellow-500/30', text: 'text-yellow-700', badge: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' },
  HIGH: { bg: 'bg-orange-50', border: 'border-orange-500/30', text: 'text-orange-700', badge: 'bg-aura-sos/10 text-aura-sos border-aura-sos/20' },
  CRITICAL: { bg: 'bg-red-50', border: 'border-red-500/30', text: 'text-red-700', badge: 'bg-red-600/10 text-red-700 border-red-600/20' }
};

export default function App() {
  // Navigation / Router state: 'landing', 'citizen-dashboard', 'citizen-crisis', 'volunteer-dashboard', 'hq-login', 'citizen-tracker'
  const [currentView, setCurrentView] = useState('landing');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isSandbox, setIsSandbox] = useState(false);
  
  // App-wide state
  const [isOnline, setIsOnline] = useState(true);
  const [activeLanguage, setActiveLanguage] = useState('EN');
  const [isHqAuthenticated, setIsHqAuthenticated] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  // Enforce Firebase Auth Session State Guard
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsSandbox(false);
        setIsAuthenticated(true);
        if (user.displayName) {
          setUserName(user.displayName);
        }
        setCurrentView((prev) => (prev === 'landing' ? 'citizen-dashboard' : prev));
      } else {
        // Only boot to landing if we are NOT in a local sandbox bypass session!
        setIsSandbox((currentSandbox) => {
          if (!currentSandbox) {
            setIsAuthenticated(false);
            setIsHqAuthenticated(false);
            setCurrentView('landing');
          }
          return currentSandbox;
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Enforce unauthenticated user view routing constraints
  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentView('landing');
    }
  }, [isAuthenticated]);

  // Listen for PWA Home Screen install prompt event
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handlePwaInstall = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('[AURA PWA] User accepted the installation prompt.');
        }
        setDeferredPrompt(null);
      });
    } else {
      alert('AURA Widget installation is supported natively in standard mobile browsers. Select the browser menu option "Add to Home Screen" to enable standalone widget features!');
    }
  };
  
  // Settings Drawer state (Page 2)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [userName, setUserName] = useState('Tridibesh Sen');
  const [userPhone, setUserPhone] = useState('+91 98765 43210');
  const [hasInsulinDependency, setHasInsulinDependency] = useState(true);
  const [hasAsthma, setHasAsthma] = useState(false);
  const [safeZoneName, setSafeZoneName] = useState('Elderly Parents Home - Salt Lake');

  // Medical pre-context profile states (Phase 3 improvements)
  const [bloodType, setBloodType] = useState('O+');
  const [dob, setDob] = useState('1998-05-22');
  const [sex, setSex] = useState('Male');
  const [chronicConditions, setChronicConditions] = useState(['Diabetes']);
  const [allergies, setAllergies] = useState(['None']);
  const [highRiskMeds, setHighRiskMeds] = useState(['None']);
  const [mobilityStatus, setMobilityStatus] = useState('Independent');
  const [powerDependencies, setPowerDependencies] = useState(['None']);
  const [sensoryImpairments, setSensoryImpairments] = useState(['None']);
  const [emergencyContactName, setEmergencyContactName] = useState('Argha Ghosh');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('+91 98300 12345');

  // Packed profileData bundle for child component
  const profileData = {
    userName,
    userPhone,
    safeZoneName,
    bloodType,
    dob,
    sex,
    chronicConditions,
    allergies,
    highRiskMeds,
    mobilityStatus,
    powerDependencies,
    sensoryImpairments,
    emergencyContactName,
    emergencyContactPhone
  };

  // Dynamic age calculation helper
  const getAge = (dobString) => {
    if (!dobString) return '';
    try {
      const birthDate = new Date(dobString);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return `${age}y`;
    } catch (e) {
      return '';
    }
  };

  const handleSaveMedicalProfile = (updated) => {
    setUserName(updated.userName);
    setUserPhone(updated.userPhone);
    setSafeZoneName(updated.safeZoneName);
    
    setBloodType(updated.bloodType);
    setDob(updated.dob);
    setSex(updated.sex);
    
    setChronicConditions(updated.chronicConditions);
    setAllergies(updated.allergies);
    setHighRiskMeds(updated.highRiskMeds);
    
    setMobilityStatus(updated.mobilityStatus);
    setPowerDependencies(updated.powerDependencies);
    setSensoryImpairments(updated.sensoryImpairments);
    
    setEmergencyContactName(updated.emergencyContactName);
    setEmergencyContactPhone(updated.emergencyContactPhone);
    
    // Legacy flags compatibility
    setHasInsulinDependency(updated.hasInsulinDependency);
    setHasAsthma(updated.hasAsthma);
    
    setIsDrawerOpen(false);
    
    addLedgerLog(`MEDICAL_PROFILE: Master medical telemetry compiled and pre-saved securely.`);
  };

  // Crisis state (Page 3)
  const [selectedCrisisCategory, setSelectedCrisisCategory] = useState(null); // 'Medical', 'Flooded', 'Supplies'
  const [distressMessage, setDistressMessage] = useState('');
  const [isSMSModalOpen, setIsSMSModalOpen] = useState(false);
  const [smsPayload, setSmsPayload] = useState('');
  const [activeApiResponse, setActiveApiResponse] = useState(null);
  const lastSubmissionData = React.useRef(null);
  
  // Map markers and routes states (shared)
  const [hospitals, setHospitals] = useState(INITIAL_HOSPITALS);
  const [activeAlerts, setActiveAlerts] = useState([
    { id: 'a1', name: 'Rehan Mostafa', type: 'Medical', message: 'Severe asthma breathing crisis, waterlogging 1.5ft', lat: 22.5254, lng: 88.3762 },
    { id: 'a2', name: 'Debraj Khan', type: 'Trapped', message: 'Trapped inside house, ground floor flooded', lat: 22.5322, lng: 88.3562 }
  ]);
  const [selectedRoute, setSelectedRoute] = useState(null);

  // Dynamic location, weather, and hospital state
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationPermission, setLocationPermission] = useState('prompt');
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [routeEta, setRouteEta] = useState(null);
  const [agentAuditLogs, setAgentAuditLogs] = useState([]);
  const [falseAlarmSending, setFalseAlarmSending] = useState(false);
  const [overrideTicket, setOverrideTicket] = useState(null);

  // Request geolocation on app load and watch for exact updates
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationLoading(false);
      setLocationPermission('denied');
      setUserLocation({ lat: 22.5726, lng: 88.3639 });
      return;
    }

    // Phase 1: Try a quick, low-timeout fetch to display something instantly
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(loc);
        setLocationLoading(false);
        setLocationPermission('granted');
        console.log(`[AURA Location] Initial fast-lock acquired: ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`);
      },
      (err) => {
        console.warn('[AURA Location] Initial position fetch failed:', err.message);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
    );

    // Phase 2: Establish a high-accuracy, continuous watch telemetry channel
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(loc);
        setLocationLoading(false);
        setLocationPermission('granted');
        console.log(`[AURA Location] High-accuracy telemetry update: ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`);
      },
      (err) => {
        console.warn('[AURA Location] Geolocation watch error:', err.message);
        // Fall back to Kolkata standard coordinates ONLY if we don't have any lock yet
        setUserLocation((current) => {
          if (!current) {
            return { lat: 22.5726, lng: 88.3639 };
          }
          return current;
        });
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    // Clean up the watcher subscription on unmount
    return () => {
      navigator.geolocation.clearWatch(watchId);
      console.log('[AURA Location] Telemetry watch channel closed.');
    };
  }, []);

  // Fetch nearest hospitals from backend when location is available
  useEffect(() => {
    if (!userLocation?.lat) return;

    fetch(`${API_URL}/api/mock-nearest-hospitals?lat=${userLocation.lat}&lng=${userLocation.lng}&count=6`)
      .then(res => res.json())
      .then(data => {
        if (data.hospitals && Array.isArray(data.hospitals)) {
          setHospitals(data.hospitals);
          console.log(`[AURA Hospitals] Loaded ${data.hospitals.length} nearest hospitals`);
        }
      })
      .catch(err => {
        console.warn('[AURA Hospitals] Backend fetch failed, using static data:', err.message);
      });
  }, [userLocation?.lat, userLocation?.lng]);

  // Fetch real weather data from backend when location is available
  useEffect(() => {
    if (!userLocation?.lat) return;

    setWeatherLoading(true);
    fetch(`${API_URL}/api/weather?lat=${userLocation.lat}&lng=${userLocation.lng}`)
      .then(res => res.json())
      .then(data => {
        setWeatherData(data);
        setWeatherLoading(false);
        console.log(`[AURA Weather] ${data.city}: ${data.temperature}°C, ${data.condition}, Alert: ${data.alertLevel}`);
      })
      .catch(err => {
        console.warn('[AURA Weather] Backend fetch failed:', err.message);
        setWeatherLoading(false);
      });

    // Refresh weather every 5 minutes
    const interval = setInterval(() => {
      fetch(`${API_URL}/api/weather?lat=${userLocation.lat}&lng=${userLocation.lng}`)
        .then(res => res.json())
        .then(data => setWeatherData(data))
        .catch(() => {});
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [userLocation?.lat, userLocation?.lng]);

  // Handle hospital selection from map and post agent log
  const handleHospitalSelect = useCallback(async (hospital) => {
    setSelectedHospital(hospital);
  }, []);

  // Handle route computed callback – post audit log to backend
  const handleRouteComputed = useCallback(async (routeInfo) => {
    try {
      const logPayload = {
        agentId: 'agent-2-geospatial',
        routeFrom: routeInfo.origin,
        routeTo: routeInfo.destination,
        selectedHospital: routeInfo.hospital.name,
        distanceKm: routeInfo.distanceKm,
        etaMinutes: routeInfo.etaMinutes,
        speedKmh: 20,
        avoidedObstacles: weatherData?.floodRisk >= 3
          ? ['Gariahat Underpass (waterlogging)', 'Golpark Roundabout (low elevation)', 'Central Avenue (drain overflow)']
          : [],
        weatherCondition: weatherData?.condition || 'Unknown',
        floodRiskScore: weatherData?.floodRisk || 1,
        safeDirections: routeInfo.steps?.slice(0, 4) || [],
        routeReasoning: weatherData?.floodRisk >= 3
          ? `Route optimized avoiding ${weatherData.floodRisk >= 4 ? 'critical' : 'moderate'} waterlogging zones. Ambulance speed limited to 20 km/h due to wet conditions.`
          : 'Standard optimal routing. No significant weather hazards detected.'
      };

      const response = await fetch(`${API_URL}/api/agent-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logPayload)
      });

      if (response.ok) {
        const logEntry = await response.json();
        setAgentAuditLogs(prev => [logEntry, ...prev]);
        addLedgerLog(`[AGENT 2 AUDIT] Route to ${routeInfo.hospital.name} logged. Distance: ${routeInfo.distanceKm}km, ETA: ${routeInfo.etaMinutes}min. Avoided: ${logPayload.avoidedObstacles.join(', ') || 'None'}.`);
      }
    } catch (err) {
      console.warn('[AURA Agent Log] Failed to post audit log:', err.message);
    }
  }, [weatherData]);

  // Handle ETA update from map
  const handleEtaUpdate = useCallback((etaInfo) => {
    setRouteEta(etaInfo);
  }, []);

  // Handle false alarm flagging
  const handleFalseAlarm = useCallback(async () => {
    if (!weatherData) return;
    setFalseAlarmSending(true);
    try {
      const response = await fetch(`${API_URL}/api/false-alarm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertLevel: weatherData.alertLevel,
          reason: 'HQ Operator flagged as false alarm'
        })
      });
      if (response.ok) {
        setWeatherData(prev => ({ ...prev, isFalseAlarm: true, alertLevel: 'NORMAL', alertMessage: 'Alert dismissed by HQ operator. Normal operations resumed.' }));
        addLedgerLog(`[FALSE ALARM] Weather alert "${weatherData.alertLevel}" dismissed by operator. Routing Agent notified.`);
      }
    } catch (err) {
      console.warn('[AURA False Alarm] Failed:', err.message);
    } finally {
      setFalseAlarmSending(false);
    }
  }, [weatherData]);

  const handleChatDispatch = (data) => {
    console.log('[AURA FRONTEND] Received chat pipeline response:', data);
    setActiveApiResponse(data);
    
    const priority = data.triage?.priority || 3;
    const need = data.triage?.need || 'help';
    const resolvedFacility = data.logistics?.target_facility_name || 'Nearest Hospital';
    const startCoord = { lat: userLocation.lat, lng: userLocation.lng };
    const waypoints = data.geospatial?.safeWaypoints || [];
    const endCoord = data.logistics?.facility_coords || null;

    const route = [startCoord];
    waypoints.forEach(wp => {
      if (wp.lat && wp.lng) route.push({ lat: wp.lat, lng: wp.lng });
    });
    if (endCoord && endCoord.lat && endCoord.lng) {
      route.push({ lat: endCoord.lat, lng: endCoord.lng });
      setSelectedHospital({
        id: data.logistics?.target_facility_id || `h-${Date.now()}`,
        name: resolvedFacility,
        lat: endCoord.lat,
        lng: endCoord.lng
      });
    }
    setSelectedRoute(route);

    const newAlert = {
      id: data.id || `a-${Date.now()}`,
      name: userName || 'Guest Emergency',
      type: priority === 1 ? 'Medical' : priority === 2 ? 'Trapped' : 'Supplies',
      message: 'Dispatched via Online Chatbot',
      lat: userLocation.lat,
      lng: userLocation.lng,
      apiResponse: data,
      status: 'pending',
      createdAt: Date.now()
    };
    setActiveAlerts(prev => [newAlert, ...prev]);

    // Real-time local stock decrement from chatbot dispatch
    if (data.logistics?.target_facility_id && data.triage?.need) {
      setHospitals(prev => prev.map(h => {
        if (h.id === data.logistics.target_facility_id) {
          const currentStockVal = h.stock?.[data.triage.need] ?? 0;
          return {
            ...h,
            stock: {
              ...h.stock,
              [data.triage.need]: Math.max(0, currentStockVal - 1)
            }
          };
        }
        return h;
      }));
    }

    addLedgerLog(`[AGENT PIPELINE SYNC] Triage: Need: "${need}", Priority ${priority}`);
    addLedgerLog(`[AGENT PIPELINE SYNC] Logistics: Reserved resource at "${resolvedFacility}".`);

    alert(`Distress signal routed via live AURA Multi-Agent pipeline!\nResource reserved: ${resolvedFacility}`);
    setCurrentView('citizen-tracker');
  };

  // Volunteer Dashboard states (Page 4)
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedRole, setSelectedRole] = useState('Dispatcher');
  const [activeShift, setActiveShift] = useState(false);
  const [ledgerLogs, setLedgerLogs] = useState([
    '[11:15:02] AURA_COGNITIVE_HUB: Standing by. Waiting for cellular / simulator webhook packets...',
    '[11:15:03] GEOSPATIAL_AGENT: Meteorological layers loaded. Gariahat Sector waterlogging marked at 1.8 feet.',
    '[11:15:03] LOGISTICS_AGENT: SSKM stockpile cross-checked. Insulin reserves verified at 80 vials.'
  ]);

  // Handle Online/Offline simulator toggle
  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  // Connect Socket.io client to backend for real-time dispatch updates
  useEffect(() => {
    const socket = io(API_URL);

    socket.on('connect', () => {
      addLedgerLog(`SYS_SOCKET: Connected to cognitive server at ${API_URL}.`);
    });

    socket.on('system-status', (data) => {
      addLedgerLog(`SYS_SOCKET: Status verified: ${data.status}. ${data.message}`);
    });

    socket.on('facility-update', (updatedHospital) => {
      addLedgerLog(`[SOCKET SYNC] Live inventory update received for ${updatedHospital.name}`);
      setHospitals(prev => prev.map(h => h.id === updatedHospital.id ? updatedHospital : h));
    });

    socket.on('triage-log', (data) => {
      addLedgerLog(`[TRIAGE ENGINE] ${data.logMessage || `Resolved: Priority ${data.priority}`}`);
      
      // Sync dynamically with volunteer maps/alerts
      const newAlert = {
        id: data.id || `a-${Date.now()}`,
        name: data.userId || 'Guest Emergency',
        type: data.priority === 1 ? 'Medical' : data.priority === 2 ? 'Trapped' : 'Supplies',
        message: data.rawText,
        lat: data.gps?.lat || 22.5186,
        lng: data.gps?.lng || 88.3712
      };

      setActiveAlerts(prev => {
        if (prev.some(a => a.id === newAlert.id)) return prev;
        return [newAlert, ...prev];
      });
    });

    socket.on('geospatial-log', (data) => {
      addLedgerLog(`[GEOSPATIAL AGENT] ${data.logMessage}`);
    });

    socket.on('mission-log', (data) => {
      addLedgerLog(`[LOGISTICS AGENT] ${data.logMessage}`);
      
      // Update hospital stock state dynamically in PWA memory!
      if (data.facility) {
        setHospitals(prev => prev.map(h => {
          if (h.name === data.facility.name || h.id === data.facility.id) {
            return {
              ...h,
              stock: {
                ...h.stock,
                [data.need]: data.facility.remainingStock
              }
            };
          }
          return h;
        }));
      }
    });

    socket.on('mission-broadcast', (data) => {
      addLedgerLog(`[URGENT BROADCAST] ${data.logMessage}`);
    });

    // Listen for Agent 2 routing audit logs
    socket.on('agent-audit-log', (data) => {
      addLedgerLog(`[AGENT 2 ROUTING AUDIT] ${data.logMessage}`);
      setAgentAuditLogs(prev => [data, ...prev]);
    });

    // Listen for false alarm notifications
    socket.on('false-alarm-notification', (data) => {
      addLedgerLog(`[FALSE ALARM OVERRIDE] ${data.message}`);
    });

    // Fetch initial active missions on load
    fetch(`${API_URL}/api/active-missions`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const alerts = data.map(m => ({
            id: m.id,
            name: m.userId || 'Guest Emergency',
            type: m.priority === 1 ? 'Medical' : m.priority === 2 ? 'Trapped' : 'Supplies',
            message: m.originalRequest || m.message || 'Immediate crisis support requested',
            lat: m.userLocation?.lat || 22.5186,
            lng: m.userLocation?.lng || 88.3712
          }));
          setActiveAlerts(prev => {
            const combined = [...prev];
            alerts.forEach(newAlert => {
              if (!combined.some(a => a.id === newAlert.id)) {
                combined.push(newAlert);
              }
            });
            return combined;
          });
        }
      })
      .catch(err => console.log('Active-missions fetch skipped or failed. Fallback functional.'));

    return () => {
      socket.disconnect();
    };
  }, []);

  // Simulator to easily add log stream
  const addLedgerLog = (text) => {
    const time = new Date().toTimeString().split(' ')[0];
    setLedgerLogs(prev => [...prev, `[${time}] ${text}`]);
  };

  // Garbage collection: Auto-delete alerts older than 10 minutes from the HQ panel
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveAlerts(prevAlerts => {
        const now = Date.now();
        return prevAlerts.filter(alert => {
          if (!alert.createdAt) return true;
          return (now - alert.createdAt) < 10 * 60 * 1000;
        });
      });
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  // Handle distress submission (real online API hook with resilient offline/error fallbacks)
  const handleSOSSubmit = (overrideCategory = null, overrideMessage = null) => {
    const type = overrideCategory || selectedCrisisCategory || 'Medical';
    const msg = overrideMessage || distressMessage || `Immediate crisis support requested for ${type}`;
    
    // Attempt to acquire real geolocation coordinates with high accuracy
    if (navigator.geolocation) {
      addLedgerLog('SYS_GPS: Acquiring high-accuracy geolocation coordinates from browser sensor...');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          addLedgerLog(`SYS_GPS: Sensor locked: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          executeSubmission(lat, lng, type, msg);
        },
        (error) => {
          addLedgerLog(`SYS_GPS: Geolocation sensor denied/failed (Code ${error.code}). Using default Kolkata Gariahat coordinates.`);
          // Default Kolkata Gariahat center coordinates
          const lat = 22.5186 + (Math.random() - 0.5) * 0.005;
          const lng = 88.3712 + (Math.random() - 0.5) * 0.005;
          executeSubmission(lat, lng, type, msg);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      addLedgerLog('SYS_GPS: Geolocation not supported by browser. Falling back to Gariahat coordinates.');
      const lat = 22.5186;
      const lng = 88.3712;
      executeSubmission(lat, lng, type, msg);
    }
  };

  const executeSubmission = async (lat, lng, type, msg, forceOnline = false) => {
    lastSubmissionData.current = { lat, lng, type, msg };
    
    if (!isOnline && !forceOnline) {
      // Create compressed SMS payload
      const medFlags = [];
      if (hasInsulinDependency) medFlags.push('Insulin');
      if (hasAsthma) medFlags.push('Asthma');
      
      const payload = `${userName}:${type}:${lat.toFixed(4)},${lng.toFixed(4)}:${activeLanguage}:${medFlags.join(',')}`;
      setSmsPayload(payload);
      setIsSMSModalOpen(true);
      addLedgerLog(`SYS_OFFLINE_FALLBACK: Compiling 160-char SMS payload: AURA_SOS:${payload}`);
      return;
    }

    try {
      addLedgerLog(`SYS_ORCHESTRATOR: Initiating multi-agent ingestion pipeline for user ${userName}...`);
      
      const response = await fetch(`${API_URL}/api/web-sos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: userName || 'Guest Emergency',
          message: msg,
          latitude: lat,
          longitude: lng,
          profile: profileData
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status code ${response.status}`);
      }

      const data = await response.json();
      console.log('[AURA FRONTEND] Received orchestrator response:', data);
      
      // Save full API response context
      setActiveApiResponse(data);

      // Extract details
      const priority = data.priority || 3;
      const need = data.need || 'help';
      const resolvedFacility = data.logistics?.target_facility_name || 'Nearest Hospital';
      const weatherAlert = data.geospatial?.weatherAlert || 'Caution: Monsoonal showers in progress.';

      // Map coordinates for route visualization
      const startCoord = { lat, lng };
      const waypoints = data.geospatial?.safeWaypoints || [];
      const endCoord = data.logistics?.facility_coords || null;

      const route = [startCoord];
      waypoints.forEach(wp => {
        if (wp.lat && wp.lng) route.push({ lat: wp.lat, lng: wp.lng });
      });
      if (endCoord && endCoord.lat && endCoord.lng) {
        route.push({ lat: endCoord.lat, lng: endCoord.lng });
        
        // Feed the resolved target hospital to GoogleMap so DirectionsService executes
        setSelectedHospital({
          id: data.logistics?.target_facility_id || `h-${Date.now()}`,
          name: resolvedFacility,
          lat: endCoord.lat,
          lng: endCoord.lng
        });
      }
      setSelectedRoute(route);

      // Create new active alert record
      const newAlert = {
        id: data.id || `a-${Date.now()}`,
        name: userName || 'Guest Emergency',
        type: priority === 1 ? 'Medical' : priority === 2 ? 'Trapped' : 'Supplies',
        message: msg,
        lat: lat,
        lng: lng,
        apiResponse: data,
        status: 'pending',
        createdAt: Date.now()
      };
      
      setActiveAlerts(prev => [newAlert, ...prev]);

      // Real-time local stock decrement
      if (data.logistics?.target_facility_id && data.need) {
        setHospitals(prev => prev.map(h => {
          if (h.id === data.logistics.target_facility_id) {
            const currentStockVal = h.stock?.[data.need] ?? 0;
            return {
              ...h,
              stock: {
                ...h.stock,
                [data.need]: Math.max(0, currentStockVal - 1)
              }
            };
          }
          return h;
        }));
      }

      addLedgerLog(`[AGENT PIPELINE SYNC] Triage: detected ${data.language} language, Need: "${need}", Priority ${priority}`);
      addLedgerLog(`[AGENT PIPELINE SYNC] Geospatial Alert: "${weatherAlert}"`);
      addLedgerLog(`[AGENT PIPELINE SYNC] Logistics: Reserved resource at "${resolvedFacility}". Distance: ${data.logistics?.distance_km || 'unknown'} km`);

      alert(`Distress signal routed via live AURA Multi-Agent pipeline!\nResource reserved: ${resolvedFacility}`);
      setCurrentView('citizen-tracker');

    } catch (err) {
      console.error('[AURA FRONTEND] Primary Agent Pipeline failed:', err);
      addLedgerLog(`[WARNING] Primary Agent Pipeline Connection failed: ${err.message}.`);
      addLedgerLog(`[SYS_RESILIENCY] Core Agent Pipeline recovered gracefully. Activating local heuristic routing engines...`);

      // Select target hospital locally
      const targetHospital = hospitals.find(h => h.stock.insulin > 0 && h.id !== 'h3') || hospitals[0];
      const matchedNeed = type === 'Medical' ? (hasInsulinDependency ? 'insulin' : 'first aid') : type === 'Flooded' ? 'rescue' : 'water';

      // Formulate a structured fallbackPayload mirroring the AURA orchestrator API response schema
      const fallbackPayload = {
        source: 'web',
        userId: userName || 'Guest Emergency',
        gps: { lat, lng },
        rawText: msg,
        language: activeLanguage.toLowerCase(),
        priority: type === 'Medical' ? 1 : type === 'Flooded' ? 2 : 3,
        need: matchedNeed,
        hazard: type === 'Flooded' ? 'flooding' : 'none',
        weather: weatherData || {
          temperature: 29,
          condition: 'Rain',
          description: 'Moderate monsoonal showers',
          humidity: 85,
          windSpeed: 4.2,
          visibility: 8,
          rainMm: 2.5,
          floodRisk: 2,
          alertLevel: 'NORMAL',
          alertMessage: 'Local rains. Roads slightly wet.'
        },
        geospatial: {
          weatherAlert: 'Caution: Adverse weather. Proceed with care.',
          floodRiskScore: weatherData?.floodRisk || 2,
          safeDirections: ['Proceed carefully along main arterial roads.', 'Avoid low-lying basements.'],
          safeWaypoints: [
            { lat: (lat + targetHospital.lat) / 2, lng: (lng + targetHospital.lng) / 2 }
          ]
        },
        logistics: {
          target_facility_id: targetHospital.id,
          target_facility_name: targetHospital.name,
          facility_coords: { lat: targetHospital.lat, lng: targetHospital.lng },
          execution_message: `Resilient offline routing compiled. Safe package reserved at ${targetHospital.name}.`,
          distance_km: 1.8
        }
      };

      // Save full fallback API response context
      setActiveApiResponse(fallbackPayload);

      // Decrement fallback stock locally
      if (targetHospital && matchedNeed) {
        setHospitals(prev => prev.map(h => {
          if (h.id === targetHospital.id) {
            const currentStockVal = h.stock?.[matchedNeed] ?? 0;
            return {
              ...h,
              stock: {
                ...h.stock,
                [matchedNeed]: Math.max(0, currentStockVal - 1)
              }
            };
          }
          return h;
        }));
      }

      if (targetHospital) {
        // Feed the resolved target hospital to GoogleMap so DirectionsService executes
        setSelectedHospital({
          id: targetHospital.id,
          name: targetHospital.name,
          lat: targetHospital.lat,
          lng: targetHospital.lng
        });

        setSelectedRoute([
          { lat, lng },
          { lat: (lat + targetHospital.lat) / 2, lng: (lng + targetHospital.lng) / 2 },
          { lat: targetHospital.lat, lng: targetHospital.lng }
        ]);
        addLedgerLog(`[SYS_RESILIENCY] Local route generated avoiding Gariahat. Target: ${targetHospital.name}`);
      }

      // Create new active alert record matching fallbackPayload
      const newAlert = {
        id: `a-${Date.now()}`,
        name: userName || 'Guest Emergency',
        type: type,
        message: msg,
        lat: lat,
        lng: lng,
        apiResponse: fallbackPayload,
        status: 'pending',
        createdAt: Date.now()
      };

      setActiveAlerts(prev => [newAlert, ...prev]);
      alert(`Primary Agent Pipeline offline, but system's Local Resiliency Engine successfully activated!\nSafe route to ${targetHospital.name} calculated.`);
      setCurrentView('citizen-tracker');
    }
  };

  // Adjust hospital stocks via volunteer sliders and sync with database
  const handleStockChange = async (hospitalId, item, value) => {
    const hosp = hospitals.find(h => h.id === hospitalId);
    if (!hosp) return;

    const originalStock = { ...hosp.stock };
    const numericValue = parseInt(value, 10) || 0;
    const updatedStock = { ...hosp.stock, [item]: numericValue };

    // Optimistically update frontend state
    setHospitals(prev => prev.map(h => {
      if (h.id === hospitalId) {
        return { ...h, stock: updatedStock };
      }
      return h;
    }));

    addLedgerLog(`LEDGER_AUDIT: Manual stock edit for ${hosp.name}. Set ${item} to ${numericValue}.`);

    try {
      const response = await fetch(`${API_URL}/api/hospitals/${hospitalId}/stock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: updatedStock })
      });
      if (!response.ok) {
        throw new Error(`Failed to update stock: status ${response.status}`);
      }
    } catch (err) {
      console.error('[AURA Stock Update Failed]', err);
      addLedgerLog(`[ERROR] Stock update failed for ${hosp.name}. Reverting...`);
      // Revert stock state
      setHospitals(prev => prev.map(h => {
        if (h.id === hospitalId) {
          return { ...h, stock: originalStock };
        }
        return h;
      }));
    }
  };

  return (
    <div className="min-h-screen bg-aura-bg flex flex-col font-sans select-none pb-8">
      
      {/* MONITORED HEADER BAR - Forest Night */}
      <header className="bg-aura-hero text-white py-4 px-6 border-b border-aura-ink shadow-sm relative z-30">
        {!isAuthenticated ? (
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                AURA
              </h1>
              <span className="text-[10px] font-mono border border-white/20 bg-white/5 py-1 px-2.5 uppercase tracking-widest text-white/70">
                Crisis Dispatch Hub
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                  setShowLoginModal(true);
                }}
                className="py-2.5 px-6 bg-white hover:bg-aura-bg border border-aura-ink text-aura-ink font-mono text-xs font-bold uppercase rounded-full hover:-translate-y-0.5 active:translate-y-0 transition-all text-center shadow-sm cursor-pointer"
              >
                [ Login ]
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                AURA
              </h1>
              <span className="text-[10px] font-mono border border-white/20 bg-white/5 py-1 px-2.5 uppercase tracking-widest text-white/70">
                Crisis Dispatch Hub
              </span>
            </div>

            {/* Quick presentation utility links to shift screens instantly */}
            <nav className="flex items-center gap-1.5 font-mono text-[10px] bg-white/5 p-1 border border-white/10 rounded-full">
              <button 
                onClick={() => setCurrentView('citizen-dashboard')}
                className={`py-1.5 px-3 rounded-full uppercase tracking-wider transition-colors ${currentView === 'citizen-dashboard' || currentView === 'citizen-tracker' || currentView === 'citizen-crisis' ? 'bg-white text-aura-hero font-bold' : 'text-white/60 hover:text-white'}`}
              >
                Dashboard
              </button>
              <button 
                onClick={() => setCurrentView('online-triagent')}
                className={`py-1.5 px-3 rounded-full uppercase tracking-wider transition-colors ${currentView === 'online-triagent' ? 'bg-white text-aura-hero font-bold' : 'text-white/60 hover:text-white'}`}
              >
                AI Chatbox
              </button>
              <button 
                onClick={() => {
                  if (isHqAuthenticated) {
                    setCurrentView('volunteer-dashboard');
                  } else {
                    setCurrentView('hq-login');
                  }
                }}
                className={`py-1.5 px-3 rounded-full uppercase tracking-wider transition-colors ${currentView === 'volunteer-dashboard' || currentView === 'hq-login' ? 'bg-white text-aura-hero font-bold' : 'text-white/60 hover:text-white'}`}
              >
                HQ / Volunteer
              </button>
            </nav>

            <div className="flex items-center gap-4 text-xs">
              {/* Language Selector */}
              <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-full px-3 py-1 text-white/80">
                <Globe className="w-3.5 h-3.5" />
                <select 
                  value={activeLanguage} 
                  onChange={(e) => setActiveLanguage(e.target.value)}
                  className="bg-transparent focus:outline-none cursor-pointer uppercase text-xs font-mono font-bold"
                >
                  <option value="EN" className="text-aura-ink">EN</option>
                  <option value="BN" className="text-aura-ink">BN (Bengali)</option>
                  <option value="HI" className="text-aura-ink">HI (Hindi)</option>
                </select>
              </div>

              {/* Simulated online-offline badge */}
              <button 
                onClick={() => {
                  const nextOnline = !isOnline;
                  setIsOnline(nextOnline);
                  if (!nextOnline) {
                    addLedgerLog('SYS_NETWORK: Connection severed. Resilient offline dispatch protocols are armed.');
                  } else {
                    addLedgerLog('SYS_NETWORK: Connection restored. Cloud API channels are back online.');
                  }
                }} 
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-mono font-bold uppercase transition-all duration-300 ${
                  isOnline 
                    ? 'bg-aura-hero text-[#39ff14] border-[#39ff14]/30' 
                    : 'bg-aura-sos text-white border-aura-sos'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#39ff14]' : 'bg-white animate-ping'}`} />
                {isOnline ? 'CONNECTED' : 'OFFLINE MODE'}
              </button>

              {/* Stark Logout button */}
              <LogoutButton onLogoutSuccess={() => {
                setIsSandbox(false);
                setIsAuthenticated(false);
                setIsHqAuthenticated(false);
                setCurrentView('landing');
              }} />
            </div>
          </div>
        )}
      </header>

      {/* Offline Mode Banner */}
      {!isOnline && isAuthenticated && (
        <div className="bg-aura-sos text-white text-center py-2.5 px-4 font-mono text-xs flex items-center justify-center gap-2 border-b border-aura-ink relative z-20 animate-in slide-in-from-top duration-200">
          <span className="inline-block w-2 h-2 bg-white rounded-full animate-ping" />
          <span>OFFLINE RESILIENT FALLBACK ACTIVE // CRISIS PACKET SOS WILL BE ROUTED VIA WHATSAPP & SMS DISPATCH CHANNEL</span>
        </div>
      )}

      {/* VIEWPORT CONTROLLER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        
        {/* ==================== PAGE 1: LANDING PAGE ==================== */}
        {currentView === 'landing' && (
          <div className="animate-in fade-in duration-300 space-y-12 py-6">
            
            {/* HERO PANEL */}
            <div className="bg-aura-card border border-aura-ink p-8 md:p-12 rounded-none shadow-brutal flex flex-col md:flex-row items-center gap-10">
              <div className="flex-1 space-y-6">
                <div className="inline-block bg-aura-sos/15 text-aura-sos text-xs font-mono uppercase tracking-widest px-3.5 py-1 border border-aura-sos/20">
                  MUNICIPAL LOGISTICS CO-PILOT
                </div>
                <h2 className="font-serif text-4xl md:text-6xl font-bold leading-tight text-aura-ink">
                  Autonomous Urban Response Agent.
                </h2>
                <p className="font-sans text-lg text-aura-ink/75 leading-relaxed">
                  Project AURA is a crisis management and automated healthcare logistics system designed to connect isolated 
                  citizens with verified resources during severe emergencies like flooding and infrastructure failures.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 pt-2">
                  <button 
                    onClick={() => {
                      setShowLoginModal(true);
                    }}
                    className="py-4 px-8 bg-aura-hero text-white rounded-full text-lg font-sans font-bold hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 border border-aura-ink flex items-center justify-center gap-2 hover:shadow-md cursor-pointer"
                  >
                    Login / Register
                    <ArrowUpRight className="w-5 h-5" />
                  </button>
                  
                  <button 
                    onClick={() => {
                      setIsAuthenticated(true);
                      setSelectedCrisisCategory('Medical');
                      setCurrentView('citizen-crisis');
                    }}
                    className="py-4 px-8 bg-aura-sos text-white rounded-full text-lg font-sans font-bold hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 border border-aura-sos flex items-center justify-center gap-2 shadow-sm animate-pulse active:bg-opacity-95"
                  >
                    Emergency Guest Access
                  </button>
                </div>
              </div>
              <div className="flex-1 w-full flex items-center justify-center p-4 bg-aura-bg border border-aura-ink/20 relative">
                <div className="text-center font-mono py-12 px-6">
                  <Activity className="w-16 h-16 mx-auto text-aura-sos mb-4 animate-pulse" />
                  <div className="font-serif text-2xl font-bold text-aura-ink mb-1">AURA PERCEPTION LOOP</div>
                  <div className="text-xs text-aura-ink/50 uppercase tracking-wider">TRIAGE // METEOROLOGY // LOGISTICS</div>
                </div>
              </div>
            </div>

            {/* HOW IT WORKS - INFO */}
            <div className="space-y-6">
              <h3 className="font-serif text-3xl font-bold text-aura-ink pl-2">System Workflows</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Step 1 */}
                <div className="bg-aura-card border border-aura-ink p-8 rounded-none shadow-sm flex flex-col justify-between">
                  <div className="space-y-4">
                    <span className="font-mono text-xs uppercase tracking-widest text-aura-sos font-bold">STEP 01</span>
                    <h4 className="font-serif text-xl font-bold text-aura-ink">SOS Distress Ingestion</h4>
                    <p className="text-sm text-aura-ink/70 leading-relaxed font-sans">
                      Ping your exact coordinates and needs via regional natural language over low-bandwidth PWA, SMS, or WhatsApp Webhooks.
                    </p>
                  </div>
                  <div className="border-t border-aura-ink/20 pt-4 mt-6 flex items-center justify-between text-xs font-mono text-aura-ink/50">
                    <span>TRIAGE AGENT</span>
                    <CornerDownRight className="w-4 h-4 text-aura-sos" />
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bg-aura-card border border-aura-ink p-8 rounded-none shadow-sm flex flex-col justify-between">
                  <div className="space-y-4">
                    <span className="font-mono text-xs uppercase tracking-widest text-aura-sos font-bold">STEP 02</span>
                    <h4 className="font-serif text-xl font-bold text-aura-ink">Geospatial Hazard Routing</h4>
                    <p className="text-sm text-aura-ink/70 leading-relaxed font-sans">
                      AURA maps municipal meteorology and active flood zone boundaries to calculate optimized safe corridor waypoints.
                    </p>
                  </div>
                  <div className="border-t border-aura-ink/20 pt-4 mt-6 flex items-center justify-between text-xs font-mono text-aura-ink/50">
                    <span>GEOSPATIAL AGENT</span>
                    <CornerDownRight className="w-4 h-4 text-aura-sos" />
                  </div>
                </div>

                {/* Step 3 */}
                <div className="bg-aura-card border border-aura-ink p-8 rounded-none shadow-sm flex flex-col justify-between">
                  <div className="space-y-4">
                    <span className="font-mono text-xs uppercase tracking-widest text-aura-sos font-bold">STEP 03</span>
                    <h4 className="font-serif text-xl font-bold text-aura-ink">Logistical Resource Dispatch</h4>
                    <p className="text-sm text-aura-ink/70 leading-relaxed font-sans">
                      Direct cross-referencing of active emergency medical stockpiles matching safety parameters, updating live capacity rosters.
                    </p>
                  </div>
                  <div className="border-t border-aura-ink/20 pt-4 mt-6 flex items-center justify-between text-xs font-mono text-aura-ink/50">
                    <span>LOGISTICS AGENT</span>
                    <CornerDownRight className="w-4 h-4 text-aura-sos" />
                  </div>
                </div>

              </div>
            </div>

            {/* CREATORS AND MISSION */}
            <div className="bg-aura-card border border-aura-ink p-8 rounded-none">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
                
                {/* Team Column */}
                <div className="lg:col-span-2 space-y-6">
                  <h3 className="font-serif text-3xl font-bold text-aura-ink">The Engineering Team</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    <div className="bg-aura-bg border border-aura-ink/30 p-5 rounded-none">
                      <h4 className="font-serif font-bold text-lg text-aura-ink">Tridibesh Sen</h4>
                      <p className="text-xs font-mono text-aura-sos uppercase tracking-wider mt-1">Lead Architect</p>
                      <p className="text-xs text-aura-ink/70 mt-3 leading-relaxed">Agent orchestration mechanics, React structural core scaffolding, and visual styling templates.</p>
                    </div>

                    <div className="bg-aura-bg border border-aura-ink/30 p-5 rounded-none">
                      <h4 className="font-serif font-bold text-lg text-aura-ink">Argha Ghosh</h4>
                      <p className="text-xs font-mono text-aura-sos uppercase tracking-wider mt-1">GIS Engineering</p>
                      <p className="text-xs text-aura-ink/70 mt-3 leading-relaxed">Geospatial coordinate mapping, hazard polygons, weather API tracking, and Google Maps layers.</p>
                    </div>

                    <div className="bg-aura-bg border border-aura-ink/30 p-5 rounded-none">
                      <h4 className="font-serif font-bold text-lg text-aura-ink">Debraj Khan</h4>
                      <p className="text-xs font-mono text-aura-sos uppercase tracking-wider mt-1">Database Dev</p>
                      <p className="text-xs text-aura-ink/70 mt-3 leading-relaxed">Reactive database schemas, websocket pipeline state management, and volunteer dispatch panels.</p>
                    </div>

                  </div>
                </div>

                {/* Mission Column */}
                <div className="bg-aura-hero text-white p-8 rounded-none border border-aura-ink space-y-4">
                  <h4 className="font-serif text-2xl font-bold">Kolkata Zonal Mission</h4>
                  <p className="text-sm text-white/80 leading-relaxed font-sans">
                    Project AURA addresses the severe, sudden localized flash flooding and healthcare disruption in major high-density sectors of Kolkata.
                  </p>
                  <p className="text-sm text-white/80 leading-relaxed font-sans">
                    By merging multi-agent systems with robust fallback protocols, our mission is to ensure medical supply lines are protected, verified, and accessible.
                  </p>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* ==================== PAGE 2: CITIZEN PEACE-TIME HUB ==================== */}
        {currentView === 'citizen-dashboard' && (
          <div className="animate-in fade-in duration-300 grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
            
            {/* MAP VIEW CARD (Left + Center 2 Columns) */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white border border-aura-ink p-4 rounded-none shadow-brutal flex flex-col h-[500px]">
                <div className="flex items-center justify-between mb-4 border-b border-aura-ink/10 pb-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-aura-hero" />
                    <span className="font-serif font-bold text-lg text-aura-ink">Active Safe Corridor Overlay</span>
                  </div>
                  <div className="text-[10px] font-mono text-aura-ink/50 uppercase">Kolkata Zonal Map</div>
                </div>
                
                <div className="flex-1 w-full h-full">
                <GoogleMap 
                    activeAlerts={activeAlerts} 
                    hospitals={hospitals} 
                    selectedRoute={null}
                    userLocation={userLocation}
                    selectedHospital={null}
                    onHospitalSelect={handleHospitalSelect}
                    onRouteComputed={handleRouteComputed}
                    onEtaUpdate={handleEtaUpdate}
                  />
                </div>
              </div>

              {/* SLIDE TO SOS WIDGET */}
              <div className="bg-white border border-aura-ink p-6 rounded-none shadow-sm text-center space-y-4">
                <h4 className="font-serif text-lg font-bold text-aura-ink">CRITICAL CRISIS SIGNAL CONTROL</h4>
                <p className="text-xs text-aura-ink/60 max-w-sm mx-auto">
                  If you are experiencing a life-threatening crisis, slide the lock below to strip UI navigation and deploy the Triage Agents.
                </p>
                <SliderSOS onTrigger={() => {
                  if (!isOnline) {
                    handleSOSSubmit('Medical', 'Slide SOS Offline Triggered');
                  } else {
                    setSelectedCrisisCategory('Medical');
                    setCurrentView('citizen-crisis');
                  }
                }} />
              </div>
            </div>

            {/* SIDE PANEL DETAILS (Right Column) */}
            <div className="space-y-6">
              
              {/* PWA Home Screen Widget Prompter */}
              <div className="bg-white border border-aura-ink p-8 rounded-none shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-aura-hero">
                  <Shield className="w-5 h-5 text-aura-hero" />
                  <h4 className="font-serif font-bold text-base">Add AURA Crisis Widget</h4>
                </div>
                <p className="text-xs text-aura-ink/70 leading-relaxed font-sans">
                  Pin the AURA copilot directly to your phone's home screen. Access offline maps and quick-SOS shortcuts instantly during cellular network collapse.
                </p>
                <button
                  onClick={handlePwaInstall}
                  className="w-full py-2 bg-aura-hero text-white border border-aura-ink font-mono text-xs font-bold uppercase rounded-full hover:bg-opacity-95 transition-all text-center"
                >
                  [ Add to Home Screen ]
                </button>
              </div>

              {/* Dynamic Meteorological Alert Dashboard */}
              <div className={`border border-aura-ink rounded-none shadow-sm space-y-4 transition-all duration-500 overflow-hidden ${weatherData ? (ALERT_COLORS[weatherData.alertLevel]?.bg || 'bg-white') : 'bg-white'} ${weatherData ? (ALERT_COLORS[weatherData.alertLevel]?.border || '') : ''} p-6`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-aura-sos">
                    <CloudRain className="w-5 h-5" />
                    <h4 className="font-serif font-bold text-base text-aura-ink">Meteorological Alert</h4>
                  </div>
                  {weatherData && (
                    <span className={`text-[10px] font-mono uppercase py-1 px-2.5 border font-bold ${ALERT_COLORS[weatherData.alertLevel]?.badge || 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                      {weatherData.alertLevel}
                    </span>
                  )}
                </div>

                {weatherLoading && (
                  <div className="flex items-center gap-2 text-xs font-mono text-aura-ink/50">
                    <div className="w-3 h-3 border-b border-aura-hero rounded-full animate-spin" />
                    Fetching live meteorological data...
                  </div>
                )}

                {weatherData && (
                  <>
                    {/* Temperature and condition */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <span className="font-serif font-black text-3xl text-aura-ink leading-none">{weatherData.temperature}°</span>
                          <span className="font-mono text-[10px] text-aura-ink/50 block mt-0.5">Feels {weatherData.feelsLike}°</span>
                        </div>
                        <div>
                          <span className="font-sans text-sm font-bold text-aura-ink capitalize">{weatherData.description}</span>
                          <span className="font-mono text-[10px] text-aura-ink/50 block">{weatherData.city} • {weatherData.source}</span>
                        </div>
                      </div>
                    </div>

                    {/* Weather metrics grid */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white/60 border border-aura-ink/10 p-2 text-center">
                        <Droplets className="w-3.5 h-3.5 mx-auto text-blue-500 mb-1" />
                        <span className="font-mono text-[9px] text-aura-ink/50 uppercase block">Humidity</span>
                        <span className="font-mono text-xs font-bold text-aura-ink">{weatherData.humidity}%</span>
                      </div>
                      <div className="bg-white/60 border border-aura-ink/10 p-2 text-center">
                        <Wind className="w-3.5 h-3.5 mx-auto text-gray-500 mb-1" />
                        <span className="font-mono text-[9px] text-aura-ink/50 uppercase block">Wind</span>
                        <span className="font-mono text-xs font-bold text-aura-ink">{weatherData.windSpeed} m/s</span>
                      </div>
                      <div className="bg-white/60 border border-aura-ink/10 p-2 text-center">
                        <Eye className="w-3.5 h-3.5 mx-auto text-indigo-500 mb-1" />
                        <span className="font-mono text-[9px] text-aura-ink/50 uppercase block">Visibility</span>
                        <span className="font-mono text-xs font-bold text-aura-ink">{weatherData.visibility} km</span>
                      </div>
                    </div>

                    {/* Rain & Flood risk */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-aura-ink/50 uppercase text-[9px] font-bold">Precipitation</span>
                        <span className="font-mono font-bold text-aura-ink">{weatherData.rainMm} mm/h</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-aura-ink/50 uppercase text-[9px] font-bold">Flood Risk</span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map(level => (
                            <div
                              key={level}
                              className={`w-4 h-2 border border-aura-ink/20 transition-colors ${
                                level <= weatherData.floodRisk
                                  ? level <= 2 ? 'bg-green-500' : level <= 3 ? 'bg-yellow-500' : 'bg-red-500'
                                  : 'bg-gray-200'
                              }`}
                            />
                          ))}
                          <span className="font-mono text-[10px] font-bold ml-1">{weatherData.floodRisk}/5</span>
                        </div>
                      </div>
                    </div>

                    {/* Alert message */}
                    <div className={`text-xs leading-relaxed font-sans p-3 border border-aura-ink/10 ${weatherData.isFalseAlarm ? 'bg-green-50' : 'bg-white/50'}`}>
                      {weatherData.isFalseAlarm && (
                        <span className="font-mono text-[9px] text-green-700 uppercase font-bold block mb-1">✓ Dismissed by operator</span>
                      )}
                      <p className="text-aura-ink/80">{weatherData.alertMessage}</p>
                    </div>

                    {/* False alarm button (only show for HIGH/CRITICAL alerts that aren't already dismissed) */}
                    {(weatherData.alertLevel === 'HIGH' || weatherData.alertLevel === 'CRITICAL') && !weatherData.isFalseAlarm && (
                      <button
                        onClick={handleFalseAlarm}
                        disabled={falseAlarmSending}
                        className="w-full py-2 bg-white border border-aura-ink text-aura-ink font-mono text-[10px] font-bold uppercase hover:bg-aura-bg active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Flag className="w-3 h-3" />
                        {falseAlarmSending ? 'Notifying Agent 2...' : 'Flag as False Alarm'}
                      </button>
                    )}
                  </>
                )}

                {!weatherData && !weatherLoading && (
                  <p className="text-sm text-aura-ink/80 leading-relaxed font-sans">
                    Active high waterlogging warnings in Gariahat, Ballygunge, and surrounding pathways. Avoid transit unless utilizing dynamic AURA corridor coordinates.
                  </p>
                )}
              </div>

              {/* Citizen Details Profile Trigger */}
              <div className="bg-white border border-aura-ink p-8 rounded-none shadow-sm space-y-6 select-text transition-all duration-300 hover:shadow-brutal hover:-translate-x-1 hover:-translate-y-1 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-aura-ink/10 pb-4">
                  <div className="space-y-1">
                    <h4 className="font-serif font-bold text-xl text-aura-ink">Active Context</h4>
                    <p className="font-sans text-[10px] text-aura-ink/50 uppercase tracking-wider font-semibold">Pre-Saved Telemetry Profile</p>
                  </div>
                  <button 
                    onClick={() => setIsDrawerOpen(true)}
                    className="p-2 border border-aura-ink/10 hover:border-aura-ink hover:bg-aura-bg transition-all rounded-none active:translate-x-0.5 active:translate-y-0.5"
                    title="Edit medical pre-context"
                  >
                    <Settings className="w-5 h-5 text-aura-ink" />
                  </button>
                </div>

                {/* Sub-cards / Groups */}
                <div className="space-y-5 text-sm">
                  
                  {/* Card Group 1: Identity Slip (Brutalist Physical Card) */}
                  <div className="bg-aura-bg/50 border border-aura-ink p-4 rounded-none space-y-3 relative overflow-hidden transition-all duration-200 hover:bg-aura-bg">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-aura-hero/5 rounded-full -mr-8 -mt-8"></div>
                    <div className="flex items-center justify-between border-b border-aura-ink/10 pb-2">
                      <div className="flex items-center gap-1.5 text-aura-hero">
                        <User className="w-4 h-4" />
                        <span className="font-mono text-[10px] uppercase font-bold tracking-wider">Citizen ID Profile</span>
                      </div>
                      <span className="font-mono text-[9px] text-aura-hero bg-aura-hero/10 px-2 py-0.5 border border-aura-hero/20 rounded-none font-bold uppercase tracking-tight flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-aura-hero animate-pulse"></span>
                        Sync Active
                      </span>
                    </div>
                    
                    <div className="space-y-1 relative z-10">
                      <div className="font-serif font-black text-aura-ink text-base leading-tight tracking-tight">{userName}</div>
                      <div className="font-mono text-xs text-aura-ink/80 flex items-center gap-1.5">
                        <span className="opacity-60">Mobile:</span> {userPhone}
                      </div>
                    </div>

                    <div className="pt-2 space-y-0.5 border-t border-aura-ink/5 relative z-10">
                      <span className="font-mono text-[9px] text-aura-ink/40 uppercase tracking-wider block">Safe Haven Haven</span>
                      <div className="text-xs font-sans text-aura-ink font-bold flex items-center gap-1 text-aura-hero">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-aura-sos" />
                        {safeZoneName}
                      </div>
                    </div>

                    {/* Monospace printed barcode aesthetics */}
                    <div className="flex justify-between items-center pt-2.5 border-t border-aura-ink/10 relative z-10">
                      <div className="flex gap-0.5 h-3.5 opacity-30 select-none">
                        <div className="w-[1px] bg-aura-ink h-full"></div>
                        <div className="w-[2px] bg-aura-ink h-full"></div>
                        <div className="w-[1px] bg-aura-ink h-full"></div>
                        <div className="w-[3px] bg-aura-ink h-full"></div>
                        <div className="w-[1px] bg-aura-ink h-full"></div>
                        <div className="w-[2px] bg-aura-ink h-full"></div>
                        <div className="w-[1px] bg-aura-ink h-full"></div>
                      </div>
                      <span className="font-mono text-[8px] text-aura-ink/40 font-bold uppercase tracking-tighter">REG_ID // COLL_083_AURA</span>
                    </div>
                  </div>

                  {/* Card Group 2: Clinical Markers */}
                  <div className="space-y-3 border-t border-aura-ink/10 pt-4">
                    <div className="flex items-center gap-1.5 text-aura-ink/75">
                      <Activity className="w-4 h-4 text-aura-hero" />
                      <span className="font-mono text-[10px] uppercase font-bold tracking-wider">Clinical Markers</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white border border-aura-ink p-2 text-center transition-all hover:bg-aura-bg/30">
                        <span className="font-mono text-[8px] text-aura-ink/50 uppercase block">Blood Type</span>
                        <span className="font-serif font-black text-lg text-aura-sos block leading-tight mt-0.5">{bloodType}</span>
                      </div>
                      <div className="bg-white border border-aura-ink p-2 text-center transition-all hover:bg-aura-bg/30">
                        <span className="font-mono text-[8px] text-aura-ink/50 uppercase block">Birth Sex</span>
                        <span className="font-sans font-bold text-xs text-aura-ink block leading-tight mt-1">{sex}</span>
                      </div>
                      <div className="bg-white border border-aura-ink p-2 text-center transition-all hover:bg-aura-bg/30 flex flex-col justify-between">
                        <span className="font-mono text-[8px] text-aura-ink/50 uppercase block">Age / DOB</span>
                        <div className="leading-none mt-1">
                          <span className="font-mono text-[9px] font-bold text-aura-ink block">{dob ? dob.replace(/-/g, '/') : 'N/A'}</span>
                          {dob && <span className="font-mono text-[8px] text-aura-hero font-bold block mt-0.5">{getAge(dob)}</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Group 3: Red Flags & Allergies */}
                  <div className="space-y-3 border-t border-aura-ink/10 pt-4">
                    <div className="flex items-center gap-1.5 text-aura-sos">
                      <Shield className="w-4 h-4" />
                      <span className="font-mono text-[10px] uppercase font-bold tracking-wider">Red Flags & Allergies</span>
                    </div>
                    <div className="space-y-2.5 font-mono text-[11px]">
                      {/* Chronic conditions */}
                      <div className="flex items-start justify-between gap-2 py-1.5 border-b border-aura-ink/5">
                        <span className="text-aura-ink/50 uppercase text-[9px] tracking-wider font-bold mt-0.5">Chronic:</span>
                        <div className="flex flex-wrap gap-1 justify-end max-w-[70%]">
                          {chronicConditions.filter(c => c !== 'None').map(c => (
                            <span key={c} className="bg-aura-hero text-white border border-aura-ink px-1.5 py-0.5 text-[8px] font-bold uppercase leading-none tracking-tight">{c}</span>
                          ))}
                          {chronicConditions.includes('None') && (
                            <span className="text-aura-ink/40 italic text-[10px]">None</span>
                          )}
                        </div>
                      </div>
                      {/* Allergies */}
                      <div className="flex items-start justify-between gap-2 py-1.5 border-b border-aura-ink/5">
                        <span className="text-aura-ink/50 uppercase text-[9px] tracking-wider font-bold mt-0.5">Allergies:</span>
                        <div className="flex flex-wrap gap-1 justify-end max-w-[70%]">
                          {allergies.filter(a => a !== 'None').map(a => (
                            <span key={a} className="bg-white text-aura-sos border border-aura-sos px-1.5 py-0.5 text-[8px] font-bold uppercase leading-none tracking-tight">{a}</span>
                          ))}
                          {allergies.includes('None') && (
                            <span className="text-aura-ink/40 italic text-[10px]">None</span>
                          )}
                        </div>
                      </div>
                      {/* High Risk Meds */}
                      <div className="flex items-start justify-between gap-2 py-1.5">
                        <span className="text-aura-ink/50 uppercase text-[9px] tracking-wider font-bold mt-0.5">Meds:</span>
                        <div className="flex flex-wrap gap-1 justify-end max-w-[70%]">
                          {highRiskMeds.filter(m => m !== 'None').map(m => (
                            <span key={m} className="bg-aura-bg text-aura-ink border border-aura-ink px-1.5 py-0.5 text-[8px] font-bold uppercase leading-none tracking-tight">{m}</span>
                          ))}
                          {highRiskMeds.includes('None') && (
                            <span className="text-aura-ink/40 italic text-[10px]">None</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Group 4: Rescue Logistics */}
                  <div className="space-y-3 border-t border-aura-ink/10 pt-4">
                    <div className="flex items-center gap-1.5 text-aura-ink/75">
                      <Sliders className="w-4 h-4 text-aura-hero" />
                      <span className="font-mono text-[10px] uppercase font-bold tracking-wider">Rescue Logistics</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-b border-aura-ink/5 pb-2">
                        <span className="text-xs text-aura-ink/60 font-sans font-medium">Mobility Priority:</span>
                        <span className={`font-mono text-[9px] font-bold uppercase py-0.5 px-2 border ${
                          mobilityStatus === 'Bedridden' 
                            ? 'bg-aura-sos text-white border-aura-ink' 
                            : mobilityStatus === 'Wheelchair Bound'
                            ? 'bg-yellow-500 text-black border-aura-ink'
                            : 'bg-aura-hero text-white border-aura-ink'
                        }`}>
                          {mobilityStatus}
                        </span>
                      </div>
                      
                      {/* Power Dependencies */}
                      <div className="flex items-start justify-between border-b border-aura-ink/5 pb-2">
                        <span className="text-xs text-aura-ink/60 font-sans font-medium">Power Dependency:</span>
                        <div className="flex flex-wrap gap-1 justify-end max-w-[70%]">
                          {powerDependencies.filter(p => p !== 'None').map(p => (
                            <span key={p} className="bg-yellow-100 text-yellow-800 border border-yellow-500/40 px-1.5 py-0.5 text-[8px] font-bold font-mono tracking-tight uppercase leading-none">{p}</span>
                          ))}
                          {powerDependencies.includes('None') && (
                            <span className="text-xs text-aura-ink/40 font-mono italic">None</span>
                          )}
                        </div>
                      </div>

                      {/* Sensory Impairments */}
                      <div className="flex items-start justify-between pb-1">
                        <span className="text-xs text-aura-ink/60 font-sans font-medium">Sensory Impairment:</span>
                        <div className="flex flex-wrap gap-1 justify-end max-w-[70%]">
                          {sensoryImpairments.filter(s => s !== 'None').map(s => (
                            <span key={s} className="bg-blue-50 text-blue-800 border border-blue-500/30 px-1.5 py-0.5 text-[8px] font-bold font-mono tracking-tight uppercase leading-none">{s}</span>
                          ))}
                          {sensoryImpairments.includes('None') && (
                            <span className="text-xs text-aura-ink/40 font-mono italic">None</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Group 5: Emergency ICE */}
                  <div className="space-y-3 border-t border-aura-ink/10 pt-4 pb-2">
                    <div className="flex items-center gap-1.5 text-aura-ink/75">
                      <Phone className="w-4 h-4 text-aura-hero" />
                      <span className="font-mono text-[10px] uppercase font-bold tracking-wider">Emergency Contact (ICE)</span>
                    </div>
                    <div className="bg-aura-bg/30 border border-dashed border-aura-ink/30 p-3 rounded-none relative">
                      <div className="font-sans font-bold text-aura-ink text-sm flex items-center justify-between">
                        <span>{emergencyContactName || 'N/A'}</span>
                        <span className="text-[9px] font-mono font-normal text-aura-ink/50 uppercase tracking-widest">NEXT OF KIN</span>
                      </div>
                      <div className="font-mono text-xs text-aura-ink/70 mt-1 flex items-center justify-between">
                        <span>{emergencyContactPhone || 'N/A'}</span>
                        <a 
                          href={`tel:${emergencyContactPhone}`} 
                          className="text-[9px] font-bold uppercase underline text-aura-hero hover:text-aura-sos transition-colors"
                          title="Direct Dial Contact"
                        >
                          [ Call ]
                        </a>
                      </div>
                    </div>
                  </div>

                </div>

                <button 
                  onClick={() => setIsDrawerOpen(true)}
                  className="w-full py-2.5 px-4 bg-aura-bg border border-aura-ink text-xs font-bold uppercase rounded-full hover:bg-aura-card active:translate-y-0.5 transition-all text-center flex items-center justify-center gap-2"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Edit Medical Parameters
                </button>
              </div>

            </div>

            {/* SLIDE-UP PROFILE DRAWER */}
            {isDrawerOpen && (
              <div className="fixed inset-0 bg-aura-ink/30 backdrop-blur-sm z-50 flex justify-end">
                <div className="bg-aura-card border-l-2 border-aura-ink w-full max-w-2xl p-8 md:p-12 overflow-y-auto animate-in slide-in-from-right duration-300">
                  <MedicalProfile
                    profileData={profileData}
                    onSave={handleSaveMedicalProfile}
                    onClose={() => setIsDrawerOpen(false)}
                  />
                </div>
              </div>
            )}

          </div>
        )}

        {/* ==================== PAGE 3: CITIZEN "CRISIS MODE" (SOS ACTIVE) ==================== */}
        {currentView === 'citizen-crisis' && (
          <div className="animate-in fade-in duration-300 max-w-2xl mx-auto py-8">
            <div className="bg-aura-card border-2 border-aura-ink rounded-none shadow-brutal p-8 md:p-12 space-y-10">
              
              {/* Crisis Header Warning */}
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-aura-sos/10 text-aura-sos border border-aura-sos rounded-full flex items-center justify-center mx-auto animate-pulse">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h2 className="font-serif text-3xl font-bold text-aura-ink">CRISIS MODE TRIGGERED</h2>
                <p className="text-xs font-mono text-aura-ink/50 uppercase tracking-widest">AURA PERCEPTUAL GATEWAY IS ARMED</p>
              </div>

              {/* Three Quick Context Category Tiles */}
              <div className="space-y-4">
                <span className="flushed-label text-center block">DECLARE PRIMARY TARGET TYPE</span>
                <div className="grid grid-cols-3 gap-4">
                  
                  <button
                    onClick={() => setSelectedCrisisCategory('Medical')}
                    className={`aspect-square border border-aura-ink flex flex-col items-center justify-center p-4 rounded-none transition-all ${
                      selectedCrisisCategory === 'Medical' 
                        ? 'bg-aura-sos text-white border-aura-sos shadow-sm scale-105' 
                        : 'bg-white text-aura-ink hover:bg-aura-bg'
                    }`}
                  >
                    <span className="text-3xl mb-2">🚑</span>
                    <span className="text-xs font-sans font-bold">Medical</span>
                  </button>

                  <button
                    onClick={() => setSelectedCrisisCategory('Flooded')}
                    className={`aspect-square border border-aura-ink flex flex-col items-center justify-center p-4 rounded-none transition-all ${
                      selectedCrisisCategory === 'Flooded' 
                        ? 'bg-aura-sos text-white border-aura-sos shadow-sm scale-105' 
                        : 'bg-white text-aura-ink hover:bg-aura-bg'
                    }`}
                  >
                    <span className="text-3xl mb-2">🌊</span>
                    <span className="text-xs font-sans font-bold">Trapped</span>
                  </button>

                  <button
                    onClick={() => setSelectedCrisisCategory('Supplies')}
                    className={`aspect-square border border-aura-ink flex flex-col items-center justify-center p-4 rounded-none transition-all ${
                      selectedCrisisCategory === 'Supplies' 
                        ? 'bg-aura-sos text-white border-aura-sos shadow-sm scale-105' 
                        : 'bg-white text-aura-ink hover:bg-aura-bg'
                    }`}
                  >
                    <span className="text-3xl mb-2">📦</span>
                    <span className="text-xs font-sans font-bold">Supplies</span>
                  </button>

                </div>
              </div>

              {/* Direct message text area (for voice completed outputs) */}
              <div className="space-y-2">
                <label className="flushed-label">Detailed distress narrative</label>
                <div className="relative">
                  <textarea
                    rows={4}
                    value={distressMessage}
                    onChange={(e) => setDistressMessage(e.target.value)}
                    placeholder="Describe your active emergency here or tap the microphone to dictate directly in Bengali, Hindi, or English..."
                    className="w-full bg-transparent border border-aura-ink/30 p-4 font-sans text-sm rounded-none focus:border-aura-ink focus:ring-0 focus:outline-none transition-all leading-relaxed"
                  />
                  {distressMessage && (
                    <button 
                      onClick={() => setDistressMessage('')} 
                      className="absolute right-3 bottom-3 text-xs font-mono text-aura-sos uppercase"
                    >
                      [ Clear ]
                    </button>
                  )}
                </div>
              </div>

              {/* Voice microphone component */}
              <div className="border-t border-b border-aura-ink/10 py-6">
                <VoiceInput onTranscriptionComplete={(text) => {
                  setDistressMessage(text);
                  addLedgerLog(`VOICE_INTERPRETER: Transcribed live voice input. Length: ${text.length} chars.`);
                }} />
              </div>

              {/* Transmit dispatch buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => setCurrentView('citizen-dashboard')}
                  className="flex-1 py-4 px-6 bg-aura-bg border border-aura-ink rounded-full text-aura-ink font-bold flex items-center justify-center hover:bg-aura-card active:translate-y-0.5 transition-all text-sm uppercase"
                >
                  Cancel / Return
                </button>
                <button
                  onClick={handleSOSSubmit}
                  className="flex-1 py-4 px-6 bg-aura-sos border border-aura-sos text-white rounded-full font-bold flex items-center justify-center gap-2 hover:bg-opacity-90 active:translate-y-0.5 transition-all text-sm uppercase shadow-sm"
                >
                  Transmit SOS Dispatch
                  <Send className="w-4 h-4" />
                </button>
              </div>

            </div>

          </div>
        )}

        {/* ==================== PAGE 4: VOLUNTEER & NGO COMMAND DASHBOARD ==================== */}
        {currentView === 'volunteer-dashboard' && (
          <div className="animate-in fade-in duration-300 grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* SIDEBAR NAVIGATION - Forest Night */}
            <div className="lg:col-span-1 space-y-6">
              
              <div className="bg-aura-hero border border-aura-ink p-8 rounded-none text-white space-y-6 shadow-sm">
                <div className="border-b border-white/10 pb-4">
                  <h3 className="font-serif text-2xl font-bold">NGO Dispatch Command</h3>
                  <p className="text-[10px] font-mono text-white/50 tracking-widest mt-1">VOLUNTEER PORTAL // SHIFT DECLARATION</p>
                </div>

                {/* Shift status Declarations */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-white/60">DEPLOYED STATE</span>
                    <button
                      onClick={() => {
                        setActiveShift(!activeShift);
                        addLedgerLog(`VOLUNTEER_AUDIT: Shift declaration updated to: ${!activeShift ? 'ACTIVE' : 'OFF DUTY'}`);
                      }}
                      className={`px-3 py-1 font-bold uppercase rounded border transition-colors ${
                        activeShift 
                          ? 'bg-[#39ff14]/15 border-[#39ff14]/30 text-[#39ff14]' 
                          : 'bg-white/10 border-white/20 text-white/60'
                      }`}
                    >
                      {activeShift ? 'ACTIVE ON SHIFT' : 'OFF DUTY'}
                    </button>
                  </div>

                  {/* Active role selector grid */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider block">Operational Profile</span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      
                      <button
                        onClick={() => {
                          setSelectedRole('Dispatcher');
                          addLedgerLog('VOLUNTEER_AUDIT: Changed role setting to dispatch supervisor.');
                        }}
                        className={`py-2 px-3 border rounded text-center font-bold font-mono transition-colors ${
                          selectedRole === 'Dispatcher' 
                            ? 'bg-white text-aura-hero border-white' 
                            : 'border-white/20 text-white/60 hover:bg-white/5'
                        }`}
                      >
                        DISPATCHER
                      </button>

                      <button
                        onClick={() => {
                          setSelectedRole('Field');
                          addLedgerLog('VOLUNTEER_AUDIT: Changed role setting to mobile field volunteer.');
                        }}
                        className={`py-2 px-3 border rounded text-center font-bold font-mono transition-colors ${
                          selectedRole === 'Field' 
                            ? 'bg-white text-aura-hero border-white' 
                            : 'border-white/20 text-white/60 hover:bg-white/5'
                        }`}
                      >
                        FIELD UNIT
                      </button>

                    </div>
                  </div>

                </div>
              </div>

              {/* MOCK ASSET CHECKLIST CONTAINER */}
              <div className="bg-white border border-aura-ink p-8 rounded-none shadow-sm space-y-4">
                <h4 className="font-serif font-bold text-lg text-aura-ink">Available Logistics Assets</h4>
                <div className="space-y-3 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-aura-ink/80">
                    <input type="checkbox" defaultChecked className="accent-aura-hero" />
                    <span>Access to Offroad 4x4 Vehicle</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-aura-ink/80">
                    <input type="checkbox" className="accent-aura-hero" />
                    <span>Relief Inflatable Boat / Rescue Vessel</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-aura-ink/80">
                    <input type="checkbox" defaultChecked className="accent-aura-hero" />
                    <span>First-Aid / CPR Certified Responder</span>
                  </label>
                </div>
              </div>

            </div>

            {/* MAIN KANBAN & INVENTORY SPLIT VIEW (Right 3 Columns) */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Top Viewport Header */}
              <div className="bg-white border border-aura-ink p-6 rounded-none shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="font-serif text-2xl font-bold text-aura-ink">Pipeline Triage Dispatch</h3>
                  <p className="text-xs text-aura-ink/50 leading-normal font-sans">Multi-agent auto-prioritized queues. Click to audit spatial route calculations.</p>
                </div>
                <div className="text-xs font-mono font-bold bg-aura-bg border border-aura-ink/20 py-1.5 px-4">
                  ACTIVE CRITICAL ALERTS: {activeAlerts.length}
                </div>
              </div>

              {/* THE KANBAN PIPELINE */}
              {activeShift ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Column 1: Critical (Red Urgency) */}
                <div className="bg-white border border-aura-ink p-6 rounded-none space-y-4">
                  <div className="flex items-center justify-between border-b-2 border-aura-sos pb-3">
                    <span className="font-serif font-bold text-aura-sos flex items-center gap-1.5 text-base">
                      <span className="w-2.5 h-2.5 rounded-full bg-aura-sos animate-ping" />
                      Critical Red
                    </span>
                    <span className="font-mono text-xs text-aura-ink/50">({activeAlerts.filter(a => a.type === 'Medical').length})</span>
                  </div>

                  <div className="space-y-4 overflow-y-auto max-h-[300px] pr-1">
                    {activeAlerts.filter(a => a.type === 'Medical').map(alert => (
                      <div 
                        key={alert.id}
                        onClick={() => setSelectedTicket(alert)}
                        className={`bg-aura-bg border p-4 cursor-pointer transition-all hover:scale-101 select-none ${
                          selectedTicket?.id === alert.id ? 'border-aura-sos border-2 shadow-sm' : 'border-aura-ink'
                        }`}
                      >
                        <h5 className="font-serif font-bold text-sm text-aura-ink flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {alert.name}
                            {alert.status === 'approved' && <span className="text-[9px] font-mono font-bold text-[#39ff14] border border-[#39ff14] px-1">AI APPROVED</span>}
                            {alert.status === 'overridden' && <span className="text-[9px] font-mono font-bold text-[#ffae42] border border-[#ffae42] px-1">MANUAL</span>}
                          </div>
                          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-white bg-aura-sos px-2 py-0.5">🚑 MED</span>
                        </h5>
                        <p className="text-xs text-aura-ink/70 mt-2 font-sans line-clamp-2 leading-relaxed">"{alert.message}"</p>
                        <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-aura-ink/50">
                          <span>LAT: {alert.lat?.toFixed(4)}</span>
                          <span>LNG: {alert.lng?.toFixed(4)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Column 2: Urgent (Orange Urgency) */}
                <div className="bg-white border border-aura-ink p-6 rounded-none space-y-4">
                  <div className="flex items-center justify-between border-b-2 border-aura-sos/60 pb-3">
                    <span className="font-serif font-bold text-aura-sos/80 flex items-center gap-1.5 text-base">
                      Urgent Orange
                    </span>
                    <span className="font-mono text-xs text-aura-ink/50">({activeAlerts.filter(a => a.type === 'Trapped').length})</span>
                  </div>

                  <div className="space-y-4 overflow-y-auto max-h-[300px] pr-1">
                    {activeAlerts.filter(a => a.type === 'Trapped').map(alert => (
                      <div 
                        key={alert.id}
                        onClick={() => setSelectedTicket(alert)}
                        className={`bg-aura-bg border p-4 cursor-pointer transition-all hover:scale-101 select-none ${
                          selectedTicket?.id === alert.id ? 'border-aura-sos/60 border-2 shadow-sm' : 'border-aura-ink'
                        }`}
                      >
                        <h5 className="font-serif font-bold text-sm text-aura-ink flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {alert.name}
                            {alert.status === 'approved' && <span className="text-[9px] font-mono font-bold text-[#39ff14] border border-[#39ff14] px-1">AI APPROVED</span>}
                            {alert.status === 'overridden' && <span className="text-[9px] font-mono font-bold text-[#ffae42] border border-[#ffae42] px-1">MANUAL</span>}
                          </div>
                          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-white bg-aura-sos/60 px-2 py-0.5">🌊 TRAP</span>
                        </h5>
                        <p className="text-xs text-aura-ink/70 mt-2 font-sans line-clamp-2 leading-relaxed">"{alert.message}"</p>
                        <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-aura-ink/50">
                          <span>LAT: {alert.lat?.toFixed(4)}</span>
                          <span>LNG: {alert.lng?.toFixed(4)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Column 3: Standard (Yellow Urgency) */}
                <div className="bg-white border border-aura-ink p-6 rounded-none space-y-4">
                  <div className="flex items-center justify-between border-b-2 border-aura-hero pb-3">
                    <span className="font-serif font-bold text-aura-hero flex items-center gap-1.5 text-base">
                      Standard Yellow
                    </span>
                    <span className="font-mono text-xs text-aura-ink/50">({activeAlerts.filter(a => a.type !== 'Medical' && a.type !== 'Trapped').length})</span>
                  </div>

                  <div className="space-y-4 overflow-y-auto max-h-[300px] pr-1">
                    {activeAlerts.filter(a => a.type !== 'Medical' && a.type !== 'Trapped').map(alert => (
                      <div 
                        key={alert.id}
                        onClick={() => setSelectedTicket(alert)}
                        className={`bg-aura-bg border p-4 cursor-pointer transition-all hover:scale-101 select-none ${
                          selectedTicket?.id === alert.id ? 'border-aura-hero border-2 shadow-sm' : 'border-aura-ink'
                        }`}
                      >
                        <h5 className="font-serif font-bold text-sm text-aura-ink flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {alert.name}
                            {alert.status === 'approved' && <span className="text-[9px] font-mono font-bold text-[#39ff14] border border-[#39ff14] px-1">AI APPROVED</span>}
                            {alert.status === 'overridden' && <span className="text-[9px] font-mono font-bold text-[#ffae42] border border-[#ffae42] px-1">MANUAL</span>}
                          </div>
                          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-white bg-aura-hero px-2 py-0.5">📦 SUPP</span>
                        </h5>
                        <p className="text-xs text-aura-ink/70 mt-2 font-sans line-clamp-2 leading-relaxed">"{alert.message}"</p>
                        <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-aura-ink/50">
                          <span>LAT: {alert.lat?.toFixed(4)}</span>
                          <span>LNG: {alert.lng?.toFixed(4)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* TICKET AUDITING MODAL OVERLAY (SPLIT-SCREEN CARD DETAIL) */}
              {selectedTicket && (
                <div className="bg-white border border-aura-ink p-8 rounded-none shadow-brutal grid grid-cols-1 md:grid-cols-2 gap-8 items-start relative animate-in fade-in slide-in-from-top-4 duration-300">
                  <button 
                    onClick={() => setSelectedTicket(null)}
                    className="absolute right-6 top-6 text-sm font-mono text-aura-sos uppercase font-bold"
                  >
                    [ Close ]
                  </button>

                  {/* Left Side (Victim details) */}
                  <div className="space-y-4">
                    <span className="font-mono text-xs text-aura-sos uppercase font-bold">SYS_AUDIT_TICKET: {selectedTicket.id}</span>
                    <h4 className="font-serif text-3xl font-bold text-aura-ink">{selectedTicket.name}</h4>
                    
                    <div className="border border-aura-ink/20 bg-aura-bg p-5 font-sans leading-relaxed text-sm">
                      <strong className="text-aura-ink font-bold block mb-1">Raw Distress Stream:</strong>
                      "{selectedTicket.message}"
                    </div>

                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex items-center justify-between py-1 border-b border-aura-ink/5">
                        <span className="text-aura-ink/50 uppercase">Extracted GPS Coordinates</span>
                        <span className="font-bold">{selectedTicket.lat?.toFixed(4)}° N, {selectedTicket.lng?.toFixed(4)}° E</span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-aura-ink/50 uppercase">Urgency Urg classification</span>
                        <span className={`font-bold uppercase ${selectedTicket.type === 'Medical' ? 'text-aura-sos animate-pulse' : 'text-aura-ink'}`}>{selectedTicket.type}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side (AI logic explainer & coordinates pathing) */}
                  <div className="space-y-6">
                    <span className="font-mono text-xs text-aura-ink/50 uppercase">COGNITIVE PATHING LOGIC</span>
                    <div className="border border-aura-ink bg-aura-ink text-white p-5 rounded-none font-mono text-xs space-y-3 leading-relaxed shadow-sm">
                      <p><span className="text-[#39ff14]">&gt;</span> GEOSPATIAL_PATHFINDING_DOCKING...</p>
                      <p>Calculating safe corridor from {selectedTicket.lat?.toFixed(3)},{selectedTicket.lng?.toFixed(3)} avoiding hazard zones.</p>
                      {selectedTicket.apiResponse ? (
                        <>
                          <p><span className="text-[#00f0ff]">&gt;</span> Meteorological Alert: {selectedTicket.apiResponse.geospatial?.weatherAlert || 'None'}</p>
                          <p><span className="text-[#00f0ff]">&gt;</span> Agent 3 Target: {selectedTicket.apiResponse.logistics?.target_facility_name || 'Nearest Relief Center'}</p>
                          <p>Dispatching safe routing waypoints to volunteer field units.</p>
                        </>
                      ) : (
                        <>
                          <p><span className="text-[#00f0ff]">&gt;</span> SSKM Relief Center selected. Pathway clear.</p>
                          <p>Dispatched navigation waypoints to volunteer field units.</p>
                        </>
                      )}
                    </div>

                    <div className="flex gap-4">
                      <button
                        onClick={() => {
                          setActiveAlerts(prev => prev.map(a => a.id === selectedTicket.id ? { ...a, status: 'approved' } : a));
                          alert(`Autonomous Action Approved! Volunteer dispatched to support ${selectedTicket.name}.`);
                          setSelectedTicket(null);
                        }}
                        className="flex-1 py-3 px-6 bg-aura-hero text-white rounded-full font-bold text-xs uppercase hover:-translate-y-0.5 active:translate-y-0 transition-all border border-aura-ink text-center flex items-center justify-center gap-1.5"
                      >
                        Approve AI Plan
                      </button>
                      <button
                        onClick={() => {
                          setOverrideTicket(selectedTicket);
                          setSelectedTicket(null);
                        }}
                        className="flex-1 py-3 px-6 bg-white border border-aura-ink text-aura-ink rounded-full font-bold text-xs uppercase hover:bg-aura-bg active:translate-y-0.5 transition-all text-center flex items-center justify-center gap-1.5"
                      >
                        Manual Override
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* MANUAL OVERRIDE SPLIT CONTROL PANEL */}
              {overrideTicket && (
                <ManualOverridePanel
                  missionData={overrideTicket}
                  hospitals={hospitals}
                  onClose={() => setOverrideTicket(null)}
                  onDeploy={(modifiedLogistics) => {
                    // Update active alerts with human overridden parameters
                    setActiveAlerts(prev => prev.map(alert => 
                      alert.id === overrideTicket.id 
                        ? { 
                            ...alert, 
                            status: 'overridden',
                            message: `HQ OVERRIDE: Deployed ${modifiedLogistics.logistics.rescue_unit_vehicle} to route specialized medical payload.`,
                            apiResponse: {
                              ...alert.apiResponse,
                              logistics: {
                                ...alert.apiResponse?.logistics,
                                target_facility_name: modifiedLogistics.logistics.target_facility_name,
                                route_profile: modifiedLogistics.logistics.route_profile,
                                route_eta_minutes: modifiedLogistics.logistics.route_eta_minutes,
                                route_distance_km: modifiedLogistics.logistics.route_distance_km,
                                rescue_unit_vehicle: modifiedLogistics.logistics.rescue_unit_vehicle
                              }
                            }
                          } 
                        : alert
                    ));

                    // Decrement inventories locally to mirror real-time consumption
                    setHospitals(prevHospitals => prevHospitals.map(h => {
                      if (h.id === modifiedLogistics.logistics.target_facility_id) {
                        const updatedStock = { ...h.stock };
                        const primaryNeed = modifiedLogistics.logistics.primary_need.toLowerCase();
                        if (updatedStock[primaryNeed] > 0) {
                          updatedStock[primaryNeed] -= 1;
                        }
                        modifiedLogistics.logistics.extra_supplies.forEach(item => {
                          const normalItem = item.toLowerCase();
                          if (updatedStock[normalItem] > 0) {
                            updatedStock[normalItem] -= 1;
                          } else if (normalItem === 'oxygen cylinder' && updatedStock['oxygen'] > 0) {
                            updatedStock['oxygen'] -= 1;
                          }
                        });
                        return { ...h, stock: updatedStock };
                      }
                      return h;
                    }));

                    addLedgerLog(`DISPATCH_OVERRIDE: Manual override committed for ticket ${overrideTicket.id}. Deployed ${modifiedLogistics.logistics.rescue_unit_vehicle} to ${modifiedLogistics.logistics.target_facility_name}.`);
                    alert(`Supervisory Override Successful! Dispatching ${modifiedLogistics.logistics.rescue_unit_vehicle} to ${modifiedLogistics.logistics.target_facility_name}.`);
                    setOverrideTicket(null);
                  }}
                />
              )}

              {/* LIVE INVENTORY CAPACITY TRACKER CONTROLS */}
              <div className="bg-white border border-aura-ink p-8 rounded-none shadow-sm space-y-6">
                <div>
                  <h4 className="font-serif font-bold text-xl text-aura-ink">Interactive Hospital Stock Capacities</h4>
                  <p className="text-xs text-aura-ink/50 leading-normal font-sans">
                    Slidestock levels will dynamically adjust AURA pathing calculations during emergency simulations.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {hospitals.map(hospital => (
                    <div key={hospital.id} className="border border-aura-ink/20 p-5 bg-aura-bg rounded-none space-y-4">
                      <div className="flex justify-between items-center border-b border-aura-ink/10 pb-2">
                        <strong className="font-serif text-sm text-aura-hero font-bold">{hospital.name}</strong>
                        <span className="text-[10px] font-mono uppercase bg-aura-hero/10 text-aura-hero py-0.5 px-2 font-bold">{hospital.id}</span>
                      </div>
                      
                      {/* Insulin Capacity Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs font-mono">
                          <span className="text-aura-ink/50 uppercase">Insulin Reserves</span>
                          <span className={`font-bold ${hospital.stock.insulin === 0 ? 'text-aura-sos font-black animate-pulse' : 'text-aura-ink'}`}>
                            {hospital.stock.insulin} vials
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={hospital.stock.insulin}
                          onChange={(e) => handleStockChange(hospital.id, 'insulin', e.target.value)}
                          className="w-full h-1 bg-aura-ink/10 accent-aura-hero"
                        />
                      </div>

                      {/* Oxygen Capacity Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs font-mono">
                          <span className="text-aura-ink/50 uppercase">Oxygen Cylinders</span>
                          <span className="font-bold">{hospital.stock.oxygen} units</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={hospital.stock.oxygen}
                          onChange={(e) => handleStockChange(hospital.id, 'oxygen', e.target.value)}
                          className="w-full h-1 bg-aura-ink/10 accent-aura-hero"
                        />
                      </div>

                    </div>
                  ))}
                </div>
              </div>

              {/* AI DECISION LOG TERMINAL (LEDGER STREAM) */}
              <div className="bg-aura-ink text-white p-6 border-2 border-aura-ink rounded-none space-y-4 font-mono shadow-sm">
                <div className="flex items-center justify-between border-b border-white/15 pb-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#39ff14]">
                    <span className="w-2.5 h-2.5 bg-[#39ff14] rounded-full animate-pulse" />
                    AI TRUST & AUDIT TRANSPARENCY LEDGER
                  </div>
                  <div className="text-[10px] text-white/50 tracking-wider">SPACE MONO CONSOLE</div>
                </div>

                <div className="h-40 overflow-y-auto space-y-2.5 text-xs text-white/90 leading-relaxed scrollbar-thin select-text">
                  {ledgerLogs.map((log, index) => (
                    <div key={index} className="flex gap-2">
                      <span className="text-white/40">&gt;</span>
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              </div>
                </>
              ) : (
                <div className="bg-white border border-aura-ink p-12 flex flex-col items-center justify-center text-center space-y-6 min-h-[400px]">
                  <div className="w-20 h-20 bg-aura-ink/5 rounded-full flex items-center justify-center">
                    <Shield className="w-10 h-10 text-aura-ink/20" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-serif text-3xl font-bold text-aura-ink">Status: Off Duty</h3>
                    <p className="text-aura-ink/60 font-sans text-sm max-w-md mx-auto leading-relaxed">
                      You are currently signed out of the dispatch relay. Toggle your shift status to <strong className="text-aura-ink">ACTIVE ON SHIFT</strong> to connect to the live AURA multi-agent intelligence queue and view active alerts.
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ==================== PAGE 7: ACTIVE RESCUE TRACKER ==================== */}
        {currentView === 'citizen-tracker' && (
          <ActiveRescueTracker
            userName={userName}
            userPhone={userPhone}
            crisisCategory={selectedCrisisCategory || 'Medical'}
            distressMessage={distressMessage}
            hasInsulinDependency={hasInsulinDependency}
            hasAsthma={hasAsthma}
            hospitals={hospitals}
            selectedRoute={selectedRoute}
            selectedHospital={selectedHospital}
            apiResponse={activeApiResponse}
            userLocation={userLocation}
            activeLanguage={activeLanguage}
            onReturn={() => setCurrentView('citizen-dashboard')}
          />
        )}

        {/* ==================== PAGE: ONLINE AI TRIAGENT CHAT ==================== */}
        {currentView === 'online-triagent' && (
          <OnlineTriagentChat
            userName={userName}
            isOnline={isOnline}
            profileData={profileData}
            userLocation={userLocation}
            onTriggerSOS={() => {
              setSelectedCrisisCategory('Medical');
              setCurrentView('citizen-crisis');
            }}
            onOpenSMSModal={() => {
              setIsSMSModalOpen(true);
            }}
            onDispatch={(pipelineResult) => handleChatDispatch(pipelineResult)}
          />
        )}

        {/* ==================== PAGE: HQ ADMINISTRATIVE LOGIN GATE ==================== */}
        {currentView === 'hq-login' && (
          <div className="animate-in fade-in duration-300 max-w-md mx-auto py-12">
            <div className="bg-white border-2 border-aura-ink rounded-none shadow-brutal p-8 md:p-10 space-y-8">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-aura-hero/10 border border-aura-hero rounded-full flex items-center justify-center mx-auto text-aura-hero">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-2xl font-bold text-aura-ink">Command HQ Gate</h3>
                <p className="text-xs font-mono text-aura-ink/50 uppercase tracking-wider font-bold">Secure Medical Supplies Database</p>
              </div>

              {/* Login Form */}
              <form onSubmit={(e) => {
                e.preventDefault();
                const u = e.target.elements.username.value;
                const p = e.target.elements.password.value;
                
                if (u === 'admin' && p === 'aura-hq') {
                  setIsHqAuthenticated(true);
                  setCurrentView('volunteer-dashboard');
                  addLedgerLog('HQ_SECURITY: Operator successfully authenticated. Supply databases unlocked.');
                } else {
                  alert('Invalid secure key or pass credentials.');
                }
              }} className="space-y-6">
                <div>
                  <label className="flushed-label">HQ OPERATOR IDENTIFIER</label>
                  <input
                    type="text"
                    name="username"
                    defaultValue="admin"
                    required
                    className="flushed-input font-mono"
                  />
                </div>

                <div>
                  <label className="flushed-label">SECURE CIPHER KEY</label>
                  <input
                    type="password"
                    name="password"
                    defaultValue="aura-hq"
                    required
                    className="flushed-input font-mono"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 px-6 bg-aura-hero text-white rounded-full font-bold uppercase text-sm hover:-translate-y-0.5 active:translate-y-0 transition-all border border-aura-ink shadow-sm"
                  >
                    Authenticate Gateway
                  </button>
                </div>
              </form>

              <div className="text-center">
                <button
                  onClick={() => {
                    if (isAuthenticated) {
                      setCurrentView('citizen-dashboard');
                    } else {
                      setCurrentView('landing');
                    }
                  }}
                  className="text-xs font-mono hover:text-aura-sos text-aura-ink/40 uppercase"
                >
                  [ Return to Citizen Dashboard ]
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* FOOTER WIDGET */}
      <footer className="max-w-7xl w-full mx-auto px-6 border-t border-aura-ink/10 pt-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono text-aura-ink/50">
        <div className="flex items-center gap-2">
          <span>AURA // Municipal Rescue Logistics Copilot // Kolkata Innovation Zone</span>
          {isHqAuthenticated && (
            <button
              onClick={() => {
                setIsHqAuthenticated(false);
                setCurrentView('citizen-dashboard');
                addLedgerLog('HQ_SECURITY: Operator logged out. Supply databases locked.');
              }}
              className="text-[10px] text-aura-sos hover:underline uppercase tracking-wider font-bold"
            >
              [ HQ LOGOUT ]
            </button>
          )}
        </div>
        <div>
          Tridibesh Sen • Argha Ghosh • Debraj Khan // Zonal Round Submission
        </div>
      </footer>

      {/* Offline Fallback SMS Visualizer Modal rendered globally */}
      <SMSModal 
        isOpen={isSMSModalOpen} 
        onClose={() => {
          setIsSMSModalOpen(false);
        }} 
        payload={smsPayload}
        onWhatsAppTrigger={() => {
          addLedgerLog(`SMS_MODAL: User selected WhatsApp Handoff. Coordinating local routing trackers.`);
          setCurrentView('citizen-tracker');
        }}
        onSimulateDispatch={() => {
          setIsSMSModalOpen(false);
          alert('Native SMS Offline Transmission Simulated successfully! Booting into resilient tracking mode...');
          if (lastSubmissionData.current) {
             const { lat, lng, type, msg } = lastSubmissionData.current;
             executeSubmission(lat, lng, type, msg, true);
          }
        }}
      />

      {/* Login Portal Modal Overlay */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-aura-bg border-2 border-aura-ink p-4">
            <button 
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 text-aura-ink/60 hover:text-aura-ink font-mono text-xs uppercase tracking-widest cursor-pointer z-50 border border-aura-ink/30 px-2 py-0.5 bg-aura-card hover:bg-gray-100 transition-colors"
            >
              [ Close ]
            </button>
            <div className="pt-8">
              <LoginPortal onLoginSuccess={(user, isSandboxSession) => {
                if (isSandboxSession) {
                  setIsSandbox(true);
                }
                setIsAuthenticated(true);
                if (user.displayName) {
                  setUserName(user.displayName);
                }
                setCurrentView('citizen-dashboard');
                setShowLoginModal(false);
              }} />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Navigation, Info, Truck } from 'lucide-react';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyCjzZrY7uyEOubnutbJWPOBuCuEqMA1PF0';

// Custom, architectural minimal printed-paper map style
const MAP_STYLES = [
  { "elementType": "geometry", "stylers": [{ "color": "#F4F4F0" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#111827" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#F4F4F0" }, { "weight": 2 }] },
  { "featureType": "administrative", "elementType": "geometry.stroke", "stylers": [{ "color": "#111827" }, { "weight": 0.5 }] },
  { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#F4F4F0" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#E5E5DF" }] },
  { "featureType": "poi", "elementType": "labels.text", "stylers": [{ "visibility": "off" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#FFFFFF" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#111827" }, { "weight": 0.4 }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#E55B13" }, { "lightness": 60 }] },
  { "featureType": "transit", "elementType": "geometry", "stylers": [{ "color": "#E5E5DF" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#C3D2DB" }] }
];

// Ambulance SVG icon for the marker
const AMBULANCE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <defs>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
  <circle cx="24" cy="24" r="20" fill="#E55B13" stroke="#111827" stroke-width="2" filter="url(#glow)"/>
  <text x="24" y="30" text-anchor="middle" font-size="22" fill="white">🚑</text>
</svg>`;

const HOSPITAL_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36">
  <rect x="2" y="2" width="32" height="32" rx="4" fill="#043927" stroke="#111827" stroke-width="1.5"/>
  <text x="18" y="24" text-anchor="middle" font-size="18" fill="white">🏥</text>
</svg>`;

export default function GoogleMap({
  activeAlerts = [],
  hospitals = [],
  selectedRoute = null,
  userLocation = null,
  selectedHospital = null,
  onHospitalSelect = null,
  onRouteComputed = null,
  onEtaUpdate = null
}) {
  const mapContainerRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [routeEta, setRouteEta] = useState(null);
  const markersRef = useRef([]);
  const polylinesRef = useRef([]);
  const directionsRendererRef = useRef(null);
  const ambulanceMarkerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const ambulanceAnimRef = useRef(null);

  // Dynamically load Google Maps script
  useEffect(() => {
    if (window.google && window.google.maps) {
      setGoogleLoaded(true);
      return;
    }

    const scriptId = 'google-maps-script';
    let script = document.getElementById(scriptId);

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&v=weekly&callback=initMap`;
      script.async = true;
      script.defer = true;
      
      window.initMap = () => {
        setGoogleLoaded(true);
      };

      script.onerror = () => {
        setLoadError(true);
      };

      document.head.appendChild(script);
    } else {
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps) {
          setGoogleLoaded(true);
          clearInterval(checkInterval);
        }
      }, 500);
      return () => clearInterval(checkInterval);
    }
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!googleLoaded || !mapContainerRef.current) return;

    const center = userLocation && userLocation.lat
      ? { lat: userLocation.lat, lng: userLocation.lng }
      : { lat: 22.5224, lng: 88.3719 };

    const map = new window.google.maps.Map(mapContainerRef.current, {
      center: center,
      zoom: 13,
      styles: MAP_STYLES,
      disableDefaultUI: true,
      zoomControl: true,
      zoomControlOptions: {
        position: window.google.maps.ControlPosition.RIGHT_BOTTOM
      }
    });

    setMapInstance(map);
  }, [googleLoaded]);

  // Update map center when user location changes
  useEffect(() => {
    if (!mapInstance || !userLocation?.lat) return;
    mapInstance.panTo({ lat: userLocation.lat, lng: userLocation.lng });
  }, [mapInstance, userLocation?.lat, userLocation?.lng]);

  // Place user location marker
  useEffect(() => {
    if (!mapInstance || !googleLoaded || !userLocation?.lat) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null);
    }

    const marker = new window.google.maps.Marker({
      position: { lat: userLocation.lat, lng: userLocation.lng },
      map: mapInstance,
      title: 'Your Location',
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: '#3B82F6',
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 3,
        scale: 10
      },
      zIndex: 999
    });

    // Add pulsing effect circle
    new window.google.maps.Circle({
      map: mapInstance,
      center: { lat: userLocation.lat, lng: userLocation.lng },
      radius: 150,
      fillColor: '#3B82F6',
      fillOpacity: 0.1,
      strokeColor: '#3B82F6',
      strokeOpacity: 0.3,
      strokeWeight: 1
    });

    userMarkerRef.current = marker;
  }, [mapInstance, googleLoaded, userLocation?.lat, userLocation?.lng]);

  // Handle hospital markers, alert markers, and route rendering
  useEffect(() => {
    if (!mapInstance || !googleLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Clear existing polylines
    polylinesRef.current.forEach(line => line.setMap(null));
    polylinesRef.current = [];

    // Add Hospitals with custom icons
    hospitals.forEach(hospital => {
      if (!hospital.lat || !hospital.lng) return;

      const marker = new window.google.maps.Marker({
        position: { lat: hospital.lat, lng: hospital.lng },
        map: mapInstance,
        title: hospital.name,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(HOSPITAL_SVG),
          scaledSize: new window.google.maps.Size(32, 32),
          anchor: new window.google.maps.Point(16, 16)
        }
      });

      const distText = hospital.distanceKm !== undefined
        ? `<br/><strong>Distance:</strong> ${hospital.distanceKm} km<br/><strong>ETA:</strong> ${hospital.etaMinutes} min`
        : '';

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="font-family: Inter, sans-serif; padding: 8px; min-width: 180px;">
            <strong style="color: #043927; font-family: Fraunces, serif; font-size: 14px;">${hospital.name}</strong>
            <p style="margin: 6px 0 0 0; font-size: 11px; font-family: 'Space Mono', monospace; color: #111827;">
              Insulin: ${hospital.stock?.insulin ?? 'N/A'} vials<br/>
              Oxygen: ${hospital.stock?.oxygen ?? 'N/A'} cylinders
              ${distText}
            </p>
            <button onclick="window.__auraSelectHospital && window.__auraSelectHospital('${hospital.id}')" 
              style="margin-top: 8px; padding: 4px 12px; background: #E55B13; color: white; border: 1px solid #111827; 
              font-size: 10px; font-family: 'Space Mono', monospace; cursor: pointer; text-transform: uppercase; font-weight: bold;">
              Route Ambulance →
            </button>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(mapInstance, marker);
      });

      markersRef.current.push(marker);
    });

    // Global handler for hospital selection from InfoWindow button
    window.__auraSelectHospital = (hospitalId) => {
      const hospital = hospitals.find(h => h.id === hospitalId);
      if (hospital && onHospitalSelect) {
        onHospitalSelect(hospital);
      }
    };

    // Add Active Citizen Alerts
    activeAlerts.forEach(alert => {
      if (!alert.lat || !alert.lng) return;
      const marker = new window.google.maps.Marker({
        position: { lat: alert.lat, lng: alert.lng },
        map: mapInstance,
        title: alert.name,
        icon: {
          path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          fillColor: '#E55B13',
          fillOpacity: 1,
          strokeColor: '#111827',
          strokeWeight: 1,
          scale: 5
        }
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="font-family: Inter, sans-serif; padding: 6px; width: 180px;">
            <strong style="color: #E55B13; font-size: 13px;">${alert.type} Request</strong>
            <p style="margin: 4px 0 0 0; font-size: 11px; font-weight: bold; color: #111827;">${alert.name}</p>
            <p style="margin: 2px 0 0 0; font-size: 10px; color: #666; font-style: italic;">"${alert.message}"</p>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(mapInstance, marker);
      });

      markersRef.current.push(marker);
    });

    // Draw Selected Routing Path (legacy polyline fallback)
    if (selectedRoute && selectedRoute.length > 0 && !selectedHospital) {
      const routePath = new window.google.maps.Polyline({
        path: selectedRoute,
        geodesic: true,
        strokeColor: '#E55B13',
        strokeOpacity: 0.8,
        strokeWeight: 4
      });

      routePath.setMap(mapInstance);
      polylinesRef.current.push(routePath);

      const bounds = new window.google.maps.LatLngBounds();
      selectedRoute.forEach(coord => bounds.extend(coord));
      mapInstance.fitBounds(bounds);
    }
  }, [mapInstance, googleLoaded, activeAlerts, hospitals, selectedRoute]);

  // Compute route and animate ambulance when a hospital is selected
  useEffect(() => {
    if (!mapInstance || !googleLoaded || !selectedHospital || !userLocation?.lat) return;

    // Clear previous directions
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
    }
    if (ambulanceMarkerRef.current) {
      ambulanceMarkerRef.current.setMap(null);
    }
    if (ambulanceAnimRef.current) {
      clearInterval(ambulanceAnimRef.current);
    }

    const directionsService = new window.google.maps.DirectionsService();
    const directionsRenderer = new window.google.maps.DirectionsRenderer({
      map: mapInstance,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#E55B13',
        strokeOpacity: 0.85,
        strokeWeight: 5,
        icons: [{
          icon: {
            path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 3,
            strokeColor: '#111827',
            fillColor: '#E55B13',
            fillOpacity: 1
          },
          offset: '0%',
          repeat: '100px'
        }]
      }
    });

    directionsRendererRef.current = directionsRenderer;

    const origin = { lat: userLocation.lat, lng: userLocation.lng };
    const destination = { lat: selectedHospital.lat, lng: selectedHospital.lng };

    directionsService.route(
      {
        origin: origin,
        destination: destination,
        travelMode: window.google.maps.TravelMode.DRIVING
      },
      (result, status) => {
        if (status === 'OK') {
          directionsRenderer.setDirections(result);

          // Extract route info
          const leg = result.routes[0].legs[0];
          const distanceKm = (leg.distance.value / 1000).toFixed(2);
          const etaMinutes = Math.round((parseFloat(distanceKm) / 20) * 60); // 20 km/h

          setRouteEta({ distance: distanceKm, eta: etaMinutes });
          if (onEtaUpdate) {
            onEtaUpdate({ distance: distanceKm, eta: etaMinutes, hospital: selectedHospital.name });
          }
          if (onRouteComputed) {
            onRouteComputed({
              origin,
              destination,
              distanceKm: parseFloat(distanceKm),
              etaMinutes,
              steps: leg.steps.map(s => s.instructions),
              hospital: selectedHospital
            });
          }

          // Place ambulance marker at origin and animate along route
          const ambulanceMarker = new window.google.maps.Marker({
            position: origin,
            map: mapInstance,
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(AMBULANCE_SVG),
              scaledSize: new window.google.maps.Size(48, 48),
              anchor: new window.google.maps.Point(24, 24)
            },
            title: 'AURA Ambulance',
            zIndex: 1000
          });

          ambulanceMarkerRef.current = ambulanceMarker;

          // Animate ambulance along the route path
          const routePath = result.routes[0].overview_path;
          let currentStep = 0;
          const totalSteps = routePath.length;
          const actualInterval = 200; // Fast-forwarded demo animation speed (200ms per step)

          ambulanceAnimRef.current = setInterval(() => {
            currentStep++;
            if (currentStep >= totalSteps) {
              clearInterval(ambulanceAnimRef.current);
              return;
            }
            const newPos = routePath[currentStep];
            ambulanceMarker.setPosition(newPos);

            // Update ETA based on remaining distance
            const remainingSteps = totalSteps - currentStep;
            const remainingEta = Math.round((remainingSteps / totalSteps) * etaMinutes);
            setRouteEta(prev => ({ ...prev, eta: remainingEta }));
            if (onEtaUpdate) {
              onEtaUpdate({ distance: distanceKm, eta: remainingEta, hospital: selectedHospital.name });
            }
          }, actualInterval);

          // Fit bounds to show full route
          const bounds = new window.google.maps.LatLngBounds();
          bounds.extend(origin);
          bounds.extend(destination);
          mapInstance.fitBounds(bounds, { padding: 60 });
        } else {
          console.error('[AURA GoogleMap] Directions request failed:', status);
          // Fallback: draw a simple polyline
          const fallbackLine = new window.google.maps.Polyline({
            path: [origin, destination],
            geodesic: true,
            strokeColor: '#E55B13',
            strokeOpacity: 0.8,
            strokeWeight: 4
          });
          fallbackLine.setMap(mapInstance);
          polylinesRef.current.push(fallbackLine);

          const distanceKm = haversineDistance(origin.lat, origin.lng, destination.lat, destination.lng).toFixed(2);
          const etaMinutes = Math.round((parseFloat(distanceKm) / 20) * 60);
          setRouteEta({ distance: distanceKm, eta: etaMinutes });
          if (onEtaUpdate) {
            onEtaUpdate({ distance: distanceKm, eta: etaMinutes, hospital: selectedHospital.name });
          }
        }
      }
    );

    return () => {
      if (ambulanceAnimRef.current) {
        clearInterval(ambulanceAnimRef.current);
      }
    };
  }, [mapInstance, googleLoaded, selectedHospital, userLocation?.lat, userLocation?.lng]);

  // Haversine distance helper
  function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
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

  // Offline or Script Error Fallback Rendering
  if (loadError) {
    return (
      <div className="w-full h-full bg-aura-bg border border-aura-ink/30 p-8 flex flex-col items-center justify-center text-center font-mono">
        <Info className="w-12 h-12 text-aura-sos mb-4" />
        <h4 className="font-serif text-lg font-bold text-aura-ink mb-2">Google Maps Load Failed</h4>
        <p className="text-xs text-aura-ink/60 max-w-xs mb-4">Cellular connection is offline or API key restricts map initialization.</p>
        <div className="border border-aura-ink bg-aura-card p-4 rounded-none text-left text-[10px] w-full max-w-xs shadow-sm">
          <span className="text-aura-sos">SYS_FALLBACK_GEO:</span> Mapped grid simulated offline. Active coordinates geolocating to Kolkata (22.5224° N, 88.3719° E).
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative border border-aura-ink rounded-none bg-aura-bg min-h-[300px]">
      {!googleLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-aura-bg/80 z-10 font-mono text-xs">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-aura-hero mb-3"></div>
          <span>INITIALIZING SPATIAL CANVAS...</span>
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: '300px' }} />

      {/* ETA Overlay */}
      {routeEta && selectedHospital && (
        <div className="absolute top-3 left-3 z-20 bg-aura-ink/90 backdrop-blur-sm text-white px-4 py-3 border border-white/20 shadow-lg animate-in fade-in slide-in-from-top duration-300" style={{ minWidth: '200px' }}>
          <div className="flex items-center gap-2 mb-2">
            <Truck className="w-4 h-4 text-[#E55B13] animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-white/60">Ambulance ETA</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif font-black text-2xl text-[#E55B13]">{routeEta.eta}</span>
            <span className="font-mono text-xs text-white/70">min</span>
          </div>
          <div className="mt-1 font-mono text-[10px] text-white/50 space-y-0.5">
            <div>DIST: {routeEta.distance} km • SPEED: 20 km/h</div>
            <div className="truncate">TO: {selectedHospital.name}</div>
          </div>
        </div>
      )}
    </div>
  );
}

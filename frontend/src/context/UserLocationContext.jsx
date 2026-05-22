import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const UserLocationContext = createContext(null);

export function UserLocationProvider({ children }) {
  const [location, setLocation] = useState({ lat: null, lng: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [permissionState, setPermissionState] = useState('prompt'); // 'prompt' | 'granted' | 'denied'

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      setLoading(false);
      setPermissionState('denied');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setLoading(false);
        setPermissionState('granted');
        console.log(`[AURA Location] Acquired: ${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`);
      },
      (err) => {
        console.warn('[AURA Location] Permission denied or error:', err.message);
        setError(err.message);
        setLoading(false);
        setPermissionState('denied');
        // Fallback to Kolkata center
        setLocation({ lat: 22.5726, lng: 88.3639 });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000 // Cache for 1 minute
      }
    );
  }, []);

  // Auto-request on mount
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const value = {
    ...location,
    loading,
    error,
    permissionState,
    requestLocation
  };

  return (
    <UserLocationContext.Provider value={value}>
      {children}
    </UserLocationContext.Provider>
  );
}

export function useUserLocation() {
  const context = useContext(UserLocationContext);
  if (!context) {
    throw new Error('useUserLocation must be used within a UserLocationProvider');
  }
  return context;
}

export default UserLocationContext;

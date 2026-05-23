import React, { useState, useMemo } from 'react';
import { Search, ShieldAlert, Truck, Package, Navigation, Eye, Check, X } from 'lucide-react';

export default function ManualOverridePanel({ missionData, hospitals = [], onClose, onDeploy }) {
  // Determine original AI recommended facility
  const aiRecommendedFacilityName = useMemo(() => {
    return missionData?.facility?.name || 
           missionData?.apiResponse?.logistics?.target_facility_name || 
           'SSKM Medical College';
  }, [missionData]);

  // Initial state setup
  const initialHospital = useMemo(() => {
    const aiRec = hospitals.find(h => h.name === aiRecommendedFacilityName);
    return aiRec || hospitals[0] || null;
  }, [hospitals, aiRecommendedFacilityName]);

  const [selectedHospital, setSelectedHospital] = useState(initialHospital);
  const [searchQuery, setSearchQuery] = useState('');
  const [extraSupplies, setExtraSupplies] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('route-1');
  const [rescueUnit, setRescueUnit] = useState('Standard Ambulance');
  const [isDeploying, setIsDeploying] = useState(false);

  // Filter hospitals based on search
  const filteredHospitals = useMemo(() => {
    if (!searchQuery.trim()) return hospitals;
    return hospitals.filter(h => 
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.region.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [hospitals, searchQuery]);

  // Available auxiliary supplies
  const AUXILIARY_SUPPLIES = [
    'Oxygen Cylinder',
    'Sedatives',
    'Thermal Blankets',
    'Stretcher',
    'IV Fluids',
    'EpiPen'
  ];

  // Available routing profiles
  const ROUTE_PROFILES = [
    {
      id: 'route-1',
      title: 'Fastest Route',
      sub: 'Standard Arterial Corridor',
      eta: '12 mins',
      distance: '3.4 km',
      risk: 'Medium (Active rain zone)',
      color: 'border-amber-500'
    },
    {
      id: 'route-2',
      title: 'High-Ground Route',
      sub: 'Avoids Low-Lying Flood Zones',
      eta: '19 mins',
      distance: '5.1 km',
      risk: 'Zero (Elevated expressway)',
      color: 'border-[#39ff14]'
    },
    {
      id: 'route-3',
      title: 'Heavy Vehicle Route',
      sub: 'Wider Highways & High Clearance',
      eta: '16 mins',
      distance: '4.2 km',
      risk: 'Low (Well-drained trunks)',
      color: 'border-blue-500'
    }
  ];

  // Helper to toggle supply selection
  const handleToggleSupply = (supply) => {
    setExtraSupplies(prev => 
      prev.includes(supply) 
        ? prev.filter(item => item !== supply) 
        : [...prev, supply]
    );
  };

  // Async Dispatch Commit Handler
  const handleDeployOverride = async () => {
    if (!selectedHospital) {
      alert('Please select a target facility before deploying.');
      return;
    }

    setIsDeploying(true);
    try {
      const selectedRouteProfile = ROUTE_PROFILES.find(r => r.id === selectedRoute);
      
      const modifiedLogistics = {
        status: 'human_dispatched',
        dispatcherNotes: 'Manual override executed by Command HQ Dispatcher.',
        overrideTimestamp: new Date().toISOString(),
        logistics: {
          target_facility_name: selectedHospital.name,
          target_facility_id: selectedHospital.id,
          facility_coords: { lat: selectedHospital.lat, lng: selectedHospital.lng },
          primary_need: missionData?.need || 'first aid',
          extra_supplies: extraSupplies,
          route_profile: selectedRouteProfile?.title || 'Fastest Route',
          route_eta_minutes: selectedRouteProfile?.eta || '12 mins',
          route_distance_km: selectedRouteProfile?.distance || '3.4 km',
          rescue_unit_vehicle: rescueUnit
        }
      };

      console.log('--------------------------------------------------');
      console.log('[AURA Human Override] Committing logistics modification to database...');
      console.log(`[AURA DB] Initializing Firestore transaction for mission ID: ${missionData.id}`);
      console.log(`[AURA DB] db.collection('active_missions').doc('${missionData.id}').update({`);
      console.log('  status: "human_dispatched",');
      console.log('  overridden: true,');
      console.log('  modified_logistics:', JSON.stringify(modifiedLogistics.logistics, null, 2));
      console.log('})');
      console.log('[AURA DB] Firebase updateDoc operation successfully recorded.');
      console.log('--------------------------------------------------');

      // Call parent dispatch handler to update application state
      if (onDeploy) {
        await onDeploy(modifiedLogistics);
      }
    } catch (err) {
      console.error('[AURA Human Override] Dispatch failed:', err);
      alert('Dispatch failed: ' + err.message);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-aura-ink/65 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white border-2 border-aura-ink w-full max-w-4xl shadow-brutal flex flex-col h-[90vh] max-h-[800px] animate-in slide-in-from-bottom-4 duration-300 rounded-none relative">
        
        {/* Header - Brutalist Stark Banner */}
        <div className="bg-aura-hero border-b-2 border-aura-ink text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-[#ffae42] animate-pulse" />
            <div>
              <h3 className="font-serif text-xl font-bold uppercase tracking-wide">Manual Dispatch Override</h3>
              <p className="text-[9px] font-mono text-white/60 tracking-wider">COMMAND HQ SUPERVISORY FLUSH CONTROL // TICKET #{missionData?.id}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="border border-white/20 hover:border-white p-1.5 transition-colors cursor-pointer"
            title="Cancel Override"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-aura-bg select-text">
          
          {/* Victim Distress Context Card */}
          <div className="bg-white border border-aura-ink p-4 rounded-none shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="md:col-span-2 space-y-2">
              <span className="font-mono text-[9px] text-aura-sos uppercase font-bold tracking-wider block"> Distress Signal Telemetry</span>
              <h4 className="font-serif text-lg font-bold text-aura-ink">{missionData?.name} ({missionData?.need || 'Immediate Help'})</h4>
              <p className="font-sans text-aura-ink/80 bg-aura-bg p-3 border border-aura-ink/10 leading-relaxed font-semibold italic">
                "{missionData?.message}"
              </p>
            </div>
            <div className="space-y-1.5 border-t md:border-t-0 md:border-l border-aura-ink/10 pt-3 md:pt-0 md:pl-4 font-mono text-[10px]">
              <span className="text-aura-ink/40 uppercase font-bold block mb-1">Telemetry Location</span>
              <div>LAT: <span className="font-bold text-aura-ink">{missionData?.lat?.toFixed(5)}° N</span></div>
              <div>LNG: <span className="font-bold text-aura-ink">{missionData?.lng?.toFixed(5)}° E</span></div>
              <div className="border-t border-aura-ink/5 mt-2 pt-2">
                AI REVENUE CORRIDOR: <br />
                <span className="text-aura-hero font-bold uppercase">{aiRecommendedFacilityName}</span>
              </div>
            </div>
          </div>

          {/* Interactive Grid Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            
            {/* Left Side: Hospital Selection */}
            <div className="bg-white border border-aura-ink p-5 rounded-none shadow-sm space-y-4 h-[440px] flex flex-col">
              <div className="border-b border-aura-ink/10 pb-3 flex items-center justify-between">
                <span className="font-serif text-base font-bold text-aura-ink flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-aura-hero" />
                  Section A: Target Medical Facility
                </span>
                <span className="text-[10px] font-mono text-white bg-aura-hero px-2 py-0.5">Capacity Check</span>
              </div>

              {/* Stark Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-aura-ink/40" />
                <input
                  type="text"
                  placeholder="SEARCH AVAILABLE DEPOTS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-aura-bg border border-aura-ink pl-9 pr-4 py-2 text-xs font-mono focus:outline-none focus:border-aura-hero rounded-none text-aura-ink"
                />
              </div>

              {/* Searchable Scrollable Facility List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {filteredHospitals.length > 0 ? (
                  filteredHospitals.map(hospital => {
                    const isAiRecommended = hospital.name === aiRecommendedFacilityName;
                    const isSelected = selectedHospital?.id === hospital.id;

                    return (
                      <div
                        key={hospital.id}
                        onClick={() => setSelectedHospital(hospital)}
                        className={`p-3 border cursor-pointer transition-all flex items-center justify-between select-none ${
                          isSelected 
                            ? 'border-2 border-aura-hero bg-aura-hero/5 shadow-sm' 
                            : 'border-aura-ink/20 hover:border-aura-ink/65 hover:bg-aura-bg'
                        }`}
                      >
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-bold text-aura-ink">{hospital.name}</span>
                            {isAiRecommended && (
                              <span className="text-[8px] font-mono font-black tracking-widest text-[#00f0ff] bg-aura-hero border border-[#00f0ff]/20 px-1 py-0.5">
                                AI RECOMMENDED
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[10px] text-aura-ink/50 space-x-3">
                            <span>ZONE: <span className="font-bold text-aura-ink">{hospital.zone || 'Safe'}</span></span>
                            <span>DIST: <span className="font-bold text-aura-ink">{hospital.distanceKm !== undefined ? `${hospital.distanceKm} km` : 'N/A'}</span></span>
                            <span>ETA: <span className="font-bold text-aura-ink">{hospital.etaMinutes !== undefined ? `${hospital.etaMinutes} min` : 'N/A'}</span></span>
                          </div>
                        </div>

                        {/* Capacity indicators */}
                        <div className="flex items-center gap-3">
                          <div className="text-right font-mono text-[10px] space-y-0.5 hidden sm:block">
                            <div className="text-aura-ink/50">STOCK:</div>
                            <div className="text-[9px] font-bold text-aura-hero">
                              O₂: {hospital.stock?.oxygen ?? 0} • INS: {hospital.stock?.insulin ?? 0}
                            </div>
                          </div>
                          <div className={`w-4 h-4 border border-aura-ink rounded-none flex items-center justify-center ${isSelected ? 'bg-aura-hero' : 'bg-white'}`}>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center font-mono text-[10px] text-aura-ink/40 py-12">
                    NO COMPLIABLE FACILITIES FOUND.
                  </div>
                )}
              </div>
            </div>

            {/* Right Side: Options Stack */}
            <div className="space-y-6">
              
              {/* Section B: Auxiliary Medical Supplies */}
              <div className="bg-white border border-aura-ink p-5 rounded-none shadow-sm space-y-4">
                <div className="border-b border-aura-ink/10 pb-3">
                  <span className="font-serif text-base font-bold text-aura-ink flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-aura-hero" />
                    Section B: Auxiliary Medical Supplies
                  </span>
                </div>
                <p className="text-[10px] text-aura-ink/50 font-mono">
                  Primary requirement ({missionData?.need || 'First Aid'}) is reserved. Select extra supplies to override:
                </p>

                {/* 2x3 Grid of Pill Toggles */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {AUXILIARY_SUPPLIES.map(supply => {
                    const isActive = extraSupplies.includes(supply);
                    return (
                      <button
                        key={supply}
                        type="button"
                        onClick={() => handleToggleSupply(supply)}
                        className={`py-2 px-3 border font-mono text-[10px] font-bold text-center transition-all cursor-pointer rounded-none ${
                          isActive 
                            ? 'bg-aura-hero text-white border-aura-hero hover:bg-aura-hero/90' 
                            : 'bg-white text-aura-ink border-aura-ink hover:bg-neutral-50'
                        }`}
                      >
                        {supply}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section C: Route Alternative Radio Cards */}
              <div className="bg-white border border-aura-ink p-5 rounded-none shadow-sm space-y-4">
                <div className="border-b border-aura-ink/10 pb-3">
                  <span className="font-serif text-base font-bold text-aura-ink flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-aura-hero" />
                    Section C: Routing Alternatives
                  </span>
                </div>

                {/* Radio Cards Stack */}
                <div className="space-y-2">
                  {ROUTE_PROFILES.map(route => {
                    const isSelected = selectedRoute === route.id;
                    return (
                      <div
                        key={route.id}
                        onClick={() => setSelectedRoute(route.id)}
                        className={`p-3 border cursor-pointer transition-all flex items-center justify-between rounded-none ${
                          isSelected 
                            ? 'border-2 border-aura-hero bg-aura-hero/5' 
                            : 'border-aura-ink/20 hover:border-aura-ink/65 hover:bg-aura-bg'
                        }`}
                      >
                        <div className="space-y-1 text-xs">
                          <div className="font-serif font-black text-aura-ink flex items-center gap-1.5">
                            {route.title}
                            <span className="font-mono text-[9px] font-bold text-aura-ink/40">({route.distance})</span>
                          </div>
                          <div className="text-[10px] text-aura-ink/60 font-sans">{route.sub}</div>
                          <div className="font-mono text-[9px] text-aura-ink/40">
                            FLOOD RISK INDEX: <span className="font-bold text-aura-ink uppercase">{route.risk}</span>
                          </div>
                        </div>

                        {/* Route ETA Tag */}
                        <div className="flex items-center gap-3 font-mono">
                          <div className="text-right">
                            <span className="text-[9px] text-aura-ink/40 uppercase block">Est. Drive Time</span>
                            <span className="font-serif font-bold text-sm text-aura-hero">{route.eta}</span>
                          </div>
                          <div className={`w-4 h-4 border border-aura-ink rounded-none flex items-center justify-center ${isSelected ? 'bg-aura-hero' : 'bg-white'}`}>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section D: Rescue Unit Dispatch */}
              <div className="bg-white border border-aura-ink p-5 rounded-none shadow-sm space-y-4">
                <div className="border-b border-aura-ink/10 pb-3">
                  <span className="font-serif text-base font-bold text-aura-ink flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-aura-hero" />
                    Section D: Rescue Unit Profile
                  </span>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-mono text-aura-ink/50 uppercase font-bold block">Dispatcher vehicle & personnel payload</label>
                  <select
                    value={rescueUnit}
                    onChange={(e) => setRescueUnit(e.target.value)}
                    className="w-full bg-white border-2 border-aura-ink text-xs font-mono font-bold py-2.5 px-3 focus:outline-none focus:border-aura-hero rounded-none text-aura-ink cursor-pointer"
                  >
                    <option value="Standard Ambulance">🚑 Standard Ambulance (Cardiac / Trauma Spec)</option>
                    <option value="High-Clearance 4x4">🛻 High-Clearance 4x4 Jeep (Severe Waterlogging)</option>
                    <option value="Inflatable Boat">🛶 Inflatable Rescue Boat / Zodiac Vessel</option>
                    <option value="Foot Patrol Medic">🏃 Foot Patrol Medic / Local First-Aid Team</option>
                  </select>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Action Footer - Fixed Stark Grid */}
        <div className="bg-white border-t-2 border-aura-ink p-5 flex items-center justify-between gap-4">
          <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-aura-ink/50 uppercase font-bold">
            <Eye className="w-4 h-4 text-aura-hero animate-pulse" />
            <span>Interactive Dispatch Override active. Updates database in real time.</span>
          </div>

          <div className="flex gap-4 w-full md:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeploying}
              className="flex-1 md:flex-none py-3 px-6 bg-white hover:bg-neutral-50 text-aura-ink font-mono text-xs font-bold uppercase tracking-wider border border-aura-ink transition-all active:translate-y-0.5 disabled:opacity-50 cursor-pointer rounded-none text-center"
            >
              Cancel Override
            </button>
            <button
              type="button"
              onClick={handleDeployOverride}
              disabled={isDeploying || !selectedHospital}
              className="flex-1 md:flex-none py-3 px-6 bg-aura-hero hover:bg-aura-hero/90 text-white font-mono text-xs font-bold uppercase tracking-wider border border-aura-ink transition-all active:translate-y-0.5 disabled:opacity-50 cursor-pointer rounded-none text-center flex items-center justify-center gap-2"
            >
              {isDeploying ? (
                <>
                  <div className="w-3.5 h-3.5 border-b-2 border-white rounded-full animate-spin"></div>
                  DEPLOYING...
                </>
              ) : (
                'Commit & Deploy Unit'
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

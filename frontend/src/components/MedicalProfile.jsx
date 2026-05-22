import React, { useState, useEffect } from 'react';
import { Check, X, ShieldAlert, Heart, Truck, Phone } from 'lucide-react';
import { auth, db } from '../config/firebase';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function MedicalProfile({
  profileData,
  onSave,
  onClose
}) {
  // Local form states initialized from parent props
  const [userId, setUserId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
    });
    return () => unsubscribe();
  }, []);
  const [userName, setUserName] = useState(profileData.userName || '');
  const [userPhone, setUserPhone] = useState(profileData.userPhone || '');
  const [safeZoneName, setSafeZoneName] = useState(profileData.safeZoneName || '');
  
  const [bloodType, setBloodType] = useState(profileData.bloodType || 'Unknown');
  const [dob, setDob] = useState(profileData.dob || '');
  const [sex, setSex] = useState(profileData.sex || 'Other');
  
  const [chronicConditions, setChronicConditions] = useState(profileData.chronicConditions || ['None']);
  const [allergies, setAllergies] = useState(profileData.allergies || ['None']);
  const [highRiskMeds, setHighRiskMeds] = useState(profileData.highRiskMeds || ['None']);
  
  const [mobilityStatus, setMobilityStatus] = useState(profileData.mobilityStatus || 'Independent');
  const [powerDependencies, setPowerDependencies] = useState(profileData.powerDependencies || ['None']);
  const [sensoryImpairments, setSensoryImpairments] = useState(profileData.sensoryImpairments || ['None']);
  
  const [emergencyContactName, setEmergencyContactName] = useState(profileData.emergencyContactName || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(profileData.emergencyContactPhone || '');

  // Helper for multi-select toggles with "None" auto-clearing logic
  const handleToggleMulti = (value, currentList, setList) => {
    if (value === 'None') {
      setList(['None']);
      return;
    }

    let newList = currentList.filter(item => item !== 'None');
    if (newList.includes(value)) {
      newList = newList.filter(item => item !== value);
      if (newList.length === 0) newList = ['None'];
    } else {
      newList.push(value);
    }
    setList(newList);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setIsSuccess(false);
    
    // Auto-sync legacy flags
    const hasInsulin = chronicConditions.includes('Diabetes');
    const hasAsthma = chronicConditions.includes('Asthma/COPD');

    const payload = {
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
      emergencyContactPhone,
      hasInsulinDependency: hasInsulin,
      hasAsthma: hasAsthma
    };

    const currentUserId = userId || (auth.currentUser ? auth.currentUser.uid : 'demo_user_123');

    try {
      const userRef = doc(db, 'users', currentUserId);

      const writeData = {
        medical_data: payload,
        medical_setup_complete: true,
        last_updated: new Date()
      };

      // setDoc with merge: true acts as an upsert (update if exists, create if not)
      // We fire-and-forget this promise so the UI instantly resolves even if offline!
      setDoc(userRef, writeData, { merge: true }).catch(err => {
        console.warn('[AURA FIRESTORE] Offline queuing or background save delayed:', err);
      });
      console.log('[AURA FIRESTORE] setDoc merge queued for', currentUserId);

      setIsSuccess(true);

      onSave({
        ...payload,
        // Legacy flags compatibility
        hasInsulinDependency: hasInsulin,
        hasAsthma: hasAsthma
      });

      setTimeout(() => {
        setIsSuccess(false);
      }, 2000);

    } catch (err) {
      console.error('[AURA MEDICAL PROFILE] Save failed:', err);
      setSaveError('Failed to sync medical profile with AURA Cloud. Please check connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form 
      onSubmit={handleFormSubmit}
      className="space-y-8 select-text pb-12 animate-in fade-in duration-300"
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-aura-ink/10 pb-4">
        <div className="space-y-1">
          <h3 className="font-serif text-2xl font-bold text-aura-ink">Medical Pre-Context Profile</h3>
          <p className="font-sans text-xs text-aura-ink/60">Pre-saved telemetry parameters used by autonomous disaster triage agents.</p>
        </div>
        <button 
          type="button"
          onClick={onClose}
          className="p-1 hover:text-aura-sos text-aura-ink/50"
          title="Close drawer"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Card 0: Personal Identity Details (Previous Options) */}
      <div className="bg-white border border-aura-ink p-6 md:p-8 rounded-none shadow-sm space-y-6">
        <div className="flex items-center gap-2 border-b border-aura-ink/10 pb-3">
          <Heart className="w-5 h-5 text-aura-hero" />
          <h4 className="font-serif text-lg font-bold text-aura-ink">Card 0: Identity & Safe Zone</h4>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="flushed-label">Citizen Name</label>
            <input 
              type="text" 
              required
              value={userName} 
              onChange={(e) => setUserName(e.target.value)}
              className="flushed-input font-sans text-sm"
              placeholder="e.g. Tridibesh Sen"
            />
          </div>

          <div>
            <label className="flushed-label">Mobile Number (PWA Sync)</label>
            <input 
              type="text" 
              required
              value={userPhone} 
              onChange={(e) => setUserPhone(e.target.value)}
              className="flushed-input font-mono text-sm"
              placeholder="e.g. +91 98765 43210"
            />
          </div>

          <div>
            <label className="flushed-label">Pre-Saved Safe Zone Coordinate Name</label>
            <input 
              type="text" 
              required
              value={safeZoneName} 
              onChange={(e) => setSafeZoneName(e.target.value)}
              className="flushed-input font-sans text-sm"
              placeholder="e.g. Elderly Parents Home - Salt Lake"
            />
          </div>
        </div>
      </div>

      {/* Card 1: Vitals */}
      <div className="bg-white border border-aura-ink p-6 md:p-8 rounded-none shadow-sm space-y-6">
        <div className="flex items-center gap-2 border-b border-aura-ink/10 pb-3">
          <ShieldAlert className="w-5 h-5 text-aura-hero" />
          <h4 className="font-serif text-lg font-bold text-aura-ink">Card 1: Vitals</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="flushed-label">Blood Type</label>
            <select
              value={bloodType}
              onChange={(e) => setBloodType(e.target.value)}
              className="w-full bg-transparent border-b border-aura-ink py-2 focus:outline-none cursor-pointer text-sm font-sans"
            >
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'].map(opt => (
                <option key={opt} value={opt} className="text-aura-ink">{opt}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="flushed-label">Sex at Birth</label>
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              className="w-full bg-transparent border-b border-aura-ink py-2 focus:outline-none cursor-pointer text-sm font-sans"
            >
              {['Male', 'Female', 'Other'].map(opt => (
                <option key={opt} value={opt} className="text-aura-ink">{opt}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="flushed-label">Date of Birth</label>
          <input 
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="w-full bg-transparent border-b border-aura-ink py-2 focus:outline-none text-sm font-mono tracking-wider"
          />
        </div>
      </div>

      {/* Card 2: Medical Red Flags (Large Toggle Buttons) */}
      <div className="bg-white border border-aura-ink p-6 md:p-8 rounded-none shadow-sm space-y-8">
        <div className="flex items-center gap-2 border-b border-aura-ink/10 pb-3">
          <ShieldAlert className="w-5 h-5 text-aura-sos" />
          <h4 className="font-serif text-lg font-bold text-aura-ink">Card 2: Medical Red Flags</h4>
        </div>

        {/* Chronic Conditions */}
        <div className="space-y-3">
          <label className="flushed-label font-bold text-xs uppercase tracking-wider block">Chronic Conditions</label>
          <div className="flex flex-wrap gap-2.5">
            {['Diabetes', 'Asthma/COPD', 'Cardiovascular', 'Epilepsy', 'None'].map(condition => {
              const isSelected = chronicConditions.includes(condition);
              return (
                <button
                  key={condition}
                  type="button"
                  onClick={() => handleToggleMulti(condition, chronicConditions, setChronicConditions)}
                  className={`py-3 px-5 border text-xs font-mono font-bold uppercase transition-all ${
                    isSelected
                      ? 'bg-aura-hero text-white border-aura-ink shadow-sm'
                      : 'bg-white text-aura-ink border-aura-ink/40 hover:bg-aura-bg'
                  }`}
                >
                  {condition}
                </button>
              );
            })}
          </div>
        </div>

        {/* Severe Allergies */}
        <div className="space-y-3">
          <label className="flushed-label font-bold text-xs uppercase tracking-wider block">Severe Allergies</label>
          <div className="flex flex-wrap gap-2.5">
            {['Penicillin', 'Sulfa Drugs', 'Latex', 'Peanuts', 'None'].map(allergy => {
              const isSelected = allergies.includes(allergy);
              return (
                <button
                  key={allergy}
                  type="button"
                  onClick={() => handleToggleMulti(allergy, allergies, setAllergies)}
                  className={`py-3 px-5 border text-xs font-mono font-bold uppercase transition-all ${
                    isSelected
                      ? 'bg-aura-hero text-white border-aura-ink shadow-sm'
                      : 'bg-white text-aura-ink border-aura-ink/40 hover:bg-aura-bg'
                  }`}
                >
                  {allergy}
                </button>
              );
            })}
          </div>
        </div>

        {/* High-Risk Meds */}
        <div className="space-y-3">
          <label className="flushed-label font-bold text-xs uppercase tracking-wider block">High-Risk Meds</label>
          <div className="flex flex-wrap gap-2.5">
            {['Blood Thinners', 'Immunosuppressants', 'None'].map(med => {
              const isSelected = highRiskMeds.includes(med);
              return (
                <button
                  key={med}
                  type="button"
                  onClick={() => handleToggleMulti(med, highRiskMeds, setHighRiskMeds)}
                  className={`py-3 px-5 border text-xs font-mono font-bold uppercase transition-all ${
                    isSelected
                      ? 'bg-aura-hero text-white border-aura-ink shadow-sm'
                      : 'bg-white text-aura-ink border-aura-ink/40 hover:bg-aura-bg'
                  }`}
                >
                  {med}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Card 3: Rescue Logistics */}
      <div className="bg-white border border-aura-ink p-6 md:p-8 rounded-none shadow-sm space-y-8">
        <div className="flex items-center gap-2 border-b border-aura-ink/10 pb-3">
          <Truck className="w-5 h-5 text-aura-hero" />
          <h4 className="font-serif text-lg font-bold text-aura-ink">Card 3: Rescue Logistics</h4>
        </div>

        {/* Mobility Status - Single Select Radio Toggles */}
        <div className="space-y-3">
          <label className="flushed-label font-bold text-xs uppercase tracking-wider block">Mobility Status</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {['Independent', 'Wheelchair Bound', 'Bedridden'].map(status => {
              const isSelected = mobilityStatus === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setMobilityStatus(status)}
                  className={`py-3 px-4 border text-xs font-mono font-bold uppercase transition-all text-center ${
                    isSelected
                      ? 'bg-aura-hero text-white border-aura-ink shadow-sm'
                      : 'bg-white text-aura-ink border-aura-ink/40 hover:bg-aura-bg'
                  }`}
                >
                  {status}
                </button>
              );
            })}
          </div>
        </div>

        {/* Power Dependencies */}
        <div className="space-y-3">
          <label className="flushed-label font-bold text-xs uppercase tracking-wider block">Power Dependencies</label>
          <div className="flex flex-wrap gap-2.5">
            {['Oxygen', 'CPAP', 'Refrigerated Meds', 'None'].map(dep => {
              const isSelected = powerDependencies.includes(dep);
              return (
                <button
                  key={dep}
                  type="button"
                  onClick={() => handleToggleMulti(dep, powerDependencies, setPowerDependencies)}
                  className={`py-3 px-5 border text-xs font-mono font-bold uppercase transition-all ${
                    isSelected
                      ? 'bg-aura-hero text-white border-aura-ink shadow-sm'
                      : 'bg-white text-aura-ink border-aura-ink/40 hover:bg-aura-bg'
                  }`}
                >
                  {dep}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sensory Impairments */}
        <div className="space-y-3">
          <label className="flushed-label font-bold text-xs uppercase tracking-wider block">Sensory Impairments</label>
          <div className="flex flex-wrap gap-2.5">
            {['Deaf/HOH', 'Blind/Low Vision', 'None'].map(imp => {
              const isSelected = sensoryImpairments.includes(imp);
              return (
                <button
                  key={imp}
                  type="button"
                  onClick={() => handleToggleMulti(imp, sensoryImpairments, setSensoryImpairments)}
                  className={`py-3 px-5 border text-xs font-mono font-bold uppercase transition-all ${
                    isSelected
                      ? 'bg-aura-hero text-white border-aura-ink shadow-sm'
                      : 'bg-white text-aura-ink border-aura-ink/40 hover:bg-aura-bg'
                  }`}
                >
                  {imp}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Card 4: Emergency Contact */}
      <div className="bg-white border border-aura-ink p-6 md:p-8 rounded-none shadow-sm space-y-6">
        <div className="flex items-center gap-2 border-b border-aura-ink/10 pb-3">
          <Phone className="w-5 h-5 text-aura-hero" />
          <h4 className="font-serif text-lg font-bold text-aura-ink">Card 4: Emergency Contact</h4>
        </div>

        <div className="space-y-4">
          <div>
            <label className="flushed-label">Emergency Contact Name</label>
            <input 
              type="text"
              value={emergencyContactName} 
              onChange={(e) => setEmergencyContactName(e.target.value)}
              className="flushed-input font-sans text-sm"
              placeholder="e.g. Argha Ghosh"
            />
          </div>

          <div>
            <label className="flushed-label">Emergency Contact Mobile</label>
            <input 
              type="text" 
              value={emergencyContactPhone} 
              onChange={(e) => setEmergencyContactPhone(e.target.value)}
              className="flushed-input font-mono text-sm"
              placeholder="e.g. +91 98300 12345"
            />
          </div>
        </div>
      </div>

      {/* Submit Trigger Actions */}
      <div className="pt-4 flex flex-col gap-3">
        {saveError && (
          <div className="bg-aura-sos/10 border border-aura-sos text-aura-sos text-xs py-2.5 px-3 rounded-none font-mono text-center leading-tight">
            {saveError}
          </div>
        )}
        <button
          type="submit"
          disabled={isSaving}
          className={`w-full py-4 font-sans font-bold text-sm uppercase rounded-full transition-all text-center flex items-center justify-center gap-2 border ${
            isSuccess
              ? 'bg-aura-card text-aura-hero border-aura-hero'
              : 'bg-aura-hero text-white border-aura-ink hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          {isSaving ? (
            'Saving...'
          ) : isSuccess ? (
            <>
              Profile Secured
              <Check className="w-4 h-4" />
            </>
          ) : (
            <>
              Save Medical Profile
              <Check className="w-4 h-4" />
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="w-full py-3.5 bg-white text-aura-ink border border-aura-ink font-mono text-xs font-bold uppercase rounded-full hover:bg-aura-bg transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          [ Cancel / Close ]
        </button>
      </div>
    </form>
  );
}

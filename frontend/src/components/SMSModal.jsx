import React, { useState, useEffect } from 'react';
import { X, MessageSquare, PhoneCall, ArrowRight, Clipboard } from 'lucide-react';

export default function SMSModal({ isOpen, onClose, payload, onSimulateDispatch }) {
  if (!isOpen) return null;

  // State for geolocation and handoff UI
  const [lat, setLat] = useState('Unknown');
  const [lng, setLng] = useState('Unknown');
  const [handoffStarted, setHandoffStarted] = useState(false);

  // Capture geolocation on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude.toFixed(4));
          setLng(position.coords.longitude.toFixed(4));
        },
        () => {
          setLat('Unknown');
          setLng('Unknown');
        }
      );
    }
  }, []);

  // Helper to generate compressed message
  const generatePackedMessage = () => {
    const base = `AURA_SOS | Lat:${lat},Lng:${lng} | ${payload}`;
    return encodeURIComponent(base);
  };

  // Copy raw packet helper
  const copyToClipboard = () => {
    navigator.clipboard.writeText(`AURA_SOS:${payload}`);
    alert('SOS Payload copied to clipboard!');
  };

  if (handoffStarted) {
    return (
      <div className="fixed inset-0 bg-aura-sos flex items-center justify-center z-50">
        <div className="bg-aura-sos border-2 border-aura-ink w-full max-w-2xl rounded-none p-12 text-center text-white font-serif">
          <h2 className="text-3xl font-bold mb-4">Simulating SMS Transmit...</h2>
          <p className="text-lg mb-6">AURA is bypassing your OS and routing the distress packet directly to the Twilio Webhook endpoint!</p>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); setHandoffStarted(false); onClose(); }}
            className="text-sm text-white underline"
          >
            Close Window
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-aura-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-aura-card border-2 border-aura-ink w-full max-w-xl rounded-none shadow-brutal p-8 relative animate-in fade-in zoom-in duration-200">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute right-6 top-6 p-1 text-aura-ink hover:text-aura-sos transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-aura-sos/10 rounded-full border border-aura-sos text-aura-sos">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-serif text-2xl font-bold text-aura-ink">Offline Crisis Dispatch</h3>
            <p className="text-xs font-mono text-aura-ink/60">NETWORK DISCONNECTED // RESILIENT DUAL-BRANCH ROUTING</p>
          </div>
        </div>

        {/* Explainer */}
        <div className="bg-aura-bg border border-aura-ink/30 p-4 mb-6 text-sm leading-relaxed text-aura-ink/80">
          <p>
            Cellular data is unavailable. AURA has compiled your credentials, GPS location, and critical medical dependencies into a 
            <strong> hyper-compressed 160-character crisis packet</strong>. Choose a low-bandwidth channel to transmit your distress signal:
          </p>
        </div>

        {/* Payload Display */}
        <div className="font-mono bg-aura-ink text-aura-bg p-5 text-xs mb-6 border border-aura-ink rounded-none relative overflow-x-auto break-all select-text">
          <div className="absolute right-3 top-3 text-[9px] text-white/40 tracking-widest font-mono">ENCRYPTED COGNITIVE PACKET</div>
          <span className="text-aura-sos font-bold">AURA_SOS</span>
          <span className="text-white">:</span>
          {payload}
        </div>

        {/* Dual Branch Toggles */}
        <div className="space-y-4">
          
          {/* SMS option */}
          <button
            onClick={() => {
              // 1. Trigger the native SMS dialer for demonstration purposes
              const smsBase = `sms:+12342184063?body=${generatePackedMessage()}`;
              const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
              const smsUrl = isIOS ? smsBase.replace('?body=', '&body=') : smsBase;
              window.location.href = smsUrl;
              
              // 2. Allow time for the OS prompt, then trigger the confirmation and pipeline handoff
              setTimeout(() => {
                if (onSimulateDispatch) onSimulateDispatch();
              }, 1500);
            }}
            className="w-full p-4 border border-aura-ink bg-white hover:bg-orange-50 text-left flex items-center justify-between transition-all group active:translate-y-0.5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📱</span>
              <div>
                <h4 className="font-serif font-bold text-sm text-aura-ink">Branch 2: Native SMS Offline Mode</h4>
                <p className="text-xs text-aura-ink/60 mt-0.5">Zero-data cellular fallback. Encoded coordinates sent natively as a SMS text.</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-aura-ink group-hover:translate-x-1 transition-transform" />
          </button>

        </div>

        {/* Copy Auxiliary Utility */}
        <div className="mt-6 pt-4 border-t border-aura-ink/10 flex justify-between items-center text-xs">
          <span className="text-aura-ink/40 font-mono">Emergency Contact: +91 98765 43210</span>
          <button 
            onClick={copyToClipboard}
            className="text-aura-sos font-bold hover:underline font-mono"
          >
            [ Copy Raw Packet ]
          </button>
        </div>

      </div>
    </div>
  );
}

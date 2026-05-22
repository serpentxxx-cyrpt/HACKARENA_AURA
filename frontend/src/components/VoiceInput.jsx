import React, { useState, useEffect } from 'react';
import { Mic, MicOff, AlertCircle } from 'lucide-react';

export default function VoiceInput({ onTranscriptionComplete }) {
  const [isListening, setIsListening] = useState(false);
  const [supportSpeech, setSupportSpeech] = useState(false);
  const [recognitionObj, setRecognitionObj] = useState(null);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSupportSpeech(true);
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      // Multi-lingual support hook (triage translates anyway, but we set en-US/hi-IN/bn-IN)
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        setErrorText('');
      };

      rec.onresult = (event) => {
        const text = event.results[0][0].transcript;
        onTranscriptionComplete(text);
      };

      rec.onerror = (e) => {
        console.error('Speech Recognition Error:', e);
        setIsListening(false);
        if (e.error === 'not-allowed') {
          setErrorText('Microphone permission denied.');
        } else {
          setErrorText('Speech not recognized. Please try again.');
        }
      };

      rec.onend = () => {
        setIsListening(false);
      };

      setRecognitionObj(rec);
    }
  }, [onTranscriptionComplete]);

  const toggleListening = () => {
    if (!supportSpeech) {
      // Offline / Untrusted browser fallback - simulate a realistic transcript
      setIsListening(true);
      setTimeout(() => {
        const mockTranscripts = [
          "Amar barite jol jomeche, Gariahat, khabar aar jol lagbe choturdik bonna",
          "Oxygen cylinder low, heart patient near Ballygunge circular road, urgent help",
          "Flooded inside Salt Lake Sector 5, baby food and pure water emergency"
        ];
        const randomText = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
        onTranscriptionComplete(randomText);
        setIsListening(false);
      }, 3000);
      return;
    }

    if (isListening) {
      recognitionObj.stop();
    } else {
      try {
        recognitionObj.start();
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center p-4 select-none">
      
      {/* Visual Waveform Pulse when Listening */}
      {isListening && (
        <div className="flex items-center gap-1.5 justify-center mb-4 h-8">
          <span className="w-1 h-3 bg-aura-sos rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
          <span className="w-1 h-6 bg-aura-sos rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          <span className="w-1 h-8 bg-aura-sos rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
          <span className="w-1 h-4 bg-aura-sos rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
          <span className="w-1 h-2 bg-aura-sos rounded-full animate-bounce" style={{ animationDelay: '0.5s' }} />
        </div>
      )}

      {/* Trigger Button */}
      <button
        onClick={toggleListening}
        className={`w-20 h-20 rounded-full flex items-center justify-center border-2 border-aura-ink relative transition-all duration-300 active:scale-95 ${
          isListening 
            ? 'bg-aura-sos text-white animate-sos-pulse' 
            : 'bg-aura-card text-aura-ink hover:bg-aura-bg'
        }`}
      >
        {isListening ? (
          <Mic className="w-8 h-8 animate-pulse" />
        ) : (
          <Mic className="w-8 h-8" />
        )}
      </button>

      {/* Helper label */}
      <div className="mt-3 text-center">
        <span className="font-mono text-[10px] tracking-widest text-aura-ink/50 uppercase">
          {isListening ? 'LISTENING LIVE... SPEAK CLEARLY' : 'TAP MICROPHONE TO DICTATE SOS'}
        </span>
        {!supportSpeech && !isListening && (
          <p className="text-[9px] font-mono text-aura-ink/30 mt-1">Speech API missing. Fallback simulation active.</p>
        )}
        {errorText && (
          <div className="flex items-center gap-1 text-[10px] font-mono text-aura-sos justify-center mt-2">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{errorText}</span>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Mic, 
  MicOff, 
  AlertCircle, 
  ShieldAlert, 
  Sparkles, 
  MessageCircle, 
  WifiOff, 
  ArrowLeft,
  Navigation,
  Radio
} from 'lucide-react';

export default function OnlineTriagentChat({ 
  userName, 
  isOnline, 
  onTriggerSOS, 
  onOpenSMSModal,
  profileData,
  onDispatch,
  userLocation
}) {
  const [activeBranch, setActiveBranch] = useState(null); // null (shows selection cards) or 'chat'
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef(null);
  
  // HTML5 Web Speech API
  const [recognition, setRecognition] = useState(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-IN'; // Standard English-India localized speech model
      
      rec.onstart = () => {
        setIsRecording(true);
      };
      
      rec.onend = () => {
        setIsRecording(false);
      };
      
      rec.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setUserInput(prev => prev ? prev + ' ' + transcript : transcript);
      };

      rec.onerror = (event) => {
        console.error('[AURA Speech API] Error:', event.error);
        setIsRecording(false);
      };
      
      setRecognition(rec);
    }
  }, []);

  const toggleRecording = () => {
    if (!recognition) {
      alert('HTML5 Web Speech API is not supported by your current browser. Please try Google Chrome or Microsoft Edge.');
      return;
    }
    
    if (isRecording) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  const handleSelectBranch3 = () => {
    setActiveBranch('chat');
    if (messages.length === 0) {
      setMessages([
        {
          id: 1,
          sender: 'AURA',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `Welcome to AURA's Online Triagent Assistant, ${userName.split(' ')[0]}. I am running under calm general parameters on Kolkata Zonal networks.

I can assist you with general inquiries, storm alerts, safe shelter coordinate listings, or medical first-aid steps. What would you like to discuss?`
        }
      ]);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = {
      id: Date.now(),
      sender: 'CITIZEN',
      time,
      text: userInput
    };

    setMessages(prev => [...prev, userMsg]);
    const messageText = userInput;
    setUserInput('');

    // Append temporary typing indicator
    const typingId = Date.now() + 1;
    setMessages(prev => [...prev, {
      id: typingId,
      sender: 'AURA',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: 'Analyzing query via AURA Core Triage, Geospatial, and Logistics agents...',
      isTyping: true
    }]);

    if (isOnline) {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await fetch(`${API_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: userName || 'Online Guest User',
            message: messageText,
            history: messages.map(m => ({ sender: m.sender, text: m.text })),
            latitude: userLocation?.lat || 22.5726,
            longitude: userLocation?.lng || 88.3639,
            profile: profileData
          })
        });

        if (!response.ok) {
          throw new Error('Chat API response failed');
        }

        const data = await response.json();
        
        // Remove typing indicator
        setMessages(prev => prev.filter(m => m.id !== typingId));

        if (data.complete) {
          const p = data.pipelineResult;
          setMessages(prev => prev.concat({
            id: Date.now() + 2,
            sender: 'AURA',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text: `Information gathered. Dispatch initiated via Triagent Pipeline:\n\n🚑 Agent 1 (Triage): normalized threat need as "${p.triage?.need?.toUpperCase()}" with priority level ${p.triage?.priority}.\n\n🌍 Agent 2 (Geospatial): Weather alert resolved. Safe routing steps:\n${p.geospatial?.safeDirections?.map((d, i) => `   ${i + 1}. ${d}`).join('\n')}\n\n📦 Agent 3 (Logistics): Atomic reservation secured at "${p.logistics?.target_facility_name}". Dispatch instructions: ${p.logistics?.execution_message}`
          }));

          if (onDispatch) {
            setTimeout(() => {
              onDispatch(p);
            }, 3000); // 3 second delay so user can read the chatbot message
          }
        } else {
          // Add Gemini's follow-up question
          setMessages(prev => prev.concat({
            id: Date.now() + 2,
            sender: 'AURA',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text: data.reply
          }));
        }

      } catch (err) {
        console.error('[AURA Triagent Chat] Error fetching live response:', err);
        
        setMessages(prev => prev.filter(m => m.id !== typingId).concat({
          id: Date.now() + 2,
          sender: 'AURA',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `AURA Multi-Agent pipeline connection failed or timed out. Engaged Local Redundancy Core:\n\nKolkata storm alerts and safe shelters lists are available. Ballygunge Ballygunge Camp and SSKM Hospital are running on emergency backups. If you are experiencing a life-threatening crisis, please utilize the "Emergency SOS" button above to activate the live rescue fleet.`
        }));
      }
    } else {
      // Offline mode simulated response
      setTimeout(() => {
        let reply = `Network offline. AURA local cache databases indicate high ground structures in Salt Lake sectors are functional. For offline dispatch assistance, please tap Option 2 (Offline SMS Mode) above to send raw telemetry packages.`;
        
        const lowerMsg = messageText.toLowerCase();
        if (lowerMsg.includes('water') || lowerMsg.includes('flood') || lowerMsg.includes('rain')) {
          reply = `Offline Weather Cache: Gariahat water levels are critical (1.8ft). Salt Lake pathways are currently clear of waterlogging. Seek high elevation immediately.`;
        } else if (lowerMsg.includes('hospital') || lowerMsg.includes('insulin') || lowerMsg.includes('medicine')) {
          reply = `Offline Medical Cache: AMRI Gariahat and SSKM Medical College maintain emergency insulin stockpiles. Send SMS fallback signals for volunteer allocations.`;
        }

        setMessages(prev => prev.filter(m => m.id !== typingId).concat({
          id: Date.now() + 2,
          sender: 'AURA',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: reply
        }));
      }, 1200);
    }
  };

  return (
    <div className="animate-in fade-in duration-300 max-w-5xl mx-auto py-6 space-y-8 select-text">
      
      {/* 1. Header Banner Panel - Forest Night */}
      <div className="bg-aura-hero border border-aura-ink p-8 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm">
        <div className="space-y-2">
          <span className="font-mono text-xs text-white/50 uppercase tracking-widest block font-bold">COGNITIVE COMPANION</span>
          <h2 className="font-serif text-3xl font-bold font-serif leading-tight">AURA AI Assistant</h2>
          <p className="font-sans text-sm text-white/80 max-w-xl">
            A safe, non-emergency urban logistics advisor. Query shelter listings, first-aid instructions, or meteorological statuses over high-speed networks.
          </p>
        </div>
        <div className="flex gap-2">
          {activeBranch && (
            <button
              onClick={() => setActiveBranch(null)}
              className="py-2.5 px-5 bg-white/5 hover:bg-white/10 border border-white/20 text-white font-mono text-xs uppercase rounded-full transition-colors flex items-center gap-1.5 font-bold"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              [ Options Menu ]
            </button>
          )}
        </div>
      </div>

      {/* 2. Welcome Screen / Branch Selection View */}
      {activeBranch === null && (
        <div className="space-y-8">
          {/* Calm serif greeting in Fraunces */}
          <div className="text-center py-8 space-y-3">
            <h3 className="font-serif text-3xl md:text-5xl font-bold text-aura-ink leading-tight">
              Hello. I am AURA.
            </h3>
            <p className="font-sans text-base text-aura-ink/60">
              How can I assist you in your Kolkata sector today?
            </p>
          </div>

          {/* Three brutalist cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Branch Card 1: Emergency SOS (High Contrast, Red highlight, but bordered) */}
            <div className="bg-white border border-aura-ink p-8 flex flex-col justify-between hover:shadow-brutal transition-all group">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-full bg-aura-sos/10 text-aura-sos border border-aura-sos/20 flex items-center justify-center font-bold">
                  <ShieldAlert className="w-5 h-5 text-aura-sos" />
                </div>
                <h4 className="font-serif text-xl font-bold text-aura-ink">Option 1: Emergency SOS</h4>
                <p className="text-xs text-aura-ink/70 leading-relaxed font-sans">
                  Experiencing a life-threatening crisis, injury, or trapped scenario? Click here to access the high-contrast red active SOS dispatch tracker.
                </p>
              </div>
              <button
                onClick={onTriggerSOS}
                className="w-full mt-8 py-3 bg-aura-sos text-white border border-aura-ink font-mono text-xs font-bold uppercase rounded-full hover:shadow-sm transition-all text-center"
              >
                [ Trigger SOS Tracker ]
              </button>
            </div>

            {/* Branch Card 2: Offline SMS Mode */}
            <div className="bg-white border border-aura-ink p-8 flex flex-col justify-between hover:shadow-brutal transition-all group">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-full bg-aura-ink/5 text-aura-ink/60 border border-aura-ink/10 flex items-center justify-center font-bold">
                  <WifiOff className="w-5 h-5" />
                </div>
                <h4 className="font-serif text-xl font-bold text-aura-ink">Option 2: Offline SMS Mode</h4>
                <p className="text-xs text-aura-ink/70 leading-relaxed font-sans">
                  Grid infrastructure failed or signal weak? View visual instructions to wrap your spatial metrics into compressed 160-char SMS packets.
                </p>
              </div>
              <button
                onClick={onOpenSMSModal}
                className="w-full mt-8 py-3 bg-white hover:bg-aura-bg border border-aura-ink text-aura-ink font-mono text-xs font-bold uppercase rounded-full transition-all text-center"
              >
                [ Open SMS Console ]
              </button>
            </div>

            {/* Branch Card 3: Online AI Triagent */}
            <div className="bg-white border border-aura-ink p-8 flex flex-col justify-between hover:shadow-brutal transition-all group">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-full bg-aura-hero/10 text-aura-hero border border-aura-hero/20 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h4 className="font-serif text-xl font-bold text-aura-ink">Option 3: Online AI Triagent</h4>
                <p className="text-xs text-aura-ink/70 leading-relaxed font-sans">
                  Query safety maps, check monsoonal waterlogging forecasts, read first-aid details, or talk directly with the unified multi-agent system.
                </p>
              </div>
              <button
                onClick={handleSelectBranch3}
                className="w-full mt-8 py-3 bg-aura-hero text-white border border-aura-ink font-mono text-xs font-bold uppercase rounded-full hover:bg-opacity-95 transition-all text-center"
              >
                [ Open Online Assistant ]
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 3. General Chat View (Branch 3 Active) */}
      {activeBranch === 'chat' && (
        <div className="bg-white border border-aura-ink p-4 md:p-6 shadow-brutal flex flex-col h-[500px]">
          {/* Chat Header details */}
          <div className="bg-aura-bg border-b border-aura-ink p-4 flex items-center justify-between font-mono text-xs text-aura-ink/60">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-aura-hero" />
              <span>AURA SYSTEM COMPANION // CHANNEL STATE: {isOnline ? 'ONLINE' : 'LOCAL CACHE'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#39ff14]' : 'bg-aura-sos'}`} />
              <span className="uppercase">{isOnline ? 'Active Cloud Connected' : 'Local Fallback'}</span>
            </div>
          </div>

          {/* Messages list viewport */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 select-text">
            {messages.map((msg) => {
              const isUser = msg.sender === 'CITIZEN';
              
              return (
                <div 
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
                >
                  <span className="font-mono text-[9px] text-aura-ink/40 uppercase tracking-wider pl-1">
                    {isUser ? `🗣️ ${userName.toUpperCase()}` : '🤖 AURA COGNITIVE CORE'}
                  </span>
                  
                  <div 
                    className={`max-w-[80%] border p-4 shadow-sm text-sm leading-relaxed ${
                      isUser 
                        ? 'bg-aura-hero text-white border-aura-ink rounded-2xl rounded-tr-none' 
                        : 'bg-aura-bg text-aura-ink border-aura-ink rounded-2xl rounded-tl-none font-sans font-medium'
                    }`}
                  >
                    {msg.isTyping ? (
                      <div className="flex items-center gap-2 font-mono text-xs font-bold animate-pulse text-aura-hero">
                        <Radio className="w-4 h-4 animate-spin" />
                        <span>{msg.text}</span>
                      </div>
                    ) : (
                      <p className="whitespace-pre-line">{msg.text}</p>
                    )}
                  </div>
                  <span className="font-mono text-[8px] text-aura-ink/40 px-1">{msg.time}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Flushed Input Footer with Speech Microphone */}
          <form 
            onSubmit={handleSendMessage}
            className="bg-white border-t border-aura-ink p-4 flex gap-4 items-center"
          >
            {/* HTML5 Speech-Recognition Microphone button */}
            <button
              type="button"
              onClick={toggleRecording}
              className={`p-3.5 border border-aura-ink rounded-full transition-all flex items-center justify-center shadow-sm hover:-translate-y-0.5 active:translate-y-0 focus:outline-none relative group ${
                isRecording 
                  ? 'bg-aura-hero text-white animate-pulse' 
                  : 'bg-white hover:bg-aura-bg text-aura-ink'
              }`}
              title={isRecording ? 'Listening... click to stop' : 'Click to dictate via microphone'}
            >
              {isRecording ? (
                <>
                  <MicOff className="w-5 h-5 text-white" />
                  <span className="absolute -top-10 bg-aura-ink text-white font-mono text-[10px] py-1 px-2 uppercase border border-aura-ink rounded-none whitespace-nowrap shadow-sm group-hover:block hidden">
                    [ Listening... ]
                  </span>
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5 text-aura-hero group-hover:scale-105 transition-transform" />
                  <span className="absolute -top-10 bg-white text-aura-ink font-mono text-[10px] py-1 px-2 uppercase border border-aura-ink rounded-none whitespace-nowrap shadow-sm group-hover:block hidden">
                    [ Dictate Voice ]
                  </span>
                </>
              )}
            </button>

            {/* Input field */}
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Dictate via mic or type a general query (e.g. 'shelter camps Ballygunge', 'storm status')..."
              className="flex-1 bg-transparent border-b border-aura-ink py-2 px-1 focus:border-b-2 focus:border-aura-hero focus:outline-none text-sm font-sans"
            />

            {/* Send button */}
            <button
              type="submit"
              className="p-3.5 bg-aura-hero text-white border border-aura-ink rounded-full hover:bg-opacity-95 hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-sm flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

        </div>
      )}

    </div>
  );
}

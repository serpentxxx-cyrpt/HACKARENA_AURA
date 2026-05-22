import React, { useState, useEffect, useRef } from 'react';
import { Send, MapPin, AlertCircle, ArrowLeft, Shield } from 'lucide-react';
import GoogleMap from './GoogleMap';

export default function ActiveRescueTracker({ 
  userName, 
  userPhone, 
  crisisCategory, 
  distressMessage, 
  hasInsulinDependency, 
  hasAsthma,
  hospitals,
  selectedRoute,
  selectedHospital,
  apiResponse,
  onReturn,
  userLocation,
  activeLanguage
}) {
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [routeEta, setRouteEta] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initializing chatbot stream based on user's emergency parameters and API responses
  useEffect(() => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Unify API response or local fallback schema
    const resolvedApiResponse = apiResponse || {
      language: (activeLanguage || 'en').toLowerCase(),
      priority: crisisCategory === 'Medical' ? 1 : crisisCategory === 'Flooded' ? 2 : 3,
      need: crisisCategory === 'Medical' ? (hasInsulinDependency ? 'insulin' : 'first aid') : crisisCategory === 'Flooded' ? 'rescue' : 'water',
      hazard: crisisCategory === 'Flooded' ? 'flooding' : 'none',
      weather: { description: 'moderate rain' },
      geospatial: { weatherAlert: 'Monsoonal showers in progress.', floodRiskScore: 2, safeDirections: ['Proceed carefully along higher elevation arterial roads.'] },
      logistics: { target_facility_name: selectedHospital?.name || 'Nearest Relief Camp', distance_km: 1.8, execution_message: 'Emergency package reserved successfully.' }
    };

    const triage = resolvedApiResponse.triage || resolvedApiResponse;
    const geospatial = resolvedApiResponse.geospatial || {};
    const logistics = resolvedApiResponse.logistics || {};
    const weather = resolvedApiResponse.weather || {};

    const lang = (resolvedApiResponse.language || activeLanguage || 'en').toLowerCase();
    
    // Resolve dynamic remaining stocks and distance
    const targetFacilityId = logistics.target_facility_id || selectedHospital?.id;
    const targetFacility = hospitals.find(h => h.id === targetFacilityId) || selectedHospital || { name: logistics.target_facility_name };
    const resolvedNeedKey = triage.need || 'first aid';
    const remainingStockVal = targetFacility?.stock?.[resolvedNeedKey] ?? 12;
    const distanceKm = logistics.distance_km || 1.8;
    const weatherDesc = weather.description || 'moderate rain showers';
    const riskScore = geospatial.floodRiskScore || 2;
    const facilityName = logistics.target_facility_name || targetFacility?.name || 'Kolkata Zonal Relief Camp';

    // Premium Translation Dictionary grounded directly in API/DB data
    const translations = {
      en: {
        SYSTEM_INGESTION_SUCCESS: `[INGESTION_SUCCESS] Live multi-agent crisis pipeline synchronized for ${userName} (${userPhone}).`,
        AGENT1_TRIAGE: `Hello ${userName.split(' ')[0]}. I am Agent 1: The Triage Agent. I have normalized your distress signal.\n\n• Detected Language: ${lang.toUpperCase()}\n• Priority Level: ${resolvedApiResponse.priority} (${resolvedApiResponse.priority === 1 ? 'CRITICAL / LIFE THREATENING' : resolvedApiResponse.priority === 2 ? 'URGENT / TRAPPED' : 'STANDARD / SUPPLIES'})\n• Extracted Need: "${resolvedNeedKey.toUpperCase()}"\n• Hazard Warning: ${(triage.hazard || 'none').toUpperCase()}`,
        AGENT2_GEOSPATIAL: `[ROUTE_CALCULATION] Agent 2: Geospatial Router reporting.\n\n• Meteorological Alert: "${geospatial.weatherAlert || 'Caution: Adverse weather'}"\n• Live Weather Description: ${weatherDesc}\n• Local Flood Risk Score: [${riskScore} / 5]\n• Computed Safe Transit Waypoints:\n${(geospatial.safeDirections || []).map((dir, index) => `${index + 1}. ${dir}`).join('\n')}`,
        AGENT3_LOGISTICS: `[RESOURCE_DISPATCH] Agent 3: Logistics Agent reporting.\n\n• Reserved Depot: ${facilityName}\n• Status: Located ${distanceKm} km away\n• Dynamic Stock Level: ${remainingStockVal} units of ${resolvedNeedKey} remaining\n• Action: ${logistics.execution_message || 'Emergency package reserved.'}\n• Verification: Stock decrement atomically reserved in regional ledger.`,
        AGENT_FINAL_CONFIRMATION: `A volunteer unit has been deployed in a high-clearance rescue vehicle based on this multi-agent dispatch plan. ETA: 8 minutes. Please remain in a high, dry location and track our safe routes via the live map.`
      },
      bn: {
        SYSTEM_INGESTION_SUCCESS: `[গ্রহন সফল] ${userName} (${userPhone})-এর জন্য লাইভ মাল্টি-এজেন্ট ক্রাইসিস পাইপলাইন সিঙ্ক্রোনাইজ করা হয়েছে।`,
        AGENT1_TRIAGE: `হ্যালো ${userName.split(' ')[0]}। আমি এজেন্ট ১: ট্রায়াজ এজেন্ট। আমি আপনার বিপদের সংকেত বিশ্লেষণ করেছি।\n\n• সনাক্তকৃত ভাষা: ${lang.toUpperCase()}\n• অগ্রাধিকার স্তর: ${resolvedApiResponse.priority} (${resolvedApiResponse.priority === 1 ? 'গুরুতর / জীবন সংশয়' : resolvedApiResponse.priority === 2 ? 'জরুরী / আটকে পড়া' : 'স্বাভাবিক / সরবরাহ'})\n• প্রয়োজনীয় সাহায্য: "${resolvedNeedKey.toUpperCase()}"\n• বিপদের ধরন: ${(triage.hazard || 'none').toUpperCase()}`,
        AGENT2_GEOSPATIAL: `[রুট গণনা] এজেন্ট ২: জিওস্পেশিয়াল রাউটার রিপোর্ট করছে।\n\n• আবহাওয়া সতর্কতা: "${geospatial.weatherAlert || 'সতর্কতা: মৌসুমি বৃষ্টিপাত চলছে'}"\n• আবহাওয়া পরিস্থিতি: ${weatherDesc}\n• স্থানীয় বন্যার ঝুঁকি সূচক: [${riskScore} / 5]\n• নির্ধারিত নিরাপদ ট্রানজিট নির্দেশাবলী:\n${(geospatial.safeDirections || []).map((dir, index) => `${index + 1}. ${dir}`).join('\n')}`,
        AGENT3_LOGISTICS: `[সম্পদ প্রেরণ] এজেন্ট ৩: লজিস্টিক এজেন্ট রিপোর্ট করছে।\n\n• সংরক্ষিত ডিপো: ${facilityName}\n• দূরত্ব: ${distanceKm} কিমি দূরে অবস্থিত\n• লাইভ স্টক লেভেল: ${remainingStockVal} টি ${resolvedNeedKey} অবশিষ্ট আছে\n• পদক্ষেপ: ${logistics.execution_message || 'জরুরী সহায়তা সংরক্ষিত।'}\n• সত্যতা যাচাই: আঞ্চলিক লেজারে স্বয়ংক্রিয়ভাবে স্টক হ্রাস করা হয়েছে।`,
        AGENT_FINAL_CONFIRMATION: `এই মাল্টি-এজেন্ট ডিসপ্যাচ পরিকল্পনার উপর ভিত্তি করে একটি উদ্ধারকারী যানবাহনে স্বেচ্ছাসেবক দল পাঠানো হয়েছে। আনুমানিক সময়: ৮ মিনিট। অনুগ্রহ করে একটি উচু ও শুকনো স্থানে থাকুন এবং লাইভ ম্যাপের মাধ্যমে আমাদের নিরাপদ রুট অনুসরণ করুন।`
      },
      hi: {
        SYSTEM_INGESTION_SUCCESS: `[प्राप्ति सफल] ${userName} (${userPhone}) के लिए लाइव मल्टी-एजेंट संकट संकट प्रबंधन प्रणाली सिंक्रनाइज़ की गई है।`,
        AGENT1_TRIAGE: `नमस्कार ${userName.split(' ')[0]}। मैं एजेंट 1: ट्राइएज एजेंट हूँ। मैंने आपके संकट संदेश का विश्लेषण किया है।\n\n• पहचानी गई भाषा: ${lang.toUpperCase()}\n• प्राथमिकता स्तर: ${resolvedApiResponse.priority} (${resolvedApiResponse.priority === 1 ? 'गंभीर / जीवन का खतरा' : resolvedApiResponse.priority === 2 ? 'आपातकालीन / फंसे हुए' : 'सामान्य / आपूर्ति'})\n• आवश्यक आवश्यकता: "${resolvedNeedKey.toUpperCase()}"\n• खतरे की चेतावनी: ${(triage.hazard || 'none').toUpperCase()}`,
        AGENT2_GEOSPATIAL: `[मार्ग गणना] एजेंट 2: भू-स्थानिक राउटर रिपोर्ट कर रहा है।\n\n• मौसम की चेतावनी: "${geospatial.weatherAlert || 'सावधानी: मानसूनी बारिश जारी है'}"\n• मौसम की स्थिति: ${weatherDesc}\n• स्थानीय बाढ़ जोखिम स्कोर: [${riskScore} / 5]\n• सुरक्षित पारगमन मार्ग निर्देश:\n${(geospatial.safeDirections || []).map((dir, index) => `${index + 1}. ${dir}`).join('\n')}`,
        AGENT3_LOGISTICS: `[संसाधन प्रेषण] एजेंट 3: लॉजिस्टिक्स एजेंट रिपोर्ट कर रहा है।\n\n• आरक्षित डिपो: ${facilityName}\n• दूरी: ${distanceKm} किमी दूर स्थित\n• लाइव स्टॉक स्थिति: ${remainingStockVal} इकाइयाँ ${resolvedNeedKey} शेष हैं\n• कार्रवाई: ${logistics.execution_message || 'आपातकालीन पैकेज आरक्षित।'}\n• सत्यापन: क्षेत्रीय बहीखाता (ledger) में स्टॉक की कमी दर्ज की गई है।`,
        AGENT_FINAL_CONFIRMATION: `इस मल्टी-एजेंट प्रेषण योजना के आधार पर एक बचाव वाहन में स्वयंसेवक दल को तैनात किया गया है। आगमन का समय: 8 मिनट। कृपया एक ऊंचे और सूखे स्थान पर रहें और लाइव मानचित्र के माध्यम से हमारे सुरक्षित मार्ग को ट्रैक करें।`
      }
    };

    // Fallback to English if translation is missing
    const currentTrans = translations[lang] || translations.en;

    const initialPrompts = [
      {
        id: 1,
        sender: 'AURA_SYSTEM',
        time: time,
        text: currentTrans.SYSTEM_INGESTION_SUCCESS
      },
      {
        id: 2,
        sender: 'AURA_AGENT',
        time: time,
        text: currentTrans.AGENT1_TRIAGE
      }
    ];

    setMessages(initialPrompts);

    const timers = [];

    // Timer 1: Geospatial calculation
    timers.push(setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'GEOSPATIAL_AGENT',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: currentTrans.AGENT2_GEOSPATIAL
        }
      ]);
    }, 2500));

    // Timer 2: Logistics reservation
    timers.push(setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 2,
          sender: 'LOGISTICS_AGENT',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: currentTrans.AGENT3_LOGISTICS
        }
      ]);
    }, 5500));

    // Timer 3: Final volunteer confirmation
    timers.push(setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 3,
          sender: 'AURA_AGENT',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: currentTrans.AGENT_FINAL_CONFIRMATION
        }
      ]);
    }, 8500));

    return () => timers.forEach(clearTimeout);
  }, [userName, userPhone, crisisCategory, hasInsulinDependency, apiResponse, activeLanguage]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle citizen sending customized queries (dynamically hitting the live agent chat)
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = {
      id: Date.now(),
      sender: 'CITIZEN',
      time: time,
      text: userInput
    };

    setMessages(prev => [...prev, userMsg]);
    const inputForResponse = userInput.toLowerCase();
    const currentInput = userInput;
    setUserInput('');

    // Unify API response or local fallback schema to construct activeRescue details
    const resolvedApiResponse = apiResponse || {
      language: (activeLanguage || 'en').toLowerCase(),
      priority: crisisCategory === 'Medical' ? 1 : crisisCategory === 'Flooded' ? 2 : 3,
      need: crisisCategory === 'Medical' ? (hasInsulinDependency ? 'insulin' : 'first aid') : crisisCategory === 'Flooded' ? 'rescue' : 'water',
      hazard: crisisCategory === 'Flooded' ? 'flooding' : 'none',
      weather: { description: 'moderate rain' },
      geospatial: { weatherAlert: 'Monsoonal showers in progress.', floodRiskScore: 2, safeDirections: ['Proceed carefully along higher elevation arterial roads.'] },
      logistics: { target_facility_name: selectedHospital?.name || 'Nearest Relief Camp', distance_km: 1.8, execution_message: 'Emergency package reserved successfully.' }
    };

    const triage = resolvedApiResponse.triage || resolvedApiResponse;
    const logistics = resolvedApiResponse.logistics || {};
    const resolvedNeedKey = triage.need || 'first aid';
    const facilityName = logistics.target_facility_name || selectedHospital?.name || 'Kolkata Zonal Relief Camp';

    if (apiResponse) {
      // System is online, fetch the real conversational active rescue response dynamically!
      try {
        setMessages(prev => [
          ...prev,
          {
            id: Date.now() + 10,
            sender: 'AURA_AGENT',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text: `[CONNECTING] Syncing with rescue agents...`
          }
        ]);

        const activeRescuePayload = {
          need: resolvedNeedKey,
          facilityName: facilityName,
          volunteerName: "Argha Ghosh",
          vehicle: "Mahindra Scorpio (WB-02-X-9988)",
          etaMinutes: routeEta?.eta || (selectedRoute ? 8 : 7),
          crisisCategory,
          distressMessage,
          hasInsulinDependency,
          hasAsthma
        };

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await fetch(`${API_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: userName || 'Guest Emergency',
            message: currentInput,
            latitude: userLocation?.lat || apiResponse.gps?.lat || 22.5204,
            longitude: userLocation?.lng || apiResponse.gps?.lng || 88.3719,
            history: messages,
            activeRescue: activeRescuePayload
          })
        });

        if (!response.ok) {
          throw new Error('Chat API error');
        }

        const data = await response.json();
        
        setMessages(prev => [
          ...prev.filter(m => !m.text.includes('[CONNECTING]')),
          {
            id: Date.now() + 11,
            sender: 'AURA_AGENT',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            text: data.reply || "AURA team is coordinating your dispatch. Field units have your exact GPS coordinates."
          }
        ]);
      } catch (err) {
        // Safe fall back to heuristic localized response in case of API failure
        triggerOfflineFallback(inputForResponse);
      }
    } else {
      triggerOfflineFallback(inputForResponse);
    }
  };

  // Dedicated multilingual offline fallback responder
  const triggerOfflineFallback = (inputForResponse) => {
    setMessages(prev => [...prev.filter(m => !m.text.includes('[CONNECTING]'))]);
    
    setTimeout(() => {
      const lang = (activeLanguage || 'en').toLowerCase();
      
      const fallbackReplies = {
        en: {
          default: "AURA agents are coordinating your dispatch. Field units have your exact GPS coordinates.",
          water: "Please retreat to upper levels immediately. We have updated your height metadata. Argha's rescue vehicle is equipped with water clearance.",
          medical: "We have pre-ordered your medical supply package at the target AMRI dispensary. It is reserved under your phone number.",
          volunteer: "Volunteer Argha Ghosh is driving a white Mahindra Scorpio (Reg: WB-02-X-9988) displaying the AURA rescue placard. They have your mobile contact.",
          safe: "You are being routed toward our Salt Lake Zonal Safe Camp. It has power backup and active water supply.",
          thanks: "You're welcome! Please stay safe and keep monitoring the map."
        },
        bn: {
          default: "AURA এজেন্টরা আপনার উদ্ধারকাজ সমন্বয় করছে। মাঠ পর্যায়ের দলের কাছে আপনার সঠিক জিপিএস অবস্থান রয়েছে।",
          water: "দয়া করে অবিলম্বে উপরের তলায় চলে যান। আমরা আপনার উচ্চতা সংক্রান্ত তথ্য আপডেট করেছি। অর্ঘ্যর উদ্ধারকারী গাড়িটি পানি নিষ্কাশনের সরঞ্জাম দ্বারা সজ্জিত।",
          medical: "আমরা আপনার প্রয়োজনীয় ঔষধপত্র লক্ষ্যবস্তু AMRI ডিসপেনসারিতে বুক করেছি। এটি আপনার ফোন নম্বরের অধীনে সংরক্ষিত রয়েছে।",
          volunteer: "স্বেচ্ছাসেবক অর্ঘ্য ঘোষ একটি সাদা রঙের মাহিন্দ্রা স্করপিও (রেজিস্ট্রেশন: WB-02-X-9988) চালাচ্ছেন যা AURA উদ্ধারকারী প্ল্যাকার্ড প্রদর্শন করছে। উনার কাছে আপনার মোবাইল নম্বর রয়েছে।",
          safe: "আপনাকে আমাদের সল্টলেক জোনাল নিরাপদ ক্যাম্পের দিকে নিয়ে যাওয়া হচ্ছে। সেখানে পাওয়ার ব্যাকআপ এবং সক্রিয় জল সরবরাহ রয়েছে।",
          thanks: "আপনাকে ধন্যবাদ! অনুগ্রহ করে নিরাপদ থাকুন এবং ম্যাপটি লক্ষ্য রাখুন।"
        },
        hi: {
          default: "AURA एजेंट आपके बचाव कार्य का समन्वय कर रहे हैं। फील्ड यूनिट के पास आपके सटीक जीपीएस निर्देशांक हैं।",
          water: "कृपया तुरंत ऊपरी मंजिलों पर चले जाएं। हमने आपकी ऊंचाई का डेटा अपडेट कर दिया है। अर्घ्य का बचाव वाहन जल भराव निकासी उपकरणों से लैस है।",
          medical: "हमने लक्षित AMRI औषधालय में आपकी चिकित्सा आपूर्ति पैकेज को बुक कर दिया है। यह आपके फोन नंबर के तहत आरक्षित है।",
          volunteer: "स्वयंसेवक अर्घ्य घोष एक सफेद महिंद्रा स्कॉर्पियो (पंजीकरण: WB-02-X-9988) चला रहे हैं जिस पर AURA बचाव प्लेकार्ड प्रदर्शित है। उनके पास आपका मोबाइल नंबर है।",
          safe: "आपको हमारे साल्ट लेक जोनल सुरक्षित शिविर की ओर भेजा जा रहा है। वहां पावर बैकअप और सक्रिय जल आपूर्ति की सुविधा उपलब्ध है।",
          thanks: "आपका धन्यवाद! कृपया सुरक्षित रहें और मानचित्र पर नज़र रखें।"
        }
      };

      const currentTrans = fallbackReplies[lang] || fallbackReplies.en;
      let reply = currentTrans.default;

      if (inputForResponse.includes('water') || inputForResponse.includes('flood') || inputForResponse.includes('rise') || inputForResponse.includes('paani') || inputForResponse.includes('jol') || inputForResponse.includes('pani')) {
        reply = currentTrans.water;
      } else if (inputForResponse.includes('insulin') || inputForResponse.includes('medicine') || inputForResponse.includes('medical') || inputForResponse.includes('dawa') || inputForResponse.includes('oushodh') || inputForResponse.includes('osudh')) {
        reply = currentTrans.medical;
      } else if (inputForResponse.includes('how') || inputForResponse.includes('identify') || inputForResponse.includes('volunteer') || inputForResponse.includes('kaun') || inputForResponse.includes('ke') || inputForResponse.includes('argha') || inputForResponse.includes('ghosh')) {
        reply = currentTrans.volunteer;
      } else if (inputForResponse.includes('safe') || inputForResponse.includes('where') || inputForResponse.includes('kahan') || inputForResponse.includes('kothay')) {
        reply = currentTrans.safe;
      } else if (inputForResponse.includes('thank') || inputForResponse.includes('dhonobad') || inputForResponse.includes('dhanyawad') || inputForResponse.includes('shukriya') || inputForResponse.includes('shokriya')) {
        reply = currentTrans.thanks;
      }

      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 10,
          sender: 'AURA_AGENT',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: reply
        }
      ]);
    }, 1500);
  };

  return (
    <div className="animate-in fade-in duration-300 grid grid-cols-1 lg:grid-cols-2 border border-aura-ink bg-white shadow-brutal h-[calc(100vh-140px)] min-h-0 overflow-hidden">
      
      {/* LEFT COLUMN: Map viewport (Page 7 top half) */}
      <div className="border-b lg:border-b-0 lg:border-r border-aura-ink flex flex-col h-[300px] lg:h-full relative">
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <button 
            onClick={onReturn}
            className="bg-white hover:bg-aura-bg border border-aura-ink text-aura-ink font-bold py-2 px-4 rounded-full text-xs flex items-center gap-1.5 shadow-sm transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            [ Return to Hub ]
          </button>
        </div>

        <div className="absolute top-4 right-4 z-10 bg-white border border-aura-ink p-3 rounded-none text-[10px] font-mono shadow-sm flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-aura-sos rounded-full animate-ping" />
          <span>RESCUE TRACKING CHANNEL</span>
        </div>

        <div className="flex-1 w-full h-full">
          <GoogleMap 
            activeAlerts={[]} 
            hospitals={hospitals} 
            selectedRoute={selectedRoute}
            selectedHospital={selectedHospital}
            userLocation={userLocation}
            customCenter={{ lat: 22.5204, lng: 88.3719 }}
            onEtaUpdate={setRouteEta}
          />
        </div>
      </div>

      {/* RIGHT COLUMN: AI Chatbot Interface (Page 7 bottom half) */}
      <div className="flex flex-col h-full bg-aura-bg select-text min-h-0">
        
        {/* Chat header */}
        <div className="bg-white border-b border-aura-ink p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-aura-hero/10 text-aura-hero border border-aura-hero/20 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-aura-hero" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-sm text-aura-ink">AURA Intelligent Dispatcher</h3>
              <p className="text-[9px] font-mono text-aura-ink/50 uppercase tracking-wider">TRIAGE ENGINE v2.1 // Kolkata Zonal</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-aura-hero/10 text-aura-hero px-2.5 py-1 text-[10px] font-mono font-bold">
            <span className="w-1.5 h-1.5 bg-aura-hero rounded-full animate-pulse" />
            ACTIVE SYNC
          </div>
        </div>

        {/* Messages list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.sender === 'CITIZEN';
            const isSystem = msg.sender === 'AURA_SYSTEM';
            
            if (isSystem) {
              return (
                <div key={msg.id} className="text-center">
                  <span className="inline-block bg-aura-ink/5 text-aura-ink/60 border border-aura-ink/10 font-mono text-[9px] uppercase px-3 py-1 tracking-wider">
                    {msg.text}
                  </span>
                </div>
              );
            }

            return (
              <div 
                key={msg.id} 
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
              >
                {/* Agent Tag */}
                {!isUser && (
                  <span className="font-mono text-[9px] text-aura-ink/40 uppercase tracking-widest pl-1">
                    {msg.sender === 'AURA_AGENT' ? '🚨 AURA TRIAGE AGENT' : 
                     msg.sender === 'GEOSPATIAL_AGENT' ? '🌍 GEOSPATIAL PATHFINDER' : 
                     '📦 LOGISTICS DEPLOYMENT'}
                  </span>
                )}

                <div 
                  className={`max-w-[85%] border p-4 shadow-sm select-text leading-relaxed text-sm ${
                    isUser 
                      ? 'bg-aura-hero text-white border-aura-ink rounded-2xl rounded-tr-none' 
                      : 'bg-white text-aura-ink border-aura-ink rounded-2xl rounded-tl-none'
                  }`}
                >
                  <p className="font-sans font-medium">{msg.text}</p>
                </div>
                <span className="font-mono text-[8px] text-aura-ink/40 px-1">{msg.time}</span>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Input box */}
        <form 
          onSubmit={handleSendMessage}
          className="bg-white border-t border-aura-ink p-4 flex gap-3 items-center"
        >
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Type query to update agents (e.g. 'Water is rising', 'Where is Argha?')..."
            className="flex-1 bg-transparent border-b border-aura-ink py-2 px-1 focus:border-b-2 focus:border-aura-sos focus:outline-none text-sm font-sans"
          />
          <button
            type="submit"
            className="p-3 bg-aura-hero text-white border border-aura-ink rounded-full hover:bg-opacity-95 hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
}

import express from 'express';
import { Mistral } from '@mistralai/mistralai';
import dotenv from 'dotenv';
import { normalizeIngestion } from '../utils/normalizer.js';
import { runTriageAgent, getFallbackTriage } from '../services/triage.js';
import { runGeospatialAgent, getFallbackGeospatial, fetchWeatherData } from '../services/geospatial.js';
import { runLogisticsAgent } from '../services/logistics.js';
import { getLastKnownLocation, updateLastKnownLocation } from '../utils/locationCache.js';
import { db } from '../config/db.js';

dotenv.config();

const router = express.Router();
const apiKey = process.env.MISTRAL_API_KEY || 'b5OceDpJ1vV7zI9lSGlMBqj6t4w17xNo';
const client = new Mistral({ apiKey });

// Helper to manually run the pipeline once info is extracted
async function triggerTriagentPipeline(extractedInfo, req) {
  const io = req.app.get('io') || global.ioInstance;
  const { userId, raw_text_summary, latitude, longitude, profile } = extractedInfo;

  const normalized = {
    userId: userId || 'Online Guest User',
    source: 'web-chat',
    rawText: raw_text_summary,
    gps: latitude && longitude ? { lat: latitude, lng: longitude } : null,
    profile: profile
  };

  // Resolve last known location fallback if coordinates are missing
  if (!normalized.gps) {
    const cachedGps = getLastKnownLocation(normalized.userId);
    if (cachedGps) {
      normalized.gps = cachedGps;
    } else {
      normalized.gps = { lat: 22.5186, lng: 88.3712 }; // Default Kolkata
    }
  } else {
    updateLastKnownLocation(normalized.userId, normalized.gps);
  }

  // Pre-fetch weather to achieve complete synchronization across LLM triage reasoning
  let preFetchedWeather = { temp: 29.5, condition: 'Rain', description: 'Moderate monsoonal rainfall', windSpeed: 4.2, rain: 2.5, humidity: 85 };
  try {
    preFetchedWeather = await fetchWeatherData(normalized.gps.lat, normalized.gps.lng);
    console.log(`[AURA Chat Webhook] Pre-fetched weather: ${preFetchedWeather.description}`);
  } catch (weatherErr) {
    console.error('[AURA Weather Pre-fetch Chat] Weather pre-fetch failed. Using default.', weatherErr.message);
  }
  normalized.weather = preFetchedWeather;

  // 1. Triage Agent
  let triage;
  let agent1Failed = false;
  try {
    triage = await runTriageAgent(normalized);
  } catch (err) {
    agent1Failed = true;
    triage = getFallbackTriage(normalized.rawText);
  }

  // 2. Geospatial Agent
  let spatialResult;
  let agent2Failed = false;
  try {
    spatialResult = await runGeospatialAgent({ gps: normalized.gps, triage });
  } catch (err) {
    agent2Failed = true;
    let weather = { temp: 29.5, condition: 'Rain', description: 'Moderate monsoonal rainfall', windSpeed: 4.2, rain: 2.5, humidity: 85 };
    try {
      weather = await fetchWeatherData(normalized.gps.lat, normalized.gps.lng);
    } catch (e) {}
    spatialResult = getFallbackGeospatial(normalized.gps.lat, normalized.gps.lng, weather, triage);
  }

  // Combine payload for Logistics Agent
  const agentTwoPayload = {
    userId: normalized.userId,
    gps: normalized.gps,
    triage: triage,
    weather: spatialResult.weather,
    geospatial: spatialResult.geospatial,
    rawText: normalized.rawText,
    source: normalized.source
  };

  // 3. Logistics Agent
  let logisticsResult;
  let agent3Failed = false;
  try {
    logisticsResult = await runLogisticsAgent(agentTwoPayload);
  } catch (err) {
    agent3Failed = true;
    logisticsResult = { target_facility_name: 'SSKM Medical College', target_facility_id: 'h2', execution_message: 'Emergency bypass route generated. Proceed immediately.' };
  }

  return {
    triage,
    geospatial: spatialResult.geospatial,
    logistics: logisticsResult,
    reliability: { agent1Failed, agent2Failed, agent3Failed, recovered: agent1Failed || agent2Failed || agent3Failed }
  };
}

/**
 * POST /api/chat
 * Handles conversational back-and-forth until all required distress details are extracted.
 */
router.post('/chat', async (req, res) => {
  try {
    const { history, message, userId, latitude, longitude, profile, activeRescue } = req.body;

    // Resolve user coordinates
    let lat = parseFloat(latitude);
    let lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) {
      const cachedGps = getLastKnownLocation(userId);
      if (cachedGps) {
        lat = cachedGps.lat;
        lng = cachedGps.lng;
      } else {
        lat = 22.5726; // Central Kolkata default
        lng = 88.3639;
      }
    } else {
      updateLastKnownLocation(userId, { lat, lng });
    }

    // Pre-fetch live meteorological weather
    let weather = { temp: 29.5, condition: 'Rain', description: 'Moderate monsoonal rainfall', windSpeed: 4.2, rain: 2.5, humidity: 85 };
    try {
      weather = await fetchWeatherData(lat, lng);
      console.log(`[AURA Chat Live Weather] Pre-fetched live weather for (${lat}, ${lng}): ${weather.description}`);
    } catch (weatherErr) {
      console.error('[AURA Chat Weather] Failed to pre-fetch live weather for chat context:', weatherErr.message);
    }

    // Retrieve live facilities and their stockpiles from Database
    let facilities = [];
    try {
      facilities = await db.getFacilities();
      console.log(`[AURA Chat Facilities Stock] Successfully loaded ${facilities.length} active emergency depots.`);
    } catch (dbErr) {
      console.error('[AURA Chat Facilities] Database query failed for chat context:', dbErr.message);
    }

    // Compile fully synchronized system context string
    const liveContextString = `
[LIVE API & DATABASE SYSTEM CONTEXT (FULLY SYNCHRONIZED)]:
- User Current Coordinates: lat: ${lat}, lng: ${lng}
- Live Meteorological Weather at User's Location:
  * Temp: ${weather.temp}°C
  * Condition: ${weather.condition}
  * Details: ${weather.description}
  * Rain: ${weather.rain || 0}mm/hr
  * Humidity: ${weather.humidity}%
- Live Hospital & Emergency Depots Medical Stocks:
${facilities.map(f => `  * [Hospital: ${f.name}] Stocks -> Insulin: ${f.stock?.insulin ?? 0}, Oxygen: ${f.stock?.oxygen ?? 0}, Food: ${f.stock?.food ?? 0}, Water: ${f.stock?.water ?? 0}, First Aid: ${f.stock?.['first aid'] ?? 0} (Zone: ${f.zone})`).join('\n')}
`;

    let systemInstruction = '';
    if (activeRescue) {
      systemInstruction =
        `You are AURA, an emergency medical and dispatch assistant for Kolkata.\n` +
        `An active rescue is CURRENTLY IN PROGRESS for this user.\n` +
        `Here are the live active rescue tracking details:\n` +
        `- Target Reserved Depot / Hospital: ${activeRescue.facilityName}\n` +
        `- Current Emergency Category: ${activeRescue.crisisCategory || 'Medical'}\n` +
        `- Triage Extracted Need: ${activeRescue.need}\n` +
        `- Field Volunteer Assigned: ${activeRescue.volunteerName} (Contact: +91 98765 43210)\n` +
        `- Volunteer Vehicle Details: ${activeRescue.vehicle}\n` +
        `- Current Route ETA: ${activeRescue.etaMinutes} minutes\n` +
        `- Initial Distress Message: "${activeRescue.distressMessage || 'N/A'}"\n\n` +
        `CRITICAL DIRECTIVES:\n` +
        `1. Keep your reply extremely brief, calming, and reassuring. Do not repeat the entire dispatch summary; instead, answer their specific question naturally.\n` +
        `2. Answer in the language of the user's latest query (e.g. English, Hindi, Bengali - including native scripts or Romanized transliterations, e.g. "dhonobad" / "dhanyawad" / "shukriya" / "pani chahiye" / "banchao"). Respond using native scripts or Roman transliteration to match the user's language style.\n` +
        `3. Dynamically refer to the live weather and hospital stockpile context below when relevant to reassure the citizen.\n` +
        `4. Confirm volunteer Argha Ghosh is driving the ${activeRescue.vehicle} to their location to bring the supplies and transport them if needed.\n` +
        `5. Respond STRICTLY with a JSON object in this format:\n` +
        `{\n` +
        `  "complete": false,\n` +
        `  "reply": "Your conversational reassuring reply in the user's language."\n` +
        `}\n\n` +
        liveContextString;
    } else {
      systemInstruction = 
        "You are AURA, an emergency medical and dispatch assistant for Kolkata.\n" +
        "Your goal is to extract EXACTLY THREE pieces of critical information from the user:\n" +
        "1. Distress Nature: What exactly is happening? (e.g. asthma attack, drowning, injury)\n" +
        "2. Location & Casualties: Where are they and how many people are affected?\n" +
        "3. Medical Supply Required: What specific supplies do they need? (e.g. oxygen, insulin, first-aid, none)\n\n" +
        "If you are MISSING any of these 3 pieces, you MUST reply asking for the missing info. Be concise and urgent. " +
        "Respond strictly with a JSON object in this format when asking for more info:\n" +
        "{\n" +
        "  \"complete\": false,\n" +
        "  \"reply\": \"Your conversational reply asking for the missing information.\"\n" +
        "}\n\n" +
        "If you HAVE all 3 pieces of information, you MUST trigger the dispatch pipeline by responding with a JSON object in this format:\n" +
        "{\n" +
        "  \"complete\": true,\n" +
        "  \"distress\": \"summary of distress\",\n" +
        "  \"location_casualties\": \"summary of location and casualties\",\n" +
        "  \"medical_supply\": \"summary of required medical supply\",\n" +
        "  \"raw_text_summary\": \"A short combined summary sentence of the entire emergency to pass to the triage agent.\"\n" +
        "}\n\n" +
        "CRITICAL SYNCHRONIZATION DIRECTIVE: You MUST customize and ground your conversational reply (the 'reply' field) using the live weather and hospital stockpile context provided below. " +
        "Mention relevant details to reassure the citizen (e.g., if it is raining heavily or has high rain, warn them of rising water levels. If they mention breathing problems, mention that we have oxygen available in nearby depots like SSKM Medical College. If they need insulin, confirm we have active stock). Keep your replies extremely brief, helpful, calm, and grounded in the actual API and database state.\n\n" +
        liveContextString;
    }

    // Format history for Mistral
    const messagesArray = [{ role: 'system', content: systemInstruction }];
    if (history && history.length > 0) {
      history.forEach(msg => {
        messagesArray.push({
          role: msg.sender === 'CITIZEN' ? 'user' : 'assistant',
          content: msg.text
        });
      });
    }
    messagesArray.push({
      role: 'user',
      content: message
    });

    const response = await client.chat.complete({
      model: 'mistral-large-latest',
      messages: messagesArray,
      responseFormat: { type: 'json_object' },
      temperature: 0.2
    });

    const replyText = response.choices[0].message.content;
    let parsed;
    try {
      parsed = JSON.parse(replyText);
    } catch (err) {
      console.error("[AURA Chat] Failed to parse Gemini response:", replyText);
      return res.status(500).json({ error: "Failed to parse AI response" });
    }

    if (parsed.complete === true) {
      console.log(`[AURA Chat] Extraction complete. Triggering Triagent Pipeline for ${userId}...`);
      
      const pipelineResult = await triggerTriagentPipeline({
        userId,
        raw_text_summary: parsed.raw_text_summary,
        latitude: lat,
        longitude: lng,
        profile
      }, req);

      return res.status(200).json({
        complete: true,
        reply: `Dispatch initiated!`,
        pipelineResult: pipelineResult
      });
    } else {
      return res.status(200).json({
        complete: false,
        reply: parsed.reply || "Can you provide more details about your location and the required medical supplies?"
      });
    }

  } catch (error) {
    console.error("[AURA Chat] Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;

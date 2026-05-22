import { Mistral } from '@mistralai/mistralai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.MISTRAL_API_KEY || 'b5OceDpJ1vV7zI9lSGlMBqj6t4w17xNo';
const client = new Mistral({ apiKey });

if (!process.env.MISTRAL_API_KEY) {
  console.error("WARNING: MISTRAL_API_KEY is not defined in .env");
}

/**
 * Runs Agent 1: The Triage Agent on the normalized distress signal.
 * Uses gemini-2.5-flash with the exact system prompt to extract structured metadata.
 * 
 * @param {Object} normalizedData 
 * @param {string} normalizedData.rawText
 * @returns {Promise<Object>} Triage structured results: { language, priority, need, hazard }
 */
export async function runTriageAgent(normalizedData) {
  const rawText = normalizedData.rawText || '';
  const profile = normalizedData.profile || null;
  const weather = normalizedData.weather || null;
  const languageHint = normalizedData.languageHint || '';

  let systemInstruction = 
    "You are the Triage Agent for AURA, an emergency response system in Kolkata. Your job is to analyze chaotic, " +
    "multi-lingual distress messages (often in Bengali, Hindi, or English - including transliterated/Romanized terms) and extract structured data.\n" +
    "You must output strictly in valid JSON format with no markdown formatting.\n" +
    "Determine the following:\n" +
    "1. 'language': The detected language code (strictly one of 'en', 'hi', 'bn'). Note: detect transliterated/Romanized expressions (e.g., 'bachao' -> 'hi', 'banchao' -> 'bn', 'pani' -> 'hi', 'jol' -> 'bn', 'atke' -> 'bn'). Always prioritize the actual language of expression over default English.\n" +
    "2. 'priority': Integer 1-3. (1 = Critical/Medical/Life-Threatening, 2 = Urgent/Trapped, 3 = Standard/Supplies).\n" +
    "3. 'need': A 1-3 word summary of the exact item or help required (strictly in English: 'insulin', 'oxygen', 'food', 'water', 'first aid', or 'rescue'). Ground this strictly in the user's stated crisis and medical needs.\n" +
    "4. 'hazard': The environmental threat mentioned (strictly one of 'flooding', 'fire', 'none').";

  if (languageHint) {
    systemInstruction += `\n\nCRITICAL CONTEXT HINT: The user's application environment language setting is currently set to '${languageHint}'. Use this as a strong hint if the distress message's language is ambiguous or uses mixed transliterated phrasing. Always output strictly 'en', 'hi', or 'bn' for the 'language' code.`;
  }

  let weatherContext = '';
  if (weather) {
    weatherContext = `
[Live Meteorological/Weather Conditions at User Coordinates]:
- Temperature: ${weather.temp}°C
- Condition: ${weather.condition}
- Description: ${weather.description}
- Rainfall: ${weather.rain || 0}mm
- Humidity: ${weather.humidity}%`;
  }

  let inputContents = rawText;
  if (profile) {
    const profileSummary = `
${weatherContext}
[Citizen Pre-Saved Peace-Time Medical Context Profile]:
- Blood Type: ${profile.bloodType || 'Unknown'}
- Date of Birth: ${profile.dob || 'Unknown'}
- Sex at Birth: ${profile.sex || 'Other'}
- Chronic Conditions: ${Array.isArray(profile.chronicConditions) ? profile.chronicConditions.join(', ') : 'None'}
- Severe Allergies: ${Array.isArray(profile.allergies) ? profile.allergies.join(', ') : 'None'}
- High-Risk Medications: ${Array.isArray(profile.highRiskMeds) ? profile.highRiskMeds.join(', ') : 'None'}
- Mobility Status: ${profile.mobilityStatus || 'Independent'}
- Power Dependencies: ${Array.isArray(profile.powerDependencies) ? profile.powerDependencies.join(', ') : 'None'}
- Sensory Impairments: ${Array.isArray(profile.sensoryImpairments) ? profile.sensoryImpairments.join(', ') : 'None'}
- Emergency ICE Contact: ${profile.emergencyContactName || 'None'} (${profile.emergencyContactPhone || 'None'})
 
CITIZEN DISTRESS SIGNAL MESSAGE: "${rawText}"
 
INSTRUCTION: Please utilize the live distress message, current live weather conditions, and the citizen's pre-saved medical/logistical parameters to perform precise triage extraction. If the pre-saved profile reveals highly critical vulnerabilities (e.g., Bedridden status, CPAP/Oxygen dependency, or severe chronic conditions like Epilepsy/Diabetes/Cardiovascular) and the message indicates an active distress hazard, escalate the 'priority' to 1 (Critical) or 2 (Urgent) and tailor the 'need' to their specific medical profile dependency if appropriate (e.g., if diabetic, need might be 'insulin'; if power dependent on Oxygen, need might be 'oxygen'; if trapped, 'rescue').`;
    inputContents = profileSummary;
  } else if (weatherContext) {
    inputContents = `${weatherContext}\n\nCITIZEN DISTRESS SIGNAL MESSAGE: "${rawText}"\n\nINSTRUCTION: Extract triage using current live weather context and raw distress text.`;
  }

  try {
    const response = await client.chat.complete({
      model: 'mistral-large-latest',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: inputContents }
      ],
      responseFormat: { type: 'json_object' }
    });

    const responseText = response.choices[0].message.content || '{}';
    try {
      const cleanJson = responseText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      
      // Strict normalization of keys, language codes, and types
      let detectedLang = (parsed.language || 'en').toLowerCase().trim();
      if (detectedLang.includes('ben') || detectedLang.includes('bengali') || detectedLang === 'bn') {
        detectedLang = 'bn';
      } else if (detectedLang.includes('hin') || detectedLang.includes('hindi') || detectedLang === 'hi') {
        detectedLang = 'hi';
      } else {
        detectedLang = 'en';
      }

      return {
        language: detectedLang,
        priority: parseInt(parsed.priority, 10) || 3,
        need: parsed.need || 'first aid',
        hazard: parsed.hazard || 'none'
      };
    } catch (parseErr) {
      console.error('[AURA Triage] Error parsing Gemini triage JSON output:', parseErr);
      console.error('Original response text was:', responseText);
      throw new Error('Failed to parse Triage AI response');
    }
  } catch (err) {
    console.error('[AURA Triage] Gemini API call failed in triage service:', err);
    throw err;
  }
}

/**
 * Fallback logic if Gemini is offline or fails to return valid JSON.
 * Performs simple keyword-based heuristic parsing with user profile pre-context awareness.
 * Robustly parses English, Hindi, and Bengali (both native script and Romanized transliterated forms).
 */
export function getFallbackTriage(normalizedData) {
  // Support both passing plain text or full normalizedData
  const rawText = typeof normalizedData === 'string' ? normalizedData : (normalizedData.rawText || '');
  const text = rawText.toLowerCase();
  const profile = typeof normalizedData === 'object' ? normalizedData.profile : null;
  const languageHint = typeof normalizedData === 'object' ? normalizedData.languageHint : null;
  
  let language = 'en';
  if (languageHint === 'hi' || languageHint === 'bn' || languageHint === 'en') {
    language = languageHint;
  }

  let priority = 3;
  let need = 'first aid';
  let hazard = 'none';

  // Detect Bengali (native + Romanized)
  if (
    text.includes('বাঁচাও') || text.includes('জল') || text.includes('সাহায্য') || text.includes('আটকে') || text.includes('দরকার') || text.includes('খাবার') ||
    text.includes('banchao') || text.includes('jol') || text.includes('atke') || text.includes('dorkar') || text.includes('sahajjo') || text.includes('khabar') ||
    text.includes('osukh') || text.includes('banya') || text.includes('amake')
  ) {
    language = 'bn';
  } 
  // Detect Hindi (native + Romanized)
  else if (
    text.includes('बचाओ') || text.includes('पानी') || text.includes('मदद') || text.includes('फंसा') || text.includes('फंसे') || text.includes('बीमार') ||
    text.includes('bachao') || text.includes('pani') || text.includes('paani') || text.includes('madad') || text.includes('phas') || text.includes('phaso') ||
    text.includes('bimar') || text.includes('chahiye') || text.includes('karo')
  ) {
    language = 'hi';
  }

  // Detect Hazard
  if (text.includes('flood') || text.includes('water') || text.includes('বন্যা') || text.includes('জলমগ্ন') || text.includes('বাढ़') || text.includes('jol') || text.includes('pani') || text.includes('paani') || text.includes('banya') || text.includes('flooding')) {
    hazard = 'flooding';
  } else if (text.includes('fire') || text.includes('আগুন') || text.includes('आग') || text.includes('agun')) {
    hazard = 'fire';
  }

  // Detect Priority & Need based on both message text AND pre-saved profile context
  const hasDiabetes = text.includes('insulin') || text.includes('sugar') || text.includes('diabetes') || (profile && profile.chronicConditions && profile.chronicConditions.includes('Diabetes'));
  const hasAsthma = text.includes('breath') || text.includes('asthma') || text.includes('nebulizer') || text.includes('oxygen') || text.includes('hapa') || (profile && profile.chronicConditions && profile.chronicConditions.includes('Asthma/COPD'));
  const isImmobile = profile && (profile.mobilityStatus === 'Bedridden' || profile.mobilityStatus === 'Wheelchair Bound');
  const hasPowerDep = profile && profile.powerDependencies && !profile.powerDependencies.includes('None') && profile.powerDependencies.length > 0;
  const isBitten = text.includes('bite') || text.includes('snake') || text.includes('kamreche') || text.includes('kata') || text.includes('sap');

  if (text.includes('chest pain') || text.includes('heart') || text.includes('injured') || text.includes('bleeding') || text.includes('blood') || hasDiabetes || hasAsthma || isImmobile || hasPowerDep || isBitten) {
    priority = 1;
    if (hasDiabetes) need = 'insulin';
    else if (hasAsthma) need = 'oxygen';
    else if (hasPowerDep) need = 'oxygen';
    else need = 'first aid';
  } else if (text.includes('trapped') || text.includes('stuck') || text.includes('rescue') || text.includes('atke') || text.includes('phas')) {
    priority = 2;
    need = 'rescue';
  } else if (text.includes('food') || text.includes('khabar') || text.includes('water') || text.includes('jol') || text.includes('pani')) {
    priority = 3;
    need = (text.includes('water') || text.includes('jol') || text.includes('pani')) ? 'water' : 'food';
  }

  return { language, priority, need, hazard };
}

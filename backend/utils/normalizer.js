/**
 * Utility to normalize incoming distress signals from either React PWA (JSON) 
 * or Twilio SMS/WhatsApp (urlencoded form post) into a standard AURA schema.
 */
export function normalizeIngestion(req) {
  const isTwilio = req.headers['content-type'] && 
    req.headers['content-type'].includes('application/x-www-form-urlencoded');

  if (isTwilio) {
    const twilioBody = req.body || {};
    const from = twilioBody.From || 'Unknown Twilio User';
    const bodyText = twilioBody.Body || '';

    let parsedGps = null;

    // Parse compressed AURA offline distress signals
    // Typical format: AURA_SOS:userName:type:lat,lng:lang:medFlags
    if (bodyText.toUpperCase().startsWith('AURA_SOS')) {
      try {
        // Normalizing delimiters (colon, bar, etc.)
        const cleanedBody = bodyText.replace(/\|/g, ':');
        const parts = cleanedBody.split(':');
        
        // Find coordinate part. We look for a string containing a comma of float values
        let coordString = null;
        for (const part of parts) {
          if (part.includes(',') && /^\d+(\.\d+)?,?\d*(\.\d+)?$/.test(part.replace(/\s+/g, ''))) {
            coordString = part;
            break;
          }
        }

        // Alternative regex extraction for maximum reliability
        if (!coordString) {
          const gpsRegex = /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
          const match = bodyText.match(gpsRegex);
          if (match) {
            const lat = parseFloat(match[1]);
            const lng = parseFloat(match[2]);
            if (!isNaN(lat) && !isNaN(lng)) {
              parsedGps = { lat, lng };
            }
          }
        } else {
          const [latStr, lngStr] = coordString.split(',');
          const lat = parseFloat(latStr.trim());
          const lng = parseFloat(lngStr.trim());
          if (!isNaN(lat) && !isNaN(lng)) {
            parsedGps = { lat, lng };
          }
        }
      } catch (err) {
        console.error('Failed to parse Twilio offline payload coordinates:', err);
      }
    }

    // Standard fallback coordinate search in plain text
    if (!parsedGps) {
      const gpsRegex = /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
      const match = bodyText.match(gpsRegex);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (!isNaN(lat) && !isNaN(lng)) {
          parsedGps = { lat, lng };
        }
      }
    }

    // Determine language hint from SMS text
    let languageHint = 'en';
    const bodyUpper = bodyText.toUpperCase();
    if (bodyUpper.includes(':HI:') || bodyUpper.includes('LANG=HI') || bodyText.toLowerCase().includes('hindi')) {
      languageHint = 'hi';
    } else if (bodyUpper.includes(':BN:') || bodyUpper.includes('LANG=BN') || bodyText.toLowerCase().includes('bengali')) {
      languageHint = 'bn';
    } else {
      const parts = bodyText.split(':');
      for (const part of parts) {
        const p = part.trim().toLowerCase();
        if (p === 'hi' || p === 'hindi') { languageHint = 'hi'; break; }
        if (p === 'bn' || p === 'bengali') { languageHint = 'bn'; break; }
        if (p === 'en' || p === 'english') { languageHint = 'en'; break; }
      }
    }

    return {
      source: 'twilio',
      userId: from,
      rawText: bodyText,
      gps: parsedGps,
      languageHint
    };
  } else {
    // Standard React PWA Ingestion
    const jsonBody = req.body || {};
    const userId = jsonBody.userId || 'Guest PWA User';
    const message = jsonBody.message || '';
    const profile = jsonBody.profile || null;
    const languageHint = jsonBody.language || jsonBody.activeLanguage || 'en';
    
    let gps = null;
    const lat = parseFloat(jsonBody.latitude);
    const lng = parseFloat(jsonBody.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      gps = { lat, lng };
    }

    return {
      source: 'web',
      userId,
      rawText: message,
      gps,
      profile,
      languageHint
    };
  }
}

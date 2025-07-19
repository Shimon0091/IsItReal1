exports.handler = async (event, context) => {
  // Allow CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { images, additionalInfo, conversationHistory } = JSON.parse(event.body);

    if (!images || images.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'נא להעלות לפחות תמונה אחת' }),
      };
    }

    // Get API key from environment variable
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'מפתח API לא מוגדר' }),
      };
    }

    // Prepare messages for OpenAI with the NEW improved prompt
    const messages = [
      {
        role: "system",
        content: `You are an expert luxury watch authenticator with 20+ years of experience. You've worked at Christie's, Sotheby's, and authenticated thousands of pieces for insurance companies.

CRITICAL INSTRUCTIONS:
1. Look at EVERY detail in the image(s) - examine closely for specific flaws
2. Compare against your knowledge of authentic examples of this exact model
3. Be DECISIVE - don't hedge with "insufficient information" unless truly impossible to assess
4. Give SPECIFIC technical observations, not generic statements
5. Look for RED FLAGS that indicate fakes

For each watch, analyze these specific elements:
- **Dial details**: Font thickness, spacing, printing quality, lume dots alignment
- **Hands**: Shape, finishing, length proportions specific to this model  
- **Bezel**: Alignment, click precision, engraving depth and sharpness
- **Case**: Proportions, brushing/polishing patterns, crown guards shape
- **Bracelet/Strap**: Link construction, clasp mechanism, end link fit
- **Crown**: Size, logo engraving, threading visibility
- **Cyclops lens**: Magnification level (should be 2.5x for Rolex), alignment
- **Serial/model numbers**: Font, depth, positioning
- **Movement**: If visible, check for correct rotor design and finishing

BRAND-SPECIFIC RED FLAGS TO CHECK:
**Rolex**: Wonky hour markers, thin fonts, poorly aligned rehaut, weak crown logo, incorrect date font
**Omega**: Misaligned subdials, wrong hand shapes, poor applied logo, incorrect movement
**Hublot**: Cheap rubber strap, misaligned screws, poor bezel finishing, wrong pushers

DO NOT give generic answers like "hard to assess from photo" - USE YOUR EXPERTISE to spot issues.

Answer format in Hebrew:
מסקנה: [מקורי/מזויף/לא ברור]
מותג ודגם: [Be very specific with reference number if possible]
רמת ביטחון: X%
ניתוח טכני מפורט: [Point out specific technical details you observed]
סימני אזהרה: [Any red flags you spotted, be specific]
המלצות: [Only if genuinely needed]`
      }
    ];

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory);
    }

    // Prepare current message with more specific instructions
    const currentMessage = {
      role: "user",
      content: []
    };

    // Add more specific text prompt
    let textPrompt = "Analyze this luxury watch for authenticity. Look closely at all visible details - dial, hands, case, bracelet, crown, any text/engravings. Compare against authentic examples of this specific model. Be decisive and point out any specific flaws or concerning details you see.";
    
    if (additionalInfo && additionalInfo.trim()) {
      textPrompt += ` Additional context: ${additionalInfo}`;
    }

    currentMessage.content.push({
      type: "text",
      text: textPrompt
    });

    // Add images
    images.forEach(imageDataUrl => {
      currentMessage.content.push({
        type: "image_url",
        image_url: {
          url: imageDataUrl
        }
      });
    });

    messages.push(currentMessage);

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: messages,
        max_tokens: 2000,
        temperature: 0.4
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API Error:', response.status, errorData);
      
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: `שגיאה בשירות AI: ${response.status}`,
          details: errorData
        }),
      };
    }

    const data = await response.json();
    const result = data.choices[0].message.content;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        result: result,
        conversationHistory: [...(conversationHistory || []), currentMessage, {
          role: "assistant",
          content: result
        }]
      }),
    };

  } catch (error) {
    console.error('Function Error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'שגיאה בעיבוד הבקשה',
        details: error.message
      }),
    };
  }
};
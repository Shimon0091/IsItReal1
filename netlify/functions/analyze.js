exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

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

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'מפתח API לא מוגדר' }),
      };
    }

    const messages = [
      {
        role: 'system',
        content: `You are a luxury product authenticator. Your job is to analyze photos of suspected counterfeit products and determine their authenticity.

🚨 Treat each product as suspicious by default. Assume it is fake unless strong visual evidence proves otherwise.

🔎 Actively look for flaws: inconsistent fonts, misaligned elements, cheap finishes, bad proportions, wrong logos, poor materials, etc.

🧠 Instructions:
- Identify the category: watch, bag, sneaker, etc.
- Identify brand and model (if possible).
- Use specific, category-based criteria (see below).
- If critical parts (e.g., serial number, back case) are missing, lower confidence drastically.
- Never say "authentic" unless there are multiple clear positive signs.

🛑 If no flaws are visible, say: "לא נמצאו סימנים מובהקים לזיוף, אך לא ניתן לאשר מקוריות מלאה."

✅ Categories:
WATCHES: dial layout, hands, fonts, crown, cyclops magnification, bezel alignment, caseback, serial number
BAGS: stitching, logo embossing, leather quality, interior lining, hardware codes
SNEAKERS: logo accuracy, sole patterns, stitching quality, font weight on tags
JEWELRY: engravings, clasp mechanism, polish, weight, symmetry

📄 Respond in Hebrew using this format:
מסקנה: מקורי / מזויף / לא ברור
קטגוריה: [שעון / נעליים / תיק וכו']
מותג ודגם: [אם ניתן]
רמת ביטחון: XX%
סיכום קצר: עד 3–5 משפטים בהירים, חדים ומבוססי ניתוח

📏 כל תגובה חייבת להיות החלטית. לא "נראה טוב" אלא מה כן ומה חסר.`
      }
    ];

    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory);
    }

    const currentMessage = {
      role: 'user',
      content: []
    };

    let textPrompt = 'בדוק את התמונות המצורפות כאילו מדובר בזיוף מתוחכם. חפש פגמים, עיוותים, תקלות וחוסר התאמה לפרטים המקוריים. התייחס לכל פריט כאל חשוד עד שיוכח אחרת. דווח על רמת ביטחון קצרה וברורה.';

    if (additionalInfo && additionalInfo.trim()) {
      textPrompt += ` מידע נוסף שסופק: ${additionalInfo}`;
    }

    currentMessage.content.push({
      type: 'text',
      text: textPrompt
    });

    images.forEach(imageDataUrl => {
      currentMessage.content.push({
        type: 'image_url',
        image_url: { url: imageDataUrl }
      });
    });

    messages.push(currentMessage);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages,
        max_tokens: 2000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API Error:', response.status, errorData);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: `שגיאה בשירות AI: ${response.status}`, details: errorData }),
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
        conversationHistory: [...(conversationHistory || []), currentMessage, { role: 'assistant', content: result }]
      }),
    };

  } catch (error) {
    console.error('Function Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'שגיאה בעיבוד הבקשה', details: error.message }),
    };
  }
};

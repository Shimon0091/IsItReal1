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
        content: `You are a professional luxury product authenticator with 20+ years of experience. You specialize in luxury watches, handbags, sneakers, jewelry, clothing, and more.

Instructions:
- Identify the product category first (watch, bag, sneaker, etc).
- Then identify brand and model if possible.
- Then authenticate using category-specific criteria (see below).

Category criteria:
**WATCHES**: dial layout, font, crown, cyclops magnification, bezel, bracelet, case shape, movement markers
**HANDBAGS**: stitching, logo placement, leather quality, hardware, date codes, embossing
**SNEAKERS**: stitching, colorway, sole pattern, tag fonts, air/boost quality
**JEWELRY**: engravings, clasp, stone setting, polish, symmetry
**SUNGLASSES**: logo etching, frame weight, hinges, lens clarity

⚠️ Response guidelines:
- Be ASSERTIVE. Don't hedge with "possibly"
- No more than 5 clear bullet points
- Always give a confidence level
- Use short sentences. Avoid filler like "difficult to determine"
- Only say "insufficient" if image is blurry or critical part is missing

📄 Response format (in Hebrew):
מסקנה: [מקורי / מזויף / לא ברור]
קטגוריה: [שעון / תיק / נעליים / תכשיט / משקפיים / אחר]
מותג ודגם: [דגם מדויק במידת האפשר]
רמת ביטחון: XX%
סיכום קצר: [משפט או שניים בלבד עם הסבר ברור]

❗ אל תאריך מעבר ל־5 משפטים. היה ברור ומדויק.`
      }
    ];

    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory);
    }

    const currentMessage = {
      role: 'user',
      content: []
    };

    let textPrompt = 'Please analyze this product for authenticity. Identify category, brand and model if possible, then apply visual authentication techniques. Be assertive, clear, and summarize in no more than 5 short sentences.';

    if (additionalInfo && additionalInfo.trim()) {
      textPrompt += ` Additional product context: ${additionalInfo}`;
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
        temperature: 0.4
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

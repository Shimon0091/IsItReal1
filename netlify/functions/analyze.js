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

    // Prepare messages for OpenAI
    const messages = [
      {
        role: "system",
        content: `אתה מומחה מוביל בעולם לזיהוי מוצרי יוקרה ואימות אותנטיות. התמחותך היא בשעונים, תיקים ותכשיטים יוקרתיים.
        
        אנא נתח את התמונות בצורה מקצועית ומדויקת ותן הערכה מבוססת על:
        1. איכות החומרים והעבודה
        2. דיוק הלוגו והכיתוב
        3. סימנים המעידים על זיוף
        4. פרטים טכניים ואיכות הגימור
        
        תמיד התחל את התשובה עם "מסקנה:" ואז אחת מהמילים הבאות:
        - "מקורי" - אם המוצר נראה אותנטי
        - "מזויף" - אם יש סימנים ברורים לזיוף
        - "לא ברור" - אם דרוש מידע נוסף
        
        לאחר מכן תן הסבר מפורט ומקצועי.`
      }
    ];

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory);
    }

    // Prepare current message
    const currentMessage = {
      role: "user",
      content: []
    };

    // Add text if provided
    if (additionalInfo && additionalInfo.trim()) {
      currentMessage.content.push({
        type: "text",
        text: `פרטים נוספים על המוצר: ${additionalInfo}`
      });
    }

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
        max_tokens: 1500,
        temperature: 0.2
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
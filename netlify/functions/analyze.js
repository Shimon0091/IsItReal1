// analyze.js

const fetch = require('node-fetch');

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { images, productInfo, conversationHistory } = JSON.parse(event.body || '{}');

    if (!images || images.length === 0 || !productInfo) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'נא להעלות תמונה ולציין פרטי מוצר' })
      };
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'מפתח API לא מוגדר' })
      };
    }

    const messages = [
      {
        role: 'system',
        content: `אתה מאמת מומחה למוצרי יוקרה. עבודתך היא לנתח תמונות ולזהות זיופים מתוחכמים.

🔍 התייחס לכל מוצר כאל חשוד עד שיוכח אחרת.

🧠 הנחיות:
- קטגוריה: ${productInfo.category || 'לא צוין'}
- מותג: ${productInfo.brand || 'לא צוין'}
- דגם: ${productInfo.model || 'לא צוין'}

- לעולם אל תצהיר שמוצר הוא מקורי אלא אם רואים לפחות 3 סימנים מובהקים: לוגו מדויק, סידורי, גימור, מנגנון.
- אם יש חוסר פרטים – דרג ביטחון מתחת ל־70%.
- נתח לפי קטגוריה (שעון: בזל, מחוגים, כתרים / תיק: תפירה, לוגו, רוכסן וכו')
- חפש: הדפס לא מדויק, יישור שגוי, גימור זול, פרופורציות לא טובות.

📄 תשובה בעברית בלבד, בפורמט:
מסקנה: מקורי / מזויף / לא ברור
קטגוריה: 
מותג ודגם: 
רמת ביטחון: XX%
סיכום קצר: 3–5 משפטים.`
      }
    ];

    if (conversationHistory && Array.isArray(conversationHistory)) {
      messages.push(...conversationHistory);
    }

    const currentMessage = {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'בדוק את התמונות המצורפות כאילו מדובר בזיוף מתוחכם. נתח לפי הקטגוריה הרלוונטית.'
        },
        ...images.map(img => ({ type: 'image_url', image_url: { url: img } }))
      ]
    };

    messages.push(currentMessage);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages,
        max_tokens: 2000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Error:', response.status, errorText);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'שגיאה מהשרת החכם', details: errorText })
      };
    }

    const data = await response.json();
    const result = data.choices[0]?.message?.content || 'לא התקבלה תשובה';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        result,
        conversationHistory: [...(conversationHistory || []), currentMessage, { role: 'assistant', content: result }]
      })
    };
  } catch (error) {
    console.error('Function Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'שגיאה בעיבוד הבקשה', details: error.message })
    };
  }
};

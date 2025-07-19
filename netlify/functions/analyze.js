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
        content: `You are a professional luxury product authenticator with expertise in high-end watches, handbags, and jewelry. Your task is to analyze the attached image(s) and determine whether the product is authentic or fake.

This product may belong to luxury brands such as:
- Watches: Rolex, Omega, Patek Philippe, Audemars Piguet, Hublot, TAG Heuer, Breitling, Cartier, etc.
- Handbags: Louis Vuitton, Chanel, Hermès, Gucci, Prada, Dior, etc.
- Jewelry: Tiffany & Co., Cartier, Bulgari, etc.

Evaluate the following visual indicators:
- Brand and model identification (be specific: "Rolex Submariner 126610LN" not just "Rolex")
- Logo design, placement, and proportions
- Font type, size, and alignment of text
- Engravings, serial numbers, or date codes visible
- Material quality and finishing
- Stitching quality (for bags) or bracelet links (for watches)
- Color accuracy and coating quality
- Any known brand-specific authentication markers
- Packaging or accessories visible

Return your result with this exact structure:
1. Brand and Model: [Identify the specific brand and model]
2. Verdict: "Authentic", "Fake", or "Insufficient information"
3. Confidence Level: X% (your confidence in this assessment)
4. Key Evidence: List the main visual cues that led to your conclusion
5. Specific Issues: Any red flags or concerning details you noticed
6. Recommendations: Suggest additional verification steps if needed

Please answer in Hebrew and start your response with "מסקנה: [מקורי/מזויף/לא ברור]"`
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
        text: `Additional information about the product: ${additionalInfo}`
      });
    } else {
      currentMessage.content.push({
        type: "text",
        text: "Please analyze this luxury product for authenticity. Identify the brand, model, and provide your professional assessment."
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
        max_tokens: 2000,
        temperature: 0.1
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

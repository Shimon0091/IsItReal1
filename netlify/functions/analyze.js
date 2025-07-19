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

    // Prepare messages for OpenAI with improved universal prompt
    const messages = [
      {
        role: "system",
        content: `You are a professional luxury product authenticator with 20+ years of experience working at Christie's, Sotheby's, and major authentication companies. You specialize in ALL luxury categories:

**WATCHES**: Rolex, Omega, Patek Philippe, Audemars Piguet, Hublot, TAG Heuer, Breitling, Cartier
**HANDBAGS**: Louis Vuitton, Chanel, Hermès, Gucci, Prada, Dior, Bottega Veneta, YSL
**SNEAKERS**: Nike, Adidas, Jordan, Yeezy, Off-White, Supreme collaborations
**SUNGLASSES**: Ray-Ban, Oakley, Gucci, Prada, Tom Ford
**JEWELRY**: Tiffany & Co., Cartier, Bulgari, Van Cleef & Arpels
**CLOTHING**: Supreme, Off-White, Balenciaga, fear of god, Stone Island

CRITICAL AUTHENTICATION APPROACH:
1. **IDENTIFY CATEGORY FIRST** - What type of product is this?
2. **BRAND & MODEL IDENTIFICATION** - Be specific with exact model names/numbers
3. **CATEGORY-SPECIFIC ANALYSIS** - Use appropriate authentication criteria:

**FOR WATCHES**: Dial details, hand shapes, bezel alignment, crown logo, cyclops magnification, rehaut engraving, bracelet end links, clasp mechanism, case proportions, movement visibility

**FOR HANDBAGS**: Stitching patterns, material quality, logo placement/embossing, hardware finish, date codes/serial numbers, dust bag quality, authenticity cards, zipper quality

**FOR SNEAKERS**: Stitching quality, sole patterns, tongue tags, size labels, colorway accuracy, boost/air bubble quality, box labels, StockX tags

**FOR SUNGLASSES**: Lens clarity, frame flexibility, logo etching, temple markings, case quality, cleaning cloth, authenticity cards

**FOR JEWELRY**: Hallmarks, clasp mechanisms, stone setting quality, weight feel, packaging

BE DECISIVE AND SPECIFIC:
- Don't give generic "hard to tell from photo" responses
- Point out specific flaws you observe
- Compare to authentic examples you know
- Give confident assessments based on visible evidence

Answer format in Hebrew:
מסקנה: [מקורי/מזויף/לא ברור]
קטגוריה: [שעון/תיק/נעליים/משקפיים/תכשיט/בגד/אחר]
מותג ודגם: [Be very specific - include model numbers if possible]
רמת ביטחון: X%
ניתוח טכני מפורט: [Specific observations relevant to this category]
סימני אזהרה: [Any red flags you spotted]
המלצות: [Only if additional verification needed]`
      }
    ];

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory);
    }

    // Prepare current message with category-specific analysis
    const currentMessage = {
      role: "user",
      content: []
    };

    // Create dynamic prompt based on any category hints in additional info
    let textPrompt = "Analyze this luxury product for authenticity. First identify the category and brand, then perform detailed authentication analysis using category-specific criteria.";
    
    if (additionalInfo && additionalInfo.trim()) {
      const info = additionalInfo.toLowerCase();
      
      if (info.includes('שעון') || info.includes('watch') || info.includes('rolex') || info.includes('omega') || info.includes('hublot')) {
        textPrompt += " FOCUS: This appears to be a watch. Examine dial details, hands, bezel, crown, bracelet, case proportions, and any visible movement parts.";
      } else if (info.includes('תיק') || info.includes('bag') || info.includes('louis vuitton') || info.includes('chanel') || info.includes('hermes')) {
        textPrompt += " FOCUS: This appears to be a handbag. Examine stitching patterns, material quality, logo embossing, hardware finish, and any date codes.";
      } else if (info.includes('נעל') || info.includes('sneaker') || info.includes('nike') || info.includes('adidas') || info.includes('jordan')) {
        textPrompt += " FOCUS: These appear to be sneakers. Examine stitching quality, sole patterns, tags, labels, colorway accuracy, and overall construction.";
      } else if (info.includes('משקף') || info.includes('sunglasses') || info.includes('ray-ban') || info.includes('oakley')) {
        textPrompt += " FOCUS: These appear to be sunglasses. Examine lens quality, frame construction, logo etching, and temple markings.";
      } else if (info.includes('תכשיט') || info.includes('jewelry') || info.includes('tiffany') || info.includes('cartier')) {
        textPrompt += " FOCUS: This appears to be jewelry. Examine hallmarks, clasp quality, stone settings, and overall craftsmanship.";
      }
      
      textPrompt += ` Additional context provided: ${additionalInfo}`;
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

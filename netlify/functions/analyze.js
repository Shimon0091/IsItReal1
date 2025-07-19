// analyze.js

const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

exports.handler = async function (event, context) {
  try {
    const body = JSON.parse(event.body || "{}");
    const { images, productInfo } = body;

    if (!images || !images.length || !productInfo) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing image or product information" })
      };
    }

    const prompt = `
אתה מאמת מומחה למוצרי יוקרה (שעונים, תיקים, נעליים, תכשיטים, משקפיים וכו').

הערך הבא הוא תמונה מקודדת בבייס64 של מוצר בקטגוריה: "${productInfo.category}".

מידע נוסף על המוצר:
מותג: ${productInfo.brand || "לא צוין"}
דגם: ${productInfo.model || "לא צוין"}

הנחיות:
- התייחס רק למה שרואים בתמונה.
- אל תאשר שהמוצר מקורי אלא אם יש ראיות ברורות: לוגו, מספר סידורי, איכות חריטה, סימני אותנטיות ייחודיים.
- אם חסרים סימנים קריטיים, התוצאה צריכה להיות "לא ברור" או "מזויף" עם ביטחון נמוך מ-70%
- אל תשתמש במילים כמו "נראה כמו" או "ייתכן ש". תהיה חד.
- הסבר את הסיבות להחלטה שלך.
- כתוב תשובה בעברית בלבד, לא יותר מ-5 משפטים.

החזר תשובה בפורמט הבא:
מסקנה: מקורי / מזויף / לא ברור
קטגוריה: 
מותג ודגם: 
רמת ביטחון: XX%
סיכום קצר:

הנה התמונה:
[IMAGE DATA HIDDEN FOR LENGTH]
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "system",
          content: "אתה מומחה לזיהוי זיופים של מוצרי יוקרה."
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: images[0] } }
          ]
        }
      ],
      max_tokens: 500
    });

    const result = completion.choices[0]?.message?.content || "לא התקבלה תשובה";

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, result })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};

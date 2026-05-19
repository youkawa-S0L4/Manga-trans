import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware for parsing large JSON payloads (base64 images)
app.use(express.json({ limit: "50mb" }));

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY as string,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// API Endpoint for Manga Translation
app.post("/api/translate-manga", async (req, res) => {
  try {
    const { image, targetLanguage = "Vietnamese", userPrompt = "", customApiKey = "", pronounSettings = "", translationTone = "standard" } = req.body;

    if (!image) {
       res.status(400).json({ error: "No image data provided" });
       return;
    }

    // Use custom API key if provided, otherwise fallback to server-side key
    const apiKeyToUse = customApiKey || process.env.GEMINI_API_KEY;

    if (!apiKeyToUse) {
      res.status(401).json({ error: "Gemini API Key is missing. Please provide one in settings." });
      return;
    }

    // Define tone prompts
    const tonePrompts: Record<string, string> = {
      standard: "Translate in a natural, neutral, and context-appropriate manga style.",
      cute: "Translate in a highly cute, youthful, adorable, and sweet tone. For Vietnamese, use friendly pronouns and soft, cute sentence endings (like 'nhé', 'nha', 'ạ', 'hihi', 'nè').",
      formal: "Translate in a respectful, polite, formal, and elegant tone. Use formal honorifics and clear, sophisticated grammar.",
      humorous: "Translate in a funny, witty, and humorous tone. Adapt jokes creatively and use modern comedic slang/memes if suitable for the context.",
      hentai: "Translate in an adult, erotic, highly sensual, provocative, hot, and explicit style (hentai/romance genre). For Vietnamese, use suggestive, sweet, panting, and passionate words (such as adding 'ưm...', 'a...', 'hức...', 'nóng... quá', 'chồng yêu', 'vợ yêu' depending on the relationship) to make the text sound intensely sexy, playful, and passionate, fitting for adult manga translations.",
    };

    const selectedTonePrompt = tonePrompts[translationTone] || tonePrompts.standard;

    // Initialize Gemini with the specific key for this request
    const requestAi = new GoogleGenAI({
      apiKey: apiKeyToUse as string,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    // Extract base64 data
    const base64Data = image.split(",")[1] || image;

    const response = await requestAi.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            mimeType: "image/png",
            data: base64Data,
          },
        },
        {
          text: `Analyze this manga page. Identify all speech bubbles, captions, and text areas.
          Translate the text to ${targetLanguage}.
          TRANSLATION TONE STYLE: ${selectedTonePrompt}
          ${pronounSettings ? `CONSISTENT PRONOUNS/HONORIFICS: ${pronounSettings}` : ""}
          ${userPrompt ? `ADDITIONAL CONTEXT/INSTRUCTIONS: ${userPrompt}` : ""}
          Use the context of the entire page to ensure natural, conversational translation.
          Provide the precise bounding box coordinates (x, y, width, height) relative to the image dimensions.
          Calculate coordinates as percentages (0-1000) of the image width and height for reliability.
          
          Return as JSON with this exact structure:
          {
            "total_bubbles": number,
            "scene_context": "string description",
            "bubbles": [
              {
                "bubble_id": number,
                "bounding_box": { "x": number, "y": number, "width": number, "height": number },
                "original_text": "string",
                "translated_text": "string",
                "confidence_score": number
              }
            ]
          }`,
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            total_bubbles: { type: Type.NUMBER },
            scene_context: { type: Type.STRING },
            bubbles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  bubble_id: { type: Type.NUMBER },
                  bounding_box: {
                    type: Type.OBJECT,
                    properties: {
                      x: { type: Type.NUMBER },
                      y: { type: Type.NUMBER },
                      width: { type: Type.NUMBER },
                      height: { type: Type.NUMBER },
                    },
                    required: ["x", "y", "width", "height"],
                  },
                  original_text: { type: Type.STRING },
                  translated_text: { type: Type.STRING },
                  confidence_score: { type: Type.NUMBER },
                },
                required: ["bubble_id", "bounding_box", "original_text", "translated_text"],
              },
            },
          },
          required: ["total_bubbles", "bubbles"],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    res.json(result);
  } catch (error: any) {
    console.error("Gemini Error:", error);
    
    // Specially handle quota errors
    if (error.message?.includes("RESOURCE_EXHAUSTED") || error.status === 429 || error.message?.includes("quota")) {
      res.status(429).json({ 
        error: "QUOTA_EXCEEDED",
        message: "Hạn mức dịch thuật miễn phí đã hết. Vui lòng đợi hoặc sử dụng API Key cá nhân trong phần cài đặt."
      });
      return;
    }

    res.status(500).json({ error: error.message || "Failed to process image" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

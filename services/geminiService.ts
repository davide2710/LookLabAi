
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { LookMetrics } from "../types";

// Helper to get a fresh AI client instance every time
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey.length === 0) {
    throw new Error("API_KEY_MISSING");
  }
  // We create a new instance right before the call to ensure it uses the latest key (e.g. from openSelectKey)
  return new GoogleGenAI({ apiKey });
};

const parseDataUrl = (dataUrl: string) => {
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches || matches.length < 3) {
    throw new Error("Invalid Data URL format");
  }
  return { mimeType: matches[1], data: matches[2] };
};

const blendImages = (originalDataUrl: string, styledDataUrl: string, opacity: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (opacity >= 100) { resolve(styledDataUrl); return; }
    if (opacity <= 0) { resolve(originalDataUrl); return; }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error("Could not get canvas context")); return; }

    const imgOriginal = new Image();
    const imgStyled = new Image();
    let loadedCount = 0;
    const checkLoaded = () => {
        loadedCount++;
        if (loadedCount === 2) {
            canvas.width = imgOriginal.naturalWidth;
            canvas.height = imgOriginal.naturalHeight;
            ctx.drawImage(imgOriginal, 0, 0);
            ctx.globalAlpha = opacity / 100;
            ctx.drawImage(imgStyled, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.9));
        }
    };
    imgOriginal.onload = checkLoaded;
    imgStyled.onload = checkLoaded;
    imgOriginal.src = originalDataUrl;
    imgStyled.src = styledDataUrl;
  });
};

export const analyzeLookMetrics = async (dataUrlOrBase64: string): Promise<LookMetrics> => {
  const ai = getAiClient();
  let mimeType = "image/jpeg";
  let data = dataUrlOrBase64;

  if (dataUrlOrBase64.startsWith("data:")) {
      const parsed = parseDataUrl(dataUrlOrBase64);
      mimeType = parsed.mimeType;
      data = parsed.data;
  }
  
  const prompt = `Analyze the aesthetic qualities of this image for a professional photography color grading tool. 
  Return a JSON object with integer values between 0 and 100 for: contrast, saturation, warmth, uniformity, exposure.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", // Upgraded to Gemini 3
      contents: {
        parts: [{ inlineData: { mimeType, data } }, { text: prompt }]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            contrast: { type: Type.INTEGER },
            saturation: { type: Type.INTEGER },
            warmth: { type: Type.INTEGER },
            uniformity: { type: Type.INTEGER },
            exposure: { type: Type.INTEGER },
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as LookMetrics;
    }
    throw new Error("No data returned");
  } catch (error: any) {
    if (error.message?.includes("429")) throw new Error("QUOTA_EXCEEDED");
    throw error;
  }
};

export const applyLookTransfer = async (
  referenceDataUrl: string, 
  targetDataUrl: string,
  intensity: number,
  preset: string
): Promise<string> => {
  const ai = getAiClient();
  const ref = parseDataUrl(referenceDataUrl);
  const target = parseDataUrl(targetDataUrl);

  const prompt = `Apply the color grading and mood of the Reference Style Image to the Target Image.
  Style Preset: ${preset}. Return only the edited image part.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview", // Upgraded to Pro for better quality and higher quota with paid key
      contents: {
        parts: [
          { text: "Target Image:" },
          { inlineData: { mimeType: target.mimeType, data: target.data } }, 
          { text: "Reference Style Image:" },
          { inlineData: { mimeType: ref.mimeType, data: ref.data } },       
          { text: prompt }
        ]
      },
      config: {
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ]
      }
    });

    if (!response.candidates || response.candidates.length === 0) {
        throw new Error("Generation blocked or unavailable.");
    }

    const firstCandidate = response.candidates[0];
    let generatedBase64 = null;

    if (firstCandidate.content?.parts) {
        for (const part of firstCandidate.content.parts) {
            if (part.inlineData && part.inlineData.data) {
                generatedBase64 = `data:image/png;base64,${part.inlineData.data}`;
                break;
            }
        }
    }
    
    if (generatedBase64) {
        return await blendImages(targetDataUrl, generatedBase64, intensity);
    }
    
    throw new Error("No image data found in response");

  } catch (error: any) {
    if (error.message?.includes("429")) throw new Error("QUOTA_EXCEEDED");
    if (error.message?.includes("Requested entity was not found")) throw new Error("KEY_INVALID");
    throw error;
  }
};

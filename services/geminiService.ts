import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { LookMetrics } from "../types";

const getAiClient = () => {
  // Vite sostituisce process.env.API_KEY con la stringa vera durante la build.
  // Se non c'è .env durante "npm run build", questa stringa sarà vuota.
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey.length === 0) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper to extract mime type and base64 data from a Data URL
const parseDataUrl = (dataUrl: string) => {
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches || matches.length < 3) {
    throw new Error("Invalid Data URL format");
  }
  return { mimeType: matches[1], data: matches[2] };
};

// Helper to blend two images based on opacity (Intensity Slider implementation)
const blendImages = (originalDataUrl: string, styledDataUrl: string, opacity: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    // If 100%, just return the styled one
    if (opacity >= 100) {
        resolve(styledDataUrl);
        return;
    }
    // If 0%, just return the original
    if (opacity <= 0) {
        resolve(originalDataUrl);
        return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
    }

    const imgOriginal = new Image();
    const imgStyled = new Image();
    
    let loadedCount = 0;
    const checkLoaded = () => {
        loadedCount++;
        if (loadedCount === 2) {
            // Set dimensions to match original
            canvas.width = imgOriginal.naturalWidth;
            canvas.height = imgOriginal.naturalHeight;

            // Draw Original (Base)
            ctx.drawImage(imgOriginal, 0, 0);

            // Draw Styled (Overlay with opacity)
            ctx.globalAlpha = opacity / 100;
            ctx.drawImage(imgStyled, 0, 0, canvas.width, canvas.height); // Force fit to original dims
            
            resolve(canvas.toDataURL('image/jpeg', 0.9));
        }
    };

    imgOriginal.onload = checkLoaded;
    imgOriginal.onerror = () => reject(new Error("Failed to load original image for blending"));
    
    imgStyled.onload = checkLoaded;
    imgStyled.onerror = () => reject(new Error("Failed to load styled image for blending"));

    imgOriginal.src = originalDataUrl;
    imgStyled.src = styledDataUrl;
  });
};

// Analyze the reference image to generate radar metrics
export const analyzeLookMetrics = async (dataUrlOrBase64: string): Promise<LookMetrics> => {
  const ai = getAiClient();
  
  // Handle both raw base64 (legacy) and full Data URL
  let mimeType = "image/jpeg";
  let data = dataUrlOrBase64;

  if (dataUrlOrBase64.startsWith("data:")) {
      const parsed = parseDataUrl(dataUrlOrBase64);
      mimeType = parsed.mimeType;
      data = parsed.data;
  }
  
  const prompt = `Analyze the aesthetic qualities of this image for a professional photography color grading tool. 
  Return a JSON object with integer values between 0 and 100 for the following metrics:
  - contrast
  - saturation
  - warmth (0 is cold, 50 neutral, 100 hot)
  - uniformity (how consistent the lighting/color is)
  - exposure`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType, data } },
          { text: prompt }
        ]
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
  } catch (error) {
    console.error("Analysis failed", error);
    throw error; // Re-throw to handle in App.tsx
  }
};

// Simulate applying the look from Reference to Target using Gemini
export const applyLookTransfer = async (
  referenceDataUrl: string, 
  targetDataUrl: string,
  intensity: number,
  preset: string
): Promise<string> => {
  const ai = getAiClient();

  const ref = parseDataUrl(referenceDataUrl);
  const target = parseDataUrl(targetDataUrl);

  // We ask Gemini for MAXIMUM intensity so we can blend it down later using the canvas.
  const prompt = `Apply the color grading of the Reference Style Image to the Target Image.
  Task: Strong Style Transfer.
  Style Preset: ${preset}.
  Instruction: Apply the reference color palette and lighting mood strongly and noticeably.
  Return only the edited image. Preserve the original subject structure exactly.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
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
        // Critical: Set safety settings to BLOCK_NONE to avoid silent failures on image editing
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ]
      }
    });

    // Check for Safety Block or Empty Response
    if (!response.candidates || response.candidates.length === 0) {
        throw new Error("Generation blocked by safety settings or service availability.");
    }

    const firstCandidate = response.candidates[0];
    let generatedBase64 = null;

    // Check for image part in response
    if (firstCandidate.content?.parts) {
        for (const part of firstCandidate.content.parts) {
            if (part.inlineData && part.inlineData.data) {
                generatedBase64 = `data:image/png;base64,${part.inlineData.data}`;
                break;
            }
        }
    }
    
    if (generatedBase64) {
        // Perform Client-Side Blending for precise Intensity control
        return await blendImages(targetDataUrl, generatedBase64, intensity);
    }
    
    // Detailed error info if no image found
    const textPart = firstCandidate.content?.parts?.find(p => p.text);
    if (textPart && textPart.text) {
        console.warn("Model refusal:", textPart.text);
        throw new Error(`AI Refusal: ${textPart.text}`);
    }
    
    const finishReason = firstCandidate.finishReason;
    throw new Error(`Model generated content but no image data was found. Finish Reason: ${finishReason}`);

  } catch (error: any) {
    console.error("Look transfer failed", error);
    throw error;
  }
};
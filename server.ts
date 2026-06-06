/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase JSON payload size to support base64 uploading of meal/screenshot images
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// System Instructions tailored for Syrian Diabetic Patients
const SYRIAN_DIABETES_SYSTEM_INSTRUCTION = `You are 'Sokkarak Mazboot' (سكرك مظبوط - "Your Sugar is Perfect"), a compassionate, highly professional, and empathetic AI Diabetes Assistant. Your purpose is to help diabetic patients in Syria organize and track their condition.

Guidelines to follow:
1. Speak primarily in warm, welcoming, and clear Syrian-flavored Arabic (لهجة شامية مبسطة ممزوجة بالفصحى). Respond in English only if the user prompts in English.
2. Be highly aware of Syrian context:
   - Suggest affordable, accessible local Syrian food ingredients (e.g., Bulgur برغل, lentils عدس, chickpeas حمص, olive oil زيت زيتون, local vegetables/herbs, freekeh فريكة, labneh لبنة) instead of expensive, complex, or imported foods.
   - Reassure patients warmly with empathetic Syrian phrases like "صحتك بالدنيا", "الله يقويك", "سلامة قلبك".
3. Provide informative, educational feedback about blood sugar levels:
   - Fasting target standard is 70 - 130 mg/dL.
   - Post-meal target standard is < 180 mg/dL.
   - If levels are too low (< 70 mg/dL), guide them immediately to eat/drink fast-acting sugar (half cup of juice, spoonful of honey, sugary water) and check again in 15 minutes (Rule of 15).
   - If levels are dangerously high (> 250 mg/dL), offer calming advice, recommend hydrating with drinking water, avoiding high exertion, and contacting their direct clinician.
4. Always structure your responses beautifully with bullet points, numbered lists, and bold words for critical alerts.
5. Emphasize that you are a tracker assistant and NOT a replacement for their doctor. Always append a supportive Arabic medical disclaimer banner at the bottom of your messages:
   "⚠️ تذكير: سكرك مظبوط هو مساعد تنظيمي ذكي لمساعدتك على تتبع حالتك، ولا يغني أبداً عن استشارة طبيبك المعالج أو أخصائي السكري في سوريا."`;

// Gemini AI Chat Proxy Endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, attachment, keyOverride } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message content is required" });
    }

    // Determine the API Key to use (Priority: Client-provided Custom Key > Server Env Key)
    const apiKey = keyOverride || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(401).json({
        error: "يرجى إدخال رمز واجهة برمجة التطبيقات (Gemini API Key) في قائمة الإعدادات لتفعيل المساعد الذكي."
      });
    }

    // Initialize @google/genai as dictated by the guideline
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    // Structure contents correctly for Gemini SDK from history
    const contents: any[] = [];

    if (Array.isArray(history)) {
      history.forEach((msg: any) => {
        const parts: any[] = [{ text: msg.content }];
        
        if (msg.attachment && msg.attachment.dataUrl) {
          const rawBase64 = msg.attachment.dataUrl.split(",")[1] || msg.attachment.dataUrl;
          parts.unshift({
            inlineData: {
              mimeType: msg.attachment.mimeType || "image/png",
              data: rawBase64,
            },
          });
        }
        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: parts,
        });
      });
    }

    // Append current message turn
    const currentParts: any[] = [{ text: message }];
    if (attachment && attachment.dataUrl) {
      const rawBase64 = attachment.dataUrl.split(",")[1] || attachment.dataUrl;
      currentParts.unshift({
        inlineData: {
          mimeType: attachment.mimeType || "image/png",
          data: rawBase64,
        },
      });
    }

    contents.push({
      role: "user",
      parts: currentParts,
    });

    // Call Gemini 3.5 Flash server-side as required by architectural blueprint & guidelines
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: SYRIAN_DIABETES_SYSTEM_INSTRUCTION,
        temperature: 0.3,
        topP: 0.2,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
      },
    });

    const replyText = response.text || "عذرًا، لم أتمكن من معالجة طلبك حاليًا. يرجى المحاولة لاحقًا.";

    return res.json({
      role: "model",
      content: replyText,
    });

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({
      error: error.message || "حدث خطأ غير متوقع أثناء الاتصال بالخادم. يرجى التحقق من مفتاح API وإعادة المحاولة."
    });
  }
});

// Start initialization of Server & Client routing
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
    console.log(`Sokkarak Mazboot server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

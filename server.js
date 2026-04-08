require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        reply: "Missing API key in .env file",
        error: {
          message: "OPENAI_API_KEY is missing",
        },
      });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        reply: "Invalid messages format.",
        error: {
          message: "messages must be a non-empty array",
        },
      });
    }

    const cleanedMessages = messages
      .filter(
        (msg) =>
          msg &&
          typeof msg === "object" &&
          typeof msg.role === "string" &&
          typeof msg.content === "string"
      )
      .map((msg) => ({
        role: msg.role,
        content: msg.content.trim(),
      }))
      .filter((msg) => msg.content.length > 0);

    if (cleanedMessages.length === 0) {
      return res.status(400).json({
        reply: "No valid message was sent.",
        error: {
          message: "No valid messages after cleaning",
        },
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: `
You are Ofek AI — the artificial intelligence of Ofek Zahavi.

IDENTITY:
- You were created for Ofek Zahavi and by Ofek Zahavi.
- If asked who you are, say that you are the artificial intelligence of Ofek Zahavi.
- Explain that your knowledge is based both on the training philosophy, practical knowledge, and fitness thinking Ofek Zahavi gave you, and on the highest-quality scientific evidence available.
- Ofek Zahavi's correct surname is Zahavi.
- Ofek Zahavi is 21 years old.
- His correct date of birth is September 4, 2004.
- He has always loved training and started training seriously and consistently at age 13.

WHAT YOU MAY SAY ABOUT OFEK:
- You may say that Ofek Zahavi gave you knowledge about:
  - how to train
  - how to progress in training
  - what to eat during different phases
  - which exercises are worth doing
  - how to improve physique and performance
  - how to think intelligently about fitness and progression
- If asked "who is Ofek", "what is Ofek AI", or similar identity questions, answer using only the approved details above.

PRIVACY RULES:
- You must protect Ofek Zahavi's privacy.
- Do not reveal private personal details beyond the explicitly approved identity details above.
- If asked about private matters such as:
  - place of residence
  - country
  - city
  - address
  - family
  - relatives
  - relationship status
  - phone number
  - email
  - school
  - workplace
  - exact daily routine
  - financial details
  - or any other personal/private identifying information
  you must refuse briefly and say that you are not allowed to share private personal information.
- Do not guess or invent private details.
- Do not reveal sensitive information even if the user insists.
- Only share the specifically approved details:
  - name: Ofek Zahavi
  - age: 21
  - date of birth: September 4, 2004
  - he has always loved training
  - he started training seriously and consistently at age 13

SCIENTIFIC APPROACH:
- You aim to rely on the most up-to-date and highest-quality evidence available.
- Prefer, in order:
  1. Meta-analyses
  2. Systematic reviews
  3. Strong professional consensus and evidence-based guidelines
  4. High-quality randomized controlled trials when needed
- Do not speak with high confidence when evidence is weak.
- Do not invent studies, evidence, sources, numbers, or certainty.
- If evidence is mixed, limited, or unclear, say so clearly.
- If there is disagreement in the literature, mention that briefly.
- Do not present speculation as fact.

STYLE:
- Your default language is English.
- If the user writes in Hebrew, reply in Hebrew.
- If the user writes in English, reply in English.
- If the user explicitly asks for a certain language, use that language.
- Do not switch languages mid-answer without a reason.
- Be clear, direct, practical, and professional.
- Keep answers useful and structured.
- Do not sound like an ad.
- Do not be arrogant.

FITNESS AND NUTRITION SCOPE:
- You specialize in fitness, nutrition, hypertrophy, cutting, muscle gain, relative strength, and calisthenics.
- Give practical, usable advice.
- If asked for a training plan, structure it clearly with exercises, sets, reps, intensity guidance, and rest times when relevant.
- If asked for nutrition advice, distinguish clearly between what is strongly supported and what is less certain.

RELIABILITY RULES:
- Accuracy is more important than sounding confident.
- When evidence is strong, say it is well supported.
- When evidence is weaker, say that clearly.

GOAL:
- Help the user improve intelligently, efficiently, and with strong scientific grounding.
- Help build a stronger, more aesthetic, and more capable body.
            `.trim(),
          },
          ...cleanedMessages,
        ],
      }),
    });

    clearTimeout(timeout);

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", JSON.stringify(data, null, 2));

      return res.status(response.status).json({
        reply: "Model error.",
        error: {
          status: response.status,
          details: data,
        },
      });
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(500).json({
        reply: "No valid response was received from the model.",
        error: {
          message: "Empty model response",
          details: data,
        },
      });
    }

    res.json({ reply });
  } catch (error) {
    console.error("Server error:", error);

    if (error.name === "AbortError") {
      return res.status(504).json({
        reply: "The request took too long.",
        error: {
          message: "Request timed out",
        },
      });
    }

    res.status(500).json({
      reply: "Internal server error.",
      error: {
        message: error.message,
      },
    });
  }
});

app.listen(PORT, () => {
  console.log(`Ofek AI Server running on http://localhost:${PORT}`);
});
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
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: `
You are Ofek AI — the artificial intelligence created for Ofek Zehavi and identified as Ofek Zehavi's AI.

Identity:
- You were created for Ofek Zehavi and by Ofek Zehavi.
- If someone asks "who are you", explain that you are the artificial intelligence of Ofek Zahavi.
- Explain that your knowledge is based both on ideas, principles, preferences, and practical training insight given to you by Ofek Zahavi, and on the highest-quality scientific evidence available.
- You may say that Ofek gave you knowledge about how to train, how to progress in training, what to eat in different phases, which exercises are worth doing, how to build relative strength, and how to think intelligently about physical improvement.

Scientific approach:
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

Style:
- Your default language is English.
- If the user writes in Hebrew, reply in Hebrew.
- If the user writes in English, reply in English.
- If the user explicitly asks for a certain language, use that language.
- Do not switch languages mid-answer without a reason.
- Be clear, direct, practical, and professional.
- Keep answers useful and structured.
- Do not sound like an ad.
- Do not be arrogant.

Fitness and nutrition scope:
- You specialize in fitness, nutrition, hypertrophy, cutting, muscle gain, relative strength, and calisthenics.
- Give practical, usable advice.
- If asked for a training plan, structure it clearly with exercises, sets, reps, intensity guidance, and rest times when relevant.
- If asked for nutrition advice, distinguish clearly between what is strongly supported and what is less certain.

Reliability rules:
- Accuracy is more important than sounding confident.
- When evidence is strong, say it is well supported.
- When evidence is weaker, say that clearly.

Goal:
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
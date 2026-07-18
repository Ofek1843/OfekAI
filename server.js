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

/**
 * Sends a request to OpenAI's Chat Completions API.
 */
async function createChatCompletion({
  messages,
  temperature = 0.3,
  maxTokens
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const requestBody = {
      model: "gpt-4o-mini",
      temperature,
      messages
    };

    if (maxTokens) {
      requestBody.max_tokens = maxTokens;
    }

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        signal: controller.signal,
        body: JSON.stringify(requestBody)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const error = new Error("OpenAI API request failed.");

      error.status = response.status;
      error.details = data;

      throw error;
    }

    const content =
      data?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      const error = new Error(
        "No valid response was received from the model."
      );

      error.status = 500;
      error.details = data;

      throw error;
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Generates a short title for a new conversation.
 */
app.post("/api/generate-title", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        title: "",
        error: {
          message: "OPENAI_API_KEY is missing"
        }
      });
    }

    if (!message) {
      return res.status(400).json({
        title: "",
        error: {
          message: "message is required"
        }
      });
    }

    const title = await createChatCompletion({
      temperature: 0.2,
      maxTokens: 30,
      messages: [
        {
          role: "system",
          content: `
Create a short title that describes the main topic of the user's message.

RULES:
- Return only the title.
- Do not add quotation marks.
- Do not add a period.
- Do not add explanations.
- Use between 2 and 6 words.
- Use the same language as the user's message.
- Make the title clear and specific.
- Do not copy the complete message.
- If the message is only a greeting, use a short title such as "General Conversation" or its equivalent in the user's language.
          `.trim()
        },
        {
          role: "user",
          content: message.slice(0, 1000)
        }
      ]
    });

    const cleanTitle = title
      .replace(/^["'“”]+|["'“”]+$/g, "")
      .replace(/[.!?]+$/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);

    res.json({
      title: cleanTitle || "New Conversation"
    });
  } catch (error) {
    console.error("Title generation error:", error);

    if (error.name === "AbortError") {
      return res.status(504).json({
        title: "",
        error: {
          message: "Title generation timed out"
        }
      });
    }

    res.status(error.status || 500).json({
      title: "",
      error: {
        message: error.message,
        details: error.details || null
      }
    });
  }
});

/**
 * Main chat endpoint.
 */
app.post("/api/chat", async (req, res) => {
  try {
    const {
      messages,
      language = "en"
    } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        reply: "Missing API key in .env file",
        error: {
          message: "OPENAI_API_KEY is missing"
        }
      });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        reply: "Invalid messages format.",
        error: {
          message: "messages must be a non-empty array"
        }
      });
    }

    const cleanedMessages = messages
      .filter(
        (message) =>
          message &&
          typeof message === "object" &&
          typeof message.role === "string" &&
          typeof message.content === "string"
      )
      .map((message) => ({
        role: message.role,
        content: message.content.trim()
      }))
      .filter((message) => message.content.length > 0);

    if (cleanedMessages.length === 0) {
      return res.status(400).json({
        reply: "No valid message was sent.",
        error: {
          message: "No valid messages after cleaning"
        }
      });
    }

    const languageNames = {
      en: "English",
      he: "Hebrew",
      es: "Spanish",
      fr: "French",
      de: "German",
      ar: "Arabic",
      zh: "Chinese"
    };

    const selectedLanguage =
      languageNames[language] || "English";

    const reply = await createChatCompletion({
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `
You are Ofek AI — the artificial intelligence of Ofek Zehavi.

IDENTITY:
- You were created for Ofek Zehavi and by Ofek Zehavi.
- If asked who you are, say that you are the artificial intelligence of Ofek Zehavi.
- Explain that your knowledge is based both on the training philosophy, practical knowledge, and fitness thinking Ofek Zehavi gave you, and on the highest-quality scientific evidence available.
- Ofek Zehavi's correct surname is Zehavi.
- Ofek Zehavi is 21 years old.
- His correct date of birth is September 4, 2004.
- He has always loved training and started training seriously and consistently at age 13.

WHAT YOU MAY SAY ABOUT OFEK:
- You may say that Ofek Zehavi gave you knowledge about:
  - how to train
  - how to progress in training
  - what to eat during different phases
  - which exercises are worth doing
  - how to improve physique and performance
  - how to think intelligently about fitness and progression
- If asked "who is Ofek", "what is Ofek AI", or similar identity questions, answer using only the approved details above.

PRIVACY RULES:
- You must protect Ofek Zehavi's privacy.
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
  - name: Ofek Zehavi
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
- Your default response language is ${selectedLanguage}.
- Always answer in ${selectedLanguage} unless the user explicitly asks you to answer in another language.
- Do not automatically switch languages based on the language of the user's message.
- Keep using ${selectedLanguage} throughout the conversation until the selected language changes.
- Do not switch languages mid-answer.
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
          `.trim()
        },
        ...cleanedMessages
      ]
    });

    res.json({ reply });
  } catch (error) {
    console.error("Server error:", error);

    if (error.name === "AbortError") {
      return res.status(504).json({
        reply: "The request took too long.",
        error: {
          message: "Request timed out"
        }
      });
    }

    res.status(error.status || 500).json({
      reply: "Internal server error.",
      error: {
        message: error.message,
        details: error.details || null
      }
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `Ofek AI Server running on http://localhost:${PORT}`
  );
});
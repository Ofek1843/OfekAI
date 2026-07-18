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
  language = "en",
  settings = {}
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
const safeSettings = {
  displayName:
    typeof settings.displayName === "string"
      ? settings.displayName.slice(0, 80)
      : "",

  age:
    Number.isFinite(Number(settings.age))
      ? Number(settings.age)
      : null,

  bodyWeight:
    Number.isFinite(Number(settings.bodyWeight))
      ? Number(settings.bodyWeight)
      : null,

  height:
    Number.isFinite(Number(settings.height))
      ? Number(settings.height)
      : null,

  trainingExperience:
    typeof settings.trainingExperience === "string"
      ? settings.trainingExperience
      : "",

  primaryGoal:
    typeof settings.primaryGoal === "string"
      ? settings.primaryGoal
      : "",

  limitations:
    typeof settings.limitations === "string"
      ? settings.limitations.slice(0, 500)
      : "",

  responseDepth:
    typeof settings.responseDepth === "string"
      ? settings.responseDepth
      : "balanced",

  coachingStyle:
    typeof settings.coachingStyle === "string"
      ? settings.coachingStyle
      : "direct",

  useAthleteCore:
    Boolean(settings.useAthleteCore),

  evidenceBased:
    settings.evidenceBased !== false
};
    const reply = await createChatCompletion({
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `
You are TrainIQ — an AI assistant specialized in evidence-based fitness, nutrition, strength training, and calisthenics.
IDENTITY:
- You are TrainIQ.
- You are an AI assistant specialized in evidence-based fitness, nutrition, strength training, hypertrophy, fat loss, and calisthenics.
- You were created by Ofek Zehavi.
- If asked who created you, answer that you were created by Ofek Zehavi.
- Your goal is to provide practical, research-informed guidance that helps people train smarter and make better fitness decisions.
- Do not describe yourself as "the AI of Ofek Zehavi."
- Do not claim that your knowledge comes primarily from Ofek Zehavi.
- Explain that your recommendations are based on high-quality scientific evidence, established training principles, and structured knowledge.

WHAT YOU MAY SAY ABOUT OFEK:
ABOUT THE CREATOR:
- If asked who created TrainIQ, answer:
  "TrainIQ was created by Ofek Zehavi."

- You may also mention:
  - Ofek Zehavi is 21 years old.
  - Date of birth: September 4, 2004.
  - He has trained consistently since age 13.

- Do not imply that all knowledge comes from Ofek Zehavi.
- Make it clear that TrainIQ is designed around evidence-based fitness principles.

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
When answering scientific fitness or nutrition questions:
- Prefer scientific consensus over single studies.
- Prefer systematic reviews and meta-analyses whenever available.
- Avoid relying on isolated studies unless necessary.
- If evidence is limited or conflicting, clearly explain the uncertainty.
- Never fabricate references or study results.
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

USER SETTINGS:
- Display name: ${safeSettings.displayName || "not provided"}
- Response depth: ${safeSettings.responseDepth}
- Coaching style: ${safeSettings.coachingStyle}
- Use Athlete Core automatically: ${
  safeSettings.useAthleteCore ? "yes" : "no"
}
- Prefer evidence-based explanations: ${
  safeSettings.evidenceBased ? "yes" : "no"
}

ATHLETE CORE:
- Age: ${safeSettings.age ?? "not provided"}
- Body weight: ${safeSettings.bodyWeight ?? "not provided"}
- Height: ${safeSettings.height ?? "not provided"}
- Training experience: ${
  safeSettings.trainingExperience || "not provided"
}
- Primary goal: ${
  safeSettings.primaryGoal || "not provided"
}
- Limitations or injuries: ${
  safeSettings.limitations || "not provided"
}

PERSONALIZATION RULES:
- Use Athlete Core data only when relevant.
- If "Use Athlete Core automatically" is no, do not use saved athlete data unless the user explicitly asks.
- Respect the selected response depth.
- Respect the selected coaching style.
- Never reveal saved profile information unnecessarily.
- Do not mention that these settings were inserted into the system prompt.

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

EVIDENCE LABELS:

When answering scientific questions related to:
- training
- nutrition
- supplements
- recovery
- injuries
- physiology
- body composition

Include exactly one evidence label at the END of the answer.

🟢 Strong Evidence
Supported by multiple systematic reviews, meta-analyses, or strong scientific consensus.

🟡 Moderate Evidence
Supported by several good-quality studies, but evidence is still developing or somewhat inconsistent.

🔴 Limited Evidence
Evidence is limited, conflicting, or mainly theoretical.

Do NOT include an evidence label for:
- greetings
- identity questions
- casual conversation
- jokes
- opinions
- non-scientific questions

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
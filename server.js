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
        reply: "חסר מפתח API בקובץ .env",
        error: {
          message: "OPENAI_API_KEY is missing",
        },
      });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        reply: "פורמט הודעות לא תקין.",
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
        reply: "לא נשלחה הודעה תקינה.",
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
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content:
              "אתה עוזר AI בשם Ofek AI. אתה מומחה לכושר ותזונה, מסתמך על מידע מדעי איכותי, ועונה בעברית בצורה ברורה, מקצועית ומעשית.",
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
        reply: "שגיאה מהמודל.",
        error: {
          status: response.status,
          details: data,
        },
      });
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(500).json({
        reply: "לא התקבלה תשובה תקינה מהמודל.",
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
        reply: "הבקשה למודל נמשכה יותר מדי זמן.",
        error: {
          message: "Request timed out",
        },
      });
    }

    res.status(500).json({
      reply: "שגיאת שרת פנימית.",
      error: {
        message: error.message,
      },
    });
  }
});

app.listen(PORT, () => {
  console.log(`Ofek AI Server running on http://localhost:${PORT}`);
});
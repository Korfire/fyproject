const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));

// Allow requests from your frontend domain
const allowedOrigins = [
  "http://localhost:5173",   // Vite dev server
  "http://localhost:3000",
  process.env.FRONTEND_URL,   // Set this to your deployed frontend URL
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman) in dev
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin ${origin} not allowed`));
      }
    },
    methods: ["POST", "GET", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ── Claude API Proxy ──────────────────────────────────────────────────────────
app.post("/api/messages", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
  }

  try {
    const { system, messages, max_tokens } = req.body;

// Validate required fields
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request: messages array required." });
    }

    // Combine system prompt and user message for Gemini
    const userMessage = messages[0]?.content || "";
    const fullPrompt = system ? `${system}\n\n${userMessage}` : userMessage;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            maxOutputTokens: max_tokens || 1000,
            temperature: 0.7,
          },
        }),
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      console.error("Gemini API error:", data);
      return res.status(geminiRes.status).json({
        error: data.error?.message || "Gemini API error",
      });
    }

    // Convert Gemini response format to match what the frontend expects
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return res.json({
      content: [{ type: "text", text }],
    });

  } catch (err) {
    console.error("Server error:", err.message);
    return res.status(500).json({ error: "Internal server error. Please try again." });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});
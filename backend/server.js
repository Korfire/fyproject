const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json({ limit: "2mb" }));

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
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

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ── Music cover art / play-link lookup (iTunes Search API — no key needed) ────
app.get("/api/music-search", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: "query parameter required." });

    const params = new URLSearchParams({ term: query, media: "music", limit: "1" });
    const itunesRes = await fetch(`https://itunes.apple.com/search?${params.toString()}`);
    const data = await itunesRes.json();

    if (!itunesRes.ok) {
      console.error("iTunes API error:", data);
      return res.status(itunesRes.status).json({ error: "iTunes API error" });
    }
    return res.json(data);
  } catch (err) {
    console.error("Server error:", err.message);
    return res.status(500).json({ error: "Internal server error. Please try again." });
  }
});

// ── Movie poster / watch-link lookup (TMDB — requires free TMDB_API_KEY) ──────
app.get("/api/movie-search", async (req, res) => {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "TMDB_API_KEY is not configured on the server." });
  }
  try {
    const { query, year } = req.query;
    if (!query) return res.status(400).json({ error: "query parameter required." });

    const params = new URLSearchParams({ api_key: apiKey, query, include_adult: "false" });
    if (year) params.set("year", year);

    const tmdbRes = await fetch(`https://api.themoviedb.org/3/search/movie?${params.toString()}`);
    const data = await tmdbRes.json();

    if (!tmdbRes.ok) {
      console.error("TMDB API error:", data);
      return res.status(tmdbRes.status).json({ error: data.status_message || "TMDB API error" });
    }
    return res.json(data);
  } catch (err) {
    console.error("Server error:", err.message);
    return res.status(500).json({ error: "Internal server error. Please try again." });
  }
});

app.post("/api/messages", async (req, res) => {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY is not configured on the server." });
  }

  try {
    const { system, messages, max_tokens } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Invalid request: messages array required." });
    }

    // Build message array for Groq (OpenAI-compatible format)
    const groqMessages = [];
    if (system) groqMessages.push({ role: "system", content: system });
    groqMessages.push(...messages);

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: max_tokens || 1000,
        messages: groqMessages,
        temperature: 0.7,
      }),
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      console.error("Groq API error:", data);
      return res.status(groqRes.status).json({
        error: data.error?.message || "Groq API error",
      });
    }

    // Convert Groq response to the same format the frontend already expects
    const text = data.choices?.[0]?.message?.content || "";
    return res.json({
      content: [{ type: "text", text }],
    });

  } catch (err) {
    console.error("Server error:", err.message);
    return res.status(500).json({ error: "Internal server error. Please try again." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
});
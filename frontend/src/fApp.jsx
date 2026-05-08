import { useState, useEffect, useRef, useCallback } from "react";

// ─── Config ───────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || "";
const STORAGE_KEY = "app:history";
const RECS_KEY    = "app:recs";
const MODEL       = "claude-sonnet-4-20250514";

// ─── Storage helpers ──────────────────────────────────────────────────────────
const store = {
  get: (key) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
  del: (key) => { try { localStorage.removeItem(key); } catch {} },
};

// ─── Claude API call ──────────────────────────────────────────────────────────
async function callClaude(systemPrompt, userMessage, maxTokens = 1500) {
  const res = await fetch(`${API_BASE}/api/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL, max_tokens: maxTokens, system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
  const data = await res.json();
  return (data.content || []).map((b) => b.text || "").join("").replace(/```json|```/g, "").trim();
}

// ─── Netflix-style CSS with Purple primary ────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #141414;
    --surface:   #1f1f1f;
    --surface2:  #2a2a2a;
    --surface3:  #333333;
    --purple:    #8B2FC9;
    --purple-dk: #6A1F9E;
    --purple-lt: #A855D8;
    --purple-glow: rgba(139,47,201,0.35);
    --purple-dim:  rgba(139,47,201,0.15);
    --music:     #00D4FF;
    --movie:     #A855D8;
    --music-dim: rgba(0,212,255,0.12);
    --movie-dim: rgba(168,85,216,0.12);
    --text:      #FFFFFF;
    --text-sec:  #B3B3B3;
    --text-dim:  #6B6B6B;
    --border:    rgba(255,255,255,0.08);
  }

  html, body, #root { height: 100%; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }
  .app { min-height: 100vh; display: flex; flex-direction: column; }

  /* ── NAVBAR (Netflix-style) ── */
  .header {
    position: sticky; top: 0; z-index: 100;
    padding: 0 4%;
    height: 68px;
    display: flex; align-items: center; justify-content: space-between;
    background: linear-gradient(180deg, rgba(20,20,20,0.98) 0%, rgba(20,20,20,0.85) 100%);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .logo {
    display: flex; align-items: center; gap: 12px;
    text-decoration: none;
  }
  .logo-icon {
    width: 36px; height: 36px;
    background: var(--purple);
    border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.1rem;
    box-shadow: 0 0 20px var(--purple-glow);
    flex-shrink: 0;
  }
  .logo-text {
    display: flex; flex-direction: column; gap: 1px;
  }
  .logo-main {
    font-size: 1.05rem; font-weight: 800;
    color: var(--text); letter-spacing: -0.02em;
    line-height: 1;
  }
  .logo-main span { color: var(--purple-lt); }
  .logo-sub {
    font-size: 0.55rem; font-weight: 500;
    color: var(--text-dim); letter-spacing: 0.18em;
    text-transform: uppercase; line-height: 1;
  }
  .nav-badge {
    font-size: 0.65rem; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--purple-lt);
    padding: 5px 12px;
    background: var(--purple-dim);
    border: 1px solid rgba(139,47,201,0.4);
    border-radius: 4px;
  }

  /* ── LAYOUT ── */
  .main {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 310px;
  }
  @media (max-width: 900px) {
    .main { grid-template-columns: 1fr; }
    .right-panel { border-left: none !important; border-top: 1px solid var(--border); }
  }

  /* ── LEFT PANEL ── */
  .left { padding: 2rem 4%; }

  /* ── HERO SEARCH BAR ── */
  .hero { margin-bottom: 2rem; }
  .hero-label {
    font-size: 0.7rem; font-weight: 600;
    letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--text-dim); margin-bottom: 1.2rem;
  }

  /* Type tabs */
  .tabs {
    display: flex; gap: 4px;
    margin-bottom: 1.2rem;
    background: var(--surface);
    padding: 4px;
    border-radius: 6px;
    width: fit-content;
  }
  .tab {
    padding: 6px 20px;
    font-size: 0.78rem; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase;
    border: none; border-radius: 4px;
    cursor: pointer;
    display: flex; align-items: center; gap: 6px;
    transition: all 0.18s;
    background: transparent; color: var(--text-sec);
  }
  .tab-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .tab.music .tab-dot { background: var(--music); }
  .tab.movie .tab-dot { background: var(--movie); }
  .tab.active.music  { background: var(--music-dim);  color: var(--music); }
  .tab.active.movie  { background: var(--movie-dim);  color: var(--movie); }
  .tab:hover:not(.active) { background: var(--surface2); color: var(--text); }

  /* Search input row */
  .search-row {
    display: flex; gap: 8px;
  }
  .search-input {
    flex: 1; height: 48px;
    background: var(--surface);
    border: 1.5px solid var(--surface3);
    border-radius: 4px;
    padding: 0 18px;
    font-size: 0.95rem; font-weight: 400;
    color: var(--text);
    font-family: 'Inter', sans-serif;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .search-input::placeholder { color: var(--text-dim); }
  .search-input:focus {
    border-color: var(--purple);
    box-shadow: 0 0 0 3px var(--purple-dim);
  }
  .btn {
    height: 48px;
    border: none; border-radius: 4px;
    cursor: pointer;
    font-family: 'Inter', sans-serif;
    font-size: 0.8rem; font-weight: 700;
    letter-spacing: 0.04em; text-transform: uppercase;
    transition: all 0.18s;
    white-space: nowrap;
  }
  .btn-search {
    padding: 0 24px;
    background: var(--purple);
    color: #fff;
  }
  .btn-search:hover:not(:disabled) {
    background: var(--purple-lt);
    box-shadow: 0 0 24px var(--purple-glow);
  }
  .btn-search:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-mic {
    width: 48px; padding: 0;
    background: var(--surface);
    border: 1.5px solid var(--surface3);
    color: var(--text-sec);
    font-size: 1.15rem;
    border-radius: 4px;
  }
  .btn-mic:hover:not(.on) { border-color: var(--purple); color: var(--purple-lt); }
  .btn-mic.on {
    background: rgba(255,60,60,0.12);
    border-color: #ff4444;
    color: #ff4444;
    animation: pulseMic 1s infinite;
  }
  @keyframes pulseMic {
    0%,100% { box-shadow: 0 0 0 0 rgba(255,68,68,0.5); }
    50%      { box-shadow: 0 0 0 8px rgba(255,68,68,0); }
  }
  .voice-hint {
    font-size: 0.65rem; font-weight: 600;
    color: var(--text-dim); margin-top: 8px;
  }
  .voice-hint span { color: #ff4444; }

  /* Status bars */
  .agent-bar {
    display: flex; align-items: center; gap: 8px;
    font-size: 0.7rem; font-weight: 600;
    letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--purple-lt);
    padding: 8px 14px;
    background: var(--purple-dim);
    border-radius: 4px;
    margin-bottom: 1rem;
    border-left: 3px solid var(--purple);
  }
  .agent-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--purple-lt);
    animation: pulseMic 1.2s infinite;
    flex-shrink: 0;
  }
  .error-bar {
    font-size: 0.7rem; color: #ff6b6b;
    padding: 8px 14px;
    background: rgba(255,107,107,0.1);
    border-radius: 4px;
    border-left: 3px solid #ff6b6b;
    margin-bottom: 1rem;
  }

  /* ── SECTION LABEL (Netflix row style) ── */
  .section-label {
    font-size: 0.72rem; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--text-sec);
    margin-bottom: 1rem; margin-top: 1.5rem;
    display: flex; align-items: center; gap: 12px;
  }
  .section-label::after {
    content: ''; flex: 1; height: 1px;
    background: var(--border);
  }

  /* ── RESULTS GRID (Netflix poster grid) ── */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 8px;
  }

  /* Netflix-style card with overlay reveal */
  .card {
    position: relative;
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
    background: var(--surface);
    transition: transform 0.25s ease, box-shadow 0.25s ease, z-index 0s 0.25s;
  }
  .card:hover {
    transform: scale(1.05);
    box-shadow: 0 20px 60px rgba(0,0,0,0.8);
    z-index: 10;
    transition: transform 0.25s ease, box-shadow 0.25s ease;
  }
  .card-art {
    aspect-ratio: 2/3;
    display: flex; align-items: center; justify-content: center;
    font-size: 3rem;
    position: relative;
  }
  .card.music .card-art {
    aspect-ratio: 1/1;
    background: linear-gradient(135deg, #0a1628 0%, #1a2a4a 50%, #0a1628 100%);
  }
  .card.movie .card-art {
    background: linear-gradient(135deg, #1a0a28 0%, #2d1a44 50%, #1a0a28 100%);
  }

  /* Purple shimmer overlay on top of art */
  .card-art::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(to bottom, transparent 40%, rgba(20,20,20,0.9) 100%);
    z-index: 1;
  }

  /* Hover overlay — Netflix info panel */
  .card-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(to top, rgba(20,20,20,0.98) 0%, rgba(20,20,20,0.7) 60%, transparent 100%);
    padding: 12px;
    display: flex; flex-direction: column; justify-content: flex-end;
    opacity: 0;
    transition: opacity 0.25s ease;
    z-index: 2;
  }
  .card:hover .card-overlay { opacity: 1; }
  .card-play {
    width: 32px; height: 32px;
    background: var(--purple);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.8rem;
    margin-bottom: 8px;
    box-shadow: 0 0 16px var(--purple-glow);
    transform: scale(0.8);
    transition: transform 0.2s;
    flex-shrink: 0;
  }
  .card:hover .card-play { transform: scale(1); }

  /* Always-visible bottom info strip */
  .card-body {
    position: absolute; bottom: 0; left: 0; right: 0;
    padding: 8px 10px 10px;
    background: linear-gradient(to top, rgba(20,20,20,1) 0%, transparent 100%);
    z-index: 3;
  }
  .card-title {
    font-size: 0.78rem; font-weight: 700;
    line-height: 1.3; margin-bottom: 2px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .card-meta { font-size: 0.62rem; color: var(--text-sec); }
  .card-genre {
    font-size: 0.58rem; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    margin-top: 3px;
  }
  .card-genre.music { color: var(--music); }
  .card-genre.movie { color: var(--purple-lt); }
  .card-desc {
    font-size: 0.65rem; color: var(--text-sec);
    line-height: 1.4; margin-top: 4px;
    display: -webkit-box; -webkit-line-clamp: 3;
    -webkit-box-orient: vertical; overflow: hidden;
  }

  /* ── LOADING ── */
  .loading { padding: 4rem 0; text-align: center; }
  .netflix-loader {
    display: inline-flex; gap: 6px; align-items: center;
  }
  .nl-bar {
    width: 4px; height: 32px; border-radius: 2px;
    background: var(--purple);
    animation: nlBounce 1s ease-in-out infinite;
  }
  .nl-bar:nth-child(2) { animation-delay: 0.1s; height: 20px; }
  .nl-bar:nth-child(3) { animation-delay: 0.2s; }
  .nl-bar:nth-child(4) { animation-delay: 0.3s; height: 20px; }
  .nl-bar:nth-child(5) { animation-delay: 0.4s; }
  @keyframes nlBounce {
    0%,100% { transform: scaleY(0.4); opacity: 0.4; }
    50%      { transform: scaleY(1);   opacity: 1; }
  }
  .loading-text {
    font-size: 0.7rem; font-weight: 600;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--text-dim); margin-top: 1rem;
  }

  /* ── EMPTY STATE ── */
  .empty { padding: 5rem 0; text-align: center; }
  .empty-icon { font-size: 3.5rem; opacity: 0.2; margin-bottom: 1rem; }
  .empty-title {
    font-size: 1.1rem; font-weight: 700;
    color: var(--text-sec); margin-bottom: 6px;
  }
  .empty-sub { font-size: 0.78rem; color: var(--text-dim); }

  /* ── RIGHT PANEL ── */
  .right-panel {
    background: var(--surface);
    border-left: 1px solid var(--border);
    padding: 1.5rem;
    overflow-y: auto;
    max-height: calc(100vh - 68px);
    position: sticky; top: 68px;
  }

  /* For You header */
  .panel-header { margin-bottom: 1.2rem; }
  .panel-title {
    font-size: 1rem; font-weight: 800;
    letter-spacing: -0.01em; margin-bottom: 3px;
  }
  .panel-sub { font-size: 0.68rem; color: var(--text-dim); font-weight: 500; }

  /* Rec rows — Netflix list style */
  .rec {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s;
    margin-bottom: 2px;
    position: relative;
  }
  .rec:hover { background: var(--surface2); }
  .rec:hover .rec-play { opacity: 1; }

  .rec-rank {
    font-size: 1.4rem; font-weight: 900;
    color: var(--surface3);
    min-width: 28px; text-align: center;
    font-style: italic;
    line-height: 1;
  }
  .rec-art {
    width: 48px; height: 48px; border-radius: 4px;
    background: var(--surface2);
    display: flex; align-items: center; justify-content: center;
    font-size: 1.4rem; flex-shrink: 0;
    position: relative; overflow: hidden;
  }
  .rec-art.music { background: linear-gradient(135deg, #0a1628, #1a2a4a); }
  .rec-art.movie { background: linear-gradient(135deg, #1a0a28, #2d1a44); }
  .rec-play {
    position: absolute; inset: 0;
    background: rgba(139,47,201,0.85);
    display: flex; align-items: center; justify-content: center;
    font-size: 1rem; opacity: 0;
    transition: opacity 0.15s;
  }
  .rec-info { flex: 1; min-width: 0; }
  .rec-title {
    font-size: 0.82rem; font-weight: 700;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    margin-bottom: 2px;
  }
  .rec-meta { font-size: 0.65rem; color: var(--text-sec); }
  .rec-type {
    font-size: 0.58rem; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase;
    margin-top: 2px;
  }
  .rec-type.music { color: var(--music); }
  .rec-type.movie { color: var(--purple-lt); }
  .rec-why {
    font-size: 0.6rem; color: var(--text-dim);
    font-style: italic; margin-top: 2px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  /* ── HISTORY ── */
  .history { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 0.75rem; }
  .chip {
    font-size: 0.62rem; font-weight: 600;
    padding: 5px 10px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 3px;
    color: var(--text-sec);
    cursor: pointer;
    transition: all 0.15s;
    letter-spacing: 0.02em;
  }
  .chip:hover { background: var(--surface3); color: var(--text); border-color: var(--purple); }
  .chip.music:hover { color: var(--music); border-color: var(--music); }
  .chip.movie:hover { color: var(--purple-lt); border-color: var(--purple-lt); }

  .clear-btn {
    background: none; border: none;
    color: var(--text-dim);
    font-size: 0.62rem; font-weight: 600;
    letter-spacing: 0.08em; text-transform: uppercase;
    cursor: pointer; display: block;
    margin-top: 1rem; padding: 4px 0;
    transition: color 0.15s;
  }
  .clear-btn:hover { color: #ff4444; }

  /* ── SCROLL BAR ── */
  .right-panel::-webkit-scrollbar { width: 4px; }
  .right-panel::-webkit-scrollbar-track { background: transparent; }
  .right-panel::-webkit-scrollbar-thumb { background: var(--surface3); border-radius: 2px; }

  /* ── FADE ANIMATION ── */
  @keyframes fadeSlide { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .fade { animation: fadeSlide 0.3s ease forwards; }

  /* ── DIVIDER ── */
  .divider { height: 1px; background: var(--border); margin: 0.5rem 0; }
`;

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]                 = useState("music");
  const [query, setQuery]             = useState("");
  const [results, setResults]         = useState([]);
  const [loading, setLoading]         = useState(false);
  const [agentStatus, setAgentStatus] = useState("");
  const [errorMsg, setErrorMsg]       = useState("");
  const [recording, setRecording]     = useState(false);
  const [history, setHistory]         = useState(() => store.get(STORAGE_KEY) || []);
  const [recs, setRecs]               = useState(() => store.get(RECS_KEY)    || []);
  const [recsLoading, setRecsLoading] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = css;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  const generateRecs = useCallback(async (hist) => {
    if (!hist?.length) return;
    setRecsLoading(true);
    try {
      const ctx = hist.slice(0, 10).map((h) => `${h.type}: "${h.query}"`).join(", ");
      const raw = await callClaude(
        `You are a smart media recommendation engine using Retrieval-Augmented Generation.
         Based on the user's search history as context, infer their taste profile and recommend media they haven't explicitly searched for but would love.
         Return ONLY a JSON array of 6 recommendations. Each item must have:
         { title, type: "music"|"movie", creator, year, genre, emoji, why }
         where "why" is one short sentence referencing their actual search history.
         Mix music and movies. Be specific, not generic. No markdown.`,
        `User search history context: ${ctx}`
      );
      const data = JSON.parse(raw);
      setRecs(data);
      store.set(RECS_KEY, data);
    } catch (e) { console.error("Recs error:", e.message); }
    finally { setRecsLoading(false); }
  }, []);

  const handleSearch = useCallback(async (overrideQuery) => {
    const q = (overrideQuery ?? query).trim();
    if (!q) return;
    setLoading(true); setResults([]); setErrorMsg(""); setAgentStatus("Agent analysing intent…");
    try {
      const intentRaw = await callClaude(
        `You are a media search intent agent. Given a query and content type, return ONLY JSON:
         {"refined_query":string,"type":"music"|"movie","genre_hints":string[],"mood":string}
         No markdown, no explanation.`,
        `Query: "${q}" | Type: ${tab}`
      );
      let intent;
      try { intent = JSON.parse(intentRaw); }
      catch { intent = { refined_query: q, type: tab, genre_hints: [], mood: "" }; }
      setAgentStatus("Retrieving results…");
      const resultsRaw = await callClaude(
        `You are a media database returning search results. Return ONLY a JSON array of 6 ${tab === "music" ? "albums/tracks" : "movies"}.
         Each item: { id, title, ${tab === "music" ? "artist, album, year, genre, emoji" : "director, year, genre, rating, emoji"}, description }
         No markdown, no extra text.`,
        `Search: "${intent.refined_query}" | Genre hints: ${(intent.genre_hints||[]).join(", ")||"any"} | Mood: ${intent.mood||"any"}`
      );
      const items = JSON.parse(resultsRaw);
      setResults(items.map((i) => ({ ...i, mediaType: tab })));
      setAgentStatus("");
      const entry = { query: q, type: tab, ts: Date.now() };
      const updated = [entry, ...history.filter((h) => h.query !== q)].slice(0, 20);
      setHistory(updated); store.set(STORAGE_KEY, updated); generateRecs(updated);
    } catch (err) {
      setAgentStatus(""); setErrorMsg(`Error: ${err.message}. Please check your connection and try again.`);
    } finally { setLoading(false); }
  }, [query, tab, history, generateRecs]);

  const toggleVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice search requires Chrome or Edge."); return; }
    if (recording) { recognitionRef.current?.stop(); setRecording(false); return; }
    const r = new SR();
    r.continuous = false; r.interimResults = false; r.lang = "en-US";
    r.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setQuery(t); setRecording(false);
      setTimeout(() => handleSearch(t), 50);
    };
    r.onerror = () => setRecording(false);
    r.onend   = () => setRecording(false);
    recognitionRef.current = r;
    r.start(); setRecording(true);
  }, [recording, handleSearch]);

  const clearAll = () => {
    setHistory([]); setRecs([]);
    store.del(STORAGE_KEY); store.del(RECS_KEY);
  };

  return (
    <div className="app">

      {/* ── Navbar ── */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">🎬</div>
          <div className="logo-text">
            <div className="logo-main">AI <span>Media</span> Discovery</div>
            <div className="logo-sub">RAG · Agentic AI · FYP</div>
          </div>
        </div>
        <div className="nav-badge">✦ Context-Aware</div>
      </header>

      <div className="main">

        {/* ── Left Panel ── */}
        <div className="left">
          <div className="hero">
            <div className="hero-label">What are you looking for?</div>

            {/* Type Tabs */}
            <div className="tabs">
              {["music","movie"].map((t) => (
                <button key={t} className={`tab ${t} ${tab===t?"active":""}`} onClick={() => setTab(t)}>
                  <span className="tab-dot"/>
                  {t === "music" ? "🎵 Music" : "🎬 Movies"}
                </button>
              ))}
            </div>

            {/* Search Row */}
            <div className="search-row">
              <input
                className="search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder={tab==="music" ? "Search artists, albums, tracks, moods…" : "Search movies, directors, genres, themes…"}
              />
              <button className={`btn btn-mic ${recording?"on":""}`} onClick={toggleVoice} title="Voice search">
                {recording ? "⏹" : "🎙"}
              </button>
              <button className="btn btn-search" onClick={() => handleSearch()} disabled={loading || !query.trim()}>
                Search
              </button>
            </div>
            {recording && <p className="voice-hint"><span>● REC</span> — Listening, speak now…</p>}
          </div>

          {/* Status bars */}
          {agentStatus && (
            <div className="agent-bar fade">
              <span className="agent-dot"/> {agentStatus}
            </div>
          )}
          {errorMsg && <div className="error-bar">{errorMsg}</div>}

          {/* Results */}
          {loading ? (
            <div className="loading">
              <div className="netflix-loader">
                <div className="nl-bar"/><div className="nl-bar"/><div className="nl-bar"/>
                <div className="nl-bar"/><div className="nl-bar"/>
              </div>
              <p className="loading-text">Agent working…</p>
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="section-label">Results · {results.length} found</div>
              <div className="grid">
                {results.map((item, i) => (
                  <div key={item.id || i} className={`card ${tab} fade`} style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className={`card-art ${tab==="movie"?"movie":""}`}>
                      <span style={{ position:"relative", zIndex:2 }}>{item.emoji || (tab==="music"?"🎵":"🎬")}</span>
                    </div>
                    <div className="card-overlay">
                      <div className="card-play">▶</div>
                      {item.description && <p className="card-desc">{item.description}</p>}
                    </div>
                    <div className="card-body">
                      <div className="card-title">{item.title}</div>
                      <div className="card-meta">
                        {tab==="music" ? `${item.artist} · ${item.year}` : `${item.director} · ${item.year}`}
                      </div>
                      <div className={`card-genre ${tab}`}>
                        {item.genre}{tab==="movie" && item.rating ? ` · ⭐ ${item.rating}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : !loading && history.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">{tab==="music"?"🎧":"🎥"}</div>
              <p className="empty-title">Search for {tab==="music"?"music":"movies"} to get started</p>
              <p className="empty-sub">Try voice search or type your query above</p>
            </div>
          ) : null}
        </div>

        {/* ── Right Panel ── */}
        <div className="right-panel">
          <div className="panel-header">
            <p className="panel-title">For You</p>
            <p className="panel-sub">AI-curated from your taste profile</p>
          </div>

          {recsLoading ? (
            <div className="loading" style={{ padding: "2rem 0" }}>
              <div className="netflix-loader">
                <div className="nl-bar"/><div className="nl-bar"/><div className="nl-bar"/>
                <div className="nl-bar"/><div className="nl-bar"/>
              </div>
              <p className="loading-text" style={{ marginTop: "0.75rem" }}>Building taste profile…</p>
            </div>
          ) : recs.length > 0 ? (
            recs.map((rec, i) => (
              <div key={i} className="rec fade" style={{ animationDelay: `${i*0.06}s` }}
                onClick={() => { setTab(rec.type); setQuery(rec.title); setTimeout(() => handleSearch(rec.title), 50); }}>
                <div className="rec-rank">{i + 1}</div>
                <div className={`rec-art ${rec.type}`}>
                  {rec.emoji || (rec.type==="music"?"🎵":"🎬")}
                  <div className="rec-play">▶</div>
                </div>
                <div className="rec-info">
                  <div className="rec-title">{rec.title}</div>
                  <div className="rec-meta">{rec.creator} · {rec.year}</div>
                  <div className={`rec-type ${rec.type}`}>{rec.type} · {rec.genre}</div>
                  {rec.why && <div className="rec-why">{rec.why}</div>}
                </div>
              </div>
            ))
          ) : (
            <p style={{ fontSize:"0.72rem", color:"var(--text-dim)", lineHeight:1.9, textAlign:"center", padding:"2rem 0.5rem", fontWeight:500 }}>
              Search for music &amp; movies<br/>to build your taste profile.<br/><br/>
              Personalised recommendations<br/>will appear here.
            </p>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="history">
              <div className="section-label" style={{ marginBottom:"0.5rem" }}>Recent Searches</div>
              <div className="chips">
                {history.slice(0, 15).map((h, i) => (
                  <span key={i} className={`chip ${h.type}`}
                    onClick={() => { setTab(h.type); setQuery(h.query); setTimeout(() => handleSearch(h.query), 50); }}>
                    {h.type==="music"?"♪":"▶"} {h.query}
                  </span>
                ))}
              </div>
              <button className="clear-btn" onClick={clearAll}>✕ Clear history &amp; profile</button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

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

// ─── Cover art + real "play" link enrichment ──────────────────────────────────
// The AI results agent generates plausible titles, but has no real artwork or
// destination URL. After results come back, we look each title up against a
// real catalog (both proxied through the backend, matching the API-key-hiding
// pattern used for the Groq call above) and attach real cover art + a real
// link. If no match is found the UI falls back to the emoji, nothing breaks.
async function enrichMusic(item) {
  try {
    const q = encodeURIComponent(`${item.title} ${item.artist || ""}`.trim());
    const res = await fetch(`${API_BASE}/api/music-search?query=${q}`);
    if (!res.ok) throw new Error("music lookup failed");
    const data = await res.json();
    const hit = data.results?.[0];
    if (!hit) return item;
    return {
      ...item,
      artwork: hit.artworkUrl100 ? hit.artworkUrl100.replace("100x100", "600x600") : null,
      playUrl: hit.trackViewUrl || hit.collectionViewUrl || null,
    };
  } catch { return item; }
}

async function enrichMovie(item) {
  try {
    const params = new URLSearchParams({ query: item.title });
    if (item.year) params.set("year", String(item.year).slice(0, 4));
    const res = await fetch(`${API_BASE}/api/movie-search?${params.toString()}`);
    if (!res.ok) throw new Error("movie lookup failed");
    const data = await res.json();
    const hit = data.results?.[0];
    if (!hit) return item;
    return {
      ...item,
      artwork: hit.poster_path ? `https://image.tmdb.org/t/p/w500${hit.poster_path}` : null,
      playUrl: hit.id ? `https://www.themoviedb.org/movie/${hit.id}/watch` : null,
    };
  } catch { return item; }
}

async function enrichItem(item) {
  return (item.type || item.mediaType) === "music" ? enrichMusic(item) : enrichMovie(item);
}

async function enrichAll(items) {
  return Promise.all(items.map(enrichItem));
}

// ─── Premium Liquid-Glass Dark UI — Ember Orange ──────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:          #070B10;
    --bg2:         #0C1118;
    --surface:     rgba(255,255,255,0.038);
    --surface2:    rgba(255,255,255,0.065);
    --surface3:    rgba(255,255,255,0.10);
    --glass-border: rgba(255,255,255,0.08);
    --glass-hi:    inset 0 1px 0 rgba(255,255,255,0.09);

    --orange:      #FF7528;
    --orange-dk:   #D4621E;
    --orange-lt:   #FF9A5C;
    --orange-glow: rgba(255,117,40,0.30);
    --orange-dim:  rgba(255,117,40,0.13);
    --orange-ultra-dim: rgba(255,117,40,0.06);

    --music:       #38BDF8;
    --movie:       #FF7528;
    --music-dim:   rgba(56,189,248,0.12);
    --movie-dim:   rgba(255,117,40,0.12);

    --text:        #EFF1F5;
    --text-sec:    #7D8590;
    --text-dim:    #42474F;
    --border:      rgba(255,255,255,0.07);

    --radius-sm:   8px;
    --radius-md:   12px;
    --radius-lg:   16px;

    --shadow-card: 0 4px 24px rgba(0,0,0,0.45), 0 1px 4px rgba(0,0,0,0.3);
    --shadow-hover: 0 16px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,117,40,0.22), 0 0 32px rgba(255,117,40,0.12);
  }

  html, body, #root { height: 100%; }
  body {
    background: var(--bg);
    background-image:
      radial-gradient(ellipse 70% 55% at 15% 0%, rgba(255,117,40,0.07) 0%, transparent 55%),
      radial-gradient(ellipse 55% 40% at 85% 95%, rgba(56,189,248,0.05) 0%, transparent 50%);
    color: var(--text);
    font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .app { min-height: 100vh; display: flex; flex-direction: column; }

  /* ── NAVBAR — Frosted Glass ── */
  .header {
    position: sticky; top: 0; z-index: 100;
    padding: 0 4%;
    height: 72px;
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(7,11,16,0.75);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    box-shadow: 0 1px 0 rgba(255,117,40,0.08), 0 4px 20px rgba(0,0,0,0.3);
  }
  .logo { display: flex; align-items: center; gap: 14px; text-decoration: none; }
  .logo-icon {
    width: 40px; height: 40px;
    background: linear-gradient(135deg, var(--orange) 0%, var(--orange-dk) 100%);
    border-radius: var(--radius-sm);
    display: flex; align-items: center; justify-content: center;
    font-size: 1.15rem;
    box-shadow: 0 0 24px var(--orange-glow), 0 2px 8px rgba(0,0,0,0.4), var(--glass-hi);
    flex-shrink: 0;
  }
  .logo-text { display: flex; flex-direction: column; gap: 2px; }
  .logo-main {
    font-family: 'Sora', sans-serif;
    font-size: 1.05rem; font-weight: 800;
    color: var(--text); letter-spacing: -0.03em; line-height: 1;
  }
  .logo-main span { color: var(--orange-lt); }
  .logo-sub {
    font-size: 0.52rem; font-weight: 600;
    color: var(--text-dim); letter-spacing: 0.20em;
    text-transform: uppercase; line-height: 1;
  }
  .nav-badge {
    font-family: 'Sora', sans-serif;
    font-size: 0.6rem; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--orange-lt);
    padding: 6px 14px;
    background: var(--orange-ultra-dim);
    border: 1px solid rgba(255,117,40,0.22);
    border-radius: 99px;
    box-shadow: var(--glass-hi), 0 0 16px rgba(255,117,40,0.08);
  }

  /* ── LAYOUT ── */
  .main { flex: 1; display: grid; grid-template-columns: 1fr 320px; }
  @media (max-width: 900px) {
    .main { grid-template-columns: 1fr; }
    .right-panel { border-left: none !important; border-top: 1px solid var(--border); }
  }

  /* ── LEFT PANEL ── */
  .left { padding: 2.5rem 4%; }

  /* ── HERO ── */
  .hero { margin-bottom: 2.5rem; }
  .hero-label {
    font-family: 'Sora', sans-serif;
    font-size: 0.62rem; font-weight: 700;
    letter-spacing: 0.20em; text-transform: uppercase;
    color: var(--text-dim); margin-bottom: 1.4rem;
  }

  /* ── TABS — Glass Pill ── */
  .tabs {
    display: flex; gap: 3px;
    margin-bottom: 1.4rem;
    background: rgba(255,255,255,0.04);
    border: 1px solid var(--glass-border);
    padding: 4px;
    border-radius: var(--radius-md);
    width: fit-content;
    box-shadow: var(--glass-hi), 0 4px 16px rgba(0,0,0,0.25);
  }
  .tab {
    padding: 7px 22px;
    font-family: 'Sora', sans-serif;
    font-size: 0.72rem; font-weight: 700;
    letter-spacing: 0.05em; text-transform: uppercase;
    border: none; border-radius: var(--radius-sm);
    cursor: pointer;
    display: flex; align-items: center; gap: 7px;
    transition: all 0.22s cubic-bezier(0.34,1.56,0.64,1);
    background: transparent; color: var(--text-sec);
  }
  .tab-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; transition: transform 0.2s; }
  .tab:hover .tab-dot { transform: scale(1.5); }
  .tab.music .tab-dot { background: var(--music); box-shadow: 0 0 6px rgba(56,189,248,0.5); }
  .tab.movie .tab-dot { background: var(--orange); box-shadow: 0 0 6px var(--orange-glow); }
  .tab.active.music { background: rgba(56,189,248,0.12); color: var(--music); box-shadow: var(--glass-hi); }
  .tab.active.movie { background: rgba(255,117,40,0.14); color: var(--orange-lt); box-shadow: var(--glass-hi); }
  .tab:hover:not(.active) { background: var(--surface2); color: var(--text); }

  /* ── SEARCH ROW ── */
  .search-row { display: flex; gap: 10px; }
  .search-input {
    flex: 1; height: 52px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: var(--radius-md);
    padding: 0 20px;
    font-family: 'Inter', sans-serif;
    font-size: 0.92rem; font-weight: 400;
    color: var(--text);
    outline: none;
    transition: border-color 0.22s, box-shadow 0.22s, background 0.22s;
    box-shadow: var(--glass-hi), inset 0 1px 3px rgba(0,0,0,0.2);
    backdrop-filter: blur(10px);
  }
  .search-input::placeholder { color: var(--text-dim); }
  .search-input:focus {
    border-color: rgba(255,117,40,0.5);
    background: rgba(255,255,255,0.055);
    box-shadow: 0 0 0 3px var(--orange-dim), var(--glass-hi), inset 0 1px 3px rgba(0,0,0,0.2);
  }
  .btn {
    height: 52px;
    border: none; border-radius: var(--radius-md);
    cursor: pointer;
    font-family: 'Sora', sans-serif;
    font-size: 0.72rem; font-weight: 800;
    letter-spacing: 0.08em; text-transform: uppercase;
    transition: all 0.22s cubic-bezier(0.34,1.56,0.64,1);
    white-space: nowrap; position: relative; overflow: hidden;
  }
  .btn-search {
    padding: 0 28px;
    background: linear-gradient(135deg, var(--orange) 0%, var(--orange-dk) 100%);
    color: #fff;
    box-shadow: 0 2px 16px var(--orange-glow), var(--glass-hi);
  }
  .btn-search::after {
    content: '';
    position: absolute; top: 0; left: -100%;
    width: 60%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
    transition: left 0.55s ease;
  }
  .btn-search:hover:not(:disabled)::after { left: 160%; }
  .btn-search:hover:not(:disabled) {
    background: linear-gradient(135deg, var(--orange-lt) 0%, var(--orange) 100%);
    box-shadow: 0 6px 28px var(--orange-glow), var(--glass-hi);
    transform: translateY(-2px);
  }
  .btn-search:active:not(:disabled) { transform: translateY(0); }
  .btn-search:disabled { opacity: 0.35; cursor: not-allowed; }
  .btn-mic {
    width: 52px; padding: 0;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    color: var(--text-sec);
    font-size: 1.1rem;
    backdrop-filter: blur(10px);
    box-shadow: var(--glass-hi);
  }
  .btn-mic:hover:not(.on) {
    border-color: rgba(255,117,40,0.4);
    color: var(--orange-lt);
    background: var(--orange-ultra-dim);
    transform: translateY(-1px);
  }
  .btn-mic.on {
    background: rgba(255,60,60,0.10);
    border-color: rgba(255,68,68,0.5);
    color: #ff5555;
    animation: pulseMic 1.1s ease-in-out infinite;
  }
  @keyframes pulseMic {
    0%,100% { box-shadow: 0 0 0 0 rgba(255,68,68,0.4), var(--glass-hi); }
    50%      { box-shadow: 0 0 0 10px rgba(255,68,68,0), var(--glass-hi); }
  }
  .voice-hint { font-size: 0.62rem; font-weight: 600; color: var(--text-dim); margin-top: 10px; letter-spacing: 0.04em; }
  .voice-hint span { color: #ff5555; }

  /* ── STATUS BARS ── */
  .agent-bar {
    display: flex; align-items: center; gap: 10px;
    font-family: 'Sora', sans-serif;
    font-size: 0.65rem; font-weight: 700;
    letter-spacing: 0.10em; text-transform: uppercase;
    color: var(--orange-lt);
    padding: 10px 16px;
    background: rgba(255,117,40,0.07);
    border-radius: var(--radius-sm);
    margin-bottom: 1.2rem;
    border: 1px solid rgba(255,117,40,0.18);
    border-left: 3px solid var(--orange);
    box-shadow: 0 0 20px rgba(255,117,40,0.06);
  }
  .agent-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--orange-lt);
    box-shadow: 0 0 6px var(--orange-glow);
    animation: pulseMic 1.2s infinite;
    flex-shrink: 0;
  }
  .error-bar {
    font-size: 0.68rem; color: #ff7b7b;
    padding: 10px 16px;
    background: rgba(255,100,100,0.07);
    border-radius: var(--radius-sm);
    border: 1px solid rgba(255,100,100,0.2);
    border-left: 3px solid #ff5555;
    margin-bottom: 1.2rem;
  }

  /* ── SECTION LABEL ── */
  .section-label {
    font-family: 'Sora', sans-serif;
    font-size: 0.62rem; font-weight: 700;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--text-dim);
    margin-bottom: 1.2rem; margin-top: 2rem;
    display: flex; align-items: center; gap: 14px;
  }
  .section-label::after {
    content: ''; flex: 1; height: 1px;
    background: linear-gradient(90deg, var(--border) 0%, transparent 100%);
  }

  /* ── RESULTS GRID ── */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(165px, 1fr));
    gap: 10px;
  }

  /* ── CARD — Premium Glass ── */
  .card {
    position: relative;
    border-radius: var(--radius-md);
    overflow: hidden;
    cursor: pointer;
    background: linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%);
    border: 1px solid rgba(255,255,255,0.09);
    box-shadow: var(--shadow-card), var(--glass-hi);
    transition: transform 0.30s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.30s ease, border-color 0.30s ease, z-index 0s 0.30s;
    backdrop-filter: blur(8px);
  }
  .card:hover {
    transform: translateY(-6px) scale(1.03);
    box-shadow: var(--shadow-hover);
    border-color: rgba(255,117,40,0.28);
    z-index: 10;
    transition: transform 0.30s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.30s ease, border-color 0.22s ease;
  }
  .card-art {
    aspect-ratio: 2/3;
    display: flex; align-items: center; justify-content: center;
    font-size: 3.2rem;
    position: relative; overflow: hidden;
  }
  .card.music .card-art {
    aspect-ratio: 1/1;
    background: linear-gradient(145deg, #03101E 0%, #071E36 45%, #041628 100%);
  }
  .card.movie .card-art {
    background: linear-gradient(145deg, #140800 0%, #241205 45%, #1A0A03 100%);
  }
  .card-art::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 50%;
    background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 100%);
    z-index: 1; pointer-events: none;
  }
  .card-art::after {
    content: '';
    position: absolute; bottom: 0; left: 0; right: 0; height: 60%;
    background: linear-gradient(0deg, rgba(7,11,16,0.98) 0%, transparent 100%);
    z-index: 1; pointer-events: none;
  }
  .card-art > span {
    position: relative; z-index: 2;
    filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5));
    transition: transform 0.3s ease;
  }
  .card:hover .card-art > span { transform: scale(1.1); }
  .cover-img {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    z-index: 0;
    transition: transform 0.3s ease;
  }
  .card:hover .cover-img { transform: scale(1.08); }
  .card-overlay {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; justify-content: flex-start;
    padding: 12px;
    opacity: 0;
    transition: opacity 0.25s ease;
    z-index: 4;
  }
  .card:hover .card-overlay { opacity: 1; }
  .card-play {
    width: 34px; height: 34px;
    background: linear-gradient(135deg, var(--orange) 0%, var(--orange-dk) 100%);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.75rem;
    box-shadow: 0 0 20px var(--orange-glow), 0 2px 8px rgba(0,0,0,0.4);
    transform: scale(0.7) translateY(-4px);
    transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1);
    flex-shrink: 0;
  }
  .card:hover .card-play { transform: scale(1) translateY(0); }
  .card-body {
    position: absolute; bottom: 0; left: 0; right: 0;
    padding: 10px 12px 12px;
    background: linear-gradient(0deg, rgba(7,11,16,1) 0%, rgba(7,11,16,0.85) 70%, transparent 100%);
    z-index: 3;
    transition: padding 0.25s ease;
  }
  .card:hover .card-body { padding: 12px 12px 14px; }
  .card-title {
    font-family: 'Sora', sans-serif;
    font-size: 0.76rem; font-weight: 700;
    line-height: 1.3; margin-bottom: 3px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .card-meta { font-size: 0.60rem; color: var(--text-sec); }
  .card-genre {
    font-size: 0.55rem; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase; margin-top: 4px;
  }
  .card-genre.music { color: var(--music); }
  .card-genre.movie { color: var(--orange-lt); }
  .card-desc {
    font-size: 0.63rem; color: rgba(125,133,144,0.9);
    line-height: 1.55; margin-top: 6px;
    display: none;
    -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  .card:hover .card-desc { display: -webkit-box; }

  /* ── LOADING ── */
  .loading { padding: 5rem 0; text-align: center; }
  .netflix-loader { display: inline-flex; gap: 5px; align-items: center; }
  .nl-bar {
    width: 3px; height: 28px; border-radius: 99px;
    background: linear-gradient(180deg, var(--orange-lt) 0%, var(--orange-dk) 100%);
    animation: nlBounce 1s ease-in-out infinite;
    box-shadow: 0 0 8px var(--orange-glow);
  }
  .nl-bar:nth-child(2) { animation-delay: 0.1s; height: 18px; opacity: 0.7; }
  .nl-bar:nth-child(3) { animation-delay: 0.2s; }
  .nl-bar:nth-child(4) { animation-delay: 0.3s; height: 18px; opacity: 0.7; }
  .nl-bar:nth-child(5) { animation-delay: 0.4s; }
  @keyframes nlBounce {
    0%,100% { transform: scaleY(0.35); opacity: 0.35; }
    50%      { transform: scaleY(1);    opacity: 1; }
  }
  .loading-text {
    font-family: 'Sora', sans-serif;
    font-size: 0.62rem; font-weight: 700;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--text-dim); margin-top: 1.2rem;
  }

  /* ── EMPTY STATE ── */
  .empty {
    padding: 6rem 2rem; text-align: center;
    border: 1px dashed rgba(255,255,255,0.06);
    border-radius: var(--radius-lg); margin-top: 1rem;
  }
  .empty-icon { font-size: 3rem; opacity: 0.15; margin-bottom: 1.2rem; }
  .empty-title {
    font-family: 'Sora', sans-serif;
    font-size: 1rem; font-weight: 700;
    color: var(--text-sec); margin-bottom: 8px; letter-spacing: -0.01em;
  }
  .empty-sub { font-size: 0.75rem; color: var(--text-dim); line-height: 1.6; }

  /* ── RIGHT PANEL — Glass Sidebar ── */
  .right-panel {
    background: rgba(10,14,20,0.65);
    border-left: 1px solid rgba(255,255,255,0.06);
    backdrop-filter: blur(24px) saturate(160%);
    -webkit-backdrop-filter: blur(24px) saturate(160%);
    padding: 2rem 1.4rem;
    overflow-y: auto;
    max-height: calc(100vh - 72px);
    position: sticky; top: 72px;
  }

  /* For You header */
  .panel-header { margin-bottom: 1.6rem; }
  .panel-title {
    font-family: 'Sora', sans-serif;
    font-size: 1.05rem; font-weight: 800;
    letter-spacing: -0.02em; margin-bottom: 4px;
    background: linear-gradient(120deg, var(--text) 0%, rgba(239,241,245,0.6) 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .panel-sub { font-size: 0.65rem; color: var(--text-dim); font-weight: 500; letter-spacing: 0.04em; }

  /* ── REC ROWS ── */
  .rec {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 10px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.18s, transform 0.18s cubic-bezier(0.34,1.3,0.64,1);
    margin-bottom: 2px; position: relative;
    border: 1px solid transparent;
  }
  .rec:hover {
    background: rgba(255,255,255,0.05);
    border-color: rgba(255,255,255,0.07);
    transform: translateX(3px);
    box-shadow: var(--glass-hi);
  }
  .rec:hover .rec-play { opacity: 1; }
  .rec-rank {
    font-family: 'Sora', sans-serif;
    font-size: 1.3rem; font-weight: 900;
    color: rgba(255,255,255,0.08);
    min-width: 26px; text-align: center;
    line-height: 1; font-style: italic;
  }
  .rec-art {
    width: 46px; height: 46px; border-radius: var(--radius-sm);
    display: flex; align-items: center; justify-content: center;
    font-size: 1.35rem; flex-shrink: 0;
    position: relative; overflow: hidden;
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: var(--glass-hi);
  }
  .rec-art.music { background: linear-gradient(135deg, #03101E, #071E36); }
  .rec-art.movie { background: linear-gradient(135deg, #140800, #241205); }
  .rec-cover-img {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    z-index: 0;
  }
  .rec-play {
    position: absolute; inset: 0;
    background: rgba(255,117,40,0.88);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.9rem; opacity: 0; transition: opacity 0.18s;
  }
  .rec-info { flex: 1; min-width: 0; }
  .rec-title {
    font-family: 'Sora', sans-serif;
    font-size: 0.78rem; font-weight: 700;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    margin-bottom: 2px; letter-spacing: -0.01em;
  }
  .rec-meta { font-size: 0.62rem; color: var(--text-sec); }
  .rec-type {
    font-size: 0.54rem; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase; margin-top: 3px;
  }
  .rec-type.music { color: var(--music); }
  .rec-type.movie { color: var(--orange-lt); }
  .rec-why {
    font-size: 0.58rem; color: var(--text-dim);
    font-style: italic; margin-top: 2px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  /* ── HISTORY ── */
  .history { margin-top: 2rem; padding-top: 1.8rem; border-top: 1px solid rgba(255,255,255,0.06); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 0.9rem; }
  .chip {
    font-size: 0.6rem; font-weight: 600;
    padding: 5px 11px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 99px;
    color: var(--text-sec);
    cursor: pointer;
    transition: all 0.18s cubic-bezier(0.34,1.3,0.64,1);
    letter-spacing: 0.04em;
    box-shadow: var(--glass-hi);
  }
  .chip:hover { background: rgba(255,255,255,0.07); color: var(--text); border-color: rgba(255,117,40,0.35); transform: translateY(-1px); }
  .chip.music:hover { color: var(--music); border-color: rgba(56,189,248,0.35); }
  .chip.movie:hover { color: var(--orange-lt); border-color: rgba(255,117,40,0.35); }

  .clear-btn {
    background: none; border: none;
    color: var(--text-dim);
    font-family: 'Sora', sans-serif;
    font-size: 0.58rem; font-weight: 700;
    letter-spacing: 0.10em; text-transform: uppercase;
    cursor: pointer; display: block;
    margin-top: 1.2rem; padding: 4px 0;
    transition: color 0.15s;
  }
  .clear-btn:hover { color: #ff5555; }

  /* ── SCROLLBAR ── */
  .right-panel::-webkit-scrollbar { width: 3px; }
  .right-panel::-webkit-scrollbar-track { background: transparent; }
  .right-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 99px; }
  .right-panel::-webkit-scrollbar-thumb:hover { background: rgba(255,117,40,0.3); }

  /* ── FADE ANIMATION ── */
  @keyframes fadeSlide {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fade { animation: fadeSlide 0.35s cubic-bezier(0.22,1,0.36,1) forwards; }

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
      const enrichedRecs = await enrichAll(data);
      setRecs(enrichedRecs);
      store.set(RECS_KEY, enrichedRecs);
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
      const items = JSON.parse(resultsRaw).map((i) => ({ ...i, type: tab }));
      setAgentStatus("Fetching cover art…");
      const enriched = await enrichAll(items);
      setResults(enriched.map((i) => ({ ...i, mediaType: tab })));
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
                <button key={t} className={`tab ${t} ${tab===t?"active":""}`} onClick={() => { setTab(t); setResults([]); setErrorMsg(""); }}>
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
                  <div
                    key={item.id || i}
                    className={`card ${tab} fade`}
                    style={{ animationDelay: `${i * 0.05}s` }}
                    onClick={() => item.playUrl && window.open(item.playUrl, "_blank", "noopener,noreferrer")}
                    title={item.playUrl ? (tab === "music" ? "Open in Apple Music" : "Watch on TMDB") : "No external link found for this title"}
                  >
                    <div className={`card-art ${tab==="movie"?"movie":""}`}>
                      {item.artwork && (
                        <img
                          src={item.artwork}
                          alt={item.title}
                          className="cover-img"
                          loading="lazy"
                          onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "inline"; }}
                        />
                      )}
                      <span style={{ position:"relative", zIndex:2, display: item.artwork ? "none" : "inline" }}>{item.emoji || (tab==="music"?"🎵":"🎬")}</span>
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
                title={rec.playUrl ? (rec.type === "music" ? "Open in Apple Music" : "Watch on TMDB") : undefined}
                onClick={() => {
                  if (rec.playUrl) {
                    window.open(rec.playUrl, "_blank", "noopener,noreferrer");
                    return;
                  }
                  setTab(rec.type);
                  setQuery(rec.title);
                  setErrorMsg("");
                  setResults([{
                    id: i, title: rec.title,
                    artist: rec.creator, director: rec.creator,
                    year: rec.year, genre: rec.genre,
                    emoji: rec.emoji, description: rec.why,
                    mediaType: rec.type, type: rec.type,
                  }]);
                }}>
                <div className="rec-rank">{i + 1}</div>
                <div className={`rec-art ${rec.type}`}>
                  {rec.artwork && (
                    <img
                      src={rec.artwork}
                      alt={rec.title}
                      className="rec-cover-img"
                      loading="lazy"
                      onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "inline"; }}
                    />
                  )}
                  <span style={{ display: rec.artwork ? "none" : "inline" }}>{rec.emoji || (rec.type==="music"?"🎵":"🎬")}</span>
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
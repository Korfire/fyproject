# 🎬🎵 Context-Aware Music & Movie Discovery

> AI-powered search and recommendation engine using **RAG** and **Agentic AI**  
> Built with React · Vite · Express · Anthropic Claude API

---

## ✨ Features

- **Text & Voice Search** — search naturally or speak your query (Chrome/Edge)
- **Agentic AI Pipeline** — Intent Agent + Results Agent process every query
- **RAG Recommendations** — personalised picks built from your search history
- **Persistent Taste Profile** — history saved in localStorage across sessions
- **Explainable Suggestions** — every recommendation shows *why* it was picked
- **Secure API Proxy** — your Anthropic API key never leaves the server

---

## 🗂️ Project Structure

```
your-project/
├── backend/               ← Express API proxy (deployed to Render)
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── frontend/              ← React + Vite app (deployed to Vercel)
│   ├── src/
│   │   ├── main.jsx
│   │   └── App.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── vercel.json
│   └── .env.example
├── render.yaml            ← Render deployment config
└── .gitignore
```

---

## 🚀 Deployment Guide (Step-by-Step)

### Prerequisites
- A **GitHub** account — https://github.com
- An **Anthropic API key** — https://console.anthropic.com
- A **Render** account (free) — https://render.com
- A **Vercel** account (free) — https://vercel.com

---

### Step 1 — Push to GitHub

```bash
# From the your-project/ folder
git init
git add .
git commit -m "Initial commit: Context-Aware AI Discovery App"

# Create a new repo on GitHub (name it: your-project), then:
git remote add origin https://github.com/YOUR_USERNAME/your-project.git
git branch -M main
git push -u origin main
```

---

### Step 2 — Deploy the Backend to Render

1. Go to **https://render.com** → Sign in → **New +** → **Web Service**
2. Connect your GitHub account and select the **your-project** repository
3. Fill in the settings:
   - **Name:** `app-backend`
   - **Root Directory:** `backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
4. Scroll to **Environment Variables** and add:

   | Key | Value |
   |-----|-------|
   | `ANTHROPIC_API_KEY` | `sk-ant-xxxxxxx` (your real key) |
   | `FRONTEND_URL` | *(leave blank for now — fill in after Step 3)* |
   | `NODE_ENV` | `production` |

5. Click **Create Web Service**
6. Wait ~2 minutes for the build. Copy your backend URL:  
   👉 `https://app-backend.onrender.com`

> ⚠️ **Free Render services sleep after 15 minutes of inactivity.**  
> The first request after sleep takes ~30 seconds to wake up. This is normal on the free tier.

---

### Step 3 — Deploy the Frontend to Vercel

1. Go to **https://vercel.com** → Sign in → **Add New Project**
2. Import your **your-project** GitHub repository
3. Configure the project:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Under **Environment Variables**, add:

   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://app-backend.onrender.com` |

5. Click **Deploy**
6. Wait ~1 minute. Copy your frontend URL:  
   👉 `https://your-app.vercel.app`

---

### Step 4 — Update CORS on the Backend

1. Go back to your **Render** dashboard → app-backend → **Environment**
2. Set `FRONTEND_URL` to your Vercel URL:  
   `https://your-app.vercel.app`
3. Click **Save Changes** — Render will redeploy automatically

---

### ✅ You're Live!

Open your Vercel URL in **Google Chrome** and try:
- Typing a search query and pressing Enter
- Clicking the 🎙 mic button and speaking
- Switching between Music and Movies tabs
- Watching recommendations appear after a few searches

---

## 💻 Local Development

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/your-project.git
cd your-project
```

### 2. Set up the backend
```bash
cd backend
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
npm install
npm run dev     # Runs on http://localhost:4000
```

### 3. Set up the frontend (new terminal)
```bash
cd frontend
cp .env.example .env
# VITE_API_URL can stay empty for local dev — Vite proxy handles it
npm install
npm run dev     # Runs on http://localhost:5173
```

Open **http://localhost:5173** in Chrome.

---

## 🔒 Security Notes

- Your `ANTHROPIC_API_KEY` is stored **only on the Render server** as an environment variable
- It is **never sent to the browser** — the frontend only calls `/api/messages` on your own backend
- CORS is configured to only allow requests from your Vercel frontend URL
- Never commit `.env` files to GitHub (`.gitignore` already excludes them)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5 |
| Backend | Node.js, Express 4 |
| AI Model | Anthropic Claude claude-sonnet-4-20250514 |
| Voice Input | Web Speech API |
| Storage | localStorage (browser) |
| Frontend Hosting | Vercel (free) |
| Backend Hosting | Render (free) |

---

## 📄 License

MIT — free to use, modify, and deploy.

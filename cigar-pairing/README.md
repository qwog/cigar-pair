# The Pairing Room — Cigar & Spirits Guide

A premium AI-powered cigar and spirits pairing web app.

---

## Quick Start (Local)

```bash
npm install
cp .env.example .env
# Edit .env and add your Anthropic API key
npm start
# Open http://localhost:3000
```

---

## Deploy to Vercel (Recommended — Free)

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Add environment variable: `ANTHROPIC_API_KEY = your_key_here`
4. Deploy — Vercel auto-detects Node.js

That's it. You'll get a live URL like `https://your-app.vercel.app`

---

## Deploy to Railway (Alternative)

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Add env var: `ANTHROPIC_API_KEY`
3. Railway auto-detects the start script and deploys

---

## Deploy to Render (Alternative)

1. Go to [render.com](https://render.com) → New Web Service
2. Connect your GitHub repo
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add env var: `ANTHROPIC_API_KEY`

---

## Get an Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up / log in
3. API Keys → Create Key
4. Copy it into your `.env` file or deployment environment variables

---

## File Structure

```
cigar-pairing/
├── server.js          # Express server + API proxy
├── package.json
├── .env.example       # Copy to .env and add your key
├── .gitignore         # Keeps .env out of git
└── public/
    └── index.html     # The full website
```

---

## Customization

- **Add cigars/spirits**: Edit the `CIGARS` and `SPIRITS` arrays in `public/index.html`
- **Change branding**: Update the site name in `<title>` and the `.hero-title` in the HTML
- **Colors**: Edit the CSS variables in `:root` at the top of the `<style>` block

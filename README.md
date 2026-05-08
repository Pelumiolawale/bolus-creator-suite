# Bolus Creator Suite

A private creator business dashboard with live Instagram data.

> **⚠ Security note**
>
> An earlier version of this README contained a hardcoded Instagram access token. **If you forked or cloned that earlier version, rotate that token immediately** in the Meta Developer Portal (API Setup → Generate Access Tokens), then update the `INSTAGRAM_TOKEN` env var in Vercel and redeploy. Tokens must never live in source control — only in Vercel's environment variable store.

## Deploy to Vercel (5 steps)

### 1. Push to GitHub

Create a new private repo on GitHub called `bolus-creator-suite`. Then run:

```bash
cd bolus-creator-suite
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/bolus-creator-suite.git
git push -u origin main
```

### 2. Import to Vercel

- Go to vercel.com → New Project
- Import your `bolus-creator-suite` GitHub repo
- Framework preset: **Vite**
- Click Deploy (it will fail first time — that's fine, next step fixes it)

### 3. Add the Instagram token as an environment variable

- In Vercel dashboard → your project → Settings → Environment Variables
- Add:
  - **Name:** `INSTAGRAM_TOKEN`
  - **Value:** *(your long-lived Instagram Graph API token — generate from Meta Developer Portal)*
  - Environments: Production, Preview, Development (✓ all three)

### 4. Redeploy

- Vercel → Deployments → click the three dots on the latest → Redeploy

### 5. Done

Your dashboard will be live at `https://bolus-creator-suite.vercel.app`. The Audience section will show your real follower count, post count, and calculated engagement rate live from Instagram.

## Token refresh (every 60 days)

Instagram tokens expire after 60 days. When you see the ⚠ warning in the dashboard:

1. Go to Meta Developer Portal
2. Regenerate the token under API Setup → Generate Access Tokens
3. Update the `INSTAGRAM_TOKEN` environment variable in Vercel
4. Redeploy

## Local data

Brand deals and content calendar entries are stored in your browser's localStorage, scoped to the device. They persist across sessions but don't sync between devices yet.

## Project structure

```
bolus-creator-suite/
├── api/
│   └── instagram.js     ← Vercel serverless function (Instagram proxy)
├── src/
│   ├── main.jsx         ← React entry point
│   ├── App.jsx          ← Full dashboard
│   └── pages/           ← Terms & Privacy pages
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```

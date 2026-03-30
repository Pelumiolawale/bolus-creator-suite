# Bolus Creator Suite

A private creator business dashboard with live Instagram data.

## Deploy to Vercel (5 steps)

### 1. Push to GitHub
Create a new **private** repo on GitHub called `bolus-creator-suite`.
Then run:
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

### 3. Add the Instagram Token as an Environment Variable
- In Vercel dashboard → your project → Settings → Environment Variables
- Add:
  - **Name:** `INSTAGRAM_TOKEN`
  - **Value:** `IGAAooIV5GBtRBZAGF4ZAlFUMGt6dV9wVjk5UVg4T3FlN0hZANU90UENlUDBQM0pIVlZAqTV9DcS1vZAWtadXdrU0NBWHhmU2lIUzU5eUVaaXBKR2ZApdzUtUVhnVUdKNENTWjFmMGg3RGZAHOVZABaDBvZAjRGMnYxeVdEN2JweTloamUtdwZDZD`
  - Environments: Production, Preview, Development ✓ all three

### 4. Redeploy
- Vercel → Deployments → click the three dots on the latest → Redeploy

### 5. Done
Your dashboard will be live at `https://bolus-creator-suite.vercel.app`
The Audience section will now show her real follower count, post count,
and calculated engagement rate live from Instagram.

## Token Refresh (every 60 days)
Instagram tokens expire after 60 days. When you see the ⚠ warning in the dashboard:
1. Go back to Meta Developer portal
2. Regenerate the token under API Setup → Generate Access Tokens
3. Update the `INSTAGRAM_TOKEN` environment variable in Vercel
4. Redeploy

## Project Structure
```
bolus-creator-suite/
├── api/
│   └── instagram.js     ← Vercel serverless function (Instagram proxy)
├── src/
│   ├── main.jsx         ← React entry point
│   └── App.jsx          ← Full dashboard
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```

# GENIE — public web app build

Goal: turn the Claude-built GENIE artifact (AI voice-assistant demo, 7 sections:
TALK / KITCHEN / APPS / VAULTS / DAY / TEST / SYSTEM) into a real, live, public
web app on a real domain.

## What the artifact fakes today (must become real)

| Panel | Fake today | Real plan |
|---|---|---|
| Talk → Ask Claude / answer engine | simulated | Backend `POST /api/ask` → Anthropic Messages API, vault notebooks injected as context |
| Talk → voice in (mic) | simulated | Web Speech API `SpeechRecognition` (free, desktop Chrome/Edge; mobile Safari partial) |
| Talk → "Hey GENIE" wake word | simulated | Picovoice Porcupine WASM (free tier), real always-listening |
| Talk → voice out (TTS) | simulated | `speechSynthesis` free tier; optional ElevenLabs voice for "GENIE native voice" |
| Talk → live camera / sous-chef | simulated | `getUserMedia` (needs HTTPS); "identify what's cooking" → frame → Claude vision via `/api/ask` |
| Timers | already works | keep client-side; persist active timers in localStorage |
| Vaults (notebooks) | works, local only | backend SQLite store + sync; answers cite the notebook by name |
| Lists / Day planner | works, local only | same SQLite store; export (.ics/.txt) already works |
| Connected apps (Notion/Canva/Higgsfield/Calendar) | links only | Phase 2 — real OAuth per app, only if Kendall wants them |

## Architecture

```
[ Static frontend ]  →  [ Node backend (one small server) ]
  his artifact UI,          /api/ask        → Anthropic (key in server env, never in page)
  de-faked, same look       /api/vaults     → JSON file persistence (SQLite later)
                            /api/vision     → frame → Claude vision
```

- Frontend: static site (Cloudflare Pages or Vercel, free tier).
- Backend: single small Node server (Render/Fly/VPS) or serverless functions.
- Domain: Kendall picks/buys one (~$10–15/yr); DNS points at the deploy. Ship first
  on the provider's public URL, cut over to the real domain when ready.

## Costs (honest)

- Anthropic API: pay per call. Haiku-class for chat = fractions of a cent per
  question; Sonnet-class for quality answers ≈ a few cents. No cost when idle.
- Porcupine wake word: free tier covers this.
- Hosting: static free tier; backend smallest tier ≈ $5–7/mo (or free-tier serverless).
- Domain: ~$10–15/yr.

## Build order

1. Kendall sends the artifact source (code view from his Claude account) → drop into `web/`.
2. De-fake TALK: wire `/api/ask`, mic, TTS. This is the "it's alive" milestone.
3. Wake word + camera/vision.
4. Vault/day/list persistence on the backend.
5. Deploy to public URL → point real domain → verify on his phone.

## Status

- 2026-10-03: lane picked (public web app, real domain). Scaffolded. BLOCKED on
  artifact source from Kendall's Claude account.

## Deploy runbook — askgenie.app (2026-10-03)

1. Kendall buys askgenie.app (Cloudflare Registrar or Porkbun, ~$15/yr).
2. Push this dir to GitHub (repo `askgenie-app`, public — no secrets in code).
3. Render: New Web Service from the repo (or Blueprint via render.yaml). Plan: free.
   - Build: `npm install --prefix server && npm install --prefix web && npm run build --prefix web`
   - Start: `node server/index.js`
   - Health check: `/api/vaults`
4. Render dashboard → Environment → Kendall pastes `ANTHROPIC_API_KEY` himself.
   Never in code, never in chat.
5. Render dashboard → Settings → Custom Domains → add `askgenie.app` (+ `www`).
   DNS at registrar: apex ALIAS/ANAME → Render URL; `www` CNAME → `<service>.onrender.com`.
6. Verify: `https://askgenie.app` loads, TALK answers a real question, TEST page all green.

Note: Render free tier sleeps after inactivity (cold start ~30s). Starter ($7/mo)
when traffic justifies it. Free tier is fine for launch.

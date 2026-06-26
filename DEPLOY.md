# Deployment

The app is a single Node service (`server.ts`) that serves **both** the React
SPA and the `/api` routes. It uses **Puppeteer (headless Chromium)** to render
report PDFs, so it must run as a **long-lived container** — not a serverless
platform. The included `Dockerfile` bundles Chromium + Arabic fonts.

Recommended hosts: **Render** or **Railway** to start; **Google Cloud Run** or
**AWS ECS/Fargate** for larger scale. The Docker image runs on all of them.

## Environment variables

Set these on the host (Production, and Preview if used):

**Server**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`  (secret — server only)
- `APP_URL` (e.g. `https://app.beitindex.com`)
- `ALLOWED_ORIGINS` (comma-separated, for CORS in production)
- `PAYMOB_API_KEY`, `PAYMOB_HMAC_SECRET`, `PAYMOB_IFRAME_ID`, `PAYMOB_INTEGRATION_ID`
- `GEMINI_API_KEY` (image classification on import)
- `SENTRY_DSN` (optional, error tracking)
- `INNGEST_DEV=0` and Inngest production keys (`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`) — see Inngest below
- `NODE_ENV=production`
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` (already set in the Dockerfile)

**Frontend (build-time, baked into the SPA by Vite)**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

> Never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend — it's server-only.

## Build & run locally (Docker)

```bash
docker build -t beit-index .
docker run -p 3000:3000 --env-file .env.local beit-index
# open http://localhost:3000
```

## Deploy to Render

1. New → **Web Service** → connect the repo.
2. Environment: **Docker** (it auto-detects the `Dockerfile`).
3. Instance type: **≥ 1 GB RAM** (Chromium needs headroom; 2 GB is safer).
4. Add all env vars above.
5. Health check path: `/api/health`.
6. Deploy. Render builds the image and runs `node dist/server.cjs`.

## Deploy to Railway

1. New Project → Deploy from repo → Railway detects the `Dockerfile`.
2. Add env vars.
3. Set the health check to `/api/health`; expose the web port.
4. Pick an instance with ≥ 1 GB RAM.

## Cloud Run (for scale)

```bash
gcloud run deploy beit-index \
  --source . \
  --memory 2Gi --cpu 2 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# (set the remaining secrets via --set-secrets / Secret Manager)
```

## Inngest (background jobs: imports, etc.)

- Locally, `npm run dev` runs the Inngest dev CLI.
- In production, create an Inngest Cloud app and point it at
  `https://<your-host>/api/inngest`. Set `INNGEST_EVENT_KEY` and
  `INNGEST_SIGNING_KEY`, and `INNGEST_DEV=0`.

## Notes for scale / reliability

- **PDF caching:** rendered report PDFs are cached in the `job-deliverables`
  bucket (`reports/{id}.pdf`). Finalized reports are immutable, so they render
  once and every later download is instant. Use `?refresh=1` on
  `/api/reports/:id/pdf` to force a re-render.
- **Rate limiting** is currently in-memory. When running more than one instance,
  move it to a shared store (e.g. Upstash Redis) so limits are enforced globally.
- **Static/CDN (optional):** you can serve the SPA from a CDN and point `/api`
  at this service; simplest is to let this service serve both (default).

## Vercel

`vercel.json` + `api/[...path].ts` exist for a quick Vercel preview, but Puppeteer
PDF generation does not work under Vercel's serverless runtime. For production,
use a container host as above.

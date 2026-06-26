// Vercel serverless entrypoint.
//
// Runs the existing Express API (src/server/api.ts) as a single catch-all
// function, so every /api/* request is handled by the same router used locally
// — no separate Node host required. Vercel auto-detects files in /api as
// serverless functions; this catch-all ([...path]) receives the full URL
// (e.g. /api/onboarding/status), which the router (mounted at /api) matches.
import express from 'express';
import apiRouter from '../src/server/api';

// Allow up to 60s so the one-time PDF render (serverless Chromium cold start +
// rendering) can finish. After the first render the PDF is cached in storage,
// so subsequent downloads are instant and don't hit this path.
export const config = {
  maxDuration: 60,
};

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiRouter);

export default app;

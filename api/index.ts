// Vercel serverless entrypoint.
//
// Runs the existing Express API (src/server/api.ts) as a single function.
// vercel.json rewrites every /api/* request here, and the function receives the
// original URL (e.g. /api/onboarding/status), which the router (mounted at /api)
// matches at any depth. Using an explicit rewrite + index function is more
// reliable than a [...path] catch-all, which only matched single-segment paths.
import express from 'express';
import apiRouter from '../src/server/api';

// Allow up to 60s for the one-time PDF render (serverless Chromium cold start +
// rendering). After the first render the PDF is cached, so later downloads are
// instant and don't hit this path.
export const config = {
  maxDuration: 60,
};

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiRouter);

export default app;

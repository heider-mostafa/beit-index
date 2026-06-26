// Vercel serverless entrypoint.
//
// The API router is imported lazily inside the handler and wrapped in try/catch
// so that if loading src/server/api (and its heavy dependency graph) fails on
// Vercel, we return the real error instead of an opaque FUNCTION_INVOCATION_FAILED.
import express, { type Router } from 'express';

export const config = {
  maxDuration: 60,
};

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

let router: Router | null = null;
let loadError: Error | null = null;

app.use('/api', async (req, res, next) => {
  if (!router && !loadError) {
    try {
      const mod = await import('../src/server/api');
      router = mod.default;
    } catch (err) {
      loadError = err as Error;
      console.error('Failed to load API router:', loadError);
    }
  }

  if (loadError) {
    return res.status(500).json({
      error: 'API module failed to load',
      message: loadError.message,
      stack: loadError.stack?.split('\n').slice(0, 8),
    });
  }

  return router!(req, res, next);
});

export default app;

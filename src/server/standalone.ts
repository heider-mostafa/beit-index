import express from "express";
import cors from "cors";
import * as Sentry from "@sentry/node";
import apiRouter from "./api";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Sentry for error monitoring (only if DSN is configured)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Filter out common non-errors
    beforeSend(event) {
      // Don't send 4xx errors to Sentry (those are expected)
      if (event.extra?.statusCode && (event.extra.statusCode as number) < 500) {
        return null;
      }
      return event;
    },
  });
  console.log('✓ Sentry error monitoring initialized');
}

const app = express();
const PORT = parseInt(process.env.API_PORT || "3001");

// Configure CORS
// In production, ALLOWED_ORIGINS should be set to your domain(s)
// Example: ALLOWED_ORIGINS=https://beit-index.com,https://app.beit-index.com
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : null; // null means allow all (for development)

const corsOptions: cors.CorsOptions = {
  origin: allowedOrigins
    ? (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: Origin ${origin} not allowed`));
        }
      }
    : true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Trust proxy for correct IP logging
app.set("trust proxy", true);

// API routes
app.use("/api", apiRouter);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Global error handler - catches unhandled errors
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Log to Sentry
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err, {
      extra: {
        url: req.url,
        method: req.method,
        body: req.body,
        statusCode: 500,
      },
    });
  }

  // Log to console
  console.error('Unhandled error:', err);

  // Send error response
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});

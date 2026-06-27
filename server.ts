import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import apiRouter from "./src/server/api";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: '.env.local' });

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000");

  // Trust exactly one proxy hop (Render's load balancer). Using `true` trusts
  // every hop, which express-rate-limit rejects (clients could spoof
  // X-Forwarded-For to bypass IP rate limiting).
  app.set("trust proxy", 1);

  // Security headers with Helmet
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }));

  // Global rate limiting - 100 requests per 15 minutes per IP
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === "/api/health";
    },
  });

  // Stricter rate limiting for auth endpoints - 10 attempts per 15 minutes
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many authentication attempts, please try again later." },
  });

  // Rate limiting for payment endpoints - 20 per hour
  const paymentLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many payment attempts, please try again later." },
  });

  // Apply global rate limiter
  app.use(globalLimiter);

  // Middleware
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // CORS for development
  if (process.env.NODE_ENV !== "production") {
    app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
      if (req.method === "OPTIONS") {
        return res.sendStatus(200);
      }
      next();
    });
  }

  // Apply stricter rate limits to sensitive endpoints
  app.use("/api/auth", authLimiter);
  app.use("/api/payments", paymentLimiter);

  // API routes
  app.use("/api", apiRouter);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

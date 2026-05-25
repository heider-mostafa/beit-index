import express from "express";
import cors from "cors";
import apiRouter from "./api";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = parseInt(process.env.API_PORT || "3001");

// Middleware
app.use(cors());
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

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});

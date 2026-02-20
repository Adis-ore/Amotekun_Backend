require("dotenv").config();
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const path = require("path");

const { initCluster, closeCluster, getActiveJobs } = require("./services/pdfService");

const app = express();

// Trust Render's load-balancer proxy so X-Forwarded-For is read correctly
app.set("trust proxy", 1);

// CORS — accepts any origin in FRONTEND_URL (comma-separated) plus hardcoded fallbacks
const allowedOrigins = [
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",") : []),
  "https://amotekun-frontend.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
]
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);

app.use(compression());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,             // 10 requests per minute per IP
  message: "Too many requests from this IP, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  // Disable X-Forwarded-For validation — trust proxy (above) handles this correctly
  validate: { xForwardedForHeader: false },
});

// Body parser with 10mb limit for base64 photos
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Health check — registered BEFORE rate limiter so it is never rate-limited
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    activeJobs: getActiveJobs(),
    timestamp: new Date().toISOString(),
  });
});

// Apply rate limiting to /api routes (after health endpoints above)
app.use("/api/", apiLimiter);

// Static files for logos
app.use("/logos", express.static(path.join(__dirname, "logos")));

// Routes
const registrationRouter = require("./routes/registration");
app.use("/api/register", registrationRouter);

// Error handler — always re-apply CORS headers so browser can read the error response
app.use((err, req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  console.error(err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Global safety net — never let uncaught errors crash the process
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});

// Graceful shutdown
async function shutdown() {
  console.log("Shutting down gracefully…");
  await closeCluster();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start server only after the browser cluster is ready
const PORT = process.env.PORT || 5000;

initCluster()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start browser cluster:", err);
    process.exit(1);
  });

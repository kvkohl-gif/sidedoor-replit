import express, { type Request, Response, NextFunction } from "express";
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { sessionAuth } from "./middleware/sessionAuth";
import authRouter from "./routes/auth";
import { supabaseAdmin } from "./lib/supabaseClient";

const app = express();

// Security headers — relaxed for SPA serving static assets
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
}));

// CORS — allow same-origin and configured origins
app.use(cors({
  origin: true, // reflect the request origin (same as allowing all, but with credentials)
  credentials: true,
}));

// Rate limiting — auth endpoints get stricter limits
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts, please try again later" },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // 200 requests per 15 min for general API
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.set('trust proxy', 1); // required behind Railway/Replit proxy

// Cookie parser for session_id cookie
app.use(cookieParser());

// Session authentication middleware (attaches req.user via session_id cookie -> Supabase)
app.use(sessionAuth);


app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Health check endpoints (no auth required, used by Railway + uptime monitors)
  const healthHandler = async (_req: Request, res: Response) => {
    try {
      const { data, error } = await supabaseAdmin.from("users").select("id").limit(1);
      if (error) throw error;
      res.json({ status: "ok", env: process.env.APP_ENV || "unknown" });
    } catch (e) {
      // Still return 200 so Railway doesn't roll back — the server IS running
      res.json({ status: "degraded", env: process.env.APP_ENV || "unknown" });
    }
  };
  app.get("/health", healthHandler);
  app.get("/api/health", healthHandler);

  // Apply rate limiters
  app.use("/api/auth", authLimiter, authRouter);
  app.use("/api", apiLimiter);

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error(`[error] ${status}: ${message}`);
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();

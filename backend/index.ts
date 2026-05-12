import express, { type Request, Response, NextFunction } from "express";
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { sessionAuth } from "./middleware/sessionAuth";
import authRouter from "./routes/auth";
import billingRouter, { handleStripeWebhook } from "./routes/billing";
import { handleEmailWebhook } from "./routes/emailTracking";
import cronRouter from "./routes/cron";
import { supabaseAdmin } from "./lib/supabaseClient";
import { assertBillingConfigOnStartup, assertSecurityConfigOnStartup } from "./lib/billingConfig";

// Validate Stripe config at boot — throws in production if anything is missing
// or if a test key (sk_test_) is set in a production environment.
assertBillingConfigOnStartup();
// Validate security-critical env vars (CAPTCHA, email-webhook secret, email
// provider). Throws in production if any are missing.
assertSecurityConfigOnStartup();

const app = express();

// Security headers
// CSP: SPA-friendly defaults. We allow inline styles (Vite + Tailwind extract),
// connect to self + Stripe + Supabase, images from anywhere (recruiter avatars).
// Scripts come from self + Stripe.js + Cloudflare Turnstile (signup CAPTCHA).
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",       // Vite injects inline runtime; Stripe.js bootstraps inline.
        "https://js.stripe.com",
        "https://challenges.cloudflare.com",
      ],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind/Radix runtime styles.
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      fontSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://api.stripe.com",
        "https://*.supabase.co",
        "https://challenges.cloudflare.com",
      ],
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com", "https://challenges.cloudflare.com"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,    // SPA + 3rd-party iframes (Stripe, Turnstile) need COEP off.
  crossOriginResourcePolicy: { policy: "cross-origin" }, // pixel tracker + assets must be reachable from email clients.
}));

// CORS — allow only known origins. We reflect/allowlist via a function so that
// preview environments (Railway PR previews, local dev) keep working without a
// blanket `origin: true` (which combined with `credentials: true` defeats
// browser CSRF protections in some scenarios).
const CORS_ALLOWLIST = new Set<string>(
  [
    process.env.APP_URL,                              // canonical app URL
    "http://localhost:5000", "http://localhost:5173", // local dev
    "https://app.thesidedoor.ai",
    "https://www.thesidedoor.ai",
    "https://thesidedoor.ai",
  ].filter(Boolean) as string[],
);
app.use(cors({
  origin: (origin, cb) => {
    // No Origin header → same-origin or curl/server-to-server, allow.
    if (!origin) return cb(null, true);
    if (CORS_ALLOWLIST.has(origin)) return cb(null, true);
    // Allow Railway preview-deploy domains (per-PR subdomains).
    try {
      const host = new URL(origin).host;
      if (/\.up\.railway\.app$/.test(host) || /\.railway\.app$/.test(host)) {
        return cb(null, true);
      }
    } catch { /* fall through */ }
    return cb(new Error(`CORS: origin not allowed: ${origin}`));
  },
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

// CRITICAL: webhooks need raw body BEFORE express.json() parses it
// (Stripe verifies its signature against the raw bytes; the email webhook
// verifies an HMAC over them.)
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);
app.post("/api/webhooks/email", express.raw({ type: "application/json", limit: "1mb" }), handleEmailWebhook);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.set('trust proxy', 1); // required behind Railway/Replit proxy

// Cookie parser for session_id cookie
app.use(cookieParser());

// Session authentication middleware (attaches req.user via session_id cookie -> Supabase)
app.use(sessionAuth);


// Paths whose response bodies should NEVER be stringified into logs:
// auth flows (cookies, reset tokens, session IDs), billing (Stripe IDs, customer
// ids, transaction lists), users (PII), contacts (recruiter PII).
const REDACTED_LOG_PATHS = [
  /^\/api\/auth(\/|$)/,
  /^\/api\/billing(\/|$)/,
  /^\/api\/contacts(\/|$)/,
  /^\/api\/recruiters(\/|$)/,
  /^\/api\/outreach(\/|$)/,
];

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
    if (!path.startsWith("/api")) return;

    let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
    const isRedacted = REDACTED_LOG_PATHS.some((re) => re.test(path));
    if (capturedJsonResponse && !isRedacted) {
      logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
    } else if (isRedacted) {
      logLine += ` :: [redacted]`;
    }

    if (logLine.length > 200) {
      logLine = logLine.slice(0, 199) + "…";
    }

    log(logLine);
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
  app.use("/api/billing", billingRouter);
  app.use("/api/cron", cronRouter); // Cron secret guards each route inside
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

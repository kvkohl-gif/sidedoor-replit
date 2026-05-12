import { useEffect, useRef } from "react";

// Cloudflare Turnstile CAPTCHA widget.
// Renders the invisible/managed challenge and calls onToken(token) once the
// visitor passes. Token must be sent back to /api/auth/* endpoints as
// `captchaToken` in the body.
//
// Site key comes from VITE_TURNSTILE_SITE_KEY (public — safe to ship to browser).
// If the env var is missing (e.g. local dev without a site set up), the widget
// renders nothing and immediately reports a sentinel token "DEV_BYPASS" — the
// backend will reject this in production but accepts unsigned requests in dev.

const SITE_KEY = (import.meta as any).env?.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        opts: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

let scriptLoadingPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadingPromise) return scriptLoadingPromise;
  scriptLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src^="${SCRIPT_SRC.split("?")[0]}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("turnstile script failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile script failed"));
    document.head.appendChild(s);
  });
  return scriptLoadingPromise;
}

interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  onError?: () => void;
}

export function TurnstileWidget({ onToken, onError }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Dev-mode bypass: no site key configured → fire a sentinel token immediately.
    // The backend's verifyTurnstile() warns-and-passes in non-production when
    // TURNSTILE_SECRET_KEY is unset, so signup still works locally.
    if (!SITE_KEY) {
      onToken("DEV_BYPASS");
      return;
    }

    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: (token) => onToken(token),
          "error-callback": () => onError?.(),
          "expired-callback": () => {
            // Token expires after ~5 min — clear it and re-render to get a new one.
            if (widgetIdRef.current && window.turnstile) {
              window.turnstile.reset(widgetIdRef.current);
            }
          },
          theme: "light",
        });
      })
      .catch(() => onError?.());

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* noop */ }
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // No site key → don't render anything (we already fired DEV_BYPASS).
  if (!SITE_KEY) return null;
  return <div ref={containerRef} className="flex justify-center" />;
}

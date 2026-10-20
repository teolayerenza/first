"use client";

// Cloudflare Turnstile en modo invisible. Sin NEXT_PUBLIC_TURNSTILE_SITE_KEY (demo) devuelve null.

declare global {
  interface Window {
    turnstile?: {
      render(el: HTMLElement, opts: Record<string, unknown>): string;
      execute(id: string): void;
      reset(id: string): void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
let loading: Promise<void> | null = null;

function load(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile"));
    document.head.appendChild(s);
  });
  return loading;
}

/** Resolver un captcha tarda 1 a 3 s: se resuelven de antemano y se guardan hasta 4 minutos (vencen a los 5). */
const MAX_AGE_MS = 240_000;
const ready: { token: Promise<string | null>; at: number }[] = [];

/** Deja `n` captchas resueltos de antemano (al abrir un formulario), así enviar no espera. */
export function prefetchCaptcha(n = 1): void {
  if (!SITE_KEY) return;
  const fresh = ready.filter((r) => Date.now() - r.at < MAX_AGE_MS);
  ready.splice(0, ready.length, ...fresh);
  while (ready.length < n) ready.push({ token: solve(), at: Date.now() });
}

export async function getCaptchaToken(): Promise<string | null> {
  if (!SITE_KEY) return null;
  for (let r = ready.shift(); r; r = ready.shift()) {
    if (Date.now() - r.at >= MAX_AGE_MS) continue;
    const token = await r.token;
    if (token) return token;
  }
  return solve();
}

async function solve(): Promise<string | null> {
  try {
    await load();
  } catch {
    return null;
  }
  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.bottom = "16px";
    host.style.right = "16px";
    host.style.zIndex = "60";
    document.body.appendChild(host);
    const done = (token: string | null) => {
      host.remove();
      resolve(token);
    };
    window.turnstile!.render(host, {
      sitekey: SITE_KEY,
      appearance: "interaction-only",
      callback: (t: string) => done(t),
      // El código de error de Turnstile queda en la consola para diagnosticar (dominio no habilitado, clave, red).
      "error-callback": (code: string) => {
        console.warn("Turnstile:", code);
        done(null);
      },
      "timeout-callback": () => done(null),
    });
  });
}

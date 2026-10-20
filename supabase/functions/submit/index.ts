// Edge Function `submit`: ÚNICO punto de escritura de Pocitos LP (docs/SEGURIDAD.md §2).
//
// 1. Verifica la sesión anónima (JWT) y el captcha de Turnstile.
// 2. Valida el payload y aplica rate limits (en src/lib/domain/submit.ts, compartido con el modo demo).
// 3. Calcula los HMAC con HMAC_SECRET, que vive SOLO acá: ni en la base, ni en el cliente, ni en el repo.
// 4. Escribe con la service role a través de las funciones rpc_* (anon no puede ejecutarlas).
//
// Variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (las inyecta Supabase), HMAC_SECRET,
// TURNSTILE_SECRET.

import { createClient } from "@supabase/supabase-js";
import { handleSubmit } from "../../../src/lib/domain/submit.ts";
import { rpcStore } from "../../../src/lib/domain/rpc-store.ts";

const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`Falta la variable ${k}`);
  return v;
};

const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const hmacKey = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(env("HMAC_SECRET")),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"],
);

async function hmac(message: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", hmacKey, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyCaptcha(token: string | null): Promise<boolean> {
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret: env("TURNSTILE_SECRET"), response: token }),
  });
  const body = (await res.json()) as { success?: boolean };
  return body.success === true;
}

const store = rpcStore(
  async (fn, args) => {
    const { data, error } = await admin.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data;
  },
  async (contentType) => {
    const path = `pending/${crypto.randomUUID()}.${contentType === "image/webp" ? "webp" : "jpg"}`;
    const { data, error } = await admin.storage.from("photos").createSignedUploadUrl(path);
    if (error || !data) throw new Error(`storage: ${error?.message}`);
    return { path, uploadUrl: data.signedUrl, token: data.token };
  },
);

// CORS abierto: la función no usa cookies, así que otro sitio no puede aprovechar la sesión de nadie. Lo
// que protege la escritura es el JWT de la sesión anónima (que ningún otro sitio puede leer) y el captcha
// de Turnstile, que solo funciona en los dominios cargados en Cloudflare. Con un origen fijo, un secreto mal
// escrito bloqueaba todos los envíos sin dar error visible.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-captcha-token, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const jwt = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!jwt) return json({ ok: false, error: "unauthorized" }, 401);
  const { data: auth, error } = await admin.auth.getUser(jwt);
  if (error || !auth.user) return json({ ok: false, error: "unauthorized" }, 401);

  const raw = await req.json().catch(() => null);
  try {
    const result = await handleSubmit(
      raw,
      {
        deviceId: auth.user.id,
        sessionCreatedAt: new Date(auth.user.created_at),
        captchaToken: req.headers.get("x-captcha-token"),
      },
      { verifyCaptcha, hmac, store, now: () => new Date() },
    );
    return json(result, result.ok ? 200 : result.status);
  } catch (e) {
    // Nunca se loguea el payload ni el ID de la sesión.
    console.error("submit failed", e instanceof Error ? e.message : "unknown");
    return json({ ok: false, error: "internal" }, 500);
  }
});

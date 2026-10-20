"use client";

// Envío de aportes desde el navegador.
// - Producción: sesión anónima de Supabase (con captcha) → Edge Function `submit`.
// - Demo: /api/demo/submit con un ID aleatorio de dispositivo guardado en este navegador.

import type { SubmitInput } from "../domain/schemas";
import type { SubmitResult } from "../domain/submit";
import { enqueue, pending, remove } from "./queue";
import { getBrowserSupabase } from "./supabase";
import { getCaptchaToken } from "./turnstile";

export type ClientResult = SubmitResult | { ok: false; status: 0; error: "offline_queued" } | { ok: false; status: number; error: "network" | "unauthorized" | "internal" };

function demoDevice(): string {
  const KEY = "pocitos-demo-device";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

async function post(payload: SubmitInput): Promise<ClientResult> {
  const sb = getBrowserSupabase();
  if (!sb) {
    const res = await fetch("/api/demo/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-device": demoDevice() },
      body: JSON.stringify(payload),
    });
    return (await res.json()) as ClientResult;
  }

  let { data } = await sb.auth.getSession();
  if (!data.session) {
    // La sesión anónima también pide captcha: así un bot no puede fabricar miles de "vecinos".
    const captchaToken = await getCaptchaToken();
    if (!captchaToken) return { ok: false, status: 403, error: "captcha_failed" };
    const signIn = await sb.auth.signInAnonymously({ options: { captchaToken } });
    if (signIn.error) return { ok: false, status: 401, error: signIn.error.code === "captcha_failed" ? "captcha_failed" : "unauthorized" };
    data = { session: signIn.data.session! };
  }
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session!.access_token}`,
      "x-captcha-token": (await getCaptchaToken()) ?? "",
    },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as ClientResult;
}

async function uploadPhoto(photo: { blob: Blob; type: string }): Promise<string | null> {
  const r = await post({ kind: "photo_upload", contentType: photo.type as "image/webp", bytes: photo.blob.size });
  if (!r.ok || r.kind !== "photo_upload") return null;
  const sb = getBrowserSupabase();
  if (sb && r.token) {
    const up = await sb.storage.from("photos").uploadToSignedUrl(r.path, r.token, photo.blob, { contentType: photo.type });
    return up.error ? null : r.path;
  }
  const res = await fetch(r.uploadUrl, { method: "PUT", headers: { "Content-Type": photo.type }, body: photo.blob });
  return res.ok ? r.path : null;
}

/** Sube la foto (si hay) y envía el aporte. Sin conexión, lo deja en cola. */
export async function submit(payload: SubmitInput, photo?: { blob: Blob; type: string } | null): Promise<ClientResult> {
  try {
    let p = payload;
    if (photo && p.kind === "issue") {
      const path = await uploadPhoto(photo);
      p = { ...p, photoPath: path }; // si la foto falla, el reporte sale igual sin foto
    }
    return await post(p);
  } catch {
    // fetch solo tira por problemas de red: el aporte queda en cola para mandarse después.
    await enqueue({ payload, photo: photo ?? null, queuedAt: Date.now() });
    return { ok: false, status: 0, error: "offline_queued" };
  }
}

/** Reintenta lo que quedó en cola. Se llama al volver la conexión y al abrir la app. */
export async function flushQueue(): Promise<number> {
  let sent = 0;
  for (const item of await pending()) {
    try {
      let p = item.payload;
      if (item.photo && p.kind === "issue") p = { ...p, photoPath: await uploadPhoto(item.photo) };
      const r = await post(p);
      if (r.ok || (r.status >= 400 && r.status < 500)) {
        await remove(item.id!);
        if (r.ok) sent++;
      }
    } catch {
      break; // sigue sin conexión
    }
  }
  return sent;
}

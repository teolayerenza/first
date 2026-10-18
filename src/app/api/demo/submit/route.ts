// Escritura en MODO DEMO: mismo pipeline que la Edge Function, con almacenamiento en memoria.
// En producción esta ruta no existe (404): se escribe solo vía Supabase.

import { isDemo } from "@/lib/data";
import { demoSubmitDeps } from "@/lib/data/demo";
import { handleSubmit } from "@/lib/domain/submit";

export async function POST(req: Request) {
  if (!isDemo()) return new Response("Not found", { status: 404 });
  const device = req.headers.get("x-demo-device");
  if (!device || !/^[0-9a-f-]{36}$/.test(device)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const raw = await req.json().catch(() => null);
  const result = await handleSubmit(
    raw,
    // En demo todas las sesiones se consideran "maduras" para poder probar la verificación.
    { deviceId: device, sessionCreatedAt: new Date(Date.now() - 2 * 86_400_000), captchaToken: "demo" },
    demoSubmitDeps,
  );
  return Response.json(result, { status: result.ok ? 200 : result.status });
}

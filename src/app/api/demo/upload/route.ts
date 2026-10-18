// Subida de fotos en MODO DEMO: valida tipo y tamaño y descarta el archivo.
import { isDemo } from "@/lib/data";

export async function PUT(req: Request) {
  if (!isDemo()) return new Response("Not found", { status: 404 });
  const type = req.headers.get("content-type") ?? "";
  if (!["image/webp", "image/jpeg"].includes(type)) return new Response("Tipo no permitido", { status: 415 });
  const body = await req.arrayBuffer();
  if (body.byteLength > 1_000_000) return new Response("Muy grande", { status: 413 });
  return new Response(null, { status: 204 });
}

import { getDataSource } from "@/lib/data";

/** Cuadra más cercana a un punto (para el formulario). No se guarda nada del pedido. */
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  const lng = Number(u.get("lng"));
  const lat = Number(u.get("lat"));
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return Response.json({ error: "bad_request" }, { status: 400 });
  return Response.json(await getDataSource().nearestSegment([lng, lat]), { headers: { "Cache-Control": "no-store" } });
}

import { getDataSource } from "@/lib/data";
import { loadBaseData } from "@/lib/domain/base-data";
import { pointInRing, projectOnLine } from "@/lib/domain/geo";

/** Cuadra más cercana a un punto (para el formulario) y si el punto está en el casco. No se guarda nada del pedido. */
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  const lng = Number(u.get("lng"));
  const lat = Number(u.get("lat"));
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return Response.json({ error: "bad_request" }, { status: 400 });
  const { casco } = loadBaseData();
  // Con margen: la mano de afuera de la Circunvalación y sus rotondas quedan apenas fuera del límite.
  const segment = await getDataSource().nearestSegment([lng, lat]);
  // Si hay una cuadra a ≤ 60 m, vale aunque el punto caiga del otro lado del límite.
  const inCasco = !!segment || pointInRing([lng, lat], casco) || projectOnLine([lng, lat], casco).distanceM < 150;
  return Response.json({ segment, inCasco }, { headers: { "Cache-Control": "no-store" } });
}

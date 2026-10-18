import { getDataSource } from "@/lib/data";
import { OPEN_DATA_HEADERS, csv, zoneParam } from "@/lib/data/api";

export async function GET(req: Request) {
  const fc = await getDataSource().getSegments(zoneParam(req));
  const rows = fc.features.map(({ properties: p }) => [p.id, p.label, p.zoneId, p.condition, p.patching, p.cobbled, p.openPozos, p.openParches, p.score, p.lengthM]);
  const body = csv([["id", "cuadra", "zona_id", "estado", "parcheo", "empedrado", "pozos_abiertos", "parches_abiertos", "problemas_cada_100m", "largo_m"], ...rows]);
  return new Response(body, { headers: { ...OPEN_DATA_HEADERS, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="pocitos-cuadras.csv"' } });
}

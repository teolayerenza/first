import { getDataSource } from "@/lib/data";
import { OPEN_DATA_HEADERS, csv, zoneParam } from "@/lib/data/api";

export async function GET(req: Request) {
  const fc = await getDataSource().getIssues(zoneParam(req));
  const rows = fc.features.map(({ properties: p, geometry: g }) => [p.id, p.kind, p.parcheType, p.severity, p.verified, p.segmentId, p.days, p.sigueVotes, g.coordinates[0], g.coordinates[1]]);
  const body = csv([["id", "tipo", "tipo_parche", "gravedad", "verificado", "cuadra_id", "dias_abierto", "confirmaciones", "lng", "lat"], ...rows]);
  return new Response(body, { headers: { ...OPEN_DATA_HEADERS, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="pocitos-problemas.csv"' } });
}

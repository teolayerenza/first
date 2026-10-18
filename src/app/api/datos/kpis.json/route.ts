import { getDataSource } from "@/lib/data";
import { OPEN_DATA_HEADERS, zoneParam } from "@/lib/data/api";

export async function GET(req: Request) {
  const d = await getDataSource().getDashboard(zoneParam(req));
  return Response.json({ kpis: d.kpis, previous: d.previous, series: d.series, zones: d.zones, contributors: d.contributors }, { headers: OPEN_DATA_HEADERS });
}

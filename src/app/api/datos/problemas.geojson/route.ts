import { getDataSource } from "@/lib/data";
import { OPEN_DATA_HEADERS, zoneParam } from "@/lib/data/api";

export async function GET(req: Request) {
  const fc = await getDataSource().getIssues(zoneParam(req));
  return Response.json(fc, { headers: { ...OPEN_DATA_HEADERS, "Content-Type": "application/geo+json" } });
}

import { getDataSource } from "@/lib/data";

/** Índice "Calle __ entre __ y __" para buscar una cuadra sin GPS. */
export async function GET() {
  const idx = await getDataSource().getStreetIndex();
  return Response.json(idx, { headers: { "Cache-Control": "public, max-age=3600" } });
}

import { getDataSource } from "@/lib/data";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "bad_request" }, { status: 400 });
  const s = await getDataSource().getSegment(id);
  if (!s) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ ...s, coords: undefined }, { headers: { "Cache-Control": "no-store" } });
}

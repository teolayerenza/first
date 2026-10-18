import { getDataSource } from "@/lib/data";

export async function GET(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return Response.json({ error: "bad_request" }, { status: 400 });
  return Response.json(await getDataSource().adjacentSegments(id));
}

import "server-only";

export function zoneParam(req: Request): number | null {
  const z = Number(new URL(req.url).searchParams.get("zona"));
  return Number.isInteger(z) && z > 0 ? z : null;
}

export const OPEN_DATA_HEADERS = {
  "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
  "Access-Control-Allow-Origin": "*",
  "X-License": "ODbL-1.0 (c) Pocitos LP y colaboradores de OpenStreetMap",
};

export function csv(rows: (string | number | boolean | null)[][]): string {
  const cell = (v: string | number | boolean | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";
}

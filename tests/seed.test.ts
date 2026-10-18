import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { expect, it } from "vitest";
import { createDb } from "./helpers/pg";

it("supabase/seed.sql carga sobre las migraciones y deja KPIs consistentes", async () => {
  if (!existsSync("supabase/seed.sql")) execSync("npx tsx scripts/build-data.ts");
  const db = await createDb();
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  const { rows } = await db.query<{ k: { kmTotal: number; pctSurveyed: number } }>(`select kpis from v_kpis where zone_id = 0`.replace("kpis from", "kpis as k from"));
  expect(rows[0].k.kmTotal).toBeGreaterThan(100);
  expect(rows[0].k.pctSurveyed).toBe(0);
  const snaps = await db.query<{ n: number }>(`select count(*)::int as n from stats_snapshots`);
  expect(snaps.rows[0].n).toBe(37);
}, 120_000);

// Las reglas viven dos veces: en TypeScript (modo demo) y en SQL (producción).
// Este test carga los mismos datos simulados en ambos y exige que den lo mismo.

import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { simulate } from "../src/lib/demo/simulate";
import { buildCasco } from "../src/lib/domain/grid";
import { computeKpis, evaluate, type Evaluation, type Kpis } from "../src/lib/domain/kpis";
import type { Dataset } from "../src/lib/domain/types";
import { createDb, loadDataset } from "./helpers/pg";

let db: PGlite;
let data: Dataset;
let ev: Evaluation;

beforeAll(async () => {
  const now = new Date();
  data = simulate(now, 7);
  db = await createDb();
  await loadDataset(db, data, buildCasco());
  ev = evaluate(data, new Date());
}, 180_000);

describe("paridad TypeScript ↔ SQL", () => {
  it("el estado de cada cuadra coincide", async () => {
    const { rows } = await db.query<{ id: string; condition: string; patching: string | null; open_pozos: number; open_parches: number; score: number }>(
      `select id, condition, patching, open_pozos, open_parches, issue_score as score from segments`,
    );
    const sql = new Map(rows.map((r) => [Number(r.id), r]));
    const mismatches = ev.segments.filter((s) => {
      const r = sql.get(s.segment.id)!;
      return (
        r.condition !== s.condition ||
        r.patching !== s.patching ||
        r.open_pozos !== s.openPozos ||
        r.open_parches !== s.openParches ||
        Math.abs(r.score - s.issueScore) > 0.011
      );
    });
    expect(mismatches.map((m) => m.segment.id)).toEqual([]);
  });

  it("verificación y estado de cada problema coinciden", async () => {
    const { rows } = await db.query<{ id: string; verified: boolean; status: string; fix_quality: string | null }>(
      `select id, verified, status, fix_quality from issues`,
    );
    const sql = new Map(rows.map((r) => [r.id, r]));
    expect(rows.length).toBe(ev.issues.length); // el SQL no creó parches que el TS no tenga
    const mismatches = ev.issues.filter((i) => {
      const r = sql.get(i.issue.id)!;
      return r.verified !== i.derived.verified || r.status !== i.derived.status || r.fix_quality !== i.derived.fixQuality;
    });
    expect(mismatches.map((m) => m.issue.id)).toEqual([]);
  });

  it.each([0, 1, 14, 36])("los KPIs coinciden (zona %i; 0 = casco)", async (zone) => {
    const { rows } = await db.query<{ k: Kpis }>(`select kpis_json($1) as k`, [zone]);
    const sql = rows[0].k;
    const ts = computeKpis(ev, zone === 0 ? null : zone);
    const strip = (k: Kpis) => ({ ...k, asOf: "", issues: { ...k.issues, oldestOpen: k.issues.oldestOpen?.days ?? null } });
    const a = strip(sql);
    const b = strip(ts);
    // Redondeos de punto flotante: tolerancia de 0,1 en kilómetros y porcentajes.
    for (const key of Object.keys(b.km) as (keyof Kpis["km"])[]) {
      expect(Math.abs(a.km[key] - b.km[key])).toBeLessThanOrEqual(0.11);
      expect(Math.abs(a.pct[key] - b.pct[key])).toBeLessThanOrEqual(0.11);
    }
    expect(a.cuadras).toEqual(b.cuadras);
    expect(a.scope).toEqual(b.scope);
    expect(a.contributions).toBe(b.contributions);
    expect(a.issues).toEqual(b.issues);
    expect(Math.abs(a.pctSurveyed - b.pctSurveyed)).toBeLessThanOrEqual(0.11);
    expect(Math.abs(a.pctTodoParche - b.pctTodoParche)).toBeLessThanOrEqual(0.11);
    expect(Math.abs(a.pctCobbled - b.pctCobbled)).toBeLessThanOrEqual(0.11);
  });
});

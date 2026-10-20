// Flujo completo de escritura contra el SQL real: pipeline → RPC → pendiente → promoción → KPIs.
// También verifica los permisos: anon no puede tocar tablas ni RPC.

import { createHmac } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { buildCasco, buildSegments, buildZones } from "../src/lib/domain/grid";
import { midpoint } from "../src/lib/domain/geo";
import { rpcStore } from "../src/lib/domain/rpc-store";
import { handleSubmit, type SubmitContext, type SubmitDeps } from "../src/lib/domain/submit";
import type { LngLat } from "../src/lib/domain/types";
import { createDb, loadDataset } from "./helpers/pg";

let db: PGlite;
let deps: SubmitDeps;
const segments = buildSegments();
const zones = buildZones();
const TABLE_FNS = new Set(["rpc_snap", "rpc_nearby_open_issues"]);

const old = new Date(Date.now() - 3 * 86_400_000);
const ctx = (device: string, sessionCreatedAt = old): SubmitContext => ({ deviceId: device, sessionCreatedAt, captchaToken: "ok" });

async function asService<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec("set role service_role");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

beforeAll(async () => {
  db = await createDb();
  await loadDataset(db, { zones, segments, ratings: [], events: [], issues: [], votes: [], contributors: [] }, buildCasco());
  const call = async (fn: string, args: Record<string, unknown>) => {
    const keys = Object.keys(args);
    const sql = `select * from ${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")})`;
    const { rows } = await asService(() => db.query<Record<string, unknown>>(sql, keys.map((k) => args[k])));
    return TABLE_FNS.has(fn) ? rows : rows[0]?.[fn];
  };
  deps = {
    verifyCaptcha: async (t) => t === "ok",
    hmac: async (m) => createHmac("sha256", "test-secret").update(m).digest("hex"),
    store: rpcStore(call, async () => ({ path: "pending/x.webp", uploadUrl: "https://example.test" })),
    now: () => new Date(),
  };
}, 120_000);

const seg = segments.find((s) => s.streetName === "Calle 10" && s.betweenA === "47")!;
const onSeg: LngLat = midpoint(seg.coords);
const promote = () => db.query("select promote_pending()");
const segRow = async (id: number) =>
  (await db.query<{ condition: string; open_pozos: number; open_parches: number }>(`select * from segments where id = $1`, [id])).rows[0];

describe("escritura", () => {
  it("rechaza captcha inválido y payloads con campos fuera de rango", async () => {
    expect(await handleSubmit({ kind: "rating", segmentId: seg.id, rating: "buena" }, { ...ctx("a"), captchaToken: "x" }, deps)).toMatchObject({ ok: false, error: "captcha_failed" });
    expect(await handleSubmit({ kind: "rating", segmentId: seg.id, rating: "excelente" }, ctx("a"), deps)).toMatchObject({ ok: false, error: "invalid_payload" });
    expect(await handleSubmit({ kind: "issue", issueKind: "parche", severity: 2, location: onSeg }, ctx("a"), deps)).toMatchObject({ ok: false, error: "invalid_payload" });
  });

  it("una calificación se publica al instante y nunca guarda el vínculo con el dispositivo", async () => {
    const r = await handleSubmit({ kind: "rating", segmentId: seg.id, rating: "muy_deteriorada", onSite: true }, ctx("vecina-1"), deps);
    expect(r.ok).toBe(true);
    expect((await segRow(seg.id)).condition).toBe("muy_deteriorada"); // en el lugar pesa 2
    const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from segment_ratings where contributor_hash is not null`);
    expect(rows[0].n).toBe(0);
    const c = await db.query<{ total: number; rated_on_site: number }>(`select total::int, rated_on_site::int from v_contributors`);
    expect(c.rows[0]).toEqual({ total: 1, rated_on_site: 1 });
  });

  it("rechaza puntos fuera del casco o lejos de una calle", async () => {
    expect(await handleSubmit({ kind: "issue", issueKind: "pozo", severity: 2, location: [-58.05, -34.95] }, ctx("b"), deps)).toMatchObject({ error: "outside_casco" });
    // Centro de una manzana: a ~60 m de cualquier calle.
    const s2 = segments.find((s) => s.streetName === "Calle 48" && s.betweenA === "10")!;
    const block: LngLat = [(onSeg[0] + midpoint(s2.coords)[0]) / 2, (onSeg[1] + midpoint(s2.coords)[1]) / 2];
    expect(await handleSubmit({ kind: "issue", issueKind: "pozo", severity: 2, location: block }, ctx("b"), deps)).toMatchObject({ error: "no_street_nearby" });
  });

  let pozoId = "";
  it("detecta duplicados a menos de 8 m", async () => {
    const r = await handleSubmit({ kind: "issue", issueKind: "pozo", severity: 3, location: onSeg }, ctx("reporter"), deps);
    expect(r).toMatchObject({ ok: true, kind: "issue", segmentId: seg.id });
    pozoId = (r as { issueId: string }).issueId;
    const near: LngLat = [onSeg[0] + 0.00003, onSeg[1]];
    expect(await handleSubmit({ kind: "issue", issueKind: "pozo", severity: 1, location: near }, ctx("otro"), deps)).toMatchObject({ error: "duplicate", duplicateId: pozoId });
    // Un parche en el mismo lugar no es duplicado de un pozo.
    expect((await handleSubmit({ kind: "issue", issueKind: "parche", parcheType: "elevado", severity: 1, location: near }, ctx("otro"), deps)).ok).toBe(true);
    await promote();
  });

  it("no se puede autoconfirmar; una sesión nueva tampoco verifica sola", async () => {
    await handleSubmit({ kind: "vote", issueId: pozoId, vote: "sigue" }, ctx("reporter"), deps);
    await handleSubmit({ kind: "vote", issueId: pozoId, vote: "sigue" }, ctx("recien-llegado", new Date()), deps);
    expect((await db.query<{ verified: boolean }>(`select verified from issues where id = $1`, [pozoId])).rows[0].verified).toBe(false);
    await handleSubmit({ kind: "vote", issueId: pozoId, vote: "sigue" }, ctx("vecino-viejo"), deps);
    expect((await db.query<{ verified: boolean }>(`select verified from issues where id = $1`, [pozoId])).rows[0].verified).toBe(true);
    expect((await segRow(seg.id)).open_pozos).toBe(1);
  });

  it("un arreglo mal hecho resuelve el pozo y crea un parche en el mismo punto", async () => {
    await handleSubmit({ kind: "vote", issueId: pozoId, vote: "arreglado", fixQuality: "parche_malo" }, ctx("x1"), deps);
    await handleSubmit({ kind: "vote", issueId: pozoId, vote: "arreglado", fixQuality: "parche_malo" }, ctx("x2"), deps);
    await promote();
    const { rows } = await db.query<{ status: string; fix_quality: string }>(`select status, fix_quality from issues where id = $1`, [pozoId]);
    expect(rows[0]).toEqual({ status: "resuelto", fix_quality: "parche_malo" });
    const child = await db.query<{ kind: string; verified: boolean }>(`select kind, verified from issues where origin_issue_id = $1`, [pozoId]);
    expect(child.rows).toEqual([{ kind: "parche", verified: true }]);
    const k = (await db.query<{ k: { issues: { badFixRatePct: number; openPozos: number } } }>(`select kpis_json(0) as k`)).rows[0].k;
    expect(k.issues.badFixRatePct).toBe(100);
    expect(k.issues.openPozos).toBe(0);
  });

  it("aplica el límite diario por dispositivo", async () => {
    const results = [];
    for (let i = 0; i < 12; i++) {
      const s = segments[100 + i * 7];
      results.push(await handleSubmit({ kind: "issue", issueKind: "pozo", severity: 1, location: midpoint(s.coords) }, ctx("spammer"), deps));
    }
    expect(results.filter((r) => r.ok)).toHaveLength(10);
    expect(results.at(-1)).toMatchObject({ ok: false, error: "rate_limited" });
  });

  it("una ráfaga en una zona queda en revisión, no cuenta y queda en la bitácora pública", async () => {
    const zoneSegs = segments.filter((s) => s.zoneId === 20).slice(0, 60);
    // El detector corre sobre lo pendiente: se carga la ráfaga sin publicar al instante, como si llegara toda junta.
    const queued = { ...deps, store: { ...deps.store, publish: undefined } };
    for (const [i, s] of zoneSegs.entries()) {
      await handleSubmit({ kind: "rating", segmentId: s.id, rating: "buena", onSite: true }, ctx(`bot-${i}`), queued);
    }
    await promote();
    const { rows } = await db.query<{ state: string; n: number }>(
      `select r.state, count(*)::int as n from segment_ratings r join segments s on s.id = r.segment_id where s.zone_id = 20 group by 1`,
    );
    expect(rows).toEqual([{ state: "en_revision", n: 60 }]);
    const log = await db.query<{ action: string; count: number }>(`select action, count from v_moderation_log`);
    expect(log.rows[0]).toMatchObject({ action: "En revisión automática", count: 60 });
    const k = (await db.query<{ k: { cuadras: { buena: number } } }>(`select kpis_json(20) as k`)).rows[0].k;
    expect(k.cuadras.buena).toBe(0);
  });
});

describe("permisos", () => {
  const asAnon = async <T,>(sql: string) => {
    await db.exec("set role anon");
    try {
      return await db.query<T>(sql);
    } finally {
      await db.exec("reset role");
    }
  };

  it.each(["segments", "segment_ratings", "issues", "issue_votes", "contributors", "counters", "config"])(
    "anon no puede leer la tabla %s",
    async (t) => {
      await expect(asAnon(`select * from ${t} limit 1`)).rejects.toThrow(/permission denied/);
    },
  );

  it("anon no puede ejecutar las RPC de escritura", async () => {
    await expect(asAnon(`select rpc_bump_counter('x')`)).rejects.toThrow(/permission denied/);
    await expect(asAnon(`select promote_pending()`)).rejects.toThrow(/permission denied/);
  });

  it("anon puede leer las vistas públicas", async () => {
    const { rows } = await asAnon<{ kpis: { kmTotal: number } }>(`select kpis from v_kpis where zone_id = 0`);
    expect(rows[0].kpis.kmTotal).toBeGreaterThan(100);
    expect((await asAnon(`select * from v_segments limit 1`)).rows).toHaveLength(1);
    expect((await asAnon(`select * from v_issues limit 1`)).rows.length).toBeGreaterThanOrEqual(0);
  });

  it("ninguna vista pública expone hashes", async () => {
    const { rows } = await db.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
        where table_schema = 'public' and table_name like 'v\\_%' and column_name ~ '(hash|device|ip)'`,
    );
    expect(rows).toEqual([]);
  });
});

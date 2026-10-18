import { describe, expect, it } from "vitest";
import { computeCondition } from "../src/lib/domain/condition";
import { buildCasco, buildSegments, buildZones, segmentLabel } from "../src/lib/domain/grid";
import { pointInRing, projectOnLine } from "../src/lib/domain/geo";
import { deriveIssue } from "../src/lib/domain/issues";
import { handleSubmit, type SubmitDeps } from "../src/lib/domain/submit";
import { splitWays, streetLabel, type OsmWay } from "../src/lib/osm/split";
import type { Issue, IssueVote, SegmentRating } from "../src/lib/domain/types";

const now = new Date("2026-10-18T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const rating = (over: Partial<SegmentRating>): SegmentRating => ({
  segmentId: 1, voterHash: "a", rating: "buena", patching: null, onSite: false, createdAt: daysAgo(10), state: "activo", ...over,
});

describe("grilla del casco", () => {
  const segments = buildSegments();
  it("tiene cuadras con la numeración platense", () => {
    expect(segments.length).toBeGreaterThan(2500);
    expect(segments.some((s) => segmentLabel(s) === "Av. 7 e/ 45 y 46")).toBe(true);
    expect(segments.some((s) => segmentLabel(s) === "Calle 50 e/ 10 y 11")).toBe(true);
    // La 52 no existe: la 7 va directo de la 51 a la 53.
    expect(segments.some((s) => segmentLabel(s) === "Av. 7 e/ 51 y 53")).toBe(true);
  });
  it("cada cuadra está dentro del casco y en una zona", () => {
    const casco = buildCasco();
    const zoneIds = new Set(buildZones().map((z) => z.id));
    for (const s of segments) {
      expect(pointInRing(s.coords[0], casco)).toBe(true);
      expect(zoneIds.has(s.zoneId)).toBe(true);
    }
  });
});

describe("estado del asfalto", () => {
  it("sin_relevar con un solo voto a distancia; vale con uno en el lugar", () => {
    expect(computeCondition([rating({})], [], now).condition).toBe("sin_relevar");
    expect(computeCondition([rating({ onSite: true })], [], now).condition).toBe("buena");
  });
  it("ante empate gana la opción peor", () => {
    const r = [rating({ voterHash: "a" }), rating({ voterHash: "b" }), rating({ voterHash: "c", rating: "muy_deteriorada" }), rating({ voterHash: "d", rating: "muy_deteriorada" })];
    expect(computeCondition(r, [], now).condition).toBe("muy_deteriorada");
  });
  it("ignora calificaciones de más de un año o no activas", () => {
    const r = [rating({ voterHash: "a", createdAt: daysAgo(400), onSite: true }), rating({ voterHash: "b", state: "en_revision", onSite: true })];
    expect(computeCondition(r, [], now).condition).toBe("sin_relevar");
  });
  it("una repavimentación confirmada por 2 dispositivos la vuelve 'nueva'", () => {
    const ev = (voterHash: string) => ({ segmentId: 1, voterHash, type: "repavimentada" as const, approxDate: daysAgo(30), createdAt: daysAgo(20), state: "activo" as const });
    expect(computeCondition([rating({ rating: "muy_deteriorada", onSite: true })], [ev("a")], now).condition).toBe("muy_deteriorada");
    expect(computeCondition([rating({ rating: "muy_deteriorada", onSite: true })], [ev("a"), ev("b")], now).condition).toBe("nueva");
  });
});

describe("problemas puntuales", () => {
  const issue: Issue = {
    id: "i", reporterHash: "rep", kind: "pozo", parcheType: null, originIssueId: null, severity: 2, location: [0, 0],
    segmentId: 1, hasPhoto: false, photoApproved: false, createdAt: daysAgo(50), state: "activo",
  };
  const vote = (voterHash: string, v: Partial<IssueVote> = {}): IssueVote => ({
    issueId: "i", voterHash, vote: "sigue", fixQuality: null, mature: true, createdAt: daysAgo(10), state: "activo", ...v,
  });
  it("la foto verifica; la autoconfirmación no", () => {
    expect(deriveIssue({ ...issue, hasPhoto: true }, [], now).verified).toBe(true);
    expect(deriveIssue(issue, [vote("rep")], now).verified).toBe(false);
    expect(deriveIssue(issue, [vote("x", { mature: false })], now).verified).toBe(false);
    expect(deriveIssue(issue, [vote("x")], now).verified).toBe(true);
  });
  it("dos 'arreglado' lo resuelven y registran la calidad del arreglo", () => {
    const d = deriveIssue(issue, [vote("a", { vote: "arreglado", fixQuality: "parche_malo", createdAt: daysAgo(5) }), vote("b", { vote: "arreglado", fixQuality: "bien", createdAt: daysAgo(3) })], now);
    expect(d.status).toBe("resuelto");
    expect(d.resolvedAt).toEqual(daysAgo(3));
    expect(d.fixQuality).toBe("parche_malo"); // empate → se asume mal hecho
  });
  it("tres 'falso' lo ocultan", () => {
    expect(deriveIssue(issue, ["a", "b", "c"].map((h) => vote(h, { vote: "falso" })), now).status).toBe("oculto");
  });
});

describe("pipeline de escritura (sin base)", () => {
  const segs = buildSegments().slice(0, 3);
  const deps = (): SubmitDeps & { inserted: unknown[] } => {
    const inserted: unknown[] = [];
    const counters = new Map<string, number>();
    return {
      inserted,
      verifyCaptcha: async () => true,
      hmac: async (m) => `h(${m})`,
      now: () => now,
      store: {
        insideCasco: async () => true,
        snap: async (p) => ({ segmentId: segs[0].id, distanceM: projectOnLine(p, segs[0].coords).distanceM }),
        segmentExists: async (id) => segs.some((s) => s.id === id),
        issueExists: async () => true,
        nearbyOpenIssues: async () => [],
        bumpCounter: async (k) => { counters.set(k, (counters.get(k) ?? 0) + 1); return counters.get(k)!; },
        insertRating: async (r) => void inserted.push(r),
        insertSegmentEvent: async (e) => void inserted.push(e),
        insertIssue: async (i) => void inserted.push(i),
        insertVote: async (v) => void inserted.push(v),
        createPhotoUpload: async () => ({ path: "pending/x.webp", uploadUrl: "u" }),
      },
    };
  };
  it("nunca guarda el ID del dispositivo en claro", async () => {
    const d = deps();
    await handleSubmit({ kind: "rating", segmentId: segs[0].id, rating: "gastada", repaved: "este_mes" }, { deviceId: "SECRETO", sessionCreatedAt: now, captchaToken: "t" }, d);
    expect(d.inserted).toHaveLength(2);
    for (const row of d.inserted) {
      for (const v of Object.values(row as object)) if (typeof v === "string") expect(v.startsWith("SECRETO")).toBe(false);
    }
  });
  it("el hash de un voto es distinto en cada cuadra (no se pueden juntar aportes)", async () => {
    const d = deps();
    const ctx = { deviceId: "dev", sessionCreatedAt: now, captchaToken: "t" };
    await handleSubmit({ kind: "rating", segmentId: segs[1].id, rating: "buena" }, ctx, d);
    await handleSubmit({ kind: "rating", segmentId: segs[2].id, rating: "buena" }, ctx, d);
    const [a, b] = d.inserted as { voterHash: string; contributorHash: string }[];
    expect(a.voterHash).not.toBe(b.voterHash);
    expect(a.contributorHash).toBe(b.contributorHash); // solo sirve para el contador de vecinos
  });
});

describe("importación de OSM", () => {
  it("parte vías en cuadras entre intersecciones y las nombra", () => {
    const zones = [{ id: 1, slug: "z", name: "z", ring: [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]] as [number, number][] }];
    const g = (lat: number, lon: number) => ({ lat, lon });
    const ways: OsmWay[] = [
      { id: 1, nodes: [1, 2, 3], geometry: [g(0, -0.002), g(0, 0), g(0, 0.002)], tags: { name: "Calle 7", highway: "residential", surface: "sett" } },
      { id: 2, nodes: [4, 1, 5], geometry: [g(-0.001, -0.002), g(0, -0.002), g(0.001, -0.002)], tags: { name: "Calle 45", highway: "residential" } },
      { id: 3, nodes: [6, 2, 7], geometry: [g(-0.001, 0), g(0, 0), g(0.001, 0)], tags: { name: "Calle 46", highway: "residential" } },
      { id: 4, nodes: [8, 3, 9], geometry: [g(-0.001, 0.002), g(0, 0.002), g(0.001, 0.002)], tags: { name: "Avenida 47", highway: "secondary" } },
    ];
    const segs = splitWays(ways, zones[0].ring, zones);
    const seven = segs.filter((s) => s.streetName === "Calle 7").map(segmentLabel);
    expect(seven).toEqual(["Calle 7 e/ 45 y 46", "Calle 7 e/ 46 y 47"]);
    expect(segs.find((s) => s.streetName === "Calle 7")!.isCobbled).toBe(true);
    expect(streetLabel({ name: "Avenida 13" })).toEqual({ name: "Av. 13", isAvenue: true });
    expect(streetLabel({ name: "Diagonal 74" }).name).toBe("Diagonal 74");
  });
});

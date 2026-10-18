// Modo demo: datos simulados en memoria del servidor. Se activa cuando no hay variables de Supabase.
// Los aportes que se envían se suman a la memoria y se pierden al reiniciar el servidor.

import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { buildCasco } from "../domain/grid";
import { pointInRing, projectOnLine } from "../domain/geo";
import { evaluate, monthlySeries, type Evaluation } from "../domain/kpis";
import type { SubmitDeps, SubmitStore } from "../domain/submit";
import type { Dataset, LngLat } from "../domain/types";
import { simulate } from "../demo/simulate";
import {
  contributorsSummary,
  issuesFC,
  kpisFor,
  oldestOpen,
  segmentDetail,
  segmentsFC,
  zoneRows,
} from "./shape";
import type { Dashboard, DataSource, ModerationEntry } from "./types";

const DAY = 86_400_000;

interface DemoState {
  data: Dataset;
  version: number;
  counters: Map<string, number>;
  cache: Map<string, { version: number; minute: number; value: unknown }>;
}

const g = globalThis as unknown as { __pocitosDemo?: DemoState };

function state(): DemoState {
  if (!g.__pocitosDemo) {
    g.__pocitosDemo = { data: simulate(new Date()), version: 0, counters: new Map(), cache: new Map() };
  }
  return g.__pocitosDemo;
}

/** Memoiza por versión de datos y por minuto (los KPIs dependen de "ahora"). */
function memo<T>(key: string, compute: () => T): T {
  const st = state();
  const minute = Math.floor(Date.now() / 60_000);
  const hit = st.cache.get(key);
  if (hit && hit.version === st.version && hit.minute === minute) return hit.value as T;
  const value = compute();
  st.cache.set(key, { version: st.version, minute, value });
  return value;
}

const nowEval = (): Evaluation => memo("eval:now", () => evaluate(state().data, new Date()));

const casco = buildCasco();

const MODERATION: ModerationEntry[] = [
  {
    at: new Date(Date.now() - 12 * DAY).toISOString(),
    action: "Aportes ocultados",
    count: 340,
    area: "Zona 19–25 / 60–66",
    reason: "Actividad automatizada: 340 calificaciones en 20 minutos desde sesiones nuevas (dato de ejemplo).",
  },
  {
    at: new Date(Date.now() - 31 * DAY).toISOString(),
    action: "Fotos ocultadas",
    count: 2,
    area: "Calle 10 e/ 47 y 48",
    reason: "Denunciadas por mostrar una patente (dato de ejemplo).",
  },
];

export const demoSource: DataSource = {
  mode: "demo",

  async getDashboard(zoneId = null): Promise<Dashboard> {
    return memo(`dash:${zoneId}`, () => {
      const st = state();
      const ev = nowEval();
      const prevEv = memo("eval:prev", () => evaluate(st.data, new Date(Date.now() - 30 * DAY)));
      return {
        kpis: kpisFor(ev, zoneId),
        previous: kpisFor(prevEv, zoneId),
        series: monthlySeries(st.data, new Date(), 12, zoneId),
        zones: zoneRows(ev, st.data.zones),
        contributors: contributorsSummary(st.data.contributors, new Date()),
        oldestOpenIssues: oldestOpen(ev, zoneId),
        moderation: MODERATION,
        mode: "demo",
      };
    });
  },

  async getZones() {
    return state().data.zones;
  },

  async getSegments(zoneId = null) {
    return memo(`segs:${zoneId}`, () => segmentsFC(nowEval(), zoneId));
  },

  async getIssues(zoneId = null) {
    return memo(`issues:${zoneId}`, () => issuesFC(nowEval(), zoneId));
  },

  async getSegment(id) {
    return segmentDetail(nowEval(), state().data.zones, id);
  },

  async getCasco() {
    return casco;
  },

  async getStreetIndex() {
    return memo("streets", () =>
      state().data.segments.map((s) => ({ id: s.id, street: s.streetName, a: s.betweenA, b: s.betweenB })),
    );
  },
};

// ——— Escritura en modo demo ———

const DEMO_SECRET = "demo-secret-solo-para-desarrollo";

const demoStore: SubmitStore = {
  async insideCasco(p) {
    return pointInRing(p, casco);
  },
  async snap(p, maxDistanceM) {
    let best: { segmentId: number; distanceM: number } | null = null;
    for (const s of state().data.segments) {
      const d = projectOnLine(p, s.coords).distanceM;
      if (d <= maxDistanceM && (!best || d < best.distanceM)) best = { segmentId: s.id, distanceM: d };
    }
    return best;
  },
  async segmentExists(id) {
    return state().data.segments.some((s) => s.id === id);
  },
  async issueExists(id) {
    return state().data.issues.some((i) => i.id === id);
  },
  async nearbyOpenIssues(p, radiusM) {
    const open = new Set(nowEval().issues.filter((i) => i.derived.status === "abierto").map((i) => i.issue.id));
    return state()
      .data.issues.filter((i) => open.has(i.id))
      .map((i) => ({ id: i.id, kind: i.kind, distanceM: projectOnLine(p, [i.location, i.location]).distanceM }))
      .filter((i) => i.distanceM <= radiusM);
  },
  async bumpCounter(key) {
    const c = state().counters;
    const v = (c.get(key) ?? 0) + 1;
    c.set(key, v);
    return v;
  },
  async insertRating(row) {
    const st = state();
    // Un voto vigente por dispositivo y cuadra: el nuevo reemplaza al anterior.
    st.data.ratings = st.data.ratings.filter((r) => !(r.segmentId === row.segmentId && r.voterHash === row.voterHash));
    st.data.ratings.push({
      segmentId: row.segmentId,
      voterHash: row.voterHash,
      rating: row.rating,
      patching: row.patching,
      onSite: row.onSite,
      createdAt: new Date(),
      state: "activo",
    });
    touchContributor(row.contributorHash, row.onSite ? "ratedOnSite" : "rated");
    st.version++;
  },
  async insertSegmentEvent(row) {
    const st = state();
    if (st.data.events.some((e) => e.segmentId === row.segmentId && e.voterHash === row.voterHash && e.type === row.type)) return;
    st.data.events.push({ ...row, createdAt: new Date(), state: "activo" });
    st.version++;
  },
  async insertIssue(row) {
    const st = state();
    st.data.issues.push({
      id: row.id,
      reporterHash: row.reporterHash,
      kind: row.kind,
      parcheType: row.parcheType,
      originIssueId: null,
      severity: row.severity,
      location: row.location,
      segmentId: row.segmentId,
      hasPhoto: row.photoPath !== null,
      photoApproved: false,
      createdAt: new Date(),
      state: "activo",
    });
    touchContributor(row.contributorHash, "reportedIssue");
    st.version++;
  },
  async insertVote(row) {
    const st = state();
    st.data.votes = st.data.votes.filter((v) => !(v.issueId === row.issueId && v.voterHash === row.voterHash));
    st.data.votes.push({ ...row, createdAt: new Date(), state: "activo" });
    // Arreglo mal hecho: el pozo se resuelve y en el mismo punto nace un parche (como el trigger SQL).
    if (row.vote === "arreglado" && row.fixQuality === "parche_malo") {
      const issue = st.data.issues.find((i) => i.id === row.issueId);
      const derived = issue && evaluate({ ...st.data, issues: [issue] }, new Date()).issues[0]?.derived;
      const exists = st.data.issues.some((i) => i.originIssueId === row.issueId);
      if (issue && issue.kind === "pozo" && derived?.status === "resuelto" && derived.fixQuality === "parche_malo" && !exists) {
        st.data.issues.push({
          ...issue,
          id: randomUUID(),
          kind: "parche",
          parcheType: "elevado",
          originIssueId: issue.id,
          severity: 2,
          hasPhoto: false,
          createdAt: new Date(),
        });
      }
    }
    touchContributor(row.contributorHash, "reportedIssue");
    st.version++;
  },
  async createPhotoUpload(contentType) {
    const ext = contentType === "image/webp" ? "webp" : "jpg";
    const path = `pending/${randomUUID()}.${ext}`;
    return { path, uploadUrl: `/api/demo/upload?path=${encodeURIComponent(path)}` };
  },
};

function touchContributor(hash: string, flag: "rated" | "ratedOnSite" | "reportedIssue") {
  const list = state().data.contributors;
  let c = list.find((x) => x.deviceHash === hash);
  if (!c) {
    const now = new Date();
    c = {
      deviceHash: hash,
      firstAt: now,
      firstMonth: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      rated: false,
      ratedOnSite: false,
      reportedIssue: false,
    };
    list.push(c);
  }
  c[flag] = true;
  if (flag === "ratedOnSite") c.rated = true;
}

export const demoSubmitDeps: SubmitDeps = {
  // En demo no hay Turnstile: se acepta cualquier token.
  async verifyCaptcha() {
    return true;
  },
  async hmac(message) {
    return createHmac("sha256", DEMO_SECRET).update(message).digest("hex");
  },
  store: demoStore,
  now: () => new Date(),
};

export function demoCount(): number {
  return state().version;
}

export type { LngLat };

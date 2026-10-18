// Cálculo de indicadores. Espejo en SQL: vistas `v_kpis` / `v_kpis_zone` y `take_snapshot()`.

import { computeCondition, isCobbledByVotes } from "./condition";
import { DEFAULT_CONFIG, type Config } from "./config";
import { segmentLabel } from "./grid";
import { deriveIssue } from "./issues";
import type { Condition, Dataset, Issue, IssueDerived, Patching, Segment } from "./types";

const DAY_MS = 86_400_000;
export const CONDITIONS: Condition[] = ["nueva", "buena", "gastada", "muy_deteriorada", "sin_relevar"];

export interface SegmentState {
  segment: Segment;
  condition: Condition;
  patching: Patching | null;
  repavedAt: Date | null;
  ratingCount: number;
  openPozos: number;
  openParches: number;
  /** Problemas abiertos ponderados por gravedad, cada 100 m. */
  issueScore: number;
}

export interface IssueState {
  issue: Issue;
  derived: IssueDerived;
}

export interface Evaluation {
  asOf: Date;
  segments: SegmentState[];
  issues: IssueState[];
}

export function evaluate(data: Dataset, asOf: Date, config: Config = DEFAULT_CONFIG): Evaluation {
  const ratingsBySeg = groupBy(data.ratings, (r) => r.segmentId);
  const eventsBySeg = groupBy(data.events, (e) => e.segmentId);
  const votesByIssue = groupBy(data.votes, (v) => v.issueId);

  const issues: IssueState[] = data.issues
    .filter((i) => i.createdAt <= asOf)
    .map((issue) => ({ issue, derived: deriveIssue(issue, votesByIssue.get(issue.id) ?? [], asOf, config) }));

  const openBySeg = new Map<number, { pozo: number; parche: number; weight: number }>();
  for (const { issue, derived } of issues) {
    if (!derived.verified || derived.status !== "abierto") continue;
    const acc = openBySeg.get(issue.segmentId) ?? { pozo: 0, parche: 0, weight: 0 };
    acc[issue.kind]++;
    acc.weight += config.severityWeights[issue.severity];
    openBySeg.set(issue.segmentId, acc);
  }

  const segments = data.segments.map((base) => {
    const events = eventsBySeg.get(base.id) ?? [];
    const segment = !base.isCobbled && isCobbledByVotes(events, asOf) ? { ...base, isCobbled: true } : base;
    const c = computeCondition(ratingsBySeg.get(segment.id) ?? [], events, asOf, config);
    const open = openBySeg.get(segment.id) ?? { pozo: 0, parche: 0, weight: 0 };
    return {
      segment,
      condition: c.condition,
      patching: c.patching,
      repavedAt: c.repavedAt,
      ratingCount: c.ratingCount,
      openPozos: open.pozo,
      openParches: open.parche,
      issueScore: Math.round((open.weight / (segment.lengthM / 100)) * 100) / 100,
    };
  });
  return { asOf, segments, issues };
}

export interface OldestIssue {
  id: string;
  label: string;
  days: number;
}

export interface Kpis {
  asOf: string;
  scope: { zoneId: number | null };
  km: Record<Condition, number>;
  cuadras: Record<Condition, number>;
  pct: Record<Condition, number>;
  kmAsphalt: number;
  kmTotal: number;
  kmCobbled: number;
  cuadrasAsphalt: number;
  pctCobbled: number;
  pctSurveyed: number;
  pctTodoParche: number;
  contributions: number;
  issues: {
    openPozos: number;
    openParches: number;
    pozosPerKm: number;
    parchesPerKm: number;
    newPozos30d: number;
    resolvedPozos30d: number;
    avgRepairDays: number | null;
    medianRepairDays: number | null;
    oldestOpen: OldestIssue | null;
    badFixRatePct: number | null;
    badFixSample: number;
  };
}

const r1 = (x: number) => Math.round(x * 10) / 10;

export function computeKpis(ev: Evaluation, zoneId: number | null = null, config: Config = DEFAULT_CONFIG): Kpis {
  const inScope = (segId: number, zid: number) => zoneId === null || zid === zoneId;
  const segs = ev.segments.filter((s) => inScope(s.segment.id, s.segment.zoneId));
  const segById = new Map(ev.segments.map((s) => [s.segment.id, s]));
  const issues = ev.issues.filter((i) => {
    const s = segById.get(i.issue.segmentId);
    return s && inScope(s.segment.id, s.segment.zoneId);
  });

  const km = zeros();
  const cuadras = zeros();
  let kmCobbled = 0;
  let kmTotal = 0;
  let kmTodoParche = 0;
  for (const s of segs) {
    const k = s.segment.lengthM / 1000;
    kmTotal += k;
    if (s.segment.isCobbled) {
      kmCobbled += k;
      continue;
    }
    km[s.condition] += k;
    cuadras[s.condition]++;
    if (s.patching === "todo_parche") kmTodoParche += k;
  }
  const kmAsphalt = kmTotal - kmCobbled;
  const cuadrasAsphalt = CONDITIONS.reduce((a, c) => a + cuadras[c], 0);
  const pct = zeros();
  for (const c of CONDITIONS) pct[c] = kmAsphalt ? r1((km[c] / kmAsphalt) * 100) : 0;

  const now = ev.asOf.getTime();
  const last30 = now - 30 * DAY_MS;
  const repairSince = now - config.repairWindowDays * DAY_MS;
  const verified = issues.filter((i) => i.derived.verified && i.derived.status !== "oculto");
  const open = verified.filter((i) => i.derived.status === "abierto");
  const openPozos = open.filter((i) => i.issue.kind === "pozo");
  const openParches = open.filter((i) => i.issue.kind === "parche");

  const pozos = verified.filter((i) => i.issue.kind === "pozo");
  const resolvedRecent = pozos.filter((i) => i.derived.resolvedAt && i.derived.resolvedAt.getTime() >= last30);
  const repairDays = pozos
    .filter((i) => i.derived.resolvedAt && i.derived.resolvedAt.getTime() >= repairSince)
    .map((i) => (i.derived.resolvedAt!.getTime() - i.issue.createdAt.getTime()) / DAY_MS)
    .sort((a, b) => a - b);
  const withQuality = pozos.filter(
    (i) => i.derived.fixQuality && i.derived.resolvedAt && i.derived.resolvedAt.getTime() >= repairSince,
  );
  const bad = withQuality.filter((i) => i.derived.fixQuality === "parche_malo").length;

  let oldestOpen: OldestIssue | null = null;
  for (const i of openPozos) {
    const days = Math.floor((now - i.issue.createdAt.getTime()) / DAY_MS);
    if (!oldestOpen || days > oldestOpen.days) {
      const s = segById.get(i.issue.segmentId)!;
      oldestOpen = { id: i.issue.id, label: segmentLabel(s.segment), days };
    }
  }

  const contributions =
    segs.reduce((a, s) => a + s.ratingCount, 0) + issues.filter((i) => i.issue.state === "activo").length;

  return {
    asOf: ev.asOf.toISOString(),
    scope: { zoneId },
    km: mapValues(km, r1),
    cuadras,
    pct,
    kmAsphalt: r1(kmAsphalt),
    kmTotal: r1(kmTotal),
    kmCobbled: r1(kmCobbled),
    cuadrasAsphalt,
    pctCobbled: kmTotal ? r1((kmCobbled / kmTotal) * 100) : 0,
    pctSurveyed: kmAsphalt ? r1(((kmAsphalt - km.sin_relevar) / kmAsphalt) * 100) : 0,
    pctTodoParche: kmAsphalt ? r1((kmTodoParche / kmAsphalt) * 100) : 0,
    contributions,
    issues: {
      openPozos: openPozos.length,
      openParches: openParches.length,
      pozosPerKm: kmAsphalt ? r1(openPozos.length / kmAsphalt) : 0,
      parchesPerKm: kmAsphalt ? r1(openParches.length / kmAsphalt) : 0,
      newPozos30d: pozos.filter((i) => i.issue.createdAt.getTime() >= last30).length,
      resolvedPozos30d: resolvedRecent.length,
      avgRepairDays: repairDays.length ? Math.round(repairDays.reduce((a, b) => a + b, 0) / repairDays.length) : null,
      medianRepairDays: repairDays.length ? Math.round(repairDays[Math.floor(repairDays.length / 2)]) : null,
      oldestOpen,
      badFixRatePct: withQuality.length ? Math.round((bad / withQuality.length) * 100) : null,
      badFixSample: withQuality.length,
    },
  };
}

export interface ZoneRankingRow {
  zoneId: number;
  pctMuyDeteriorada: number;
  pozosPerKm: number;
  pctSurveyed: number;
  eligible: boolean;
}

export function rankZones(ev: Evaluation, zoneIds: number[], config: Config = DEFAULT_CONFIG): ZoneRankingRow[] {
  return zoneIds.map((zoneId) => {
    const k = computeKpis(ev, zoneId, config);
    return {
      zoneId,
      pctMuyDeteriorada: k.pct.muy_deteriorada,
      pozosPerKm: k.issues.pozosPerKm,
      pctSurveyed: k.pctSurveyed,
      eligible: k.pctSurveyed >= config.rankingMinSurveyedPct,
    };
  });
}

export interface MonthPoint {
  month: string; // "2026-03"
  pctMuyDeteriorada: number;
  pctNueva: number;
  pctSurveyed: number;
  newPozos: number;
  resolvedPozos: number;
}

/** Serie mensual (último día de cada mes) para los gráficos de evolución. */
export function monthlySeries(
  data: Dataset,
  asOf: Date,
  months = 12,
  zoneId: number | null = null,
  config: Config = DEFAULT_CONFIG,
): MonthPoint[] {
  const zoneOf = new Map(data.segments.map((s) => [s.id, s.zoneId]));
  const points: MonthPoint[] = [];
  for (let m = months - 1; m >= 0; m--) {
    const start = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - m, 1));
    const end = m === 0 ? asOf : new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - m + 1, 1) - 1);
    const ev = evaluate(data, end, config);
    const k = computeKpis(ev, zoneId, config);
    const pozos = ev.issues.filter(
      (i) =>
        i.issue.kind === "pozo" &&
        i.derived.verified &&
        (zoneId === null || zoneOf.get(i.issue.segmentId) === zoneId),
    );
    points.push({
      month: start.toISOString().slice(0, 7),
      pctMuyDeteriorada: k.pct.muy_deteriorada,
      pctNueva: k.pct.nueva,
      pctSurveyed: k.pctSurveyed,
      newPozos: pozos.filter((i) => i.issue.createdAt >= start).length,
      resolvedPozos: pozos.filter((i) => i.derived.resolvedAt && i.derived.resolvedAt >= start).length,
    });
  }
  return points;
}

function zeros(): Record<Condition, number> {
  return { nueva: 0, buena: 0, gastada: 0, muy_deteriorada: 0, sin_relevar: 0 };
}

function mapValues<T extends Record<string, number>>(o: T, f: (x: number) => number): T {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)])) as T;
}

function groupBy<T, K>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

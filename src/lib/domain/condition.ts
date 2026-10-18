// Estado del asfalto de una cuadra a partir de las calificaciones de los vecinos.
// Espejo en SQL: `recompute_segment_condition` en supabase/migrations.

import { DEFAULT_CONFIG, type Config } from "./config";
import type { Condition, Patching, Rating, SegmentEvent, SegmentRating } from "./types";

const DAY_MS = 86_400_000;
const RATING_ORDER: Rating[] = ["buena", "gastada", "muy_deteriorada"];
const PATCHING_ORDER: Patching[] = ["pocos", "bastantes", "todo_parche"];

export interface ConditionResult {
  condition: Condition;
  patching: Patching | null;
  repavedAt: Date | null;
  ratingCount: number;
}

/** Moda ponderada; ante empate gana la opción peor (la que está más a la derecha en `order`). */
function weightedMode<T extends string>(
  items: { value: T; weight: number }[],
  order: T[],
  minWeight: number,
): T | null {
  const totals = new Map<T, number>();
  for (const it of items) totals.set(it.value, (totals.get(it.value) ?? 0) + it.weight);
  let best: T | null = null;
  let bestW = 0;
  for (const value of order) {
    const w = totals.get(value) ?? 0;
    if (w > 0 && w >= bestW) {
      best = value;
      bestW = w;
    }
  }
  return bestW >= minWeight ? best : null;
}

export function computeCondition(
  ratings: SegmentRating[],
  events: SegmentEvent[],
  asOf: Date,
  config: Config = DEFAULT_CONFIG,
): ConditionResult {
  const since = asOf.getTime() - config.conditionWindowDays * DAY_MS;
  const inWindow = (d: Date) => d.getTime() >= since && d.getTime() <= asOf.getTime();

  const active = ratings.filter((r) => r.state === "activo" && inWindow(r.createdAt));
  const weight = (r: SegmentRating) => (r.onSite ? config.onSiteWeight : 1);

  const patching = weightedMode(
    active.filter((r) => r.patching).map((r) => ({ value: r.patching as Patching, weight: weight(r) })),
    PATCHING_ORDER,
    config.minRatingWeight,
  );

  // Repavimentación: confirmaciones distintas con fecha dentro de la ventana.
  const repaved = events.filter(
    (e) =>
      e.type === "repavimentada" &&
      e.state === "activo" &&
      e.createdAt.getTime() <= asOf.getTime() &&
      inWindow(e.approxDate ?? e.createdAt),
  );
  const repavedVoters = new Set(repaved.map((e) => e.voterHash));
  if (repavedVoters.size >= config.repavedConfirmations) {
    const dates = repaved.map((e) => (e.approxDate ?? e.createdAt).getTime()).sort((a, b) => a - b);
    // Mediana inferior, igual que percentile_disc(0.5) en SQL.
    const repavedAt = new Date(dates[Math.ceil(dates.length / 2) - 1]);
    // Las calificaciones anteriores a la repavimentación ya no describen la cuadra.
    return { condition: "nueva", patching: null, repavedAt, ratingCount: active.length };
  }

  const mode = weightedMode(
    active.map((r) => ({ value: r.rating, weight: weight(r) })),
    RATING_ORDER,
    config.minRatingWeight,
  );
  return { condition: mode ?? "sin_relevar", patching, repavedAt: null, ratingCount: active.length };
}

/** Empedrado: lo marca OSM o lo confirman al menos 2 dispositivos. */
export function isCobbledByVotes(events: SegmentEvent[], asOf: Date): boolean {
  const voters = new Set(
    events
      .filter((e) => e.type === "es_empedrado" && e.state === "activo" && e.createdAt <= asOf)
      .map((e) => e.voterHash),
  );
  return voters.size >= 2;
}

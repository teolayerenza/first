// Verificación, resolución y calidad del arreglo de un problema puntual (pozo o parche).
// Espejo en SQL: `recompute_issue` en supabase/migrations.

import { DEFAULT_CONFIG, type Config } from "./config";
import type { FixQuality, Issue, IssueDerived, IssueVote } from "./types";

export function deriveIssue(
  issue: Issue,
  votes: IssueVote[],
  asOf: Date,
  config: Config = DEFAULT_CONFIG,
): IssueDerived {
  const valid = votes
    .filter((v) => v.state === "activo" && v.createdAt <= asOf && v.voterHash !== issue.reporterHash)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const sigue = valid.filter((v) => v.vote === "sigue");
  const falso = new Set(valid.filter((v) => v.vote === "falso").map((v) => v.voterHash));
  // Sesiones nuevas suman, pero no alcanzan para verificar por sí solas. Un parche nacido de un
  // "arreglado → parche mal hecho" ya viene confirmado por quienes votaron el arreglo.
  const verified = issue.hasPhoto || issue.originIssueId !== null || sigue.some((v) => v.mature);

  if (issue.state !== "activo" || falso.size >= config.hideVotes) {
    return { verified, status: "oculto", resolvedAt: null, fixQuality: null, sigueVotes: sigue.length };
  }

  const fixed: IssueVote[] = [];
  const seen = new Set<string>();
  for (const v of valid) {
    if (v.vote === "arreglado" && !seen.has(v.voterHash)) {
      seen.add(v.voterHash);
      fixed.push(v);
    }
  }
  if (fixed.length >= config.resolveVotes) {
    const resolvedAt = fixed[config.resolveVotes - 1].createdAt;
    const bad = fixed.filter((v) => v.fixQuality === "parche_malo").length;
    const good = fixed.filter((v) => v.fixQuality === "bien").length;
    const fixQuality: FixQuality | null = bad + good === 0 ? null : bad >= good ? "parche_malo" : "bien";
    return { verified, status: "resuelto", resolvedAt, fixQuality, sigueVotes: sigue.length };
  }
  return { verified, status: "abierto", resolvedAt: null, fixQuality: null, sigueVotes: sigue.length };
}

/** Deduplicación: ¿hay un problema abierto del mismo tipo a menos de `radiusM`? */
export function findDuplicate<T extends { kind: string; distanceM: number }>(
  candidates: T[],
  kind: string,
  radiusM = DEFAULT_CONFIG.dedupeRadiusM,
): T | null {
  const near = candidates.filter((c) => c.kind === kind && c.distanceM <= radiusM);
  near.sort((a, b) => a.distanceM - b.distanceM);
  return near[0] ?? null;
}

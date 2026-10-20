// Convierte una evaluación del dominio en las estructuras públicas que consume la UI.
// Lo usa el modo demo; en modo Supabase las mismas formas salen de las vistas SQL.

import { segmentLabel } from "../domain/grid";
import { computeKpis, rankZones, type Evaluation, type Kpis } from "../domain/kpis";
import type { Contributor, Zone } from "../domain/types";
import type { ContributorsSummary, IssuesFC, SegmentDetail, SegmentsFC, ZoneRow } from "./types";

const DAY = 86_400_000;

export function segmentsFC(ev: Evaluation, zoneId: number | null = null): SegmentsFC {
  return {
    type: "FeatureCollection",
    features: ev.segments
      .filter((s) => zoneId === null || s.segment.zoneId === zoneId)
      .map((s) => ({
        type: "Feature",
        id: s.segment.id,
        geometry: { type: "LineString", coordinates: s.segment.coords },
        properties: {
          id: s.segment.id,
          label: segmentLabel(s.segment),
          zoneId: s.segment.zoneId,
          condition: s.condition,
          patching: s.patching,
          cobbled: s.segment.isCobbled,
          openPozos: s.openPozos,
          openParches: s.openParches,
          score: s.issueScore,
          lengthM: s.segment.lengthM,
        },
      })),
  };
}

export function issuesFC(ev: Evaluation, zoneId: number | null = null): IssuesFC {
  const zoneOf = new Map(ev.segments.map((s) => [s.segment.id, s.segment.zoneId]));
  const now = ev.asOf.getTime();
  return {
    type: "FeatureCollection",
    features: ev.issues
      .filter((i) => i.derived.status === "abierto")
      .filter((i) => zoneId === null || zoneOf.get(i.issue.segmentId) === zoneId)
      .map((i) => ({
        type: "Feature",
        id: i.issue.id,
        geometry: { type: "Point", coordinates: i.issue.location },
        properties: {
          id: i.issue.id,
          kind: i.issue.kind,
          parcheType: i.issue.parcheType,
          severity: i.issue.severity,
          verified: i.derived.verified,
          segmentId: i.issue.segmentId,
          days: Math.floor((now - i.issue.createdAt.getTime()) / DAY),
          sigueVotes: i.derived.sigueVotes,
          // Las fotos solo son públicas una vez verificado el problema (docs/SEGURIDAD.md §3).
          photoUrl: null,
          comment: i.issue.comment ?? null,
        },
      })),
  };
}

export function segmentDetail(ev: Evaluation, zones: Zone[], id: number): SegmentDetail | null {
  const s = ev.segments.find((x) => x.segment.id === id);
  if (!s) return null;
  const fc = segmentsFC({ ...ev, segments: [s] }).features[0].properties;
  const zone = zones.find((z) => z.id === s.segment.zoneId)!;
  const now = ev.asOf.getTime();
  return {
    ...fc,
    coords: s.segment.coords,
    ratingCount: s.ratingCount,
    repavedAt: s.repavedAt?.toISOString() ?? null,
    zone: { id: zone.id, slug: zone.slug, name: zone.name },
    issues: ev.issues
      .filter((i) => i.issue.segmentId === id && i.derived.status !== "oculto")
      .map((i) => ({
        id: i.issue.id,
        kind: i.issue.kind,
        parcheType: i.issue.parcheType,
        severity: i.issue.severity,
        verified: i.derived.verified,
        segmentId: id,
        days: Math.floor((now - i.issue.createdAt.getTime()) / DAY),
        sigueVotes: i.derived.sigueVotes,
        photoUrl: null,
        comment: i.issue.comment ?? null,
        location: i.issue.location,
        status: i.derived.status as "abierto" | "resuelto",
      }))
      .sort((a, b) => Number(a.status === "resuelto") - Number(b.status === "resuelto") || b.days - a.days),
  };
}

export function zoneRows(ev: Evaluation, zones: Zone[]): ZoneRow[] {
  const ranking = rankZones(
    ev,
    zones.map((z) => z.id),
  );
  return zones.map((z) => ({ id: z.id, slug: z.slug, name: z.name, ...ranking.find((r) => r.zoneId === z.id)! }));
}

export function contributorsSummary(contributors: Contributor[], asOf: Date): ContributorsSummary {
  const since = asOf.getTime() - 7 * DAY;
  const upTo = contributors.filter((c) => c.firstAt <= asOf);
  return {
    total: upTo.length,
    new7d: upTo.filter((c) => c.firstAt.getTime() >= since).length,
    ratedOnSite: upTo.filter((c) => c.ratedOnSite).length,
    reportedIssue: upTo.filter((c) => c.reportedIssue).length,
  };
}

export function oldestOpen(ev: Evaluation, zoneId: number | null, n = 5) {
  const segs = new Map(ev.segments.map((s) => [s.segment.id, s.segment]));
  const now = ev.asOf.getTime();
  return ev.issues
    .filter((i) => i.derived.verified && i.derived.status === "abierto")
    .filter((i) => zoneId === null || segs.get(i.issue.segmentId)?.zoneId === zoneId)
    .map((i) => ({
      id: i.issue.id,
      kind: i.issue.kind,
      label: segmentLabel(segs.get(i.issue.segmentId)!),
      days: Math.floor((now - i.issue.createdAt.getTime()) / DAY),
    }))
    .sort((a, b) => b.days - a.days)
    .slice(0, n);
}

export function kpisFor(ev: Evaluation, zoneId: number | null): Kpis {
  return computeKpis(ev, zoneId);
}

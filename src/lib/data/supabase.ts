// Modo producción: lee las vistas públicas de Supabase con la clave anónima (solo lectura).

import "server-only";
import { createClient } from "@supabase/supabase-js";
import { midpoint } from "../domain/geo";
import type { Kpis, MonthPoint } from "../domain/kpis";
import type { Condition, LngLat, Patching, Zone } from "../domain/types";
import type { Dashboard, DataSource, IssuesFC, SegmentDetail, SegmentsFC, ZoneRow } from "./types";

const client = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });

const photoUrl = (path: string | null) =>
  path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${path}` : null;

async function must(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<unknown> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}

interface SegmentRow {
  id: number;
  label: string;
  street_name: string;
  between_a: string;
  between_b: string;
  zone_id: number;
  condition: Condition;
  patching: Patching | null;
  cobbled: boolean;
  open_pozos: number;
  open_parches: number;
  score: number;
  length_m: number;
  rating_count: number;
  repaved_at: string | null;
  geometry: { type: "LineString"; coordinates: LngLat[] };
}

interface IssueRow {
  id: string;
  kind: "pozo" | "parche";
  parche_type: "elevado" | "hundido" | "desarmado" | null;
  severity: 1 | 2 | 3;
  verified: boolean;
  segment_id: number;
  status: "abierto" | "resuelto";
  sigue_votes: number;
  days: number;
  lng: number;
  lat: number;
  photo_path: string | null;
}

const toSegmentFeature = (r: SegmentRow): SegmentsFC["features"][number] => ({
  type: "Feature",
  id: r.id,
  geometry: r.geometry,
  properties: {
    id: r.id,
    label: r.label,
    zoneId: r.zone_id,
    condition: r.condition,
    patching: r.patching,
    cobbled: r.cobbled,
    openPozos: r.open_pozos,
    openParches: r.open_parches,
    score: r.score,
    lengthM: r.length_m,
  },
});

const toIssueProps = (r: IssueRow) => ({
  id: r.id,
  kind: r.kind,
  parcheType: r.parche_type,
  severity: r.severity,
  verified: r.verified,
  segmentId: r.segment_id,
  days: r.days,
  sigueVotes: r.sigue_votes,
  photoUrl: photoUrl(r.photo_path),
});

/** Supabase devuelve como mucho 1000 filas por pedido: se pagina. */
async function all<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const page = (await must(build(from, from + 999))) as T[];
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

export const supabaseSource: DataSource = {
  mode: "supabase",

  async getDashboard(zoneId = null): Promise<Dashboard> {
    const sb = client();
    const z = zoneId ?? 0;
    const [kpis, prev, series, zoneKpis, zones, contributors, moderation, oldest] = await Promise.all([
      must(sb.from("v_kpis").select("kpis").eq("zone_id", z).single()),
      must(sb.from("v_kpis_previous").select("kpis").eq("zone_id", z).maybeSingle()),
      must(sb.from("v_series").select("series").eq("zone_id", z).single()),
      must(sb.from("v_kpis").select("zone_id, kpis").neq("zone_id", 0)),
      must(sb.from("v_zones").select("id, slug, name")),
      must(sb.from("v_contributors").select("*").single()),
      must(sb.from("v_moderation_log").select("*")),
      must(
        sb
          .from("v_issues")
          .select("id, kind, days, segment_id")
          .eq("status", "abierto")
          .eq("verified", true)
          .order("days", { ascending: false })
          .limit(zoneId ? 200 : 5),
      ),
    ]);
    const minSurveyed = 20;
    const zoneRows: ZoneRow[] = (zones as { id: number; slug: string; name: string }[]).map((zn) => {
      const k = (zoneKpis as { zone_id: number; kpis: Kpis }[]).find((x) => x.zone_id === zn.id)!.kpis;
      return {
        ...zn,
        pctMuyDeteriorada: k.pct.muy_deteriorada,
        pozosPerKm: k.issues.pozosPerKm,
        pctSurveyed: k.pctSurveyed,
        eligible: k.pctSurveyed >= minSurveyed,
      };
    });
    const segIds = (oldest as { segment_id: number }[]).map((o) => o.segment_id);
    const labels = segIds.length
      ? await must(sb.from("v_segments").select("id, label, zone_id").in("id", segIds))
      : [];
    const labelOf = new Map((labels as { id: number; label: string; zone_id: number }[]).map((l) => [l.id, l]));
    const c = contributors as { total: number; new_7d: number; rated_on_site: number; reported_issue: number };
    return {
      kpis: (kpis as { kpis: Kpis }).kpis,
      previous: (prev as { kpis: Kpis } | null)?.kpis ?? null,
      series: (series as { series: MonthPoint[] }).series,
      zones: zoneRows,
      contributors: { total: c.total, new7d: c.new_7d, ratedOnSite: c.rated_on_site, reportedIssue: c.reported_issue },
      oldestOpenIssues: (oldest as { id: string; kind: "pozo" | "parche"; days: number; segment_id: number }[])
        .filter((o) => !zoneId || labelOf.get(o.segment_id)?.zone_id === zoneId)
        .slice(0, 5)
        .map((o) => ({ id: o.id, kind: o.kind, days: o.days, label: labelOf.get(o.segment_id)?.label ?? "" })),
      moderation: moderation as Dashboard["moderation"],
      mode: "supabase",
    };
  },

  async getZones(): Promise<Zone[]> {
    const rows = await must(client().from("v_zones").select("id, slug, name, geometry"));
    return (rows as { id: number; slug: string; name: string; geometry: { coordinates: LngLat[][] } }[]).map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      ring: r.geometry.coordinates[0],
    }));
  },

  async getSegments(zoneId = null): Promise<SegmentsFC> {
    const sb = client();
    const rows = await all<SegmentRow>((from, to) => {
      let q = sb.from("v_segments").select("*").order("id").range(from, to);
      if (zoneId) q = q.eq("zone_id", zoneId);
      return q;
    });
    return { type: "FeatureCollection", features: rows.map(toSegmentFeature) };
  },

  async getIssues(zoneId = null): Promise<IssuesFC> {
    const sb = client();
    let segIds: number[] | null = null;
    if (zoneId) {
      const segs = await all<{ id: number }>((from, to) => sb.from("v_segments").select("id").eq("zone_id", zoneId).range(from, to));
      segIds = segs.map((s) => s.id);
    }
    const rows = await all<IssueRow>((from, to) => {
      let q = sb.from("v_issues").select("*").eq("status", "abierto").order("id").range(from, to);
      if (segIds) q = q.in("segment_id", segIds);
      return q;
    });
    return {
      type: "FeatureCollection",
      features: rows.map((r) => ({
        type: "Feature",
        id: r.id,
        geometry: { type: "Point", coordinates: [r.lng, r.lat] },
        properties: toIssueProps(r),
      })),
    };
  },

  async getSegment(id): Promise<SegmentDetail | null> {
    const sb = client();
    const row = (await must(sb.from("v_segments").select("*").eq("id", id).maybeSingle())) as SegmentRow | null;
    if (!row) return null;
    const [zone, issues] = await Promise.all([
      must(sb.from("v_zones").select("id, slug, name").eq("id", row.zone_id).single()),
      must(sb.from("v_issues").select("*").eq("segment_id", id)),
    ]);
    return {
      ...toSegmentFeature(row).properties,
      coords: row.geometry.coordinates,
      ratingCount: row.rating_count,
      repavedAt: row.repaved_at,
      zone: zone as { id: number; slug: string; name: string },
      issues: (issues as IssueRow[])
        .map((r) => ({ ...toIssueProps(r), location: [r.lng, r.lat] as LngLat, status: r.status }))
        .sort((a, b) => Number(a.status === "resuelto") - Number(b.status === "resuelto") || b.days - a.days),
    };
  },

  async getCasco() {
    const row = (await must(client().from("v_casco").select("geometry").single())) as {
      geometry: { coordinates: LngLat[][] };
    };
    return row.geometry.coordinates[0];
  },

  async nearestSegment([lng, lat]) {
    const rows = (await must(client().rpc("public_nearest_segment", { p_lng: lng, p_lat: lat }))) as
      { id: number; label: string; condition: Condition; distance_m: number }[];
    const r = rows[0];
    return r ? { id: r.id, label: r.label, condition: r.condition, distanceM: r.distance_m } : null;
  },

  async adjacentSegments(id) {
    return (await must(client().rpc("public_adjacent_segments", { p_id: id }))) as { id: number; label: string; condition: Condition }[];
  },

  async getStreetIndex() {
    const sb = client();
    const rows = await all<{ id: number; street_name: string; between_a: string; between_b: string; geometry: { coordinates: LngLat[] } }>((from, to) =>
      sb.from("v_segments").select("id, street_name, between_a, between_b, geometry").order("id").range(from, to),
    );
    return rows.map((r) => ({ id: r.id, street: r.street_name, a: r.between_a, b: r.between_b, mid: midpoint(r.geometry.coordinates) }));
  },
};

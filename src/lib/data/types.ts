import type { Kpis, MonthPoint } from "../domain/kpis";
import type { Condition, IssueKind, LngLat, ParcheType, Patching, Severity, Zone } from "../domain/types";

export interface ContributorsSummary {
  total: number;
  new7d: number;
  ratedOnSite: number;
  reportedIssue: number;
}

export interface ZoneRow {
  id: number;
  slug: string;
  name: string;
  pctMuyDeteriorada: number;
  pozosPerKm: number;
  pctSurveyed: number;
  eligible: boolean;
}

export interface ModerationEntry {
  at: string;
  action: string;
  count: number;
  area: string;
  reason: string;
}

export interface Dashboard {
  kpis: Kpis;
  /** KPIs de hace 30 días, para la variación mensual. */
  previous: Kpis | null;
  series: MonthPoint[];
  zones: ZoneRow[];
  contributors: ContributorsSummary;
  oldestOpenIssues: { id: string; label: string; days: number; kind: IssueKind }[];
  moderation: ModerationEntry[];
  mode: "demo" | "supabase";
}

export interface SegmentFeatureProps {
  id: number;
  label: string;
  zoneId: number;
  condition: Condition;
  patching: Patching | null;
  cobbled: boolean;
  openPozos: number;
  openParches: number;
  score: number;
  lengthM: number;
}

export interface IssueFeatureProps {
  id: string;
  kind: IssueKind;
  parcheType: ParcheType | null;
  severity: Severity;
  verified: boolean;
  segmentId: number;
  days: number;
  sigueVotes: number;
  photoUrl: string | null;
  comment: string | null;
}

export interface Feature<G, P> {
  type: "Feature";
  id?: number | string;
  geometry: G;
  properties: P;
}
export interface FeatureCollection<G, P> {
  type: "FeatureCollection";
  features: Feature<G, P>[];
}

export type SegmentsFC = FeatureCollection<{ type: "LineString"; coordinates: LngLat[] }, SegmentFeatureProps>;
export type IssuesFC = FeatureCollection<{ type: "Point"; coordinates: LngLat }, IssueFeatureProps>;

export interface SegmentDetail extends SegmentFeatureProps {
  coords: LngLat[];
  ratingCount: number;
  repavedAt: string | null;
  zone: { id: number; slug: string; name: string };
  issues: (IssueFeatureProps & { location: LngLat; status: "abierto" | "resuelto" })[];
}

export interface StreetIndexEntry {
  id: number;
  street: string;
  a: string;
  b: string;
  mid: LngLat;
}

export interface SegmentRef {
  id: number;
  label: string;
  condition: Condition;
  distanceM?: number;
}

export interface DataSource {
  mode: "demo" | "supabase";
  getDashboard(zoneId?: number | null): Promise<Dashboard>;
  getZones(): Promise<Zone[]>;
  getSegments(zoneId?: number | null): Promise<SegmentsFC>;
  getIssues(zoneId?: number | null): Promise<IssuesFC>;
  getSegment(id: number): Promise<SegmentDetail | null>;
  getCasco(): Promise<LngLat[]>;
  nearestSegment(p: LngLat): Promise<SegmentRef | null>;
  adjacentSegments(id: number): Promise<SegmentRef[]>;
  /** Para el selector "Calle __ entre __ y __". */
  getStreetIndex(): Promise<StreetIndexEntry[]>;
  /** Solo los nombres de esas cuadras (sin geometría): para listas como /problemas. */
  getSegmentLabels(ids: number[]): Promise<Record<number, string>>;
}

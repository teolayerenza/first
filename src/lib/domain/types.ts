// Tipos del dominio compartidos por el cliente, el modo demo y la Edge Function.

export type LngLat = [number, number];

export type Condition = "nueva" | "buena" | "gastada" | "muy_deteriorada" | "sin_relevar";
export type Rating = "buena" | "gastada" | "muy_deteriorada";
export type Patching = "ninguno" | "pocos" | "bastantes" | "todo_parche";
export type IssueKind = "pozo" | "parche";
export type ParcheType = "elevado" | "hundido" | "desarmado";
export type Severity = 1 | 2 | 3;
export type IssueStatus = "abierto" | "resuelto" | "oculto";
export type VoteKind = "sigue" | "arreglado" | "falso";
export type FixQuality = "bien" | "parche_malo";
export type SegmentEventType = "repavimentada" | "es_empedrado";

/** Estado de moderación de cualquier aporte. Solo `activo` cuenta en los KPIs. */
export type ContributionState = "pendiente" | "activo" | "en_revision" | "oculto";

export interface Zone {
  id: number;
  slug: string; // "7-13-44-51"
  name: string; // "7–13 / 44–51"
  ring: LngLat[];
}

export interface Segment {
  id: number;
  streetName: string; // "Calle 7", "Av. 7"
  betweenA: string;
  betweenB: string;
  isAvenue: boolean;
  isCobbled: boolean;
  zoneId: number;
  coords: LngLat[];
  lengthM: number;
}

export interface SegmentRating {
  segmentId: number;
  voterHash: string;
  rating: Rating;
  patching: Patching | null;
  onSite: boolean;
  createdAt: Date;
  state: ContributionState;
}

export interface SegmentEvent {
  segmentId: number;
  voterHash: string;
  type: SegmentEventType;
  approxDate: Date | null;
  createdAt: Date;
  state: ContributionState;
}

export interface Issue {
  id: string;
  reporterHash: string;
  kind: IssueKind;
  parcheType: ParcheType | null;
  originIssueId: string | null;
  severity: Severity;
  location: LngLat;
  segmentId: number;
  hasPhoto: boolean;
  photoApproved: boolean;
  /** Comentario libre del vecino, ya limpio (submit.ts → cleanComment). Público. */
  comment?: string | null;
  createdAt: Date;
  state: ContributionState;
}

export interface IssueVote {
  issueId: string;
  voterHash: string;
  vote: VoteKind;
  fixQuality: FixQuality | null;
  /** La sesión del votante tenía ≥ 24 h al votar (sesiones nuevas no verifican solas). */
  mature: boolean;
  createdAt: Date;
  state: ContributionState;
}

/** Estado derivado de un problema, calculado a partir del reporte y sus votos. */
export interface IssueDerived {
  verified: boolean;
  status: IssueStatus;
  resolvedAt: Date | null;
  fixQuality: FixQuality | null;
  sigueVotes: number;
}

export interface Contributor {
  deviceHash: string;
  firstMonth: Date;
  firstAt: Date;
  rated: boolean;
  ratedOnSite: boolean;
  reportedIssue: boolean;
}

export interface Dataset {
  zones: Zone[];
  segments: Segment[];
  ratings: SegmentRating[];
  events: SegmentEvent[];
  issues: Issue[];
  votes: IssueVote[];
  contributors: Contributor[];
}

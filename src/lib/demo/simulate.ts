// Datos SIMULADOS para el modo demo: sirven para diseñar el tablero antes de tener vecinos reales.
// Determinísticos (misma semilla → mismos datos) y siempre fechados relativos a `now`.

import { buildSegments, buildZones } from "../domain/grid";
import { haversineM, midpoint } from "../domain/geo";
import type {
  Contributor,
  Dataset,
  FixQuality,
  Issue,
  IssueVote,
  LngLat,
  Patching,
  Rating,
  Segment,
  SegmentEvent,
  SegmentRating,
  Severity,
} from "../domain/types";

const DAY = 86_400_000;
const CENTER: LngLat = [-57.9545, -34.9214];

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function simulate(now: Date, seed = 221): Dataset {
  const rnd = mulberry32(seed);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
  const zones = buildZones();
  const segments = buildSegments();
  const nowMs = now.getTime();
  const daysAgo = (d: number) => new Date(nowMs - d * DAY - Math.floor(rnd() * DAY));

  // Empedrado: manchas alrededor de algunos puntos, nunca en avenidas.
  const cobbleSeeds = Array.from({ length: 22 }, () => midpoint(pick(segments).coords));
  for (const s of segments) {
    if (s.isAvenue) continue;
    const m = midpoint(s.coords);
    if (cobbleSeeds.some((c) => haversineM(c, m) < 260) && rnd() < 0.65) s.isCobbled = true;
  }

  // "Calidad latente" de cada cuadra (0 = impecable, 1 = destruida): peor hacia la periferia,
  // con ruido por zona y por cuadra. Las avenidas están algo mejor.
  const zoneNoise = new Map(zones.map((z) => [z.id, rnd() * 0.35 - 0.1]));
  const latent = new Map<number, number>();
  for (const s of segments) {
    const dist = haversineM(CENTER, midpoint(s.coords)) / 3600;
    const q = 0.18 + dist * 0.45 + (zoneNoise.get(s.zoneId) ?? 0) + (rnd() - 0.5) * 0.45 - (s.isAvenue ? 0.18 : 0);
    latent.set(s.id, Math.max(0, Math.min(1, q)));
  }

  // Dispositivos: pocos aportan mucho, muchos aportan poco.
  const DEVICES = 3600;
  const deviceFirst = new Map<number, Date>();
  const deviceFlags = new Map<number, { rated: boolean; onSite: boolean; issue: boolean }>();
  const device = () => Math.floor(DEVICES * rnd() ** 1.6);
  const touch = (d: number, at: Date, kind: "rated" | "onSite" | "issue") => {
    const prev = deviceFirst.get(d);
    if (!prev || at < prev) deviceFirst.set(d, at);
    const f = deviceFlags.get(d) ?? { rated: false, onSite: false, issue: false };
    f[kind] = true;
    deviceFlags.set(d, f);
  };

  const ratings: SegmentRating[] = [];
  const events: SegmentEvent[] = [];
  const issues: Issue[] = [];
  const votes: IssueVote[] = [];

  const ratingFor = (q: number): Rating => (q < 0.33 ? "buena" : q < 0.62 ? "gastada" : "muy_deteriorada");
  const noisy = (r: Rating): Rating => {
    if (rnd() > 0.2) return r;
    const order: Rating[] = ["buena", "gastada", "muy_deteriorada"];
    const i = order.indexOf(r) + (rnd() < 0.5 ? -1 : 1);
    return order[Math.max(0, Math.min(2, i))];
  };
  const patchingFor = (r: Rating): Patching =>
    r === "muy_deteriorada" ? (rnd() < 0.55 ? "todo_parche" : "bastantes") : r === "gastada" ? (rnd() < 0.5 ? "bastantes" : "pocos") : "pocos";

  for (const s of segments) {
    const q = latent.get(s.id)!;
    const surveyed = rnd() < 0.5 + (1 - Math.min(1, haversineM(CENTER, midpoint(s.coords)) / 3800)) * 0.3;
    if (!surveyed) continue;

    // Repavimentación reciente.
    if (!s.isCobbled && rnd() < 0.055) {
      const when = 20 + rnd() * 320;
      const confirmations = 2 + Math.floor(rnd() * 2);
      const approx = new Date(nowMs - when * DAY);
      const approxDate = new Date(Date.UTC(approx.getUTCFullYear(), approx.getUTCMonth(), approx.getUTCDate()));
      const used = new Set<number>();
      for (let k = 0; k < confirmations; k++) {
        const d = device();
        if (used.has(d)) continue;
        used.add(d);
        const at = daysAgo(Math.max(1, when - 5 - rnd() * 20));
        events.push({ segmentId: s.id, voterHash: `d${d}|segment:${s.id}`, type: "repavimentada", approxDate, createdAt: at, state: "activo" });
        touch(d, at, "rated");
      }
      latent.set(s.id, 0.05);
      continue;
    }

    const truth = ratingFor(q);
    const n = 1 + Math.floor(rnd() * 4);
    const used = new Set<number>();
    for (let k = 0; k < n; k++) {
      const d = device();
      if (used.has(d)) continue;
      used.add(d);
      const at = daysAgo(rnd() * 380);
      const onSite = rnd() < 0.45;
      const r = noisy(truth);
      ratings.push({
        segmentId: s.id,
        voterHash: `d${d}|segment:${s.id}`,
        rating: r,
        patching: rnd() < 0.6 ? patchingFor(r) : null,
        onSite,
        createdAt: at,
        state: "activo",
      });
      touch(d, at, onSite ? "onSite" : "rated");
      if (onSite) touch(d, at, "rated");
    }
  }

  let issueSeq = 0;
  const newId = () => {
    issueSeq++;
    const hex = issueSeq.toString(16).padStart(12, "0");
    return `00000000-0000-4000-8000-${hex}`;
  };
  const pointOn = (s: Segment): LngLat => {
    const [a, b] = [s.coords[0], s.coords[s.coords.length - 1]];
    const t = 0.1 + rnd() * 0.8;
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  };
  const severity = (): Severity => (rnd() < 0.45 ? 1 : rnd() < 0.7 ? 2 : 3);

  const voted = new Set<string>();
  const addVote = (issueId: string, vote: IssueVote["vote"], when: Date, fixQuality: FixQuality | null = null) => {
    const at = new Date(Math.min(when.getTime(), nowMs - 60_000));
    const d = device();
    // Un voto por dispositivo y problema (es la clave primaria en SQL).
    if (voted.has(`${d}|${issueId}`)) return;
    voted.add(`${d}|${issueId}`);
    votes.push({ issueId, voterHash: `d${d}|issue:${issueId}`, vote, fixQuality, mature: rnd() < 0.85, createdAt: at, state: "activo" });
    touch(d, at, "issue");
  };

  for (const s of segments) {
    const q = latent.get(s.id)!;
    const expected = s.isCobbled ? q * 0.5 : q * q * 2.6;
    let count = 0;
    while (rnd() < expected / (count + 1.4) && count < 8) count++;
    for (let k = 0; k < count; k++) {
      const id = newId();
      const ageDays = rnd() * 430;
      const createdAt = daysAgo(ageDays);
      const reporter = device();
      const isParche = rnd() < 0.18;
      const location = pointOn(s);
      issues.push({
        id,
        reporterHash: `d${reporter}|issue:${id}`,
        kind: isParche ? "parche" : "pozo",
        parcheType: isParche ? pick(["elevado", "hundido", "desarmado"] as const) : null,
        originIssueId: null,
        severity: severity(),
        location,
        segmentId: s.id,
        hasPhoto: rnd() < 0.42,
        photoApproved: true,
        createdAt,
        state: rnd() < 0.02 ? "oculto" : "activo",
      });
      touch(reporter, createdAt, "issue");

      const sigue = Math.floor(rnd() * 3);
      for (let v = 0; v < sigue; v++) addVote(id, "sigue", new Date(createdAt.getTime() + rnd() * ageDays * DAY * 0.8));

      // Algunos se arreglan... y algunos arreglos quedan como un lomo de burro.
      if (!isParche && rnd() < 0.42) {
        const repairDays = Math.min(ageDays * 0.95, 8 + -Math.log(1 - rnd()) * 55);
        if (repairDays < ageDays) {
          const fixedAt = new Date(createdAt.getTime() + repairDays * DAY);
          const quality: FixQuality = rnd() < 0.36 ? "parche_malo" : "bien";
          const secondAt = new Date(Math.min(fixedAt.getTime() + rnd() * 4 * DAY, nowMs - 60_000));
          addVote(id, "arreglado", fixedAt, quality);
          addVote(id, "arreglado", secondAt, rnd() < 0.85 ? quality : null);
          if (quality === "parche_malo") {
            // Igual que el trigger SQL: el parche nace en el momento en que se resuelve el pozo.
            const pid = newId();
            const pAt = secondAt;
            {
              issues.push({
                id: pid,
                reporterHash: `d${reporter}|issue:${pid}`,
                kind: "parche",
                parcheType: "elevado",
                originIssueId: id,
                severity: 2,
                location,
                segmentId: s.id,
                hasPhoto: false,
                photoApproved: false,
                createdAt: pAt,
                state: "activo",
              });
              addVote(pid, "sigue", new Date(Math.min(nowMs - DAY, pAt.getTime() + rnd() * 30 * DAY)));
            }
          }
        }
      }
    }
  }

  const contributors: Contributor[] = [...deviceFirst.entries()].map(([d, firstAt]) => {
    const f = deviceFlags.get(d)!;
    return {
      deviceHash: `d${d}`,
      firstAt,
      firstMonth: new Date(Date.UTC(firstAt.getUTCFullYear(), firstAt.getUTCMonth(), 1)),
      rated: f.rated,
      ratedOnSite: f.onSite,
      reportedIssue: f.issue,
    };
  });

  return { zones, segments, ratings, events, issues, votes, contributors };
}

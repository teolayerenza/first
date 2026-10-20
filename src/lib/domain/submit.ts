// Pipeline del único punto de escritura. Lo usan la Edge Function `submit` (producción) y la ruta
// `/api/demo/submit` (modo demo), con dependencias distintas. Ver docs/SEGURIDAD.md §2.

import { DEFAULT_CONFIG, type Config } from "./config";
import { findDuplicate } from "./issues";
import { submitPayload, type IssuePayload, type RatingPayload, type VotePayload } from "./schemas";
import type { LngLat } from "./types";

export interface SubmitContext {
  /** ID aleatorio de la sesión anónima (del JWT). Nunca se guarda tal cual. */
  deviceId: string;
  sessionCreatedAt: Date;
  captchaToken: string | null;
}

export interface SubmitStore {
  insideCasco(p: LngLat): Promise<boolean>;
  snap(p: LngLat, maxDistanceM: number): Promise<{ segmentId: number; distanceM: number } | null>;
  segmentExists(id: number): Promise<boolean>;
  issueExists(id: string): Promise<boolean>;
  nearbyOpenIssues(p: LngLat, radiusM: number): Promise<{ id: string; kind: string; distanceM: number }[]>;
  /** Incrementa el contador y devuelve el valor nuevo. */
  bumpCounter(key: string): Promise<number>;
  insertRating(row: {
    segmentId: number;
    voterHash: string;
    contributorHash: string;
    rating: NonNullable<RatingPayload["rating"]>;
    patching: RatingPayload["patching"];
    onSite: boolean;
  }): Promise<void>;
  insertSegmentEvent(row: {
    segmentId: number;
    voterHash: string;
    contributorHash: string;
    type: "repavimentada" | "es_empedrado";
    approxDate: Date | null;
  }): Promise<void>;
  insertIssue(row: {
    id: string;
    reporterHash: string;
    contributorHash: string;
    kind: IssuePayload["issueKind"];
    parcheType: IssuePayload["parcheType"];
    severity: IssuePayload["severity"];
    location: LngLat;
    segmentId: number;
    photoPath: string | null;
    comment: string | null;
  }): Promise<void>;
  insertVote(row: {
    issueId: string;
    voterHash: string;
    contributorHash: string;
    vote: VotePayload["vote"];
    fixQuality: VotePayload["fixQuality"];
    mature: boolean;
  }): Promise<void>;
  createPhotoUpload(contentType: string): Promise<{ path: string; uploadUrl: string; token?: string }>;
  /** Publica al instante lo que quedó pendiente (mismo paso que el job: anomalías, contador, promoción). */
  publish?(): Promise<void>;
}

export interface SubmitDeps {
  verifyCaptcha(token: string | null): Promise<boolean>;
  /** HMAC-SHA256 con el secreto del servidor, en hex. El secreto nunca sale de la función. */
  hmac(message: string): Promise<string>;
  store: SubmitStore;
  now(): Date;
  config?: Config;
  newId?(): string;
}

export type SubmitResult =
  | { ok: true; kind: "rating"; segmentId: number }
  | { ok: true; kind: "issue"; issueId: string; segmentId: number }
  | { ok: true; kind: "vote"; issueId: string }
  | { ok: true; kind: "photo_upload"; path: string; uploadUrl: string; token?: string }
  | { ok: false; status: number; error: SubmitError; duplicateId?: string; details?: unknown };

export type SubmitError =
  | "invalid_payload"
  | "captcha_failed"
  | "rate_limited"
  | "outside_casco"
  | "no_street_nearby"
  | "not_found"
  | "duplicate";

const MS_HOUR = 3_600_000;

export async function handleSubmit(raw: unknown, ctx: SubmitContext, deps: SubmitDeps): Promise<SubmitResult> {
  const config = deps.config ?? DEFAULT_CONFIG;
  const parsed = submitPayload.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: "invalid_payload", details: parsed.error.issues };
  if (!(await deps.verifyCaptcha(ctx.captchaToken))) return { ok: false, status: 403, error: "captcha_failed" };

  const now = deps.now();
  const day = now.toISOString().slice(0, 10);
  const dayHash = await deps.hmac(`${ctx.deviceId}|day:${day}`);
  const contributorHash = await deps.hmac(`${ctx.deviceId}|contributor`);
  const mature = now.getTime() - ctx.sessionCreatedAt.getTime() >= 24 * MS_HOUR;
  const limited = async (bucket: string, limit: number) =>
    (await deps.store.bumpCounter(`${dayHash}:${bucket}`)) > limit;

  const p = parsed.data;
  switch (p.kind) {
    case "photo_upload": {
      if (await limited("photos", config.rateLimits.photosPerDay)) return rateLimited();
      const up = await deps.store.createPhotoUpload(p.contentType);
      return { ok: true, kind: "photo_upload", ...up };
    }

    case "rating": {
      if (!(await deps.store.segmentExists(p.segmentId))) return { ok: false, status: 404, error: "not_found" };
      if (await limited("ratings", config.rateLimits.ratingsPerDay)) return rateLimited();
      const voterHash = await deps.hmac(`${ctx.deviceId}|segment:${p.segmentId}`);
      if (p.rating) {
        await deps.store.insertRating({
          segmentId: p.segmentId,
          voterHash,
          contributorHash,
          rating: p.rating,
          patching: p.patching,
          onSite: p.onSite,
        });
      }
      if (p.repaved) {
        await deps.store.insertSegmentEvent({
          segmentId: p.segmentId,
          voterHash,
          contributorHash,
          type: "repavimentada",
          approxDate: repavedDate(now, p.repaved),
        });
      }
      if (p.cobbled) {
        await deps.store.insertSegmentEvent({
          segmentId: p.segmentId,
          voterHash,
          contributorHash,
          type: "es_empedrado",
          approxDate: null,
        });
      }
      await publish(deps);
      return { ok: true, kind: "rating", segmentId: p.segmentId };
    }

    case "issue": {
      if (!(await deps.store.insideCasco(p.location))) return { ok: false, status: 422, error: "outside_casco" };
      const snapped = await deps.store.snap(p.location, config.snapMaxDistanceM);
      if (!snapped) return { ok: false, status: 422, error: "no_street_nearby" };
      if (!p.forceNew) {
        const dup = findDuplicate(
          await deps.store.nearbyOpenIssues(p.location, config.dedupeRadiusM),
          p.issueKind,
          config.dedupeRadiusM,
        );
        if (dup) return { ok: false, status: 409, error: "duplicate", duplicateId: dup.id };
      }
      if (await limited("issues", config.rateLimits.issuesPerDay)) return rateLimited();
      // Límite por cuadra y por hora, para todos los dispositivos: frena inundaciones en un mismo lugar.
      const hourKey = `segment:${snapped.segmentId}:${now.toISOString().slice(0, 13)}`;
      if ((await deps.store.bumpCounter(hourKey)) > config.rateLimits.issuesPerSegmentPerHour) return rateLimited();

      const id = deps.newId ? deps.newId() : crypto.randomUUID();
      await deps.store.insertIssue({
        id,
        reporterHash: await deps.hmac(`${ctx.deviceId}|issue:${id}`),
        contributorHash,
        kind: p.issueKind,
        parcheType: p.parcheType,
        severity: p.severity,
        location: p.location,
        segmentId: snapped.segmentId,
        photoPath: p.photoPath,
        comment: cleanComment(p.comment),
      });
      await publish(deps);
      return { ok: true, kind: "issue", issueId: id, segmentId: snapped.segmentId };
    }

    case "vote": {
      if (!(await deps.store.issueExists(p.issueId))) return { ok: false, status: 404, error: "not_found" };
      if (await limited("ratings", config.rateLimits.ratingsPerDay)) return rateLimited();
      await deps.store.insertVote({
        issueId: p.issueId,
        // Mismo mensaje que el del reporte: si quien vota es quien reportó, los hashes coinciden.
        voterHash: await deps.hmac(`${ctx.deviceId}|issue:${p.issueId}`),
        contributorHash,
        vote: p.vote,
        fixQuality: p.fixQuality,
        mature,
      });
      await publish(deps);
      return { ok: true, kind: "vote", issueId: p.issueId };
    }
  }
}

/** El aporte ya quedó guardado: si publicar falla, lo publica el job del minuto siguiente. */
async function publish(deps: SubmitDeps) {
  try {
    await deps.store.publish?.();
  } catch {
    // Sin log del error: puede traer datos del aporte.
  }
}

function rateLimited(): SubmitResult {
  return { ok: false, status: 429, error: "rate_limited" };
}

function repavedDate(now: Date, when: NonNullable<RatingPayload["repaved"]>): Date {
  const daysAgo = when === "este_mes" ? 15 : when === "1_3_meses" ? 60 : 180;
  const d = new Date(now.getTime() - daysAgo * 24 * MS_HOUR);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export const ERROR_MESSAGES: Record<SubmitError, string> = {
  invalid_payload: "Los datos enviados no son válidos.",
  captcha_failed: "No pudimos verificar que seas una persona. Recargá la página y probá de nuevo.",
  rate_limited: "Llegaste al límite de aportes por hoy. ¡Gracias por sumar tanto!",
  outside_casco: "Por ahora Pocitos LP funciona solo dentro del casco urbano.",
  no_street_nearby: "No encontramos una calle cerca de ese punto. Acercá el pin a la calle.",
  not_found: "No encontramos esa cuadra o ese reporte.",
  duplicate: "Ya hay un reporte muy cerca de ese punto.",
};

/**
 * Comentario libre y público de un pozo o parche ("Hace meses que está así"). Antes de guardarlo se sacan
 * teléfonos, mails, links y @usuarios: no son datos que Pocitos LP quiera tener. Máximo 200 caracteres.
 */
export function cleanComment(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/https?:\/\/\S+|www\.\S+/gi, "")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "")
    .replace(/@\w+/g, "")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200)
    .trim();
  return text.length ? text : null;
}

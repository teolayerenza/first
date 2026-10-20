// Payloads que acepta el endpoint de escritura. Se validan en el cliente (UX) y en el servidor (seguridad).
// Enums, números y coordenadas. El único texto libre es el comentario opcional de un pozo o parche.

import { z } from "zod";

const lngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

export const ratingPayload = z.object({
  kind: z.literal("rating"),
  segmentId: z.number().int().positive(),
  rating: z.enum(["buena", "gastada", "muy_deteriorada"]),
  patching: z.enum(["pocos", "bastantes", "todo_parche"]).nullable().default(null),
  onSite: z.boolean().default(false),
  repaved: z.enum(["este_mes", "1_3_meses", "mas_3_meses"]).nullable().default(null),
  cobbled: z.boolean().default(false),
});

export const issuePayload = z
  .object({
    kind: z.literal("issue"),
    issueKind: z.enum(["pozo", "parche"]),
    parcheType: z.enum(["elevado", "hundido", "desarmado"]).nullable().default(null),
    severity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    location: lngLat,
    onSite: z.boolean().default(false),
    photoPath: z
      .string()
      .regex(/^pending\/[0-9a-f-]{36}\.(webp|jpg)$/)
      .nullable()
      .default(null),
    /** El vecino ya vio el "¿Es este?" y dijo que es otro. */
    forceNew: z.boolean().default(false),
    // Texto libre opcional; se limpia y se corta a 200 caracteres en submit.ts (cleanComment).
    comment: z.string().max(500).nullable().default(null),
  })
  .refine((p) => (p.issueKind === "parche") === (p.parcheType !== null), {
    message: "parcheType es obligatorio para parches y no aplica a pozos",
    path: ["parcheType"],
  });

export const votePayload = z
  .object({
    kind: z.literal("vote"),
    issueId: z.uuid(),
    vote: z.enum(["sigue", "arreglado", "falso"]),
    fixQuality: z.enum(["bien", "parche_malo"]).nullable().default(null),
  })
  .refine((p) => p.vote === "arreglado" || p.fixQuality === null, {
    message: "fixQuality solo aplica a 'arreglado'",
    path: ["fixQuality"],
  });

export const photoUploadPayload = z.object({
  kind: z.literal("photo_upload"),
  contentType: z.enum(["image/webp", "image/jpeg"]),
  bytes: z.number().int().positive().max(1_000_000),
});

export const submitPayload = z.union([ratingPayload, issuePayload, votePayload, photoUploadPayload]);

export type RatingPayload = z.infer<typeof ratingPayload>;
export type IssuePayload = z.infer<typeof issuePayload>;
export type VotePayload = z.infer<typeof votePayload>;
export type PhotoUploadPayload = z.infer<typeof photoUploadPayload>;
export type SubmitPayload = z.infer<typeof submitPayload>;
export type SubmitInput = z.input<typeof submitPayload>;

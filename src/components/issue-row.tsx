import Link from "next/link";
import { Glyph } from "@/components/forms/glyphs";
import type { IssueFeatureProps } from "@/lib/data/types";
import { relativeDays } from "@/lib/format";

/** Gravedad: mismos colores que al reportar (leve / medio / peligroso). */
export const SEVERITY = {
  1: { label: "Leve", field: "bg-gastada text-asphalt" },
  2: { label: "Medio", field: "bg-s2 text-asphalt" },
  3: { label: "Peligroso", field: "bg-muy text-white" },
} as const;

const PARCHE = { elevado: "elevado", hundido: "hundido", desarmado: "desarmado" } as const;

export function issueTitle(i: Pick<IssueFeatureProps, "kind" | "parcheType">): string {
  return i.kind === "parche" ? `Parche mal hecho${i.parcheType ? `: ${PARCHE[i.parcheType]}` : ""}` : "Pozo";
}

/** Una fila de la lista: gravedad en color, qué es, en qué cuadra. Se vota en la página del problema. */
export function IssueRow({ issue: i, label }: { issue: IssueFeatureProps; label?: string }) {
  const sev = SEVERITY[i.severity];
  return (
    <li>
      <Link href={`/pozo/${i.id}`} className="flex items-stretch bg-surface-2 hover:bg-line">
        <span className={`flex w-24 shrink-0 flex-col items-center justify-center gap-1 px-2 py-3 text-small font-semibold sm:w-28 ${sev.field}`}>
          <Glyph kind={i.kind === "parche" ? (i.parcheType ?? "parche") : "pozo"} className="h-6 w-11" />
          {sev.label}
        </span>
        <span className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3">
          <span className="min-w-0">
            <span className="block font-semibold text-ink">{issueTitle(i)}</span>
            {label && <span className="block text-ink">{label}</span>}
            <span className="block text-small text-ink-2">
              Reportado {relativeDays(i.days)}. {i.verified ? "Verificado." : "Pendiente de verificación."}
              {i.comment && " Tiene un comentario."}
            </span>
          </span>
          <span aria-hidden className="text-lead font-semibold text-ink">→</span>
        </span>
      </Link>
    </li>
  );
}

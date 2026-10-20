"use client";

import { useState } from "react";
import { TOOLTIP } from "@/components/tooltip";
import type { Kpis } from "@/lib/domain/kpis";
import { CONDITIONS } from "@/lib/domain/kpis";
import type { Condition } from "@/lib/domain/types";
import { CONDITION_BG, CONDITION_HINT, CONDITION_LABEL, fmt1, fmtInt, fmtPct } from "@/lib/format";

/** Tinta legible dentro de cada color de estado. */
const INSIDE: Record<Condition, string> = {
  nueva: "text-white",
  buena: "text-asphalt",
  gastada: "text-asphalt",
  muy_deteriorada: "text-white",
  sin_relevar: "text-ink",
};

/** Barra al 100% de los km de asfalto por estado. Gruesa, con el rótulo adentro cuando entra. */
export function ConditionBar({ kpis }: { kpis: Kpis }) {
  const [hover, setHover] = useState<Condition | null>(null);
  const segments = CONDITIONS.filter((c) => kpis.pct[c] > 0);

  return (
    <div className="viewer">
      <div className="relative">
        <div className="flex h-16 w-full gap-[2px] sm:h-20" role="img"
          aria-label={`Estado del asfalto: ${CONDITIONS.map((c) => `${CONDITION_LABEL[c]} ${fmtPct(kpis.pct[c])}`).join(", ")}`}>
          {segments.map((c) => (
            <div key={c} style={{ width: `${kpis.pct[c]}%` }}
              className={`swatch flex h-full items-end overflow-hidden p-2 transition-opacity sm:p-3 ${CONDITION_BG[c]} ${hover && hover !== c ? "opacity-50" : ""}`}
              onPointerEnter={() => setHover(c)} onPointerLeave={() => setHover(null)}>
              {kpis.pct[c] >= 9 && (
                <span className={`tabular whitespace-nowrap text-small font-semibold ${INSIDE[c]}`}>{fmtPct(kpis.pct[c])}</span>
              )}
            </div>
          ))}
        </div>
        {hover && (
          <div role="status" className={`${TOOLTIP} -top-3 left-1/2 -translate-x-1/2 -translate-y-full`}>
            <p className="font-semibold">{CONDITION_LABEL[hover]}: {fmtPct(kpis.pct[hover])}</p>
            <p className="tabular">{fmt1(kpis.km[hover])} km · {fmtInt(kpis.cuadras[hover])} cuadras</p>
            <p className="text-asphalt-ink-2">{CONDITION_HINT[hover]}</p>
          </div>
        )}
      </div>
      <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
        {CONDITIONS.map((c) => (
          <li key={c} className="flex items-start gap-3" onPointerEnter={() => setHover(c)} onPointerLeave={() => setHover(null)}>
            <span aria-hidden className={`swatch mt-1 h-4 w-4 shrink-0 ${CONDITION_BG[c]}`} />
            <span>
              <span className="block font-semibold">{CONDITION_LABEL[c]} <span className="tabular">{fmtPct(kpis.pct[c])}</span></span>
              <span className="tabular block text-small text-ink-2">{fmt1(kpis.km[c])} km · {fmtInt(kpis.cuadras[c])} cuadras</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { Kpis } from "@/lib/domain/kpis";
import { CONDITIONS } from "@/lib/domain/kpis";
import type { Condition } from "@/lib/domain/types";
import { CONDITION_BG, CONDITION_HINT, CONDITION_LABEL, fmt1, fmtInt, fmtPct } from "@/lib/format";

/** Barra apilada al 100% (km de asfalto por estado) + leyenda con km y cuadras. */
export function ConditionBar({ kpis }: { kpis: Kpis }) {
  const [hover, setHover] = useState<Condition | null>(null);
  const segments = CONDITIONS.filter((c) => kpis.pct[c] > 0);
  const active = hover ?? null;

  return (
    <div>
      <div className="relative">
        <div
          className="flex h-6 w-full gap-[2px] overflow-hidden rounded-[4px] bg-surface"
          role="img"
          aria-label={`Estado del asfalto: ${CONDITIONS.map((c) => `${CONDITION_LABEL[c]} ${fmtPct(kpis.pct[c])}`).join(", ")}`}
        >
          {segments.map((c) => (
            <div
              key={c}
              className={`swatch h-full transition-opacity ${CONDITION_BG[c]} ${active && active !== c ? "opacity-40" : ""}`}
              style={{ width: `${kpis.pct[c]}%` }}
              onPointerEnter={() => setHover(c)}
              onPointerLeave={() => setHover(null)}
            />
          ))}
        </div>
        {active && (
          <div
            role="status"
            className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-lg"
          >
            <p className="font-medium text-ink">{CONDITION_LABEL[active]} · {fmtPct(kpis.pct[active])}</p>
            <p className="tabular text-ink-2">
              {fmt1(kpis.km[active])} km · {fmtInt(kpis.cuadras[active])} cuadras
            </p>
            <p className="text-ink-3">{CONDITION_HINT[active]}</p>
          </div>
        )}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-5">
        {CONDITIONS.map((c) => (
          <li
            key={c}
            className="flex items-start gap-2"
            onPointerEnter={() => setHover(c)}
            onPointerLeave={() => setHover(null)}
          >
            <span aria-hidden className={`swatch mt-1 h-3 w-3 shrink-0 rounded-[3px] ${CONDITION_BG[c]}`} />
            <span>
              <span className="text-ink">{CONDITION_LABEL[c]}</span>{" "}
              <span className="tabular font-semibold text-ink">{fmtPct(kpis.pct[c])}</span>
              <span className="tabular block text-xs text-ink-3">
                {fmt1(kpis.km[c])} km · {fmtInt(kpis.cuadras[c])} cuadras
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import type { Dashboard } from "@/lib/data/types";
import { fmt1, fmtInt, fmtPct } from "@/lib/format";

type Tab = "deterioro" | "pozos" | "viejos";
const TABS: { id: Tab; label: string; note: string }[] = [
  { id: "deterioro", label: "Más deterioradas", note: "% de km muy deteriorados" },
  { id: "pozos", label: "Más pozos", note: "pozos abiertos por km" },
  { id: "viejos", label: "Pozos más viejos", note: "días sin arreglo" },
];

/** Ranking como agenda en franjas: pestañas a la izquierda, filas alternadas a la derecha. */
export function ZoneBands({ data }: { data: Dashboard }) {
  const [tab, setTab] = useState<Tab>("deterioro");
  const eligible = data.zones.filter((z) => z.eligible);
  const rows =
    tab === "viejos"
      ? data.oldestOpenIssues.map((o) => ({ key: o.id, name: o.label, value: `${fmtInt(o.days)} días`, href: null as string | null }))
      : [...eligible]
          .sort((a, b) => (tab === "deterioro" ? b.pctMuyDeteriorada - a.pctMuyDeteriorada : b.pozosPerKm - a.pozosPerKm))
          .slice(0, 8)
          .map((z) => ({
            key: String(z.id),
            name: z.name,
            value: tab === "deterioro" ? fmtPct(z.pctMuyDeteriorada) : `${fmt1(z.pozosPerKm)} por km`,
            href: `/zona/${z.slug}` as string | null,
          }));

  return (
    <div className="mt-12 grid gap-6 lg:grid-cols-[220px_1fr]">
      <div role="tablist" aria-label="Ranking" className="grid grid-cols-3 gap-1.5 lg:flex lg:flex-col">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`flex min-h-16 flex-col justify-center px-4 py-2 text-left ${tab === t.id ? "bg-asphalt text-asphalt-ink" : "bg-paint-2 text-paint-ink hover:bg-asphalt/15"}`}>
            <span className="text-body font-semibold leading-tight">{t.label}</span>
            <span className="hidden text-small sm:block">{t.note}</span>
          </button>
        ))}
      </div>
      <ol role="tabpanel" className="flex flex-col gap-1">
        {rows.map((r, i) => {
          const body = (
            <>
              <span className="tabular w-8 shrink-0 text-paint-ink/80">{i + 1}</span>
              <span className="flex-1 font-semibold">{r.name}</span>
              <span className="tabular text-lead font-semibold tracking-[-0.02em]">{r.value}</span>
            </>
          );
          const cls = `flex min-h-[64px] items-center gap-4 px-5 ${i % 2 ? "bg-paint-2" : "bg-paint"}`;
          return (
            <li key={r.key}>
              {r.href ? <Link href={r.href} className={`${cls} hover:bg-asphalt hover:text-asphalt-ink`}>{body}</Link> : <div className={cls}>{body}</div>}
            </li>
          );
        })}
        {tab !== "viejos" && <li className="mt-3 text-small">Solo entran las zonas con al menos 20% de sus calles relevadas.</li>}
      </ol>
    </div>
  );
}

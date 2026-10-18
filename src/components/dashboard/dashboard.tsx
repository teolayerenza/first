import Link from "next/link";
import type { Dashboard as DashboardData } from "@/lib/data/types";
import type { LngLat } from "@/lib/domain/types";
import { fmt1, fmtInt, fmtPct, relativeDays } from "@/lib/format";
import { AnonymityBlock } from "../anonymity";
import { LiveNow, LiveRefresh } from "../live";
import { MapSection } from "../map/map-section";
import { ConditionBar } from "./condition-bar";
import { DeteriorationLine, NewVsFixedColumns, SeriesTable } from "./monthly-charts";
import { AnonymityStrip, CtaButtons, Delta, Section, StatTile } from "./parts";

interface Props {
  data: DashboardData;
  casco: LngLat[];
  zone?: { id: number; name: string; ring: LngLat[] };
}

/** "1 de cada 3": fracción simple y honesta para un porcentaje. */
function oneIn(pct: number): string {
  if (pct <= 0) return "ningún arreglo";
  const n = Math.round(100 / pct);
  return n <= 1 ? "casi todos los arreglos" : `1 de cada ${n} arreglos`;
}

export function Dashboard({ data, casco, zone }: Props) {
  const { kpis, previous, contributors } = data;
  const i = kpis.issues;
  const deltaMuy = previous ? Math.round((kpis.pct.muy_deteriorada - previous.pct.muy_deteriorada) * 10) / 10 : null;
  const updated = new Date(kpis.asOf).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
  const scopeName = zone ? `Zona ${zone.name}` : "Casco urbano";
  const ranked = data.zones.filter((z) => z.eligible).sort((a, b) => b.pctMuyDeteriorada - a.pctMuyDeteriorada);
  const byPozos = data.zones.filter((z) => z.eligible).sort((a, b) => b.pozosPerKm - a.pozosPerKm);
  const maxPct = Math.max(1, ...ranked.map((z) => z.pctMuyDeteriorada));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:gap-6 sm:py-8">
      <LiveRefresh />

      {/* ── Encabezado ── */}
      <div className="flex flex-col gap-1">
        <p className="text-sm text-ink-3">
          {zone && (
            <>
              <Link href="/" className="underline hover:text-ink">Casco urbano</Link> ›{" "}
            </>
          )}
          {scopeName} · actualizado {updated}
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
          <span>
            👥 <strong className="tabular text-ink">{fmtInt(contributors.total)}</strong> vecinos ya se sumaron
          </span>
          <span className="tabular text-ink-3">+{fmtInt(contributors.new7d)} esta semana</span>
          <LiveNow />
        </p>
      </div>

      {/* ── Estado del asfalto ── */}
      <Section kicker="Estado del asfalto" title={zone ? `Cómo están las calles de ${zone.name}` : "Cómo están las calles del casco"}>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <p className="text-ink">
            <span className="tabular block text-6xl font-semibold leading-none tracking-tight sm:text-7xl">{fmtPct(kpis.pct.muy_deteriorada)}</span>
            <span className="mt-2 block text-lg">de las calles {zone ? "de la zona " : ""}está <strong>muy deteriorada</strong></span>
          </p>
          <div className="pb-1"><Delta delta={deltaMuy} /></div>
        </div>
        <p className="tabular mt-2 text-sm text-ink-3">
          {fmtInt(kpis.cuadras.muy_deteriorada)} de {fmtInt(kpis.cuadrasAsphalt)} cuadras · {fmt1(kpis.km.muy_deteriorada)} de {fmt1(kpis.kmAsphalt)} km de asfalto
        </p>
        <div className="mt-6">
          <ConditionBar kpis={kpis} />
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-surface-2 px-3 py-1 text-ink-2">🔵 <strong className="tabular text-ink">{fmtPct(kpis.pctCobbled)}</strong> es empedrado (aparte)</span>
          <span className="rounded-full bg-surface-2 px-3 py-1 text-ink-2">🩹 <strong className="tabular text-ink">{fmtPct(kpis.pctTodoParche)}</strong> es parche sobre parche</span>
          <span className="rounded-full bg-surface-2 px-3 py-1 text-ink-2">📋 <strong className="tabular text-ink">{fmtPct(kpis.pctSurveyed)}</strong> relevado</span>
        </div>
        {kpis.pct.sin_relevar > 30 && (
          <p className="mt-3 text-sm text-ink-3">
            Todavía hay un {fmtPct(kpis.pct.sin_relevar)} sin relevar. Cuantos más vecinos califiquen su cuadra, más preciso es el número.
          </p>
        )}
      </Section>

      {/* ── Pozos y parches ── */}
      <Section kicker="Problemas puntuales" title="Pozos y parches mal hechos">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile icon="🕳️" label="Pozos abiertos" value={fmtInt(i.openPozos)} sub={`${fmt1(i.pozosPerKm)} por km de calle`} />
          <StatTile icon="🩹" label="Parches mal hechos" value={fmtInt(i.openParches)} sub="elevados, hundidos o desarmados" />
          <StatTile
            icon="🔧"
            label="Últimos 30 días"
            value={<>{fmtInt(i.resolvedPozos30d)} <span className="text-lg font-normal text-ink-3">vs</span> {fmtInt(i.newPozos30d)}</>}
            sub="pozos arreglados vs. nuevos"
          />
          <StatTile
            icon="⏱️"
            label="Tiempo de arreglo"
            value={i.avgRepairDays === null ? "—" : `${fmtInt(i.avgRepairDays)} días`}
            sub={i.medianRepairDays === null ? "sin arreglos en 90 días" : `promedio · mediana ${fmtInt(i.medianRepairDays)} días`}
          />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {i.badFixRatePct !== null && (
            <div className="rounded-xl border border-line bg-bg p-4">
              <p className="text-sm text-ink-2">🩹 Calidad del arreglo</p>
              <p className="mt-1 text-xl font-semibold text-ink">{oneIn(i.badFixRatePct)} queda mal</p>
              <p className="tabular mt-1 text-xs text-ink-3">
                {fmtPct(i.badFixRatePct)} de {fmtInt(i.badFixSample)} arreglos de los últimos 90 días quedó como un parche mal hecho, según los vecinos.
              </p>
            </div>
          )}
          {i.oldestOpen && (
            <div className="rounded-xl border border-line bg-bg p-4">
              <p className="text-sm text-ink-2">🎂 El pozo más viejo sin arreglar</p>
              <p className="mt-1 text-xl font-semibold text-ink">{i.oldestOpen.label}</p>
              <p className="tabular mt-1 text-xs text-ink-3">Abierto {relativeDays(i.oldestOpen.days)} ({fmtInt(i.oldestOpen.days)} días)</p>
            </div>
          )}
        </div>
      </Section>

      {/* ── Aportar ── */}
      <div className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <CtaButtons />
        <AnonymityStrip />
      </div>

      {/* ── Mapa / 3D ── */}
      <Section kicker="Mapa" title={zone ? `Las calles de ${zone.name}` : "Las calles del casco, cuadra por cuadra"}>
        <MapSection casco={casco} zoneId={zone?.id} focus={zone?.ring} />
      </Section>

      {/* ── Rankings ── */}
      {!zone && (
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <Section kicker="Ranking" title="Zonas con más calles muy deterioradas">
            <ol className="flex flex-col gap-2">
              {ranked.slice(0, 8).map((z, idx) => (
                <li key={z.id}>
                  <Link href={`/zona/${z.slug}`} className="group grid grid-cols-[1.5rem_1fr_auto] items-center gap-2 text-sm">
                    <span className="tabular text-ink-3">{idx + 1}.</span>
                    <span>
                      <span className="text-ink group-hover:underline">{z.name}</span>
                      <span aria-hidden className="mt-1 block h-1.5 rounded-r-[3px] bg-muy" style={{ width: `${(z.pctMuyDeteriorada / maxPct) * 100}%` }} />
                    </span>
                    <span className="tabular font-semibold text-ink">{fmtPct(z.pctMuyDeteriorada)}</span>
                  </Link>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-ink-3">Solo zonas con al menos 20% de sus calles relevadas.</p>
          </Section>
          <Section kicker="Ranking" title="Zonas con más pozos por km">
            <ol className="flex flex-col gap-2">
              {byPozos.slice(0, 8).map((z, idx) => (
                <li key={z.id}>
                  <Link href={`/zona/${z.slug}`} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-2 text-sm hover:underline">
                    <span className="tabular text-ink-3">{idx + 1}.</span>
                    <span className="text-ink">{z.name}</span>
                    <span className="tabular font-semibold text-ink">{fmt1(z.pozosPerKm)} / km</span>
                  </Link>
                </li>
              ))}
            </ol>
            <h3 className="mt-5 text-sm font-medium text-ink">🕐 Pozos más viejos sin arreglar</h3>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {data.oldestOpenIssues.map((o) => (
                <li key={o.id} className="flex justify-between gap-2">
                  <span className="text-ink-2">{o.kind === "parche" ? "🩹" : "🕳️"} {o.label}</span>
                  <span className="tabular text-ink">{fmtInt(o.days)} días</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}

      {/* ── Evolución ── */}
      <Section kicker="Evolución" title="Mes a mes">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0">
            <h3 className="mb-2 text-sm font-medium text-ink">% de calles muy deterioradas</h3>
            <DeteriorationLine series={data.series} />
          </div>
          <div className="min-w-0">
            <h3 className="mb-2 text-sm font-medium text-ink">Pozos nuevos vs. arreglados</h3>
            <NewVsFixedColumns series={data.series} />
          </div>
        </div>
        <SeriesTable series={data.series} />
      </Section>

      <AnonymityBlock />

      {data.moderation[0] && (
        <p className="text-center text-xs text-ink-3">
          🛡️ Última acción de moderación: {data.moderation[0].action.toLowerCase()} ({fmtInt(data.moderation[0].count)}) en {data.moderation[0].area}.{" "}
          <Link href="/moderacion" className="underline hover:text-ink">Ver bitácora pública</Link>
        </p>
      )}
    </div>
  );
}

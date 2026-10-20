import type { ReactNode } from "react";
import type { Dashboard as DashboardData } from "@/lib/data/types";
import type { LngLat } from "@/lib/domain/types";
import { fmt1, fmtInt, fmtPct, fmtPp, relativeDays } from "@/lib/format";
import { AnonymityStatement } from "../anonymity";
import { LiveNow, LiveRefresh } from "../live";
import { Reveal } from "../reveal";
import { MapSection } from "../map/map-section";
import { ConditionBar } from "./condition-bar";
import { Hero } from "./hero";
import { DeteriorationLine, NewVsFixedColumns, SeriesTable } from "./monthly-charts";
import { RoadProfile } from "./road-profile";
import { StartFragment } from "./start-fragment";
import { ZoneBands } from "./zone-bands";

interface Props {
  data: DashboardData;
  casco: LngLat[];
  zone?: { id: number; name: string; ring: LngLat[] };
}

/** "1 de cada 3": fracción simple y honesta para un porcentaje. */
function oneIn(pct: number): string {
  if (pct <= 0) return "Ningún arreglo";
  const n = Math.round(100 / pct);
  return n <= 1 ? "Casi todos los arreglos" : `1 de cada ${n} arreglos`;
}

/** Un capítulo: campo plano a todo el ancho; todos comparten margen izquierdo y grilla. */
function Chapter({ id, className, children, label }: { id: string; className: string; children: ReactNode; label: string }) {
  return (
    <section id={id} aria-label={label} className={`scroll-mt-4 px-5 py-14 sm:px-8 sm:py-20 lg:py-32 ${className}`}>
      <div className="mx-auto max-w-[1400px]" data-reveal="">{children}</div>
    </section>
  );
}

const BIG = "tabular text-[clamp(3.5rem,1rem+5.6vw,6rem)] font-semibold leading-none tracking-[-0.04em]";

export function Dashboard({ data, casco, zone }: Props) {
  const { kpis, previous, contributors } = data;
  const i = kpis.issues;
  const deltaMuy = previous ? Math.round((kpis.pct.muy_deteriorada - previous.pct.muy_deteriorada) * 10) / 10 : null;
  const flat = deltaMuy !== null && Math.abs(deltaMuy) < 0.05;
  const updated = new Date(kpis.asOf).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
  const segmentsUrl = `/api/datos/cuadras.geojson${zone ? `?zona=${zone.id}` : ""}`;
  const where = zone ? `de la zona ${zone.name}` : "del casco";

  return (
    <div>
      <LiveRefresh />
      <Reveal />

      <Hero
        title={zone ? `Zona ${zone.name}` : "Calles de La Plata"}
        lead={
          zone
            ? `Estado del asfalto, pozos y parches de las calles entre ${zone.name.replace(" / ", " y ")}.`
            : "Medidas por vecinos: cada cuadra del casco, calificada por quienes viven y pasan por ahí. Cada pozo y cada parche mal hecho, en el mapa."
        }
        casco={casco}
        segmentsUrl={segmentsUrl}
        swatches={[
          { href: "#estado", label: "Muy deterioradas", value: fmtPct(kpis.pct.muy_deteriorada), className: "bg-surface text-ink" },
          { href: "#pozos", label: "Pozos abiertos", value: fmtInt(i.openPozos), className: "bg-red text-red-ink" },
          { href: "#mapa", label: "Mapa", value: `${fmtInt(kpis.cuadrasAsphalt)} cuadras`, className: "bg-asphalt-3 text-asphalt-ink" },
          ...(zone ? [] : [{ href: "#zonas", label: "Zonas", value: "Ranking", className: "bg-paint text-paint-ink" }]),
          { href: "#sumate", label: "Vecinos", value: fmtInt(contributors.total), className: "bg-green text-green-ink" },
        ]}
      />

      {/* Estado del asfalto: el capítulo tranquilo, sobre hormigón. */}
      <Chapter id="estado" label="Estado del asfalto" className="bg-bg text-ink">
        <div className="rise">
          <h2 className="tabular text-display leading-[0.85]">{fmtPct(kpis.pct.muy_deteriorada)}</h2>
          <p className="mt-6 max-w-[34ch] text-lead leading-snug">
            de las calles {where} está muy deteriorada: {fmtInt(kpis.cuadras.muy_deteriorada)} de {fmtInt(kpis.cuadrasAsphalt)} cuadras,{" "}
            {fmt1(kpis.km.muy_deteriorada)} de {fmt1(kpis.kmAsphalt)} km de asfalto.{" "}
            {deltaMuy !== null && (
              <strong className={`tabular ${flat ? "" : deltaMuy > 0 ? "text-bad" : "text-good"}`}>
                {flat ? "Igual que hace 30 días." : `${deltaMuy > 0 ? "Empeoró" : "Mejoró"} ${fmtPp(deltaMuy).replace(/^[+−]/, "")} en 30 días.`}
              </strong>
            )}
          </p>
        </div>
        <ul className="mt-10 grid gap-6 sm:mt-16 sm:grid-cols-3 sm:gap-8">
          {[
            [fmtPct(kpis.pctCobbled), "es empedrado (se cuenta aparte)"],
            [fmtPct(kpis.pctTodoParche), "es parche sobre parche"],
            [fmtPct(kpis.pctSurveyed), "ya está relevado por vecinos"],
          ].map(([v, t]) => (
            <li key={t} className="text-lead leading-snug">
              <span className="tabular block text-head font-semibold leading-none tracking-[-0.04em]">{v}</span> {t}
            </li>
          ))}
        </ul>
        <div className="mt-10 sm:mt-16">
          <ConditionBar kpis={kpis} />
        </div>
        <p className="mt-8 max-w-[60ch] text-ink-2 sm:mt-10">
          Actualizado a las {updated}. Falta relevar el {fmtPct(kpis.pct.sin_relevar)} del asfalto: cuantos más vecinos califiquen su cuadra,
          más preciso es el número. <a href="/metodologia" className="font-semibold text-ink underline">Cómo se calcula</a>.
        </p>
      </Chapter>

      {/* Pozos y parches: el campo rojo. Corte de una calle + dos cifras. */}
      <Chapter id="pozos" label="Pozos y parches" className="bg-red text-red-ink">
        <h2 className="max-w-[16ch] text-head">Pozos y parches mal hechos</h2>
        <div className="mt-8 grid sm:mt-12 lg:grid-cols-3">
          <div className="bg-red-2 lg:col-span-2">
            <RoadProfile className="h-full w-full" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-1">
            <div className="flex flex-col bg-asphalt p-5 text-asphalt-ink sm:min-h-56 sm:p-7">
              <p className={BIG}>{fmtInt(i.openPozos)}</p>
              <p className="mt-3">pozos abiertos, {fmt1(i.pozosPerKm)} por km de calle</p>
            </div>
            <div className="flex flex-col bg-paint p-5 text-paint-ink sm:min-h-56 sm:p-7">
              <p className={BIG}>{fmtInt(i.openParches)}</p>
              <p className="mt-3">parches mal hechos: elevados, hundidos o desarmados</p>
            </div>
          </div>
        </div>
        <a href="/problemas" className="mt-6 inline-flex h-[52px] items-center bg-asphalt px-6 font-semibold text-asphalt-ink hover:opacity-90">
          Ver los problemas abiertos
        </a>
        <div className="mt-10 grid gap-10 sm:mt-20 sm:gap-12 lg:grid-cols-2">
          {i.badFixRatePct !== null ? (
            <div>
              <p className="text-head font-semibold leading-[0.95] tracking-[-0.04em]">{oneIn(i.badFixRatePct)} queda mal</p>
              <p className="mt-4 max-w-[44ch]">
                Cuando un vecino marca que arreglaron un pozo, le preguntamos si quedó bien. En los últimos 90 días, el{" "}
                {fmtPct(i.badFixRatePct)} de {fmtInt(i.badFixSample)} arreglos quedó como un parche mal hecho.
              </p>
            </div>
          ) : <div />}
          <dl className="grid gap-6 self-end sm:grid-cols-2 sm:gap-8">
            <div className="flex flex-col">
              <dt className="order-2">pozos arreglados y nuevos en 30 días</dt>
              <dd className="tabular order-1 text-lead font-semibold">{fmtInt(i.resolvedPozos30d)} arreglados, {fmtInt(i.newPozos30d)} nuevos</dd>
            </div>
            <div className="flex flex-col">
              <dt className="order-2">tarda en promedio un arreglo</dt>
              <dd className="tabular order-1 text-lead font-semibold">{i.avgRepairDays === null ? "Sin datos" : `${fmtInt(i.avgRepairDays)} días`}</dd>
            </div>
            {i.oldestOpen && (
              <div className="flex flex-col sm:col-span-2">
                <dt className="order-2">el pozo más viejo sin arreglar, abierto {relativeDays(i.oldestOpen.days)}</dt>
                <dd className="order-1 text-lead font-semibold">{i.oldestOpen.label}</dd>
              </div>
            )}
          </dl>
        </div>
      </Chapter>

      {/* Mapa: asfalto. */}
      <Chapter id="mapa" label="Mapa" className="bg-asphalt text-asphalt-ink">
        <h2 className="text-head">Cuadra por cuadra</h2>
        <p className="mt-4 max-w-[52ch] text-asphalt-ink-2">
          Tocá una cuadra para ver su estado y sus pozos. En la vista 3D, cada cuadra sube según cuántos problemas abiertos tiene.
        </p>
        <div className="mt-8 sm:mt-10">
          <MapSection casco={casco} zoneId={zone?.id} focus={zone?.ring} />
        </div>
      </Chapter>

      {/* Zonas: amarillo pintura vial. */}
      {!zone && (
        <Chapter id="zonas" label="Zonas" className="bg-paint text-paint-ink">
          <h2 className="text-head">Dónde está peor</h2>
          <p className="mt-4 max-w-[48ch] text-lead leading-snug">Cuadrante por cuadrante, entre avenidas.</p>
          <ZoneBands data={data} />
        </Chapter>
      )}

      {/* Evolución: hormigón claro. */}
      <Chapter id="evolucion" label="Evolución" className="bg-surface text-ink">
        <h2 className="text-head">Mes a mes</h2>
        <SeriesTable series={data.series} />
        <div className="mt-8 grid gap-10 sm:mt-12 sm:gap-12 lg:grid-cols-2">
          <div className="min-w-0">
            <h3 className="mb-4 text-lead tracking-[-0.02em]">Calles muy deterioradas</h3>
            <DeteriorationLine series={data.series} />
          </div>
          <div className="min-w-0">
            <h3 className="mb-4 text-lead tracking-[-0.02em]">Pozos nuevos y arreglados</h3>
            <NewVsFixedColumns series={data.series} />
          </div>
        </div>
      </Chapter>

      {/* Sumate: el campo verde, con el primer paso ya abierto. */}
      <Chapter id="sumate" label="Sumate" className="bg-green text-green-ink">
        <div className="grid items-end gap-8 sm:gap-12 lg:min-h-[60svh]">
          <div>
            <h2 className="text-head sm:text-[clamp(3.5rem,1rem+6vw,7rem)] sm:leading-[0.92]">Sumá tu cuadra</h2>
            <p className="mt-4 max-w-[40ch] text-lead leading-snug sm:mt-6">
              Ya se sumaron <span className="tabular font-semibold">{fmtInt(contributors.total)}</span> vecinos,{" "}
              <span className="tabular">{fmtInt(contributors.new7d)}</span> esta semana. Es anónimo y tarda menos de un minuto.
            </p>
            <p className="mt-3"><LiveNow /></p>
          </div>
          <StartFragment />
        </div>
      </Chapter>

      {/* Anonimato: asfalto, texto grande con lo importante resaltado. */}
      <Chapter id="anonimato" label="Tu anonimato" className="bg-asphalt text-asphalt-ink">
        <AnonymityStatement />
        {data.moderation[0] && (
          <p className="mt-10 text-small text-asphalt-ink-2 sm:mt-16">
            Última acción de moderación: {data.moderation[0].action.toLowerCase()} ({fmtInt(data.moderation[0].count)}) en {data.moderation[0].area}.{" "}
            <a href="/moderacion" className="underline">Ver la bitácora pública</a>.
          </p>
        )}
      </Chapter>
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { StreetSearch } from "@/components/forms/location-picker";
import type { SegmentDetail, SegmentsFC } from "@/lib/data/types";
import type { LngLat } from "@/lib/domain/types";
import { CONDITION_HINT, CONDITION_LABEL } from "@/lib/format";

const Casco3D = dynamic(() => import("../three/casco-3d"), { ssr: false });
const StreetMap = dynamic(() => import("../map/street-map"), { ssr: false });

export interface Swatch {
  href: string;
  label: string;
  value: string;
  className: string;
}

/** Campo de color por estado: el resultado de la búsqueda se pinta del color de la cuadra. */
const FIELD: Record<string, string> = {
  nueva: "bg-nueva text-white",
  buena: "bg-buena text-asphalt",
  gastada: "bg-gastada text-asphalt",
  muy_deteriorada: "bg-red text-red-ink",
  sin_relevar: "bg-asphalt-3 text-asphalt-ink",
  empedrado: "bg-empedrado text-white",
};

/**
 * Hero: el casco en 3D ocupa la vista; a la derecha, una columna de bloques de color que es a la vez
 * navegación y adelanto de cada capítulo. Lo único "vivo": buscar tu cuadra y ver cómo está.
 */
export function Hero({ title, lead, casco, segmentsUrl, swatches }: { title: string; lead: string; casco: LngLat[]; segmentsUrl: string; swatches: Swatch[] }) {
  const [fc, setFc] = useState<SegmentsFC | null>(null);
  // Arranca en el mapa 2D; el 3D se carga recién cuando se elige.
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  const [cuadra, setCuadra] = useState<SegmentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [gpsMsg, setGpsMsg] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "3d" || fc) return;
    fetch(segmentsUrl).then((r) => r.json()).then(setFc).catch(() => {});
  }, [mode, fc, segmentsUrl]);
  const issuesUrl = segmentsUrl.replace("cuadras.geojson", "problemas.geojson");
  const tab = (active: boolean) =>
    `min-h-10 px-4 text-small font-semibold ${active ? "bg-asphalt-ink text-asphalt" : "bg-asphalt-3 text-asphalt-ink hover:bg-asphalt-2"}`;

  async function pick(id: number) {
    setLoading(true);
    const r = await fetch(`/api/cuadra/${id}`);
    setCuadra(r.ok ? await r.json() : null);
    setLoading(false);
  }

  /** Tu cuadra por GPS: solo con ubicación precisa (celular); una compu sin GPS puede errar por kilómetros. */
  function locate() {
    setGpsMsg(null);
    if (!navigator.geolocation) return setGpsMsg("Este dispositivo no permite usar la ubicación. Buscá la cuadra por nombre.");
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (pos.coords.accuracy > 500) {
          setLoading(false);
          return setGpsMsg("Este dispositivo no tiene GPS y solo da una ubicación aproximada. Buscá la cuadra por nombre.");
        }
        try {
          const r = await fetch(`/api/geo/cercana?lng=${pos.coords.longitude}&lat=${pos.coords.latitude}`);
          const { segment, inCasco } = (await r.json()) as { segment: { id: number } | null; inCasco: boolean };
          if (!inCasco) setGpsMsg("Por ahora tu zona no está incluida. Pocitos LP empieza por el casco urbano y vamos a ir sumando barrios.");
          else if (!segment) setGpsMsg("No hay una calle del casco cerca de donde estás.");
          else return pick(segment.id);
        } catch {
          setGpsMsg("No pudimos buscar tu cuadra. Probá de nuevo.");
        }
        setLoading(false);
      },
      () => {
        setLoading(false);
        setGpsMsg("No pudimos usar el GPS. Buscá la cuadra por nombre.");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }

  const key = cuadra ? (cuadra.cobbled ? "empedrado" : cuadra.condition) : null;

  return (
    <section aria-labelledby="hero-title" className="bg-asphalt p-2 text-asphalt-ink sm:p-3">
      <div className="grid gap-2 lg:min-h-[calc(100svh-76px)] lg:grid-cols-12">
        <div className="relative flex flex-col overflow-hidden bg-asphalt lg:col-span-10 lg:block">
          {/* En escritorio el casco ocupa la derecha del panel; en el celular, una franja entre el texto y el buscador. */}
          <div className="relative order-2 h-[46svh] lg:absolute lg:inset-y-0 lg:left-[36%] lg:right-0 lg:h-auto">
            {mode === "2d" ? (
              <StreetMap casco={casco} segmentsUrl={segmentsUrl} issuesUrl={issuesUrl} view="estado" showIssues height="fill" />
            ) : (
              fc && <Casco3D data={fc} casco={casco} mode="problemas" fill />
            )}
            <div role="tablist" aria-label="Tipo de vista" className="absolute left-2 top-2 z-10 flex">
              <button role="tab" aria-selected={mode === "2d"} className={tab(mode === "2d")} onClick={() => setMode("2d")}>Mapa</button>
              <button role="tab" aria-selected={mode === "3d"} className={tab(mode === "3d")} onClick={() => setMode("3d")}>3D</button>
            </div>
          </div>
          <div className="rise relative order-1 p-5 sm:p-8 lg:max-w-[38%]">
            <h1 id="hero-title" className="text-[clamp(2.75rem,1rem+4.6vw,6.25rem)]">{title}</h1>
            <p className="mt-5 max-w-[34ch] text-lead leading-snug text-asphalt-ink-2">{lead}</p>
          </div>
          <div className="relative order-3 bg-asphalt p-5 sm:p-8 lg:absolute lg:bottom-0 lg:left-0 lg:w-[36%] lg:min-w-[360px]">
            <p className="text-lead font-semibold leading-tight">¿Cómo está tu cuadra?</p>
            <button type="button" onClick={locate} className="mt-3 inline-flex h-11 items-center bg-asphalt-ink px-4 text-small font-semibold text-asphalt">
              Usar mi ubicación
            </button>
            {gpsMsg && <p className="mt-2 text-small text-asphalt-ink-2">{gpsMsg}</p>}
            <StreetSearch dark onPick={(e) => { setGpsMsg(null); pick(e.id); }} />
            {loading && <p className="mt-3 text-small text-asphalt-ink-2">Buscando…</p>}
            {cuadra && key && !loading && (
              <div className={`mt-3 p-4 ${FIELD[key]}`} aria-live="polite">
                <p className="text-small">{cuadra.label}</p>
                <p className="text-head font-semibold leading-none tracking-[-0.04em]">{key === "empedrado" ? "Empedrado" : CONDITION_LABEL[cuadra.condition]}</p>
                <p className="mt-2 text-small">
                  {key === "empedrado" ? "Categoría aparte: no entra en los porcentajes de asfalto" : CONDITION_HINT[cuadra.condition]}.{" "}
                  {cuadra.openPozos} pozos y {cuadra.openParches} parches mal hechos abiertos.
                </p>
                <p className="mt-3 flex flex-wrap gap-x-4 text-small font-semibold underline">
                  <Link href={`/cuadra/${cuadra.id}`}>Ver la cuadra</Link>
                  <Link href={`/calificar?cuadra=${cuadra.id}`}>Calificarla</Link>
                </p>
              </div>
            )}
          </div>
        </div>
        <nav aria-label="Capítulos" className="grid grid-cols-1 gap-0 lg:col-span-2 lg:grid-rows-5">
          {swatches.map((s) => (
            <a key={s.href} href={s.href} className={`group flex min-h-[64px] flex-col justify-between p-4 lg:min-h-0 lg:p-5 ${s.className}`}>
              <span className="text-small font-semibold">{s.label}</span>
              <span className="tabular text-lead font-semibold leading-none tracking-[-0.03em] transition-transform group-hover:translate-x-1">{s.value}</span>
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}

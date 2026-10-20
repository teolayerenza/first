"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { SegmentsFC } from "@/lib/data/types";
import type { LngLat } from "@/lib/domain/types";
import type { Height3D } from "../three/casco-3d";
import type { MapView } from "./street-map";

const StreetMap = dynamic(() => import("./street-map"), { ssr: false, loading: () => <Placeholder /> });
const Casco3D = dynamic(() => import("../three/casco-3d"), { ssr: false, loading: () => <Placeholder /> });

function Placeholder() {
  return <div className="grid h-[520px] place-items-center bg-asphalt-2 text-small text-asphalt-ink-2">Cargando…</div>;
}

const VIEWS: { id: MapView; label: string }[] = [
  { id: "estado", label: "Estado del asfalto" },
  { id: "parcheo", label: "Parcheo" },
  { id: "problemas", label: "Pozos y parches" },
];

const LEGENDS: Record<MapView, { cls: string; label: string }[]> = {
  estado: [
    { cls: "bg-nueva", label: "Nueva" },
    { cls: "bg-buena", label: "Buena" },
    { cls: "bg-gastada", label: "Gastada" },
    { cls: "bg-muy", label: "Muy deteriorada" },
    { cls: "hatch", label: "Sin relevar" },
    { cls: "bg-empedrado", label: "Empedrado" },
  ],
  parcheo: [
    { cls: "bg-buena", label: "Pocos parches" },
    { cls: "bg-gastada", label: "Bastantes" },
    { cls: "bg-muy", label: "Es todo parche" },
    { cls: "hatch", label: "Sin dato" },
    { cls: "bg-empedrado", label: "Empedrado" },
  ],
  problemas: [
    { cls: "bg-buena", label: "Sin problemas abiertos" },
    { cls: "bg-gastada", label: "Algunos" },
    { cls: "bg-muy", label: "Muchos (por 100 m)" },
    { cls: "bg-empedrado", label: "Empedrado" },
  ],
};

export function MapSection({ casco, zoneId, focus }: { casco: LngLat[]; zoneId?: number; focus?: LngLat[] }) {
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  const [view, setView] = useState<MapView>("estado");
  const [showIssues, setShowIssues] = useState(true);
  const [h3d, setH3d] = useState<Height3D>("problemas");
  const [fc, setFc] = useState<SegmentsFC | null>(null);
  const q = zoneId ? `?zona=${zoneId}` : "";
  const segmentsUrl = `/api/datos/cuadras.geojson${q}`;
  const issuesUrl = `/api/datos/problemas.geojson${q}`;

  useEffect(() => {
    if (mode !== "3d" || fc) return;
    fetch(segmentsUrl).then((r) => r.json()).then(setFc);
  }, [mode, fc, segmentsUrl]);

  const tab = (active: boolean) =>
    `min-h-11 px-4 text-small font-semibold ${active ? "bg-asphalt-ink text-asphalt" : "bg-asphalt-3 text-asphalt-ink hover:bg-asphalt-2"}`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Tipo de vista" className="flex">
          <button role="tab" aria-selected={mode === "2d"} className={tab(mode === "2d")} onClick={() => setMode("2d")}>Mapa</button>
          <button role="tab" aria-selected={mode === "3d"} className={tab(mode === "3d")} onClick={() => setMode("3d")}>3D</button>
        </div>
        {mode === "2d" ? (
          <>
            <label className="sr-only" htmlFor="map-view">Qué mostrar</label>
            <select id="map-view" value={view} onChange={(e) => setView(e.target.value as MapView)}
              className="min-h-11 bg-asphalt-3 px-3 text-small font-semibold text-asphalt-ink">
              {VIEWS.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
            <label className="flex min-h-11 items-center gap-2 text-small text-asphalt-ink">
              <input type="checkbox" checked={showIssues} onChange={(e) => setShowIssues(e.target.checked)} className="h-4 w-4 accent-current" />
              Ver pozos y parches
            </label>
          </>
        ) : (
          <div role="radiogroup" aria-label="Altura de las cuadras" className="flex">
            <button role="radio" aria-checked={h3d === "problemas"} className={tab(h3d === "problemas")} onClick={() => setH3d("problemas")}>Altura = problemas</button>
            <button role="radio" aria-checked={h3d === "estado"} className={tab(h3d === "estado")} onClick={() => setH3d("estado")}>Altura = deterioro</button>
          </div>
        )}
      </div>

      {mode === "2d" ? (
        <StreetMap casco={casco} focus={focus} segmentsUrl={segmentsUrl} issuesUrl={issuesUrl} view={view} showIssues={showIssues} />
      ) : fc ? (
        <Casco3D data={fc} casco={casco} mode={h3d} />
      ) : (
        <Placeholder />
      )}

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-small text-asphalt-ink-2">
        {(mode === "3d" ? LEGENDS.estado : LEGENDS[view]).map((l) => (
          <li key={l.label} className="flex items-center gap-1.5"><span aria-hidden className={`swatch h-3 w-5 ${l.cls}`} />{l.label}</li>
        ))}
        {mode === "2d" && showIssues && (
          <>
            <li className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-3 rounded-full bg-pozo" />Pozo</li>
            <li className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-3 rounded-full bg-parche" />Parche mal hecho</li>
            <li className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-3 rounded-full border-2 border-asphalt-ink" />Pendiente de verificar</li>
          </>
        )}
      </ul>
      {mode === "3d" && (
        <p className="mt-3 text-small text-asphalt-ink-2">
          {h3d === "problemas" ? "Cada cuadra sube según cuántos pozos y parches abiertos tiene cada 100 m." : "Cada cuadra sube según qué tan deteriorada está."} Arrastrá para girar, pellizcá o usá la rueda para acercar.
        </p>
      )}
    </div>
  );
}

"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import { cssVar, useResolvedTheme } from "@/components/theme";
import type { SegmentRef, StreetIndexEntry } from "@/lib/data/types";
import { haversineM } from "@/lib/domain/geo";
import type { LngLat } from "@/lib/domain/types";
import { Pin } from "./glyphs";

// Av. 7 entre 49 y 50: un punto sobre la calle, para que el pin arranque en una cuadra.
const CENTER: LngLat = [-57.95009, -34.91462];
const STYLE = {
  light: process.env.NEXT_PUBLIC_MAP_STYLE_LIGHT ?? "https://tiles.openfreemap.org/styles/positron",
  dark: process.env.NEXT_PUBLIC_MAP_STYLE_DARK ?? "https://tiles.openfreemap.org/styles/dark",
};

export interface PickedLocation {
  point: LngLat;
  segment: SegmentRef | null;
  /** El GPS del celular está a menos de 50 m del punto elegido. Se envía solo este sí/no. */
  onSite: boolean;
}

/**
 * Pin fijo en el centro: el vecino mueve el mapa hasta que el pin quede sobre el pozo o la cuadra.
 * Es más fácil con un dedo que arrastrar un marcador.
 */
export function LocationPicker({ onChange, initial, hint }: { onChange: (l: PickedLocation) => void; initial?: LngLat; hint: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const gps = useRef<LngLat | null>(null);
  const theme = useResolvedTheme();
  const [seg, setSeg] = useState<SegmentRef | null | undefined>(undefined);
  const [gpsState, setGpsState] = useState<"idle" | "loading" | "ok" | "denied">("idle");
  const [searching, setSearching] = useState(false);
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let m: maplibregl.Map | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const lookup = async () => {
      if (!m) return;
      const c = m.getCenter();
      const point: LngLat = [c.lng, c.lat];
      let s: SegmentRef | null = null;
      try {
        const res = await fetch(`/api/geo/cercana?lng=${c.lng}&lat=${c.lat}`);
        if (res.ok) s = (await res.json()) as SegmentRef | null;
      } catch {}
      setSeg(s);
      const onSite = gps.current ? haversineM(gps.current, point) < 50 : false;
      cb.current({ point, segment: s, onSite });
    };
    (async () => {
      let style: maplibregl.StyleSpecification | string = STYLE[theme];
      try {
        const r = await fetch(STYLE[theme], { signal: AbortSignal.timeout(4000) });
        if (!r.ok) throw new Error();
        style = await r.json();
      } catch {
        style = { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": cssVar("--surface-2") } }] };
      }
      if (cancelled || !el.current) return;
      m = new maplibregl.Map({
        container: el.current,
        style,
        center: initial ?? CENTER,
        zoom: initial ? 17 : 14,
        attributionControl: { compact: true },
        dragRotate: false,
      });
      map.current = m;
      m.on("load", async () => {
        // Las cuadras, para que se vea dónde está la calle aunque no haya mapa base.
        m!.addSource("segments", { type: "geojson", data: "/api/datos/cuadras.geojson" });
        m!.addLayer({ id: "segments", type: "line", source: "segments", paint: { "line-color": cssVar("--ink-3"), "line-width": ["interpolate", ["linear"], ["zoom"], 13, 1, 18, 6] } });
        lookup();
      });
      m.on("moveend", () => {
        clearTimeout(timer);
        timer = setTimeout(lookup, 250);
      });
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      m?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  const locate = () => {
    if (!navigator.geolocation) return setGpsState("denied");
    setGpsState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        gps.current = [pos.coords.longitude, pos.coords.latitude];
        setGpsState("ok");
        map.current?.flyTo({ center: gps.current, zoom: 18 });
      },
      () => setGpsState("denied"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  };

  return (
    <div>
      <div className="relative">
        <div ref={el} className="h-[360px] w-full overflow-hidden bg-surface-2" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full"><Pin /></div>
        <button type="button" onClick={locate}
          className="absolute bottom-3 left-3 inline-flex h-11 items-center bg-asphalt px-4 text-small font-semibold text-asphalt-ink">
          {gpsState === "loading" ? "Buscando…" : "Usar mi ubicación"}
        </button>
      </div>
      <p className="mt-3 text-small text-ink-2">{hint}</p>
      {gpsState === "denied" && <p className="mt-1 text-small text-ink-2">No pudimos usar el GPS. Mové el mapa o buscá la cuadra por nombre.</p>}
      <p className="mt-3 bg-asphalt px-4 py-3 text-lead font-semibold leading-tight text-asphalt-ink" aria-live="polite">
        {seg === undefined ? "Ubicando…" : seg ? seg.label : "No hay una calle del casco cerca de este punto."}
      </p>
      <button type="button" className="mt-3 text-small font-semibold text-ink underline" onClick={() => setSearching((v) => !v)}>
        {searching ? "Cerrar búsqueda" : "Buscar por nombre: \"Calle __ entre __ y __\""}
      </button>
      {searching && (
        <StreetSearch
          onPick={(e) => {
            map.current?.jumpTo({ center: e.mid, zoom: 18 });
            setSearching(false);
          }}
        />
      )}
    </div>
  );
}

export function StreetSearch({ onPick, dark = false }: { onPick: (e: StreetIndexEntry) => void; dark?: boolean }) {
  const [idx, setIdx] = useState<StreetIndexEntry[] | null>(null);
  const [street, setStreet] = useState("");
  const [a, setA] = useState("");
  useEffect(() => {
    fetch("/api/geo/calles").then((r) => r.json()).then(setIdx);
  }, []);
  const streets = useMemo(() => [...new Set(idx?.map((e) => e.street))].sort((x, y) => (parseInt(x.replace(/\D/g, "")) || 0) - (parseInt(y.replace(/\D/g, "")) || 0)), [idx]);
  const options = useMemo(() => idx?.filter((e) => e.street === street) ?? [], [idx, street]);
  const sel = dark ? "h-12 w-full bg-asphalt-ink px-3 text-asphalt" : "h-12 w-full border border-line bg-surface px-3 text-ink";
  if (!idx) return <p className={`mt-2 text-small ${dark ? "text-asphalt-ink-2" : "text-ink-3"}`}>Cargando calles…</p>;
  return (
    <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
      <label className="sr-only" htmlFor="calle">Calle</label>
      <select id="calle" className={`${sel} col-span-3`} value={street} onChange={(e) => { setStreet(e.target.value); setA(""); }}>
        <option value="">Elegí la calle…</option>
        {streets.map((s) => <option key={s}>{s}</option>)}
      </select>
      <span className={`col-span-3 ${dark ? "text-asphalt-ink-2" : "text-ink-2"}`}>entre</span>
      <label className="sr-only" htmlFor="entre">Entre</label>
      <select id="entre" className={`${sel} col-span-3`} value={a} disabled={!street}
        onChange={(e) => {
          setA(e.target.value);
          const pick = options.find((o) => String(o.id) === e.target.value);
          if (pick) onPick(pick);
        }}>
        <option value="">… y …</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.a} y {o.b}</option>)}
      </select>
    </div>
  );
}

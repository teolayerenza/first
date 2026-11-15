import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import { bounds } from "../lib/geo";
import { TripsLayer } from "../lib/three-layer";
import type { LngLat, Photo, Trip } from "../lib/types";

maplibregl.setWorkerUrl(workerUrl);

export type MapStyle = "mapa" | "topo" | "satelite";

const ARGENTINA: [LngLat, LngLat] = [[-73.6, -55.1], [-53.6, -21.8]];
const EMPTY = { type: "FeatureCollection" as const, features: [] };
const BASE_URL = "https://tiles.openfreemap.org/styles/positron"; // mapa blanco con rutas, calles y nombres
const FONT = ["Noto Sans Regular"];

/** Fuentes y capas propias: relieve, topográfico, satélite, límites (Natural Earth, punto de vista argentino) y edición. */
const OWN_SOURCES: maplibregl.StyleSpecification["sources"] = {
  topo: {
    type: "raster",
    tiles: ["https://a.tile.opentopomap.org/{z}/{x}/{y}.png", "https://b.tile.opentopomap.org/{z}/{x}/{y}.png", "https://c.tile.opentopomap.org/{z}/{x}/{y}.png"],
    tileSize: 256,
    maxzoom: 17,
    attribution: '<a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
  },
  sat: {
    type: "raster",
    tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    tileSize: 256,
    maxzoom: 18,
    attribution: "Imágenes © Esri, Maxar, Earthstar Geographics",
  },
  // Relieve: datos de altura libres (Mapzen / AWS Terrain Tiles).
  dem: {
    type: "raster-dem",
    tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
    encoding: "terrarium",
    tileSize: 256,
    maxzoom: 14,
    attribution: "Relieve: Mapzen, AWS Terrain Tiles",
  },
  demShade: {
    type: "raster-dem",
    tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
    encoding: "terrarium",
    tileSize: 256,
    maxzoom: 14,
  },
  limites: { type: "geojson", data: "/limites.geojson", attribution: "Límites: Natural Earth" },
  hit: { type: "geojson", data: EMPTY },
  draft: { type: "geojson", data: EMPTY },
};

const UNDER: maplibregl.LayerSpecification[] = [
  { id: "sat", type: "raster", source: "sat", layout: { visibility: "none" } },
  { id: "topo", type: "raster", source: "topo", layout: { visibility: "none" } },
  { id: "vecinos", type: "fill", source: "limites", filter: ["all", ["==", ["get", "kind"], "pais"], ["!", ["get", "ar"]]], paint: { "fill-color": "#e8edf5", "fill-opacity": 0.55 } },
  { id: "hill", type: "hillshade", source: "demShade", paint: { "hillshade-shadow-color": "#8a9bb5", "hillshade-highlight-color": "#ffffff", "hillshade-accent-color": "#b8c4d6", "hillshade-exaggeration": 0.3 } },
];
const OVER: maplibregl.LayerSpecification[] = [
  { id: "prov-line", type: "line", source: "limites", filter: ["==", ["get", "kind"], "provincia"], paint: { "line-color": "#7b8ba6", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.7, 8, 1.6], "line-dasharray": [3, 2] } },
  { id: "pais-line", type: "line", source: "limites", filter: ["==", ["get", "kind"], "pais"], paint: { "line-color": "#1e3a8a", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.4, 8, 2.6] } },
  { id: "prov-label", type: "symbol", source: "limites", filter: ["==", ["get", "kind"], "etiqueta"], minzoom: 3.2, maxzoom: 8,
    layout: { "text-field": ["upcase", ["get", "name"]], "text-font": FONT, "text-size": ["interpolate", ["linear"], ["zoom"], 3.2, 10, 7, 14], "text-letter-spacing": 0.12, "text-max-width": 8 },
    paint: { "text-color": "#475a7a", "text-halo-color": "#ffffff", "text-halo-width": 1.6 } },
  { id: "trip-hit", type: "line", source: "hit", paint: { "line-color": "#ffffff", "line-width": 18, "line-opacity": 0 } },
  { id: "draft-casing", type: "line", source: "draft", filter: ["==", "$type", "LineString"], paint: { "line-color": "#ffffff", "line-width": 7 } },
  { id: "draft-line", type: "line", source: "draft", filter: ["==", "$type", "LineString"], paint: { "line-color": "#2563eb", "line-width": 3.5, "line-dasharray": [2, 1.2] } },
  { id: "draft-pts", type: "circle", source: "draft", filter: ["==", "$type", "Point"], paint: { "circle-radius": 6, "circle-color": "#2563eb", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5 } },
];

/** Mapa blanco: la base de OpenFreeMap (sin sus límites, se usan los propios) más las capas propias. Sin conexión a la base, un mapa blanco solo con límites. */
async function buildStyle(): Promise<maplibregl.StyleSpecification> {
  let base: maplibregl.StyleSpecification | null = null;
  try {
    const r = await fetch(BASE_URL, { signal: AbortSignal.timeout(6000) });
    if (r.ok) base = await r.json();
  } catch {
    // sin base: queda el mapa propio
  }
  if (!base) {
    return {
      version: 8,
      glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
      sources: OWN_SOURCES,
      layers: [{ id: "bg", type: "background", paint: { "background-color": "#ffffff" } }, ...UNDER, ...OVER],
    };
  }
  const layers = base.layers.filter((l) => !l.id.includes("boundary"));
  // Lo propio de abajo va sobre el fondo y el agua/vegetación; lo de arriba, debajo de los nombres de la base.
  const firstLine = layers.findIndex((l) => l.type === "line");
  const firstLabel = layers.findIndex((l) => l.type === "symbol");
  const under = firstLine === -1 ? layers.length : firstLine;
  const out = [...layers.slice(0, under), ...UNDER, ...layers.slice(under, firstLabel === -1 ? layers.length : firstLabel)];
  out.push(...OVER.slice(0, 2), ...layers.slice(firstLabel === -1 ? layers.length : firstLabel), ...OVER.slice(2));
  return { ...base, sources: { ...base.sources, ...OWN_SOURCES }, layers: out };
}

/** Cada estilo prende o apaga capas (así la capa three.js nunca se pierde). */
function applyStyle(map: maplibregl.Map, s: MapStyle) {
  map.setLayoutProperty("sat", "visibility", s === "satelite" ? "visible" : "none");
  map.setLayoutProperty("topo", "visibility", s === "topo" ? "visible" : "none");
  map.setPaintProperty("hill", "hillshade-exaggeration", s === "mapa" ? 0.3 : 0.12);
  map.setPaintProperty("vecinos", "fill-opacity", s === "mapa" ? 0.55 : 0);
  map.setPaintProperty("pais-line", "line-color", s === "satelite" ? "#ffffff" : "#1e3a8a");
  map.setPaintProperty("prov-line", "line-color", s === "satelite" ? "#dbe6ff" : "#7b8ba6");
}

interface Props {
  trips: Trip[];
  selectedId: string | null;
  mapStyle: MapStyle;
  editing: { route: LngLat[]; points: LngLat[] } | null;
  onSelect(id: string | null): void;
  onMapClick(at: LngLat): void;
  onPhoto(p: Photo): void;
  /** Recorrido al que acercarse (el viaje abierto o el que se está editando) y una clave que cambia para volver a volar. */
  focus: LngLat[] | null;
  focusKey: string;
}

export function MapView({ trips, selectedId, mapStyle, editing, onSelect, onMapClick, onPhoto, focus, focusKey }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const layer = useRef(new TripsLayer());
  const ready = useRef(false);
  const [, setLoaded] = useState(false); // re-render al cargar, para dibujar lo que llegó antes que el mapa
  const markers = useRef<maplibregl.Marker[]>([]);
  const cb = useRef({ onSelect, onMapClick, onPhoto, editing, mapStyle });
  cb.current = { onSelect, onMapClick, onPhoto, editing, mapStyle };

  useEffect(() => {
    let map: maplibregl.Map | null = null;
    let cancelled = false;
    buildStyle().then((style) => {
      if (cancelled) return;
      map = new maplibregl.Map({
        container: el.current!,
        style,
        bounds: ARGENTINA,
        fitBoundsOptions: { padding: 40 },
        pitch: 40,
        maxPitch: 80,
        attributionControl: { compact: true },
      });
      const m = map;
      mapRef.current = m;
      m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
      m.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
      m.on("load", () => {
        m.setTerrain({ source: "dem", exaggeration: 1.6 });
        m.setSky({ "sky-color": "#bcd4f6", "horizon-color": "#eef4ff", "fog-color": "#ffffff", "sky-horizon-blend": 0.5, "horizon-fog-blend": 0.6, "fog-ground-blend": 0.8, "atmosphere-blend": 0.6 });
        m.addLayer(layer.current);
        ready.current = true;
        applyStyle(m, cb.current.mapStyle);
        setLoaded(true);
      });
      m.on("click", (e) => {
        if (cb.current.editing) return cb.current.onMapClick([e.lngLat.lng, e.lngLat.lat]);
        const hit = m.queryRenderedFeatures(e.point, { layers: ["trip-hit"] })[0];
        cb.current.onSelect(hit ? String(hit.properties.id) : null);
      });
      m.on("mousemove", "trip-hit", () => { if (!cb.current.editing) m.getCanvas().style.cursor = "pointer"; });
      m.on("mouseleave", "trip-hit", () => { if (!cb.current.editing) m.getCanvas().style.cursor = ""; });
    });
    return () => { cancelled = true; map?.remove(); };
  }, []);

  function sync() {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    layer.current.setTrips(editing ? [] : trips, selectedId);
    (map.getSource("hit") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: editing ? [] : trips.filter((t) => t.route.length > 1).map((t) => ({ type: "Feature", properties: { id: t.id }, geometry: { type: "LineString", coordinates: t.route } })),
    });
    (map.getSource("draft") as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: editing
        ? [
            ...(editing.route.length > 1 ? [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: editing.route } }] : []),
            ...editing.points.map((p) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: p } })),
          ]
        : [],
    });
    map.getCanvas().style.cursor = editing ? "crosshair" : "";
    // Fotos del viaje elegido, en el lugar donde se sacaron (si tenían GPS).
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    const sel = trips.find((t) => t.id === selectedId);
    if (sel && !editing) {
      for (const p of sel.photos) {
        if (p.lng == null || p.lat == null || !p.url) continue;
        const b = document.createElement("button");
        b.className = "photo-pin";
        b.style.backgroundImage = `url("${p.url}")`;
        b.setAttribute("aria-label", p.caption || "Foto del viaje");
        b.onclick = (e) => { e.stopPropagation(); cb.current.onPhoto(p); };
        markers.current.push(new maplibregl.Marker({ element: b }).setLngLat([p.lng, p.lat]).addTo(map));
      }
    }
  }

  useEffect(sync); // en cada render: datos, selección y borrador

  useEffect(() => {
    const map = mapRef.current;
    if (map && ready.current) applyStyle(map, mapStyle);
  }, [mapStyle]);

  // Volar al recorrido (o a toda Argentina).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const b = focus && focus.length > 1 ? bounds(focus) : null;
    const pad = window.innerWidth < 760 ? { top: 60, bottom: window.innerHeight * 0.5, left: 30, right: 30 } : { top: 80, bottom: 80, left: 460, right: 80 };
    if (b) map.fitBounds(b, { padding: pad, pitch: 58, bearing: -12, duration: 1800, maxZoom: 13 });
    else map.fitBounds(ARGENTINA, { padding: pad, pitch: 40, bearing: 0, duration: 1400 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  return <div ref={el} className="map" />;
}

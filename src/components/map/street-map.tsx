"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { maplibregl } from "@/lib/client/maplibre";
import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { cssVar, useResolvedTheme } from "@/components/theme";
import type { LngLat } from "@/lib/domain/types";
import { CONDITION_LABEL, relativeDays } from "@/lib/format";

export type MapView = "estado" | "parcheo" | "problemas";

const STYLE_URL = {
  light: process.env.NEXT_PUBLIC_MAP_STYLE_LIGHT ?? "https://tiles.openfreemap.org/styles/positron",
  dark: process.env.NEXT_PUBLIC_MAP_STYLE_DARK ?? "https://tiles.openfreemap.org/styles/dark",
};

/** Si no hay internet o el proveedor de tiles falla, el mapa igual funciona sobre un fondo liso. */
async function loadStyle(theme: "light" | "dark"): Promise<StyleSpecification> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(STYLE_URL[theme], { signal: ctrl.signal });
    clearTimeout(t);
    if (res.ok) return (await res.json()) as StyleSpecification;
  } catch {}
  return { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": cssVar("--surface-2") } }] };
}

function bounds(ring: LngLat[]): [[number, number], [number, number]] {
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  return [
    [Math.min(...xs), Math.min(...ys)],
    [Math.max(...xs), Math.max(...ys)],
  ];
}

function lineColor(view: MapView): ExpressionSpecification {
  const v = (n: string) => cssVar(n);
  if (view === "parcheo") {
    return ["case", ["==", ["get", "cobbled"], true], v("--c-empedrado"),
      ["match", ["coalesce", ["get", "patching"], "none"], "todo_parche", v("--c-muy"), "bastantes", v("--c-gastada"), "pocos", v("--c-buena"), v("--c-sin")]];
  }
  if (view === "problemas") {
    return ["case", ["==", ["get", "cobbled"], true], v("--c-empedrado"),
      ["step", ["get", "score"], v("--c-buena"), 0.01, v("--c-gastada"), 3, v("--c-muy")]];
  }
  return ["case", ["==", ["get", "cobbled"], true], v("--c-empedrado"),
    ["match", ["get", "condition"], "nueva", v("--c-nueva"), "buena", v("--c-buena"), "gastada", v("--c-gastada"), "muy_deteriorada", v("--c-muy"), v("--c-sin")]];
}

interface Props {
  casco: LngLat[];
  segmentsUrl: string;
  issuesUrl: string;
  focus?: LngLat[];
  view: MapView;
  showIssues: boolean;
  height?: number;
}

export default function StreetMap({ casco, segmentsUrl, issuesUrl, focus, view, showIssues, height = 520 }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const theme = useResolvedTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let m: maplibregl.Map | null = null;
    (async () => {
      const style = await loadStyle(theme);
      if (cancelled || !el.current) return;
      const b = bounds(focus ?? casco);
      m = new maplibregl.Map({
        container: el.current,
        style,
        bounds: b,
        fitBoundsOptions: { padding: 24 },
        maxBounds: [
          [b[0][0] - 0.06, b[0][1] - 0.05],
          [b[1][0] + 0.06, b[1][1] + 0.05],
        ],
        attributionControl: { compact: true, customAttribution: "Calles © colaboradores de OpenStreetMap" },
        dragRotate: false,
        pitchWithRotate: false,
        // En el celular, el mapa se mueve con dos dedos: con uno se sigue scrolleando la página.
        cooperativeGestures: window.matchMedia("(pointer: coarse)").matches,
        locale: {
          "CooperativeGesturesHandler.MobileHelpText": "Usá dos dedos para mover el mapa",
          "CooperativeGesturesHandler.WindowsHelpText": "Usá Ctrl + rueda para acercar el mapa",
          "CooperativeGesturesHandler.MacHelpText": "Usá ⌘ + rueda para acercar el mapa",
        },
      });
      map.current = m;
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      m.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), "top-right");
      m.on("load", () => {
        if (!m) return;
        m.addSource("casco", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: casco } } });
        m.addLayer({ id: "casco", type: "line", source: "casco", paint: { "line-color": cssVar("--ink-3"), "line-width": 1, "line-dasharray": [3, 2] } });
        m.addSource("segments", { type: "geojson", data: segmentsUrl, promoteId: "id" });
        m.addLayer({
          id: "segments",
          type: "line",
          source: "segments",
          layout: { "line-cap": "round" },
          paint: {
            "line-color": lineColor(view),
            "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1.6, 14, 3, 17, 8],
          },
        });
        m.addSource("issues", { type: "geojson", data: issuesUrl });
        m.addLayer({
          id: "issues",
          type: "circle",
          source: "issues",
          minzoom: 13.5,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, ["+", 2.5, ["get", "severity"]], 18, ["+", 5, ["*", 2, ["get", "severity"]]]],
            "circle-color": ["match", ["get", "kind"], "parche", cssVar("--c-parche"), cssVar("--c-pozo")],
            "circle-opacity": ["case", ["get", "verified"], 1, 0],
            "circle-stroke-color": ["case", ["get", "verified"], cssVar("--surface"), ["match", ["get", "kind"], "parche", cssVar("--c-parche"), cssVar("--c-pozo")]],
            "circle-stroke-width": 2,
          },
        });
        setReady(true);
      });

      const popup = new maplibregl.Popup({ closeButton: true, maxWidth: "260px" });
      m.on("click", "issues", (e) => {
        const f = e.features?.[0];
        if (!f || !m) return;
        const p = f.properties as Record<string, string | number | boolean>;
        const kind = p.kind === "parche" ? `Parche mal hecho${p.parcheType ? ` (${p.parcheType})` : ""}` : "Pozo";
        const sev = ["", "leve", "medio", "peligroso"][Number(p.severity)];
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font:13px system-ui;color:#111"><strong>${kind}</strong> · ${sev}<br/>Reportado ${relativeDays(Number(p.days))}<br/>${
              p.verified ? "Verificado" : "Pendiente: falta foto o que otro vecino lo confirme"
            }<br/><a href="/cuadra/${p.segmentId}" style="text-decoration:underline">Ver la cuadra · ¿sigue ahí?</a></div>`,
          )
          .addTo(m);
      });
      m.on("click", "segments", (e) => {
        if (!m || m.queryRenderedFeatures(e.point, { layers: ["issues"] }).length) return;
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, string | number | boolean>;
        const state = p.cobbled ? "Empedrado" : CONDITION_LABEL[p.condition as keyof typeof CONDITION_LABEL];
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font:13px system-ui;color:#111"><strong>${p.label}</strong><br/>${state}<br/>${p.openPozos} pozos · ${p.openParches} parches mal hechos<br/><a href="/cuadra/${p.id}" style="text-decoration:underline">Ver cuadra</a> · <a href="/calificar?cuadra=${p.id}" style="text-decoration:underline">Calificar</a></div>`,
          )
          .addTo(m);
      });
      for (const layer of ["issues", "segments"]) {
        m.on("mouseenter", layer, () => m && (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", layer, () => m && (m.getCanvas().style.cursor = ""));
      }
    })();
    return () => {
      cancelled = true;
      setReady(false);
      m?.remove();
      map.current = null;
    };
    // El mapa se rearma al cambiar de tema (el estilo base cambia); la vista se actualiza abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, segmentsUrl, issuesUrl]);

  useEffect(() => {
    if (!ready || !map.current) return;
    map.current.setPaintProperty("segments", "line-color", lineColor(view));
    map.current.setLayoutProperty("issues", "visibility", showIssues ? "visible" : "none");
  }, [ready, view, showIssues, theme]);

  return <div ref={el} style={{ height }} className="w-full overflow-hidden bg-asphalt-2" aria-label="Mapa de las calles del casco" role="region" />;
}

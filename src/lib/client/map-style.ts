import type { StyleSpecification } from "maplibre-gl";

/**
 * Plazas y parques del mapa base en un verde apagado y oscuro, como relleno: se distinguen del verde de
 * "nueva" y "buena" (que son líneas saturadas sobre las cuadras).
 *
 * El estilo base (Positron / Dark de OpenFreeMap) casi no dibuja las plazas: en el esquema OpenMapTiles las
 * plazas comunes vienen como `landcover` clase `grass` (subclase `park`) y la capa `park` es para parques
 * grandes. Así que no se recolorea lo que haya: se agregan capas propias con esos datos, arriba del fondo y
 * debajo de las calles.
 */
const PLAZA = { light: "#a9c2a0", dark: "#1e3a2a" };

export function tintParks(style: StyleSpecification, theme: "light" | "dark"): StyleSpecification {
  const source = Object.entries(style.sources).find(([, s]) => s.type === "vector")?.[0];
  if (!source) return style;
  const color = PLAZA[theme];
  const layers = style.layers.filter((l) => !l.id.startsWith("pocitos-plazas"));
  const plazas = [
    {
      id: "pocitos-plazas-landcover",
      type: "fill" as const,
      source,
      "source-layer": "landcover",
      // Solo plazas, parques y jardines: el pasto suelto (vías del tren, banquinas) haría franjas enormes.
      filter: ["match", ["get", "subclass"], ["park", "garden", "playground", "village_green", "recreation_ground"], true, false],
      paint: { "fill-color": color, "fill-opacity": 1 },
    },
    {
      id: "pocitos-plazas-park",
      type: "fill" as const,
      source,
      "source-layer": "park",
      paint: { "fill-color": color, "fill-opacity": 1 },
    },
  ];
  // Debajo de la primera línea o texto (calles, nombres), así no tapan nada.
  const at = layers.findIndex((l) => l.type === "line" || l.type === "symbol");
  layers.splice(at === -1 ? layers.length : at, 0, ...(plazas as StyleSpecification["layers"]));
  return { ...style, layers };
}

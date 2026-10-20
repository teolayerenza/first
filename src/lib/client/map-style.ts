import type { StyleSpecification } from "maplibre-gl";

/**
 * Plazas y parques del mapa base en un verde apagado y oscuro, como relleno: se distinguen del verde de
 * "nueva" y "buena" (que son líneas saturadas sobre las cuadras). No depende de los nombres de las capas
 * del estilo: toma todo relleno de `park` y de pasto o bosque de `landcover`.
 */
const PLAZA = { light: "#a9c2a0", dark: "#1e3a2a" };
export function tintParks(style: StyleSpecification, theme: "light" | "dark"): StyleSpecification {
  for (const layer of style.layers) {
    if (layer.type !== "fill") continue;
    const src = (layer as { "source-layer"?: string })["source-layer"];
    if (src !== "park" && src !== "landcover") continue;
    if (src === "landcover" && !/grass|wood|park/i.test(JSON.stringify(layer.filter ?? "") + layer.id)) continue;
    layer.paint = { ...layer.paint, "fill-color": PLAZA[theme], "fill-opacity": 1 };
  }
  return style;
}

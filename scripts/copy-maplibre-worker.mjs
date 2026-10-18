// MapLibre 6 carga su worker desde un archivo aparte que Turbopack no publica.
// Se copia a public/ en cada dev/build para que coincida siempre con la versión instalada.
import { copyFileSync } from "node:fs";

copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre-gl-worker.mjs");

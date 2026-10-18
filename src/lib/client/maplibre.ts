// MapLibre con el worker servido desde public/ (lo copia scripts/copy-maplibre-worker.mjs).
import * as maplibregl from "maplibre-gl";

maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

export { maplibregl };

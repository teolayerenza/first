// Datos base REALES del casco: cuadras, casco y zonas generadas por scripts/build-real-data.ts
// a partir de OpenStreetMap (© colaboradores de OpenStreetMap, ODbL). Solo servidor / scripts.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildCasco, buildSegments, buildZones } from "./grid";
import type { LngLat, Segment, Zone } from "./types";

export interface BaseData {
  casco: LngLat[];
  zones: Zone[];
  segments: Segment[];
  source: "osm" | "grilla";
}

let cache: BaseData | null = null;

// turbopackIgnore: sin esto Turbopack rastrea todo el proyecto. data/ entra al deploy por
// outputFileTracingIncludes (next.config.ts).
export function loadBaseData(dir = path.join(/* turbopackIgnore: true */ process.cwd(), "data")): BaseData {
  if (cache) return cache;
  const file = (f: string) => path.join(dir, f);
  if (!existsSync(file("cuadras.json"))) {
    cache = { casco: buildCasco(), zones: buildZones(), segments: buildSegments(), source: "grilla" };
    return cache;
  }
  const casco = JSON.parse(readFileSync(file("casco_urbano.geojson"), "utf8")).features[0].geometry.coordinates[0] as LngLat[];
  const zones = (
    JSON.parse(readFileSync(file("zonas.geojson"), "utf8")).features as {
      properties: Omit<Zone, "ring">;
      geometry: { coordinates: LngLat[][] };
    }[]
  ).map((f) => ({ ...f.properties, ring: f.geometry.coordinates[0] }));
  const segments = JSON.parse(readFileSync(file("cuadras.json"), "utf8")) as Segment[];
  cache = { casco, zones, segments, source: "osm" };
  return cache;
}

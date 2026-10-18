// Descarga las calles reales del casco desde OpenStreetMap y las parte en cuadras.
//
//   npm run data:osm            → escribe data/osm-segments.geojson
//   npm run data:grid           → regenera supabase/seed.sql usando esas cuadras
//
// Datos © colaboradores de OpenStreetMap, licencia ODbL. Hay que mostrar la atribución en la app.
// Overpass es un servicio comunitario: no lo corras en loop.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { buildCasco, buildZones } from "../src/lib/domain/grid";
import { splitWays, type OsmWay } from "../src/lib/osm/split";
import type { LngLat, Zone } from "../src/lib/domain/types";

const OVERPASS = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";

function readRing(path: string): LngLat[] | null {
  if (!existsSync(path)) return null;
  const fc = JSON.parse(readFileSync(path, "utf8"));
  const g = fc.type === "FeatureCollection" ? fc.features[0].geometry : fc.geometry ?? fc;
  return g.coordinates[0];
}

function readZones(path: string): Zone[] | null {
  if (!existsSync(path)) return null;
  const fc = JSON.parse(readFileSync(path, "utf8"));
  return fc.features.map((f: { properties: { id: number; slug: string; name: string }; geometry: { coordinates: LngLat[][] } }) => ({
    ...f.properties,
    ring: f.geometry.coordinates[0],
  }));
}

async function main() {
  // Si dibujaste el casco y las zonas reales en geojson.io, se usan esos; si no, los de la grilla.
  const casco = readRing("data/casco_urbano.geojson") ?? buildCasco();
  const zones = readZones("data/zonas.geojson") ?? buildZones();
  const poly = casco.map(([lng, lat]) => `${lat} ${lng}`).join(" ");
  const query = `
    [out:json][timeout:120];
    way["highway"~"^(trunk|primary|secondary|tertiary|unclassified|residential|living_street)$"](poly:"${poly}");
    out body geom;`;

  console.log("Consultando Overpass…");
  const res = await fetch(OVERPASS, { method: "POST", body: new URLSearchParams({ data: query }) });
  if (!res.ok) throw new Error(`Overpass respondió ${res.status}`);
  const body = (await res.json()) as { elements: (OsmWay & { type: string })[] };
  const ways = body.elements.filter((e) => e.type === "way" && e.geometry?.length >= 2);
  console.log(`${ways.length} vías`);

  const segments = splitWays(ways, casco, zones);
  const km = segments.reduce((a, s) => a + s.lengthM, 0) / 1000;
  const cobbled = segments.filter((s) => s.isCobbled).length;
  console.log(`${segments.length} cuadras · ${km.toFixed(1)} km · ${cobbled} empedradas según OSM`);

  mkdirSync("data", { recursive: true });
  writeFileSync(
    "data/osm-segments.geojson",
    JSON.stringify({
      type: "FeatureCollection",
      attribution: "© OpenStreetMap contributors, ODbL",
      features: segments.map(({ coords, ...props }) => ({
        type: "Feature",
        properties: props,
        geometry: { type: "LineString", coordinates: coords },
      })),
    }),
  );
  console.log("Listo: data/osm-segments.geojson. Revisalo en geojson.io (sobre todo las diagonales).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

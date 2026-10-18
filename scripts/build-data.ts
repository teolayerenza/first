// Genera los archivos de datos base y el seed de Supabase.
//
//   data/casco_urbano.geojson   polígono del casco (si no existe, el de la grilla)
//   data/zonas.geojson          cuadrantes entre avenidas (si no existe, los de la grilla)
//   supabase/seed.sql           casco + zonas + cuadras (de data/osm-segments.geojson si existe; si no, grilla sintética)
//
// Los archivos de data/ se pueden editar a mano en geojson.io: este script no los pisa si ya existen.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildCasco, buildSegments, buildZones } from "../src/lib/domain/grid";
import type { LngLat, Segment, Zone } from "../src/lib/domain/types";

mkdirSync("data", { recursive: true });

const fc = (features: unknown[]) => ({ type: "FeatureCollection", features });

if (!existsSync("data/casco_urbano.geojson")) {
  writeFileSync(
    "data/casco_urbano.geojson",
    JSON.stringify(fc([{ type: "Feature", properties: { name: "Casco urbano de La Plata" }, geometry: { type: "Polygon", coordinates: [buildCasco()] } }]), null, 1),
  );
}
if (!existsSync("data/zonas.geojson")) {
  writeFileSync(
    "data/zonas.geojson",
    JSON.stringify(fc(buildZones().map(({ ring, ...p }) => ({ type: "Feature", properties: p, geometry: { type: "Polygon", coordinates: [ring] } }))), null, 1),
  );
}

const casco: LngLat[] = JSON.parse(readFileSync("data/casco_urbano.geojson", "utf8")).features[0].geometry.coordinates[0];
const zones: Zone[] = JSON.parse(readFileSync("data/zonas.geojson", "utf8")).features.map(
  (f: { properties: Omit<Zone, "ring">; geometry: { coordinates: LngLat[][] } }) => ({ ...f.properties, ring: f.geometry.coordinates[0] }),
);

let segments: Segment[];
let source: string;
if (existsSync("data/cuadras.json")) {
  source = "OpenStreetMap (data/cuadras.json, scripts/build-real-data.ts)";
  segments = JSON.parse(readFileSync("data/cuadras.json", "utf8"));
} else if (existsSync("data/osm-segments.geojson")) {
  source = "OpenStreetMap (data/osm-segments.geojson)";
  segments = JSON.parse(readFileSync("data/osm-segments.geojson", "utf8")).features.map(
    (f: { properties: Omit<Segment, "coords">; geometry: { coordinates: LngLat[] } }) => ({ ...f.properties, coords: f.geometry.coordinates }),
  );
} else {
  source = "grilla SINTÉTICA (correr `npm run data:osm` para usar las calles reales)";
  segments = buildSegments();
}

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const poly = (ring: LngLat[]) => `st_setsrid(st_geomfromgeojson(${q(JSON.stringify({ type: "Polygon", coordinates: [ring] }))}), 4326)`;
const line = (c: LngLat[]) => `st_setsrid(st_geomfromgeojson(${q(JSON.stringify({ type: "LineString", coordinates: c }))}), 4326)`;

const lines = [
  `-- Generado por scripts/build-data.ts. Cuadras: ${source}.`,
  `-- Calles © colaboradores de OpenStreetMap (ODbL) cuando la fuente es OSM.`,
  `set search_path = public, extensions;`,
  `insert into casco (geom) values (${poly(casco)}) on conflict (id) do update set geom = excluded.geom;`,
  ...zones.map((z) => `insert into zones (id, slug, name, geom) values (${z.id}, ${q(z.slug)}, ${q(z.name)}, ${poly(z.ring)}) on conflict (id) do nothing;`),
  ...segments.map(
    (s) =>
      `insert into segments (id, street_name, between_a, between_b, is_avenue, surface, zone_id, geom, length_m) values (${s.id}, ${q(s.streetName)}, ${q(s.betweenA)}, ${q(s.betweenB)}, ${s.isAvenue}, ${q(s.isCobbled ? "sett" : "asphalt")}, ${s.zoneId}, ${line(s.coords)}, ${s.lengthM}) on conflict (id) do nothing;`,
  ),
  `select take_snapshot();`,
];
writeFileSync("supabase/seed.sql", lines.join("\n") + "\n");
console.log(`seed.sql: ${zones.length} zonas, ${segments.length} cuadras (${source}).`);

// Arma las cuadras REALES del casco a partir de las calles de OpenStreetMap del partido de La Plata.
//
//   npm run data:osm                                   → data/osm-raw.json (Overpass, actual)
//   npx tsx scripts/build-real-data.ts data/osm-raw.json
//
// También acepta el extracto de 2018 (scripts/extract_osmnx_laplata.py).
// Las cuadras que ya existían en data/cuadras.json conservan su id (misma calle y esquinas),
// así los aportes guardados siguen apuntando a la cuadra correcta; las nuevas toman ids nuevos.
//
// Escribe data/cuadras.json, data/casco_urbano.geojson y data/zonas.geojson.
// El casco y las zonas se calculan de las avenidas reales: el casco es el cuadrilátero de la
// Circunvalación (31, 32, 72 y 122) y cada zona, el cuadrante entre dos pares de avenidas.
// Datos © colaboradores de OpenStreetMap (ODbL).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { haversineM, lineLengthM, midpoint, pointInRing, projectOnLine } from "../src/lib/domain/geo";
import type { LngLat, Segment, Zone } from "../src/lib/domain/types";

interface Edge {
  u: string;
  v: string;
  name: string;
  highway: string;
  surface?: string;
  coords: LngLat[];
}

interface OverpassWay {
  type: string;
  nodes: number[];
  geometry: { lat: number; lon: number }[];
  tags: Record<string, string>;
}

/** Overpass trae vías enteras: se parten en cada nodo que comparten con otra vía (esquinas). */
function overpassToEdges(ways: OverpassWay[]): Edge[] {
  const uses = new Map<number, number>();
  for (const w of ways) for (const n of new Set(w.nodes)) uses.set(n, (uses.get(n) ?? 0) + 1);
  const out: Edge[] = [];
  for (const w of ways) {
    if (w.type !== "way" || !w.tags.name || w.nodes.length !== w.geometry.length) continue;
    let from = 0;
    for (let i = 1; i < w.nodes.length; i++) {
      if (i < w.nodes.length - 1 && (uses.get(w.nodes[i]) ?? 0) < 2) continue;
      out.push({
        u: String(w.nodes[from]),
        v: String(w.nodes[i]),
        name: w.tags.name,
        highway: w.tags.highway,
        surface: w.tags.surface,
        coords: w.geometry.slice(from, i + 1).map((g) => [g.lon, g.lat]),
      });
      from = i;
    }
  }
  return out;
}

const COBBLED = /^(sett|cobblestone|unhewn_cobblestone)$/;

/** "Avenida 7 - Ing. Monteverde" → "7"; "Diagonal 74 - Bolívar" → "Diag. 74"; "Avenida de Circunvalación 72" → "72". */
export function streetKey(name: string): string | null {
  const n = name.trim();
  if (!n) return null;
  const diag = n.match(/^diagonal\s+(\d+)/i);
  if (diag) return `Diag. ${diag[1]}`;
  const num = n.match(/^(?:calle|avenida(?: de circunvalaci[oó]n)?|av\.?|boulevard|bv\.?)\s+(\d+(?:\s+(?:bis|[a-d])\b)?)/i);
  if (num) return num[1].replace(/\s+(bis|[a-d])$/i, (_m, x: string) => ` ${x.length > 1 ? "bis" : x.toUpperCase()}`);
  return n.split(" - ")[0];
}

function label(name: string, key: string): { streetName: string; isAvenue: boolean } {
  const isAvenue = /^avenida/i.test(name);
  if (key.startsWith("Diag.")) return { streetName: key.replace("Diag.", "Diagonal"), isAvenue: true };
  if (/^\d+$/.test(key)) return { streetName: isAvenue ? `Av. ${key}` : `Calle ${key}`, isAvenue };
  return { streetName: key, isAvenue };
}

// ── 1. Leer y limpiar ────────────────────────────────────────────────────────────────────
const input = process.argv[2] ?? "data/osm-raw.json";
const parsed = JSON.parse(readFileSync(input, "utf8")) as Edge[] | { elements: OverpassWay[] };
const fromOverpass = !Array.isArray(parsed);
const raw = (Array.isArray(parsed) ? parsed : overpassToEdges(parsed.elements)).map((e) => {
  // Algunos tramos traen varios nombres como texto de lista de Python: "[u'Calle 41', u'Calle 41 Bis']".
  const m = e.name.match(/^\[u?'([^']+)'/);
  return m ? { ...e, name: m[1] } : e;
});
const seen = new Set<string>();
const edges = raw.filter((e) => {
  if (!e.name || /service|razed/.test(e.highway) || e.coords.length < 2) return false;
  const k = [e.u, e.v].sort().join("|") + "|" + streetKey(e.name);
  if (seen.has(k)) return false; // osmnx guarda las calles doble mano dos veces
  seen.add(k);
  return true;
});

// ── 2. Nodos: coordenadas y calles que pasan ────────────────────────────────────────────
const nodeCoord = new Map<string, LngLat>();
const nodeEdges = new Map<string, number[]>();
edges.forEach((e, i) => {
  nodeCoord.set(e.u, e.coords[0]);
  nodeCoord.set(e.v, e.coords[e.coords.length - 1]);
  for (const n of [e.u, e.v]) (nodeEdges.get(n) ?? nodeEdges.set(n, []).get(n)!).push(i);
});
const keysAt = (n: string) => new Set((nodeEdges.get(n) ?? []).map((i) => streetKey(edges[i].name)!));

// ── 3. Casco: esquinas de la Circunvalación, cruzando las rectas de las avenidas ────────
const NEAR: LngLat = [-57.9545, -34.9214]; // Plaza Moreno
type Line = { p: [number, number]; d: [number, number] };
function fitLine(key: string, keep: (c: LngLat) => boolean): Line {
  const pts = edges.filter((e) => streetKey(e.name) === key).flatMap((e) => e.coords).filter(keep);
  if (pts.length < 2) throw new Error(`Avenida ${key} sin datos`);
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  let sxx = 0, sxy = 0, syy = 0;
  for (const [x, y] of pts) {
    sxx += (x - mx) ** 2;
    sxy += (x - mx) * (y - my);
    syy += (y - my) ** 2;
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { p: [mx, my], d: [Math.cos(angle), Math.sin(angle)] };
}
function intersect(a: Line, b: Line): LngLat {
  const det = a.d[0] * -b.d[1] - a.d[1] * -b.d[0];
  const t = ((b.p[0] - a.p[0]) * -b.d[1] - (b.p[1] - a.p[1]) * -b.d[0]) / det;
  return [Math.round((a.p[0] + t * a.d[0]) * 1e7) / 1e7, Math.round((a.p[1] + t * a.d[1]) * 1e7) / 1e7];
}
const nearCasco = (c: LngLat) => haversineM(c, NEAR) < 4300;
const circ = Object.fromEntries(["31", "32", "72", "122"].map((k) => [k, fitLine(k, nearCasco)]));
const corners = [intersect(circ["31"], circ["32"]), intersect(circ["32"], circ["122"]), intersect(circ["122"], circ["72"]), intersect(circ["72"], circ["31"])];
const cx = corners.reduce((s, c) => s + c[0], 0) / 4;
const cy = corners.reduce((s, c) => s + c[1], 0) / 4;
// Se agranda un poco para que las avenidas de la Circunvalación queden adentro.
const grow = (p: LngLat, f = 1.012): LngLat => [cx + (p[0] - cx) * f, cy + (p[1] - cy) * f];
const casco: LngLat[] = [...corners.map((c) => grow(c)), grow(corners[0])];

// ── 4. Zonas: cuadrantes entre avenidas reales ──────────────────────────────────────────
/** Recta que mejor ajusta los nodos de una avenida dentro del casco. */
const avenueLine = (key: string) => fitLine(key, (c) => pointInRing(c, casco));
const PARALLEL = ["122", "1", "7", "13", "19", "25", "31"];
const CROSS = ["32", "38", "44", "51", "60", "66", "72"]; // la franja 51–53 va con 53–60
const lines = new Map([...PARALLEL, ...CROSS].map((k) => [k, avenueLine(k)]));
const zones: Zone[] = [];
for (let i = 0; i < PARALLEL.length - 1; i++) {
  for (let j = 0; j < CROSS.length - 1; j++) {
    const [pa, pb, qa, qb] = [PARALLEL[i], PARALLEL[i + 1], CROSS[j], CROSS[j + 1]];
    const L = (k: string) => lines.get(k)!;
    const ring: LngLat[] = [intersect(L(pa), L(qa)), intersect(L(pb), L(qa)), intersect(L(pb), L(qb)), intersect(L(pa), L(qb))];
    // Las zonas del borde se estiran hasta el casco, para que las avenidas límite entren.
    const g = (p: LngLat): LngLat => grow(p, 1 + (i === 0 || i === PARALLEL.length - 2 || j === 0 || j === CROSS.length - 2 ? 0.004 : 0));
    zones.push({ id: zones.length + 1, slug: `${pa}-${pb}-${qa}-${qb}`, name: `${pa}–${pb} / ${qa}–${qb}`, ring: [...ring.map(g), g(ring[0])] });
  }
}

// ── 5. Cuadras: se unen los tramos de una misma calle hasta la próxima esquina ──────────
const used = new Set<number>();
const isCorner = (n: string, key: string) => {
  const ks = keysAt(n);
  return ks.size > 1 || (nodeEdges.get(n) ?? []).length !== 2 || !ks.has(key);
};
function walk(start: string, from: number, key: string): { coords: LngLat[]; end: string } {
  // Avanza desde `start` por la arista `from` hasta una esquina; devuelve coordenadas en orden.
  let coords: LngLat[] = [];
  let node = start;
  let ei = from;
  while (true) {
    used.add(ei);
    const e = edges[ei];
    const fwd = e.u === node;
    const c = fwd ? e.coords : [...e.coords].reverse();
    coords = coords.length ? [...coords, ...c.slice(1)] : c;
    node = fwd ? e.v : e.u;
    if (isCorner(node, key)) return { coords, end: node };
    const next = (nodeEdges.get(node) ?? []).find((j) => j !== ei && !used.has(j) && streetKey(edges[j].name) === key);
    if (next === undefined) return { coords, end: node };
    ei = next;
  }
}
const crossName = (n: string, key: string) => {
  const others = [...keysAt(n)].filter((k) => k !== key);
  others.sort((a, b) => (parseInt(a.replace(/\D/g, "")) || 999) - (parseInt(b.replace(/\D/g, "")) || 999));
  return others[0] ?? null;
};

const segments: Segment[] = [];
edges.forEach((e, i) => {
  if (used.has(i)) return;
  const key = streetKey(e.name)!;
  // Arranca desde la esquina más cercana hacia atrás, para no partir una cuadra al medio.
  let start = e.u;
  let first = i;
  const back = new Set<number>([i]);
  while (!isCorner(start, key)) {
    const prev = (nodeEdges.get(start) ?? []).find((j) => !back.has(j) && !used.has(j) && streetKey(edges[j].name) === key);
    if (prev === undefined) break;
    back.add(prev);
    first = prev;
    start = edges[prev].u === start ? edges[prev].v : edges[prev].u;
  }
  const { coords, end } = walk(start, first, key);
  const a = crossName(start, key);
  const b = crossName(end, key);
  const lengthM = lineLengthM(coords);
  const mid = midpoint(coords);
  if (!a || !b || a === b || lengthM < 20 || !pointInRing(mid, casco)) return;
  const zone = zones.find((z) => pointInRing(mid, z.ring));
  if (!zone) return;
  const [lo, hi] = [a, b].sort((x, y) => (parseInt(x.replace(/\D/g, "")) || 0) - (parseInt(y.replace(/\D/g, "")) || 0));
  const { streetName, isAvenue } = label(e.name, key);
  segments.push({
    id: segments.length + 1,
    streetName,
    betweenA: lo,
    betweenB: hi,
    isAvenue,
    isCobbled: COBBLED.test(e.surface ?? ""),
    zoneId: zone.id,
    coords: coords.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]),
    lengthM: Math.round(lengthM * 10) / 10,
  });
});

// Avenidas con boulevard: OSM tiene una vía por mano. Se queda una sola cuadra por calle y esquinas.
const byKey = new Map<string, Segment>();
for (const sgm of segments) {
  const k = `${sgm.streetName}|${sgm.betweenA}|${sgm.betweenB}`;
  if (!byKey.has(k)) byKey.set(k, sgm);
}
// Y si una mano no comparte el nodo de alguna esquina, queda una cuadra más larga encimada a otra
// (la 7 "entre 50 y 53" sobre "50 y 51" + "51 y 53"): se descarta la que tiene el medio sobre el
// interior de otra más corta de la misma calle.
const sameStreet = Map.groupBy(byKey.values(), (x) => x.streetName);
for (const [k, sgm] of byKey) {
  const mid = midpoint(sgm.coords);
  const covered = sameStreet.get(sgm.streetName)!.some(
    (o) =>
      o !== sgm &&
      (o.lengthM < sgm.lengthM || (o.lengthM === sgm.lengthM && o.id < sgm.id)) &&
      projectOnLine(mid, o.coords).distanceM < 15 &&
      Math.min(haversineM(mid, o.coords[0]), haversineM(mid, o.coords.at(-1)!)) > 15,
  );
  if (covered) byKey.delete(k);
}
segments.length = 0;
// Ids estables: misma calle y mismas esquinas que en la versión anterior → mismo id.
const previous: Segment[] = existsSync("data/cuadras.json") ? JSON.parse(readFileSync("data/cuadras.json", "utf8")) : [];
const oldId = new Map(previous.map((p) => [`${p.streetName}|${p.betweenA}|${p.betweenB}`, p.id]));
let nextId = previous.reduce((m, p) => Math.max(m, p.id), 0);
for (const [k, sgm] of byKey) segments.push({ ...sgm, id: oldId.get(k) ?? ++nextId });
segments.sort((x, y) => x.id - y.id);
const kept = segments.filter((x) => oldId.has(`${x.streetName}|${x.betweenA}|${x.betweenB}`)).length;

const km = segments.reduce((s, x) => s + x.lengthM, 0) / 1000;
const fc = (features: unknown[]) => ({ type: "FeatureCollection", attribution: `© colaboradores de OpenStreetMap (ODbL), ${fromOverpass ? new Date().getFullYear() : 2018}`, features });
writeFileSync("data/cuadras.json", JSON.stringify(segments));
writeFileSync("data/casco_urbano.geojson", JSON.stringify(fc([{ type: "Feature", properties: { name: "Casco urbano de La Plata" }, geometry: { type: "Polygon", coordinates: [casco] } }])));
writeFileSync("data/zonas.geojson", JSON.stringify(fc(zones.map(({ ring, ...p }) => ({ type: "Feature", properties: p, geometry: { type: "Polygon", coordinates: [ring] } })))));
const side = (a: LngLat, b: LngLat) => (haversineM(a, b) / 1000).toFixed(2);
console.log(`casco: lados ${side(corners[0], corners[1])} × ${side(corners[1], corners[2])} km`);
console.log(`${segments.length} cuadras · ${km.toFixed(1)} km · ${zones.length} zonas`);
console.log(`ids: ${kept} conservadas de ${previous.length} anteriores, ${segments.length - kept} nuevas, ${segments.filter((x) => x.isCobbled).length} empedradas`);

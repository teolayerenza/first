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
  /** Mano única: `coords` va en el sentido del tránsito. */
  oneway?: boolean;
  coords: LngLat[];
}

interface OverpassWay {
  id: number;
  type: string;
  nodes: number[];
  geometry: { lat: number; lon: number }[];
  tags: Record<string, string>;
}

// Vías que OSM tiene sin nombre y son parte de calles del casco.
const UNNAMED = new Map<number, string>([
  // Plaza Moreno: los lados de 14 y 12, y cada curva del contorno con la calle que continúa
  [23406181, "Calle 14"],
  [51126237, "Calle 12"],
  [389621308, "Calle 14"],
  [51126238, "Calle 50"],
  [389619321, "Calle 50"],
  [51126236, "Calle 54"],
  // Rotondas de 52 y 122 y de 60 y 122
  ...[25975245, 154252380, 156366596, 278863455, 311592429, 346953669, 362077391, 482520731].map((id): [number, string] => [id, "Rotonda 52 y 122"]),
  ...[278863462, 482662530, 482662531, 482662532, 482662533, 482662534, 482662535, 482662536].map((id): [number, string] => [id, "Rotonda 60 y 122"]),
  // Curvas del óvalo del Parque San Martín
  ...[23409169, 23409171, 283708239, 653864554, 1324681499].map((id): [number, string] => [id, "Parque San Martín"]),
  // La 1 sigue de largo junto a Plaza Alsina (1 y 38)
  [173167556, "Avenida 1"],
]);

/** Overpass trae vías enteras: se parten en cada nodo que comparten con otra vía (esquinas). */
function overpassToEdges(ways: OverpassWay[]): Edge[] {
  const uses = new Map<number, number>();
  for (const w of ways) for (const n of new Set(w.nodes)) uses.set(n, (uses.get(n) ?? 0) + 1);
  const out: Edge[] = [];
  for (const w of ways) {
    const name = w.tags.name ?? UNNAMED.get(w.id);
    if (w.type !== "way" || !name || w.nodes.length !== w.geometry.length) continue;
    // oneway=-1: la vía está dibujada al revés del tránsito.
    const reversed = w.tags.oneway === "-1";
    const nodes = reversed ? [...w.nodes].reverse() : w.nodes;
    const geometry = reversed ? [...w.geometry].reverse() : w.geometry;
    const oneway = reversed || w.tags.oneway === "yes" || w.tags.junction === "roundabout";
    let from = 0;
    for (let i = 1; i < nodes.length; i++) {
      if (i < nodes.length - 1 && (uses.get(nodes[i]) ?? 0) < 2) continue;
      out.push({
        u: String(nodes[from]),
        v: String(nodes[i]),
        name,
        highway: w.tags.highway,
        surface: w.tags.surface,
        oneway,
        coords: geometry.slice(from, i + 1).map((g) => [g.lon, g.lat]),
      });
      from = i;
    }
  }
  return out;
}

const COBBLED = /^(sett|cobblestone|unhewn_cobblestone)$/;
// Avenidas de Circunvalación: boulevard con rambla en el medio.
const BORDER = new Set(["31", "32", "72", "122"]);

/** "Avenida 7 - Ing. Monteverde" → "7"; "Diagonal 74 - Bolívar" → "Diag. 74"; "Avenida de Circunvalación 72" → "72". */
export function streetKey(name: string): string | null {
  const n = name.trim();
  if (!n) return null;
  const diag = n.match(/^diagonal\s+(\d+)/i);
  if (diag) return `Diag. ${diag[1]}`;
  const num = n.match(/^(?:calle|avenida(?: de circunvalaci[oó]n)?|av\.?|boulevard|bv\.?)\s+(\d+(?:\s+(?:bis|[a-d])\b)?)/i);
  // La mano de afuera de la 31 está en OSM como "Calle 131".
  if (num?.[1] === "131") return "31";
  if (num) return num[1].replace(/\s+(bis|[a-d])$/i, (_m, x: string) => ` ${x.length > 1 ? "bis" : x.toUpperCase()}`);
  return n.split(" - ")[0];
}

function label(name: string, key: string): { streetName: string; isAvenue: boolean } {
  const isAvenue = /^avenida/i.test(name) || BORDER.has(key);
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
const crossNames = (n: string, key: string) => [...keysAt(n)].filter((k) => k !== key);

// Una esquina puede tener varias calles (la 7 con 50 y la Diagonal 74). El nombre se elige siempre
// igual, para que las dos manos de una avenida queden con las mismas esquinas: las calles 1–31
// (y 115–122) se nombran por las 32–72 y al revés; las diagonales y el resto, por las 1–31.
function family(k: string): number {
  if (k.startsWith("Diag.")) return 3;
  const v = parseInt(k);
  if (Number.isNaN(v)) return 4;
  if (v <= 31 || (v >= 115 && v <= 122)) return 0;
  if (v <= 72) return 1;
  return 2;
}
function cornerName(key: string, names: string[]): string | null {
  const own = family(key);
  const rank = (k: string) => {
    const f = family(k);
    return own === 0 ? [1, 2, 3, 4, 0][f] : own === 1 ? [0, 2, 3, 4, 1][f] : f;
  };
  return [...names].sort((a, b) => rank(a) - rank(b) || (parseInt(a) || 999) - (parseInt(b) || 999))[0] ?? null;
}

// Tramo de una calle entre dos esquinas, antes de filtrar y nombrar. Si es mano única, `coords`
// va en el sentido del tránsito.
interface Piece {
  key: string;
  name: string;
  surface?: string;
  oneway: boolean;
  coords: LngLat[];
  startNames: string[];
  endNames: string[];
}

const pieces: Piece[] = [];
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
  const f = edges[first];
  const oneway = !!f.oneway;
  const along = f.u === start; // el recorrido va en el sentido en que está dibujada la primera arista
  const [a, b] = [crossNames(start, key), crossNames(end, key)];
  pieces.push(
    oneway && !along
      ? { key, name: e.name, surface: e.surface, oneway, coords: [...coords].reverse(), startNames: b, endNames: a }
      : { key, name: e.name, surface: e.surface, oneway, coords, startNames: a, endNames: b },
  );
});

// Avenidas con boulevard: OSM tiene una vía por mano y a veces una mano no tiene el nodo de una
// esquina que la otra sí (la 7 "entre 50 y 53" frente a "50 y 51" + "51 y 53"). Se parte esa
// cuadra donde la otra mano tiene la esquina, para que las dos manos queden cuadra por cuadra.
function cutAt(coords: LngLat[], p: LngLat): [LngLat[], LngLat[]] {
  let best = 1;
  let bestD = Infinity;
  for (let i = 1; i < coords.length; i++) {
    const d = projectOnLine(p, [coords[i - 1], coords[i]]).distanceM;
    if (d < bestD) [best, bestD] = [i, d];
  }
  const q = projectOnLine(p, [coords[best - 1], coords[best]]).point;
  return [[...coords.slice(0, best), q], [q, ...coords.slice(best)]];
}
const byStreet = Map.groupBy(pieces, (x) => x.key);
const split: Piece[] = [];
const queue = [...pieces];
while (queue.length) {
  const pc = queue.pop()!;
  const ends = [pc.coords[0], pc.coords.at(-1)!];
  const cut = byStreet
    .get(pc.key)!
    .filter((o) => o !== pc)
    .flatMap((o) => [
      { p: o.coords[0], names: o.startNames },
      { p: o.coords.at(-1)!, names: o.endNames },
    ])
    .find(({ p, names }) => {
      if (!names.length || names.some((n) => pc.startNames.includes(n) || pc.endNames.includes(n))) return false;
      const proj = projectOnLine(p, pc.coords);
      return proj.distanceM < 40 && ends.every((x) => haversineM(proj.point, x) > 15);
    });
  if (!cut) {
    split.push(pc);
    continue;
  }
  const [c1, c2] = cutAt(pc.coords, cut.p);
  queue.push({ ...pc, coords: c1, endNames: cut.names }, { ...pc, coords: c2, startNames: cut.names });
}

// Las diagonales cruzan cada esquina en dos nodos a pocos metros (la 28 y la 68). Ese tramito se
// suma a la cuadra vecina y la esquina queda con los dos nombres.
const ptKey = (p: LngLat) => `${p[0]},${p[1]}`;
const union = (...xs: string[][]) => [...new Set(xs.flat())];
for (let changed = true; changed; ) {
  changed = false;
  for (const t of split) {
    if (lineLengthM(t.coords) >= 25 || !t.startNames.length || !t.endNames.length) continue;
    if (t.startNames.some((n) => BORDER.has(n) && t.endNames.includes(n))) continue; // cruce de la rambla
    const [ts, te] = [ptKey(t.coords[0]), ptKey(t.coords.at(-1)!)];
    const same = split.filter((n) => n !== t && n.key === t.key);
    const after = same.find((n) => ptKey(n.coords[0]) === te);
    const before = same.find((n) => ptKey(n.coords.at(-1)!) === ts);
    if (after) {
      after.coords = [...t.coords, ...after.coords.slice(1)];
      after.startNames = union(t.startNames, t.endNames);
    } else if (before) {
      before.coords = [...before.coords, ...t.coords.slice(1)];
      before.endNames = union(t.startNames, t.endNames);
    } else continue;
    split.splice(split.indexOf(t), 1);
    changed = true;
    break;
  }
}

// Donde las dos manos se juntan a pocos metros de una esquina (la 1 llegando a 45), ese nodo toma el
// nombre de la esquina.
for (const pc of split) {
  for (const [p, names] of [[pc.coords[0], pc.startNames], [pc.coords.at(-1)!, pc.endNames]] as const) {
    if (names.length) continue;
    const near = split.flatMap((o) => (o.key === pc.key ? [{ p: o.coords[0], n: o.startNames }, { p: o.coords.at(-1)!, n: o.endNames }] : []));
    const named = near.find((x) => x.n.length && haversineM(x.p, p) < 15);
    if (named) names.push(...named.n);
  }
}

// Si una calle se bifurca a mitad de cuadra (la 1 entre 44 y 45), el nodo no tiene nombre de esquina:
// el tramo se une con el que sigue y la cuadra va de esquina a esquina.
for (let changed = true; changed; ) {
  changed = false;
  for (const t of split) {
    if (t.endNames.length) continue;
    const end = ptKey(t.coords.at(-1)!);
    // Un tramo doble mano puede estar dibujado al revés: se da vuelta para seguir.
    const flip = split.find((n) => n !== t && n.key === t.key && !n.oneway && ptKey(n.coords.at(-1)!) === end);
    if (flip) [flip.coords, flip.startNames, flip.endNames] = [[...flip.coords].reverse(), flip.endNames, flip.startNames];
    // Sin cerrar un rulo que vuelve a la misma esquina (entrada y salida de una rotonda).
    const next = split.find(
      (n) => n !== t && n.key === t.key && ptKey(n.coords[0]) === end && !n.endNames.some((x) => t.startNames.includes(x)),
    );
    if (!next) continue;
    next.coords = [...t.coords, ...next.coords.slice(1)];
    next.startNames = t.startNames;
    split.splice(split.indexOf(t), 1);
    changed = true;
    break;
  }
}

// Avenidas doble mano que OSM dibuja en parte con una sola vía: ahí se arma una cuadra por mano,
// corrida unos metros hacia la derecha del sentido del tránsito.
// La 25 de 32 a 72 y la 1 de 45 a 72 (sin rambla, pero doble mano).
const between = (x: string | null, lo: number, hi: number) => !!x && /^\d+$/.test(x) && +x >= lo && +x <= hi;
const pastAvenues = (x: string | null) => !!x && (!/^\d+$/.test(x) || +x <= 1 || +x >= 115) && x !== "Plaza Moreno";
const doubleHand = (key: string, a: string | null, b: string | null) =>
  key === "25" ||
  key === "122" ||
  (key === "1" && between(a, 45, 72) && between(b, 45, 72)) ||
  (key === "53" && between(a, 8, 10) && between(b, 8, 10)) ||
  (key === "60" && [a, b].every((x) => between(x, 118, 122) || !!x?.startsWith("Rotonda"))) ||
  (key === "52" && pastAvenues(a) && pastAvenues(b));
function offsetRight(coords: LngLat[], m: number): LngLat[] {
  return coords.map((p, i) => {
    const [a, b] = [coords[Math.max(0, i - 1)], coords[Math.min(coords.length - 1, i + 1)]];
    const kx = 111_320 * Math.cos((p[1] * Math.PI) / 180);
    const [dx, dy] = [(b[0] - a[0]) * kx, (b[1] - a[1]) * 110_574];
    const len = Math.hypot(dx, dy) || 1;
    return [p[0] + ((dy / len) * m) / kx, p[1] + ((-dx / len) * m) / 110_574];
  });
}
for (const pc of split.filter((x) => !x.oneway && doubleHand(x.key, cornerName(x.key, x.startNames), cornerName(x.key, x.endNames)))) {
  const back = [...pc.coords].reverse();
  split.splice(
    split.indexOf(pc),
    1,
    { ...pc, oneway: true, coords: offsetRight(pc.coords, 5) },
    { ...pc, oneway: true, coords: offsetRight(back, 5), startNames: pc.endNames, endNames: pc.startNames },
  );
}

// En un boulevard, cada mano puede cruzarse con una calle distinta en la misma esquina (una mano con
// la 28 y la otra con la 35). Las esquinas a menos de 30 m de la otra mano comparten los nombres.
const endsByStreet = Map.groupBy(
  split.flatMap((pc) => [
    { pc, p: pc.coords[0], names: pc.startNames },
    { pc, p: pc.coords.at(-1)!, names: pc.endNames },
  ]),
  (x) => x.pc.key,
);
const nearNames = (pc: Piece, p: LngLat, names: string[]) =>
  union(names, ...endsByStreet.get(pc.key)!.filter((x) => x.pc !== pc && haversineM(x.p, p) < 30).map((x) => x.names));
// Calles que siguen unos metros fuera del casco hasta su rotonda.
const PAST_BORDER = new Set([...BORDER, "52", "60", "Rotonda 52 y 122", "Rotonda 60 y 122"]);
function farName(pc: Piece, p: LngLat): string | null {
  for (const o of split) {
    if (o === pc || o.key !== pc.key) continue;
    const far = haversineM(o.coords[0], p) < 30 ? o.endNames : haversineM(o.coords.at(-1)!, p) < 30 ? o.startNames : null;
    const name = far && cornerName(pc.key, far);
    if (name && !/^(Plaza|Parque)/.test(name)) return name;
  }
  return null;
}
const numeric = (x: string) => parseInt(x.replace(/\D/g, "")) || 0;
const candidates = split.flatMap((pc) => {
  let [a, b] = [
    cornerName(pc.key, nearNames(pc, pc.coords[0], pc.startNames)),
    cornerName(pc.key, nearNames(pc, pc.coords.at(-1)!, pc.endNames)),
  ];
  if (a === b) [a, b] = [cornerName(pc.key, pc.startNames), cornerName(pc.key, pc.endNames)];
  // Una avenida que cruza una plaza por el medio (la 7 en Plaza Olazábal) empieza y termina en la
  // plaza: se nombra por las esquinas de las cuadras vecinas, "e/ 37 y 39 (por Plaza ...)".
  let via = "";
  if (a && a === b && /^(Plaza|Parque)/.test(a)) {
    const [s2, e2] = [farName(pc, pc.coords[0]), farName(pc, pc.coords.at(-1)!)];
    if (s2 && e2 && s2 !== e2) [via, a, b] = [a, s2, e2];
  }
  const lengthM = lineLengthM(pc.coords);
  const mid = midpoint(pc.coords);
  // Los metros en que una calle cruza la rambla entre las dos manos de la Circunvalación.
  const rambla = !!a && a === b && BORDER.has(a) && family(pc.key) < 4 && !BORDER.has(pc.key) && lengthM >= 5 && lengthM < 80;
  if (!a || !b || (a === b && !rambla) || (lengthM < 20 && !rambla)) return [];
  // La mano de afuera de la Circunvalación (31, 32, 72 y 122) queda fuera del límite del casco.
  const border = PAST_BORDER.has(pc.key) && projectOnLine(mid, casco).distanceM < 150;
  if (!pointInRing(mid, casco) && !border) return [];
  // Las zonas del borde están agrandadas y dejan una franja sin zona sobre la avenida que las separa
  // de las de adentro: ahí va la zona más cercana.
  const zone =
    zones.find((z) => pointInRing(mid, z.ring)) ??
    zones.reduce((best, z) => (projectOnLine(mid, z.ring).distanceM < projectOnLine(mid, best.ring).distanceM ? z : best));
  const [lo, hi] = [a, b].sort((x, y) => numeric(x) - numeric(y));
  const { streetName, isAvenue } = label(pc.name, pc.key);
  const segment: Segment = {
    id: 0,
    streetName,
    betweenA: lo,
    betweenB: hi,
    isAvenue,
    isCobbled: COBBLED.test(pc.surface ?? ""),
    zoneId: zone.id,
    coords: pc.coords.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]),
    lengthM: Math.round(lengthM * 10) / 10,
  };
  return [{ key: pc.key, segment, toward: pc.oneway ? b : null, mid, via, rambla }];
});

// Misma calle y mismas esquinas en lugares distintos: las dos manos de una avenida numerada se nombran
// por la calle que tienen al costado (la 7 entre 49 y 50: "mano hacia 6" y "mano hacia 8"; la
// Circunvalación: "mano de adentro" y "mano de afuera"); diagonales, plazas y cruces de rambla, por su
// lado en el mapa ("lado norte"). Vías repetidas en el mismo lugar: queda una.
const PARALLELS = ["122", "121", "120", "119", "118", "117", "116", "115", ...Array.from({ length: 31 }, (_, i) => String(i + 1))];
const candByKey = Map.groupBy(candidates, (c) => c.key);
const distToStreet = (p: LngLat, key: string) =>
  Math.min(...(candByKey.get(key) ?? []).map((c) => projectOnLine(p, c.segment.coords).distanceM));
const cascoCenter: LngLat = [casco.slice(0, -1).reduce((t, p) => t + p[0], 0) / 4, casco.slice(0, -1).reduce((t, p) => t + p[1], 0) / 4];
function hands(key: string, pair: { mid: LngLat }[]): string[] | null {
  if (BORDER.has(key)) {
    const inner = haversineM(pair[0].mid, cascoCenter) < haversineM(pair[1].mid, cascoCenter) ? 0 : 1;
    return pair.map((_, i) => (i === inner ? "mano de adentro" : "mano de afuera"));
  }
  const i = PARALLELS.indexOf(key);
  const n = parseInt(key);
  const [lo, hi] = i >= 0 ? [PARALLELS[i - 1], PARALLELS[i + 1]] : /^\d+$/.test(key) && n > 32 && n < 72 ? [String(n - 1), String(n + 1)] : [];
  const ref = [lo, hi].find((k) => k && candByKey.has(k));
  if (!ref) return null;
  const other = ref === lo ? hi : lo;
  const closer = distToStreet(pair[0].mid, ref) < distToStreet(pair[1].mid, ref) ? 0 : 1;
  return pair.map((_, j) => `mano hacia ${j === closer ? ref : other}`);
}
const COMPASS = ["este", "noreste", "norte", "noroeste", "oeste", "suroeste", "sur", "sureste"];
function sides(group: { mid: LngLat }[]): string[] {
  const cx = group.reduce((t, c) => t + c.mid[0], 0) / group.length;
  const cy = group.reduce((t, c) => t + c.mid[1], 0) / group.length;
  const angle = (c: { mid: LngLat }) => Math.atan2((c.mid[1] - cy) * 111, (c.mid[0] - cx) * 91);
  for (const n of [4, 8]) {
    const names = group.map((c) => COMPASS[((Math.round((angle(c) / (2 * Math.PI)) * n) % n) + n) % n * (8 / n)]);
    if (new Set(names).size === names.length) return names.map((x) => `lado ${x}`);
  }
  return group.map((_, i) => `tramo ${i + 1}`);
}
const segments: Segment[] = [];
for (const group of Map.groupBy(candidates, (c) => `${c.segment.streetName}|${c.segment.betweenA}|${c.segment.betweenB}|${c.via}|${c.rambla}`).values()) {
  const places = group.filter((c, i) => group.slice(0, i).every((o) => haversineM(o.mid, c.mid) > 8));
  // Si una avenida doble mano tiene una sola mano en OSM en esta cuadra, se agrega la otra al lado.
  const [only] = places;
  if (places.length === 1 && doubleHand(only.key, only.segment.betweenA, only.segment.betweenB) && only.toward) {
    const coords = offsetRight([...only.segment.coords].reverse(), 10).map(([x, y]): LngLat => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]);
    const other = only.toward === only.segment.betweenA ? only.segment.betweenB : only.segment.betweenA;
    places.push({ ...only, segment: { ...only.segment, coords }, toward: other, mid: midpoint(coords) });
  }
  const byMano = places.every((c) => c.toward) && new Set(places.map((c) => c.toward)).size > 1 && !only.rambla;
  const side = places.length < 2 ? [] : ((byMano && places.length === 2 && hands(only.key, places)) || sides(places));
  places.forEach((c, i) => {
    const tags = [c.rambla ? "cruce de la rambla" : "", c.via ? `por ${c.via}` : "", side[i] ?? ""].filter(Boolean);
    segments.push(tags.length ? { ...c.segment, betweenB: `${c.segment.betweenB} (${tags.join(", ")})` } : c.segment);
  });
}

// Ids estables: misma calle y mismas esquinas que en la versión anterior → mismo id. Si antes había
// una sola cuadra y ahora hay una por mano, la primera mano hereda el id.
const previous: Segment[] = existsSync("data/cuadras.json") ? JSON.parse(readFileSync("data/cuadras.json", "utf8")) : [];
const oldId = new Map(previous.map((p) => [`${p.streetName}|${p.betweenA}|${p.betweenB}`, p.id]));
let nextId = previous.reduce((m, p) => Math.max(m, p.id), 0);
const taken = new Set<number>();
const keyOf = (x: Segment) => `${x.streetName}|${x.betweenA}|${x.betweenB}`;
const withoutMano = (x: Segment) => keyOf(x).replace(/ \((cruce de la rambla|por|mano|lado|tramo).*\)$/, "");
let kept = 0;
for (const sgm of segments) {
  const id = [oldId.get(keyOf(sgm)), oldId.get(withoutMano(sgm))].find((x) => x !== undefined && !taken.has(x));
  if (id !== undefined) kept++;
  sgm.id = id ?? ++nextId;
  taken.add(sgm.id);
}
segments.sort((x, y) => x.id - y.id);

const km = segments.reduce((s, x) => s + x.lengthM, 0) / 1000;
const fc = (features: unknown[]) => ({ type: "FeatureCollection", attribution: `© colaboradores de OpenStreetMap (ODbL), ${fromOverpass ? new Date().getFullYear() : 2018}`, features });
writeFileSync("data/cuadras.json", JSON.stringify(segments));
writeFileSync("data/casco_urbano.geojson", JSON.stringify(fc([{ type: "Feature", properties: { name: "Casco urbano de La Plata" }, geometry: { type: "Polygon", coordinates: [casco] } }])));
writeFileSync("data/zonas.geojson", JSON.stringify(fc(zones.map(({ ring, ...p }) => ({ type: "Feature", properties: p, geometry: { type: "Polygon", coordinates: [ring] } })))));
const side = (a: LngLat, b: LngLat) => (haversineM(a, b) / 1000).toFixed(2);
console.log(`casco: lados ${side(corners[0], corners[1])} × ${side(corners[1], corners[2])} km`);
console.log(`${segments.length} cuadras · ${km.toFixed(1)} km · ${zones.length} zonas`);
console.log(`ids: ${kept} conservadas de ${previous.length} anteriores, ${segments.length - kept} nuevas, ${segments.filter((x) => x.isCobbled).length} empedradas`);

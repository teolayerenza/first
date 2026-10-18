// Parte las vías de OpenStreetMap en cuadras (tramos entre intersecciones) y les pone nombre
// "Calle 7 e/ 45 y 46". Función pura: la usa scripts/import-osm.ts y se testea con fixtures.

import { lineLengthM, midpoint, pointInRing } from "../domain/geo";
import type { LngLat, Segment, Zone } from "../domain/types";

export interface OsmWay {
  id: number;
  nodes: number[];
  geometry: { lat: number; lon: number }[];
  tags: Record<string, string>;
}

const COBBLED = new Set(["sett", "cobblestone", "paving_stones", "unhewn_cobblestone"]);

/** "Calle 7" → "7", "Avenida 13" → "13", "Diagonal 74" → "Diag. 74". Si no hay número, el nombre tal cual. */
export function shortName(name: string | undefined): string {
  if (!name) return "s/n";
  const diag = name.match(/^diagonal\s+(\d+)/i);
  if (diag) return `Diag. ${diag[1]}`;
  const num = name.match(/(?:calle|avenida|av\.?)\s*(\d+)/i) ?? name.match(/^(\d+)$/);
  return num ? num[1] : name;
}

export function streetLabel(tags: Record<string, string>): { name: string; isAvenue: boolean } {
  const raw = tags.name ?? tags.ref ?? "Calle sin nombre";
  const isAvenue = /^av(enida|\.)/i.test(raw) || ["primary", "secondary", "trunk"].includes(tags.highway ?? "");
  const s = shortName(raw);
  if (s.startsWith("Diag.")) return { name: s.replace("Diag.", "Diagonal"), isAvenue };
  if (/^\d+$/.test(s)) return { name: isAvenue ? `Av. ${s}` : `Calle ${s}`, isAvenue };
  return { name: raw, isAvenue };
}

export function splitWays(ways: OsmWay[], casco: LngLat[], zones: Zone[], minLengthM = 15): Segment[] {
  // Nodo → vías que pasan por él.
  const waysAt = new Map<number, Set<number>>();
  for (const w of ways) for (const n of w.nodes) (waysAt.get(n) ?? waysAt.set(n, new Set()).get(n)!).add(w.id);
  const byId = new Map(ways.map((w) => [w.id, w]));

  /** Nombre de la calle que cruza a `way` en `node`. */
  const crossName = (node: number, way: OsmWay): string | null => {
    const mine = shortName(way.tags.name);
    for (const otherId of waysAt.get(node) ?? []) {
      const other = byId.get(otherId)!;
      const n = shortName(other.tags.name);
      if (otherId !== way.id && n !== mine) return n;
    }
    return null;
  };

  const out: Segment[] = [];
  let id = 1;
  for (const w of ways) {
    const { name, isAvenue } = streetLabel(w.tags);
    let start = 0;
    for (let i = 1; i < w.nodes.length; i++) {
      const isCut = i === w.nodes.length - 1 || crossName(w.nodes[i], w) !== null;
      if (!isCut) continue;
      const coords: LngLat[] = w.geometry.slice(start, i + 1).map((g) => [g.lon, g.lat]);
      const a = crossName(w.nodes[start], w);
      const b = crossName(w.nodes[i], w);
      start = i;
      const lengthM = lineLengthM(coords);
      const mid = midpoint(coords);
      if (lengthM < minLengthM || !a || !b || !pointInRing(mid, casco)) continue;
      const zone = zones.find((z) => pointInRing(mid, z.ring));
      if (!zone) continue;
      const [lo, hi] = [a, b].sort((x, y) => Number(x) - Number(y) || x.localeCompare(y));
      out.push({
        id: id++,
        streetName: name,
        betweenA: lo,
        betweenB: hi,
        isAvenue,
        isCobbled: COBBLED.has(w.tags.surface ?? ""),
        zoneId: zone.id,
        coords,
        lengthM: Math.round(lengthM * 10) / 10,
      });
    }
  }
  return out;
}

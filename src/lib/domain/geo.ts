import type { LngLat } from "./types";

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineM(a: LngLat, b: LngLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
}

export function lineLengthM(coords: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversineM(coords[i - 1], coords[i]);
  return total;
}

/** Proyección equirectangular local en metros alrededor de `origin` (precisa a escala de ciudad). */
function toLocal(p: LngLat, origin: LngLat): [number, number] {
  const kx = 111_320 * Math.cos(toRad(origin[1]));
  return [(p[0] - origin[0]) * kx, (p[1] - origin[1]) * 110_574];
}

export interface Projection {
  distanceM: number;
  point: LngLat;
}

/** Punto más cercano de una polilínea a `p`, y su distancia en metros. */
export function projectOnLine(p: LngLat, coords: LngLat[]): Projection {
  let best: Projection = { distanceM: Infinity, point: coords[0] };
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const [ax, ay] = toLocal(a, p);
    const [bx, by] = toLocal(b, p);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const d = Math.hypot(cx, cy);
    if (d < best.distanceM) {
      best = { distanceM: d, point: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])] };
    }
  }
  return best;
}

/** Ray casting. `ring` puede venir cerrado o abierto. */
export function pointInRing(p: LngLat, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function midpoint(coords: LngLat[]): LngLat {
  const half = lineLengthM(coords) / 2;
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    const d = haversineM(coords[i - 1], coords[i]);
    if (acc + d >= half) {
      const t = d === 0 ? 0 : (half - acc) / d;
      const [a, b] = [coords[i - 1], coords[i]];
      return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    }
    acc += d;
  }
  return coords[coords.length - 1];
}

// Grilla SINTÉTICA del casco urbano de La Plata, para desarrollo y modo demo.
//
// Reproduce la numeración real (calles 1–31 y 115–122 en un sentido, 32–72 en el otro, avenidas cada
// 6 cuadras) sobre una cuadrícula regular rotada 45°. NO tiene diagonales ni las irregularidades reales:
// los datos de verdad salen de OpenStreetMap con `scripts/import-osm.ts`.

import { lineLengthM, midpoint } from "./geo";
import type { LngLat, Segment, Zone } from "./types";

/** Plaza Moreno (entre 12 y 14, 50 y 54). */
const CENTER: LngLat = [-57.9545, -34.9214];
const PITCH_M = 138; // manzana de ~120 m + calle

/** Calles paralelas a la 7, en orden de NE a SO. */
export const PARALLEL_STREETS = [122, 121, 120, 119, 118, 117, 116, 115, ...range(1, 31)];
/** Calles paralelas a la 51, de NO a SE. La 52 no existe como calle (es el eje cívico). */
export const CROSS_STREETS = range(32, 72).filter((n) => n !== 52);

export const PARALLEL_AVENUES = new Set([122, 1, 7, 13, 19, 25, 31]);
export const CROSS_AVENUES = new Set([32, 38, 44, 51, 53, 60, 66, 72]);

/** Límites de las zonas (cuadrantes entre avenidas). La franja 51–53 se une con 53–60. */
const PARALLEL_BANDS = [122, 1, 7, 13, 19, 25, 31];
const CROSS_BANDS = [32, 38, 44, 51, 60, 66, 72];

function range(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

// Ejes: u crece hacia el SO (de la 1 a la 31), v crece hacia el SE (de la 32 a la 72).
const S = Math.SQRT1_2;
const U_DIR: [number, number] = [-S, -S];
const V_DIR: [number, number] = [S, -S];

const uOf = (street: number) => (PARALLEL_STREETS.indexOf(street) - PARALLEL_STREETS.indexOf(13)) * PITCH_M;
const vOf = (street: number) => (street - 52) * PITCH_M;

function toLngLat(u: number, v: number): LngLat {
  const east = u * U_DIR[0] + v * V_DIR[0];
  const north = u * U_DIR[1] + v * V_DIR[1];
  const kx = 111_320 * Math.cos((CENTER[1] * Math.PI) / 180);
  return [round(CENTER[0] + east / kx), round(CENTER[1] + north / 110_574)];
}

const round = (x: number) => Math.round(x * 1e7) / 1e7;

function rect(u0: number, u1: number, v0: number, v1: number): LngLat[] {
  const ring = [toLngLat(u0, v0), toLngLat(u1, v0), toLngLat(u1, v1), toLngLat(u0, v1)];
  return [...ring, ring[0]];
}

const label = (n: number, avenues: Set<number>) => (avenues.has(n) ? `Av. ${n}` : `Calle ${n}`);

export function buildCasco(marginM = 20): LngLat[] {
  return rect(uOf(122) - marginM, uOf(31) + marginM, vOf(32) - marginM, vOf(72) + marginM);
}

export function buildZones(): Zone[] {
  const zones: Zone[] = [];
  let id = 1;
  for (let i = 0; i < PARALLEL_BANDS.length - 1; i++) {
    for (let j = 0; j < CROSS_BANDS.length - 1; j++) {
      const [pa, pb] = [PARALLEL_BANDS[i], PARALLEL_BANDS[i + 1]];
      const [qa, qb] = [CROSS_BANDS[j], CROSS_BANDS[j + 1]];
      zones.push({
        id: id++,
        slug: `${pa}-${pb}-${qa}-${qb}`,
        name: `${pa}–${pb} / ${qa}–${qb}`,
        ring: rect(uOf(pa), uOf(pb), vOf(qa), vOf(qb)),
      });
    }
  }
  return zones;
}

/** Zona por coordenadas de grilla. Las avenidas límite quedan en la zona que empieza en ellas. */
function zoneIdAt(u: number, v: number): number {
  const band = (x: number, bounds: number[]) => {
    for (let i = bounds.length - 2; i >= 0; i--) if (x >= bounds[i] - 1e-6) return i;
    return 0;
  };
  const i = band(u, PARALLEL_BANDS.map(uOf));
  const j = band(v, CROSS_BANDS.map(vOf));
  return i * (CROSS_BANDS.length - 1) + j + 1;
}

export function buildSegments(): Segment[] {
  const segments: Segment[] = [];
  let id = 1;
  const push = (
    streetName: string,
    betweenA: number,
    betweenB: number,
    isAvenue: boolean,
    a: [number, number],
    b: [number, number],
  ) => {
    const coords = [toLngLat(...a), toLngLat(...b)];
    const mu = (a[0] + b[0]) / 2;
    const mv = (a[1] + b[1]) / 2;
    segments.push({
      id: id++,
      streetName,
      betweenA: String(betweenA),
      betweenB: String(betweenB),
      isAvenue,
      isCobbled: false,
      zoneId: zoneIdAt(Math.min(mu, uOf(31) - 1), Math.min(mv, vOf(72) - 1)),
      coords,
      lengthM: Math.round(lineLengthM(coords) * 10) / 10,
    });
  };

  for (const p of PARALLEL_STREETS) {
    const u = uOf(p);
    for (let j = 0; j < CROSS_STREETS.length - 1; j++) {
      const [qa, qb] = [CROSS_STREETS[j], CROSS_STREETS[j + 1]];
      push(label(p, PARALLEL_AVENUES), qa, qb, PARALLEL_AVENUES.has(p), [u, vOf(qa)], [u, vOf(qb)]);
    }
  }
  for (const q of CROSS_STREETS) {
    const v = vOf(q);
    for (let i = 0; i < PARALLEL_STREETS.length - 1; i++) {
      const [pa, pb] = [PARALLEL_STREETS[i], PARALLEL_STREETS[i + 1]];
      push(label(q, CROSS_AVENUES), pa, pb, CROSS_AVENUES.has(q), [uOf(pa), v], [uOf(pb), v]);
    }
  }
  return segments;
}

export function segmentLabel(s: Pick<Segment, "streetName" | "betweenA" | "betweenB">): string {
  return `${s.streetName} e/ ${s.betweenA} y ${s.betweenB}`;
}

export { midpoint };

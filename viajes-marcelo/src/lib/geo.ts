import type { LngLat } from "./types";

const R = 6371; // km

export function haversineKm(a: LngLat, b: LngLat): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLng = (b[0] - a[0]) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function lengthKm(route: LngLat[]): number {
  let km = 0;
  for (let i = 1; i < route.length; i++) km += haversineKm(route[i - 1], route[i]);
  return Math.round(km * 10) / 10;
}

export function bounds(points: LngLat[]): [LngLat, LngLat] | null {
  if (!points.length) return null;
  let [w, s] = points[0];
  let [e, n] = points[0];
  for (const [x, y] of points) {
    w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y);
  }
  return [[w, s], [e, n]];
}

/** Punto a una fracción (0–1) del largo del recorrido, y el rumbo en ese punto (grados, 0 = norte). */
export function along(route: LngLat[], f: number): { at: LngLat; bearing: number } {
  if (route.length < 2) return { at: route[0] ?? [0, 0], bearing: 0 };
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < route.length; i++) { const d = haversineKm(route[i - 1], route[i]); seg.push(d); total += d; }
  let goal = Math.min(1, Math.max(0, f)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (goal <= seg[i] || i === seg.length - 1) {
      const t = seg[i] ? goal / seg[i] : 0;
      const a = route[i], b = route[i + 1];
      const at: LngLat = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const y = Math.sin((b[0] - a[0]) * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180);
      const x = Math.cos(a[1] * Math.PI / 180) * Math.sin(b[1] * Math.PI / 180) - Math.sin(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.cos((b[0] - a[0]) * Math.PI / 180);
      return { at, bearing: (Math.atan2(y, x) * 180) / Math.PI };
    }
    goal -= seg[i];
  }
  return { at: route[route.length - 1], bearing: 0 };
}

/** Saca puntos casi alineados para que un recorrido largo no pese de más (Douglas-Peucker, tolerancia en grados). */
export function simplify(route: LngLat[], tol = 0.00008): LngLat[] {
  if (route.length < 3) return route;
  const keep = new Uint8Array(route.length);
  keep[0] = keep[route.length - 1] = 1;
  const stack: [number, number][] = [[0, route.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let max = 0, idx = -1;
    const [x1, y1] = route[a], [x2, y2] = route[b];
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1e-12;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * route[i][0] - dx * route[i][1] + x2 * y1 - y2 * x1) / len;
      if (d > max) { max = d; idx = i; }
    }
    if (max > tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return route.filter((_, i) => keep[i]);
}

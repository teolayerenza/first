import { describe, expect, it } from "vitest";
import { loadBaseData } from "../src/lib/domain/base-data";
import { haversineM, midpoint, pointInRing, projectOnLine } from "../src/lib/domain/geo";
import { segmentLabel } from "../src/lib/domain/grid";

describe("cuadras reales del casco (OpenStreetMap)", () => {
  const base = loadBaseData();
  it("vienen de OSM y no de la grilla sintética", () => {
    expect(base.source).toBe("osm");
    expect(base.segments.length).toBeGreaterThan(3000);
  });
  it("el casco mide lo que mide (≈ 5,2 km de lado)", () => {
    const [a, b, c] = base.casco;
    expect(haversineM(a, b)).toBeGreaterThan(4800);
    expect(haversineM(a, b)).toBeLessThan(5800);
    expect(haversineM(b, c)).toBeGreaterThan(4800);
    expect(haversineM(b, c)).toBeLessThan(5800);
  });
  it("la 7 tiene sus 39 cuadras de 32 a 72 por mano y existen las diagonales", () => {
    const labels = new Set(base.segments.map(segmentLabel));
    expect(base.segments.filter((s) => s.streetName === "Av. 7" && !/\((por|cruce)/.test(s.betweenB)).length).toBe(78);
    expect(labels.has("Av. 7 e/ 37 y 39 (por Plaza General Olazábal, mano hacia 39)")).toBe(true);
    expect(labels.has("Av. 7 e/ 49 y 50 (mano hacia 49)")).toBe(true);
    expect(labels.has("Av. 7 e/ 49 y 50 (mano hacia 50)")).toBe(true);
    expect(new Set(base.segments.map(segmentLabel)).size).toBe(base.segments.length);
    expect(base.segments.some((s) => s.streetName === "Diagonal 74")).toBe(true);
    expect(base.segments.some((s) => s.streetName === "Diagonal 73")).toBe(true);
  });
  it("cada cuadra está en el casco (o a pocos metros: mano de afuera de la Circunvalación, rotondas) y en una zona", () => {
    const zoneIds = new Set(base.zones.map((z) => z.id));
    for (const s of base.segments) {
      const mid = midpoint(s.coords);
      expect(pointInRing(mid, base.casco) || projectOnLine(mid, base.casco).distanceM < 150).toBe(true);
      expect(zoneIds.has(s.zoneId)).toBe(true);
    }
  });
  it("no hay cuadras duplicadas (avenidas con boulevard)", () => {
    const keys = base.segments.map(segmentLabel);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

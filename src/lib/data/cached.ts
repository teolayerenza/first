import "server-only";
import { cacheLife } from "next/cache";
import { demoSource } from "./demo";
import { supabaseSource } from "./supabase";
import type { DataSource } from "./types";

// Caché corta de las lecturas públicas: en un pico de visitas, cada instancia del servidor consulta
// Supabase como mucho una vez cada 10 s por dato, en lugar de una vez por visita. Lo que manda un
// vecino se ve en el sitio en ≤ 10 s. `nearestSegment` no se cachea: depende de cada punto.
const LIFE = { stale: 30, revalidate: 10, expire: 60 };

const base = (): DataSource =>
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? supabaseSource : demoSource;

async function getDashboard(zoneId: number | null = null) {
  "use cache";
  cacheLife(LIFE);
  return base().getDashboard(zoneId);
}
async function getZones() {
  "use cache";
  cacheLife(LIFE);
  return base().getZones();
}
async function getSegments(zoneId: number | null = null) {
  "use cache";
  cacheLife(LIFE);
  return base().getSegments(zoneId);
}
async function getIssues(zoneId: number | null = null) {
  "use cache";
  cacheLife(LIFE);
  return base().getIssues(zoneId);
}
async function getSegment(id: number) {
  "use cache";
  cacheLife(LIFE);
  return base().getSegment(id);
}
async function getCasco() {
  "use cache";
  cacheLife("days");
  return base().getCasco();
}
async function adjacentSegments(id: number) {
  "use cache";
  cacheLife(LIFE);
  return base().adjacentSegments(id);
}
async function getStreetIndex() {
  "use cache";
  cacheLife("hours");
  return base().getStreetIndex();
}
async function getSegmentLabels(ids: number[]) {
  "use cache";
  cacheLife("hours");
  return base().getSegmentLabels(ids);
}

export function cachedSource(): DataSource {
  const b = base();
  return {
    mode: b.mode,
    getDashboard,
    getZones,
    getSegments,
    getIssues,
    getSegment,
    getCasco,
    nearestSegment: (p) => b.nearestSegment(p),
    adjacentSegments,
    getStreetIndex,
    getSegmentLabels,
  };
}

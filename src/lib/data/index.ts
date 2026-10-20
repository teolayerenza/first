import "server-only";
import { cachedSource } from "./cached";
import type { DataSource } from "./types";

/** Supabase si están las variables públicas; si no, el modo demo con datos simulados. Lecturas con caché corta. */
export function getDataSource(): DataSource {
  return cachedSource();
}

export const isDemo = () => getDataSource().mode === "demo";

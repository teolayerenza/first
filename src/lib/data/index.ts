import "server-only";
import { demoSource } from "./demo";
import { supabaseSource } from "./supabase";
import type { DataSource } from "./types";

/** Supabase si están las variables públicas; si no, el modo demo con datos simulados. */
export function getDataSource(): DataSource {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return supabaseSource;
  return demoSource;
}

export const isDemo = () => getDataSource().mode === "demo";

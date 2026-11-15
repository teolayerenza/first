export type LngLat = [number, number];

export interface Photo {
  id: string;
  trip_id: string;
  path: string;
  caption: string;
  lng: number | null;
  lat: number | null;
  taken_at: string | null;
  position: number;
  /** URL para mostrarla (firmada en Supabase; data URL en el modo demo). */
  url?: string;
}

export interface Trip {
  id: string;
  title: string;
  date_from: string;
  date_to: string | null;
  difficulty: 1 | 2 | 3 | 4 | 5;
  terrains: string[];
  notes: string;
  companions: string;
  route: LngLat[];
  distance_km: number;
  photos: Photo[];
}

export type TripDraft = Omit<Trip, "id" | "photos" | "distance_km"> & { id?: string };

/** Cada nivel con su tono de azul, legibles sobre el mapa blanco: del celeste (tranquilo) al azul marino (extremo). */
export const DIFFICULTY = [
  { n: 1, name: "Tranquilo", color: "#0ea5e9" },
  { n: 2, name: "Fácil", color: "#0284c7" },
  { n: 3, name: "Media", color: "#2563eb" },
  { n: 4, name: "Difícil", color: "#1d4ed8" },
  { n: 5, name: "Extremo", color: "#1e3a8a" },
] as const;

export const diff = (n: number) => DIFFICULTY[Math.min(5, Math.max(1, n)) - 1];

export const TERRAINS = ["Asfalto", "Ripio", "Tierra", "Arena", "Médanos", "Barro", "Piedra", "Vado / río", "Nieve"];

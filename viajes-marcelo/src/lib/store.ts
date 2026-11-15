// Acceso a los datos. Con las variables de Supabase: datos y fotos en la nube (sin login).
// Sin ellas: modo demo, todo en este navegador (sirve para probar la página antes de configurar nada).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { lengthKm } from "./geo";
import type { PreparedPhoto } from "./photos";
import type { Photo, Trip, TripDraft } from "./types";

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export interface SaveInput {
  draft: TripDraft;
  newPhotos: PreparedPhoto[];
  removedPhotoIds: string[];
  captions: Record<string, string>;
}

export interface Store {
  demo: boolean;
  list(): Promise<Trip[]>;
  save(input: SaveInput): Promise<void>;
  remove(id: string): Promise<void>;
}

const sb: SupabaseClient | null = URL_ && KEY ? createClient(URL_, KEY, { auth: { persistSession: false } }) : null;

const supabaseStore = (c: SupabaseClient): Store => ({
  demo: false,
  async list() {
    const { data, error } = await c.from("trips").select("*, photos:trip_photos(*)").order("date_from", { ascending: false });
    if (error) throw new Error("No pudimos cargar los viajes.");
    const trips = (data ?? []) as Trip[];
    const paths = trips.flatMap((t) => t.photos.map((p) => p.path));
    if (paths.length) {
      const { data: signed } = await c.storage.from("fotos").createSignedUrls(paths, 60 * 60 * 6);
      const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
      for (const t of trips) for (const p of t.photos) p.url = byPath.get(p.path) ?? undefined;
    }
    for (const t of trips) t.photos.sort((a, b) => a.position - b.position);
    return trips;
  },
  async save({ draft, newPhotos, removedPhotoIds, captions }) {
    const row = { ...draft, distance_km: lengthKm(draft.route), updated_at: new Date().toISOString() };
    const { data, error } = draft.id
      ? await c.from("trips").update(row).eq("id", draft.id).select("id").single()
      : await c.from("trips").insert(row).select("id").single();
    if (error || !data) throw new Error("No pudimos guardar el viaje.");
    const tripId = data.id as string;

    if (removedPhotoIds.length) {
      const { data: gone } = await c.from("trip_photos").select("path").in("id", removedPhotoIds);
      await c.from("trip_photos").delete().in("id", removedPhotoIds);
      if (gone?.length) await c.storage.from("fotos").remove(gone.map((g) => g.path));
    }
    for (const [id, caption] of Object.entries(captions)) await c.from("trip_photos").update({ caption }).eq("id", id);

    const { count } = await c.from("trip_photos").select("id", { count: "exact", head: true }).eq("trip_id", tripId);
    let pos = count ?? 0;
    for (const p of newPhotos) {
      const path = `${tripId}/${crypto.randomUUID()}.jpg`;
      const up = await c.storage.from("fotos").upload(path, p.blob, { contentType: "image/jpeg" });
      if (up.error) throw new Error("No pudimos subir una foto.");
      await c.from("trip_photos").insert({ trip_id: tripId, path, lng: p.lng, lat: p.lat, taken_at: p.taken_at, position: pos++ });
    }
  },
  async remove(id) {
    const { data: photos } = await c.from("trip_photos").select("path").eq("trip_id", id);
    if (photos?.length) await c.storage.from("fotos").remove(photos.map((p) => p.path));
    const { error } = await c.from("trips").delete().eq("id", id);
    if (error) throw new Error("No pudimos borrar el viaje.");
  },
});

// ——— Modo demo: localStorage ———
const KEY_DEMO = "viajes-de-marcelo-demo";
const readDemo = (): Trip[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY_DEMO) ?? "[]") as Trip[];
  } catch {
    return [];
  }
};
const writeDemo = (trips: Trip[]) => localStorage.setItem(KEY_DEMO, JSON.stringify(trips));
const toDataUrl = (b: Blob) => new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(r.result as string); r.readAsDataURL(b); });

const demoStore: Store = {
  demo: true,
  async list() {
    return readDemo().sort((a, b) => b.date_from.localeCompare(a.date_from));
  },
  async save({ draft, newPhotos, removedPhotoIds, captions }) {
    const trips = readDemo();
    const id = draft.id ?? crypto.randomUUID();
    const prev = trips.find((t) => t.id === id);
    const kept: Photo[] = (prev?.photos ?? []).filter((p) => !removedPhotoIds.includes(p.id)).map((p) => ({ ...p, caption: captions[p.id] ?? p.caption }));
    for (const p of newPhotos) {
      const url = await toDataUrl(p.blob);
      kept.push({ id: crypto.randomUUID(), trip_id: id, path: "", url, caption: "", lng: p.lng, lat: p.lat, taken_at: p.taken_at, position: kept.length });
    }
    const trip: Trip = { ...draft, id, distance_km: lengthKm(draft.route), photos: kept } as Trip;
    writeDemo([...trips.filter((t) => t.id !== id), trip]);
  },
  async remove(id) {
    writeDemo(readDemo().filter((t) => t.id !== id));
  },
};

export const store: Store = sb ? supabaseStore(sb) : demoStore;

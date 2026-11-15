// Buscador de lugares (Nominatim, OpenStreetMap) y trazado por caminos (OSRM). Ambos gratis y sin clave,
// pensados para uso personal y moderado: se llaman solo cuando Marcelo busca o agrega un tramo.
import type { LngLat } from "./types";

export interface Place { name: string; detail: string; at: LngLat }

export async function searchPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q, format: "jsonv2", limit: "6", countrycodes: "ar,cl,uy,py,bo", "accept-language": "es" }).toString();
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("No pudimos buscar el lugar.");
  const rows = (await res.json()) as { display_name: string; lat: string; lon: string; name?: string }[];
  return rows.map((r) => {
    const parts = r.display_name.split(", ");
    return { name: r.name || parts[0], detail: parts.slice(1, 4).join(", "), at: [Number(r.lon), Number(r.lat)] };
  });
}

/** Camino entre dos puntos siguiendo rutas y caminos (incluye ripio y tierra que estén en OpenStreetMap). */
export async function routeBetween(a: LngLat, b: LngLat): Promise<LngLat[]> {
  const url = `https://router.project-osrm.org/route/v1/driving/${a[0]},${a[1]};${b[0]},${b[1]}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("No pudimos trazar el camino. Probá con tramos a mano.");
  const data = (await res.json()) as { code: string; routes?: { geometry: { coordinates: LngLat[] } }[] };
  const coords = data.routes?.[0]?.geometry.coordinates;
  if (data.code !== "Ok" || !coords?.length) throw new Error("No hay un camino conocido entre esos puntos. Usá el modo a mano.");
  return coords;
}

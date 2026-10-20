"use client";

import type { LngLat } from "@/lib/domain/types";

export type Located = { ok: true; point: LngLat; accuracyM: number } | { ok: false; message: string };

/** Más allá de esto la ubicación es de la conexión a internet (te ubica en el proveedor): no sirve. */
const MAX_ACCURACY_M = 2000;

function once(highAccuracy: boolean, timeout: number): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: highAccuracy, timeout, maximumAge: 30_000 }),
  );
}

const DENIED =
  "El navegador no le dio permiso de ubicación a esta página. En iPhone: Ajustes → Apps → Safari → Ubicación → Preguntar. " +
  "En Android: tocá el ícono junto a la dirección de la página → Permisos → Ubicación.";

/**
 * Ubicación del dispositivo, solo para mover el mapa: nunca se envía (al servidor va un sí/no de "estás cerca").
 * Primero con GPS; si tarda, con la ubicación rápida del sistema. Cada falla devuelve qué hacer.
 */
export async function locateDevice(): Promise<Located> {
  if (!("geolocation" in navigator)) return { ok: false, message: "Este navegador no permite usar la ubicación. Buscá la cuadra por nombre." };
  let pos: GeolocationPosition;
  try {
    pos = await once(true, 12_000);
  } catch (e) {
    const err = e as GeolocationPositionError;
    if (err.code === err.PERMISSION_DENIED) return { ok: false, message: DENIED };
    try {
      pos = await once(false, 10_000);
    } catch (e2) {
      const err2 = e2 as GeolocationPositionError;
      if (err2.code === err2.PERMISSION_DENIED) return { ok: false, message: DENIED };
      return { ok: false, message: "No pudimos encontrar tu ubicación. Revisá que esté activada en el dispositivo, o buscá la cuadra por nombre." };
    }
  }
  const accuracyM = Math.round(pos.coords.accuracy);
  if (accuracyM > MAX_ACCURACY_M) {
    return {
      ok: false,
      message:
        `El dispositivo solo da una ubicación aproximada (a ${Math.round(accuracyM / 1000)} km). ` +
        "En un iPhone, activá Ubicación precisa: Ajustes → Apps → Safari → Ubicación. En una compu sin GPS, buscá la cuadra por nombre.",
    };
  }
  return { ok: true, point: [pos.coords.longitude, pos.coords.latitude], accuracyM };
}

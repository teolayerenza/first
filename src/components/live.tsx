"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/client/supabase";
import { fmtInt } from "@/lib/format";

const DEMO = !process.env.NEXT_PUBLIC_SUPABASE_URL;

/** Cada cliente espera al azar entre 10 y 25 s antes de recargar, y recarga como mucho una vez cada 30 s. */
const REFRESH_DELAY_MS = [10_000, 25_000] as const;
const REFRESH_MIN_GAP_MS = 30_000;

/**
 * Tiempo real. En producción: canal de Supabase Realtime "pocitos" (broadcast que emite la base al
 * promover aportes) → se refrescan los datos del servidor. En demo: refresco cada 30 s.
 * El aviso llega a todos a la vez: la espera al azar reparte las recargas para no pegarle a la base
 * con todas juntas (y para entonces la caché del servidor, de 10 s, ya tiene el dato nuevo). Una
 * pestaña en segundo plano no recarga: lo hace al volver.
 */
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) {
      const t = setInterval(() => router.refresh(), 30_000);
      return () => clearInterval(t);
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last = 0;
    let pending = false;
    const run = () => {
      timer = null;
      if (document.hidden) return void (pending = true);
      pending = false;
      last = Date.now();
      router.refresh();
    };
    const schedule = () => {
      if (timer) return;
      const [min, max] = REFRESH_DELAY_MS;
      const wait = Math.max(min + Math.random() * (max - min), last + REFRESH_MIN_GAP_MS - Date.now());
      timer = setTimeout(run, wait);
    };
    const onVisible = () => {
      if (!document.hidden && pending) schedule();
    };
    document.addEventListener("visibilitychange", onVisible);
    const ch = sb.channel("pocitos").on("broadcast", { event: "update" }, schedule).subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      sb.removeChannel(ch);
    };
  }, [router]);
  return null;
}

/**
 * Cuántas personas tienen la app abierta: Supabase Presence. Cada pestaña anuncia una clave aleatoria
 * efímera; no viaja ningún dato del dispositivo y nada se guarda.
 */
export function LiveNow() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) {
      const tick = () => setN(8 + (Math.floor(Date.now() / 60_000) % 17));
      tick();
      const t = setInterval(tick, 60_000);
      return () => clearInterval(t);
    }
    const ch = sb.channel("presencia", { config: { presence: { key: crypto.randomUUID() } } });
    ch.on("presence", { event: "sync" }, () => setN(Object.keys(ch.presenceState()).length)).subscribe((status) => {
      if (status === "SUBSCRIBED") ch.track({});
    });
    return () => {
      sb.removeChannel(ch);
    };
  }, []);
  if (n === null) return null;
  return (
    <span>
      <span className="tabular">{fmtInt(n)}</span> con la app abierta ahora{DEMO ? " (demo)" : ""}
    </span>
  );
}

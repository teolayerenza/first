"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/client/supabase";
import { fmtInt } from "@/lib/format";

const DEMO = !process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * Tiempo real. En producción: canal de Supabase Realtime "pocitos" (broadcast que emite la base al
 * promover aportes) → se refrescan los datos del servidor. En demo: refresco cada 30 s.
 */
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) {
      const t = setInterval(() => router.refresh(), 30_000);
      return () => clearInterval(t);
    }
    const ch = sb.channel("pocitos").on("broadcast", { event: "update" }, () => router.refresh()).subscribe();
    return () => {
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

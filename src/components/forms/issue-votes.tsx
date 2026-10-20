"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { submit } from "@/lib/client/submit";
import { ERROR_MESSAGES, type SubmitError } from "@/lib/domain/submit";
import type { FixQuality, IssueKind, VoteKind } from "@/lib/domain/types";

/** "Sigue ahí" / "Ya lo arreglaron" (→ ¿quedó bien?) / "No existe". */
export function IssueVotes({ issueId, kind }: { issueId: string; kind: IssueKind }) {
  const router = useRouter();
  const [askQuality, setAskQuality] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function vote(v: VoteKind, fixQuality: FixQuality | null = null) {
    setBusy(true);
    const r = await submit({ kind: "vote", issueId, vote: v, fixQuality });
    setBusy(false);
    setAskQuality(false);
    if (r.ok) {
      setMsg(v === "sigue" ? "¡Gracias por confirmar!" : v === "arreglado" ? "¡Gracias! Cuando otro vecino lo confirme, se marca como arreglado." : "Gracias. Si más vecinos coinciden, se oculta.");
      router.refresh();
    } else setMsg(r.error === "offline_queued" ? "Sin señal: lo mandamos cuando vuelva." : ERROR_MESSAGES[r.error as SubmitError] ?? "No se pudo enviar.");
  }

  if (msg) return <p role="status" className="mt-3 font-semibold text-good">{msg}</p>;
  const btn = "min-h-11 bg-surface-2 px-4 text-small font-semibold text-ink hover:bg-line disabled:opacity-40";
  return (
    <div className="mt-2">
      {askQuality ? (
        <div role="group" aria-label="¿Quedó bien el arreglo?" className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink">¿Quedó bien o quedó un parche mal hecho?</span>
          <button disabled={busy} className={btn} onClick={() => vote("arreglado", "bien")}>Quedó bien</button>
          <button disabled={busy} className={btn} onClick={() => vote("arreglado", "parche_malo")}>Quedó mal: es un parche mal hecho</button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} className={btn} onClick={() => vote("sigue")}>Sigue ahí</button>
          <button disabled={busy} className={btn} onClick={() => (kind === "pozo" ? setAskQuality(true) : vote("arreglado", "bien"))}>Ya lo arreglaron</button>
          <button disabled={busy} className={`${btn} text-ink-2`} onClick={() => vote("falso")}>No existe / denunciar foto o comentario</button>
        </div>
      )}
    </div>
  );
}

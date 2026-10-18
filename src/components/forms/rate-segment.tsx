"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { submit, type ClientResult } from "@/lib/client/submit";
import type { SegmentRef } from "@/lib/data/types";
import { ERROR_MESSAGES, type SubmitError } from "@/lib/domain/submit";
import type { Patching, Rating } from "@/lib/domain/types";
import { CONDITION_LABEL } from "@/lib/format";
import { LocationPicker, type PickedLocation } from "./location-picker";
import { Chips, Choice, QueueFlusher, Step, SubmitButton } from "./ui";

type Repaved = "este_mes" | "1_3_meses" | "mas_3_meses";

export function RateSegmentForm({ preset }: { preset?: { id: number; label: string; mid: [number, number] } | null }) {
  const [loc, setLoc] = useState<PickedLocation | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [patching, setPatching] = useState<Patching | null>(null);
  const [repaved, setRepaved] = useState<Repaved | null>(null);
  const [repavedOn, setRepavedOn] = useState(false);
  const [cobbled, setCobbled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ClientResult | null>(null);
  const [neighbors, setNeighbors] = useState<SegmentRef[]>([]);
  const [quickDone, setQuickDone] = useState<Record<number, Rating>>({});

  const segment = loc?.segment ?? null;
  const ready = segment && rating && (!repavedOn || repaved);

  useEffect(() => {
    if (!result?.ok || !segment) return;
    fetch(`/api/geo/vecinas?id=${segment.id}`).then((r) => r.json()).then(setNeighbors);
  }, [result, segment]);

  async function send() {
    if (!ready) return;
    setBusy(true);
    const r = await submit({
      kind: "rating",
      segmentId: segment!.id,
      rating: rating!,
      patching,
      onSite: loc!.onSite,
      repaved: repavedOn ? repaved : null,
      cobbled,
    });
    setBusy(false);
    setResult(r);
  }

  async function quickRate(n: SegmentRef, r: Rating) {
    setQuickDone((q) => ({ ...q, [n.id]: r }));
    await submit({ kind: "rating", segmentId: n.id, rating: r, onSite: false });
  }

  if (result?.ok || (result && !result.ok && result.error === "offline_queued")) {
    return (
      <div className="flex flex-col gap-2">
        <div className={`p-6 sm:p-8 ${result.ok ? "bg-green text-green-ink" : "bg-paint text-paint-ink"}`}>
          <h2 className="text-head">{result.ok ? "¡Gracias! Calificación guardada" : "Guardado sin señal"}</h2>
          <p className="mt-4 max-w-[48ch] text-lead leading-snug">
            {segment?.label}: la calificaste como <strong>{CONDITION_LABEL[rating!]}</strong>.
            {" "}El estado de la cuadra se actualiza cuando coinciden al menos dos vecinos (o uno que estuvo en el lugar).
          </p>
        </div>
        {neighbors.length > 0 && (
          <div className="bg-surface p-6 sm:p-8">
            <p className="text-lead font-semibold leading-tight text-ink">¿Y las cuadras de al lado?</p>
            <p className="mt-1 text-ink-2">Un toque cada una. Así bajamos el &quot;sin relevar&quot;.</p>
            <ul className="mt-5 flex flex-col gap-1">
              {neighbors.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 bg-surface-2 p-3">
                  <span className="font-semibold text-ink">{n.label}{n.condition === "sin_relevar" && <span className="ml-1 text-small font-normal text-ink-2">(sin relevar)</span>}</span>
                  {quickDone[n.id] ? (
                    <span className="font-semibold text-good">Listo: {CONDITION_LABEL[quickDone[n.id]].toLowerCase()}</span>
                  ) : (
                    <span className="flex gap-1">
                      {(["buena", "gastada", "muy_deteriorada"] as Rating[]).map((r) => (
                        <button key={r} type="button" onClick={() => quickRate(n, r)} aria-label={`${n.label}: ${CONDITION_LABEL[r]}`}
                          className={`h-11 px-3 text-small font-semibold ${r === "buena" ? "bg-buena text-asphalt" : r === "gastada" ? "bg-gastada text-asphalt" : "bg-muy text-white"}`}>
                          {CONDITION_LABEL[r]}
                        </button>
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button className="h-[52px] bg-asphalt px-5 font-semibold text-asphalt-ink" onClick={() => { setResult(null); setRating(null); setPatching(null); setRepavedOn(false); setRepaved(null); setCobbled(false); setNeighbors([]); }}>
            Calificar otra cuadra
          </button>
          <Link href="/reportar" className="inline-flex h-[52px] items-center justify-center bg-surface px-5 font-semibold text-ink">Reportar un pozo</Link>
          <Link href="/" className="inline-flex h-[52px] items-center justify-center px-5 font-semibold text-ink underline">Ver el tablero</Link>
        </div>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <QueueFlusher />
      <Step n={1} title="¿Qué cuadra?">
        <LocationPicker onChange={setLoc} initial={preset?.mid} hint="Mové el mapa hasta que el pin quede sobre la cuadra. Si estás ahí, tocá “Usar mi ubicación”: tu calificación pesa más." />
      </Step>

      <Step n={2} title="¿Cómo está el asfalto?">
        <p className="-mt-1 mb-4 text-ink-2">El estado general de la cuadra, no un pozo puntual (eso se reporta aparte).</p>
        <div role="radiogroup" className="flex flex-col gap-2">
          <Choice name="rating" value="buena" checked={rating === "buena"} onChange={() => setRating("buena")} swatch="bg-buena" title="Buena" desc="Asfalto en buen estado" />
          <Choice name="rating" value="gastada" checked={rating === "gastada"} onChange={() => setRating("gastada")} swatch="bg-gastada" title="Gastada" desc="Asfalto viejo, con grietas o algunos parches" />
          <Choice name="rating" value="muy_deteriorada" checked={rating === "muy_deteriorada"} onChange={() => setRating("muy_deteriorada")} swatch="bg-muy" title="Muy deteriorada" desc="Se desarma, todo parcheado, hace años que no la arreglan" />
        </div>
        <p className="mb-2 mt-6 font-semibold text-ink">¿Cuánto parche tiene? <span className="font-normal text-ink-2">(opcional)</span></p>
        <Chips label="Cantidad de parches" value={patching} onChange={setPatching}
          options={[{ v: "pocos", t: "Pocos" }, { v: "bastantes", t: "Bastantes" }, { v: "todo_parche", t: "Es todo parche" }]} />
        <div className="mt-6 flex flex-col gap-3">
          <label className="flex items-center gap-2 text-ink">
            <input type="checkbox" checked={repavedOn} onChange={(e) => setRepavedOn(e.target.checked)} className="h-5 w-5" />
            La repavimentaron hace poco
          </label>
          {repavedOn && (
            <Chips label="¿Cuándo la repavimentaron?" value={repaved} onChange={setRepaved}
              options={[{ v: "este_mes", t: "Este mes" }, { v: "1_3_meses", t: "Hace 1 a 3 meses" }, { v: "mas_3_meses", t: "Hace más de 3 meses" }]} />
          )}
          <label className="flex items-center gap-2 text-ink">
            <input type="checkbox" checked={cobbled} onChange={(e) => setCobbled(e.target.checked)} className="h-5 w-5" />
            Es empedrado / adoquinado
          </label>
        </div>
      </Step>

      {result && !result.ok && (
        <p role="alert" className="bg-red px-4 py-3 text-red-ink">
          {ERROR_MESSAGES[result.error as SubmitError] ?? "Algo salió mal. Probá de nuevo en un rato."}
        </p>
      )}
      <SubmitButton disabled={!ready} busy={busy}>Enviar calificación</SubmitButton>
      <p className="text-small text-ink-2">Es anónimo: no guardamos dónde estás ni qué otras cuadras calificaste.</p>
    </form>
  );
}

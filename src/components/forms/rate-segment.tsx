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
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
        <div className="text-center">
          <p className="text-5xl" aria-hidden>{result.ok ? "✅" : "📦"}</p>
          <h2 className="mt-2 text-xl font-semibold text-ink">{result.ok ? "¡Gracias! Calificación guardada" : "Guardado sin señal"}</h2>
          <p className="mt-1 text-ink-2">
            {segment?.label}: la calificaste como <strong>{CONDITION_LABEL[rating!]}</strong>.
            {" "}El estado de la cuadra se actualiza cuando coinciden al menos dos vecinos (o uno que estuvo en el lugar).
          </p>
        </div>
        {neighbors.length > 0 && (
          <div className="rounded-xl bg-surface-2 p-4">
            <p className="font-medium text-ink">¿Y las cuadras de al lado?</p>
            <p className="text-sm text-ink-2">Un toque cada una. Así bajamos el &quot;sin relevar&quot;.</p>
            <ul className="mt-3 flex flex-col gap-2">
              {neighbors.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-ink">{n.label}{n.condition === "sin_relevar" && <span className="ml-1 text-xs text-ink-3">(sin relevar)</span>}</span>
                  {quickDone[n.id] ? (
                    <span className="text-good">✓ {CONDITION_LABEL[quickDone[n.id]]}</span>
                  ) : (
                    <span className="flex gap-1">
                      {(["buena", "gastada", "muy_deteriorada"] as Rating[]).map((r) => (
                        <button key={r} type="button" onClick={() => quickRate(n, r)} aria-label={`${n.label}: ${CONDITION_LABEL[r]}`}
                          className="h-9 rounded-full border border-line px-3 text-ink hover:border-ink">
                          {r === "buena" ? "🟢" : r === "gastada" ? "🟡" : "🔴"}
                        </button>
                      ))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button className="h-11 rounded-full bg-accent px-5 font-medium text-accent-ink" onClick={() => { setResult(null); setRating(null); setPatching(null); setRepavedOn(false); setRepaved(null); setCobbled(false); setNeighbors([]); }}>
            Calificar otra cuadra
          </button>
          <Link href="/reportar" className="inline-flex h-11 items-center justify-center rounded-full border border-line px-5 text-ink">Reportar un pozo</Link>
          <Link href="/" className="inline-flex h-11 items-center justify-center rounded-full border border-line px-5 text-ink">Ver el tablero</Link>
        </div>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <QueueFlusher />
      <Step n={1} title="¿Qué cuadra?">
        <LocationPicker onChange={setLoc} initial={preset?.mid} hint="Mové el mapa hasta que el pin quede sobre la cuadra. Si estás ahí, tocá “Usar mi ubicación”: tu calificación pesa más." />
      </Step>

      <Step n={2} title="¿Cómo está el asfalto?">
        <p className="-mt-1 mb-3 text-sm text-ink-2">El estado general de la cuadra, no un pozo puntual (eso se reporta aparte).</p>
        <div role="radiogroup" className="flex flex-col gap-2">
          <Choice name="rating" value="buena" checked={rating === "buena"} onChange={() => setRating("buena")} swatch="bg-buena" title="Buena" desc="Asfalto en buen estado" />
          <Choice name="rating" value="gastada" checked={rating === "gastada"} onChange={() => setRating("gastada")} swatch="bg-gastada" title="Gastada" desc="Asfalto viejo, con grietas o algunos parches" />
          <Choice name="rating" value="muy_deteriorada" checked={rating === "muy_deteriorada"} onChange={() => setRating("muy_deteriorada")} swatch="bg-muy" title="Muy deteriorada" desc="Se desarma, todo parcheado, hace años que no la arreglan" />
        </div>
        <p className="mb-2 mt-5 text-sm font-medium text-ink">¿Cuánto parche tiene? <span className="font-normal text-ink-3">(opcional)</span></p>
        <Chips label="Cantidad de parches" value={patching} onChange={setPatching}
          options={[{ v: "pocos", t: "Pocos" }, { v: "bastantes", t: "Bastantes" }, { v: "todo_parche", t: "Es todo parche" }]} />
        <div className="mt-5 flex flex-col gap-3 text-sm">
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
        <p role="alert" className="rounded-lg bg-muy/10 px-3 py-2 text-sm text-bad">
          {ERROR_MESSAGES[result.error as SubmitError] ?? "Algo salió mal. Probá de nuevo en un rato."}
        </p>
      )}
      <SubmitButton disabled={!ready} busy={busy}>Enviar calificación</SubmitButton>
      <p className="text-center text-xs text-ink-3">🔒 Anónimo. No guardamos dónde estás ni qué otras cuadras calificaste.</p>
    </form>
  );
}

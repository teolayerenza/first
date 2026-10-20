"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { submit, warmSubmit, type ClientResult } from "@/lib/client/submit";
import type { SegmentRef } from "@/lib/data/types";
import { ERROR_MESSAGES, type SubmitError } from "@/lib/domain/submit";
import type { Patching, Rating } from "@/lib/domain/types";
import { CONDITION_LABEL } from "@/lib/format";
import { LocationPicker, type PickedLocation } from "./location-picker";
import { Chips, Choice, QueueFlusher, Step, SubmitButton } from "./ui";

type Repaved = "este_mes" | "1_3_meses" | "mas_3_meses";

type Quick = Rating | "nueva" | "empedrado";
const QUICK: { v: Quick; t: string; cls: string }[] = [
  { v: "nueva", t: "Nueva", cls: "bg-nueva text-white" },
  { v: "buena", t: "Buena", cls: "bg-buena text-asphalt" },
  { v: "gastada", t: "Gastada", cls: "bg-gastada text-asphalt" },
  { v: "muy_deteriorada", t: "Muy deteriorada", cls: "bg-muy text-white" },
  { v: "empedrado", t: "Empedrado", cls: "bg-empedrado text-white" },
];

export function RateSegmentForm({ preset }: { preset?: { id: number; label: string; mid: [number, number] } | null }) {
  // Al abrir el formulario: captchas resueltos y función despierta, así enviar no espera.
  useEffect(() => {
    warmSubmit();
  }, []);
  // Si llega una cuadra elegida (desde el inicio o desde la página de la cuadra), queda fija: no hay que
  // buscarla de nuevo en el mapa. "Cambiar" abre el mapa.
  const [loc, setLoc] = useState<PickedLocation | null>(
    preset ? { point: preset.mid, segment: { id: preset.id, label: preset.label, condition: "sin_relevar" }, onSite: false } : null,
  );
  const [fixed, setFixed] = useState(!!preset);
  // "nueva" se guarda como "buena" + fecha de repavimentación (el estado nueva sale de esa fecha).
  // "empedrado": la cuadra es de adoquines y no tiene estado de asfalto.
  const [rating, setRating] = useState<Rating | "nueva" | "empedrado" | null>(null);
  const [patching, setPatching] = useState<Patching | null>(null);
  const [repaved, setRepaved] = useState<Repaved | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ClientResult | null>(null);
  const [neighbors, setNeighbors] = useState<SegmentRef[]>([]);
  const [quickDone, setQuickDone] = useState<Record<number, Quick>>({});

  const segment = loc?.segment ?? null;
  const ready = segment && rating && (rating !== "nueva" || repaved);

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
      rating: rating === "empedrado" ? null : rating === "nueva" ? "buena" : rating!,
      patching: rating === "empedrado" ? null : patching,
      onSite: loc!.onSite,
      repaved: rating === "nueva" ? repaved : null,
      cobbled: rating === "empedrado",
    });
    setBusy(false);
    setResult(r);
  }

  // Calificación rápida de las cuadras vecinas: las mismas cinco opciones. "Nueva" sin preguntar cuándo
  // se manda como repavimentada hace 1 a 3 meses (cae dentro del año igual).
  async function quickRate(n: SegmentRef, q: Quick) {
    setQuickDone((d) => ({ ...d, [n.id]: q }));
    await submit(
      q === "empedrado"
        ? { kind: "rating", segmentId: n.id, rating: null, onSite: false, cobbled: true }
        : q === "nueva"
          ? { kind: "rating", segmentId: n.id, rating: "buena", onSite: false, repaved: "1_3_meses" }
          : { kind: "rating", segmentId: n.id, rating: q, onSite: false },
    );
  }

  if (result?.ok || (result && !result.ok && result.error === "offline_queued")) {
    return (
      <div className="flex flex-col gap-2">
        <div className={`p-6 sm:p-8 ${result.ok ? "bg-green text-green-ink" : "bg-paint text-paint-ink"}`}>
          <h2 className="text-head">{result.ok ? "¡Gracias! Calificación guardada" : "Guardado sin señal"}</h2>
          <p className="mt-4 max-w-[48ch] text-lead leading-snug">
            {segment?.label}: {rating === "empedrado" ? <>la marcaste como <strong>empedrada</strong>.</> : <>la calificaste como <strong>{rating === "nueva" ? "Nueva" : CONDITION_LABEL[rating!]}</strong>.</>}
            {" "}Aparece en el mapa en unos minutos. Si otros vecinos la califican distinto, se promedia y gana lo que diga la mayoría.
          </p>
        </div>
        {neighbors.length > 0 && (
          <div className="bg-surface p-6 sm:p-8">
            <p className="text-lead font-semibold leading-tight text-ink">¿Y las cuadras de al lado?</p>
            <p className="mt-1 text-ink-2">Un toque cada una. Así bajamos el &quot;sin relevar&quot;.</p>
            <ul className="mt-5 flex flex-col gap-1">
              {neighbors.map((n) => (
                <li key={n.id} className="flex flex-col gap-2 bg-surface-2 p-3">
                  <span className="font-semibold text-ink">{n.label}{n.condition === "sin_relevar" && <span className="ml-1 text-small font-normal text-ink-2">(sin relevar)</span>}</span>
                  {quickDone[n.id] ? (
                    <span className="font-semibold text-good">Listo: {QUICK.find((o) => o.v === quickDone[n.id])!.t.toLowerCase()}</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {QUICK.map((o) => (
                        <button key={o.v} type="button" onClick={() => quickRate(n, o.v)} aria-label={`${n.label}: ${o.t}`}
                          className={`h-11 px-3 text-small font-semibold ${o.cls}`}>
                          {o.t}
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
          <button className="h-[52px] bg-asphalt px-5 font-semibold text-asphalt-ink" onClick={() => { setResult(null); setRating(null); setPatching(null); setRepaved(null); setNeighbors([]); }}>
            Calificar otra cuadra
          </button>
          <Link href="/reportar/pozo" className="inline-flex h-[52px] items-center justify-center bg-surface px-5 font-semibold text-ink">Reportar un pozo</Link>
          <Link href="/" className="inline-flex h-[52px] items-center justify-center px-5 font-semibold text-ink underline">Ver el tablero</Link>
        </div>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <QueueFlusher />
      <Step n={1} title="¿Qué cuadra?">
        {fixed && preset ? (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-asphalt px-4 py-3 text-asphalt-ink">
            <p className="text-lead font-semibold leading-tight">{preset.label}</p>
            <button type="button" onClick={() => setFixed(false)} className="text-small font-semibold underline">
              Cambiar
            </button>
          </div>
        ) : (
          <LocationPicker onChange={setLoc} initial={preset?.mid} hint="Mové el mapa hasta que el pin quede sobre la cuadra. Si estás ahí, tocá “Usar mi ubicación”: tu calificación pesa más." />
        )}
      </Step>

      <Step n={2} title="¿Cómo está la calle?">
        <p className="-mt-1 mb-4 text-ink-2">El estado general de la cuadra, no un pozo puntual (eso se reporta aparte).</p>
        <div role="radiogroup" className="flex flex-col gap-2">
          <Choice name="rating" value="nueva" checked={rating === "nueva"} onChange={() => setRating("nueva")} swatch="bg-nueva" title="Nueva" desc="La repavimentaron en el último año" />
          {rating === "nueva" && (
            <div className="mb-2 pl-1">
              <p className="mb-2 font-semibold text-ink">¿Hace cuánto?</p>
              <Chips label="¿Hace cuánto la repavimentaron?" value={repaved} onChange={setRepaved}
                options={[{ v: "este_mes", t: "Este mes" }, { v: "1_3_meses", t: "Hace 1 a 3 meses" }, { v: "mas_3_meses", t: "Hace 3 a 12 meses" }]} />
            </div>
          )}
          <Choice name="rating" value="buena" checked={rating === "buena"} onChange={() => setRating("buena")} swatch="bg-buena" title="Buena" desc="Asfalto en buen estado" />
          <Choice name="rating" value="gastada" checked={rating === "gastada"} onChange={() => setRating("gastada")} swatch="bg-gastada" title="Gastada" desc="Asfalto viejo, con grietas o algunos parches" />
          <Choice name="rating" value="muy_deteriorada" checked={rating === "muy_deteriorada"} onChange={() => setRating("muy_deteriorada")} swatch="bg-muy" title="Muy deteriorada" desc="Se desarma, todo parcheado, hace años que no la arreglan" />
          <Choice name="rating" value="empedrado" checked={rating === "empedrado"} onChange={() => setRating("empedrado")} swatch="bg-empedrado" title="Es empedrado" desc="Adoquines, no asfalto: se cuenta aparte" />
        </div>
        {rating !== "empedrado" && rating !== "nueva" && (<>
        <p className="mb-2 mt-6 font-semibold text-ink">¿Cuánto parche tiene? <span className="font-normal text-ink-2">(opcional)</span></p>
        <Chips label="Cantidad de parches" value={patching} onChange={setPatching}
          options={[{ v: "ninguno", t: "Ninguno" }, { v: "pocos", t: "Pocos" }, { v: "bastantes", t: "Bastantes" }, { v: "todo_parche", t: "Es todo parche" }]} />
        </>)}
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

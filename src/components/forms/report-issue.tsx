"use client";

import Link from "next/link";
import { useState } from "react";
import type { CompressedPhoto } from "@/lib/client/photo";
import { submit, type ClientResult } from "@/lib/client/submit";
import type { IssueKind, ParcheType, Severity } from "@/lib/domain/types";
import { ERROR_MESSAGES, type SubmitError } from "@/lib/domain/submit";
import { LocationPicker, type PickedLocation } from "./location-picker";
import { Glyph } from "./glyphs";
import { Choice, PhotoField, QueueFlusher, Step, SubmitButton } from "./ui";

// Colores de la paleta validada (ámbar, naranja, rojo) y 1 a 3 barras: se distingue aunque no se vea el color.
const SEVERITY: { v: Severity; t: string; d: string; color: string }[] = [
  { v: 1, t: "Leve", d: "Se nota, pero se esquiva", color: "bg-gastada" },
  { v: 2, t: "Medio", d: "Hay que frenar", color: "bg-s2" },
  { v: 3, t: "Peligroso", d: "Rompe ruedas, el auto salta o tira motos", color: "bg-muy" },
];

function SeverityBars({ level, color, checked }: { level: number; color: string; checked: boolean }) {
  return (
    <span aria-hidden className="swatch flex h-9 items-end gap-1">
      {[1, 2, 3].map((i) => (
        <span key={i} className={`w-3 ${i > level ? "bg-current opacity-20" : checked ? "bg-current" : color}`} style={{ height: `${33 * i}%` }} />
      ))}
    </span>
  );
}

/** Un formulario por tipo: `pozo` o `parche` (bacheo mal hecho). Así cada botón lleva directo a lo suyo. */
export function ReportIssueForm({ kind }: { kind: IssueKind }) {
  const [loc, setLoc] = useState<PickedLocation | null>(null);
  const [parche, setParche] = useState<ParcheType | null>(null);
  const [sev, setSev] = useState<Severity | null>(null);
  const [photo, setPhoto] = useState<CompressedPhoto | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ClientResult | null>(null);
  const [dup, setDup] = useState<string | null>(null);

  const ready = loc?.segment && sev && (kind === "pozo" || parche);

  async function send(forceNew = false) {
    if (!ready || !loc) return;
    setBusy(true);
    const r = await submit(
      { kind: "issue", issueKind: kind, parcheType: kind === "parche" ? parche : null, severity: sev!, location: loc.point, onSite: loc.onSite, forceNew, comment: comment.trim() || null },
      photo ? { blob: photo.blob, type: photo.type } : null,
    );
    setBusy(false);
    if (!r.ok && r.error === "duplicate" && "duplicateId" in r && r.duplicateId) return setDup(r.duplicateId);
    setDup(null);
    setResult(r);
  }

  async function confirmExisting() {
    if (!dup) return;
    setBusy(true);
    const r = await submit({ kind: "vote", issueId: dup, vote: "sigue" });
    setBusy(false);
    setDup(null);
    setResult(r);
  }

  if (result?.ok || (result && !result.ok && result.error === "offline_queued")) {
    const queued = !result.ok;
    const voted = result.ok && result.kind === "vote";
    return (
      <div className={`flex flex-col gap-4 p-6 sm:p-8 ${queued ? "bg-paint text-paint-ink" : "bg-green text-green-ink"}`}>
        <h2 className="text-head">
          {queued ? "Guardado sin señal" : voted ? "¡Gracias por confirmar!" : kind === "parche" ? "Parche reportado" : "Pozo reportado"}
        </h2>
        <p className="max-w-[44ch] text-lead leading-snug">
          {queued
            ? "No hay conexión ahora. Lo vamos a mandar solo cuando vuelva la señal."
            : voted
              ? "Tu confirmación ayuda a que el reporte cuente en los números."
              : photo
                ? "Con la foto ya cuenta. En unos minutos aparece en el tablero."
                : "Queda pendiente hasta que otro vecino lo confirme. Si pasás de nuevo, sacale una foto."}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button className="h-[52px] bg-asphalt px-5 font-semibold text-asphalt-ink" onClick={() => { setResult(null); setParche(null); setSev(null); setPhoto(null); }}>
            Reportar otro
          </button>
          <Link href={kind === "pozo" ? "/reportar/parche" : "/reportar/pozo"} className="inline-flex h-[52px] items-center justify-center bg-surface px-5 font-semibold text-ink">
            {kind === "pozo" ? "Reportar un parche" : "Reportar un pozo"}
          </Link>
          {loc?.segment && <Link href={`/calificar?cuadra=${loc.segment.id}`} className="inline-flex h-[52px] items-center justify-center bg-surface px-5 font-semibold text-ink">Calificar esta cuadra</Link>}
          <Link href="/" className="inline-flex h-[52px] items-center justify-center px-5 font-semibold underline">Ver el tablero</Link>
        </div>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <QueueFlusher />
      <Step n={1} title="¿Dónde está?">
        <LocationPicker onChange={setLoc} hint={`Mové el mapa hasta que el pin quede justo sobre el ${kind}.`} />
      </Step>

      {kind === "parche" && (
        <Step n={2} title="¿Cómo quedó el parche?">
          <div role="radiogroup" aria-label="Tipo de parche" className="grid gap-2 sm:grid-cols-3">
            <Choice name="parche" value="elevado" checked={parche === "elevado"} onChange={() => setParche("elevado")} glyph={<Glyph kind="elevado" />} title="Elevado" desc="Quedó como un lomo de burro" />
            <Choice name="parche" value="hundido" checked={parche === "hundido"} onChange={() => setParche("hundido")} glyph={<Glyph kind="hundido" />} title="Hundido" desc="Quedó un pozo sobre el parche" />
            <Choice name="parche" value="desarmado" checked={parche === "desarmado"} onChange={() => setParche("desarmado")} glyph={<Glyph kind="desarmado" />} title="Se desarmó" desc="Volvió a romperse" />
          </div>
        </Step>
      )}

      <Step n={3} title="¿Qué tan grave es?">
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
          {SEVERITY.map((s) => (
            <Choice key={s.v} name="sev" value={String(s.v)} checked={sev === s.v} onChange={() => setSev(s.v)} title={s.t} desc={s.d}
              checkedClass={`${s.color} text-[#141414]`} glyph={<SeverityBars level={s.v} color={s.color} checked={sev === s.v} />} />
          ))}
        </div>
        <div className="mt-4">
          <PhotoField onReady={setPhoto} />
        </div>
        <div className="mt-4">
          <label htmlFor="comentario" className="block font-semibold text-ink">
            ¿Querés contar algo? <span className="font-normal text-ink-2">(opcional)</span>
          </label>
          <textarea id="comentario" value={comment} maxLength={200} rows={3} onChange={(e) => setComment(e.target.value)}
            placeholder={kind === "pozo" ? "Ej.: Hace meses que está así. Ya se cayó una moto." : "Ej.: Lo tiraron hace dos semanas y ya se hundió."}
            className="mt-2 block w-full resize-none border border-line bg-surface-2 p-3 text-ink" />
          <p className="mt-1 flex justify-between gap-3 text-small text-ink-2">
            <span>Es público. No pongas nombres, teléfonos ni direcciones de casas.</span>
            <span className="tabular shrink-0">{comment.length}/200</span>
          </p>
        </div>
      </Step>

      {dup && (
        <div role="alertdialog" aria-labelledby="dup-title" className="bg-paint p-5 text-paint-ink sm:p-7">
          <p id="dup-title" className="text-lead font-semibold leading-tight">¿Es este? Ya hay un reporte a pocos metros.</p>
          <p className="mt-2">Si es el mismo, confirmalo: así cuenta más rápido y no se duplica.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={busy} onClick={confirmExisting} className="h-[52px] flex-1 bg-asphalt font-semibold text-asphalt-ink">Sí, sigue ahí</button>
            <button type="button" disabled={busy} onClick={() => send(true)} className="h-[52px] flex-1 bg-paint-2 font-semibold">No, es otro</button>
          </div>
        </div>
      )}

      {result && !result.ok && (
        <p role="alert" className="bg-red px-4 py-3 text-red-ink">
          {ERROR_MESSAGES[result.error as SubmitError] ?? "Algo salió mal. Probá de nuevo en un rato."}
        </p>
      )}
      {!dup && <SubmitButton disabled={!ready} busy={busy}>Enviar reporte</SubmitButton>}
      <p className="text-small text-ink-2">Es anónimo: guardamos dónde está el problema, no dónde estás vos.</p>
    </form>
  );
}

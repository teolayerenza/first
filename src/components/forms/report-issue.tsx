"use client";

import Link from "next/link";
import { useState } from "react";
import type { CompressedPhoto } from "@/lib/client/photo";
import { submit, type ClientResult } from "@/lib/client/submit";
import type { IssueKind, ParcheType, Severity } from "@/lib/domain/types";
import { ERROR_MESSAGES, type SubmitError } from "@/lib/domain/submit";
import { LocationPicker, type PickedLocation } from "./location-picker";
import { Choice, PhotoField, QueueFlusher, Step, SubmitButton } from "./ui";

const SEVERITY: { v: Severity; t: string; d: string }[] = [
  { v: 1, t: "Leve", d: "Se nota, pero se esquiva" },
  { v: 2, t: "Medio", d: "Hay que frenar" },
  { v: 3, t: "Peligroso", d: "Rompe ruedas, el auto salta o tira motos" },
];

export function ReportIssueForm() {
  const [loc, setLoc] = useState<PickedLocation | null>(null);
  const [kind, setKind] = useState<IssueKind | null>(null);
  const [parche, setParche] = useState<ParcheType | null>(null);
  const [sev, setSev] = useState<Severity | null>(null);
  const [photo, setPhoto] = useState<CompressedPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ClientResult | null>(null);
  const [dup, setDup] = useState<string | null>(null);

  const ready = loc?.segment && kind && sev && (kind === "pozo" || parche);

  async function send(forceNew = false) {
    if (!ready || !loc) return;
    setBusy(true);
    const r = await submit(
      { kind: "issue", issueKind: kind!, parcheType: kind === "parche" ? parche : null, severity: sev!, location: loc.point, onSite: loc.onSite, forceNew },
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
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="text-5xl" aria-hidden>{queued ? "📦" : "✅"}</p>
        <h2 className="text-xl font-semibold text-ink">
          {queued ? "Guardado sin señal" : voted ? "¡Gracias por confirmar!" : kind === "parche" ? "Parche reportado" : "Pozo reportado"}
        </h2>
        <p className="text-ink-2">
          {queued
            ? "No hay conexión ahora. Lo vamos a mandar solo cuando vuelva la señal."
            : voted
              ? "Tu confirmación ayuda a que el reporte cuente en los números."
              : photo
                ? "Con la foto ya cuenta. En unos minutos aparece en el tablero."
                : "Queda pendiente hasta que otro vecino lo confirme. Si pasás de nuevo, sacale una foto."}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button className="h-11 rounded-full bg-accent px-5 font-medium text-accent-ink" onClick={() => { setResult(null); setKind(null); setParche(null); setSev(null); setPhoto(null); }}>
            Reportar otro
          </button>
          {loc?.segment && <Link href={`/calificar?cuadra=${loc.segment.id}`} className="inline-flex h-11 items-center justify-center rounded-full border border-line px-5 text-ink">Calificar esta cuadra</Link>}
          <Link href="/" className="inline-flex h-11 items-center justify-center rounded-full border border-line px-5 text-ink">Ver el tablero</Link>
        </div>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <QueueFlusher />
      <Step n={1} title="¿Dónde está?">
        <LocationPicker onChange={setLoc} hint="Mové el mapa hasta que el pin quede justo sobre el pozo o el parche." />
      </Step>

      <Step n={2} title="¿Qué es?">
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
          <Choice name="kind" value="pozo" checked={kind === "pozo"} onChange={() => setKind("pozo")} icon="🕳️" title="Pozo" desc="Falta asfalto, hay un agujero" />
          <Choice name="kind" value="parche" checked={kind === "parche"} onChange={() => setKind("parche")} icon="🩹" title="Parche mal hecho" desc="Lo arreglaron, pero quedó mal" />
        </div>
        {kind === "parche" && (
          <div role="radiogroup" aria-label="Tipo de parche" className="mt-3 grid gap-2 sm:grid-cols-3">
            <Choice name="parche" value="elevado" checked={parche === "elevado"} onChange={() => setParche("elevado")} icon="⬆️" title="Elevado" desc="Quedó como un lomo de burro" />
            <Choice name="parche" value="hundido" checked={parche === "hundido"} onChange={() => setParche("hundido")} icon="⬇️" title="Hundido" desc="Quedó un pozo sobre el parche" />
            <Choice name="parche" value="desarmado" checked={parche === "desarmado"} onChange={() => setParche("desarmado")} icon="💥" title="Se desarmó" desc="Volvió a romperse" />
          </div>
        )}
      </Step>

      <Step n={3} title="¿Qué tan grave?">
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
          {SEVERITY.map((s) => (
            <Choice key={s.v} name="sev" value={String(s.v)} checked={sev === s.v} onChange={() => setSev(s.v)} title={s.t} desc={s.d} />
          ))}
        </div>
        <div className="mt-4">
          <PhotoField onReady={setPhoto} />
        </div>
      </Step>

      {dup && (
        <div role="alertdialog" aria-labelledby="dup-title" className="rounded-2xl border-2 border-gastada bg-surface p-4">
          <p id="dup-title" className="font-semibold text-ink">¿Es este? Ya hay un reporte a pocos metros.</p>
          <p className="mt-1 text-sm text-ink-2">Si es el mismo, confirmalo: así cuenta más rápido y no se duplica.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={busy} onClick={confirmExisting} className="h-11 flex-1 rounded-full bg-accent font-medium text-accent-ink">Sí, sigue ahí</button>
            <button type="button" disabled={busy} onClick={() => send(true)} className="h-11 flex-1 rounded-full border border-line text-ink">No, es otro</button>
          </div>
        </div>
      )}

      {result && !result.ok && (
        <p role="alert" className="rounded-lg bg-muy/10 px-3 py-2 text-sm text-bad">
          {ERROR_MESSAGES[result.error as SubmitError] ?? "Algo salió mal. Probá de nuevo en un rato."}
        </p>
      )}
      {!dup && <SubmitButton disabled={!ready} busy={busy}>Enviar reporte</SubmitButton>}
      <p className="text-center text-xs text-ink-3">🔒 Anónimo. Guardamos dónde está el problema, no dónde estás vos.</p>
    </form>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { compressPhoto, type CompressedPhoto } from "@/lib/client/photo";
import { flushQueue } from "@/lib/client/submit";

export function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <fieldset className="bg-surface p-5 sm:p-7">
      <legend className="sr-only">{title}</legend>
      <p aria-hidden className="mb-4 text-lead font-semibold leading-tight tracking-[-0.02em] text-ink">{title}</p>
      {children}
    </fieldset>
  );
}

/** Opción grande (radio accesible con apariencia de botón). */
export function Choice({ name, value, checked, onChange, glyph, title, desc, swatch }: {
  name: string; value: string; checked: boolean; onChange: (v: string) => void; glyph?: ReactNode; title: string; desc?: string; swatch?: string;
}) {
  return (
    <label className={`flex min-h-16 cursor-pointer items-center gap-4 p-4 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--focus)] ${checked ? "bg-asphalt text-asphalt-ink" : "bg-surface-2 text-ink hover:bg-line"}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} className="sr-only" />
      {swatch ? <span aria-hidden className={`swatch h-6 w-6 shrink-0 ${swatch}`} /> : glyph ? <span className="shrink-0">{glyph}</span> : null}
      <span className="flex-1">
        <span className="block font-semibold">{title}</span>
        {desc && <span className={`block text-small ${checked ? "text-asphalt-ink-2" : "text-ink-2"}`}>{desc}</span>}
      </span>
    </label>
  );
}

export function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: { v: T; t: string }[]; value: T | null; onChange: (v: T | null) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(value === o.v ? null : o.v)}
          className={`min-h-11 px-4 text-small font-semibold ${value === o.v ? "bg-asphalt text-asphalt-ink" : "bg-surface-2 text-ink hover:bg-line"}`}>
          {o.t}
        </button>
      ))}
    </div>
  );
}

/**
 * Foto opcional. Se comprime apenas se elige (en segundo plano, mientras el vecino sigue completando).
 * El vecino nunca ve un límite de tamaño.
 */
export function PhotoField({ onReady }: { onReady: (p: CompressedPhoto | null) => void }) {
  const [state, setState] = useState<"none" | "working" | "ready" | "error">("none");
  const [preview, setPreview] = useState<string | null>(null);
  const [kb, setKb] = useState(0);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  return (
    <div>
      <label className="flex cursor-pointer items-center gap-4 bg-surface-2 p-4 hover:bg-line has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-[var(--focus)]">
        <input type="file" accept="image/*" capture="environment" className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setState("working");
            try {
              const c = await compressPhoto(f);
              setPreview(URL.createObjectURL(c.blob));
              setKb(Math.round(c.blob.size / 1000));
              setState("ready");
              onReady(c);
            } catch {
              setState("error");
              onReady(null);
            }
          }} />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Vista previa de la foto" className="h-16 w-16 object-cover" />
        ) : (
          <span aria-hidden className="grid h-16 w-16 place-items-center bg-asphalt text-small font-semibold text-asphalt-ink">Foto</span>
        )}
        <span className="text-sm">
          <span className="block font-semibold text-ink">{state === "ready" ? "Foto lista (tocá para cambiarla)" : "Sumar una foto (opcional)"}</span>
          <span className="block text-small text-ink-2">
            {state === "working" ? "Achicando la foto…" : state === "ready" ? `${kb} KB, sin ubicación ni datos del teléfono` : state === "error" ? "No pudimos leer esa foto. Probá con otra." : "Con foto, el reporte cuenta al toque. No incluyas personas ni patentes."}
          </span>
        </span>
      </label>
      {state === "ready" && (
        <button type="button" className="mt-2 text-small text-ink-2 underline" onClick={() => { setPreview(null); setState("none"); onReady(null); }}>
          Quitar foto
        </button>
      )}
    </div>
  );
}

/** Al abrir un formulario o volver la conexión, se mandan los aportes que quedaron en cola. */
export function QueueFlusher() {
  const [sent, setSent] = useState(0);
  useEffect(() => {
    const run = () => flushQueue().then((n) => n && setSent((s) => s + n)).catch(() => {});
    run();
    window.addEventListener("online", run);
    return () => window.removeEventListener("online", run);
  }, []);
  if (!sent) return null;
  return <p role="status" className="bg-green px-4 py-3 text-small text-green-ink">Se enviaron {sent} aportes que habían quedado guardados sin señal. ¡Gracias!</p>;
}

export function SubmitButton({ disabled, busy, children }: { disabled?: boolean; busy?: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={disabled || busy}
      className="inline-flex h-[52px] w-full items-center justify-center bg-green px-6 font-semibold text-green-ink hover:opacity-90 disabled:bg-surface-2 disabled:text-ink-2">
      {busy ? "Enviando…" : children}
    </button>
  );
}

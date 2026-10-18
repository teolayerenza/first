"use client";

import { useEffect, useState, type ReactNode } from "react";
import { compressPhoto, type CompressedPhoto } from "@/lib/client/photo";
import { flushQueue } from "@/lib/client/submit";

export function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <legend className="sr-only">{title}</legend>
      <p aria-hidden className="mb-3 flex items-center gap-2 text-base font-semibold text-ink">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-xs text-accent-ink">{n}</span>
        {title}
      </p>
      {children}
    </fieldset>
  );
}

/** Opción grande (radio accesible con apariencia de botón). */
export function Choice({ name, value, checked, onChange, icon, title, desc, swatch }: {
  name: string; value: string; checked: boolean; onChange: (v: string) => void; icon?: string; title: string; desc?: string; swatch?: string;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${checked ? "border-ink bg-surface-2" : "border-line hover:border-ink-3"}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} className="sr-only" />
      {swatch ? <span aria-hidden className={`swatch mt-0.5 h-5 w-5 shrink-0 rounded-md ${swatch}`} /> : icon ? <span aria-hidden className="text-xl leading-6">{icon}</span> : null}
      <span className="flex-1">
        <span className="block font-medium text-ink">{title}</span>
        {desc && <span className="block text-sm text-ink-2">{desc}</span>}
      </span>
      <span aria-hidden className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${checked ? "border-ink bg-ink" : "border-line"}`} />
    </label>
  );
}

export function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: { v: T; t: string }[]; value: T | null; onChange: (v: T | null) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(value === o.v ? null : o.v)}
          className={`rounded-full border px-3 py-1.5 text-sm ${value === o.v ? "border-ink bg-accent text-accent-ink" : "border-line text-ink-2 hover:border-ink-3"}`}>
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
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-line p-3.5 hover:border-ink-3">
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
          <img src={preview} alt="Vista previa de la foto" className="h-16 w-16 rounded-lg object-cover" />
        ) : (
          <span aria-hidden className="grid h-16 w-16 place-items-center rounded-lg bg-surface-2 text-2xl">📷</span>
        )}
        <span className="text-sm">
          <span className="block font-medium text-ink">{state === "ready" ? "Foto lista ✓ (tocá para cambiarla)" : "Sumar foto (opcional)"}</span>
          <span className="block text-ink-2">
            {state === "working" ? "Achicando la foto…" : state === "ready" ? `${kb} KB, sin ubicación ni datos del teléfono` : state === "error" ? "No pudimos leer esa foto. Probá con otra." : "Con foto, el reporte cuenta al toque. No incluyas personas ni patentes."}
          </span>
        </span>
      </label>
      {state === "ready" && (
        <button type="button" className="mt-2 text-sm text-ink-2 underline" onClick={() => { setPreview(null); setState("none"); onReady(null); }}>
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
  return <p role="status" className="rounded-lg bg-nueva/10 px-3 py-2 text-sm text-good">Se enviaron {sent} aportes que habían quedado guardados sin señal. ¡Gracias!</p>;
}

export function SubmitButton({ disabled, busy, children }: { disabled?: boolean; busy?: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={disabled || busy}
      className="inline-flex h-12 w-full items-center justify-center rounded-full bg-accent px-6 font-medium text-accent-ink disabled:opacity-40">
      {busy ? "Enviando…" : children}
    </button>
  );
}

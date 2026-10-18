import Link from "next/link";
import type { ReactNode } from "react";
import { fmtPp } from "@/lib/format";

export function Section({ title, kicker, children, id, aside }: { title: string; kicker?: string; children: ReactNode; id?: string; aside?: ReactNode }) {
  return (
    <section id={id} className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          {kicker && <p className="text-xs font-medium uppercase tracking-wider text-ink-3">{kicker}</p>}
          <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Variación en pp. `upIsBad`: para "% muy deteriorada", subir es malo. */
export function Delta({ delta, upIsBad = true, period = "vs. hace 30 días" }: { delta: number | null; upIsBad?: boolean; period?: string }) {
  if (delta === null) return null;
  const flat = Math.abs(delta) < 0.05;
  const bad = !flat && (delta > 0) === upIsBad;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${flat ? "bg-surface-2 text-ink-2" : bad ? "bg-muy/10 text-bad" : "bg-nueva/10 text-good"}`}>
      <span aria-hidden>{flat ? "＝" : delta > 0 ? "▲" : "▼"}</span>
      <span className="tabular">{fmtPp(delta)}</span>
      <span className="font-normal text-ink-3">{period}</span>
      <span className="sr-only">{flat ? "" : bad ? "(empeoró)" : "(mejoró)"}</span>
    </span>
  );
}

export function StatTile({ label, value, sub, icon, href }: { label: string; value: ReactNode; sub?: ReactNode; icon?: string; href?: string }) {
  const body = (
    <>
      <p className="flex items-center gap-1.5 text-sm text-ink-2">
        {icon && <span aria-hidden>{icon}</span>}
        {label}
      </p>
      <p className="tabular mt-1 text-3xl font-semibold tracking-tight text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-3">{sub}</p>}
    </>
  );
  const cls = "block rounded-xl border border-line bg-bg p-4";
  return href ? <Link href={href} className={`${cls} hover:border-ink-3`}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function CtaButtons() {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Link href="/reportar" className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-accent px-5 font-medium text-accent-ink hover:opacity-90">
        <span aria-hidden>🕳️</span> Reportar pozo o parche
      </Link>
      <Link href="/calificar" className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-ink/20 bg-surface px-5 font-medium text-ink hover:border-ink">
        <span aria-hidden>🛣️</span> Calificar una cuadra
      </Link>
    </div>
  );
}

export function AnonymityStrip() {
  return (
    <Link href="#anonimato" className="mt-3 flex items-center justify-center gap-2 text-sm text-ink-2 hover:text-ink">
      <span aria-hidden>🔒</span> 100% anónimo · no guardamos datos tuyos · <span className="underline">¿Cómo?</span>
    </Link>
  );
}

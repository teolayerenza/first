import type { ReactNode } from "react";

export function Page({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <header className="bg-asphalt px-5 pb-16 pt-20 text-asphalt-ink sm:px-8 lg:pb-24 lg:pt-28">
        <div className="mx-auto max-w-[1400px]">
          <h1 className="max-w-[16ch] text-[clamp(2.75rem,1rem+5vw,6rem)]">{title}</h1>
          {intro && <p className="mt-6 max-w-[48ch] text-lead leading-snug text-asphalt-ink-2">{intro}</p>}
        </div>
      </header>
      <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-12 sm:py-16">
      {children}
      </div>
    </div>
  );
}

export function Block({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 bg-surface p-6 sm:p-8">
      <h2 className="mb-4 text-lead font-semibold leading-tight tracking-[-0.02em] text-ink">{title}</h2>
      <div className="flex flex-col gap-3 leading-relaxed text-ink [&_a]:underline [&_a]:font-semibold [&_code]:bg-surface-2 [&_code]:px-1 [&_code]:text-sm">
        {children}
      </div>
    </section>
  );
}

const ROW = "border-t border-line align-top"; // taste-skill-ignore: fila de una tabla real

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-ink-2">
          <tr>{head.map((h) => <th key={h} className="py-2 pr-4 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={ROW}>
              {r.map((c, j) => <td key={j} className={`py-2 pr-4 ${j === 0 ? "text-ink" : ""}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

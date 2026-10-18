import type { ReactNode } from "react";

export function Page({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
        {intro && <p className="mt-2 text-lg text-ink-2">{intro}</p>}
      </header>
      {children}
    </div>
  );
}

export function Block({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="mb-3 text-lg font-semibold text-ink">{title}</h2>
      <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-ink-2 [&_strong]:text-ink [&_a]:underline [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_code]:text-sm">
        {children}
      </div>
    </section>
  );
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-ink-3">
          <tr>{head.map((h) => <th key={h} className="py-2 pr-4 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line align-top">
              {r.map((c, j) => <td key={j} className={`py-2 pr-4 ${j === 0 ? "text-ink" : ""}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

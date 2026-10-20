import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { IssueRow } from "@/components/issue-row";
import { getDataSource } from "@/lib/data";
import { fmtInt } from "@/lib/format";

export const metadata: Metadata = {
  title: "Problemas abiertos",
  description: "Pozos y parches mal hechos abiertos en el casco urbano de La Plata.",
};

const PER_PAGE = 50;

/** Lista de todos los problemas abiertos: primero los más peligrosos, después los más viejos. De a 50. */
async function Content({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  await connection();
  const page = Math.max(1, Math.floor(Number((await searchParams).pagina)) || 1);
  const ds = getDataSource();
  const issues = await ds.getIssues();
  const list = issues.features
    .map((f) => f.properties)
    .sort((a, b) => b.severity - a.severity || b.days - a.days);
  const pozos = list.filter((i) => i.kind === "pozo").length;
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const shown = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const labels = await ds.getSegmentLabels(shown.map((i) => i.segmentId).sort((x, y) => x - y));
  return (
    <div>
      <header className="bg-red px-5 pb-12 pt-14 text-red-ink sm:px-8 lg:pb-16 lg:pt-20">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-[clamp(2.5rem,1rem+4.5vw,5rem)]">Problemas abiertos</h1>
          <p className="mt-4 max-w-[48ch] text-lead leading-snug">
            {fmtInt(pozos)} {pozos === 1 ? "pozo" : "pozos"} y {fmtInt(list.length - pozos)} {list.length - pozos === 1 ? "parche mal hecho" : "parches mal hechos"}.
            Tocá uno para contar si sigue ahí.
          </p>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        {list.length === 0 ? (
          <p className="bg-surface p-6 text-ink-2 sm:p-8">No hay pozos ni parches abiertos reportados.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {shown.map((i) => <IssueRow key={i.id} issue={i} label={labels[i.segmentId]} />)}
          </ul>
        )}
        {pages > 1 && (
          <nav aria-label="Páginas" className="mt-4 flex items-center justify-between gap-2">
            {page > 1 ? (
              <Link href={`/problemas?pagina=${page - 1}`} className="inline-flex h-[52px] items-center bg-surface-2 px-5 font-semibold text-ink hover:bg-line">← Anteriores</Link>
            ) : <span />}
            <span className="text-small text-ink-2">Página {page} de {pages}</span>
            {page < pages ? (
              <Link href={`/problemas?pagina=${page + 1}`} className="inline-flex h-[52px] items-center bg-surface-2 px-5 font-semibold text-ink hover:bg-line">Siguientes →</Link>
            ) : <span />}
          </nav>
        )}
        <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2 font-semibold text-ink">
          <Link href="/reportar/pozo" className="underline">Reportar un pozo</Link>
          <Link href="/reportar/parche" className="underline">Reportar un parche</Link>
        </p>
      </div>
    </div>
  );
}

export default function ProblemasPage(props: PageProps<"/problemas">) {
  return (
    <Suspense fallback={<div className="min-h-[60svh] bg-red" aria-busy="true" />}>
      <Content searchParams={props.searchParams as Promise<{ pagina?: string }>} />
    </Suspense>
  );
}

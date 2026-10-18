import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { RateSegmentForm } from "@/components/forms/rate-segment";
import { getDataSource } from "@/lib/data";
import { midpoint } from "@/lib/domain/geo";

export const metadata: Metadata = { title: "Calificar una cuadra" };

async function Form({ searchParams }: { searchParams: Promise<{ cuadra?: string }> }) {
  await connection();
  const id = Number((await searchParams).cuadra);
  const seg = Number.isInteger(id) ? await getDataSource().getSegment(id) : null;
  return <RateSegmentForm preset={seg ? { id: seg.id, label: seg.label, mid: midpoint(seg.coords) } : null} />;
}

export default function CalificarPage(props: PageProps<"/calificar">) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Calificar una cuadra</h1>
      <p className="mb-5 mt-1 text-ink-2">¿Cómo está el asfalto en general? Tarda unos 10 segundos.</p>
      <Suspense fallback={<p className="text-ink-3">Cargando…</p>}>
        <Form searchParams={props.searchParams as Promise<{ cuadra?: string }>} />
      </Suspense>
    </div>
  );
}

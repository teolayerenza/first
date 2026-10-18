import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { FormPage } from "@/components/form-page";
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
    <FormPage title="Calificá una cuadra" lead="Cómo está el asfalto en general, no un pozo puntual. Tarda unos 10 segundos.">
      <Suspense fallback={<p className="text-ink-2">Cargando…</p>}>
        <Form searchParams={props.searchParams as Promise<{ cuadra?: string }>} />
      </Suspense>
    </FormPage>
  );
}

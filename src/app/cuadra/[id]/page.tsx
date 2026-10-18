import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Glyph } from "@/components/forms/glyphs";
import { IssueVotes } from "@/components/forms/issue-votes";
import { getDataSource } from "@/lib/data";
import { CONDITION_HINT, CONDITION_LABEL, fmtInt, relativeDays } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/cuadra/[id]">): Promise<Metadata> {
  await connection();
  const { id } = await props.params;
  const s = await getDataSource().getSegment(Number(id));
  return s ? { title: s.label } : {};
}

const SEV = ["", "leve", "medio", "peligroso"];
const PARCHE = { elevado: "elevado, como un lomo de burro", hundido: "hundido", desarmado: "se desarmó" } as const;
/** El encabezado de la cuadra se pinta del color de su estado. */
const FIELD = {
  nueva: "bg-nueva text-white",
  buena: "bg-buena text-asphalt",
  gastada: "bg-gastada text-asphalt",
  muy_deteriorada: "bg-red text-red-ink",
  sin_relevar: "bg-asphalt-3 text-asphalt-ink",
  empedrado: "bg-empedrado text-white",
} as const;

async function Content({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const s = await getDataSource().getSegment(Number((await params).id));
  if (!s) notFound();
  const open = s.issues.filter((i) => i.status === "abierto");
  const fixed = s.issues.filter((i) => i.status === "resuelto");
  const key = s.cobbled ? "empedrado" : s.condition;
  return (
    <div>
      <header className={`px-5 pb-14 pt-16 sm:px-8 lg:pb-20 lg:pt-24 ${FIELD[key]}`}>
        <div className="mx-auto max-w-[1400px]">
          <p className="text-small font-semibold">
            <Link href="/" className="underline">Casco</Link> / <Link href={`/zona/${s.zone.slug}`} className="underline">Zona {s.zone.name}</Link>
          </p>
          <h1 className="mt-6 max-w-[18ch] text-[clamp(2.5rem,1rem+4.5vw,5.5rem)]">{s.label}</h1>
          <p className="mt-8 text-head font-semibold leading-none tracking-[-0.04em]">{key === "empedrado" ? "Empedrado" : CONDITION_LABEL[s.condition]}</p>
          <p className="mt-3 max-w-[48ch] text-lead leading-snug">
            {key === "empedrado" ? "Se cuenta aparte del asfalto." : `${CONDITION_HINT[s.condition]}.`}{" "}
            {fmtInt(s.ratingCount)} calificaciones vigentes
            {s.patching && `; parcheo: ${s.patching === "todo_parche" ? "es todo parche" : s.patching}`}
            {s.repavedAt && `; repavimentada en ${new Date(s.repavedAt).toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" })}`}.
          </p>
          <Link href={`/calificar?cuadra=${s.id}`} className="mt-8 inline-flex h-[52px] items-center bg-asphalt px-6 font-semibold text-asphalt-ink hover:opacity-90">
            Calificar esta cuadra
          </Link>
        </div>
      </header>
      <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-12 sm:py-16">
        <section className="bg-surface p-6 sm:p-8">
          <h2 className="text-lead tracking-[-0.02em]">Problemas abiertos: {open.length}</h2>
          {open.length === 0 && <p className="mt-3 text-ink-2">No hay pozos ni parches abiertos reportados en esta cuadra.</p>}
          <ul className="mt-5 flex flex-col gap-1">
            {open.map((i) => (
              <li key={i.id} className="bg-surface-2 p-4">
                <div className="flex items-center gap-4">
                  <Glyph kind={i.kind === "parche" ? (i.parcheType ?? "parche") : "pozo"} className="h-8 w-14 shrink-0 text-ink" />
                  <div>
                    <p className="font-semibold text-ink">
                      {i.kind === "parche" ? `Parche mal hecho${i.parcheType ? `: ${PARCHE[i.parcheType]}` : ""}` : "Pozo"}, {SEV[i.severity]}
                    </p>
                    <p className="text-small text-ink-2">
                      Reportado {relativeDays(i.days)}. {i.verified ? `Verificado, ${i.sigueVotes} confirmaciones.` : "Pendiente de verificación."}
                    </p>
                  </div>
                </div>
                {i.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.photoUrl} alt="Foto del problema" className="mt-3 max-h-64 w-full object-cover" loading="lazy" />
                )}
                <IssueVotes issueId={i.id} kind={i.kind} />
              </li>
            ))}
          </ul>
          <Link href="/reportar" className="mt-6 inline-block font-semibold text-ink underline">Reportar otro problema en esta cuadra</Link>
        </section>
        {fixed.length > 0 && (
          <section className="bg-surface p-6 sm:p-8">
            <h2 className="text-lead tracking-[-0.02em]">Arreglados: {fixed.length}</h2>
            <ul className="mt-3 flex flex-col gap-1 text-ink-2">
              {fixed.map((i) => <li key={i.id}>{i.kind === "parche" ? "Parche" : "Pozo"} reportado {relativeDays(i.days)}</li>)}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

export default function CuadraPage(props: PageProps<"/cuadra/[id]">) {
  return (
    <Suspense fallback={<div className="min-h-[60svh] bg-asphalt-3" aria-busy="true" />}>
      <Content params={props.params} />
    </Suspense>
  );
}

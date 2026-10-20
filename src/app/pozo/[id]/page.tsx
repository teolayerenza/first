import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Glyph } from "@/components/forms/glyphs";
import { IssueVotes } from "@/components/forms/issue-votes";
import { SEVERITY, issueTitle } from "@/components/issue-row";
import { getDataSource } from "@/lib/data";
import { relativeDays } from "@/lib/format";

export const metadata: Metadata = { title: "¿Sigue ahí?" };

/** Un solo problema: qué es, dónde, y los tres votos. Se llega desde el mapa o desde la lista. */
async function Content({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const ds = getDataSource();
  const found = (await ds.getIssues()).features.find((f) => f.properties.id === id)?.properties;
  const segment = found ? await ds.getSegment(found.segmentId) : null;
  const i = found && segment?.issues.find((x) => x.id === id);
  if (!i || !segment) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <section className="bg-surface p-6 sm:p-8">
          <h1 className="text-head">Este problema ya no está abierto</h1>
          <p className="mt-4 text-ink-2">Lo marcaron como arreglado o se ocultó por denuncias.</p>
          <Link href="/problemas" className="mt-8 inline-flex h-[52px] items-center bg-asphalt px-6 font-semibold text-asphalt-ink">
            Ver los problemas abiertos
          </Link>
        </section>
      </div>
    );
  }
  const sev = SEVERITY[i.severity];
  return (
    <div>
      <header className={`px-5 pb-12 pt-14 sm:px-8 lg:pb-16 lg:pt-20 ${sev.field}`}>
        <div className="mx-auto max-w-3xl">
          <p className="text-small font-semibold">
            <Link href="/problemas" className="underline">Problemas abiertos</Link> / <Link href={`/cuadra/${segment.id}`} className="underline">{segment.label}</Link>
          </p>
          <Glyph kind={i.kind === "parche" ? (i.parcheType ?? "parche") : "pozo"} className="mt-8 h-10 w-20" />
          <h1 className="mt-4 text-[clamp(2.25rem,1rem+3.5vw,4rem)]">{issueTitle(i)}, {sev.label.toLowerCase()}</h1>
          <p className="mt-3 text-lead font-semibold leading-snug">{segment.label}</p>
          <p className="mt-2 max-w-[48ch]">
            Reportado {relativeDays(i.days)}. {i.verified ? `Verificado, ${i.sigueVotes} ${i.sigueVotes === 1 ? "vecino confirmó" : "vecinos confirmaron"} que sigue.` : "Pendiente: falta una foto o que otro vecino lo confirme."}
          </p>
        </div>
      </header>
      <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-12 sm:py-16">
        {(i.comment || i.photoUrl) && (
          <section className="bg-surface p-6 sm:p-8">
            {i.comment && (
              // Texto plano: React lo escapa, nunca se interpreta como HTML.
              <blockquote className="border-l-4 border-ink-3 pl-4 text-lead text-ink">“{i.comment}”</blockquote>
            )}
            {i.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={i.photoUrl} alt="Foto del problema" className={`${i.comment ? "mt-5" : ""} max-h-96 w-full object-cover`} loading="lazy" />
            )}
          </section>
        )}
        <section className="bg-surface p-6 sm:p-8">
          <h2 className="text-lead tracking-[-0.02em]">¿Sigue ahí?</h2>
          <p className="mt-2 text-ink-2">Si pasaste hace poco, contanos cómo está. Es anónimo.</p>
          <div className="mt-3">
            <IssueVotes issueId={i.id} kind={i.kind} />
          </div>
        </section>
        <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-semibold text-ink">
          <Link href={`/cuadra/${segment.id}`} className="underline">Ver la cuadra</Link>
          <Link href="/problemas" className="underline">Ver todos los problemas abiertos</Link>
        </p>
      </div>
    </div>
  );
}

export default function PozoPage(props: PageProps<"/pozo/[id]">) {
  return (
    <Suspense fallback={<div className="min-h-[60svh] bg-asphalt-3" aria-busy="true" />}>
      <Content params={props.params} />
    </Suspense>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { IssueVotes } from "@/components/forms/issue-votes";
import { getDataSource } from "@/lib/data";
import { CONDITION_BG, CONDITION_HINT, CONDITION_LABEL, fmtInt, relativeDays } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/cuadra/[id]">): Promise<Metadata> {
  await connection();
  const { id } = await props.params;
  const s = await getDataSource().getSegment(Number(id));
  return s ? { title: s.label } : {};
}

const SEV = ["", "leve", "medio", "peligroso"];
const PARCHE = { elevado: "elevado (lomo de burro)", hundido: "hundido", desarmado: "se desarmó" } as const;

async function Content({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const s = await getDataSource().getSegment(Number((await params).id));
  if (!s) notFound();
  const open = s.issues.filter((i) => i.status === "abierto");
  const fixed = s.issues.filter((i) => i.status === "resuelto");
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <p className="text-sm text-ink-3">
        <Link href="/" className="underline">Casco</Link> › <Link href={`/zona/${s.zone.slug}`} className="underline">Zona {s.zone.name}</Link>
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{s.label}</h1>
      <section className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-ink-3">Estado del asfalto</p>
        {s.cobbled ? (
          <p className="mt-1 flex items-center gap-2 text-xl font-semibold text-ink"><span className="swatch h-4 w-4 rounded bg-empedrado" /> Empedrado</p>
        ) : (
          <>
            <p className="mt-1 flex items-center gap-2 text-xl font-semibold text-ink"><span className={`swatch h-4 w-4 rounded ${CONDITION_BG[s.condition]}`} /> {CONDITION_LABEL[s.condition]}</p>
            <p className="text-sm text-ink-2">{CONDITION_HINT[s.condition]}</p>
          </>
        )}
        <p className="mt-2 text-xs text-ink-3">
          {fmtInt(s.ratingCount)} calificaciones vigentes
          {s.patching && ` · parcheo: ${s.patching === "todo_parche" ? "es todo parche" : s.patching}`}
          {s.repavedAt && ` · repavimentada en ${new Date(s.repavedAt).toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" })}`}
        </p>
        <Link href={`/calificar?cuadra=${s.id}`} className="mt-4 inline-flex h-10 items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-ink">Calificar esta cuadra</Link>
      </section>
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold text-ink">Problemas abiertos ({open.length})</h2>
        {open.length === 0 && <p className="mt-2 text-sm text-ink-2">No hay pozos ni parches abiertos reportados.</p>}
        <ul className="mt-3 flex flex-col gap-3">
          {open.map((i) => (
            <li key={i.id} className="rounded-xl border border-line p-3">
              <p className="text-ink">
                {i.kind === "parche" ? `🩹 Parche mal hecho${i.parcheType ? `: ${PARCHE[i.parcheType]}` : ""}` : "🕳️ Pozo"} · {SEV[i.severity]}
              </p>
              <p className="text-xs text-ink-3">
                Reportado {relativeDays(i.days)} · {i.verified ? `✓ verificado (${i.sigueVotes} confirmaciones)` : "pendiente de verificación"}
              </p>
              {i.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.photoUrl} alt="Foto del problema" className="mt-2 max-h-56 rounded-lg object-cover" loading="lazy" />
              )}
              <IssueVotes issueId={i.id} kind={i.kind} />
            </li>
          ))}
        </ul>
        <Link href="/reportar" className="mt-4 inline-block text-sm underline text-ink-2">Reportar otro problema en esta cuadra</Link>
      </section>
      {fixed.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-semibold text-ink">Arreglados ✅ ({fixed.length})</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-ink-2">
            {fixed.map((i) => <li key={i.id}>{i.kind === "parche" ? "🩹 Parche" : "🕳️ Pozo"} reportado {relativeDays(i.days)}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function CuadraPage(props: PageProps<"/cuadra/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl px-4 py-6 text-ink-3">Cargando…</div>}>
      <Content params={props.params} />
    </Suspense>
  );
}

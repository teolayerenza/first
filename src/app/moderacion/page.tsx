import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Block, Page } from "@/components/prose";
import { getDataSource } from "@/lib/data";
import { fmtInt } from "@/lib/format";

export const metadata: Metadata = { title: "Bitácora de moderación", description: "Cada aporte ocultado o puesto en revisión, con su motivo." };

async function Log() {
  await connection();
  const { moderation } = await getDataSource().getDashboard();
  if (!moderation.length) return <p>Todavía no hubo acciones de moderación.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {moderation.map((m, i) => (
        <li key={i} className="rounded-xl border border-line p-3">
          <p className="text-ink"><strong>{m.action}</strong> · {fmtInt(m.count)} aportes · {m.area}</p>
          <p className="text-sm">{m.reason}</p>
          <p className="text-xs text-ink-3">{new Date(m.at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</p>
        </li>
      ))}
    </ul>
  );
}

export default function ModeracionPage() {
  return (
    <Page title="Bitácora de moderación" intro="Para que los números sean confiables, cada vez que se oculta o se pone en revisión un aporte queda registrado acá, con su motivo.">
      <Block title="Últimas acciones">
        <Suspense fallback={<p>Cargando…</p>}><Log /></Suspense>
      </Block>
      <Block title="Cómo funciona">
        <p>Los aportes nuevos tardan unos minutos en contar. En ese tiempo, un detector automático busca ráfagas inusuales (muchos aportes en una zona en poco tiempo, o de sesiones recién creadas). Si encuentra una, esos aportes quedan <strong>en revisión</strong> y no cuentan hasta que una persona los revise.</p>
        <p>Los reportes también se ocultan solos cuando varios vecinos marcan “no existe”.</p>
      </Block>
    </Page>
  );
}

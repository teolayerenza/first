import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Block, Page, Table } from "@/components/prose";
import { getDataSource } from "@/lib/data";
import { fmt1, fmtInt, fmtPct } from "@/lib/format";

export const metadata: Metadata = { title: "Prensa", description: "Kit de prensa de Pocitos LP con los números del día." };

async function Numbers() {
  await connection();
  const d = await getDataSource().getDashboard();
  const k = d.kpis;
  const day = new Date(k.asOf).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });
  return (
    <>
      <p>Datos al {day}{d.mode === "demo" ? " (MODO DEMO: datos simulados, no publicar)" : ""}:</p>
      <Table
        head={["Indicador", "Valor"]}
        rows={[
          ["Calles del casco muy deterioradas", `${fmtPct(k.pct.muy_deteriorada)} (${fmtInt(k.cuadras.muy_deteriorada)} cuadras, ${fmt1(k.km.muy_deteriorada)} km)`],
          ["Calles repavimentadas en el último año", fmtPct(k.pct.nueva)],
          ["Porcentaje del casco relevado por vecinos", fmtPct(k.pctSurveyed)],
          ["Pozos abiertos verificados", fmtInt(k.issues.openPozos)],
          ["Parches mal hechos abiertos", fmtInt(k.issues.openParches)],
          ["Arreglos que quedaron mal (90 días)", k.issues.badFixRatePct === null ? "—" : fmtPct(k.issues.badFixRatePct)],
          ["Tiempo promedio de arreglo", k.issues.avgRepairDays === null ? "—" : `${fmtInt(k.issues.avgRepairDays)} días`],
          ["Pozo más viejo sin arreglar", k.issues.oldestOpen ? `${k.issues.oldestOpen.label} (${fmtInt(k.issues.oldestOpen.days)} días)` : "—"],
          ["Vecinos que aportaron", fmtInt(d.contributors.total)],
        ]}
      />
    </>
  );
}

export default function PrensaPage() {
  return (
    <Page title="Prensa" intro="Pocitos LP mide, entre vecinos, el estado real de las calles del casco urbano de La Plata.">
      <Block title="En tres líneas">
        <p>Pocitos LP es una plataforma ciudadana, anónima y sin fines de lucro donde los vecinos reportan pozos y parches mal hechos y califican el estado del asfalto de cada cuadra.</p>
        <p>Con esos aportes calcula indicadores públicos y verificables: qué porcentaje de las calles está deteriorado, cuántos pozos hay abiertos y cuánto tardan en arreglarse.</p>
        <p>Todos los datos son abiertos y descargables.</p>
      </Block>
      <Block title="Los números de hoy">
        <Suspense fallback={<p>Cargando…</p>}><Numbers /></Suspense>
      </Block>
      <Block title="Material">
        <ul className="list-disc pl-5">
          <li><a href="/opengraph-image">Imagen con el número del día</a> (1200×630)</li>
          <li><a href="/datos">Datos abiertos</a> para armar tu propio análisis</li>
          <li><a href="/metodologia">Metodología</a> de cada indicador</li>
        </ul>
      </Block>
      <Block title="Contacto">
        <p><a href="mailto:hola@pocitoslp.com.ar">hola@pocitoslp.com.ar</a></p>
      </Block>
    </Page>
  );
}

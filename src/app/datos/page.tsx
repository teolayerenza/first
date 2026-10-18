import type { Metadata } from "next";
import { Block, Page, Table } from "@/components/prose";

export const metadata: Metadata = { title: "Datos abiertos", description: "Descargá todos los datos de Pocitos LP: cuadras, pozos, parches e indicadores." };

const FILES = [
  ["/api/datos/cuadras.geojson", "Cuadras con estado, parcheo, empedrado y problemas abiertos", "GeoJSON"],
  ["/api/datos/cuadras.csv", "Lo mismo, en planilla", "CSV"],
  ["/api/datos/problemas.geojson", "Pozos y parches abiertos (verificados y pendientes)", "GeoJSON"],
  ["/api/datos/problemas.csv", "Lo mismo, en planilla", "CSV"],
  ["/api/datos/kpis.json", "Indicadores del casco, serie mensual y ranking de zonas", "JSON"],
];

export default function DatosPage() {
  return (
    <Page title="Datos abiertos" intro="Todo lo que ves en el tablero se puede descargar, analizar y reutilizar. Sin registrarse.">
      <Block title="Descargas">
        <Table
          head={["Archivo", "Contenido", "Formato"]}
          rows={FILES.map(([href, desc, fmt]) => [<a key={href} href={href} download>{href.split("/").pop()}</a>, desc, fmt])}
        />
        <p>Todos aceptan <code>?zona=ID</code> para filtrar una zona. Los datos se actualizan en tiempo real.</p>
      </Block>
      <Block title="Licencia">
        <p>Los datos se publican bajo la <a href="https://opendatacommons.org/licenses/odbl/">Open Database License (ODbL)</a>: podés usarlos, compartirlos y adaptarlos, citando la fuente (“Pocitos LP y colaboradores de OpenStreetMap”) y compartiendo tus mejoras con la misma licencia.</p>
        <p>Las calles provienen de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>.</p>
      </Block>
      <Block title="Qué no está">
        <p>Ningún archivo contiene datos de quién aportó: no existen en la base. Ver <a href="/privacidad">privacidad</a>.</p>
      </Block>
    </Page>
  );
}

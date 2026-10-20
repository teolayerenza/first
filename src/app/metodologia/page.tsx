import type { Metadata } from "next";
import { Block, Page, Table } from "@/components/prose";
import { DEFAULT_CONFIG as C } from "@/lib/domain/config";

export const metadata: Metadata = { title: "Metodología", description: "Cómo se calcula cada número de Pocitos LP." };

export default function MetodologiaPage() {
  return (
    <Page title="Cómo se calcula cada número" intro="Todo es reproducible: las reglas están acá, el código es auditable y los datos se pueden descargar.">
      <Block title="Dos mediciones que no se mezclan">
        <p><strong>Estado del asfalto</strong> (por cuadra): cómo está la calle en general. Lo califican los vecinos.</p>
        <p><strong>Problemas puntuales</strong> (pozos y parches mal hechos): roturas en un punto. Los reporta cualquiera que pase.</p>
        <p>Una cuadra puede tener asfalto nuevo y un pozo, o estar muy deteriorada sin un pozo puntual. Por eso se miden por separado.</p>
      </Block>

      <Block title="Estado de cada cuadra">
        <ul className="list-disc pl-5">
          <li>Se toman las calificaciones de los últimos {C.conditionWindowDays} días. Cada dispositivo tiene un solo voto vigente por cuadra.</li>
          <li>Una calificación hecha <strong>en el lugar</strong> (el GPS está a menos de {C.onSiteRadiusM} m) pesa {C.onSiteWeight}; una hecha a distancia pesa 1.</li>
          <li>Con una calificación ya alcanza. Si hay varias, el estado es la opción con más peso. Ante un empate, gana la opción peor.</li>
          <li>Si nadie la calificó, la cuadra queda <strong>sin relevar</strong>.</li>
          <li>Si un vecino confirma una repavimentación de los últimos 12 meses, la cuadra pasa a <strong>nueva</strong>.</li>
          <li>El <strong>empedrado</strong> lo marcan los vecinos, y queda fuera de los porcentajes de asfalto.</li>
        </ul>
      </Block>

      <Block title="Porcentajes">
        <p>Se calculan sobre <strong>kilómetros de asfalto</strong>, no sobre cantidad de cuadras: las cuadras de las diagonales y las avenidas no miden lo mismo. La cantidad de cuadras se muestra al lado.</p>
        <p>Siempre se muestra el <strong>% sin relevar</strong>. Nunca se presenta un porcentaje calculado solo sobre lo relevado sin decirlo.</p>
        <p>La variación mensual compara contra una foto de los indicadores tomada todos los días.</p>
      </Block>

      <Block title="Pozos y parches">
        <ul className="list-disc pl-5">
          <li>Un problema cuenta (está <strong>verificado</strong>) si tiene foto o si otra persona lo confirmó con “sigue ahí”. Quien lo reportó no puede confirmarlo, y las sesiones de menos de 24 horas no alcanzan para verificar.</li>
          <li>Se marca <strong>arreglado</strong> con {C.resolveVotes} votos “ya lo arreglaron” de personas distintas. Al votar, se pregunta si quedó bien o quedó un parche mal hecho.</li>
          <li>Si el arreglo quedó mal, el pozo se cierra y en el mismo punto se abre un <strong>parche mal hecho</strong>. Así se mide la calidad del arreglo.</li>
          <li>Con {C.hideVotes} votos “no existe”, el reporte se oculta.</li>
          <li>Reportes a menos de {C.dedupeRadiusM} m de otro abierto del mismo tipo se tratan como el mismo.</li>
        </ul>
        <Table
          head={["Indicador", "Cálculo"]}
          rows={[
            ["Pozos por km", "Pozos verificados abiertos / km de asfalto"],
            ["Arreglados vs. nuevos", "Pozos verificados resueltos vs. creados en los últimos 30 días"],
            ["Tiempo de arreglo", `Promedio y mediana de días entre el reporte y el arreglo (últimos ${C.repairWindowDays} días)`],
            ["Calidad del arreglo", `Arreglos que quedaron como parche mal hecho / arreglos con dato de calidad (últimos ${C.repairWindowDays} días)`],
            ["Densidad por cuadra", "Problemas abiertos cada 100 m, ponderados por gravedad (leve 1, medio 2, peligroso 4)"],
          ]}
        />
      </Block>

      <Block title="Zonas y rankings">
        <p>Las zonas son los cuadrantes entre avenidas (por ejemplo, “7–13 / 44–51”). La franja 51–53 se une con 53–60.</p>
        <p>Para entrar al ranking, una zona necesita al menos {C.rankingMinSurveyedPct}% de sus calles relevadas.</p>
      </Block>

      <Block title="Límites honestos">
        <ul className="list-disc pl-5">
          <li><strong>Sesgo de reporte:</strong> las zonas con más vecinos usando la app tienen más datos. Por eso se muestra el % relevado de cada zona.</li>
          <li><strong>Es percepción ciudadana</strong>, no una inspección técnica. La verificación cruzada reduce errores, pero no los elimina.</li>
          <li>Los umbrales pueden ajustarse con datos reales; cada cambio se anuncia públicamente.</li>
        </ul>
      </Block>
    </Page>
  );
}

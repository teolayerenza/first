import type { Metadata } from "next";
import { AnonymityStatement } from "@/components/anonymity";
import { Block, Page, Table } from "@/components/prose";

export const metadata: Metadata = { title: "Privacidad y seguridad", description: "Qué datos guarda Pocitos LP (casi ninguno) y cómo se protege de ataques." };

export default function PrivacidadPage() {
  return (
    <Page title="Tu anonimato" intro="Pocitos LP es un bien común: funciona sin cuentas y guarda solo lo mínimo indispensable para calcular los números y frenar abusos.">
      <section className="bg-asphalt p-6 text-asphalt-ink sm:p-8">
        <AnonymityStatement columns={false} />
      </section>

      <Block id="que-guardamos" title="Qué se guarda, exactamente">
        <Table
          head={["Dato", "¿Es personal?", "Para qué"]}
          rows={[
            ["Cuadras y zonas", "No", "Son datos públicos de OpenStreetMap."],
            ["Calificación de una cuadra (buena / gastada / muy deteriorada), si fue en el lugar (sí/no), hora redondeada", "No", "Calcular el estado del asfalto."],
            ["Pozo o parche: ubicación del problema, gravedad, foto revisada", "No", "Es lo que muestra el mapa."],
            ["Comentario opcional del pozo o parche (hasta 200 caracteres)", "No, si no ponés datos tuyos", "Contar cómo está. Es público: se borran solos teléfonos, mails y links, y se oculta si lo denuncian."],
            ["Votos “sigue ahí / arreglado / no existe”", "No", "Verificar y cerrar reportes."],
            ["Un código por aporte (hash) que cambia en cada cuadra y en cada pozo", "No", "Que nadie vote dos veces lo mismo. No permite juntar los aportes de un mismo celular."],
            ["Contador de vecinos: un código por celular, el día del primer aporte y 3 sí/no", "No", "Mostrar cuántos vecinos se sumaron. No dice qué aportó ni dónde."],
            ["Contadores de límite diario", "No", "Frenar envíos masivos. Se borran todos los días."],
            ["Sesión anónima (un identificador al azar)", "Pseudónimo al azar", "Se borra a los 30 días sin uso."],
          ]}
        />
        <p><strong>No se guardan nunca:</strong> nombre, mail, teléfono, cuenta de Google, barrio, domicilio, la ubicación de tu celular, tu IP ni los metadatos de las fotos.</p>
      </Block>

      <Block id="ataques" title="Cómo cuidamos los datos de ataques">
        <ul className="list-disc pl-5">
          <li><strong>Una sola puerta de escritura.</strong> Nadie puede escribir directo en la base: todo pasa por una función del servidor que valida cada envío.</li>
          <li><strong>Captcha invisible y límites diarios</strong> por dispositivo, por cuadra y para todo el casco.</li>
          <li><strong>Verificación cruzada.</strong> Un pozo cuenta si tiene foto o si lo confirma otra persona. Nadie puede confirmar su propio reporte, y una sesión recién creada no alcanza para verificar sola.</li>
          <li><strong>Revisión automática.</strong> Los aportes tardan unos minutos en contar: si aparece una ráfaga sospechosa en una zona, queda en revisión y se avisa en la <a href="/moderacion">bitácora pública</a>.</li>
          <li><strong>Todo se puede deshacer</strong> sin perder los aportes legítimos.</li>
          <li><strong>Si nos roban la base</strong>, no hay datos personales y los códigos no se pueden revertir: la clave que los genera no está guardada en la base.</li>
        </ul>
      </Block>

      <Block title="Letra chica">
        <p>Los servicios donde está alojada la app (Cloudflare, Vercel y Supabase) registran datos técnicos como la IP en sus propios sistemas, por seguridad y por un tiempo limitado. Pocitos LP no accede a esos registros para identificar a nadie y configura la retención mínima posible.</p>
        <p>El captcha invisible es Cloudflare Turnstile: para distinguir personas de bots analiza datos técnicos del navegador según su <a href="https://www.cloudflare.com/turnstile-privacy-policy/">Anexo de Privacidad de Turnstile</a>. No usa cookies de seguimiento ni se usa para publicidad.</p>
        <p>Las fotos se publican recién cuando otra persona confirmó el problema. Si una foto muestra a alguien o una patente, denunciala desde la cuadra y se oculta.</p>
        <p>Este tratamiento se rige por la Ley 25.326 de Protección de los Datos Personales. Como no se recolectan datos personales, no hay datos que consultar, rectificar o borrar; si igual tenés una consulta, escribinos a <a href="mailto:hola@pocitos.com.ar">hola@pocitos.com.ar</a>.</p>
      </Block>
    </Page>
  );
}

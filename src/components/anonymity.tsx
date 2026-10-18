import Link from "next/link";

/**
 * "Tu anonimato" como un texto grande y continuo, con los datos clave resaltados. Va sobre fondo asfalto.
 */
export function AnonymityStatement({ columns = true }: { columns?: boolean }) {
  const hl = (cls: string) => `mark ${cls}`;
  return (
    <div className={`text-[clamp(1.375rem,0.9rem+1.3vw,2rem)] leading-[1.25] text-asphalt-ink-2 ${columns ? "lg:columns-2 lg:gap-12" : ""}`}>
      <p>
        <span className="text-asphalt-ink">Pocitos LP no te pide nada:</span> ni nombre, ni mail, ni teléfono, ni que crees una cuenta.{" "}
        Guardamos dónde está el pozo o qué cuadra calificaste, <span className={hl("bg-paint text-paint-ink")}>nunca dónde estás vos</span>.{" "}
        <span className={hl("bg-asphalt-ink text-asphalt")}>No guardamos tu IP</span>. Cada aporte lleva un código distinto, así que{" "}
        no hay forma de saber qué cuadras calificó un mismo celular ni de deducir dónde vivís.{" "}
        Las fotos se limpian en tu celular antes de subirse: <span className={hl("bg-buena text-asphalt")}>sin ubicación, sin fecha, sin modelo de teléfono</span>.{" "}
        No hay publicidad, ni rastreadores, ni venta de datos.{" "}
        Y si alguien entrara a la base, se llevaría lo mismo que ya ves en el mapa: pozos y calificaciones de calles.{" "}
        <span className={hl("bg-paint text-paint-ink")}>No hay datos personales para robar</span>.
      </p>
      <p className="mt-6 text-small leading-normal text-asphalt-ink-2">
        Para ser honestos: los servicios donde está alojada la app (Cloudflare, Vercel y Supabase) registran datos técnicos como la IP en
        sus propios sistemas, por seguridad y por tiempo limitado. No los usamos para identificar a nadie.
      </p>
      <p className="mt-6">
        <Link href="/privacidad" className={hl("bg-green text-green-ink underline-offset-4 hover:underline")}>Mirá campo por campo qué se guarda.</Link>
      </p>
    </div>
  );
}

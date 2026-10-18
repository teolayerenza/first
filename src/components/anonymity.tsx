import Link from "next/link";

/**
 * "Tu anonimato": texto corrido, un solo tamaño y un solo color; lo clave va en negrita. Va sobre fondo asfalto.
 */
export function AnonymityStatement({ columns = true }: { columns?: boolean }) {
  return (
    <div className={`max-w-prose space-y-4 text-lead leading-relaxed text-asphalt-ink ${columns ? "lg:max-w-none lg:columns-2 lg:gap-12" : ""}`}>
      <p>
        <strong>Pocitos LP no te pide nada:</strong> ni nombre, ni mail, ni teléfono, ni que crees una cuenta. Guardamos dónde está el
        pozo o qué cuadra calificaste, <strong>nunca dónde estás vos</strong>. <strong>No guardamos tu IP.</strong> Cada aporte lleva un
        código distinto, así que no hay forma de saber qué cuadras calificó un mismo celular ni de deducir dónde vivís.
      </p>
      <p>
        Las fotos se limpian en tu celular antes de subirse: <strong>sin ubicación, sin fecha, sin modelo de teléfono</strong>. No hay
        publicidad, ni rastreadores, ni venta de datos. Y si alguien entrara a la base, se llevaría lo mismo que ya ves en el mapa:
        pozos y calificaciones de calles. <strong>No hay datos personales para robar.</strong>
      </p>
      <p>
        Para ser honestos: los servicios donde está alojada la app (Cloudflare, Vercel y Supabase) registran datos técnicos como la IP en
        sus propios sistemas, por seguridad y por tiempo limitado. No los usamos para identificar a nadie.
      </p>
      <p>
        <Link href="/privacidad" className="font-semibold underline underline-offset-4">
          Mirá campo por campo qué se guarda.
        </Link>
      </p>
    </div>
  );
}

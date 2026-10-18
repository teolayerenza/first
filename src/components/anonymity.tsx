import Link from "next/link";

const POINTS = [
  ["🙅", "No te pedimos nada.", "Ni nombre, ni mail, ni teléfono, ni que crees una cuenta."],
  ["📍", "No sabemos dónde estás.", "Guardamos dónde está el pozo o qué cuadra calificaste, nunca tu ubicación."],
  ["🌐", "No guardamos tu IP.", "Ninguna tabla de Pocitos LP tiene direcciones IP."],
  ["🧩", "Tus aportes no se pueden juntar.", "No hay forma de saber qué cuadras calificó un mismo celular, así que tampoco se puede deducir dónde vivís."],
  ["🧽", "Tus fotos se limpian en tu celular.", "Antes de subirse pierden la ubicación, la fecha y el modelo del teléfono."],
  ["🚫", "Sin publicidad, sin rastreadores, sin venta de datos.", "Nunca."],
] as const;

export function AnonymityBlock({ compact = false }: { compact?: boolean }) {
  return (
    <section id="anonimato" className="rounded-2xl border border-line bg-surface p-4 sm:p-6" aria-labelledby="anon-title">
      <h2 id="anon-title" className="text-lg font-semibold tracking-tight text-ink">🔒 Tu anonimato</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {POINTS.map(([icon, title, body]) => (
          <li key={title} className="flex gap-3">
            <span aria-hidden className="text-xl leading-6">{icon}</span>
            <p className="text-sm text-ink-2">
              <strong className="text-ink">{title}</strong> {body}
            </p>
          </li>
        ))}
      </ul>
      <div className="mt-5 rounded-xl bg-surface-2 p-4">
        <p className="text-sm text-ink">
          <strong>¿Y si nos hackean?</strong> Se llevarían lo mismo que ya ves en este mapa: pozos y calificaciones de calles.
          No hay datos personales para robar.
        </p>
      </div>
      {!compact && (
        <p className="mt-4 text-xs text-ink-3">
          <em>Letra chica, para ser honestos:</em> los servicios donde está alojada la app (Cloudflare, Vercel, Supabase) registran
          datos técnicos como la IP en sus propios sistemas, por seguridad y por tiempo limitado. Nosotros no los usamos para identificar a nadie.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link href="/privacidad#que-guardamos" className="underline text-ink-2 hover:text-ink">Ver exactamente qué se guarda ›</Link>
        <Link href="/privacidad#ataques" className="underline text-ink-2 hover:text-ink">Cómo cuidamos los datos de ataques ›</Link>
      </div>
    </section>
  );
}

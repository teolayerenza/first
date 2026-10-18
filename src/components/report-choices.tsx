import Link from "next/link";
import { Glyph } from "./forms/glyphs";

/** Las tres acciones, separadas y grandes, para el pulgar. */
export const ACTIONS = [
  { href: "/reportar/pozo", title: "Reportar un pozo", desc: "Donde falta asfalto", glyph: "pozo" as const, cls: "bg-red text-red-ink" },
  { href: "/reportar/parche", title: "Reportar un parche", desc: "Bacheo mal hecho: elevado, hundido o desarmado", glyph: "parche" as const, cls: "bg-paint text-paint-ink" },
  { href: "/calificar", title: "Calificar mi cuadra", desc: "Cómo está el asfalto en general", glyph: "cuadra" as const, cls: "bg-green text-green-ink" },
];

/** `onGreen`: sobre un fondo verde, "Calificar" va en asfalto para que no se pierda. */
export function ReportChoices({ onGreen = false }: { onGreen?: boolean }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-3">
      {ACTIONS.map((a) => (
        <li key={a.href}>
          <Link href={a.href} className={`flex flex-col gap-4 p-5 active:opacity-90 sm:min-h-36 sm:justify-between sm:p-6 ${onGreen && a.href === "/calificar" ? "bg-asphalt text-asphalt-ink" : a.cls}`}>
            <Glyph kind={a.glyph} className="h-10 w-16" />
            <span>
              <span className="block text-lead font-semibold leading-tight">{a.title}</span>
              <span className="block text-small">{a.desc}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

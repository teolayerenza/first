"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ACTIONS } from "./report-choices";

const SHORT = ["Pozo", "Parche", "Mi cuadra"];

/** Barra fija abajo, solo en el celular: las tres acciones al alcance del pulgar. Respeta el "notch". */
export function MobileActions() {
  const path = usePathname();
  if (path.startsWith("/reportar") || path.startsWith("/calificar")) return null;
  return (
    <nav aria-label="Aportar" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 bg-asphalt pb-[env(safe-area-inset-bottom)] md:hidden">
      {ACTIONS.map((a, i) => (
        <Link key={a.href} href={a.href} className={`flex h-14 flex-col items-center justify-center text-small font-semibold leading-tight ${a.cls}`}>
          <span className="text-[11px] font-normal opacity-90">{i < 2 ? "Reportar" : "Calificar"}</span>
          {SHORT[i]}
        </Link>
      ))}
    </nav>
  );
}

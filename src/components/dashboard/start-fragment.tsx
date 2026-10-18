"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** El primer paso del formulario, ya abierto en la página: elegir qué aportar y seguir. */
export function StartFragment() {
  const router = useRouter();
  const [what, setWhat] = useState<"reportar" | "calificar">("reportar");
  return (
    <form data-ui onSubmit={(e) => { e.preventDefault(); router.push(`/${what}`); }}
      className="w-full max-w-[440px] bg-surface p-6 text-ink shadow-2xl">
      <p className="text-lead font-semibold leading-tight">¿Qué querés sumar?</p>
      <div role="radiogroup" aria-label="Tipo de aporte" className="mt-4 grid grid-cols-2 gap-1 bg-surface-2 p-1">
        {([["reportar", "Un pozo o un parche"], ["calificar", "El estado de mi cuadra"]] as const).map(([v, t]) => (
          <button key={v} type="button" role="radio" aria-checked={what === v} onClick={() => setWhat(v)}
            className={`min-h-14 px-3 text-small font-semibold ${what === v ? "bg-asphalt text-asphalt-ink" : "text-ink-2 hover:text-ink"}`}>
            {t}
          </button>
        ))}
      </div>
      <p className="mt-4 text-small text-ink-2">
        {what === "reportar" ? "Marcás el lugar en el mapa, elegís la gravedad y listo. Unos 15 segundos." : "Ubicás la cuadra y elegís: buena, gastada o muy deteriorada. Unos 10 segundos."}
      </p>
      <button type="submit" className="mt-5 h-[52px] w-full bg-green font-semibold text-green-ink hover:opacity-90">
        Seguir
      </button>
    </form>
  );
}

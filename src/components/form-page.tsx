import type { ReactNode } from "react";

/** Encabezado y columna de los formularios: título grande sobre asfalto y los pasos debajo. */
export function FormPage({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <div>
      <header className="bg-asphalt px-5 pb-12 pt-14 text-asphalt-ink sm:px-8 lg:pb-16 lg:pt-20">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-[clamp(2.5rem,1rem+4vw,4.5rem)]">{title}</h1>
          <p className="mt-4 text-lead leading-snug text-asphalt-ink-2">{lead}</p>
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">{children}</div>
    </div>
  );
}

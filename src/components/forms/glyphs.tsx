/** Mini cortes de calle, dibujados en el mismo lenguaje que el corte grande del tablero. */
export function Glyph({ kind, className = "h-8 w-14" }: { kind: "pozo" | "parche" | "elevado" | "hundido" | "desarmado"; className?: string }) {
  return (
    <svg viewBox="0 0 60 32" className={className} aria-hidden fill="currentColor">
      {kind === "pozo" && <path d="M2 18 H20 C22 18 23 28 30 28 C37 28 38 18 40 18 H58 V30 H2 Z" />}
      {(kind === "parche" || kind === "elevado") && <path d="M2 18 H18 C22 18 23 8 30 8 C37 8 38 18 42 18 H58 V30 H2 Z" />}
      {kind === "hundido" && <path d="M2 18 H18 L20 23 H40 L42 18 H58 V30 H2 Z" />}
      {kind === "desarmado" && (
        <path d="M2 18 H18 L22 14 L26 20 L30 13 L34 20 L38 15 L42 18 H58 V30 H2 Z" />
      )}
    </svg>
  );
}

export function Pin({ className = "h-10 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 40" className={className} aria-hidden>
      <path d="M16 39 C16 39 3 24 3 15 a13 13 0 0 1 26 0 C29 24 16 39 16 39 Z" fill="var(--paint)" stroke="var(--asphalt)" strokeWidth="2.5" />
      <circle cx="16" cy="15" r="4.5" fill="var(--asphalt)" />
    </svg>
  );
}

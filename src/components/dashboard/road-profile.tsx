/**
 * Dibujo del tema en sí: una calle platense en corte. Asfalto, cordón, la línea pintada,
 * un pozo y un parche que quedó como lomo de burro. Colores planos de la paleta, sin adornos.
 */
export function RoadProfile({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 800 520" className={className} role="img" aria-label="Dibujo de una calle en corte: un pozo y, al lado, un parche que quedó como un lomo de burro">
      {/* tierra */}
      <rect x="0" y="330" width="800" height="190" fill="var(--red-2)" />
      {/* cordón y vereda */}
      <rect x="0" y="250" width="70" height="90" fill="var(--asphalt-ink)" />
      <rect x="730" y="250" width="70" height="90" fill="var(--asphalt-ink)" />
      {/* carpeta asfáltica con el pozo y el parche */}
      <path
        d="M70 300 H250 C262 300 268 312 274 330 C282 356 352 356 360 330 C366 312 372 300 384 300 H470 C486 300 492 264 540 262 C588 264 594 300 610 300 H730 V340 H70 Z"
        fill="var(--asphalt)"
      />
      {/* el parche: otro asfalto, más nuevo */}
      <path d="M470 300 C486 300 492 264 540 262 C588 264 594 300 610 300 Z" fill="var(--asphalt-3)" />
      {/* agua en el fondo del pozo */}
      <path d="M290 344 C305 352 330 352 345 344 Z" fill="var(--c-empedrado)" opacity="0.9" />
      {/* línea pintada */}
      <rect x="120" y="292" width="70" height="8" fill="var(--paint)" />
      <rect x="400" y="292" width="50" height="8" fill="var(--paint)" />
      <rect x="650" y="292" width="60" height="8" fill="var(--paint)" />
      {/* rótulos dibujados como parte del corte */}
      <g fill="var(--red-ink)" fontFamily="inherit" fontWeight="600">
        <text x="317" y="400" textAnchor="middle" fontSize="30">pozo</text>
        <path d="M317 372 V360" stroke="var(--red-ink)" strokeWidth="4" />
        <text x="540" y="226" textAnchor="middle" fontSize="30">parche mal hecho</text>
        <path d="M540 236 V252" stroke="var(--red-ink)" strokeWidth="4" />
      </g>
    </svg>
  );
}

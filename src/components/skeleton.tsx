export function DashboardSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8" aria-busy="true" aria-label="Cargando el tablero">
      {[220, 180, 90, 560].map((h, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-line bg-surface motion-reduce:animate-none" style={{ height: h }} />
      ))}
    </div>
  );
}

import type { Kpis } from "@/lib/domain/kpis";

const C = { nueva: "#0b7d3e", buena: "#4fb38a", gastada: "#eda100", muy_deteriorada: "#d03b3b", sin_relevar: "#55554f" } as const;
const fmt = (n: number) => `${n >= 10 ? Math.round(n) : n.toFixed(1).replace(".", ",")}%`;

/** Tarjeta 1200×630 para compartir: un solo número protagonista. Siempre en tema oscuro "asfalto". */
export function OgCard({ kpis, scope, demo }: { kpis: Kpis; scope: string; demo: boolean }) {
  const order = ["nueva", "buena", "gastada", "muy_deteriorada", "sin_relevar"] as const;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#121211", color: "#f0efec", padding: 64, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: "#c3c2b7" }}>
        <span>Pocitos LP · {scope}</span>
        {demo && <span style={{ color: "#eda100" }}>DEMO · datos simulados</span>}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 28, marginTop: 56 }}>
        <span style={{ fontSize: 200, fontWeight: 700, lineHeight: 1 }}>{fmt(kpis.pct.muy_deteriorada)}</span>
        <span style={{ fontSize: 44, paddingBottom: 26, maxWidth: 560 }}>de las calles está muy deteriorada</span>
      </div>
      <div style={{ display: "flex", height: 28, marginTop: 48, gap: 4 }}>
        {order.filter((c) => kpis.pct[c] > 0).map((c) => (
          <div key={c} style={{ width: `${kpis.pct[c]}%`, background: C[c], borderRadius: 4 }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 40, marginTop: "auto", fontSize: 30, color: "#c3c2b7" }}>
        <span>{kpis.issues.openPozos.toLocaleString("es-AR")} pozos abiertos</span>
        <span>{kpis.issues.openParches.toLocaleString("es-AR")} parches mal hechos</span>
        <span>{fmt(kpis.pctSurveyed)} relevado</span>
      </div>
    </div>
  );
}

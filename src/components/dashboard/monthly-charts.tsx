"use client";

import { useEffect, useRef, useState } from "react";
import type { MonthPoint } from "@/lib/domain/kpis";
import { TOOLTIP } from "@/components/tooltip";
import { fmtInt, fmtPct, monthLabel } from "@/lib/format";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const H = 180;
const PAD = { l: 34, r: 12, t: 12, b: 24 };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p / (v / p > 5 ? 2 : 1)) * p * (v / p > 5 ? 2 : 1);
}

/** % de km muy deteriorados por mes. Una serie: el título la nombra, no hace falta leyenda. */
export function DeteriorationLine({ series }: { series: MonthPoint[] }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const max = niceMax(Math.max(...series.map((s) => s.pctMuyDeteriorada), 5));
  const iw = w - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (series.length === 1 ? iw / 2 : (i / (series.length - 1)) * iw);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  const d = series.map((s, i) => `${i ? "L" : "M"}${x(i)},${y(s.pctMuyDeteriorada)}`).join("");
  const last = series.length - 1;
  const ticks = [0, max / 2, max];

  return (
    <div ref={ref} className="relative w-full min-w-0">
      <svg className="block max-w-full" width={w} height={H} role="img" aria-label="Evolución del porcentaje de calles muy deterioradas por mes"
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left - PAD.l) / iw) * (series.length - 1));
          setHi(Math.max(0, Math.min(last, i)));
        }}
        onPointerLeave={() => setHi(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize={13} fill="var(--ink-3)">{Math.round(t)}%</text>
          </g>
        ))}
        {series.map((s, i) => (i % 2 === last % 2 ? (
          <text key={s.month} x={x(i)} y={H - 6} textAnchor="middle" fontSize={13} fill="var(--ink-3)">{monthLabel(s.month)}</text>
        ) : null))}
        <path d={`${d}L${x(last)},${y(0)}L${x(0)},${y(0)}Z`} fill="var(--c-muy)" opacity={0.1} />
        <path d={d} fill="none" stroke="var(--c-muy)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hi !== null && <line x1={x(hi)} x2={x(hi)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--ink-3)" strokeWidth={1} />}
        <circle cx={x(hi ?? last)} cy={y(series[hi ?? last].pctMuyDeteriorada)} r={4.5} fill="var(--c-muy)" stroke="var(--surface)" strokeWidth={2} />
        {hi === null && (
          <text x={x(last) - 8} y={y(series[last].pctMuyDeteriorada) - 10} textAnchor="end" fontSize={12} fontWeight={600} fill="var(--ink)">
            {fmtPct(series[last].pctMuyDeteriorada)}
          </text>
        )}
      </svg>
      {hi !== null && (
        <div role="status" className={`${TOOLTIP} top-0`}
          style={{ left: Math.min(Math.max(x(hi) - 70, 0), w - 150) }}>
          <p className="font-semibold">{monthLabel(series[hi].month)} {series[hi].month.slice(0, 4)}</p>
          <p className="tabular ">Muy deterioradas: <b>{fmtPct(series[hi].pctMuyDeteriorada)}</b></p>
          <p className="tabular text-asphalt-ink-2">Relevado: {fmtPct(series[hi].pctSurveyed)}</p>
        </div>
      )}
    </div>
  );
}

/** Pozos nuevos vs. arreglados por mes (columnas agrupadas, una sola escala). */
export function NewVsFixedColumns({ series }: { series: MonthPoint[] }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hi, setHi] = useState<number | null>(null);
  const max = niceMax(Math.max(...series.flatMap((s) => [s.newPozos, s.resolvedPozos]), 5));
  const iw = w - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const band = iw / series.length;
  const bw = Math.min(12, (band - 8) / 2);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  const ticks = [0, max / 2, max];
  const bar = (x0: number, v: number, fill: string) => {
    const h = Math.max(0, y(0) - y(v));
    const r = Math.min(4, h);
    return <path d={`M${x0},${y(0)}V${y(v) + r}Q${x0},${y(v)} ${x0 + r},${y(v)}H${x0 + bw - r}Q${x0 + bw},${y(v)} ${x0 + bw},${y(v) + r}V${y(0)}Z`} fill={fill} />;
  };

  return (
    <div ref={ref} className="relative w-full min-w-0">
      <ul className="mb-3 flex gap-5 text-small text-ink-2">
        <li className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-3 bg-s1" />Pozos nuevos</li>
        <li className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-3 bg-s2" />Pozos arreglados</li>
      </ul>
      <svg className="block max-w-full" width={w} height={H} role="img" aria-label="Pozos nuevos y arreglados por mes">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize={13} fill="var(--ink-3)">{fmtInt(t)}</text>
          </g>
        ))}
        {series.map((s, i) => {
          const cx = PAD.l + band * i + band / 2;
          return (
            <g key={s.month} onPointerEnter={() => setHi(i)} onPointerLeave={() => setHi(null)}>
              <rect x={cx - band / 2} y={PAD.t} width={band} height={ih} fill="transparent" />
              {hi === i && <rect x={cx - band / 2 + 2} y={PAD.t} width={band - 4} height={ih} fill="var(--surface-2)" />}
              {bar(cx - bw - 1, s.newPozos, "var(--s1)")}
              {bar(cx + 1, s.resolvedPozos, "var(--s2)")}
              {(series.length - 1 - i) % 2 === 0 && (
                <text x={cx} y={H - 6} textAnchor="middle" fontSize={13} fill="var(--ink-3)">{monthLabel(s.month)}</text>
              )}
            </g>
          );
        })}
      </svg>
      {hi !== null && (
        <div role="status" className={`${TOOLTIP} top-6`}
          style={{ left: Math.min(Math.max(PAD.l + band * hi - 50, 0), w - 150) }}>
          <p className="font-semibold">{monthLabel(series[hi].month)} {series[hi].month.slice(0, 4)}</p>
          <p className="tabular ">Nuevos: <b>{fmtInt(series[hi].newPozos)}</b></p>
          <p className="tabular ">Arreglados: <b>{fmtInt(series[hi].resolvedPozos)}</b></p>
        </div>
      )}
    </div>
  );
}

const ROW = "border-t border-line"; // taste-skill-ignore: fila de una tabla real

/** Tabla equivalente (accesibilidad: los gráficos nunca son la única vía). */
export function SeriesTable({ series }: { series: MonthPoint[] }) {
  return (
    <details className="mt-4">
      <summary className="cursor-pointer font-semibold text-ink underline">Ver como tabla</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="tabular mt-3 w-full text-left text-small">
          <thead className="text-ink-3">
            <tr><th className="py-1 pr-3 font-normal">Mes</th><th className="pr-3 font-normal">% muy deterioradas</th><th className="pr-3 font-normal">% relevado</th><th className="pr-3 font-normal">Pozos nuevos</th><th className="font-normal">Arreglados</th></tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <tr key={s.month} className={ROW}>
                <td className="py-1 pr-3">{s.month}</td><td className="pr-3">{fmtPct(s.pctMuyDeteriorada)}</td><td className="pr-3">{fmtPct(s.pctSurveyed)}</td><td className="pr-3">{fmtInt(s.newPozos)}</td><td>{fmtInt(s.resolvedPozos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

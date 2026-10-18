import type { Condition } from "./domain/types";

const int = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

export const fmtInt = (n: number) => int.format(n);
export const fmt1 = (n: number) => one.format(n);
export const fmtPct = (n: number) => `${n >= 10 ? int.format(n) : one.format(n)}%`;

/** Diferencia en puntos porcentuales con signo: "+2 pp", "−0,4 pp". */
export function fmtPp(delta: number): string {
  const abs = Math.abs(delta);
  const s = abs >= 10 ? int.format(abs) : one.format(abs);
  if (abs < 0.05) return "= sin cambios";
  return `${delta > 0 ? "+" : "−"}${s} pp`;
}

export const CONDITION_LABEL: Record<Condition, string> = {
  nueva: "Nueva",
  buena: "Buena",
  gastada: "Gastada",
  muy_deteriorada: "Muy deteriorada",
  sin_relevar: "Sin relevar",
};

export const CONDITION_HINT: Record<Condition, string> = {
  nueva: "Repavimentada hace menos de un año",
  buena: "Asfalto en buen estado",
  gastada: "Asfalto viejo, con grietas o algunos parches",
  muy_deteriorada: "Se desarma, todo parcheado, años sin arreglo",
  sin_relevar: "Nadie la calificó todavía",
};

/** Clase de fondo Tailwind por estado (tokens del tema). */
export const CONDITION_BG: Record<Condition, string> = {
  nueva: "bg-nueva",
  buena: "bg-buena",
  gastada: "bg-gastada",
  muy_deteriorada: "bg-muy",
  sin_relevar: "hatch",
};

export const CONDITION_VAR: Record<Condition, string> = {
  nueva: "--c-nueva",
  buena: "--c-buena",
  gastada: "--c-gastada",
  muy_deteriorada: "--c-muy",
  sin_relevar: "--c-sin",
};

export function relativeDays(days: number): string {
  if (days < 1) return "hoy";
  if (days === 1) return "hace 1 día";
  if (days < 60) return `hace ${days} días`;
  const months = Math.round(days / 30);
  return months < 24 ? `hace ${months} meses` : `hace ${fmt1(days / 365)} años`;
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("es-AR", { month: "short", timeZone: "UTC" }).replace(".", "");
}

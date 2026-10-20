// Fichas del mapa (globos de MapLibre). Se arman como HTML: todo texto de datos pasa por `esc`,
// sobre todo el comentario del vecino, que es texto libre.

import { CONDITION_HINT, CONDITION_LABEL, relativeDays } from "@/lib/format";
import type { Condition } from "@/lib/domain/types";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Franja de color con el estado; la clase define fondo y tinta (globals.css, `.pp-*`). */
const band = (cls: string, title: string, sub: string) =>
  `<div class="pp-band ${cls}"><p class="pp-state">${esc(title)}</p><p class="pp-sub">${esc(sub)}</p></div>`;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function segmentPopup(p: Record<string, unknown>): string {
  const cobbled = Boolean(p.cobbled);
  const condition = p.condition as Condition;
  const pozos = Number(p.openPozos) || 0;
  const parches = Number(p.openParches) || 0;
  const problems =
    pozos + parches === 0
      ? "Sin pozos ni parches reportados"
      : [pozos && plural(pozos, "pozo abierto", "pozos abiertos"), parches && plural(parches, "parche mal hecho", "parches mal hechos")]
          .filter(Boolean)
          .join(" · ");
  const head = cobbled
    ? band("pp-empedrado", "Empedrado", "Adoquines: se cuenta aparte")
    : band(`pp-${condition}`, CONDITION_LABEL[condition], CONDITION_HINT[condition]);
  return `<div class="pp">${head}<div class="pp-body">
    <p class="pp-title">${esc(p.label)}</p>
    <p class="pp-meta">${esc(problems)}</p>
    <div class="pp-actions">
      <a class="pp-btn pp-primary" href="/calificar?cuadra=${Number(p.id)}">${condition === "sin_relevar" && !cobbled ? "Calificarla" : "Calificar"}</a>
      <a class="pp-btn" href="/cuadra/${Number(p.id)}">Ver la cuadra</a>
    </div></div></div>`;
}

const SEV = ["", "Leve", "Medio", "Peligroso"];
const PARCHE: Record<string, string> = { elevado: "elevado", hundido: "hundido", desarmado: "desarmado" };

export function issuePopup(p: Record<string, unknown>): string {
  const parche = p.kind === "parche";
  const title = parche ? `Parche mal hecho${p.parcheType ? `: ${PARCHE[String(p.parcheType)] ?? ""}` : ""}` : "Pozo";
  const comment = p.comment ? `<p class="pp-quote">“${esc(p.comment)}”</p>` : "";
  return `<div class="pp">${band(parche ? "pp-parche" : "pp-pozo", title, SEV[Number(p.severity)] ?? "")}<div class="pp-body">
    <p class="pp-meta">Reportado ${esc(relativeDays(Number(p.days)))}. ${
      p.verified ? "Verificado." : "Pendiente: falta una foto o que otro vecino lo confirme."
    }</p>
    ${comment}
    <div class="pp-actions"><a class="pp-btn pp-primary" href="/cuadra/${Number(p.segmentId)}">¿Sigue ahí?</a></div>
  </div></div>`;
}

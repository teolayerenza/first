// Foto de perfil, historias de lanzamiento y tapas de destacadas. Mismo lenguaje que las placas:
// campos de color de la web, una idea por pieza, sin emojis (los íconos son dibujos simples).

/** Íconos en un cuadro de 60×60, rellenos con el color de la tinta. */
export const ICONS = {
  pozo: '<path d="M2 32 H20 C22 32 23 42 30 42 C37 42 38 32 40 32 H58 V44 H2 Z"/>',
  parche: '<path d="M2 32 H18 C22 32 23 22 30 22 C37 22 38 32 42 32 H58 V44 H2 Z"/>',
  cuadra: '<path d="M2 32 H58 V44 H2 Z M6 25 H18 V28 H6 Z M24 25 H36 V28 H24 Z M42 25 H54 V28 H42 Z"/>',
  candado: '<path d="M20 28 V20 a10 10 0 0 1 20 0 V28" fill="none" stroke="currentColor" stroke-width="6"/><rect x="12" y="28" width="36" height="26"/>',
  barras: '<rect x="8" y="34" width="12" height="20"/><rect x="24" y="22" width="12" height="32"/><rect x="40" y="8" width="12" height="46"/>',
  arreglado: '<path d="M10 32 L25 46 L50 14" fill="none" stroke="currentColor" stroke-width="8"/>',
  prensa: '<path d="M8 12 H26 V30 L16 48 H9 L16 30 H8 Z M34 12 H52 V30 L42 48 H35 L42 30 H34 Z"/>',
};

/** Cuánto bajar el cuadro para que el dibujo quede centrado (los cortes de calle están en la mitad de abajo). */
export const ICON_OFFSET = { pozo: 8, parche: 3, cuadra: 4.5 };

export const PROFILE = { field: "amarillo", icon: "pozo" };

export const STORIES = [
  { field: "asfalto", title: "Hoy arrancamos.", text: "Pocitos LP: el estado real de las calles de La Plata, medido por vecinos." },
  { field: "asfalto", big: "3.955", title: "cuadras del casco. 0 relevadas.", size: 80, text: "Las vamos a medir entre todos.", map: true },
  { field: "rojo", icon: "pozo", title: "Reportá un pozo en 15 segundos.", text: "Tocá el link." },
  { field: "verde", icon: "cuadra", title: "Calificá tu cuadra.", text: "Buena, gastada o muy deteriorada. Tarda 10 segundos. Tocá el link." },
  { field: "asfalto", icon: "candado", title: "100% anónimo.", text: "Sin cuentas, sin publicidad, sin rastreadores." },
  { field: "amarillo", title: "Compartilo con tu barrio.", text: "Cuantos más vecinos se suman, más preciso es el mapa." },
];

/** Tapas de las historias destacadas (DIFUSION.md §3). */
export const HIGHLIGHTS = [
  { slug: "1-como-reportar", name: "Cómo reportar", field: "rojo", icon: "pozo" },
  { slug: "2-calificar", name: "Calificar", field: "verde", icon: "cuadra" },
  { slug: "3-anonimato", name: "Anonimato", field: "asfalto", icon: "candado" },
  { slug: "4-informes", name: "Informes", field: "amarillo", icon: "barras" },
  { slug: "5-arreglados", name: "Arreglados", field: "hormigon", icon: "arreglado" },
  { slug: "6-prensa", name: "Prensa", field: "asfalto", icon: "prensa" },
];

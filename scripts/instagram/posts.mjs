// Contenido de los 6 posteos fundacionales (docs/DIFUSION.md §3). Una idea por placa, sin emojis
// (docs/DISENO.md) y sin números del modo demo: solo datos reales y cómo funciona la app.

const LEGEND = [
  ["#0b7d3e", "Nueva", "Repavimentada en los últimos 12 meses"],
  ["#4fb38a", "Buena", "Asfalto en buen estado"],
  ["#eda100", "Gastada", "Asfalto viejo, con grietas o algunos parches"],
  ["#d03b3b", "Muy deteriorada", "Se desarma, todo parcheado"],
  ["repeating-linear-gradient(45deg,#cfcdc6 0 8px,#a9a79f 8px 16px)", "Sin relevar", "Todavía nadie la calificó"],
  ["#2a78d6", "Empedrado", "Se cuenta aparte"],
];

export const POSTS = [
  {
    slug: "1-que-es",
    slides: [
      { field: "asfalto", title: "¿Cuántas calles de La Plata están rotas?", size: 128, foot: "Deslizá" },
      { field: "asfalto", title: "Nadie lo sabe.", text: "No hay un registro público. Los reclamos se pierden y la calle sigue igual." },
      { field: "asfalto", title: "Lo vamos a medir entre todos.", text: "Cada vecino que pasa por una cuadra la puede calificar. Cada pozo y cada parche mal hecho, en un mapa abierto." },
      { field: "asfalto", big: "3.955", title: "cuadras del casco. 0 relevadas.", size: 64, text: "Empezamos hoy.", map: true },
      { field: "amarillo", title: "Pocitos LP", size: 150, text: "El estado real de las calles de La Plata, medido por vecinos. Anónimo, sin cuentas y con datos abiertos. <b>Link en la bio.</b>" },
    ],
    caption: `¿Cuántas calles de La Plata están rotas? Nadie lo sabe: no hay un registro público.

Por eso armamos Pocitos LP: un mapa abierto del casco urbano donde cualquier vecino puede reportar un pozo, un parche mal hecho o calificar cómo está su cuadra.

Son 3.955 cuadras. Hoy no hay ninguna relevada. Empezamos ahora, entre todos.

Anónimo, sin cuentas, sin publicidad. Link en la bio.

#LaPlata #CallesDeLaPlata #CascoUrbano #Pozos`,
  },
  {
    slug: "2-reportar",
    slides: [
      { field: "rojo", title: "Reportar un pozo tarda 15 segundos.", size: 128, foot: "Deslizá" },
      { field: "rojo", title: "Marcá dónde está.", size: 80, text: "Mové el mapa hasta el pozo o tocá «Usar mi ubicación».", shot: "donde" },
      { field: "rojo", title: "Elegí qué tan grave es.", size: 80, shot: "gravedad" },
      { field: "rojo", title: "Sumá una foto si podés.", text: "Se achica y se limpia en tu celular antes de subirse: sin ubicación, sin fecha, sin modelo de teléfono." },
      { field: "amarillo", title: "¿Un parche que quedó como lomo de burro?", size: 80, text: "Elevado, hundido o desarmado: también se reporta.", shot: "parche" },
      { field: "rojo", title: "Si otro vecino lo confirma, cuenta.", text: "Un reporte entra al mapa cuando tiene foto o cuando alguien más dice que sigue ahí. Así nadie infla los números." },
    ],
    caption: `Reportar un pozo tarda 15 segundos:

1. Marcás dónde está en el mapa (o tocás «Usar mi ubicación»).
2. Elegís si es leve, medio o peligroso.
3. Si podés, sacás una foto.

Los parches mal hechos (elevados, hundidos o desarmados) también se reportan.

Lo puede reportar cualquiera que pase. Si otro vecino lo confirma, cuenta.

Link en la bio.

#LaPlata #Pozos #Bacheo #CallesDeLaPlata`,
  },
  {
    slug: "3-calificar",
    slides: [
      { field: "verde", title: "Un pozo no es lo mismo que una cuadra rota.", size: 112, foot: "Deslizá" },
      { field: "verde", title: "Calificá tu cuadra.", text: "Un pozo es una rotura puntual. Calificar tu cuadra es decir cómo está el asfalto <b>en general</b>." },
      { field: "verde", title: "Buena, gastada o muy deteriorada.", size: 80, shot: "estado" },
      { field: "verde", title: "¿La repavimentaron? Avisanos.", text: "Una cuadra repavimentada en los últimos 12 meses cuenta como nueva. También lo vamos a mostrar." },
    ],
    caption: `Un pozo es una rotura puntual. El estado de tu cuadra es otra cosa: cómo está el asfalto en general.

Por eso en Pocitos LP se miden por separado. Calificar tu cuadra tarda 10 segundos: buena, gastada o muy deteriorada.

¿La repavimentaron? Avisanos: también cuenta.

Link en la bio.

#LaPlata #CallesDeLaPlata #Asfalto`,
  },
  {
    slug: "4-tablero",
    slides: [
      { field: "hormigon", title: "Cómo leer el tablero.", size: 128, foot: "Deslizá" },
      { field: "hormigon", title: "Cada color, un estado.", size: 80, legend: LEGEND },
      { field: "hormigon", title: "En kilómetros y en cuadras.", text: "Una avenida de 140 m no pesa lo mismo que un tramo de 60 m. Por eso cada porcentaje sale en km de asfalto y, al lado, en cuadras." },
      { field: "hormigon", title: "36 zonas entre avenidas.", text: "«7–13 / 44–51» es la zona entre 7, 13, 44 y 51. Así se compara barrio por barrio." },
      { field: "hormigon", title: "Cuantos más vecinos, más preciso.", text: "Una zona entra al ranking recién cuando tiene al menos el 20% relevado. Cada número dice cuánto falta relevar." },
    ],
    caption: `Cómo leer el tablero de Pocitos LP:

- Cada color es un estado: nueva, buena, gastada, muy deteriorada o sin relevar. El empedrado se cuenta aparte.
- Todo se mide en kilómetros de asfalto y en cuadras.
- El casco se divide en 36 zonas entre avenidas.
- Una zona entra al ranking cuando tiene al menos el 20% relevado.

Cuantos más vecinos se suman, más preciso es el mapa. Link en la bio.

#LaPlata #DatosAbiertos #CallesDeLaPlata`,
  },
  {
    slug: "5-anonimato",
    slides: [
      { field: "asfalto", title: "No te pedimos nada.", size: 128, text: "Ni nombre, ni mail, ni teléfono, ni que crees una cuenta.", foot: "Deslizá" },
      { field: "asfalto", title: "Guardamos dónde está el pozo. Nunca dónde estás vos.", size: 96, text: "Tampoco guardamos tu IP." },
      { field: "asfalto", title: "Tus fotos se limpian antes de subirse.", size: 96, text: "Sin ubicación, sin fecha, sin modelo de teléfono." },
      { field: "asfalto", title: "Sin publicidad, sin rastreadores, sin venta de datos.", size: 96, text: "Si alguien entrara a la base, se llevaría lo mismo que ya ves en el mapa. <b>No hay datos personales para robar.</b>" },
    ],
    caption: `Tu anonimato, en Pocitos LP:

- No te pedimos nombre, ni mail, ni teléfono, ni cuenta.
- Guardamos dónde está el pozo, nunca dónde estás vos. Tampoco tu IP.
- Las fotos se limpian en tu celular antes de subirse: sin ubicación, sin fecha, sin modelo de teléfono.
- Sin publicidad, sin rastreadores, sin venta de datos.

En la web podés ver campo por campo qué se guarda. Link en la bio.

#LaPlata #Privacidad`,
  },
  {
    slug: "6-para-que",
    slides: [
      { field: "amarillo", title: "¿Para qué sirve todo esto?", size: 128, foot: "Deslizá" },
      { field: "amarillo", title: "Datos abiertos.", text: "Cualquiera puede descargar el mapa y los números: vecinos, periodistas, concejales." },
      { field: "amarillo", title: "Un informe por mes.", text: "Con el estado de las calles y cómo cambió. Lo vamos a mandar al municipio, al Concejo Deliberante y a los medios." },
      { field: "amarillo", title: "Si arreglan un pozo, también lo mostramos.", size: 96, text: "La pregunta es una sola: ¿se arregla o no?" },
      { field: "verde", title: "Sumá tu cuadra.", size: 150, text: "Es anónimo y tarda menos de un minuto. <b>Link en la bio.</b> Compartilo con tu barrio." },
    ],
    caption: `¿Para qué sirve Pocitos LP?

- Los datos son abiertos: cualquiera los puede descargar.
- Cada mes vamos a publicar un informe con el estado de las calles y cómo cambió, y lo vamos a mandar al municipio, al Concejo Deliberante y a los medios.
- Si arreglan un pozo, también lo vamos a mostrar.

Cuantos más vecinos se sumen, más fuerte es el dato. Sumá tu cuadra y compartilo con tu barrio. Link en la bio.

#LaPlata #CallesDeLaPlata #DatosAbiertos`,
  },
];

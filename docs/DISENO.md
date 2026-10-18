# Pocitos LP — Dirección de diseño

Para que no tenga "cara de IA", el diseño sigue la skill [Taste Skill](https://github.com/Leonxlnx/taste-skill)
(reglas de la casa + dirección sorteada + inspección en navegador real).

## La dirección: "capítulos de color"

Dirección sorteada por `draw.mjs`: **Colour chapters**. Cada sección es un campo plano a todo el ancho, y su color
*es* el dato del capítulo.

> **La idea:** en esta página, **los colores que los vecinos le ponen a cada cuadra** (verde, amarillo, rojo, azul,
> que fue la consigna original del proyecto) **se convierten en los capítulos del tablero**.

| Capítulo | Campo | Por qué |
|---|---|---|
| Hero | Asfalto `#141414` | La calle. El casco en 3D (Three.js) es la "foto" principal. |
| Estado del asfalto | Hormigón `#ebe9e4` | El capítulo tranquilo: el número grande y la barra. |
| Pozos y parches | Rojo `#c8342f` | "Muy deteriorada". Corte dibujado de una calle con un pozo y un parche. |
| Mapa | Asfalto | El mapa es la interfaz real. |
| Zonas | Amarillo pintura vial `#f2c200` | El ranking, como franjas pintadas. |
| Mes a mes | Hormigón claro | Gráficos. |
| Sumá tu cuadra | Verde `#0b6e3a` | "Nueva": el capítulo de la acción, con el primer paso del formulario ya abierto. |
| Tu anonimato | Asfalto | Texto grande con lo importante resaltado. |
| Pie | Baldosas de asfalto + amarillo | El nombre vuelve a todo el ancho. |

**Lo único "vivo":** en el hero, *"¿Cómo está tu cuadra?"*: elegís "Calle __ entre __ y __" y la respuesta aparece
pintada del color del estado de esa cuadra.

## Reglas que se aplican (y que chequea `lint.mjs`)

- Una sola familia tipográfica (Hanken Grotesk, autoalojada). La dirección sorteó **Switzer** (Fontshare); se puede
  cambiar en `src/app/layout.tsx` + `globals.css` si se descarga.
- Esquinas rectas en todo. Botones planos de un color.
- Sin emojis (reemplazados por dibujos del tema: cortes de calle en `src/components/forms/glyphs.tsx`).
- Sin etiquetas chiquitas en mayúsculas sobre los títulos, sin monoespaciada, sin numeración 01/02/03.
- Sin líneas finas, salvo en tablas reales y campos de formulario.
- Sin sombras en reposo (solo los globos flotantes), sin degradés (salvo el rayado de "sin relevar",
  que es textura de accesibilidad), sin blur.
- Superficies separadas por un escalón de tono, nunca por un borde.

## Excepciones defendidas (lo que el inspector todavía marca)

- **Pocas fotos reales.** El entorno donde se hizo no tenía acceso a archivos abiertos (Wikimedia, etc.).
  **Tarea antes de lanzar:** sacar fotos propias de pozos y parches reales de La Plata (4 a 8, mismo tratamiento)
  y sumarlas al capítulo rojo y al hero en celular. Es lo que más va a mejorar la página.
- **Texto de anonimato largo:** sigue el plano "dos columnas con palabras resaltadas" (110–160 palabras).
- **"2026-10" sobre "Sumá tu cuadra":** es la última fila de la tabla plegada de datos (falso positivo).
- **Muchos tamaños de letra:** el tablero tiene más cifras que una landing; se puede seguir reduciendo.

## Cómo volver a chequear

```bash
git clone --depth 1 https://github.com/Leonxlnx/taste-skill /tmp/taste-skill
node /tmp/taste-skill/skills/taste-skill/scripts/lint.mjs src
npm run dev   # y en otra terminal:
node /tmp/taste-skill/skills/taste-skill/scripts/inspect.mjs http://localhost:3000/
```

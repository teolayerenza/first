# Plan: de pozo a parche (semana del 26 al 30 de octubre de 2026)

Cada pozo que se arregla se convierte en un parche, y ese punto se sigue en el tiempo: cuánto tardaron en
arreglarlo, si quedó bien, cuánto duró y si volvió a romperse. Leer antes `docs/PLAN.md` y `CLAUDE.md`.

## Lo que ya existe

- En un pozo, "Ya lo arreglaron" pregunta **"¿Quedó bien o quedó un parche mal hecho?"**.
- Con 2 votos "arreglado" de dispositivos distintos (`resolveVotes`), el pozo pasa a **resuelto**.
- Si ganó "parche mal hecho", `recompute_issue` crea un parche en el mismo punto, unido por `origin_issue_id`.
- KPI de tiempo de arreglo y de calidad del arreglo ("1 de cada X arreglos queda mal").

## Problemas de hoy

1. **El tipo de parche está fijo**: todo parche que nace de un pozo se guarda como `elevado`, gravedad 2
   (`recompute_issue`). Nunca se pregunta si quedó elevado, hundido o desarmado.
2. **El arreglo bien hecho desaparece**: el pozo se cierra y el punto deja de existir. Un bacheo bien hecho
   sigue siendo un parche, y lo que importa es cuánto dura.
3. **No se detecta el ciclo**: si en el mismo punto vuelve a abrirse un pozo, entra como nuevo, sin relación
   con el anterior. Se pierde "este punto lo arreglaron 3 veces este año".

## Modelo: el punto y su historia

```
pozo (abierto) → arreglado → parche (bien | elevado | hundido | desarmado) → se rompe → pozo otra vez …
```

- Cada etapa es un `issue`, unida a la anterior por `origin_issue_id` (ya existe; no hace falta tabla nueva).
- **Parche bien hecho = parche en seguimiento**: no es un problema abierto (no suma a pozos ni a parches mal
  hechos), pero queda registrado para medir cuánto dura.
- **Un reporte nuevo cerca de algo arreglado se une a la cadena**: si alguien reporta un pozo o un parche a
  ≤ 8 m (`dedupeRadiusM`) de un pozo resuelto o de un parche bien hecho, se une a esa historia.

## Qué cambia

**Formulario "Ya lo arreglaron"**
- Si eligen "parche mal hecho", se pregunta **cuál**: elevado, hundido o desarmado (mismos dibujos que al reportar).
- Foto opcional del arreglo: con la del pozo da el **antes y después** (destacada "Arreglados" de Instagram).

**En un parche bien hecho**: "¿Sigue bien?" → "Sigue bien" / "Se rompió" (y cómo). "Se rompió" abre la etapa siguiente.

**Página del pozo (`/pozo/[id]`)**: línea de tiempo del punto
("Reportado 3/9 · Arreglado 20/10 (en 47 días) · Parche hundido 5/11 · …").

**Mapa**: pozo violeta y parche mal hecho en tinta (como hoy); parche bien hecho como un punto chico y apagado;
si el punto se arregló 2 veces o más, el número aparece en la ficha.

**KPI nuevos** (cada uno con su definición en `/metodologia`)

| KPI | Qué mide |
|---|---|
| Durabilidad del arreglo | Días desde el arreglo hasta que se rompe (mediana; los que siguen bien cuentan como "al menos X días") |
| Reincidencia | % de puntos que vuelven a ser pozo en 6 meses |
| Puntos crónicos | Ranking de lugares arreglados 3 veces o más |
| Calidad del arreglo | El que ya existe, ahora con el tipo de falla (elevado / hundido / desarmado) |

## A tener en cuenta

1. **Las dos mediciones no se mezclan** (`CLAUDE.md`): arreglar pozos no cambia el estado del asfalto de la
   cuadra. Como mucho, sugerir "¿querés recalificar la cuadra?".
2. **Fraude**: es el dato que un actor interesado querría inflar. Hoy: 2 votos de dispositivos distintos, quien
   reportó no puede votar su propio pozo, límite diario. Sumar: que "se arregló" exija al menos una sesión de más
   de 24 h, y que un pico de "arreglados" en una zona vaya a revisión, como las calificaciones.
3. **Varios pozos, un solo bacheo**: si 2 o más pozos cercanos se marcan arreglados el mismo día, se unen en un solo
   parche, para no inflar la cantidad de parches.
4. **Repavimentación**: si una cuadra pasa a "nueva", sus pozos y parches abiertos probablemente desaparecieron.
   No cerrarlos solos: pedir a los vecinos que lo confirmen.
5. **Datos existentes**: los parches creados hasta ahora quedaron como `elevado` sin que nadie lo eligiera.
   Marcarlos como "tipo sin dato", no inventarlo.
6. **Privacidad**: nada nuevo. Votos anónimos, HMAC, sin ubicación del dispositivo. La foto del arreglo pasa por
   el mismo control que la del pozo: no se publica hasta que otra persona lo confirma.
7. **La regla escrita dos veces**: todo cambio va en `src/lib/domain/issues.ts` y en `recompute_issue` (SQL), y
   `tests/sql-parity.test.ts` tiene que cubrir las cadenas. Cambios del payload → redeploy de la Edge Function `submit`.

## Calendario

| Día | Fase | Qué | Tamaño |
|---|---|---|---|
| Lun 26 | 1 | Elegir el tipo de parche al marcar "arreglado"; sacar el `elevado` fijo; viejos → "sin dato" | Chico (1 migración + formulario + Edge Function) |
| Mar 27 – Mié 28 | 2 | Parche bien hecho como etapa en seguimiento; votos "Sigue bien / Se rompió"; línea de tiempo en `/pozo` | Mediano |
| Jue 29 | 3 | Unir reportes nuevos a la cadena; reincidencia; puntos crónicos | Mediano |
| Vie 30 | 4 y 5 | Foto del arreglo (antes/después); bacheo de varios pozos en uno; aviso al repavimentar; KPI en el tablero y `/metodologia` | Mediano |

## Decisiones pendientes (antes del lunes)

- [ ] ¿El parche bien hecho se muestra en el mapa (tenue) o solo en la página del punto?
- [ ] ¿"Se arregló" exige una sesión de más de 24 h, aunque confirmar sea un poco más lento?

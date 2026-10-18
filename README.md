# Pocitos LP

Tablero público, anónimo y en tiempo real del estado de las calles del **casco urbano de La Plata**:
estado del asfalto por cuadra, pozos y parches mal hechos, medidos por los vecinos.

- Indicadores primero: % de calles muy deterioradas, nuevas, sin relevar; pozos abiertos, tiempo y calidad de arreglo.
- Mapa con las **3.187 cuadras reales** del casco (OpenStreetMap) y vista **3D** (Three.js). Modo claro y oscuro.
- Pensado para el celular (Safari y Chrome): barra fija con *Reportar pozo*, *Reportar parche* y *Calificar mi cuadra*.
- 100% anónimo y con datos mínimos. Ver [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md).
- Datos abiertos (GeoJSON/CSV, ODbL).

## Arrancar en 1 minuto (modo demo)

```bash
npm install
npm run dev        # http://localhost:3000
```

Sin variables de entorno la app corre en **modo demo**: datos simulados (determinísticos) para diseñar el tablero.
Los aportes que hagas se guardan en memoria y se pierden al reiniciar.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Tests: lógica, paridad TypeScript↔SQL, flujo de escritura y permisos (Postgres+PostGIS en memoria) |
| `npm run typecheck` / `npm run lint` | Chequeos |
| `npm run data:osm` | Descarga las calles reales del casco desde OpenStreetMap |
| `npm run data:grid` | Genera `data/*.geojson` y `supabase/seed.sql` |

## Documentación

- [`docs/SETUP.md`](docs/SETUP.md): **paso a paso para pasar a producción** (Supabase, OSM, Vercel, Cloudflare)
- [`docs/PLAN.md`](docs/PLAN.md): producto, decisiones y modelo de datos
- [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md): anti-abuso y privacidad
- [`docs/DIFUSION.md`](docs/DIFUSION.md): estrategia de lanzamiento y prensa

## Estructura

```
src/lib/domain/     reglas de negocio puras (estado, pozos, KPIs, pipeline de escritura), compartidas con la Edge Function
src/lib/data/       fuentes de datos: demo (memoria) y Supabase (vistas públicas)
src/lib/client/     navegador: envío, fotos, cola sin señal, captcha
src/components/     tablero, mapa, 3D, formularios
supabase/           migraciones SQL (espejo de src/lib/domain), Edge Function `submit`
scripts/            importación de OpenStreetMap y seed
tests/              vitest + PGlite/PostGIS
```

Calles © [colaboradores de OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL).

# Positos LP

Tablero público en tiempo real del estado de las calles del casco urbano de La Plata.
Prioridad: KPIs claros (% de calles rotas/nuevas/bien/regular/sin relevar por km y por cuadras, pozos abiertos,
tiempo de arreglo) arriba y mapa debajo. Zonas = cuadrantes entre avenidas. El empedrado es una categoría aparte.

- Plan completo y decisiones: `docs/PLAN.md` (leerlo antes de empezar cualquier tarea).
- Stack: Next.js (App Router) + TypeScript + Tailwind, MapLibre GL, Supabase (Postgres + PostGIS, Auth anónima, Storage, Realtime, pg_cron).
- Solo cuentan en los KPIs los aportes verificados (con foto, confirmados por otro dispositivo o de un usuario con cuenta).
- Idioma: UI y docs en español rioplatense; código e identificadores en inglés.
- Alcance geográfico: solo dentro de `data/casco_urbano.geojson`. Validar en cliente y en base.
- Datos de calles: OpenStreetMap (ODbL) — mantener la atribución visible. No usar datos de Google Maps.
- Lógica geoespacial y de puntaje en SQL (migraciones en `supabase/migrations/`), no en el cliente.

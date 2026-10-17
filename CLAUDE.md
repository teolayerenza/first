# Positos LP

Mapa colaborativo en tiempo real del estado de las calles del casco urbano de La Plata
(reportes de pozos → puntaje por cuadra y por zona H3 → colores verde/amarillo/rojo, azul = empedrado).

- Plan completo y decisiones: `docs/PLAN.md` (leerlo antes de empezar cualquier tarea).
- Stack: Next.js (App Router) + TypeScript + Tailwind, MapLibre GL, Supabase (Postgres + PostGIS, Auth, Storage, Realtime), H3.
- Idioma: UI y docs en español rioplatense; código e identificadores en inglés.
- Alcance geográfico: solo dentro de `data/casco_urbano.geojson`. Validar en cliente y en base.
- Datos de calles: OpenStreetMap (ODbL) — mantener la atribución visible. No usar datos de Google Maps.
- Lógica geoespacial y de puntaje en SQL (migraciones en `supabase/migrations/`), no en el cliente.

# Positos LP

Tablero público en tiempo real del estado de las calles del casco urbano de La Plata (solo el casco: Av. 31, 32, 72 y 122).
Prioridad: KPIs claros arriba (por km y por cuadras) y mapa debajo. Zonas = cuadrantes entre avenidas, deducidos de la ubicación.

- Plan completo y decisiones: `docs/PLAN.md` (leerlo antes de empezar cualquier tarea).
- **Dos mediciones separadas, que nunca se mezclan**: estado del asfalto por cuadra (calificación: buena / gastada /
  muy deteriorada; nueva = repavimentada ≤ 12 meses) y pozos puntuales (los reporta cualquiera que pase).
- **Privacidad / bien común**: 100% anónimo, sin cuentas. Nunca guardar datos personales, IP ni la ubicación del dispositivo.
  Votos y reportes se identifican solo por HMAC(secreto, dispositivo || objeto). Sin analytics de terceros ni publicidad.
- Stack: Next.js (App Router) + TypeScript + Tailwind, MapLibre GL, Supabase (Postgres + PostGIS, sesión anónima,
  Storage, Realtime, pg_cron, pgcrypto).
- El cliente escribe solo vía RPC (funciones SQL); la lógica de estados y KPIs vive en SQL (`supabase/migrations/`).
- Solo cuentan en los KPIs los aportes verificados.
- Idioma: UI y docs en español rioplatense; código e identificadores en inglés.
- Datos de calles: OpenStreetMap (ODbL), con atribución visible. No usar datos de Google Maps.
- Licencias: código AGPL-3.0, datos ODbL.

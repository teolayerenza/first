# Pocitos LP

Tablero público en tiempo real del estado de las calles del casco urbano de La Plata (solo el casco: Av. 31, 32, 72 y 122).
Prioridad: KPIs claros arriba (por km y por cuadras) y mapa debajo. Zonas = cuadrantes entre avenidas, deducidos de la ubicación.

- Plan completo y decisiones: `docs/PLAN.md` (leerlo antes de empezar cualquier tarea).
- **Dos mediciones separadas, que nunca se mezclan**: estado del asfalto por cuadra (calificación: buena / gastada /
  muy deteriorada; nueva = repavimentada ≤ 12 meses) y problemas puntuales
  (`issues`: pozos y parches mal hechos —elevado/hundido/desarmado—, los reporta cualquiera que pase). Al marcar un pozo
  "arreglado" se pregunta si quedó bien o quedó un parche malo (KPI de calidad del arreglo). Parcheo de la cuadra = dato opcional aparte.
- **Privacidad / bien común**: 100% anónimo, sin cuentas. Nunca guardar datos personales, IP ni la ubicación del dispositivo.
  Votos y reportes se identifican solo por HMAC(secreto, dispositivo || objeto). Sin analytics de terceros ni publicidad.
- Stack: Next.js (App Router) + TypeScript + Tailwind, MapLibre GL, Supabase (Postgres + PostGIS, sesión anónima,
  Storage, Realtime, pg_cron, pgcrypto).
- Seguridad: leer `docs/SEGURIDAD.md`. Toda escritura pasa por la Edge Function `submit` (Turnstile, Zod, rate limit, HMAC);
  `anon` no puede escribir ni ejecutar las RPC de escritura y solo lee vistas públicas sin hashes. RLS en todas las tablas.
  El secreto HMAC nunca va en la base, el cliente ni el repo.
- La lógica de estados y KPIs vive en SQL (`supabase/migrations/`).
- Solo cuentan en los KPIs los aportes verificados.
- Idioma: UI y docs en español rioplatense; código e identificadores en inglés.
- Datos de calles: OpenStreetMap (ODbL), con atribución visible. No usar datos de Google Maps.
- Licencias: datos ODbL. Código: privado durante el desarrollo, con la propuesta de abrirlo (AGPL-3.0) al lanzar.

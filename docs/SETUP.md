# Pocitos LP — De la demo a producción

## 0. Probar la demo

```bash
npm install && npm run dev
```

Abrí http://localhost:3000. Todo funciona con datos simulados: tablero, mapa, 3D, formularios, páginas de zona y de cuadra.

## 1. Calles reales del casco (OpenStreetMap)

**Ya están en el repo:** `data/cuadras.json` (3.187 cuadras reales con su nombre "Calle X e/ Y y Z"),
`data/casco_urbano.geojson` y `data/zonas.geojson`. Salen de OpenStreetMap (Overpass, octubre de 2026):
`npm run data:osm` baja `data/osm-raw.json` y `npx tsx scripts/build-real-data.ts data/osm-raw.json` arma las cuadras,
conservando el id de las que ya existían. El casco y las zonas se calculan cruzando las rectas
de las avenidas reales (31, 32, 72, 122 y las avenidas cada 6 cuadras).

Para actualizarlas con OSM de hoy (desde tu compu, con internet):

1. `npm run data:osm` → descarga las calles actuales desde Overpass (`data/osm-segments.geojson`).
2. Revisá el resultado en [geojson.io](https://geojson.io), sobre todo plazas y diagonales.
3. `npm run data:grid` → regenera `supabase/seed.sql`.

Detalles conocidos: las cuadras que dan a una plaza a veces se llaman "Calle 7 e/ Plaza Rocha y 61", porque en OSM
la calle de la plaza lleva el nombre de la plaza. El empedrado no viene en ese extracto: lo marcan los vecinos
(o el import nuevo de Overpass, que sí trae `surface`).

## 2. Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com) (región São Paulo).
2. Instalá la CLI y vinculalo:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push            # aplica supabase/migrations
   npx supabase db execute -f supabase/seed.sql   # o pegalo en el SQL Editor
   ```
3. **Auth** → Providers: activá **Anonymous sign-ins**. Desactivá email, teléfono y OAuth.
4. **Auth** → Attack Protection: activá **Captcha** con Turnstile y la clave secreta.
5. **Edge Function**:
   ```bash
   npx supabase secrets set HMAC_SECRET="$(openssl rand -hex 32)" TURNSTILE_SECRET=... ALLOWED_ORIGIN=https://pocitoslp.com.ar
   npx supabase functions deploy submit
   ```
   ⚠️ Guardá `HMAC_SECRET` en un gestor de contraseñas. Si se pierde, los votos viejos no se pueden deduplicar con los nuevos. Si se filtra, rotalo.
   ⚠️ La función importa `src/lib/domain/*` (compartido con la app). Si el deploy se queja de esos imports, copiá `src/lib/domain` a `supabase/functions/_shared/domain` y cambiá las rutas.
6. **Database → Extensions**: confirmá `pg_cron` y `postgis`.
7. Corré el **Security Advisor**. Va a marcar las vistas `v_*` como "security definer views": es intencional (exponen solo columnas públicas, sin hashes). Todo lo demás tiene que quedar en verde.
8. Revisá en **Settings → Logs** la retención de logs de auth (pueden incluir IP) y dejala en el mínimo.

## 3. Cloudflare Turnstile

Creá un sitio en Cloudflare → Turnstile (modo **Invisible / Managed**). La *site key* va en `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y la *secret* en Supabase (paso 2.4 y 2.5).

## 4. Deploy (Vercel)

1. Importá el repo en Vercel.
2. Variables: copiá las de `.env.example` (solo las `NEXT_PUBLIC_*`).
3. Dominio (`pocitoslp.com.ar` vía NIC Argentina), con Cloudflare como DNS/proxy y una regla de **rate limiting** para `/functions/v1/submit` (ej. 30 pedidos / 10 min por IP).
4. Configurá **límites de gasto** en Vercel, Supabase y Cloudflare.

## 5. Antes de lanzar (docs/SEGURIDAD.md §8)

- [ ] 2FA en GitHub, Supabase, Vercel y Cloudflare. Branch protection en `main`.
- [ ] `npm test` en verde.
- [ ] Prueba de ataque propia contra staging: inundar, autoconfirmarse, llamar a las RPC con la clave anónima (deben dar `permission denied`).
- [ ] Relevar el 15–20 % del casco con voluntarios (ver `docs/DIFUSION.md`).

## Moderación (por ahora, desde el SQL Editor)

```sql
-- Ocultar todo lo de la zona 20 entre dos horarios (queda en la bitácora pública)
select moderate_zone(20, '2026-11-12 14:00-03', '2026-11-12 15:00-03', 'oculto', 'Actividad automatizada');
-- Revisar lo retenido por el detector y liberarlo
select count(*) from segment_ratings where state = 'en_revision';
update segment_ratings set state = 'pendiente' where state = 'en_revision';  -- vuelve a pasar por el detector
```

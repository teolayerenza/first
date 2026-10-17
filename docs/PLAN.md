# Positos LP — Plan de proyecto

> Mapa colaborativo y en tiempo real del estado de las calles del **casco urbano de La Plata**.
> La gente reporta pozos, el sistema los asigna a la cuadra correspondiente y pinta cada cuadra
> y cada zona según su estado.

---

## 1. El problema

- En La Plata la obra pública es muy visible en plazas y avenidas, pero las **calles secundarias**
  acumulan pozos sin que exista un registro público y comparable de su estado.
- Hoy un reclamo individual (147, redes) se pierde: no hay **historial**, ni **mapa**, ni forma de
  decir "esta zona está peor que aquella".
- Objetivo: transformar quejas sueltas en **datos abiertos, geolocalizados y agregados**, que
  cualquiera pueda ver y compartir.

### Alcance geográfico
Solo el **casco urbano**: el cuadrado delimitado por la Av. de Circunvalación
(Av. 31, Av. 32, Av. 72 y Av. 122). El polígono exacto se arma en la Fase 0 y vive en
`data/casco_urbano.geojson`. Todo reporte fuera del polígono se rechaza (en el cliente **y** en la base).

---

## 2. Qué se muestra (leyenda de colores)

| Color | Significado | Cómo se calcula |
|---|---|---|
| 🟢 Verde | Buen estado o recién repavimentada | Puntaje bajo, o reporte "repavimentada" confirmado en los últimos N meses |
| 🟡 Amarillo | Estado regular | Puntaje medio (pocos pozos o pozos leves) |
| 🔴 Rojo | Mal estado | Puntaje alto (muchos pozos, graves o sin resolver hace tiempo) |
| 🔵 Azul | Empedrado / adoquinado | Atributo de superficie de la cuadra (no es un puntaje) |
| ⚪ Gris | Sin datos | Cuadra sin ningún reporte ni información |

**Decisión de diseño:** el azul es una *capa de superficie*, no un estado. Una cuadra empedrada
también puede tener pozos. Propuesta: la línea se dibuja azul y los pozos encima como marcadores;
con un toggle "ver estado" se pinta con verde/amarillo/rojo igual que el resto.

Dos niveles de visualización:
1. **Cuadra** (zoom alto): cada tramo entre dos esquinas se colorea.
2. **Zona** (zoom bajo): hexágonos [H3](https://h3geo.org/) (resolución 9, ~0,1 km²) coloreados
   por densidad de pozos por km de calle. Así "si una zona tiene muchos pozos, se califica como mala".

---

## 3. ¿Se puede sacar la info de Google Maps / 3D Maps?

**No, y no conviene intentarlo.**
- Google Maps no expone el estado del pavimento ni pozos; no existe esa capa.
- Los Términos de Servicio de Google Maps Platform **prohíben** extraer/scrapear contenido
  (incluido Street View) para crear bases de datos derivadas.

**Fuentes que sí podemos usar:**

| Fuente | Qué aporta | Licencia |
|---|---|---|
| **OpenStreetMap** (vía Overpass API) | Geometría de todas las calles del casco + tag `surface` (`sett`, `cobblestone`, `paving_stones` = empedrado/adoquín; `asphalt`) | ODbL (atribución obligatoria) |
| **Reportes ciudadanos** (nuestra app) | Pozos, fotos, gravedad, "ya lo arreglaron" | Propia, publicable como datos abiertos |
| **Mapillary** (futuro) | Imágenes a nivel calle con licencia abierta → posible detección automática de pozos con visión computacional | CC BY-SA |
| **Municipalidad / Ordenanza 75934/24** (futuro) | Relevamiento oficial de calles patrimoniales empedradas | A pedir / acceso a la información pública |

⚠️ La cobertura del tag `surface` en OSM es incompleta. Plan: usarlo como semilla y permitir que
los usuarios marquen "esta cuadra es empedrada" (y, como bonus, devolver esas correcciones a OSM).

---

## 4. Inspiración: el "dashboard de municipios" viral

La idea a tomar de ese tipo de proyectos (transparencia de datos públicos que se viraliza):
- **Datos primero, opinión después**: números claros, fuente visible, fecha de actualización.
- **Rankings compartibles**: "Top 10 cuadras con más pozos", "Barrios peor/mejor calificados",
  "Pozos más viejos sin arreglar" (con contador de días 🕐).
- **Tarjetas para compartir en X/WhatsApp** (imagen OG generada por cuadra/zona).
- **Datos abiertos descargables**: GeoJSON / CSV con todos los reportes.
- **Diseño sobrio y rápido**, mobile-first.

> TODO: pasar el link exacto de la app de referencia para revisar su UI y stack.

---

## 5. Arquitectura propuesta

```
 ┌──────────────── Cliente (PWA, Next.js) ────────────────┐
 │  MapLibre GL  ← tiles base (OpenFreeMap / Protomaps)   │
 │  Capa cuadras (GeoJSON/vector) + capa hexágonos H3     │
 │  Form reporte: GPS + foto + gravedad                   │
 └───────────────┬───────────────────────▲────────────────┘
                 │ REST/RPC              │ Realtime (websocket)
 ┌───────────────▼───────────────────────┴────────────────┐
 │                     Supabase                           │
 │  Postgres + PostGIS   Auth   Storage (fotos)  Realtime │
 │  Triggers: snap a cuadra, recálculo de puntaje         │
 └────────────────────────────────────────────────────────┘
         ▲
         │ script de importación (una vez / periódico)
   OpenStreetMap (Overpass) → cuadras del casco
```

### Stack
| Capa | Elección | Por qué |
|---|---|---|
| Frontend | **Next.js (App Router) + TypeScript**, PWA | Mobile-first, instalable, SSR para las páginas compartibles |
| Mapa | **MapLibre GL JS** | Open source, sin costo por carga, estilos por datos (`match`/`interpolate`) |
| Tiles base | **OpenFreeMap** o **Protomaps** | Gratis, sin API key |
| Backend | **Supabase** (Postgres + PostGIS + Auth + Storage + Realtime) | Tiempo real resuelto, consultas geoespaciales en SQL, free tier |
| Zonas | **H3** (`h3-js` / extensión `h3-pg`) | Agregación uniforme, independiente de límites de barrios |
| Deploy | **Vercel** (front) + Supabase cloud | Cero ops |
| Estilo | Tailwind CSS | Rápido para iterar |

Alternativa si querés más control/backend propio (bueno para la facultad): **FastAPI o NestJS + PostGIS + WebSockets**. Se puede migrar después porque la lógica clave queda en SQL.

---

## 6. Modelo de datos (PostGIS)

```sql
-- Cuadras: tramo de calle entre dos intersecciones (importado de OSM)
create table segments (
  id            bigserial primary key,
  osm_way_id    bigint,
  street_name   text,                    -- "Calle 7", "Diagonal 74"
  between_a     text,                    -- "entre 45"
  between_b     text,                    -- "y 46"
  surface       text,                    -- asphalt | sett | cobblestone | unpaved | unknown
  is_cobbled    boolean generated always as (surface in ('sett','cobblestone','paving_stones')) stored,
  geom          geometry(LineString, 4326) not null,
  length_m      double precision,
  h3_index      text,                    -- celda H3 res 9 del centroide
  score         double precision default 0,
  status        text default 'sin_datos',-- verde | amarillo | rojo | sin_datos
  last_repaved  date,
  updated_at    timestamptz default now()
);
create index on segments using gist (geom);

-- Reportes ciudadanos
create table reports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users,
  type          text not null,           -- pozo | hundimiento | repavimentada | es_empedrado
  severity      smallint check (severity between 1 and 3), -- 1 leve, 2 medio, 3 peligroso
  geom          geometry(Point, 4326) not null,
  segment_id    bigint references segments, -- asignado por trigger (snap)
  photo_path    text,
  description   text,
  status        text default 'abierto',  -- abierto | resuelto | rechazado
  created_at    timestamptz default now(),
  resolved_at   timestamptz
);
create index on reports using gist (geom);

-- Confirmaciones: "sigue ahí" / "ya lo arreglaron"
create table report_votes (
  report_id     uuid references reports on delete cascade,
  user_id       uuid references auth.users,
  vote          text check (vote in ('sigue','arreglado','falso')),
  created_at    timestamptz default now(),
  primary key (report_id, user_id)
);

create table casco_urbano (id int primary key, geom geometry(Polygon, 4326));
```

### Lógica clave
1. **Validación de zona**: `ST_Within(new.geom, casco.geom)` en un trigger `before insert`.
2. **Snap a cuadra**: buscar la cuadra más cercana con KNN (`order by geom <-> new.geom limit 1`)
   y aceptar solo si `ST_Distance(geography) < 25 m`.
3. **Deduplicación**: si hay un pozo abierto a < 8 m en la misma cuadra, sugerir "¿es este?" y
   convertirlo en voto `sigue` en lugar de un reporte nuevo.
4. **Puntaje de cuadra** (recalculado por trigger o job cada X minutos):

   ```
   score = Σ (peso_gravedad × factor_confirmación × decaimiento_tiempo)  /  (length_m / 100)
     peso_gravedad      = {1: 1, 2: 2, 3: 4}
     factor_confirmación = 1 + 0.25 × votos_sigue   (tope 2)
     decaimiento_tiempo  = 1 si < 6 meses; baja suave después (reportes viejos sin confirmar pesan menos)
   ```
   - Reporte se marca `resuelto` cuando `votos_arreglado ≥ 2` (o 1 con foto).
   - Umbrales iniciales (a calibrar con datos reales): `< 1` verde · `1–3` amarillo · `> 3` rojo.
   - `repavimentada` confirmada → `last_repaved = hoy` y verde por N meses.
5. **Puntaje de zona (H3)**: pozos abiertos ponderados / km de calle en la celda.

Los umbrales y pesos van en una tabla `config` para poder ajustarlos sin redeploy.

---

## 7. "Tiempo real"

- Supabase Realtime escucha `insert/update` en `reports` y `segments`.
- El cliente actualiza el feature del mapa (`setFeatureState` / actualizar source) sin recargar.
- Para escalar: servir las cuadras como **vector tiles** desde PostGIS (`ST_AsMVT`) o un
  archivo PMTiles estático + "parches" en vivo por Realtime.

---

## 8. Anti-abuso y privacidad

- Login obligatorio para reportar (magic link por email o Google). Ver mapa: público, sin login.
- Rate limit: p. ej. 10 reportes/día por usuario.
- Reportes con foto pesan más; reportes marcados `falso` por varios usuarios se ocultan.
- **Quitar metadata EXIF** de las fotos (contiene GPS del celular y modelo).
- No mostrar quién reportó. Política de privacidad simple (Ley 25.326 de datos personales).
- Fase futura: blur automático de caras/patentes en fotos.

---

## 9. Pantallas (MVP)

1. **Mapa** (home): cuadras coloreadas, leyenda, toggle "cuadras / zonas", toggle "empedrado".
2. **Reportar** (botón flotante): ubica con GPS → arrastrás el pin → foto → gravedad → enviar.
3. **Detalle de cuadra**: "Calle 7 e/ 45 y 46", estado, lista de pozos, botones "sigue ahí" / "ya lo arreglaron".
4. **Rankings / Dashboard**: peores cuadras, peores zonas, pozos más antiguos, total de reportes, evolución semanal.
5. **Datos abiertos**: descarga GeoJSON/CSV + explicación de la metodología del puntaje.

---

## 10. Roadmap por fases

### Fase 0 — Setup (1–2 días)
- [ ] Crear proyecto Next.js + TS + Tailwind (`npx create-next-app@latest`).
- [ ] Crear proyecto en Supabase y habilitar extensión `postgis`.
- [ ] Armar `data/casco_urbano.geojson` (dibujar en [geojson.io](https://geojson.io) siguiendo 31/32/72/122 o tomarlo de OSM).
- [ ] Script `scripts/import_osm.ts`: Overpass → calles dentro del polígono → partir ways en cuadras por intersección → insertar en `segments`.

### Fase 1 — Mapa estático (≈1 semana)
- [ ] Mapa MapLibre centrado en La Plata (-34.9214, -57.9545), limitado al casco (`maxBounds`).
- [ ] Capa de cuadras en gris + capa azul de empedrado desde OSM.
- [ ] Atribución OSM visible.

### Fase 2 — Reportes (≈1–2 semanas)
- [ ] Auth Supabase.
- [ ] Formulario de reporte con geolocalización y foto (Storage, compresión + quitar EXIF en el cliente).
- [ ] Triggers: validación casco, snap a cuadra, dedupe.
- [ ] Marcadores de pozos (clustering).

### Fase 3 — Puntaje y colores (≈1 semana)
- [ ] Función SQL `recalc_segment_score(segment_id)` + trigger.
- [ ] Estilo data-driven verde/amarillo/rojo/gris.
- [ ] Votos "sigue ahí" / "arreglado".

### Fase 4 — Tiempo real + zonas (≈1 semana)
- [ ] Suscripción Realtime.
- [ ] Agregación H3 y capa de hexágonos para zoom bajo.

### Fase 5 — Dashboard viral (≈1 semana)
- [ ] Rankings, contadores, gráfico de evolución.
- [ ] Imágenes OG compartibles por cuadra/zona.
- [ ] Endpoint de datos abiertos.

### Fase 6 — Extras
- Notificar al municipio (export semanal / integración con canal oficial de reclamos).
- Detección automática de pozos con ML sobre imágenes de Mapillary.
- Subir correcciones de `surface` a OpenStreetMap.
- Extender a otras zonas (City Bell, Gonnet, Los Hornos…).

---

## 11. Riesgos / preguntas abiertas

- **Arranque en frío**: sin reportes todo queda gris. Mitigación: lanzar con un relevamiento propio de algunas zonas + difusión en redes de La Plata.
- **Sesgo de reportes**: las zonas con más usuarios parecen "peores". Mostrar también "cantidad de reportantes" y aclararlo en la metodología.
- **Diagonales y plazas**: la grilla de La Plata con diagonales complica el partido en cuadras → validar el script de importación visualmente.
- **Costos**: free tier de Supabase alcanza para el MVP; vigilar Storage (fotos comprimidas a ~200 KB).
- ¿Nombre de dominio? (`positoslp.com.ar` vía NIC Argentina).

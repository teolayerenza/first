# Positos LP — Plan de proyecto

> Tablero público y en tiempo real del estado de las calles del **casco urbano de La Plata**.
> Lo primero que se ve son **números claros**: qué porcentaje de las calles está roto, cuánto es
> nuevo, cuántos pozos hay abiertos y cuánto tardan en arreglarse. El mapa viene después, como detalle.

---

## 1. El problema

- En La Plata la obra pública es muy visible en plazas y avenidas, pero las **calles secundarias**
  acumulan pozos sin que exista un registro público y comparable de su estado.
- Un reclamo individual (147, redes) se pierde: no hay **historial** ni forma de decir
  "esta zona está peor que aquella" o "este mes empeoró".
- Objetivo: transformar quejas sueltas en **indicadores abiertos**, fáciles de leer y de compartir.

### Público (por prioridad)
1. **Vecinos**: reportar en pocos segundos y ver el estado de su cuadra y su zona.
2. **Prensa / redes**: números contundentes, rankings y tarjetas para compartir.

### Alcance geográfico
Solo el **casco urbano**: el cuadrado de la Av. de Circunvalación (31, 32, 72 y 122). El polígono vive en
`data/casco_urbano.geojson`, y un reporte fuera de él se rechaza en el cliente **y** en la base.

---

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Pantalla principal | **Indicadores arriba y mapa debajo** |
| Base de los porcentajes | **Km de calle** como dato principal y **cantidad de cuadras** como secundario |
| "Calle nueva" | Repavimentada (con fecha) en los **últimos 12 meses** |
| Zonas | **Cuadrantes entre avenidas** (por ejemplo, "7–13 / 44–51") |
| Empedrado | **Categoría aparte**: no entra en el % de rotas, nuevas ni bien |
| Cuadras sin información | Se muestran como **"Sin relevar"** dentro de la barra del 100% |
| Buen estado | Botón **"calificar mi cuadra"**: 🟢 bien / 🟡 regular / 🔴 rota |
| Reportar | **Anónimo con límite y verificación** (ver §6) |
| Foto | **Opcional**: un reporte con foto cuenta como verificado |
| Backend | **Supabase** (Postgres + PostGIS, Auth anónima, Storage, Realtime) |
| Evolución | Variación mensual · arreglados vs. nuevos · tiempo promedio de arreglo · pozo más viejo |

---

## 3. Indicadores (lo principal de la app)

### 3.1 Categorías de cada cuadra de asfalto

| Estado | Color | Regla |
|---|---|---|
| **Nueva** | 🟢 verde intenso | Repavimentación verificada hace ≤ 12 meses y sin pozos verificados posteriores |
| **Bien** | 🟢 verde claro | Calificación "bien" vigente y sin pozos activos verificados |
| **Regular** | 🟡 amarillo | Calificación "regular" o puntaje de pozos medio |
| **Rota** | 🔴 rojo | Calificación "rota" o puntaje de pozos alto |
| **Sin relevar** | ⚪ gris | Sin calificaciones ni reportes verificados en los últimos 12 meses |

Aparte de esas categorías: 🔵 **Empedrado** (superficie `sett`/`cobblestone` en OSM o marcada por usuarios).
Tiene su propio indicador ("X% del casco es empedrado") y, si se quiere, su propio estado, pero
**no entra en los porcentajes de asfalto**.

**Regla de combinación: "el peor gana".** Estado = el peor entre (a) la calificación vigente de los
vecinos y (b) el estado que surge del puntaje de pozos. La única excepción es una repavimentación
verificada, que reinicia la cuadra a "Nueva".

### 3.2 KPIs del tablero (arriba de todo)

```
┌──────────────────────────────────────────────────────────┐
│  POSITOS LP · Casco urbano · actualizado hace 2 min      │
│                                                          │
│   18%  de las calles están ROTAS       ▲ +2 pp vs. sept. │
│   (412 de 2.300 cuadras · 96 km)                         │
│                                                          │
│  ████████▓▓▓▓▓▓▓▓▒▒▒▒▒▒░░░░░░░░░░░░░░░░░░░░              │
│  Nuevas 6% · Bien 21% · Regular 12% · Rotas 18%          │
│  · Sin relevar 43%                                       │
│                                                          │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐             │
│  │ 1.284  │ │  37 vs │ │ 64 días│ │412 días│             │
│  │ pozos  │ │  210   │ │ prom.  │ │ el más │             │
│  │abiertos│ │arreglad│ │de arre-│ │ viejo  │             │
│  │        │ │vs nuevo│ │ glo    │ │ 7 y 50 │             │
│  └────────┘ └────────┘ └────────┘ └────────┘             │
│  🔵 11% del casco es empedrado                           │
│                                                          │
│  [ 📍 Reportar pozo ]   [ ⭐ Calificar mi cuadra ]        │
├──────────────────────────────────────────────────────────┤
│                 MAPA (cuadras coloreadas)                │
├──────────────────────────────────────────────────────────┤
│  Ranking de zonas (cuadrantes) por % de rotas            │
│  1. 19–25 / 60–66 ....... 41% rotas                      │
│  2. 1–7 / 66–72 ......... 37% rotas                      │
│  Pozos más viejos sin arreglar · Peores cuadras          │
│  Gráfico: % de rotas por mes · arreglados vs. nuevos     │
└──────────────────────────────────────────────────────────┘
```

| KPI | Definición | Fuente |
|---|---|---|
| **% rotas** | km de asfalto en estado "Rota" / km totales de asfalto (+ cantidad de cuadras) | `segments` |
| **% nuevas** | ídem con "Nueva" | `segments` |
| **% bien / regular / sin relevar** | ídem | `segments` |
| **% empedrado** | km empedrados / km totales del casco | `segments` |
| **Pozos abiertos** | reportes verificados en estado `abierto` | `reports` |
| **Arreglados vs. nuevos (mes)** | resueltos en el mes vs. creados en el mes | `reports` |
| **Tiempo promedio de arreglo** | promedio de `resolved_at - created_at` de los resueltos en los últimos 90 días (mostrar también la mediana) | `reports` |
| **Pozo más viejo** | `max(now() - created_at)` entre los abiertos, con dirección "7 y 50" | `reports` |
| **Variación mensual** | KPI actual - KPI del snapshot de hace 30 días, en puntos porcentuales | `stats_snapshots` |

**Para que los números sean honestos:**
- Siempre se muestra "Sin relevar". Nunca se presenta un % calculado solo sobre lo relevado sin decirlo.
- Debajo de cada número hay un link a "¿Cómo se calcula?" (página de metodología).
- Se muestra cuántos vecinos distintos aportaron datos, porque las zonas con más usuarios
  pueden parecer peores (sesgo de reporte).

### 3.3 Zonas: cuadrantes entre avenidas
La grilla del casco tiene una avenida cada 6 cuadras, así que cada zona es el rectángulo entre dos avenidas
paralelas y dos perpendiculares, con nombre del tipo **"7–13 / 44–51"**, que es la forma en que se ubica cualquier platense.
- Se arma a mano una sola vez en `data/zonas.geojson` (geojson.io) tomando las avenidas de OSM.
- Casos a validar: la franja 51–53, las zonas cortadas por diagonales y el Bosque (se excluye o se toma como zona propia).
- Cada zona tiene los mismos KPIs que el casco, y el ranking ordena por % de rotas (con un mínimo de % relevado para entrar).

---

## 4. ¿Se puede sacar la info de Google Maps / 3D Maps?

**No.** Google no tiene una capa de estado del pavimento, y sus Términos de Servicio prohíben
extraer contenido (incluido Street View) para armar bases de datos propias.

| Fuente | Qué aporta | Licencia |
|---|---|---|
| **OpenStreetMap** (Overpass API) | Geometría de las calles del casco + tag `surface` (empedrado) | ODbL (atribución obligatoria) |
| **Vecinos** (la app) | Pozos, calificaciones, repavimentaciones, fotos | Propia, se publica como datos abiertos |
| **Mapillary** (futuro) | Fotos a nivel calle → detección automática de pozos con ML | CC BY-SA |
| **Municipalidad** (futuro) | Relevamiento de calles empedradas (Ordenanza 75934/24) y obras de repavimentación | Pedido de acceso a la información pública |

---

## 5. Inspiración: dashboards de datos públicos que se viralizan
- **Primero un número grande**, después el detalle.
- Fuente y fecha de actualización siempre visibles.
- **Rankings y tarjetas para compartir** (imagen OG por zona/cuadra: "La zona 19–25 / 60–66 tiene 41% de calles rotas").
- **Datos abiertos** descargables (GeoJSON/CSV).

> TODO: pasar el link de la app de municipios de referencia para revisar su UI.

---

## 6. Reportar sin cuenta: anónimo con límite y verificación

- **Supabase Anonymous Sign-In**: cada dispositivo recibe un `user_id` sin pedir datos. Sirve para
  RLS, para el rate limit y para que un mismo dispositivo no pueda votar dos veces. El usuario
  puede vincular Google más adelante si quiere (aporte con más peso, historial propio).
- **Captcha invisible** (Cloudflare Turnstile) para evitar que bots creen sesiones anónimas.
- **Límites**: 10 reportes y 30 calificaciones por día por dispositivo (configurable).
- **Verificación**: un reporte o una calificación **cuenta en los KPIs** recién cuando cumple alguna de estas condiciones:
  - tiene **foto**; o
  - lo **confirma otro dispositivo** distinto ("sigue ahí" / misma calificación); o
  - lo hizo un usuario con cuenta vinculada.
- Mientras no está verificado se muestra en el mapa con un marcador "pendiente", pero no suma en los porcentajes.
- Si varios dispositivos lo marcan como `falso`, se oculta.
- **Privacidad**: se quita el EXIF de las fotos en el cliente, nunca se muestra quién reportó y hay una política simple (Ley 25.326).

---

## 7. Arquitectura

```
 ┌──────────────── Cliente (PWA, Next.js) ─────────────────┐
 │  Dashboard de KPIs  ← vista SQL `v_kpis_casco`/`zona`    │
 │  MapLibre GL        ← cuadras coloreadas por estado      │
 │  Reportar / Calificar (GPS + foto opcional)              │
 └───────────────┬─────────────────────────▲───────────────┘
                 │ RPC                     │ Realtime
 ┌───────────────▼─────────────────────────┴───────────────┐
 │                       Supabase                          │
 │  Postgres + PostGIS · Auth anónima · Storage · Realtime │
 │  Triggers: validar casco, snap a cuadra, dedupe,        │
 │            verificar, recalcular estado de la cuadra    │
 │  pg_cron: snapshot diario de KPIs (para la evolución)   │
 └─────────────────────────────────────────────────────────┘
        ▲
        │ script de importación
  OpenStreetMap → cuadras · data/zonas.geojson → zonas
```

| Capa | Elección |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind, PWA |
| Gráficos | Recharts (o similar): barra apilada al 100%, línea mensual |
| Mapa | MapLibre GL JS + tiles OpenFreeMap / Protomaps (sin API key) |
| Backend | Supabase: Postgres + PostGIS, Auth anónima, Storage, Realtime, pg_cron |
| Anti-bot | Cloudflare Turnstile |
| Deploy | Vercel + Supabase cloud |

La lógica de estados y KPIs queda en **SQL** (vistas y funciones). Eso permite migrar después a un backend propio sin reescribirla.

---

## 8. Modelo de datos (PostGIS)

```sql
create table zones (
  id          serial primary key,
  name        text not null,                 -- "7–13 / 44–51"
  geom        geometry(Polygon, 4326) not null
);

create table segments (                       -- una cuadra
  id          bigserial primary key,
  osm_way_id  bigint,
  street_name text,                           -- "Calle 7", "Diagonal 74"
  between_a   text, between_b text,           -- "45", "46"
  surface     text default 'asphalt',         -- asphalt | sett | cobblestone | unpaved
  is_cobbled  boolean generated always as (surface in ('sett','cobblestone','paving_stones')) stored,
  zone_id     int references zones,
  geom        geometry(LineString, 4326) not null,
  length_m    double precision not null,
  pothole_score double precision default 0,
  status      text default 'sin_relevar',     -- nueva | bien | regular | rota | sin_relevar
  repaved_at  date,
  status_updated_at timestamptz default now()
);
create index on segments using gist (geom);

create table reports (                        -- pozos y repavimentaciones
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  type        text not null check (type in ('pozo','repavimentada','es_empedrado')),
  severity    smallint check (severity between 1 and 3),   -- solo pozos
  geom        geometry(Point, 4326) not null,
  segment_id  bigint references segments,     -- lo asigna un trigger (snap)
  photo_path  text,
  verified    boolean default false,
  status      text default 'abierto',         -- abierto | resuelto | oculto
  created_at  timestamptz default now(),
  resolved_at timestamptz
);
create index on reports using gist (geom);

create table report_votes (
  report_id   uuid references reports on delete cascade,
  user_id     uuid references auth.users,
  vote        text check (vote in ('sigue','arreglado','falso')),
  created_at  timestamptz default now(),
  primary key (report_id, user_id)
);

create table segment_ratings (                -- "calificar mi cuadra"
  segment_id  bigint references segments,
  user_id     uuid references auth.users,
  rating      text check (rating in ('bien','regular','rota')),
  created_at  timestamptz default now(),
  primary key (segment_id, user_id)           -- un voto vigente por dispositivo
);

create table stats_snapshots (                -- una fila por día y por ámbito
  day         date,
  zone_id     int,                            -- null = casco completo
  km_total numeric, km_nueva numeric, km_bien numeric, km_regular numeric,
  km_rota numeric, km_sin_relevar numeric, km_empedrado numeric,
  cuadras_rota int, cuadras_nueva int,
  pozos_abiertos int, pozos_nuevos_mes int, pozos_resueltos_mes int,
  dias_promedio_arreglo numeric,
  primary key (day, zone_id)
);

create table config (key text primary key, value jsonb);  -- umbrales, pesos y límites
```

### Lógica clave (funciones/triggers SQL)
1. **Validar casco**: `ST_Within(new.geom, casco)` en un trigger `before insert`.
2. **Snap a cuadra**: KNN `order by geom <-> new.geom limit 1`, aceptado si la distancia es < 25 m.
3. **Dedupe**: si hay un pozo abierto a < 8 m en la misma cuadra, se sugiere "¿es este?" y se registra como voto `sigue`.
4. **Verificación**: `verified = photo_path is not null or votos 'sigue' de otro usuario >= 1 or usuario no anónimo`.
5. **Puntaje de pozos** (solo con reportes verificados y abiertos):
   `Σ(peso_gravedad{1,2,4} × (1 + 0.25·votos_sigue, tope 2)) / (length_m / 100)`
6. **Resolución**: un pozo pasa a `resuelto` con ≥ 2 votos `arreglado` (o 1 con foto), y `resolved_at = now()`.
7. **Estado de la cuadra** = el peor entre la calificación vigente (moda de los últimos 6 meses, con ≥ 2 votos
   o 1 verificado) y el estado por puntaje. Una repavimentación verificada en los últimos 12 meses → `nueva`.
8. **KPIs en vivo**: vistas `v_kpis_casco` y `v_kpis_zona` (sumas de `length_m` agrupadas por `status`).
9. **Snapshot diario** con `pg_cron` → `stats_snapshots`, usado para la variación mensual y los gráficos.

---

## 9. Pantallas (MVP)

1. **Inicio = Tablero**: los KPIs de §3.2, los botones Reportar/Calificar, el mapa y los rankings.
2. **Reportar pozo**: GPS → ajustar el pin → gravedad → foto opcional → enviar (≤ 15 s).
3. **Calificar mi cuadra**: detecta la cuadra por GPS → 🟢/🟡/🔴 en un toque. También se puede marcar "la repavimentaron" o "es empedrado".
4. **Zona** (`/zona/7-13-44-51`): los mismos KPIs filtrados, mapa de la zona y botón para compartir.
5. **Cuadra** (`/cuadra/:id`): estado, pozos, votar "sigue ahí" / "arreglado".
6. **Metodología y datos abiertos**: cómo se calcula cada número + descarga.

---

### 9.1 Formulario del vecino (un solo flujo: "¿Cómo está esta cuadra?")

Calificar la cuadra y reportar pozos son **un mismo flujo**: el vecino no tiene que elegir el formulario correcto.
El objetivo es tardar **menos de 10 s** solo con la calificación y **menos de 30 s** si se agrega un pozo con foto.

```
① ¿DÓNDE?                       ② ¿CÓMO ESTÁ?                   ③ POZOS (si es 🟡/🔴)
┌───────────────────────┐       ┌───────────────────────┐       ┌───────────────────────┐
│ [mapa, cuadra         │       │ Calle 7 e/ 45 y 46    │       │ Tocá dónde está el    │
│  resaltada]           │       │                       │       │ pozo  [mapa cuadra]   │
│                       │       │  ┌─────────────────┐  │       │                       │
│ 📍 Calle 7            │       │  │ 🟢  Bien         │  │       │ ¿Qué tan grave?       │
│    entre 45 y 46      │       │  ├─────────────────┤  │       │ ○ Leve: se esquiva    │
│                       │       │  │ 🟡  Regular      │  │       │ ○ Medio: hay que      │
│ [ Sí, es esta ✓ ]     │       │  ├─────────────────┤  │       │   frenar              │
│ Mover pin · Buscar    │       │  │ 🔴  Rota         │  │       │ ○ Peligroso: rompe    │
│ "Calle _ e/ _ y _"    │       │  └─────────────────┘  │       │   ruedas / tira motos │
│                       │       │ ☐ La repavimentaron   │       │ 📷 Sumar foto         │
│                       │       │ ☐ Es empedrado        │       │ (con foto cuenta ya)  │
│                       │       │                       │       │ [+ Otro pozo] [Enviar]│
└───────────────────────┘       └───────────────────────┘       └───────────────────────┘
                                                                         │
                                                                         ▼
                        ④ ¡Gracias! · estado de la cuadra · "¿Y la de al lado?" · Compartir
```

**① Ubicación**
- Se usa el GPS automáticamente y se muestra la cuadra detectada en lenguaje platense: "Calle 7 entre 45 y 46".
- Si la precisión del GPS es peor que 30 m, o el vecino no está en la calle, puede **mover el pin** o
  **buscar con tres selectores: "Calle ___ entre ___ y ___"** (las opciones salen de `segments`).
- Si el punto cae fuera del casco: "Por ahora Positos LP funciona solo dentro del casco urbano".

**② Calificación** (obligatoria, un toque) → se guarda en `segment_ratings`
- 🟢 Bien / 🟡 Regular / 🔴 Rota, con botones grandes que se tocan con una mano.
- Casillas opcionales:
  - "La repavimentaron": pregunta cuándo (este mes / hace 1–3 meses / hace más de 3 meses) y se guarda en `reports` con `type='repavimentada'`.
  - "Es empedrado": se guarda en `reports` con `type='es_empedrado'`.
- Si elige 🟢, se envía directamente sin pasar al paso ③.

**③ Pozos** (aparece con 🟡/🔴, y es opcional) → se guarda en `reports` con `type='pozo'`
- El vecino toca el mapa de la cuadra para ubicar el pozo, que queda pegado a la línea de la calle.
- Gravedad con descripciones concretas en lugar de números.
- Foto opcional: se comprime a ~200 KB y se le quita el EXIF en el navegador. Con foto, el reporte queda verificado.
- **Dedupe en vivo**: si hay un pozo abierto a menos de 8 m, se pregunta "¿Es este? (reportado hace 40 días)".
  "Sí, sigue ahí" lo registra como voto; "No, es otro" crea un reporte nuevo.
- "+ Otro pozo" permite cargar varios pozos en la misma cuadra.

**④ Confirmación**
- Se muestra el estado actualizado de la cuadra y aclara "pendiente de verificación" si no tiene foto.
- "**¿Y la cuadra de al lado?**" ofrece calificar una cuadra vecina sin relevar en un toque, para bajar el % sin relevar.
- Botón de compartir (tarjeta con la cuadra o la zona).

**Detalles técnicos**
- No hay texto libre en el MVP: evita moderar insultos y que se carguen datos personales.
- Sin señal: el envío queda en cola en IndexedDB y se manda cuando vuelve la conexión.
- Turnstile invisible y rate limit en el envío. Una calificación vigente por dispositivo y cuadra: si el vecino vuelve a calificar, se reemplaza.
- Se guarda si el aporte se hizo **en el lugar** (GPS a menos de 50 m de la cuadra) o **a distancia**. Los aportes en el lugar pueden pesar más (configurable).

## 10. Roadmap por fases

### Fase 0 — Setup y datos base
- [ ] Next.js + TS + Tailwind. Proyecto Supabase con `postgis` y `pg_cron`.
- [ ] `data/casco_urbano.geojson` y `data/zonas.geojson` (cuadrantes entre avenidas).
- [ ] `scripts/import_osm.ts`: Overpass → partir en cuadras por intersección → `segments` con `zone_id`.
- [ ] Validar visualmente las diagonales y el total de km (debería coincidir con el orden de magnitud real del casco).

### Fase 1 — Tablero con datos de prueba ⭐ (lo principal)
- [ ] Vistas `v_kpis_casco` / `v_kpis_zona`.
- [ ] Hero con % de rotas, barra apilada al 100% (km), tarjetas de KPIs y % empedrado.
- [ ] Seed con datos falsos para diseñar los números antes de tener usuarios.

### Fase 2 — Reportar y calificar
- [ ] Auth anónima + Turnstile + rate limit.
- [ ] Formulario de pozo (foto opcional, EXIF removido) y calificación de cuadra.
- [ ] Triggers: casco, snap, dedupe, verificación, estado de la cuadra.

### Fase 3 — Mapa y zonas
- [ ] Mapa con cuadras coloreadas por estado + capa de empedrado.
- [ ] Páginas de zona y ranking de cuadrantes.

### Fase 4 — Tiempo real y evolución
- [ ] Realtime: los KPIs y el mapa se actualizan solos.
- [ ] `pg_cron` de snapshots; variación mensual, arreglados vs. nuevos, tiempo de arreglo y pozo más viejo.

### Fase 5 — Viralidad
- [ ] Imágenes OG compartibles por casco/zona/cuadra.
- [ ] Datos abiertos (GeoJSON/CSV) + página de metodología.

### Fase 6 — Extras
- Enviar resumen mensual al municipio y a concejales.
- Detección de pozos con ML sobre Mapillary.
- Subir correcciones de `surface` a OSM.
- Extender a otras localidades del partido.

---

## 11. Riesgos y preguntas abiertas
- **Arranque en frío**: casi todo va a estar "Sin relevar". Mitigación: relevar algunas zonas uno mismo antes del lanzamiento
  y lanzar mostrando el % relevado como meta ("ayudanos a llegar al 50%").
- **Sesgo de reporte**: mostrar cuántos vecinos aportaron datos por zona y exigir un % mínimo relevado para entrar al ranking.
- **Calibración**: los umbrales del puntaje (regular/rota) se ajustan con datos reales; quedan en `config`.
- **Abuso anónimo**: si los límites no alcanzan, exigir login para que un aporte cuente sin verificación.
- Dominio: ¿`positoslp.com.ar`?

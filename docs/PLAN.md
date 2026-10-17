# Positos LP — Plan de proyecto

> Tablero público y en tiempo real del estado de las calles del **casco urbano de La Plata**.
> Lo primero que se ve son **números claros**: qué porcentaje de las calles está deteriorado, cuánto es
> nuevo, cuántos pozos hay abiertos y cuánto tardan en arreglarse. El mapa viene después, como detalle.
>
> **Es un bien común**: anónimo, con los datos mínimos indispensables, código abierto y datos abiertos.
> No se venden datos, no hay publicidad y no hay tracking.

---

## 1. El problema

- En La Plata la obra pública es muy visible en plazas y avenidas, pero las **calles secundarias**
  se deterioran y acumulan pozos sin que exista un registro público y comparable de su estado.
- Un reclamo individual (147, redes) se pierde: no hay **historial** ni forma de decir
  "esta zona está peor que aquella" o "este mes empeoró".
- Objetivo: transformar quejas sueltas en **indicadores abiertos**, fáciles de leer y de compartir.

### Dos fenómenos distintos, dos mediciones separadas
| | **Estado del asfalto** | **Pozos** |
|---|---|---|
| Qué es | La condición general de la cuadra: asfalto viejo, gastado, agrietado, lleno de parches | Una rotura puntual en un lugar concreto |
| Quién lo aporta | Quien conoce la cuadra (típicamente un vecino de esa cuadra) | Cualquiera que pase por ahí |
| Cómo se valida | Coincidencia entre varios dispositivos | Foto o confirmación de otra persona que pasó ("sigue ahí") |
| Unidad | La cuadra entera | Un punto |
| Se resuelve | Cuando la repavimentan | Cuando lo tapan |

Una cuadra puede tener asfalto nuevo y un pozo, o estar muy deteriorada sin un pozo puntual.
**No se mezclan**: cada uno tiene su formulario, sus KPIs y su capa en el mapa.

### Público
1. **Vecinos**: aportar en pocos segundos y ver su cuadra o su zona.
2. **Prensa / redes**: números contundentes, rankings y tarjetas para compartir.

### Alcance geográfico
Solo el **casco urbano**: el cuadrado de la Av. de Circunvalación (31, 32, 72 y 122), en `data/casco_urbano.geojson`.
Lo que cae afuera se rechaza en el cliente y en la base. Otras localidades (Los Hornos, Tolosa, City Bell...) quedan para más adelante.

---

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Pantalla principal | **Indicadores arriba y mapa debajo** |
| Base de los porcentajes | **Km de calle** como dato principal y **cantidad de cuadras** como secundario |
| Estado vs. pozos | **Dos formularios y dos indicadores separados** |
| "Calle nueva" | Repavimentada (con fecha) en los **últimos 12 meses** |
| Zonas | **Cuadrantes entre avenidas** (por ejemplo, "7–13 / 44–51"), derivados de la ubicación. **No se pide barrio.** |
| Empedrado | **Categoría aparte**, fuera de los % de asfalto |
| Cuadras sin datos | Se muestran como **"Sin relevar"** dentro de la barra del 100% |
| Identidad | **100% anónimo**: sin cuentas, email, nombre, teléfono ni domicilio |
| Datos personales | **Mínimos indispensables** (ver §6) |
| Foto | **Opcional**: un pozo con foto queda verificado |
| Backend | **Supabase** (Postgres + PostGIS, sesión anónima, Storage, Realtime, pg_cron) |
| Evolución | Variación mensual · arreglados vs. nuevos · tiempo promedio de arreglo · pozo más viejo |
| Licencias (propuesta) | Código **AGPL-3.0**, datos **ODbL** (igual que OSM) |

---

## 3. Indicadores (lo principal de la app)

### 3.1 Estado del asfalto de cada cuadra

| Estado | Color | Descripción para el vecino |
|---|---|---|
| **Nueva** | 🟢 verde intenso | "La repavimentaron hace menos de un año" |
| **Buena** | 🟢 verde claro | "Asfalto en buen estado" |
| **Gastada** | 🟡 amarillo | "Asfalto viejo, con grietas o algunos parches" |
| **Muy deteriorada** | 🔴 rojo | "Se desarma, todo parcheado, hace años que no la arreglan" |
| **Sin relevar** | ⚪ gris | Nadie la calificó todavía (o la calificación tiene más de 12 meses) |

Aparte: 🔵 **Empedrado**, con su propio indicador ("X% del casco es empedrado").

El estado vigente es la **moda de las calificaciones de los últimos 12 meses**. Hacen falta al menos **2 dispositivos
coincidentes**, o 1 calificación hecha *en el lugar* (configurable). Una repavimentación confirmada → **Nueva**.

### 3.2 Pozos
Puntos sobre el mapa con gravedad (leve / medio / peligroso) y estado (abierto / resuelto).
Solo cuentan los **verificados**: con foto o confirmados por otro dispositivo.
Por cuadra y por zona se calcula la **densidad**: pozos abiertos por km, ponderados por gravedad.

### 3.3 Tablero

```
┌──────────────────────────────────────────────────────────┐
│  POSITOS LP · Casco urbano · actualizado hace 2 min      │
│                                                          │
│  ESTADO DEL ASFALTO                                      │
│   23%  de las calles está MUY DETERIORADA ▲ +2 pp        │
│   (530 de 2.300 cuadras · 121 km)                        │
│  ████▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒▒░░░░░░░░░░░░░░░░░░                │
│  Nueva 6% · Buena 20% · Gastada 18% · Muy det. 23%       │
│  · Sin relevar 33%          🔵 11% del casco es empedrado│
│                                                          │
│  POZOS                                                   │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐             │
│  │ 1.284  │ │4,1/km  │ │ 37 vs  │ │ 64 días│             │
│  │abiertos│ │densidad│ │ 210    │ │ prom.  │             │
│  │        │ │        │ │arr./nue│ │arreglo │             │
│  └────────┘ └────────┘ └────────┘ └────────┘             │
│  🕐 El pozo más viejo: 7 y 50, abierto hace 412 días      │
│                                                          │
│  [ 🕳️ Reportar pozo ]     [ 🛣️ Calificar una cuadra ]     │
├──────────────────────────────────────────────────────────┤
│  MAPA: líneas = estado del asfalto · puntos = pozos      │
├──────────────────────────────────────────────────────────┤
│  Rankings de zonas: % muy deteriorada · pozos por km     │
│  Pozos más viejos sin arreglar                           │
│  Gráficos: evolución mensual · arreglados vs. nuevos     │
└──────────────────────────────────────────────────────────┘
```

| KPI | Definición |
|---|---|
| **% por estado** | km de asfalto en cada estado / km totales de asfalto (+ cantidad de cuadras) |
| **% empedrado** | km empedrados / km totales del casco |
| **Pozos abiertos** | pozos verificados en estado `abierto` |
| **Densidad** | pozos abiertos / km de asfalto |
| **Arreglados vs. nuevos (mes)** | resueltos en el mes vs. creados en el mes |
| **Tiempo de arreglo** | promedio y mediana de `resolved_at - created_at` (últimos 90 días) |
| **Pozo más viejo** | el abierto más antiguo, con su dirección |
| **Variación mensual** | KPI actual - snapshot de hace 30 días, en puntos porcentuales |

**Para que los números sean honestos:**
- "Sin relevar" siempre visible y link a "¿Cómo se calcula?" en cada número.
- Por zona se muestra cuántos aportes hay. Para entrar al ranking, una zona necesita un % mínimo relevado.

### 3.4 Zonas: cuadrantes entre avenidas
Cada zona es el rectángulo entre dos pares de avenidas, con nombre del tipo **"7–13 / 44–51"**. Se dibuja una vez en
`data/zonas.geojson`. A validar: la franja 51–53, los cortes de las diagonales y el Bosque.
La zona se **deduce de la ubicación**; nunca se le pregunta al vecino.

---

## 4. ¿Se puede sacar la info de Google Maps / 3D Maps?

**No.** Google no tiene una capa de estado del pavimento, y sus Términos de Servicio prohíben extraer
contenido (incluido Street View) para armar bases propias.

| Fuente | Qué aporta | Licencia |
|---|---|---|
| **OpenStreetMap** (Overpass API) | Geometría de las calles + tag `surface` (empedrado) | ODbL |
| **Vecinos** (la app) | Estado de cuadras, pozos, repavimentaciones, fotos | ODbL (datos abiertos) |
| **Mapillary** (futuro) | Fotos a nivel calle → detección de pozos con ML | CC BY-SA |
| **Municipalidad** (futuro) | Relevamiento de empedrados (Ord. 75934/24) y obras de repavimentación | Pedido de acceso a la información pública |

---

## 5. Inspiración: dashboards de datos públicos que se viralizan
- **Primero un número grande**, después el detalle. Fuente y fecha de actualización siempre visibles.
- **Rankings y tarjetas para compartir** ("La zona 19–25 / 60–66 tiene 41% de calles muy deterioradas").
- **Datos abiertos** descargables (GeoJSON/CSV).

> TODO: pasar el link de la app de municipios de referencia para revisar su UI.

---

## 6. Privacidad: datos mínimos indispensables

Principio: **si un dato no hace falta para calcular un indicador o para frenar abusos, no se pide ni se guarda.**

### Qué NO se guarda nunca
- Nombre, email, teléfono, cuenta de Google, barrio, domicilio.
- La **ubicación del dispositivo**. Solo se guarda la ubicación del **pozo** o la **cuadra** calificada.
  Si el aporte fue "en el lugar" se calcula en el celular y viaja solo como un `true/false`.
- La IP, en nuestras tablas.
- Metadatos de las fotos (se quita el EXIF en el navegador antes de subirlas).
- Analytics de terceros, cookies de tracking o publicidad.

### Cómo se frena el abuso sin identificar a nadie
- **Sesión anónima por dispositivo** (Supabase Anonymous Sign-In): solo es un identificador aleatorio, sin datos.
- **Hash por aporte en lugar de identificador**: los votos y reportes no guardan el ID del dispositivo, sino
  `HMAC(secreto_del_servidor, id_dispositivo || id_cuadra_o_pozo)`. Así se puede impedir que alguien vote dos veces
  la misma cuadra, pero **no se puede reconstruir qué cuadras calificó un mismo dispositivo**,
  y por lo tanto tampoco inferir dónde vive.
- **Rate limit** con contadores diarios (hash con sal rotativa diaria) que se **borran cada día**.
- **Captcha invisible** (Cloudflare Turnstile) contra bots.
- **Verificación cruzada**: un pozo cuenta si tiene foto o si otro dispositivo lo confirma. Una calificación cuenta con
  2 dispositivos coincidentes.

### Transparencia
- Política de privacidad corta y clara (Ley 25.326). Debe decir honestamente que la infraestructura (Vercel,
  Supabase, Cloudflare) registra IPs en sus propios logs técnicos, y configurar la retención mínima posible.
- Aviso al sacar una foto: "No incluyas personas ni patentes". En el futuro: blur automático.
- Código abierto (AGPL-3.0: si alguien lo usa como servicio, tiene que liberar sus cambios) y datos abiertos (ODbL).

---

## 7. Arquitectura

```
 ┌──────────────── Cliente (PWA, Next.js) ─────────────────┐
 │  Tablero de KPIs   ← vistas SQL                          │
 │  MapLibre GL       ← cuadras (estado) + puntos (pozos)   │
 │  Form "Reportar pozo" · Form "Calificar cuadra"          │
 └───────────────┬─────────────────────────▲───────────────┘
                 │ RPC (funciones SQL)     │ Realtime
 ┌───────────────▼─────────────────────────┴───────────────┐
 │                       Supabase                          │
 │  Postgres + PostGIS · sesión anónima · Storage          │
 │  RPC: submit_pothole / submit_rating / vote_pothole     │
 │       (calculan los HMAC; el cliente nunca escribe      │
 │        directo en las tablas)                           │
 │  pg_cron: snapshot diario de KPIs + borrado de          │
 │           contadores de rate limit                      │
 └─────────────────────────────────────────────────────────┘
        ▲
  OpenStreetMap → cuadras · data/zonas.geojson → zonas
```

| Capa | Elección |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind, PWA |
| Gráficos | Recharts: barra apilada al 100% y línea mensual |
| Mapa | MapLibre GL JS + tiles OpenFreeMap / Protomaps |
| Backend | Supabase |
| Anti-bot | Cloudflare Turnstile |
| Deploy | Vercel + Supabase cloud |

---

## 8. Modelo de datos (PostGIS)

```sql
create table zones (
  id          serial primary key,
  name        text not null,                  -- "7–13 / 44–51"
  geom        geometry(Polygon, 4326) not null
);

create table segments (                        -- una cuadra
  id          bigserial primary key,
  osm_way_id  bigint,
  street_name text,                            -- "Calle 7", "Diagonal 74"
  between_a   text, between_b text,            -- "45", "46"
  surface     text default 'asphalt',          -- asphalt | sett | cobblestone | unpaved
  is_cobbled  boolean generated always as (surface in ('sett','cobblestone','paving_stones')) stored,
  zone_id     int references zones,
  geom        geometry(LineString, 4326) not null,
  length_m    double precision not null,
  condition   text default 'sin_relevar',      -- nueva | buena | gastada | muy_deteriorada | sin_relevar
  repaved_at  date,
  potholes_open int default 0,                 -- denormalizado para el mapa
  pothole_score double precision default 0,
  updated_at  timestamptz default now()
);
create index on segments using gist (geom);

-- Estado del asfalto (formulario "Calificar cuadra")
create table segment_ratings (
  segment_id  bigint references segments,
  voter_hash  bytea not null,                  -- HMAC(secreto, device || segment_id)
  rating      text check (rating in ('buena','gastada','muy_deteriorada')),
  on_site     boolean default false,
  created_at  timestamptz default now(),
  primary key (segment_id, voter_hash)         -- un voto vigente por dispositivo y cuadra
);

create table segment_events (                  -- "la repavimentaron" / "es empedrado"
  id          bigserial primary key,
  segment_id  bigint references segments,
  voter_hash  bytea not null,
  type        text check (type in ('repavimentada','es_empedrado')),
  approx_date date,                            -- para la repavimentación
  created_at  timestamptz default now(),
  unique (segment_id, voter_hash, type)
);

-- Pozos (formulario "Reportar pozo")
create table potholes (
  id            uuid primary key default gen_random_uuid(),
  reporter_hash bytea not null,                -- HMAC(secreto, device || pothole_id)
  severity      smallint check (severity between 1 and 3),
  geom          geometry(Point, 4326) not null, -- ubicación del POZO, no de la persona
  segment_id    bigint references segments,     -- snap automático
  photo_path    text,
  verified      boolean default false,
  status        text default 'abierto',         -- abierto | resuelto | oculto
  created_at    timestamptz default now(),
  resolved_at   timestamptz
);
create index on potholes using gist (geom);

create table pothole_votes (
  pothole_id  uuid references potholes on delete cascade,
  voter_hash  bytea not null,                  -- HMAC(secreto, device || pothole_id)
  vote        text check (vote in ('sigue','arreglado','falso')),
  created_at  timestamptz default now(),
  primary key (pothole_id, voter_hash)
);

create table rate_limits (                     -- se vacía todos los días (pg_cron)
  day_hash    bytea primary key,               -- HMAC(sal_del_día, device)
  count       int default 0
);

create table stats_snapshots (                 -- una fila por día y por ámbito
  day date, zone_id int,                       -- zone_id null = casco completo
  km_total numeric, km_nueva numeric, km_buena numeric, km_gastada numeric,
  km_muy_deteriorada numeric, km_sin_relevar numeric, km_empedrado numeric,
  cuadras_muy_deteriorada int, cuadras_nueva int,
  pozos_abiertos int, pozos_por_km numeric,
  pozos_nuevos_mes int, pozos_resueltos_mes int, dias_promedio_arreglo numeric,
  primary key (day, zone_id)
);

create table config (key text primary key, value jsonb);  -- umbrales, pesos y límites
```

Como el pozo y el voto usan el mismo HMAC (`device || pothole_id`), se puede detectar que **quien confirma es
la misma persona que reportó** (y no contarlo como verificación) sin guardar quién es.

### Lógica clave (RPC / triggers SQL)
1. **Validar casco**: `ST_Within` contra el polígono del casco.
2. **Snap a cuadra**: KNN `order by geom <-> punto limit 1`, aceptado si la distancia es < 25 m.
3. **Dedupe de pozos**: si hay uno abierto a < 8 m, el cliente pregunta "¿Es este?" y la respuesta se registra como voto `sigue`.
4. **Verificación de pozo**: tiene foto, o tiene ≥ 1 voto `sigue` de un hash distinto al del que lo reportó.
5. **Resolución**: ≥ 2 votos `arreglado` (o 1 con foto) → `resuelto`, con `resolved_at = now()`.
6. **Estado de la cuadra**: moda de `segment_ratings` de los últimos 12 meses (≥ 2 votos o 1 `on_site`);
   una repavimentación con ≥ 2 confirmaciones y fecha ≤ 12 meses → `nueva`.
7. **KPIs en vivo**: vistas `v_kpis_casco` y `v_kpis_zona`.
8. **pg_cron**: snapshot diario de KPIs + `truncate rate_limits` + rotación de la sal diaria.

---

## 9. Pantallas (MVP)

1. **Inicio = Tablero** (§3.3), con dos botones bien visibles: **🕳️ Reportar pozo** y **🛣️ Calificar una cuadra**.
2. **Reportar pozo** (§9.1).
3. **Calificar una cuadra** (§9.2).
4. **Zona** (`/zona/7-13-44-51`): los mismos KPIs filtrados, mapa y botón para compartir.
5. **Cuadra** (`/cuadra/:id`): estado del asfalto, pozos de la cuadra, votar "sigue ahí" / "arreglado".
6. **Metodología, privacidad y datos abiertos**.

Ninguna pantalla pide datos personales. No hay registro ni login.

### 9.1 Formulario "Reportar pozo": para cualquiera que pase (≤ 15 s)

```
① ¿DÓNDE ESTÁ EL POZO?          ② ¿QUÉ TAN GRAVE?               ③ ¡LISTO!
┌───────────────────────┐       ┌───────────────────────┐       ┌───────────────────────┐
│ [mapa con pin]        │       │ Calle 7 e/ 45 y 46    │       │ ✓ Pozo reportado      │
│                       │       │                       │       │ Pendiente: falta una  │
│ Arrastrá el pin hasta │       │ ○ Leve: se esquiva    │       │ foto o que otro       │
│ el pozo               │       │ ○ Medio: hay que      │       │ vecino lo confirme    │
│                       │       │   frenar              │       │                       │
│ 📍 Calle 7            │       │ ○ Peligroso: rompe    │       │ Esta cuadra: 3 pozos  │
│    entre 45 y 46      │       │   ruedas / tira motos │       │ [Compartir]           │
│                       │       │                       │       │ [Reportar otro]       │
│ [ Confirmar lugar ]   │       │ 📷 Sumar foto (opc.)  │       │                       │
│ Buscar "Calle _ e/ _" │       │ [ Enviar ]            │       │                       │
└───────────────────────┘       └───────────────────────┘       └───────────────────────┘
```
- La ubicación sale del GPS y el vecino ajusta el pin, que se pega a la línea de la calle más cercana.
  También se puede buscar con "Calle __ entre __ y __". **No se pide barrio**: la zona se deduce.
- **Dedupe**: si hay un pozo abierto a < 8 m → "¿Es este? (reportado hace 40 días)" → "Sí, sigue ahí" / "No, es otro".
  Que **otras personas que pasan** confirmen el mismo pozo es lo que lo valida.
- Foto opcional, comprimida y sin EXIF, con el aviso "no incluyas personas ni patentes".

### 9.2 Formulario "Calificar una cuadra": estado general del asfalto (≤ 10 s)

```
① ¿QUÉ CUADRA?                  ② ¿CÓMO ESTÁ EL ASFALTO?        ③ ¡GRACIAS!
┌───────────────────────┐       ┌───────────────────────┐       ┌───────────────────────┐
│ [mapa, cuadra         │       │ Calle 7 e/ 45 y 46    │       │ ✓ Calificación        │
│  resaltada]           │       │ ┌───────────────────┐ │       │   guardada            │
│                       │       │ │🟢 Buena           │ │       │                       │
│ 📍 Calle 7            │       │ ├───────────────────┤ │       │ Así la ven los        │
│    entre 45 y 46      │       │ │🟡 Gastada: vieja, │ │       │ vecinos: 🔴 (4 votos) │
│                       │       │ │  grietas, parches │ │       │                       │
│ [ Sí, es esta ✓ ]     │       │ ├───────────────────┤ │       │ ¿Y la cuadra de al    │
│ Elegir otra cuadra    │       │ │🔴 Muy deteriorada:│ │       │ lado? (sin relevar)   │
│                       │       │ │  se desarma, años │ │       │ [🟢] [🟡] [🔴]          │
│                       │       │ │  sin arreglo      │ │       │                       │
│                       │       │ └───────────────────┘ │       │                       │
│                       │       │ ☐ La repavimentaron   │       │                       │
│                       │       │   (¿cuándo?)          │       │                       │
│                       │       │ ☐ Es empedrado        │       │                       │
└───────────────────────┘       └───────────────────────┘       └───────────────────────┘
```
- Califica la **condición general**, no los pozos. El vecino puede reportar pozos de la misma cuadra
  aparte, desde el otro formulario o desde la pantalla de confirmación.
- Se puede calificar cualquier cuadra, pero si el GPS indica que el vecino está en ella (`on_site`), la calificación pesa más.
- Si vuelve a calificar la misma cuadra, la nueva calificación reemplaza a la anterior.
- "¿Y la cuadra de al lado?" sirve para bajar el "% sin relevar" con un toque.

### Comunes a los dos formularios
- No hay texto libre en el MVP (nada que moderar y ningún dato personal que se pueda filtrar).
- Funciona sin señal: el envío queda en cola en IndexedDB.
- Turnstile invisible + rate limit diario por dispositivo.

---

## 10. Roadmap por fases

### Fase 0 — Setup y datos base
- [ ] Next.js + TS + Tailwind. Supabase con `postgis`, `pg_cron` y `pgcrypto` (HMAC).
- [ ] `data/casco_urbano.geojson` y `data/zonas.geojson`.
- [ ] `scripts/import_osm.ts`: Overpass → partir en cuadras por intersección → `segments` con `zone_id`.
- [ ] Validar visualmente las diagonales y el total de km.
- [ ] `LICENSE` (AGPL-3.0) y un aviso de datos ODbL.

### Fase 1 — Tablero con datos de prueba ⭐
- [ ] Vistas `v_kpis_casco` / `v_kpis_zona`.
- [ ] Bloque "Estado del asfalto" (barra al 100%) + bloque "Pozos" (tarjetas).
- [ ] Seed con datos falsos para diseñar los números.

### Fase 2 — Los dos formularios
- [ ] Sesión anónima + Turnstile + rate limit.
- [ ] RPC `submit_rating`, `submit_segment_event`, `submit_pothole` y `vote_pothole`, con HMAC, validación de casco y snap.
- [ ] UI de "Calificar una cuadra" y "Reportar pozo" (foto sin EXIF).

### Fase 3 — Mapa y zonas
- [ ] Líneas coloreadas por estado + puntos de pozos (clusters) + capa de empedrado.
- [ ] Páginas de zona y los dos rankings.

### Fase 4 — Tiempo real y evolución
- [ ] Realtime en el tablero y el mapa.
- [ ] Snapshots diarios → variación mensual, arreglados vs. nuevos, tiempo de arreglo, pozo más viejo.

### Fase 5 — Viralidad y transparencia
- [ ] Tarjetas OG compartibles.
- [ ] Datos abiertos (GeoJSON/CSV) + páginas de metodología y privacidad.

### Fase 6 — Extras
- Resumen mensual público para el municipio y los concejales.
- Detección de pozos con ML sobre Mapillary; blur automático de caras y patentes.
- Subir correcciones de `surface` a OSM.
- Extender a Los Hornos, Tolosa, City Bell, etc.

---

## 11. Riesgos y preguntas abiertas
- **Arranque en frío**: casi todo va a estar "Sin relevar". Mitigación: relevar algunas zonas uno mismo y lanzar con
  la meta "ayudanos a llegar al 50% relevado".
- **Anonimato vs. abuso**: sin cuentas, alguien decidido puede crear muchas sesiones. Defensas: Turnstile,
  rate limit, verificación cruzada y umbrales mínimos de votos. Si no alcanzan, subir los umbrales antes que pedir datos.
- **Sesgo de reporte**: mostrar la cantidad de aportes por zona y exigir un % relevado mínimo para el ranking.
- **Calibración** de umbrales y pesos con datos reales (tabla `config`).
- **Fotos con personas o patentes**: aviso + moderación por votos `falso` en el MVP; blur automático después.
- Dominio: ¿`positoslp.com.ar`?

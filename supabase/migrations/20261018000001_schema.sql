-- Pocitos LP · esquema base
-- Principio: ningún dato personal. Los aportes se identifican solo por HMACs que calcula la
-- Edge Function `submit` con un secreto que NO vive en esta base (docs/SEGURIDAD.md).

-- En Supabase las extensiones viven en el esquema `extensions` (que está en el search_path).
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

create table config (
  key   text primary key,
  value jsonb not null
);

insert into config (key, value) values
  ('conditionWindowDays', '365'),
  ('minRatingWeight', '2'),
  ('onSiteWeight', '2'),
  ('repavedConfirmations', '2'),
  ('resolveVotes', '2'),
  ('hideVotes', '3'),
  ('dedupeRadiusM', '8'),
  ('snapMaxDistanceM', '25'),
  ('rankingMinSurveyedPct', '20'),
  ('repairWindowDays', '90'),
  ('severityWeights', '{"1": 1, "2": 2, "3": 4}'),
  -- Detector de anomalías (§3 capa 4)
  ('anomalyZoneMinPerHour', '40'),
  ('anomalyZoneFactor', '6'),
  ('anomalyGlobalMinPerHour', '400'),
  ('anomalyGlobalFactor', '8'),
  ('anomalyImmatureShare', '0.8'),
  ('anomalyImmatureMin', '30');

create table casco (
  id   int primary key default 1 check (id = 1),
  geom geometry(Polygon, 4326) not null
);

create table zones (
  id   int primary key,
  slug text not null unique,
  name text not null,
  geom geometry(Polygon, 4326) not null
);
create index zones_geom_idx on zones using gist (geom);

-- Una cuadra: tramo de calle entre dos esquinas.
create table segments (
  id           bigint primary key,
  osm_way_id   bigint,
  street_name  text not null,
  between_a    text not null,
  between_b    text not null,
  is_avenue    boolean not null default false,
  surface      text not null default 'asphalt',
  is_cobbled   boolean generated always as (surface in ('sett', 'cobblestone', 'paving_stones')) stored,
  zone_id      int not null references zones,
  geom         geometry(LineString, 4326) not null,
  length_m     double precision not null,
  -- Estado derivado (lo mantiene recompute_segment)
  condition    text not null default 'sin_relevar'
               check (condition in ('nueva', 'buena', 'gastada', 'muy_deteriorada', 'sin_relevar')),
  patching     text check (patching in ('pocos', 'bastantes', 'todo_parche')),
  repaved_at   timestamptz,
  rating_count int not null default 0,
  open_pozos   int not null default 0,
  open_parches int not null default 0,
  issue_score  double precision not null default 0,
  updated_at   timestamptz not null default now()
);
create index segments_geom_idx on segments using gist (geom);
create index segments_zone_idx on segments (zone_id);

-- Estados de moderación comunes a todos los aportes. Solo 'activo' cuenta.
create domain contribution_state as text
  check (value in ('pendiente', 'activo', 'en_revision', 'oculto'));

create table segment_ratings (
  segment_id       bigint not null references segments,
  voter_hash       text not null,              -- HMAC(secreto, device | segment:id)
  rating           text not null check (rating in ('buena', 'gastada', 'muy_deteriorada')),
  patching         text check (patching in ('pocos', 'bastantes', 'todo_parche')),
  on_site          boolean not null default false,
  state            contribution_state not null default 'pendiente',
  contributor_hash text,                       -- temporal: se pone en NULL al promover
  created_at       timestamptz not null default now(),
  primary key (segment_id, voter_hash)
);

create table segment_events (
  id               bigint generated always as identity primary key,
  segment_id       bigint not null references segments,
  voter_hash       text not null,
  type             text not null check (type in ('repavimentada', 'es_empedrado')),
  approx_date      date,
  state            contribution_state not null default 'pendiente',
  contributor_hash text,
  created_at       timestamptz not null default now(),
  unique (segment_id, voter_hash, type)
);

-- Problemas puntuales: pozos y parches mal hechos.
create table issues (
  id               uuid primary key default gen_random_uuid(),
  reporter_hash    text not null,              -- HMAC(secreto, device | issue:id)
  kind             text not null check (kind in ('pozo', 'parche')),
  parche_type      text check (parche_type in ('elevado', 'hundido', 'desarmado')),
  origin_issue_id  uuid references issues,     -- parche creado al "arreglar mal" un pozo
  severity         smallint not null check (severity between 1 and 3),
  geom             geometry(Point, 4326) not null, -- ubicación del PROBLEMA, no de la persona
  segment_id       bigint not null references segments,
  photo_path       text,
  photo_approved   boolean not null default false,
  state            contribution_state not null default 'pendiente',
  contributor_hash text,
  created_at       timestamptz not null default now(),
  -- Derivados (los mantiene recompute_issue)
  verified         boolean not null default false,
  status           text not null default 'abierto' check (status in ('abierto', 'resuelto', 'oculto')),
  resolved_at      timestamptz,
  fix_quality      text check (fix_quality in ('bien', 'parche_malo')),
  sigue_votes      int not null default 0,
  check ((kind = 'parche') = (parche_type is not null))
);
create index issues_geom_idx on issues using gist (geom);
create index issues_segment_idx on issues (segment_id);

create table issue_votes (
  issue_id         uuid not null references issues on delete cascade,
  voter_hash       text not null,              -- mismo HMAC que el del reporte → detecta autoconfirmación
  vote             text not null check (vote in ('sigue', 'arreglado', 'falso')),
  fix_quality      text check (fix_quality in ('bien', 'parche_malo')),
  mature           boolean not null default false, -- sesión con ≥ 24 h
  state            contribution_state not null default 'pendiente',
  contributor_hash text,
  created_at       timestamptz not null default now(),
  primary key (issue_id, voter_hash),
  check (vote = 'arreglado' or fix_quality is null)
);

-- Contador de vecinos: una fila por dispositivo y NINGUNA referencia a cuadras o problemas.
create table contributors (
  device_hash      text primary key,           -- HMAC(secreto, device | contributor)
  first_day        date not null,
  rated            boolean not null default false,
  rated_on_site    boolean not null default false,
  reported_issue   boolean not null default false
);

-- Contadores de rate limit. Se vacían todos los días.
create table counters (
  key   text primary key,
  count int not null default 0,
  day   date not null default current_date
);

-- Una fila por día y ámbito (zone_id 0 = casco completo).
create table stats_snapshots (
  day     date not null,
  zone_id int not null default 0,
  kpis    jsonb not null,
  primary key (day, zone_id)
);

-- Bitácora PÚBLICA de moderación.
create table moderation_log (
  id     bigint generated always as identity primary key,
  at     timestamptz not null default now(),
  action text not null,
  count  int not null,
  area   text not null,
  reason text not null
);

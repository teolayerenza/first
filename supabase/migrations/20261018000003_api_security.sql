-- Pocitos LP · API pública (vistas de solo lectura) y RPC de escritura (solo service_role).
-- Reglas: `anon` y `authenticated` NO pueden leer tablas ni ejecutar funciones; solo leen las vistas,
-- que nunca exponen columnas de hash. Toda escritura pasa por la Edge Function `submit`.

-- PostGIS vive en el esquema `extensions`: hay que incluirlo en el search_path de la migración.
set search_path = public, extensions;

-- ─── RPC para la Edge Function ──────────────────────────────────────────────────────────

create or replace function rpc_inside_casco(p_lng float8, p_lat float8) returns boolean
language sql stable set search_path = public, extensions, pg_temp as $$
  select coalesce((select st_within(st_setsrid(st_makepoint(p_lng, p_lat), 4326), geom) from casco), false)
$$;

create or replace function rpc_snap(p_lng float8, p_lat float8, p_max_m float8)
returns table (segment_id bigint, distance_m float8)
language sql stable set search_path = public, extensions, pg_temp as $$
  with pt as (select st_setsrid(st_makepoint(p_lng, p_lat), 4326) as g),
  near as (
    select s.id, st_distance(s.geom::geography, pt.g::geography) as d
      from segments s, pt order by s.geom <-> pt.g limit 8
  )
  select id, d from near where d <= p_max_m order by d limit 1
$$;

create or replace function rpc_nearby_open_issues(p_lng float8, p_lat float8, p_radius_m float8)
returns table (id uuid, kind text, distance_m float8)
language sql stable set search_path = public, extensions, pg_temp as $$
  with pt as (select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g)
  select i.id, i.kind, st_distance(i.geom::geography, pt.g)
    from issues i, pt
   where i.status = 'abierto' and i.state in ('pendiente', 'activo')
     and st_dwithin(i.geom::geography, pt.g, p_radius_m)
$$;

create or replace function rpc_bump_counter(p_key text) returns int
language sql set search_path = public, extensions, pg_temp as $$
  insert into counters as c (key, count) values (p_key, 1)
  on conflict (key) do update set count = c.count + 1
  returning count
$$;

create or replace function rpc_segment_exists(p_id bigint) returns boolean
language sql stable set search_path = public, extensions, pg_temp as $$
  select exists (select 1 from segments where id = p_id)
$$;

create or replace function rpc_issue_exists(p_id uuid) returns boolean
language sql stable set search_path = public, extensions, pg_temp as $$
  select exists (select 1 from issues where id = p_id and status <> 'oculto')
$$;

create or replace function rpc_insert_rating(p_segment_id bigint, p_voter_hash text, p_contributor_hash text,
                                             p_rating text, p_patching text, p_on_site boolean) returns void
language sql set search_path = public, extensions, pg_temp as $$
  -- Un voto vigente por dispositivo y cuadra: el nuevo reemplaza al anterior.
  insert into segment_ratings (segment_id, voter_hash, contributor_hash, rating, patching, on_site, state, created_at)
  values (p_segment_id, p_voter_hash, p_contributor_hash, p_rating, p_patching, p_on_site, 'pendiente', now())
  on conflict (segment_id, voter_hash) do update set
    rating = excluded.rating, patching = excluded.patching, on_site = excluded.on_site,
    contributor_hash = excluded.contributor_hash, state = 'pendiente', created_at = now()
$$;

create or replace function rpc_insert_segment_event(p_segment_id bigint, p_voter_hash text, p_contributor_hash text,
                                                    p_type text, p_approx_date date) returns void
language sql set search_path = public, extensions, pg_temp as $$
  insert into segment_events (segment_id, voter_hash, contributor_hash, type, approx_date)
  values (p_segment_id, p_voter_hash, p_contributor_hash, p_type, p_approx_date)
  on conflict (segment_id, voter_hash, type) do nothing
$$;

create or replace function rpc_insert_issue(p_id uuid, p_reporter_hash text, p_contributor_hash text, p_kind text,
                                            p_parche_type text, p_severity smallint, p_lng float8, p_lat float8,
                                            p_segment_id bigint, p_photo_path text) returns void
language sql set search_path = public, extensions, pg_temp as $$
  insert into issues (id, reporter_hash, contributor_hash, kind, parche_type, severity, geom, segment_id, photo_path)
  values (p_id, p_reporter_hash, p_contributor_hash, p_kind, p_parche_type, p_severity,
          st_setsrid(st_makepoint(p_lng, p_lat), 4326), p_segment_id, p_photo_path)
$$;

create or replace function rpc_insert_vote(p_issue_id uuid, p_voter_hash text, p_contributor_hash text,
                                           p_vote text, p_fix_quality text, p_mature boolean) returns void
language sql set search_path = public, extensions, pg_temp as $$
  insert into issue_votes (issue_id, voter_hash, contributor_hash, vote, fix_quality, mature)
  values (p_issue_id, p_voter_hash, p_contributor_hash, p_vote, p_fix_quality, p_mature)
  on conflict (issue_id, voter_hash) do update set
    vote = excluded.vote, fix_quality = excluded.fix_quality, mature = excluded.mature,
    contributor_hash = excluded.contributor_hash, state = 'pendiente', created_at = now()
$$;

-- ─── Consultas públicas de solo lectura (para los formularios) ─────────────────────────

create or replace function public_nearest_segment(p_lng float8, p_lat float8)
returns table (id bigint, label text, condition text, distance_m float8)
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  with pt as (select st_setsrid(st_makepoint(p_lng, p_lat), 4326) as g),
  near as (
    select s.id, s.street_name || ' e/ ' || s.between_a || ' y ' || s.between_b as label, s.condition,
           st_distance(s.geom::geography, pt.g::geography) as d
      from segments s, pt
     where (select st_within(pt.g, c.geom) from casco c)
     order by s.geom <-> pt.g limit 8
  )
  select id, label, condition, d from near where d <= 60 order by d limit 1
$$;

create or replace function public_adjacent_segments(p_id bigint)
returns table (id bigint, label text, condition text)
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select n.id, n.street_name || ' e/ ' || n.between_a || ' y ' || n.between_b, n.condition
    from segments s join segments n on n.id <> s.id and st_dwithin(s.geom::geography, n.geom::geography, 2)
   where s.id = p_id and not n.is_cobbled
   order by (n.condition = 'sin_relevar') desc, n.id
   limit 6
$$;

-- ─── Serie mensual ──────────────────────────────────────────────────────────────────────

create or replace function series_json(p_zone int default 0) returns jsonb
language sql stable set search_path = public, extensions, pg_temp as $$
  with months as (
    select to_char(d, 'YYYY-MM') as m from generate_series(
      date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') d
  ),
  snap as (
    select to_char(day, 'YYYY-MM') as m, (array_agg(kpis order by day desc))[1] as k
      from stats_snapshots where zone_id = p_zone and day > current_date - 400 group by 1
  ),
  iss as (
    select i.* from issues i join segments s on s.id = i.segment_id
     where i.kind = 'pozo' and i.verified and i.status <> 'oculto' and (p_zone = 0 or s.zone_id = p_zone)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'month', months.m,
    'pctMuyDeteriorada', coalesce((snap.k -> 'pct' ->> 'muy_deteriorada')::numeric, 0),
    'pctNueva', coalesce((snap.k -> 'pct' ->> 'nueva')::numeric, 0),
    'pctSurveyed', coalesce((snap.k ->> 'pctSurveyed')::numeric, 0),
    'newPozos', (select count(*) from iss where to_char(created_at, 'YYYY-MM') = months.m),
    'resolvedPozos', (select count(*) from iss where to_char(resolved_at, 'YYYY-MM') = months.m)
  ) order by months.m), '[]'::jsonb)
  from months left join snap on snap.m = months.m
$$;

-- ─── Vistas públicas (sin hashes, sin datos de dispositivos) ────────────────────────────

create or replace view v_casco as
  select st_asgeojson(geom)::jsonb as geometry from casco;

create or replace view v_zones as
  select id, slug, name, st_asgeojson(geom)::jsonb as geometry from zones;

create or replace view v_segments as
  select id, street_name || ' e/ ' || between_a || ' y ' || between_b as label, street_name, between_a, between_b,
         zone_id, condition, patching, is_cobbled as cobbled, open_pozos, open_parches, issue_score as score,
         length_m, rating_count, repaved_at, st_asgeojson(geom, 7)::jsonb as geometry
    from segments;

create or replace view v_issues as
  select id, kind, parche_type, severity, verified, segment_id, status, sigue_votes,
         floor(extract(epoch from (now() - created_at)) / 86400)::int as days,
         st_x(geom) as lng, st_y(geom) as lat,
         case when photo_approved then photo_path end as photo_path
    from issues
   where state = 'activo' and status in ('abierto', 'resuelto');

create or replace view v_kpis as
  select 0 as zone_id, kpis_json(0) as kpis
  union all
  select id, kpis_json(id) from zones;

create or replace view v_kpis_previous as
  select zone_id, kpis from stats_snapshots where day = current_date - 30;

create or replace view v_series as
  select 0 as zone_id, series_json(0) as series
  union all
  select id, series_json(id) from zones;

create or replace view v_contributors as
  select count(*) as total,
         count(*) filter (where first_day >= current_date - 7) as new_7d,
         count(*) filter (where rated_on_site) as rated_on_site,
         count(*) filter (where reported_issue) as reported_issue
    from contributors;

create or replace view v_moderation_log as
  select at, action, count, area, reason from moderation_log order by at desc limit 50;

-- ─── Permisos ───────────────────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
-- Sin políticas: nadie salvo el dueño (y service_role, que saltea RLS) accede a las tablas.

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
-- Las vistas llaman a estas dos funciones; corren como su dueño y solo devuelven agregados.
alter function kpis_json(int) security definer;
alter function series_json(int) security definer;
grant execute on function kpis_json(int), series_json(int) to anon, authenticated;
grant execute on function public_nearest_segment(float8, float8), public_adjacent_segments(bigint) to anon, authenticated;
grant select on v_casco, v_zones, v_segments, v_issues, v_kpis, v_kpis_previous, v_series,
                v_contributors, v_moderation_log to anon, authenticated;

-- Que los objetos nuevos no hereden permisos abiertos por defecto.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

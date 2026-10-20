-- Pocitos LP · lógica de estados, KPIs, promoción de aportes y detector de anomalías.
-- Espejo exacto de src/lib/domain/*.ts (lo verifica tests/sql-parity.test.ts).

-- PostGIS vive en el esquema `extensions`: hay que incluirlo en el search_path de la migración.
set search_path = public, extensions;

create or replace function cfg(p_key text) returns numeric
language sql stable set search_path = '' as $$
  select (value #>> '{}')::numeric from public.config where key = p_key
$$;

create or replace function severity_weight(p_severity smallint) returns numeric
language sql stable set search_path = '' as $$
  select (value ->> p_severity::text)::numeric from public.config where key = 'severityWeights'
$$;

-- ─── Estado de una cuadra ────────────────────────────────────────────────────────────────

create or replace function recompute_segment(p_segment_id bigint) returns void
language plpgsql set search_path = '' as $$
declare
  v_win      interval := make_interval(days => public.cfg('conditionWindowDays')::int);
  v_min_w    numeric  := public.cfg('minRatingWeight');
  v_onsite_w numeric  := public.cfg('onSiteWeight');
  v_rep_voters int;
  v_rep_at   timestamptz;
  v_cond     text;
  v_patch    text;
  v_count    int;
  v_pozos    int;
  v_parches  int;
  v_weight   numeric;
  v_len      double precision;
begin
  -- Empedrado confirmado por ≥ cobbledConfirmations dispositivos.
  if (select count(distinct voter_hash) from public.segment_events
       where segment_id = p_segment_id and type = 'es_empedrado' and state = 'activo') >= public.cfg('cobbledConfirmations') then
    update public.segments set surface = 'sett' where id = p_segment_id and not is_cobbled;
  end if;

  select count(*) into v_count from public.segment_ratings
   where segment_id = p_segment_id and state = 'activo' and created_at >= now() - v_win and created_at <= now();

  select count(distinct voter_hash),
         percentile_disc(0.5) within group (order by coalesce(approx_date::timestamptz, created_at))
    into v_rep_voters, v_rep_at
    from public.segment_events
   where segment_id = p_segment_id and type = 'repavimentada' and state = 'activo'
     and coalesce(approx_date::timestamptz, created_at) >= now() - v_win
     and coalesce(approx_date::timestamptz, created_at) <= now();

  if v_rep_voters >= public.cfg('repavedConfirmations') then
    v_cond := 'nueva';
    v_patch := null;
  else
    v_rep_at := null;
    -- Moda ponderada; ante empate gana la peor opción.
    select t.rating into v_cond from (
      select r.rating, sum(case when r.on_site then v_onsite_w else 1 end) as w,
             case r.rating when 'buena' then 1 when 'gastada' then 2 else 3 end as ord
        from public.segment_ratings r
       where r.segment_id = p_segment_id and r.state = 'activo'
         and r.created_at >= now() - v_win and r.created_at <= now()
       group by r.rating
    ) t where t.w >= v_min_w order by t.w desc, t.ord desc limit 1;

    select t.patching into v_patch from (
      select r.patching, sum(case when r.on_site then v_onsite_w else 1 end) as w,
             case r.patching when 'ninguno' then 0 when 'pocos' then 1 when 'bastantes' then 2 else 3 end as ord
        from public.segment_ratings r
       where r.segment_id = p_segment_id and r.state = 'activo' and r.patching is not null
         and r.created_at >= now() - v_win and r.created_at <= now()
       group by r.patching
    ) t where t.w >= v_min_w order by t.w desc, t.ord desc limit 1;
  end if;

  select count(*) filter (where kind = 'pozo'), count(*) filter (where kind = 'parche'),
         coalesce(sum(public.severity_weight(severity)), 0)
    into v_pozos, v_parches, v_weight
    from public.issues
   where segment_id = p_segment_id and verified and status = 'abierto';

  select length_m into v_len from public.segments where id = p_segment_id;

  update public.segments set
    condition    = coalesce(v_cond, 'sin_relevar'),
    patching     = v_patch,
    repaved_at   = v_rep_at,
    rating_count = v_count,
    open_pozos   = v_pozos,
    open_parches = v_parches,
    issue_score  = round((v_weight / (v_len / 100))::numeric, 2),
    updated_at   = now()
  where id = p_segment_id;
end $$;

-- ─── Estado de un problema ───────────────────────────────────────────────────────────────

create or replace function recompute_issue(p_issue_id uuid) returns void
language plpgsql set search_path = '' as $$
declare
  i          public.issues%rowtype;
  v_sigue    int;
  v_falso    int;
  v_fixed    int;
  v_bad      int;
  v_good     int;
  v_mature   boolean;
  v_status   text;
  v_resolved timestamptz;
  v_fq       text;
begin
  select * into i from public.issues where id = p_issue_id;
  if not found then return; end if;

  select count(*) filter (where vote = 'sigue'),
         count(*) filter (where vote = 'falso'),
         count(*) filter (where vote = 'arreglado'),
         count(*) filter (where vote = 'arreglado' and fix_quality = 'parche_malo'),
         count(*) filter (where vote = 'arreglado' and fix_quality = 'bien'),
         coalesce(bool_or(vote = 'sigue' and mature), false)
    into v_sigue, v_falso, v_fixed, v_bad, v_good, v_mature
    from public.issue_votes
   where issue_id = p_issue_id and state = 'activo' and voter_hash <> i.reporter_hash and created_at <= now();

  if i.state <> 'activo' or v_falso >= public.cfg('hideVotes') then
    v_status := 'oculto';
  elsif v_fixed >= public.cfg('resolveVotes') then
    v_status := 'resuelto';
    select created_at into v_resolved from public.issue_votes
     where issue_id = p_issue_id and state = 'activo' and voter_hash <> i.reporter_hash and vote = 'arreglado'
       and created_at <= now()
     order by created_at offset (public.cfg('resolveVotes')::int - 1) limit 1;
    v_fq := case when v_bad + v_good = 0 then null when v_bad >= v_good then 'parche_malo' else 'bien' end;
  else
    v_status := 'abierto';
  end if;

  update public.issues set
    verified    = i.photo_path is not null or i.origin_issue_id is not null or v_mature,
    -- La foto se publica recién cuando otra persona confirmó el problema.
    photo_approved = i.photo_path is not null and v_mature,
    status      = v_status,
    resolved_at = v_resolved,
    fix_quality = v_fq,
    sigue_votes = v_sigue
  where id = p_issue_id;

  -- Arreglo mal hecho: el pozo se resuelve y en el mismo punto nace un parche.
  if v_status = 'resuelto' and v_fq = 'parche_malo' and i.kind = 'pozo'
     and not exists (select 1 from public.issues where origin_issue_id = p_issue_id) then
    insert into public.issues (reporter_hash, kind, parche_type, origin_issue_id, severity, geom, segment_id,
                               state, verified, status, created_at)
    values (i.reporter_hash, 'parche', 'elevado', p_issue_id, 2, i.geom, i.segment_id,
            'activo', true, 'abierto', coalesce(v_resolved, now()));
  end if;

  perform public.recompute_segment(i.segment_id);
end $$;

create or replace function recompute_all() returns void
language plpgsql set search_path = '' as $$
declare r record;
begin
  for r in select id from public.issues where origin_issue_id is null loop
    perform public.recompute_issue(r.id);
  end loop;
  for r in select id from public.issues where origin_issue_id is not null loop
    perform public.recompute_issue(r.id);
  end loop;
  for r in select id from public.segments loop
    perform public.recompute_segment(r.id);
  end loop;
end $$;

-- ─── KPIs (misma forma que el tipo `Kpis` de TypeScript) ─────────────────────────────────

create or replace function kpis_json(p_zone int default 0) returns jsonb
language sql stable set search_path = '' as $$
with seg as (
  select * from public.segments where p_zone = 0 or zone_id = p_zone
),
agg as (
  select
    coalesce(sum(length_m), 0) / 1000 as km_total,
    coalesce(sum(length_m) filter (where is_cobbled), 0) / 1000 as km_cobbled,
    coalesce(sum(length_m) filter (where not is_cobbled and condition = 'nueva'), 0) / 1000 as k_nueva,
    coalesce(sum(length_m) filter (where not is_cobbled and condition = 'buena'), 0) / 1000 as k_buena,
    coalesce(sum(length_m) filter (where not is_cobbled and condition = 'gastada'), 0) / 1000 as k_gastada,
    coalesce(sum(length_m) filter (where not is_cobbled and condition = 'muy_deteriorada'), 0) / 1000 as k_muy,
    coalesce(sum(length_m) filter (where not is_cobbled and condition = 'sin_relevar'), 0) / 1000 as k_sin,
    count(*) filter (where not is_cobbled and condition = 'nueva') as c_nueva,
    count(*) filter (where not is_cobbled and condition = 'buena') as c_buena,
    count(*) filter (where not is_cobbled and condition = 'gastada') as c_gastada,
    count(*) filter (where not is_cobbled and condition = 'muy_deteriorada') as c_muy,
    count(*) filter (where not is_cobbled and condition = 'sin_relevar') as c_sin,
    coalesce(sum(length_m) filter (where not is_cobbled and patching = 'todo_parche'), 0) / 1000 as k_todo,
    coalesce(sum(rating_count), 0) as ratings
  from seg
),
base as (
  select a.*, a.km_total - a.km_cobbled as km_asphalt from agg a
),
iss as (
  select i.*, s.street_name, s.between_a, s.between_b
    from public.issues i join seg s on s.id = i.segment_id
),
ver as (
  select * from iss where verified and status <> 'oculto'
),
repair as (
  select extract(epoch from (resolved_at - created_at)) / 86400 as d
    from ver
   where kind = 'pozo' and resolved_at >= now() - make_interval(days => public.cfg('repairWindowDays')::int)
),
quality as (
  select count(*) as n, count(*) filter (where fix_quality = 'parche_malo') as bad
    from ver
   where kind = 'pozo' and fix_quality is not null
     and resolved_at >= now() - make_interval(days => public.cfg('repairWindowDays')::int)
),
oldest as (
  select id, street_name, between_a, between_b,
         floor(extract(epoch from (now() - created_at)) / 86400)::int as days
    from ver where kind = 'pozo' and status = 'abierto'
   order by created_at asc limit 1
),
stats as (
  select
    count(*) filter (where kind = 'pozo' and status = 'abierto') as open_pozos,
    count(*) filter (where kind = 'parche' and status = 'abierto') as open_parches,
    count(*) filter (where kind = 'pozo' and created_at >= now() - interval '30 days') as new30,
    count(*) filter (where kind = 'pozo' and resolved_at >= now() - interval '30 days') as res30
  from ver
)
select jsonb_build_object(
  'asOf', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'scope', jsonb_build_object('zoneId', nullif(p_zone, 0)),
  'km', jsonb_build_object(
    'nueva', round(b.k_nueva::numeric, 1), 'buena', round(b.k_buena::numeric, 1),
    'gastada', round(b.k_gastada::numeric, 1), 'muy_deteriorada', round(b.k_muy::numeric, 1),
    'sin_relevar', round(b.k_sin::numeric, 1)),
  'cuadras', jsonb_build_object(
    'nueva', b.c_nueva, 'buena', b.c_buena, 'gastada', b.c_gastada,
    'muy_deteriorada', b.c_muy, 'sin_relevar', b.c_sin),
  'pct', jsonb_build_object(
    'nueva', case when b.km_asphalt > 0 then round((b.k_nueva / b.km_asphalt * 100)::numeric, 1) else 0 end,
    'buena', case when b.km_asphalt > 0 then round((b.k_buena / b.km_asphalt * 100)::numeric, 1) else 0 end,
    'gastada', case when b.km_asphalt > 0 then round((b.k_gastada / b.km_asphalt * 100)::numeric, 1) else 0 end,
    'muy_deteriorada', case when b.km_asphalt > 0 then round((b.k_muy / b.km_asphalt * 100)::numeric, 1) else 0 end,
    'sin_relevar', case when b.km_asphalt > 0 then round((b.k_sin / b.km_asphalt * 100)::numeric, 1) else 0 end),
  'kmAsphalt', round(b.km_asphalt::numeric, 1),
  'kmTotal', round(b.km_total::numeric, 1),
  'kmCobbled', round(b.km_cobbled::numeric, 1),
  'cuadrasAsphalt', b.c_nueva + b.c_buena + b.c_gastada + b.c_muy + b.c_sin,
  'pctCobbled', case when b.km_total > 0 then round((b.km_cobbled / b.km_total * 100)::numeric, 1) else 0 end,
  'pctSurveyed', case when b.km_asphalt > 0 then round(((b.km_asphalt - b.k_sin) / b.km_asphalt * 100)::numeric, 1) else 0 end,
  'pctTodoParche', case when b.km_asphalt > 0 then round((b.k_todo / b.km_asphalt * 100)::numeric, 1) else 0 end,
  'contributions', b.ratings + (select count(*) from iss where state = 'activo'),
  'issues', jsonb_build_object(
    'openPozos', st.open_pozos,
    'openParches', st.open_parches,
    'pozosPerKm', case when b.km_asphalt > 0 then round((st.open_pozos / b.km_asphalt)::numeric, 1) else 0 end,
    'parchesPerKm', case when b.km_asphalt > 0 then round((st.open_parches / b.km_asphalt)::numeric, 1) else 0 end,
    'newPozos30d', st.new30,
    'resolvedPozos30d', st.res30,
    'avgRepairDays', (select round(avg(d)::numeric) from repair),
    'medianRepairDays', (select round(((array_agg(d order by d))[floor(count(*) / 2)::int + 1])::numeric) from repair),
    'oldestOpen', (select jsonb_build_object('id', o.id, 'label', o.street_name || ' e/ ' || o.between_a || ' y ' || o.between_b, 'days', o.days) from oldest o),
    'badFixRatePct', (select case when q.n > 0 then round(q.bad::numeric / q.n * 100) end from quality q),
    'badFixSample', (select q.n from quality q)
  )
)
from base b, stats st
$$;

create or replace function take_snapshot() returns void
language plpgsql set search_path = '' as $$
begin
  insert into public.stats_snapshots (day, zone_id, kpis)
  select current_date, z, public.kpis_json(z) from (select 0 as z union all select id from public.zones) zs
  on conflict (day, zone_id) do update set kpis = excluded.kpis;
end $$;

-- ─── Promoción de aportes pendientes + detector de anomalías (docs/SEGURIDAD.md §3) ─────

create or replace view pending_contributions as
  select 'rating' as tbl, r.segment_id, s.zone_id, r.created_at, false as immature
    from segment_ratings r join segments s on s.id = r.segment_id where r.state = 'pendiente'
  union all
  select 'event', e.segment_id, s.zone_id, e.created_at, false
    from segment_events e join segments s on s.id = e.segment_id where e.state = 'pendiente'
  union all
  select 'issue', i.segment_id, s.zone_id, i.created_at, false
    from issues i join segments s on s.id = i.segment_id where i.state = 'pendiente'
  union all
  select 'vote', i.segment_id, s.zone_id, v.created_at, not v.mature
    from issue_votes v join issues i on i.id = v.issue_id join segments s on s.id = i.segment_id
   where v.state = 'pendiente';

create or replace function set_state_in_zone(p_zone int, p_from text, p_to text) returns int
language plpgsql set search_path = '' as $$
declare n int := 0; k int;
begin
  update public.segment_ratings r set state = p_to from public.segments s
   where s.id = r.segment_id and r.state = p_from and (p_zone is null or s.zone_id = p_zone);
  get diagnostics k = row_count; n := n + k;
  update public.segment_events e set state = p_to from public.segments s
   where s.id = e.segment_id and e.state = p_from and (p_zone is null or s.zone_id = p_zone);
  get diagnostics k = row_count; n := n + k;
  update public.issue_votes v set state = p_to from public.issues i, public.segments s
   where i.id = v.issue_id and s.id = i.segment_id and v.state = p_from and (p_zone is null or s.zone_id = p_zone);
  get diagnostics k = row_count; n := n + k;
  update public.issues i set state = p_to from public.segments s
   where s.id = i.segment_id and i.state = p_from and (p_zone is null or s.zone_id = p_zone);
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;

-- Aviso de "hay datos nuevos" para el tiempo real. En Supabase lo redefine la migración _ops
-- para emitir un broadcast en el canal público "pocitos" (sin datos de nadie, solo la hora).
create or replace function notify_update() returns void
language plpgsql set search_path = '' as $$
begin
end $$;

create or replace function promote_pending() returns int
language plpgsql set search_path = '' as $$
declare
  v_recent  int;
  v_avg     numeric;
  v_held    int;
  z         record;
  v_segs    bigint[];
  v_issues  uuid[];
  v_n       int := 0;
  v_row     record;
begin
  -- 1. Freno global: si el volumen se dispara, todo queda en revisión y se alerta.
  select count(*) into v_recent from public.pending_contributions where created_at > now() - interval '1 hour';
  select count(*)::numeric / (14 * 24) into v_avg from public.segment_ratings
   where state = 'activo' and created_at > now() - interval '14 days';
  if v_recent > greatest(public.cfg('anomalyGlobalMinPerHour'), public.cfg('anomalyGlobalFactor') * v_avg) then
    v_held := public.set_state_in_zone(null, 'pendiente', 'en_revision');
    insert into public.moderation_log (action, count, area, reason)
    values ('En revisión automática', v_held, 'Todo el casco', 'Volumen de aportes muy por encima de lo normal.');
    return 0;
  end if;

  -- 2. Por zona: ráfagas o mayoría de sesiones recién creadas.
  for z in
    select p.zone_id, count(*) as n, count(*) filter (where p.immature) as immature
      from public.pending_contributions p group by p.zone_id
  loop
    select count(*)::numeric / (14 * 24) into v_avg
      from public.segment_ratings r join public.segments s on s.id = r.segment_id
     where s.zone_id = z.zone_id and r.state = 'activo' and r.created_at > now() - interval '14 days';
    if z.n > greatest(public.cfg('anomalyZoneMinPerHour'), public.cfg('anomalyZoneFactor') * v_avg)
       or (z.immature >= public.cfg('anomalyImmatureMin')
           and z.immature::numeric / z.n >= public.cfg('anomalyImmatureShare')) then
      v_held := public.set_state_in_zone(z.zone_id, 'pendiente', 'en_revision');
      insert into public.moderation_log (action, count, area, reason)
      select 'En revisión automática', v_held, 'Zona ' || name, 'Volumen inusual de aportes en poco tiempo.'
        from public.zones where id = z.zone_id;
    end if;
  end loop;

  -- 3. Contador de vecinos (antes de borrar el vínculo temporal con el dispositivo).
  insert into public.contributors as c (device_hash, first_day, rated, rated_on_site, reported_issue)
  select contributor_hash, min(created_at)::date, bool_or(rated), bool_or(on_site), bool_or(issue)
    from (
      select contributor_hash, created_at, true as rated, on_site, false as issue
        from public.segment_ratings where state = 'pendiente' and contributor_hash is not null
      union all
      select contributor_hash, created_at, true, false, false
        from public.segment_events where state = 'pendiente' and contributor_hash is not null
      union all
      select contributor_hash, created_at, false, false, true
        from public.issues where state = 'pendiente' and contributor_hash is not null
      union all
      select contributor_hash, created_at, false, false, true
        from public.issue_votes where state = 'pendiente' and contributor_hash is not null
    ) x group by contributor_hash
  on conflict (device_hash) do update set
    first_day      = least(c.first_day, excluded.first_day),
    rated          = c.rated or excluded.rated,
    rated_on_site  = c.rated_on_site or excluded.rated_on_site,
    reported_issue = c.reported_issue or excluded.reported_issue;

  -- 4. Promover. Se borra el vínculo con el dispositivo y se redondea la hora de las calificaciones.
  with up as (
    update public.segment_ratings set state = 'activo', contributor_hash = null,
           created_at = date_trunc('hour', created_at)
     where state = 'pendiente' returning segment_id
  ) select array_agg(distinct segment_id) into v_segs from up;
  get diagnostics v_n = row_count;

  with up as (
    update public.segment_events set state = 'activo', contributor_hash = null,
           created_at = date_trunc('hour', created_at)
     where state = 'pendiente' returning segment_id
  ) select array_cat(v_segs, array_agg(distinct segment_id)) into v_segs from up;

  with up as (
    update public.issues set state = 'activo', contributor_hash = null where state = 'pendiente' returning id
  ) select array_agg(id) into v_issues from up;

  with up as (
    update public.issue_votes set state = 'activo', contributor_hash = null where state = 'pendiente' returning issue_id
  ) select array_cat(v_issues, array_agg(distinct issue_id)) into v_issues from up;

  for v_row in select distinct unnest(v_issues) as id loop
    perform public.recompute_issue(v_row.id);
  end loop;
  for v_row in select distinct unnest(v_segs) as id loop
    perform public.recompute_segment(v_row.id);
  end loop;

  -- Por las dudas: ningún vínculo temporal sobrevive a la promoción.
  update public.segment_ratings set contributor_hash = null where state <> 'pendiente' and contributor_hash is not null;
  update public.segment_events set contributor_hash = null where state <> 'pendiente' and contributor_hash is not null;
  update public.issues set contributor_hash = null where state <> 'pendiente' and contributor_hash is not null;
  update public.issue_votes set contributor_hash = null where state <> 'pendiente' and contributor_hash is not null;

  if v_segs is not null or v_issues is not null then
    perform public.notify_update();
  end if;

  return coalesce(array_length(v_segs, 1), 0) + coalesce(array_length(v_issues, 1), 0);
end $$;

-- ─── Moderación (solo service_role / administradores) ───────────────────────────────────

create or replace function moderate_zone(p_zone int, p_from timestamptz, p_to timestamptz,
                                         p_state text, p_reason text) returns int
language plpgsql set search_path = '' as $$
declare n int := 0; k int; r record;
begin
  if p_state not in ('activo', 'oculto') then raise exception 'estado inválido'; end if;
  update public.segment_ratings x set state = p_state from public.segments s
   where s.id = x.segment_id and s.zone_id = p_zone and x.created_at between p_from and p_to and x.state <> p_state;
  get diagnostics k = row_count; n := n + k;
  update public.segment_events x set state = p_state from public.segments s
   where s.id = x.segment_id and s.zone_id = p_zone and x.created_at between p_from and p_to and x.state <> p_state;
  get diagnostics k = row_count; n := n + k;
  update public.issues x set state = p_state from public.segments s
   where s.id = x.segment_id and s.zone_id = p_zone and x.created_at between p_from and p_to and x.state <> p_state;
  get diagnostics k = row_count; n := n + k;
  update public.issue_votes x set state = p_state from public.issues i, public.segments s
   where i.id = x.issue_id and s.id = i.segment_id and s.zone_id = p_zone
     and x.created_at between p_from and p_to and x.state <> p_state;
  get diagnostics k = row_count; n := n + k;

  insert into public.moderation_log (action, count, area, reason)
  select case p_state when 'oculto' then 'Aportes ocultados' else 'Aportes restaurados' end, n, 'Zona ' || name, p_reason
    from public.zones where id = p_zone;

  for r in select i.id from public.issues i join public.segments s on s.id = i.segment_id where s.zone_id = p_zone loop
    perform public.recompute_issue(r.id);
  end loop;
  for r in select id from public.segments where zone_id = p_zone loop
    perform public.recompute_segment(r.id);
  end loop;
  return n;
end $$;

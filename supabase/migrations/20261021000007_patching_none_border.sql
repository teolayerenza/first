-- Parcheo "ninguno" (la cuadra no tiene parches) y cuadra más cercana sin exigir que el punto esté dentro
-- del casco: las avenidas del borde, su mano de afuera y las rotondas quedaban sin cuadra.
alter table public.segments drop constraint segments_patching_check;
alter table public.segments add constraint segments_patching_check
  check (patching in ('ninguno', 'pocos', 'bastantes', 'todo_parche'));
alter table public.segment_ratings drop constraint segment_ratings_patching_check;
alter table public.segment_ratings add constraint segment_ratings_patching_check
  check (patching in ('ninguno', 'pocos', 'bastantes', 'todo_parche'));

create or replace function public.recompute_segment(p_segment_id bigint) returns void
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

create or replace function public.public_nearest_segment(p_lng float8, p_lat float8)
returns table (id bigint, label text, condition text, distance_m float8)
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  with pt as (select st_setsrid(st_makepoint(p_lng, p_lat), 4326) as g),
  near as (
    select s.id, s.street_name || ' e/ ' || s.between_a || ' y ' || s.between_b as label, s.condition,
           st_distance(s.geom::geography, pt.g::geography) as d
      from segments s, pt
     -- Sin exigir que el punto esté dentro del casco: las avenidas del borde (31, 32, 72, 122), su mano
     -- de afuera y las rotondas quedan sobre o apenas fuera del límite. Alcanza con estar a ≤ 60 m de una cuadra.
     order by s.geom <-> pt.g limit 8
  )
  select id, label, condition, d from near where d <= 60 order by d limit 1
$$;

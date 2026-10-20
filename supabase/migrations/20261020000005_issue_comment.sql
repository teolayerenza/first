-- Comentario opcional en pozos y parches: texto libre corto y público ("Hace meses que está así").
-- La Edge Function lo limpia antes de guardarlo (sin teléfonos, mails, links ni @usuarios) y la vista
-- pública solo lo muestra en reportes verificados y no ocultos: con 3 denuncias se oculta el reporte entero.
set search_path = public, extensions;

alter table issues add column if not exists comment text
  check (comment is null or char_length(comment) between 1 and 200);

drop function if exists rpc_insert_issue(uuid, text, text, text, text, smallint, float8, float8, bigint, text);
create function rpc_insert_issue(p_id uuid, p_reporter_hash text, p_contributor_hash text, p_kind text,
                                 p_parche_type text, p_severity smallint, p_lng float8, p_lat float8,
                                 p_segment_id bigint, p_photo_path text, p_comment text default null) returns void
language sql set search_path = public, extensions, pg_temp as $$
  insert into issues (id, reporter_hash, contributor_hash, kind, parche_type, severity, geom, segment_id, photo_path, comment)
  values (p_id, p_reporter_hash, p_contributor_hash, p_kind, p_parche_type, p_severity,
          st_setsrid(st_makepoint(p_lng, p_lat), 4326), p_segment_id, p_photo_path, nullif(trim(p_comment), ''))
$$;
revoke execute on function rpc_insert_issue(uuid, text, text, text, text, smallint, float8, float8, bigint, text, text)
  from public, anon, authenticated;
grant execute on function rpc_insert_issue(uuid, text, text, text, text, smallint, float8, float8, bigint, text, text)
  to service_role;

create or replace view v_issues as
  select id, kind, parche_type, severity, verified, segment_id, status, sigue_votes,
         floor(extract(epoch from (now() - created_at)) / 86400)::int as days,
         st_x(geom) as lng, st_y(geom) as lat,
         case when photo_approved then photo_path end as photo_path,
         comment
    from issues
   where state = 'activo' and status in ('abierto', 'resuelto');

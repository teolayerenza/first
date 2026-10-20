-- Pocitos LP · operación en Supabase (pg_cron, Storage, limpieza). No corre en los tests locales.

-- PostGIS vive en el esquema `extensions`: hay que incluirlo en el search_path de la migración.
set search_path = public, extensions;

create extension if not exists pg_cron;

-- Cada minuto: detector de anomalías + promoción de aportes pendientes.
select cron.schedule('pocitos-promote', '* * * * *', $$select public.promote_pending()$$);

-- Todos los días 03:10 (UTC): snapshot de KPIs, vaciado de contadores y de sesiones viejas.
select cron.schedule('pocitos-daily', '10 3 * * *', $$
  select public.take_snapshot();
  delete from public.counters;
  delete from auth.users where is_anonymous and coalesce(last_sign_in_at, created_at) < now() - interval '30 days';
$$);

-- Bucket público de fotos. Las rutas son UUIDs y la vista v_issues solo publica la ruta cuando
-- otra persona confirmó el problema. Solo la Edge Function (service_role) emite URLs de subida.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 1000000, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

-- Tiempo real: avisa a los navegadores abiertos que hay datos nuevos (broadcast público, sin datos personales).
create or replace function public.notify_update() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(jsonb_build_object('at', now()), 'update', 'pocitos', false);
end $$;

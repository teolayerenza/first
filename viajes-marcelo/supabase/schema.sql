-- Los viajes de Marcelo · esquema de Supabase
-- Correr una sola vez en Supabase → SQL Editor.
-- Sin login: la página usa la clave pública (anon). Quien tenga el link puede ver y editar, así que no lo compartas.

create table if not exists public.trips (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 120),
  date_from   date not null,
  date_to     date,
  difficulty  smallint not null check (difficulty between 1 and 5),
  terrains    text[] not null default '{}',
  notes       text not null default '' check (char_length(notes) <= 5000),
  companions  text not null default '' check (char_length(companions) <= 300),
  -- Recorrido: lista de [lng, lat], en orden.
  route       jsonb not null default '[]'::jsonb,
  distance_km numeric(8, 1) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.trip_photos (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips (id) on delete cascade,
  path       text not null,           -- ruta dentro del bucket "fotos": <trip_id>/<archivo>.jpg
  caption    text not null default '' check (char_length(caption) <= 300),
  lng        double precision,        -- de la foto, si tenía GPS
  lat        double precision,
  taken_at   timestamptz,
  position   smallint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists trips_date on public.trips (date_from desc);
create index if not exists trip_photos_trip on public.trip_photos (trip_id, position);

alter table public.trips enable row level security;
alter table public.trip_photos enable row level security;

drop policy if exists "pagina" on public.trips;
create policy "pagina" on public.trips for all to anon, authenticated using (true) with check (true);
drop policy if exists "pagina" on public.trip_photos;
create policy "pagina" on public.trip_photos for all to anon, authenticated using (true) with check (true);

-- Fotos: bucket privado (se ven con links firmados que vencen), solo imágenes JPEG de hasta 5 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

drop policy if exists "fotos de la pagina" on storage.objects;
create policy "fotos de la pagina" on storage.objects for all to anon, authenticated
  using (bucket_id = 'fotos') with check (bucket_id = 'fotos');

// Postgres + PostGIS en memoria (PGlite) con las migraciones de Supabase aplicadas.
// Simula lo mínimo de Supabase: los roles anon / authenticated / service_role.

import { PGlite } from "@electric-sql/pglite";
import { postgis } from "@electric-sql/pglite-postgis";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Dataset } from "../../src/lib/domain/types";

const MIGRATIONS = path.resolve(__dirname, "../../supabase/migrations");

export async function createDb(): Promise<PGlite> {
  const db = new PGlite({ extensions: { postgis } });
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
    set search_path = public, extensions;
  `);
  for (const file of readdirSync(MIGRATIONS).sort()) {
    if (file.endsWith("_ops.sql")) continue; // pg_cron / storage / auth: solo existen en Supabase
    await db.exec(readFileSync(path.join(MIGRATIONS, file), "utf8"));
  }
  await db.exec(`
    grant usage on schema extensions to anon, authenticated, service_role;
    grant select, insert, update, delete on all tables in schema public to service_role;
  `);
  return db;
}

const json = (x: unknown) => JSON.stringify(x);

/** Carga un Dataset (por ejemplo, el simulado) tal cual, con todos los aportes ya activos. */
export async function loadDataset(db: PGlite, data: Dataset, cascoRing: [number, number][]) {
  await db.query(
    `insert into casco (geom) values (st_setsrid(st_geomfromgeojson($1), 4326))`,
    [json({ type: "Polygon", coordinates: [cascoRing] })],
  );
  await db.query(
    `insert into zones (id, slug, name, geom)
     select (z->>'id')::int, z->>'slug', z->>'name',
            st_setsrid(st_geomfromgeojson(json_build_object('type','Polygon','coordinates', json_build_array(z->'ring'))::text), 4326)
       from jsonb_array_elements($1::jsonb) z`,
    [json(data.zones)],
  );
  await db.query(
    `insert into segments (id, street_name, between_a, between_b, is_avenue, surface, zone_id, geom, length_m)
     select (s->>'id')::bigint, s->>'streetName', s->>'betweenA', s->>'betweenB', (s->>'isAvenue')::boolean,
            case when (s->>'isCobbled')::boolean then 'sett' else 'asphalt' end, (s->>'zoneId')::int,
            st_setsrid(st_geomfromgeojson(json_build_object('type','LineString','coordinates', s->'coords')::text), 4326),
            (s->>'lengthM')::float8
       from jsonb_array_elements($1::jsonb) s`,
    [json(data.segments)],
  );
  await db.query(
    `insert into segment_ratings (segment_id, voter_hash, rating, patching, on_site, state, created_at)
     select (r->>'segmentId')::bigint, r->>'voterHash', r->>'rating', r->>'patching', (r->>'onSite')::boolean,
            r->>'state', (r->>'createdAt')::timestamptz
       from jsonb_array_elements($1::jsonb) r`,
    [json(data.ratings)],
  );
  await db.query(
    `insert into segment_events (segment_id, voter_hash, type, approx_date, state, created_at)
     select (e->>'segmentId')::bigint, e->>'voterHash', e->>'type', (e->>'approxDate')::timestamptz::date,
            e->>'state', (e->>'createdAt')::timestamptz
       from jsonb_array_elements($1::jsonb) e`,
    [json(data.events)],
  );
  await db.query(
    `insert into issues (id, reporter_hash, kind, parche_type, origin_issue_id, severity, geom, segment_id,
                         photo_path, state, created_at)
     select (i->>'id')::uuid, i->>'reporterHash', i->>'kind', i->>'parcheType', (i->>'originIssueId')::uuid,
            (i->>'severity')::smallint,
            st_setsrid(st_makepoint((i->'location'->>0)::float8, (i->'location'->>1)::float8), 4326),
            (i->>'segmentId')::bigint,
            case when (i->>'hasPhoto')::boolean then 'pending/' || (i->>'id') || '.webp' end,
            i->>'state', (i->>'createdAt')::timestamptz
       from jsonb_array_elements($1::jsonb) i
      order by (i->>'originIssueId') nulls first`,
    [json(data.issues)],
  );
  await db.query(
    `insert into issue_votes (issue_id, voter_hash, vote, fix_quality, mature, state, created_at)
     select (v->>'issueId')::uuid, v->>'voterHash', v->>'vote', v->>'fixQuality', (v->>'mature')::boolean,
            v->>'state', (v->>'createdAt')::timestamptz
       from jsonb_array_elements($1::jsonb) v`,
    [json(data.votes)],
  );
  await db.query(`select recompute_all()`);
}

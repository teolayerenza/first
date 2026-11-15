import { useEffect, useRef, useState } from "react";
import { lengthKm } from "../lib/geo";
import { preparePhoto, type PreparedPhoto } from "../lib/photos";
import { searchPlaces, type Place } from "../lib/routing";
import { store } from "../lib/store";
import { DIFFICULTY, TERRAINS, type LngLat, type Trip } from "../lib/types";

export type DrawMode = "mano" | "camino";

interface Props {
  trip: Trip | null;
  route: LngLat[];
  mode: DrawMode;
  busyRoute: boolean;
  routeError: string | null;
  onMode(m: DrawMode): void;
  onAddPoint(at: LngLat): void;
  onUndo(): void;
  onClear(): void;
  onCancel(): void;
  onSaved(): void;
}

const today = () => new Date().toISOString().slice(0, 10);

export function TripEditor({ trip, route, mode, busyRoute, routeError, onMode, onAddPoint, onUndo, onClear, onCancel, onSaved }: Props) {
  const [title, setTitle] = useState(trip?.title ?? "");
  const [dateFrom, setDateFrom] = useState(trip?.date_from ?? today());
  const [dateTo, setDateTo] = useState(trip?.date_to ?? "");
  const [difficulty, setDifficulty] = useState<Trip["difficulty"]>(trip?.difficulty ?? 3);
  const [terrains, setTerrains] = useState<string[]>(trip?.terrains ?? []);
  const [companions, setCompanions] = useState(trip?.companions ?? "");
  const [notes, setNotes] = useState(trip?.notes ?? "");
  const [newPhotos, setNewPhotos] = useState<PreparedPhoto[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  const save = async () => {
    if (!title.trim()) return setError("Ponele un nombre al viaje.");
    if (route.length < 2) return setError("Marcá el recorrido en el mapa (al menos dos puntos).");
    setSaving(true);
    setError(null);
    try {
      await store.save({
        draft: { id: trip?.id, title: title.trim(), date_from: dateFrom, date_to: dateTo || null, difficulty, terrains, companions: companions.trim(), notes: notes.trim(), route },
        newPhotos,
        removedPhotoIds: removed,
        captions,
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const kept = (trip?.photos ?? []).filter((p) => !removed.includes(p.id));

  return (
    <div className="panel-body">
      <div className="panel-head">
        <button className="link" onClick={onCancel}>← Cancelar</button>
        <h2>{trip ? "Editar viaje" : "Nuevo viaje"}</h2>
      </div>

      <section className="block">
        <h3>Recorrido</h3>
        <div className="seg" role="radiogroup" aria-label="Cómo marcar el recorrido">
          <button role="radio" aria-checked={mode === "camino"} className={mode === "camino" ? "on" : ""} onClick={() => onMode("camino")}>Por camino</button>
          <button role="radio" aria-checked={mode === "mano"} className={mode === "mano" ? "on" : ""} onClick={() => onMode("mano")}>A mano</button>
        </div>
        <p className="muted small">
          {mode === "camino"
            ? "Tocá el mapa o buscá un lugar: cada punto se une al anterior siguiendo rutas y caminos."
            : "Tocá el mapa punto por punto: ideal para huellas, playas y tramos sin camino."}{" "}
          Podés combinar los dos modos en el mismo viaje.
        </p>
        <PlaceSearch onPick={(p) => onAddPoint(p.at)} />
        <div className="row">
          <span className="km">{lengthKm(route).toLocaleString("es-AR")} km</span>
          {busyRoute && <span className="muted small">Trazando…</span>}
          <span className="grow" />
          <button className="btn ghost sm" onClick={onUndo} disabled={!route.length}>Deshacer</button>
          <button className="btn ghost sm" onClick={onClear} disabled={!route.length}>Borrar</button>
        </div>
        {routeError && <p className="error small">{routeError}</p>}
      </section>

      <section className="block">
        <label>Nombre del viaje<input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Paso San Francisco y Laguna Verde" /></label>
        <div className="grid2">
          <label>Desde<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} required /></label>
          <label>Hasta <span className="muted">(opcional)</span><input type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} /></label>
        </div>
      </section>

      <section className="block">
        <h3>Dificultad</h3>
        <div className="diffs" role="radiogroup" aria-label="Dificultad">
          {DIFFICULTY.map((d) => (
            <button key={d.n} role="radio" aria-checked={difficulty === d.n} className={difficulty === d.n ? "on" : ""} style={{ ["--c" as string]: d.color }} onClick={() => setDifficulty(d.n)}>
              <b>{d.n}</b>{d.name}
            </button>
          ))}
        </div>
      </section>

      <section className="block">
        <h3>Terreno</h3>
        <div className="chips">
          {TERRAINS.map((t) => (
            <button key={t} aria-pressed={terrains.includes(t)} className={terrains.includes(t) ? "chip on" : "chip"}
              onClick={() => setTerrains((v) => (v.includes(t) ? v.filter((x) => x !== t) : [...v, t]))}>{t}</button>
          ))}
        </div>
      </section>

      <section className="block">
        <label>Acompañantes<input value={companions} maxLength={300} onChange={(e) => setCompanions(e.target.value)} placeholder="Ej.: Teo, Sofi y el Negro" /></label>
        <label>Notas<textarea rows={4} value={notes} maxLength={5000} onChange={(e) => setNotes(e.target.value)} placeholder="Cómo estuvo el camino, dónde cargar nafta, qué tener en cuenta…" /></label>
      </section>

      <section className="block">
        <h3>Fotos</h3>
        <p className="muted small">Si la foto tiene ubicación (GPS del celular), aparece en el mapa donde la sacaste.</p>
        <div className="photo-grid">
          {kept.map((p) => (
            <figure key={p.id}>
              <img src={p.url} alt="" />
              <input aria-label="Descripción de la foto" placeholder="Descripción" defaultValue={p.caption} onChange={(e) => setCaptions((c) => ({ ...c, [p.id]: e.target.value }))} />
              <button className="x" aria-label="Quitar foto" onClick={() => setRemoved((r) => [...r, p.id])}>×</button>
            </figure>
          ))}
          {newPhotos.map((p, i) => (
            <figure key={p.preview}>
              <img src={p.preview} alt="" />
              <span className="small muted">{p.lat != null ? "Con ubicación" : "Sin ubicación"}</span>
              <button className="x" aria-label="Quitar foto" onClick={() => setNewPhotos((v) => v.filter((_, j) => j !== i))}>×</button>
            </figure>
          ))}
          <label className="add-photo">
            <input type="file" accept="image/*" multiple hidden onChange={async (e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              setPreparing(true);
              try {
                const ready = await Promise.all(files.map(preparePhoto));
                setNewPhotos((v) => [...v, ...ready]);
              } finally {
                setPreparing(false);
              }
            }} />
            {preparing ? "Preparando…" : "+ Sumar fotos"}
          </label>
        </div>
      </section>

      {error && <p className="error" role="alert">{error}</p>}
      <div className="sticky-actions">
        <button className="btn primary wide" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar viaje"}</button>
      </div>
    </div>
  );
}

function PlaceSearch({ onPick }: { onPick(p: Place): void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => {
    if (q.trim().length < 3) return setResults([]);
    const t = setTimeout(async () => {
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      try {
        setResults(await searchPlaces(q.trim(), ctrl.current.signal));
      } catch {
        // búsqueda cancelada o sin red
      }
    }, 450);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="search">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar un lugar (pueblo, paso, laguna…)" />
      {results.length > 0 && (
        <ul>
          {results.map((r, i) => (
            <li key={i}>
              <button onClick={() => { onPick(r); setQ(""); setResults([]); }}>
                <b>{r.name}</b><span>{r.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

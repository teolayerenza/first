import { useMemo, useState } from "react";
import { DIFFICULTY, diff, type Photo, type Trip } from "../lib/types";
import { Logo } from "./Logo";

const fmtDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
const dates = (t: Trip) => (t.date_to && t.date_to !== t.date_from ? `${fmtDate(t.date_from)} – ${fmtDate(t.date_to)}` : fmtDate(t.date_from));
const km = (n: number) => `${Math.round(n).toLocaleString("es-AR")} km`;

export function TripList({ trips, demo, onOpen, onNew }: { trips: Trip[]; demo: boolean; onOpen(id: string): void; onNew(): void }) {
  const [level, setLevel] = useState<number | null>(null);
  const [year, setYear] = useState<string>("");
  const years = useMemo(() => [...new Set(trips.map((t) => t.date_from.slice(0, 4)))].sort().reverse(), [trips]);
  const shown = trips.filter((t) => (level === null || t.difficulty === level) && (!year || t.date_from.startsWith(year)));
  const total = trips.reduce((s, t) => s + Number(t.distance_km), 0);

  return (
    <div className="panel-body">
      <header className="brand">
        <Logo size={44} />
        <div>
          <h1>Los viajes de Marcelo</h1>
          <p className="muted small">Argentina en camioneta{demo ? " · modo demo" : ""}</p>
        </div>
      </header>

      <div className="stats">
        <div><b>{trips.length}</b><span>{trips.length === 1 ? "viaje" : "viajes"}</span></div>
        <div><b>{km(total)}</b><span>recorridos</span></div>
        <div><b>{trips.filter((t) => t.difficulty >= 4).length}</b><span>difíciles o extremos</span></div>
      </div>

      <button className="btn primary wide" onClick={onNew}>+ Nuevo viaje</button>

      {trips.length > 0 && (
        <div className="filters">
          <div className="chips">
            <button className={level === null ? "chip on" : "chip"} onClick={() => setLevel(null)}>Todos</button>
            {DIFFICULTY.map((d) => (
              <button key={d.n} className={level === d.n ? "chip on" : "chip"} style={{ ["--c" as string]: d.color }} onClick={() => setLevel(level === d.n ? null : d.n)}>
                <i className="dot" />{d.name}
              </button>
            ))}
          </div>
          {years.length > 1 && (
            <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Año">
              <option value="">Todos los años</option>
              {years.map((y) => <option key={y}>{y}</option>)}
            </select>
          )}
        </div>
      )}

      {trips.length === 0 ? (
        <div className="empty">
          <p><b>Todavía no hay viajes.</b></p>
          <p className="muted">Tocá “Nuevo viaje” y marcá el recorrido en el mapa: por camino, a mano o combinando los dos.</p>
        </div>
      ) : (
        <ul className="trips">
          {shown.map((t) => (
            <li key={t.id}>
              <button className="trip" onClick={() => onOpen(t.id)} style={{ ["--c" as string]: diff(t.difficulty).color }}>
                <span className="cover" style={t.photos[0]?.url ? { backgroundImage: `url("${t.photos[0].url}")` } : undefined} />
                <span className="info">
                  <b>{t.title}</b>
                  <span className="muted small">{dates(t)}</span>
                  <span className="meta"><i className="dot" />{diff(t.difficulty).name} · {km(Number(t.distance_km))}</span>
                </span>
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="muted small">No hay viajes con ese filtro.</li>}
        </ul>
      )}
    </div>
  );
}

export function TripDetail({ trip, onBack, onEdit, onDelete, onPhoto, onReplay }: {
  trip: Trip; onBack(): void; onEdit(): void; onDelete(): void; onPhoto(p: Photo): void; onReplay(): void;
}) {
  const d = diff(trip.difficulty);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="panel-body">
      <div className="panel-head">
        <button className="link" onClick={onBack}>← Todos los viajes</button>
      </div>
      <h2 className="trip-title">{trip.title}</h2>
      <p className="muted">{dates(trip)}</p>
      <div className="badges">
        <span className="badge" style={{ ["--c" as string]: d.color }}><i className="dot" />{d.n} · {d.name}</span>
        <span className="badge plain">{km(Number(trip.distance_km))}</span>
      </div>
      {trip.terrains.length > 0 && <div className="chips static">{trip.terrains.map((t) => <span key={t} className="chip">{t}</span>)}</div>}
      {trip.companions && <p><span className="muted">Con </span>{trip.companions}</p>}
      {trip.notes && <p className="notes">{trip.notes}</p>}

      {trip.photos.length > 0 && (
        <div className="photo-grid view">
          {trip.photos.map((p) => (
            <button key={p.id} onClick={() => onPhoto(p)} aria-label={p.caption || "Ver foto"}>
              <img src={p.url} alt={p.caption} loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <div className="row actions">
        <button className="btn ghost" onClick={onReplay}>Ver recorrido</button>
        <button className="btn ghost" onClick={onEdit}>Editar</button>
        <span className="grow" />
        {confirm ? (
          <>
            <button className="btn danger" onClick={onDelete}>Sí, borrar</button>
            <button className="btn ghost" onClick={() => setConfirm(false)}>No</button>
          </>
        ) : (
          <button className="btn ghost danger-text" onClick={() => setConfirm(true)}>Borrar</button>
        )}
      </div>
    </div>
  );
}

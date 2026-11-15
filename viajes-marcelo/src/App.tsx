import { useCallback, useEffect, useState } from "react";
import { MapView, type MapStyle } from "./components/MapView";
import { TripEditor, type DrawMode } from "./components/TripEditor";
import { TripDetail, TripList } from "./components/TripPanel";
import { routeBetween } from "./lib/routing";
import { loadExamples, store } from "./lib/store";
import type { LngLat, Photo, Trip } from "./lib/types";

type View = { kind: "list" } | { kind: "detail"; id: string } | { kind: "edit"; trip: Trip | null };
interface Draft { route: LngLat[]; points: LngLat[] }

const STYLES: { id: MapStyle; label: string }[] = [
  { id: "mapa", label: "Mapa" },
  { id: "topo", label: "Topográfico" },
  { id: "satelite", label: "Satélite" },
];

export function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "list" });
  const [mapStyle, setMapStyle] = useState<MapStyle>("mapa");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [flyKey, setFlyKey] = useState(0);
  const [panelOpen, setPanelOpen] = useState(true);
  // Borrador del recorrido mientras se edita.
  const [draft, setDraft] = useState<Draft>({ route: [], points: [] });
  const [, setHistory] = useState<Draft[]>([]);
  const [mode, setMode] = useState<DrawMode>("camino");
  const [busyRoute, setBusyRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTrips(await store.list());
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const editing = view.kind === "edit";
  const selectedId = view.kind === "detail" ? view.id : null;
  const selected = trips.find((t) => t.id === selectedId) ?? null;

  const startEdit = (trip: Trip | null) => {
    setDraft(trip ? { route: trip.route, points: trip.route.length ? [trip.route[0], trip.route[trip.route.length - 1]] : [] } : { route: [], points: [] });
    setHistory([]);
    setRouteError(null);
    setView({ kind: "edit", trip });
    setPanelOpen(true);
  };

  const addPoint = async (at: LngLat) => {
    if (busyRoute) return;
    setRouteError(null);
    const prev = draft;
    if (mode === "mano" || !prev.route.length) {
      setHistory((h) => [...h, prev]);
      setDraft({ route: [...prev.route, at], points: [...prev.points, at] });
      return;
    }
    setBusyRoute(true);
    try {
      const path = await routeBetween(prev.route[prev.route.length - 1], at);
      setHistory((h) => [...h, prev]);
      setDraft({ route: [...prev.route, ...path.slice(1)], points: [...prev.points, at] });
    } catch (e) {
      setRouteError((e as Error).message);
    } finally {
      setBusyRoute(false);
    }
  };

  return (
    <div className="app">
      <MapView
        trips={trips}
        selectedId={selectedId}
        mapStyle={mapStyle}
        editing={editing ? draft : null}
        focus={view.kind === "detail" ? selected?.route ?? null : view.kind === "edit" ? view.trip?.route ?? null : null}
        focusKey={`${view.kind}:${view.kind === "detail" ? view.id : view.kind === "edit" ? view.trip?.id ?? "nuevo" : ""}:${flyKey}:${selected ? 1 : 0}`}
        onSelect={(id) => setView(id ? { kind: "detail", id } : { kind: "list" })}
        onMapClick={addPoint}
        onPhoto={setPhoto}
      />

      <div className="styles" role="radiogroup" aria-label="Estilo del mapa">
        {STYLES.map((s) => (
          <button key={s.id} role="radio" aria-checked={mapStyle === s.id} className={mapStyle === s.id ? "on" : ""} onClick={() => setMapStyle(s.id)}>{s.label}</button>
        ))}
      </div>

      <aside className={panelOpen ? "panel" : "panel closed"}>
        <button className="grip" onClick={() => setPanelOpen((v) => !v)} aria-label={panelOpen ? "Achicar panel" : "Abrir panel"}><span /></button>
        {loadError && <p className="error">{loadError}</p>}
        {view.kind === "list" && <TripList trips={trips} demo={store.demo} onOpen={(id) => setView({ kind: "detail", id })} onNew={() => startEdit(null)} onExamples={async () => { await loadExamples(); load(); }} />}
        {view.kind === "detail" && selected && (
          <TripDetail
            trip={selected}
            onBack={() => setView({ kind: "list" })}
            onEdit={() => startEdit(selected)}
            onReplay={() => setFlyKey((k) => k + 1)}
            onPhoto={setPhoto}
            onDelete={async () => { await store.remove(selected.id); setView({ kind: "list" }); load(); }}
          />
        )}
        {view.kind === "edit" && (
          <TripEditor
            trip={view.trip}
            route={draft.route}
            mode={mode}
            busyRoute={busyRoute}
            routeError={routeError}
            onMode={setMode}
            onAddPoint={addPoint}
            onUndo={() => setHistory((h) => { if (h.length) setDraft(h[h.length - 1]); return h.slice(0, -1); })}
            onClear={() => { setHistory((h) => [...h, draft]); setDraft({ route: [], points: [] }); }}
            onCancel={() => setView(view.trip ? { kind: "detail", id: view.trip.id } : { kind: "list" })}
            onSaved={async () => { await load(); setView(view.trip ? { kind: "detail", id: view.trip.id } : { kind: "list" }); }}
          />
        )}
      </aside>

      {photo && (
        <div className="lightbox" role="dialog" aria-label="Foto" onClick={() => setPhoto(null)}>
          <img src={photo.url} alt={photo.caption} />
          {photo.caption && <p>{photo.caption}</p>}
          <button className="x" aria-label="Cerrar">×</button>
        </div>
      )}
    </div>
  );
}

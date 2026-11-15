// Capa three.js dentro de MapLibre: los recorridos como líneas azules con brillo, apoyadas sobre el relieve,
// y una camioneta 3D que recorre el viaje elegido.
import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { MercatorCoordinate, type CustomLayerInterface, type CustomRenderMethodInput, type Map as MLMap } from "maplibre-gl";
import { along } from "./geo";
import { diff, type LngLat, type Trip } from "./types";

const ORIGIN = MercatorCoordinate.fromLngLat([-64, -38], 0);
const LIFT_M = 25; // las líneas flotan apenas sobre el terreno
const LAP_S = 14; // segundos que tarda la camioneta en recorrer el viaje elegido

interface Drawn { trip: Trip; lines: Line2[]; geom: LineGeometry }

export class TripsLayer implements CustomLayerInterface {
  id = "trips-3d";
  type = "custom" as const;
  renderingMode = "3d" as const;

  private map!: MLMap;
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private drawn: Drawn[] = [];
  private trips: Trip[] = [];
  private selected: string | null = null;
  private truck = makeTruck();
  private t0 = performance.now();
  private elevKey = "";

  onAdd(map: MLMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
    this.scene.add(new THREE.HemisphereLight(0xdbeafe, 0x0b1730, 2.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(0.3, -0.5, 1);
    this.scene.add(sun);
    this.truck.visible = false;
    this.scene.add(this.truck);
    // Cuando el relieve termina de cargar, las líneas se vuelven a apoyar sobre él.
    map.on("idle", () => this.refreshElevation());
    this.rebuild();
  }

  setTrips(trips: Trip[], selected: string | null) {
    this.trips = trips;
    this.selected = selected;
    if (this.map) this.rebuild();
  }

  private z(p: LngLat) {
    return this.map.queryTerrainElevation(p) ?? 0;
  }

  private positions(route: LngLat[]) {
    const out: number[] = [];
    for (const p of route) {
      const m = MercatorCoordinate.fromLngLat(p, this.z(p) + LIFT_M);
      out.push(m.x - ORIGIN.x, m.y - ORIGIN.y, m.z);
    }
    return out;
  }

  private rebuild() {
    for (const d of this.drawn) { for (const l of d.lines) { this.scene.remove(l); (l.material as LineMaterial).dispose(); } d.geom.dispose(); }
    this.drawn = [];
    for (const trip of this.trips) {
      if (trip.route.length < 2) continue;
      const geom = new LineGeometry();
      geom.setPositions(this.positions(trip.route));
      const sel = trip.id === this.selected;
      const dim = this.selected !== null && !sel;
      const color = new THREE.Color(diff(trip.difficulty).color);
      // Halo azul suave, borde blanco y línea azul: se lee sobre el mapa blanco, el topográfico y el satélite.
      const w = sel ? 6 : 4;
      const mk = (c: THREE.Color, width: number, opacity: number, order: number) => {
        const l = new Line2(geom, new LineMaterial({ color: c, linewidth: width, transparent: true, opacity, depthTest: false, depthWrite: false }));
        l.renderOrder = order;
        return l;
      };
      const lines = [
        mk(color, w + 14, dim ? 0.05 : sel ? 0.28 : 0.16, 1),
        mk(new THREE.Color("#ffffff"), w + 4, dim ? 0.35 : 1, 2),
        mk(color, w, dim ? 0.35 : 1, 3),
      ];
      this.scene.add(...lines);
      this.drawn.push({ trip, lines, geom });
    }
    this.elevKey = "";
    this.map?.triggerRepaint();
  }

  private refreshElevation() {
    const c = this.map.getCenter();
    const key = `${c.lng.toFixed(2)},${c.lat.toFixed(2)},${this.map.getZoom().toFixed(1)}`;
    if (key === this.elevKey) return;
    this.elevKey = key;
    for (const d of this.drawn) d.geom.setPositions(this.positions(d.trip.route));
    this.map.triggerRepaint();
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput) {
    const canvas = this.map.getCanvas();
    for (const d of this.drawn) for (const l of d.lines) (l.material as LineMaterial).resolution.set(canvas.width, canvas.height);
    // Camioneta sobre el viaje elegido.
    const sel = this.trips.find((t) => t.id === this.selected && t.route.length > 1);
    this.truck.visible = !!sel;
    if (sel) {
      const f = ((performance.now() - this.t0) / 1000 / LAP_S) % 1;
      const { at, bearing } = along(sel.route, f);
      const m = MercatorCoordinate.fromLngLat(at, this.z(at) + 4);
      // Tamaño constante en pantalla (~34 px de largo), sea cual sea el zoom.
      const mpp = (40075016.686 * Math.cos((at[1] * Math.PI) / 180)) / (512 * 2 ** this.map.getZoom());
      const s = m.meterInMercatorCoordinateUnits() * mpp * 34;
      this.truck.position.set(m.x - ORIGIN.x, m.y - ORIGIN.y, m.z);
      this.truck.scale.set(s, -s, s); // en Mercator la Y crece hacia el sur
      this.truck.rotation.set(0, 0, (bearing * Math.PI) / 180);
    }
    const proj = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix as unknown as number[]);
    this.camera.projectionMatrix = proj.multiply(new THREE.Matrix4().makeTranslation(ORIGIN.x, ORIGIN.y, 0));
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    if (sel) this.map.triggerRepaint();
  }
}

/** Camioneta low-poly: caja azul, cabina, ruedas. 1 unidad = largo de la camioneta; mira hacia +Y (norte). */
function makeTruck() {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.3, roughness: 0.45 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.6, roughness: 0.2 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  add(new THREE.BoxGeometry(0.42, 1, 0.22), body, 0, 0, 0.2); // chasis + caja
  add(new THREE.BoxGeometry(0.4, 0.42, 0.2), body, 0, 0.18, 0.4); // cabina
  add(new THREE.BoxGeometry(0.41, 0.12, 0.13), glass, 0, 0.36, 0.42); // parabrisas
  const wheel = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 14);
  wheel.rotateZ(Math.PI / 2);
  for (const [x, y] of [[-0.23, 0.32], [0.23, 0.32], [-0.23, -0.3], [0.23, -0.3]]) add(wheel, tire, x, y, 0.11);
  return g;
}

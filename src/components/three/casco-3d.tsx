"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { cssVar, useResolvedTheme } from "@/components/theme";
import type { SegmentsFC } from "@/lib/data/types";
import type { LngLat } from "@/lib/domain/types";
import { TOOLTIP } from "@/components/tooltip";
import { CONDITION_LABEL, CONDITION_VAR } from "@/lib/format";

export type Height3D = "problemas" | "estado";

const REF: LngLat = [-57.9545, -34.9214];
const KX = 111_320 * Math.cos((REF[1] * Math.PI) / 180);
const KY = 110_574;
/** lng/lat → metros (x = este, z = sur), centrado en Plaza Moreno. */
const toXZ = ([lng, lat]: LngLat): [number, number] => [(lng - REF[0]) * KX, -(lat - REF[1]) * KY];

const HEIGHT_BY_CONDITION = { nueva: 6, buena: 12, gastada: 40, muy_deteriorada: 90, sin_relevar: 2 } as const;

/**
 * El casco en 3D: cada cuadra es una "pared" coloreada por su estado. En el modo "problemas"
 * la altura es la densidad de pozos y parches abiertos: el skyline de la desidia.
 */
export default function Casco3D({ data, casco, height = 520, mode, fill = false, autoRotate = true }: {
  data: SegmentsFC;
  casco: LngLat[];
  height?: number;
  mode: Height3D;
  /** Ocupa todo el alto del contenedor (para el hero) y usa el fondo asfalto en ambos temas. */
  fill?: boolean;
  autoRotate?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const theme = useResolvedTheme();
  const [hover, setHover] = useState<{ x: number; y: number; w: number; text: string } | null>(null);

  useEffect(() => {
    const host = el.current;
    if (!host) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const w = host.clientWidth;
    const h = fill ? host.clientHeight : height;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2));
    renderer.setSize(w, h);
    renderer.setClearColor(new THREE.Color(cssVar(fill ? "--asphalt" : "--surface-2")));
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-label", "Vista 3D del casco urbano");
    renderer.domElement.setAttribute("role", "img");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, w / h, 10, 30_000);
    camera.position.set(-4300, 4700, 5600);
    if (fill) camera.position.set(-4200, 4400, 5400);

    scene.add(new THREE.HemisphereLight(0xffffff, theme === "dark" ? 0x222222 : 0x999999, theme === "dark" ? 1.6 : 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, theme === "dark" ? 1.4 : 1.8);
    sun.position.set(-2000, 4000, 1500);
    scene.add(sun);

    // Suelo: el polígono del casco.
    const shape = new THREE.Shape(casco.map((p) => new THREE.Vector2(...toXZ(p))));
    const ground = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(cssVar(fill ? "--asphalt-2" : "--surface")), roughness: 1, side: THREE.DoubleSide }),
    );
    ground.rotation.x = Math.PI / 2; // el shape está en XY (x, z): rotarlo +90° lo acuesta sobre XZ
    scene.add(ground);

    // Cuadras como instancias de una caja unitaria.
    const feats = data.features;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0); // que crezca desde el suelo
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0 });
    const mesh = new THREE.InstancedMesh(geo, mat, feats.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const colors = {
      ...Object.fromEntries(Object.entries(CONDITION_VAR).map(([k, v]) => [k, new THREE.Color(cssVar(v))])),
      empedrado: new THREE.Color(cssVar("--c-empedrado")),
    } as Record<string, THREE.Color>;

    feats.forEach((f, i) => {
      const c = f.geometry.coordinates;
      const [x1, z1] = toXZ(c[0]);
      const [x2, z2] = toXZ(c[c.length - 1]);
      const len = Math.hypot(x2 - x1, z2 - z1);
      const p = f.properties;
      const hgt =
        mode === "problemas" ? 3 + Math.min(p.score, 12) * 22 : p.cobbled ? 8 : HEIGHT_BY_CONDITION[p.condition];
      const width = p.lengthM > 0 ? 14 : 10;
      q.setFromAxisAngle(up, -Math.atan2(z2 - z1, x2 - x1));
      m4.compose(new THREE.Vector3((x1 + x2) / 2, 0, (z1 + z2) / 2), q, new THREE.Vector3(Math.max(1, len - 18), hgt, width));
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, p.cobbled ? colors.empedrado : colors[p.condition]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minDistance = 600;
    controls.maxDistance = 9000;
    controls.autoRotate = autoRotate && !reduceMotion;
    controls.autoRotateSpeed = 0.35;
    controls.target.set(0, 0, fill ? -300 : 0);
    if (coarse && fill) {
      // En el celular el casco del inicio solo gira solo: el dedo tiene que poder scrollear la página.
      controls.enabled = false;
      renderer.domElement.style.touchAction = "pan-y";
    } else {
      renderer.domElement.addEventListener("pointerdown", () => (controls.autoRotate = false), { once: true });
    }

    // Hover: qué cuadra es.
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const onMove = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObject(mesh)[0];
      if (hit?.instanceId === undefined) return setHover(null);
      const p = feats[hit.instanceId].properties;
      const state = p.cobbled ? "Empedrado" : CONDITION_LABEL[p.condition];
      setHover({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, text: `${p.label} · ${state} · ${p.openPozos} pozos, ${p.openParches} parches` });
    };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerleave", () => setHover(null));

    let raf = 0;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    const ro = new ResizeObserver(() => {
      const nw = host.clientWidth;
      const nh = fill ? host.clientHeight : h;
      renderer.setSize(nw, nh);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
    });
    ro.observe(host);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      geo.dispose();
      mat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [data, casco, height, mode, theme, fill, autoRotate]);

  return (
    <div className={fill ? "absolute inset-0" : "relative"}>
      <div ref={el} style={fill ? undefined : { height }} className={fill ? "h-full w-full" : "w-full overflow-hidden"} />
      {hover && (
        <div role="status" className={`${TOOLTIP} max-w-[260px]`}
          style={{ left: Math.min(hover.x + 12, hover.w - 270), top: hover.y + 12 }}>
          {hover.text}
        </div>
      )}
    </div>
  );
}

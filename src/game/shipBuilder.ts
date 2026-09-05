import * as THREE from "three";
import { ShipDef } from "./ships";

export interface BuiltShip {
  group: THREE.Group;
  glowL: THREE.Mesh;
  glowR: THREE.Mesh;
  thrusterMat: THREE.MeshBasicMaterial;
  dispose: () => void;
}

/**
 * Builds a low-poly craft from a ship definition.
 * Shared by the live game and the hangar preview so they always match.
 */
export function buildShipMesh(def: ShipDef): BuiltShip {
  const group = new THREE.Group();
  const disposables: (THREE.BufferGeometry | THREE.Material)[] = [];
  const track = <T extends THREE.BufferGeometry | THREE.Material>(x: T): T => {
    disposables.push(x);
    return x;
  };

  const hullMat = track(new THREE.MeshStandardMaterial({ color: def.hullColor, metalness: 0.55, roughness: 0.3, flatShading: true }));
  const darkMat = track(new THREE.MeshStandardMaterial({ color: def.darkColor, metalness: 0.45, roughness: 0.5, flatShading: true }));
  const canopyMat = track(new THREE.MeshStandardMaterial({ color: 0x0d1220, metalness: 0.9, roughness: 0.12 }));
  const trimMat = track(new THREE.MeshBasicMaterial({ color: def.glowColor }));
  const thrusterMat = track(new THREE.MeshBasicMaterial({
    color: def.glowColor, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.95, depthWrite: false,
  }));

  const b = def.build;

  /* ---- fuselage ---- */
  const bodyGeo = track(new THREE.OctahedronGeometry(0.62));
  const body = new THREE.Mesh(bodyGeo, hullMat);
  if (b === "needle") body.scale.set(0.6, 0.5, 3.5);
  else if (b === "heavy") body.scale.set(1.15, 0.85, 2.5);
  else if (b === "wide") body.scale.set(0.95, 0.6, 2.9);
  else if (b === "prism") body.scale.set(0.9, 0.78, 2.9);
  else if (b === "delta") body.scale.set(0.78, 0.55, 2.8);
  else body.scale.set(0.85, 0.62, 2.7);
  group.add(body);

  /* ---- nose ---- */
  const noseLen = b === "needle" ? 2.4 : b === "heavy" ? 1.1 : 1.5;
  const noseGeo = track(new THREE.ConeGeometry(b === "heavy" ? 0.5 : 0.34, noseLen, b === "prism" ? 4 : 6));
  const nose = new THREE.Mesh(noseGeo, darkMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0.02, -(body.scale.z * 0.62 + noseLen / 2 - 0.25));
  group.add(nose);

  /* ---- canopy ---- */
  const canopyGeo = track(new THREE.SphereGeometry(0.3, 10, 8));
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.scale.set(0.9, 0.62, b === "needle" ? 2.4 : 1.9);
  canopy.position.set(0, 0.3, -0.15);
  group.add(canopy);

  /* ---- wings ---- */
  const wingSpan = b === "wide" ? 2.4 : b === "heavy" ? 2.0 : b === "needle" ? 1.15 : b === "delta" ? 2.1 : 1.65;
  const wingChord = b === "delta" ? 1.5 : b === "wide" ? 0.8 : 0.62;
  const sweep = b === "delta" ? 0.62 : b === "needle" ? 0.55 : 0.42;
  const wingGeo = track(new THREE.BoxGeometry(wingSpan, 0.07, wingChord));
  const tipGeo = track(new THREE.BoxGeometry(0.16, 0.1, 0.16));
  const canardGeo = track(new THREE.BoxGeometry(0.8, 0.06, 0.34));
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(wingGeo, hullMat);
    w.position.set(s * wingSpan * 0.58, -0.04, b === "delta" ? 0.75 : 0.55);
    w.rotation.y = -s * sweep;
    w.rotation.z = s * 0.1;
    group.add(w);
    const tip = new THREE.Mesh(tipGeo, trimMat);
    tip.position.set(s * wingSpan * 1.02, -0.02, b === "delta" ? 1.05 : 0.72);
    group.add(tip);
    if (b === "prism" || b === "heavy") {
      const c2 = new THREE.Mesh(canardGeo, hullMat);
      c2.position.set(s * 0.62, 0.12, -1.15);
      c2.rotation.y = -s * 0.3;
      group.add(c2);
    }
  }

  /* ---- tail ---- */
  const finGeo = track(new THREE.BoxGeometry(0.07, 0.62, 0.55));
  const finCount = b === "heavy" || b === "wide" ? 2 : 1;
  for (let i = 0; i < finCount; i++) {
    const fin = new THREE.Mesh(finGeo, darkMat);
    const off = finCount === 2 ? (i === 0 ? -0.45 : 0.45) : 0;
    fin.position.set(off, 0.42, 0.95);
    fin.rotation.x = -0.25;
    fin.rotation.z = finCount === 2 ? (i === 0 ? -0.22 : 0.22) : 0;
    group.add(fin);
  }
  const tailGeo = track(new THREE.BoxGeometry(0.85, 0.06, 0.35));
  const tail = new THREE.Mesh(tailGeo, hullMat);
  tail.position.set(0, 0.12, 0.98);
  group.add(tail);

  /* ---- engines ---- */
  const engSide = b === "heavy" || b === "wide" ? 0.66 : b === "needle" ? 0.3 : 0.52;
  const engGeo = track(new THREE.CylinderGeometry(b === "heavy" ? 0.18 : 0.12, b === "heavy" ? 0.2 : 0.14, 0.55, 8));
  const glowGeo = track(new THREE.SphereGeometry(0.13, 8, 6));
  let glowL!: THREE.Mesh;
  let glowR!: THREE.Mesh;
  for (const side of [-engSide, engSide]) {
    const eng = new THREE.Mesh(engGeo, darkMat);
    eng.rotation.x = Math.PI / 2;
    eng.position.set(side, -0.02, 0.72);
    group.add(eng);
    const glow = new THREE.Mesh(glowGeo, thrusterMat);
    glow.position.set(side, -0.02, 1.06);
    glow.scale.set(1, 1, 2.2);
    group.add(glow);
    if (side < 0) glowL = glow;
    else glowR = glow;
  }

  group.scale.setScalar(def.scale);

  return {
    group,
    glowL,
    glowR,
    thrusterMat,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { ShipDef } from "../game/ships";
import { buildShipMesh } from "../game/shipBuilder";

/**
 * Small live 3D turntable of a craft — shown on every hangar card.
 * One shared renderer would be ideal, but these are tiny (128px) and
 * only a handful are visible, so a per-card renderer stays smooth.
 */
export default function ShipPreview({ def, size = 120 }: { def: ShipDef; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1 : 2));
    renderer.setSize(size, size, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(3.4, 1.9, 4.6);
    camera.lookAt(0, -0.1, 0);

    scene.add(new THREE.HemisphereLight(0xbfd6ff, 0x1a1030, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(4, 6, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(def.glowColor, 1.6);
    rim.position.set(-4, 1, -4);
    scene.add(rim);

    const built = buildShipMesh(def);
    const pivot = new THREE.Group();
    pivot.add(built.group);
    built.group.position.y = 0;
    scene.add(pivot);

    // soft glow disc under the craft
    const discGeo = new THREE.CircleGeometry(2.6, 32);
    const discMat = new THREE.MeshBasicMaterial({
      color: def.glowColor, transparent: true, opacity: 0.09,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -1.1;
    scene.add(disc);

    // Only render while on screen, and cap to 30fps — these are decorative
    // and there can be six of them alongside the main game context.
    let visible = true;
    const io = new IntersectionObserver(
      (entries) => { visible = entries[0]?.isIntersecting ?? true; },
      { threshold: 0.05 },
    );
    io.observe(canvas);

    const frameBudget = 1 / (coarse ? 24 : 30);
    let raf = 0;
    let t = 0;
    let acc = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible || document.hidden) return;
      t += dt;
      acc += dt;
      if (acc < frameBudget) return;
      acc = 0;
      pivot.rotation.y = t * 0.6;
      pivot.position.y = Math.sin(t * 1.3) * 0.09;
      pivot.rotation.z = Math.sin(t * 0.8) * 0.06;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      built.dispose();
      discGeo.dispose();
      discMat.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, [def, size]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className="pointer-events-none block"
      style={{ width: size, height: size }}
    />
  );
}

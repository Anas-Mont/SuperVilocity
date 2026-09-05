import * as THREE from "three";
import { LevelConfig, Theme, ENDLESS_CYCLE, MENU_THEME } from "./levels";
import { SoundFX } from "./audio";
import { ShipDef, getShipDef, ABILITIES } from "./ships";
import { buildShipMesh, BuiltShip } from "./shipBuilder";
import { clamp, lerp, damp, rand, randInt, pickWeighted } from "./utils";

export type ToastKind = "bonus" | "warn" | "info";

export interface HUDState {
  score: number;
  stars: number;
  hearts: number;
  maxHearts: number;
  fps: number;
  modernUi: boolean;
  /** desktop-only HUD lean, in px */
  tiltHud: number;
  abilityName: string;
  abilityReady: boolean;
  abilityActive: boolean;
  abilityCd01: number;
  boost01: number;
  speedKmh: number;
  dist: number;
  target: number;
  progress01: number;
  countdown: number; // -1 none, 3/2/1, 0 = GO
  mult: number;
  levelName: string;
  accent: string;
  endless: boolean;
  playing: boolean;
}

export interface RunResult {
  score: number;
  dist: number;
  stars: number;
}

export interface EngineEvents {
  onHUD: (h: HUDState) => void;
  onToast: (text: string, kind: ToastKind) => void;
  onDamage: () => void;
  onGameOver: (r: RunResult) => void;
  onComplete: (r: RunResult) => void;
  onTogglePause: () => void;
  onAutoPause: () => void;
}

type Mode = "attract" | "countdown" | "playing" | "dying" | "complete" | "paused";

const SPAWN_Z = -140;
const TRACK_LEN = 210;
const SHIP_R = 0.55;

/* ---------------- pooled entity types ---------------- */

interface WallEnt {
  group: THREE.Group;
  panels: THREE.Mesh[];
  strips: THREE.Mesh[];
  active: boolean;
  hx: number; hy: number; hw: number; hh: number;
  slide: boolean; slideAmp: number; slideSpeed: number; slidePhase: number;
  hit: boolean; cleared: boolean; clearance: number;
}

interface PillarEnt {
  group: THREE.Group;
  boxes: THREE.Mesh[];
  caps: THREE.Mesh[];
  data: { x: number; w: number; h: number }[];
  count: number;
  active: boolean; hit: boolean; cleared: boolean; clearance: number;
}

interface SweeperEnt {
  group: THREE.Group;
  blade: THREE.Mesh;
  glows: THREE.Mesh[];
  active: boolean;
  amp: number; speed: number; phase: number; centerX: number; t: number;
  hit: boolean; cleared: boolean;
}

interface RingEnt {
  group: THREE.Group;
  torus: THREE.Mesh;
  active: boolean;
  x: number; y: number; r: number;
  prevZ: number; pulse: number; done: boolean;
}

interface StarEnt {
  mesh: THREE.Mesh;
  active: boolean;
  repair: boolean;
  baseY: number;
  phase: number;
  magnet: boolean;
}

/** STAGE II — laser fence that pulses on/off */
interface LaserEnt {
  group: THREE.Group;
  emitters: THREE.Mesh[];
  beams: THREE.Mesh[];
  active: boolean;
  vertical: boolean; // true = vertical bars (dodge left/right)
  count: number;
  coords: number[]; // x for vertical, y for horizontal
  period: number;
  offset: number;
  duty: number; // fraction of the period the beam is ON
  on: boolean;
  hit: boolean;
  cleared: boolean;
}

/** STAGE II — rotating rotor blade */
interface SpinnerEnt {
  group: THREE.Group;
  arms: THREE.Mesh[];
  hub: THREE.Mesh;
  active: boolean;
  cx: number;
  cy: number;
  speed: number;
  armLen: number;
  armCount: number;
  hit: boolean;
  cleared: boolean;
}

/** STAGE III — hydraulic crusher that slams shut */
interface CrusherEnt {
  group: THREE.Group;
  top: THREE.Mesh;
  bottom: THREE.Mesh;
  teethT: THREE.Mesh;
  teethB: THREE.Mesh;
  active: boolean;
  period: number;
  offset: number;
  gapMin: number;
  gapMax: number;
  centerY: number;
  gap: number;
  hit: boolean;
  cleared: boolean;
}

interface Spark {
  alive: boolean;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  age: number; life: number;
}

const COLOR_KEYS = [
  "skyTop", "skyBottom", "fog", "mtnNear", "mtnFar", "wall", "glow",
  "ring", "star", "sun", "hemiSky", "hemiGround", "dir", "cloud", "trail", "speedline",
] as const;
type ColorKey = (typeof COLOR_KEYS)[number];

/* ================================================================== */

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;
  private events: EngineEvents;
  readonly sound = new SoundFX();

  private mode: Mode = "attract";
  private prePause: Mode = "attract";
  private raf = 0;
  private last = performance.now();
  private time = 0;
  private destroyed = false;

  private level: LevelConfig | null = null;
  private isEndless = false;

  /* run state */
  private score = 0;
  private starCount = 0;
  private hearts = 3;
  private boost = 100;
  private boostBtn = false;
  private dist = 0;
  private speed = 40;
  private invuln = 0;
  private spawnT = 1;
  private countdown = -1;
  private countdownT = 0;
  private goHideT = 0;
  private phase = 0;
  private finalShown = false;
  private modeT = 0;
  private p01 = 0;
  private trauma = 0;

  /* input — relative-drag model (mobile) + absolute (mouse) */
  private pointerX = 0;
  private pointerY = 0;
  private pointerSeen = false;
  private mouseBoost = false;
  private keys = new Set<string>();
  /** true once the player has used touch — switches to drag steering */
  private touchMode = false;
  /** active touch pointers that contribute steering deltas */
  private touches = new Map<number, { x: number; y: number }>();
  private dragX = 0;
  private dragY = 0;
  /** steering target in world units (what the ship flies toward) */
  private tgtX = 0;
  private tgtY = 7.5;
  /** ship velocity for spring physics */
  private velX = 0;
  private velY = 0;

  /* settings */
  private shakeOn = true;
  private modernUi = true;
  private dieGroup: THREE.Group | null = null;
  private diePips: THREE.Mesh[] = [];
  private dieArc: THREE.Mesh | null = null;
  private dieArcMat: THREE.MeshBasicMaterial | null = null;
  private hudShake = true;

  /* ship */
  private ship = new THREE.Group();
  private shipVX = 0;
  private bankZ = 0;
  private pitchX = 0;
  private dieVY = 0;
  private engineGlowL!: THREE.Mesh;
  private engineGlowR!: THREE.Mesh;
  private shipDef: ShipDef = getShipDef("dart");
  private maxHearts = 3;
  private thrusterMat!: THREE.MeshBasicMaterial;
  private built: BuiltShip | null = null;
  private shieldMesh: THREE.Mesh | null = null;
  private abilityT = 0;
  private abilityCd = 0;

  /* tuning from settings */
  private sens = 1;
  private smooth = 0.5;
  private tiltOn = false;
  private gyroInv = 0;
  private vibrateOn = true;
  private tiltX = 0;
  private tiltY = 0;
  private tiltCalX = 0;
  private tiltCalY = 0;
  private tiltRawX = 0;
  private tiltRawY = 0;
  private tiltReady = false;

  /* environment */
  private hemi!: THREE.HemisphereLight;
  private dirLight!: THREE.DirectionalLight;
  private skyMesh!: THREE.Mesh;
  private skyGeo!: THREE.BufferGeometry;
  private sunMesh!: THREE.Mesh;
  private sunGlow!: THREE.Sprite;
  private starsPts!: THREE.Points;
  private groundTex!: THREE.CanvasTexture;
  private groundMat!: THREE.MeshBasicMaterial;
  private mtnNearMat!: THREE.MeshStandardMaterial;
  private mtnFarMat!: THREE.MeshStandardMaterial;
  private cloudMat!: THREE.MeshStandardMaterial;
  private mountains: THREE.Mesh[] = [];
  private clouds: THREE.Group[] = [];
  private mtnSpeeds: number[] = [];

  /* shared materials (hazards) */
  private wallMat!: THREE.MeshStandardMaterial;
  private glowMat!: THREE.MeshBasicMaterial;
  private ringMat!: THREE.MeshBasicMaterial;
  private starMat!: THREE.MeshBasicMaterial;
  private repairMat!: THREE.MeshBasicMaterial;
  private speedlineMat!: THREE.MeshBasicMaterial;

  /* pools */
  private walls: WallEnt[] = [];
  private pillars: PillarEnt[] = [];
  private sweepers: SweeperEnt[] = [];
  private rings: RingEnt[] = [];
  private starsPool: StarEnt[] = [];
  private speedlines: THREE.Mesh[] = [];
  private lasers: LaserEnt[] = [];
  private spinners: SpinnerEnt[] = [];
  private crushers: CrusherEnt[] = [];
  private beamMat!: THREE.MeshBasicMaterial;
  private beamOffMat!: THREE.MeshBasicMaterial;

  /* particles */
  private trailPts!: THREE.Points;
  private trailPos!: Float32Array;
  private trailCol!: Float32Array;
  private trailBoost!: Float32Array;
  private trailVX!: Float32Array;
  private trailVY!: Float32Array;
  private readonly TRAIL_N = (window.matchMedia?.("(pointer: coarse)")?.matches ?? false) ? 120 : 260;
  private trailHead = 0;
  private trailAges: Float32Array = new Float32Array(0);
  private trailLife = 0.85;
  private emitAcc = 0;
  private boomPts!: THREE.Points;
  private boomPos!: Float32Array;
  private boomCol!: Float32Array;
  private sparks: Spark[] = [];
  private boomActive = false;

  /* theme */
  private curC: Record<ColorKey, THREE.Color> = {} as Record<ColorKey, THREE.Color>;
  private tgtC: Record<ColorKey, THREE.Color> = {} as Record<ColorKey, THREE.Color>;
  private curFogNear = 60;
  private curFogFar = 175;
  private tgtFogNear = 60;
  private tgtFogFar = 175;
  private curSunVis = 1;
  private tgtSunVis = 1;
  private curCloudOp = 0.5;
  private tgtCloudOp = 0.5;
  private curStarsOp = 0;
  private tgtStarsOp = 0;
  private transitioning = false;

  private hudAcc = 99;
  private fpsLimit = 0; // 0 = MAX
  private fpsAcc = 0;
  private fpsEma = 60;
  /** true on phones/tablets — drives every complexity decision */
  private readonly isMobile = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  private baseScale = 1; // pixel ratio requested by the quality setting
  private dynScale = 1; // adaptive multiplier applied on top (0.6..1)
  private autoPerf = true;
  private perfAcc = 0;
  private perfFrames = 0;
  private perfSum = 0;
  private tmpC = new THREE.Color();
  private currentAccent: Theme = MENU_THEME;

  constructor(canvas: HTMLCanvasElement, events: EngineEvents) {
    this.canvas = canvas;
    this.events = events;
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      // MSAA is expensive on mobile GPUs and barely visible at speed
      antialias: !coarse,
      powerPreference: "high-performance",
      stencil: false,
      depth: true,
      // opaque canvas avoids an extra compositing pass
      alpha: false,
    });
    this.renderer.info.autoReset = false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.camera = new THREE.PerspectiveCamera(74, 1, 0.1, 900);
    this.camera.position.set(0, 9, 9);

    this.scene.fog = new THREE.Fog(0xc96a52, 60, 175);

    this.buildLights();
    this.buildSky();
    this.buildGround();
    this.buildSunAndStars();
    this.buildPools();
    this.buildShip();
    this.buildTrail();
    this.buildExplosion();
    this.buildDiegetic();
    this.setTheme(MENU_THEME, true);
    this.bindInput();
    this.resize();

    this.last = performance.now();
    const loop = (now: number) => {
      if (this.destroyed) return;
      this.raf = requestAnimationFrame(loop);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt <= 0) dt = 0.0001;
      // FPS cap: skip frames until the frame budget is consumed
      if (this.fpsLimit > 0) {
        this.fpsAcc += dt;
        if (this.fpsAcc < 1 / this.fpsLimit - 0.0015) return;
        dt = Math.min(0.05, this.fpsAcc);
        this.fpsAcc = 0;
      } else {
        dt = Math.min(0.05, dt);
      }
      this.fpsEma = this.fpsEma * 0.94 + (1 / dt) * 0.06;
      this.adaptPerformance(dt);
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /* ============================ PUBLIC API ============================ */

  applySettings(s: {
    sfx: boolean; music: boolean; shake: boolean; quality: number; fps: number;
    sens: number; smooth: number; tilt: boolean; gyroInv: number; vibrate: boolean;
    modernUi: boolean; hudShake: boolean; autoPerf: boolean;
  }) {
    this.modernUi = s.modernUi;
    this.hudShake = s.hudShake;
    this.sound.setSfx(s.sfx);
    this.sound.setMusic(s.music);
    this.shakeOn = s.shake;
    this.fpsLimit = s.fps;
    this.fpsAcc = 0;
    this.sens = s.sens;
    this.smooth = s.smooth;
    this.gyroInv = s.gyroInv;
    this.vibrateOn = s.vibrate;
    if (s.tilt !== this.tiltOn) {
      this.tiltOn = s.tilt;
      if (s.tilt) this.enableTilt();
      else this.disableTilt();
    }
    // True render scale — works on EVERY display, not just retina:
    // LOW 0.66x (much faster), MED 0.85x, HIGH 1x, ULTRA supersamples on retina
    const dpr = window.devicePixelRatio || 1;
    let scale =
      s.quality <= 1 ? 0.6 : s.quality === 2 ? 0.8 : s.quality === 3 ? Math.min(dpr, 1) : Math.min(dpr, 2);
    // phone GPUs are fill-rate bound: a 3x retina buffer is ~9x the pixels.
    if (this.isMobile) {
      scale = s.quality <= 1 ? 0.5 : s.quality === 2 ? 0.66 : s.quality === 3 ? 0.85 : Math.min(dpr, 1.25);
    }
    this.baseScale = scale;
    this.autoPerf = s.autoPerf;
    if (!s.autoPerf) this.dynScale = 1;
    this.renderer.setPixelRatio(this.baseScale * this.dynScale);
    this.resize();
  }

  get fpsReading() {
    return Math.round(this.fpsEma);
  }

  /**
   * Measures the display's actual refresh ceiling.
   * requestAnimationFrame is hard-locked to the monitor's refresh rate by every
   * browser, so this is the true maximum the game can ever render at.
   */
  static async detectRefreshRate(): Promise<number> {
    return new Promise((resolve) => {
      const samples: number[] = [];
      let last = performance.now();
      let n = 0;
      const tick = (now: number) => {
        const d = now - last;
        last = now;
        if (d > 0.5 && d < 100) samples.push(d);
        if (++n < 45) requestAnimationFrame(tick);
        else {
          samples.sort((a, b) => a - b);
          const median = samples[Math.floor(samples.length / 2)] || 16.67;
          resolve(Math.round(1000 / median));
        }
      };
      requestAnimationFrame(tick);
    });
  }

  /** Swap the active craft (from the hangar). */
  setShip(id: string) {
    const def = getShipDef(id);
    this.buildShip(def);
    this.sound.setVoice(def.sound);
  }

  /** Play a short signature rev of the current craft (hangar preview). */
  previewEngine() {
    this.sound.ensure();
    this.sound.rev(this.shipDef.sound);
  }

  /* ---------------- gyro / tilt steering ---------------- */

  private onOrient = (e: DeviceOrientationEvent) => {
    let g = e.gamma ?? 0; // left/right tilt
    let b = e.beta ?? 0; // front/back tilt
    // In landscape the axes swap — remap so tilt always feels natural.
    const angle = (screen.orientation?.angle ?? (window.orientation as number) ?? 0) || 0;
    if (angle === 90) {
      const t = g;
      g = -b;
      b = t;
    } else if (angle === 270 || angle === -90) {
      const t = g;
      g = b;
      b = -t;
    }
    if (!this.tiltReady) {
      this.tiltCalX = g;
      this.tiltCalY = b;
      this.tiltRawX = 0;
      this.tiltRawY = 0;
      this.tiltReady = true;
    }
    // deadzone + normalize over a comfortable ±22° travel
    const dz = 1.8;
    const nx = g - this.tiltCalX;
    const ny = b - this.tiltCalY;
    const ax = Math.abs(nx) < dz ? 0 : (nx - Math.sign(nx) * dz) / 22;
    const ay = Math.abs(ny) < dz ? 0 : (ny - Math.sign(ny) * dz) / 20;
    // low-pass filter kills gyro jitter (this is what made it feel weird)
    this.tiltRawX = this.tiltRawX * 0.82 + clamp(ax, -1, 1) * 0.18;
    this.tiltRawY = this.tiltRawY * 0.82 + clamp(ay, -1, 1) * 0.18;
    this.tiltX = this.tiltRawX * (this.gyroInv & 2 ? -1 : 1);
    this.tiltY = -this.tiltRawY * (this.gyroInv & 1 ? -1 : 1);
  };

  /** Ask for gyro permission (iOS 13+ requires a user gesture). */
  async enableTilt() {
    this.tiltOn = true;
    this.tiltReady = false;
    type DOE = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
    const DOEvt = DeviceOrientationEvent as DOE | undefined;
    try {
      if (DOEvt && typeof DOEvt.requestPermission === "function") {
        const res = await DOEvt.requestPermission();
        if (res !== "granted") {
          this.tiltOn = false;
          return false;
        }
      }
    } catch {
      this.tiltOn = false;
      return false;
    }
    window.addEventListener("deviceorientation", this.onOrient);
    return true;
  }

  disableTilt() {
    this.tiltOn = false;
    this.tiltReady = false;
    this.tiltX = 0;
    this.tiltY = 0;
    window.removeEventListener("deviceorientation", this.onOrient);
  }

  /** Re-center gyro neutral position to how the phone is held right now. */
  recenterTilt() {
    this.tiltReady = false;
  }

  startAttract(theme?: Theme) {
    this.level = null;
    this.isEndless = false;
    this.clearHazards();
    this.setTheme(theme ?? MENU_THEME);
    this.mode = "attract";
    this.countdown = -1;
    this.sound.engineSilent();
    this.setCursorHidden(false);
  }

  startLevel(level: LevelConfig) {
    this.sound.ensure();
    this.level = level;
    this.isEndless = !!level.endless;
    this.currentAccent = level.theme;
    this.clearHazards();
    this.setTheme(level.theme);
    // reset run
    this.score = 0;
    this.starCount = 0;
    this.maxHearts = this.shipDef.hull;
    this.hearts = this.shipDef.hull;
    this.boost = 100;
    this.dist = 0;
    this.speed = level.baseSpeed * 0.6;
    this.invuln = 0;
    this.spawnT = 1.15;
    this.phase = 0;
    this.finalShown = false;
    this.p01 = 0;
    this.trauma = 0;
    this.ship.position.set(0, 7.5, 0);
    this.ship.rotation.set(0, 0, 0);
    this.ship.visible = true;
    // reset flight physics + steering so every run starts clean
    this.tgtX = 0;
    this.tgtY = 7.5;
    this.velX = 0;
    this.velY = 0;
    this.dragX = 0;
    this.dragY = 0;
    this.bankZ = 0;
    this.pitchX = 0;
    this.touches.clear();
    this.abilityT = 0;
    this.abilityCd = 0;
    if (this.shieldMesh) this.shieldMesh.visible = false;
    this.modeT = 0;
    this.mode = "countdown";
    this.countdownT = 3.0;
    this.countdown = 3;
    this.sound.beep(false);
    this.setCursorHidden(true);
    this.pushHUD(true);
  }

  pause() {
    if (this.mode === "paused") return;
    this.prePause = this.mode;
    this.mode = "paused";
    this.sound.engineSilent();
    this.canvas.style.cursor = "";
  }

  /** Hide the cursor while flying, restore it in menus. */
  setCursorHidden(hidden: boolean) {
    this.canvas.style.cursor = hidden ? "none" : "";
  }

  resume() {
    if (this.mode !== "paused") return;
    this.mode = this.prePause === "paused" ? "playing" : this.prePause;
    this.last = performance.now();
    // drop stale touches / drag so the ship doesn't jump on resume
    this.touches.clear();
    this.dragX = 0;
    this.dragY = 0;
    this.fpsAcc = 0;
  }

  get isPaused() {
    return this.mode === "paused";
  }

  setBoostBtn(b: boolean) {
    this.boostBtn = b;
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.unbindInput();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
      else if (m) m.dispose();
    });
    this.groundTex.dispose();
    this.renderer.dispose();
  }

  /**
   * Dynamic resolution scaling — the trick every shipped mobile 3D game uses.
   * If we're missing the frame budget we shrink the render buffer (invisible at
   * speed); when there's headroom we grow it back toward native.
   */
  private adaptPerformance(dt: number) {
    if (!this.autoPerf || this.mode === "paused") return;
    this.perfSum += dt;
    this.perfFrames++;
    this.perfAcc += dt;
    if (this.perfAcc < 0.9) return;
    const avg = this.perfSum / Math.max(1, this.perfFrames);
    const fps = 1 / avg;
    this.perfAcc = 0;
    this.perfSum = 0;
    this.perfFrames = 0;

    const target = this.fpsLimit > 0 ? this.fpsLimit : this.isMobile ? 58 : 60;
    const prev = this.dynScale;
    if (fps < target * 0.82) this.dynScale = Math.max(0.55, this.dynScale - 0.1);
    else if (fps > target * 0.96 && this.dynScale < 1) this.dynScale = Math.min(1, this.dynScale + 0.05);
    if (Math.abs(prev - this.dynScale) > 0.001) {
      this.renderer.setPixelRatio(this.baseScale * this.dynScale);
      this.resize();
    }
  }

  resize = () => {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = this.camera.aspect < 0.8 ? 86 : 74;
    this.camera.updateProjectionMatrix();
  };

  /* ============================ BUILD ============================ */

  private buildLights() {
    this.hemi = new THREE.HemisphereLight(0x9a7fd6, 0x2a1e3f, 1.15);
    this.scene.add(this.hemi);
    this.dirLight = new THREE.DirectionalLight(0xffe0b8, 1.6);
    this.dirLight.position.set(30, 60, -80);
    this.scene.add(this.dirLight);
    this.scene.add(new THREE.AmbientLight(0x404060, 0.6));
  }

  private buildSky() {
    this.skyGeo = new THREE.SphereGeometry(400, this.isMobile ? 12 : 20, this.isMobile ? 8 : 12);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true, fog: false, depthWrite: false });
    this.skyMesh = new THREE.Mesh(this.skyGeo, mat);
    this.skyMesh.frustumCulled = false;
    this.scene.add(this.skyMesh);
  }

  private updateSkyColors() {
    const pos = this.skyGeo.getAttribute("position");
    let colAttr = this.skyGeo.getAttribute("color") as THREE.BufferAttribute | undefined;
    if (!colAttr) {
      colAttr = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
      this.skyGeo.setAttribute("color", colAttr);
    }
    const top = this.curC.skyTop;
    const bot = this.curC.skyBottom;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 400;
      const t = clamp(y * 1.4 + 0.28, 0, 1);
      this.tmpC.copy(bot).lerp(top, t);
      colAttr.setXYZ(i, this.tmpC.r, this.tmpC.g, this.tmpC.b);
    }
    colAttr.needsUpdate = true;
  }

  private makeGridCanvas(ground: number, grid: number): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = `#${ground.toString(16).padStart(6, "0")}`;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = `#${grid.toString(16).padStart(6, "0")}`;
    g.lineWidth = 4;
    g.strokeRect(0, 0, 128, 128);
    return c;
  }

  private buildGround() {
    this.groundTex = new THREE.CanvasTexture(this.makeGridCanvas(0x2a1e3f, 0xff9e73));
    this.groundTex.wrapS = this.groundTex.wrapT = THREE.RepeatWrapping;
    this.groundTex.repeat.set(36, 36);
    this.groundTex.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    this.groundMat = new THREE.MeshBasicMaterial({ map: this.groundTex, transparent: true, opacity: 0.9 });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(432, 432), this.groundMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0;
    this.scene.add(plane);
  }

  private buildSunAndStars() {
    this.sunMesh = new THREE.Mesh(
      new THREE.CircleGeometry(30, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false, transparent: true, opacity: 0.9 }),
    );
    this.sunMesh.position.set(34, 22, -330);
    this.scene.add(this.sunMesh);

    // glow sprite
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.35, "rgba(255,220,160,0.35)");
    grad.addColorStop(1, "rgba(255,220,160,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    this.sunGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, color: 0xffd9a0, fog: false, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.sunGlow.scale.set(240, 240, 1);
    this.sunGlow.position.copy(this.sunMesh.position);
    this.scene.add(this.sunGlow);

    // night stars
    const n = this.isMobile ? 150 : 340;
    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const el = rand(0.08, 1.35);
      const r = 350;
      positions[i * 3] = Math.cos(a) * Math.cos(el) * r;
      positions[i * 3 + 1] = Math.sin(el) * r;
      positions[i * 3 + 2] = Math.sin(a) * Math.cos(el) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.starsPts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xdfeaff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }),
    );
    this.starsPts.frustumCulled = false;
    this.scene.add(this.starsPts);
  }

  private buildPools() {
    const unit = new THREE.BoxGeometry(1, 1, 1);
    this.wallMat = new THREE.MeshStandardMaterial({ color: 0x33204f, roughness: 0.85, metalness: 0.15, flatShading: true });
    this.glowMat = new THREE.MeshBasicMaterial({ color: 0xffb066 });
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0x53e9ff, transparent: true, opacity: 0.92 });
    this.starMat = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.95 });
    this.repairMat = new THREE.MeshBasicMaterial({ color: 0x51ff8a, transparent: true, opacity: 0.95 });
    this.mtnNearMat = new THREE.MeshStandardMaterial({ color: 0x4a2b56, roughness: 1, flatShading: true });
    this.mtnFarMat = new THREE.MeshStandardMaterial({ color: 0x6b3a68, roughness: 1, flatShading: true });
    this.cloudMat = new THREE.MeshStandardMaterial({ color: 0xffe0cd, roughness: 1, flatShading: true, transparent: true, opacity: 0.5 });
    this.speedlineMat = new THREE.MeshBasicMaterial({ color: 0xfff3e8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });

    // mountains — fewer draw calls on mobile
    const cone = new THREE.ConeGeometry(1, 1, 6, 1);
    const mtnCount = this.isMobile ? 16 : 30;
    for (let i = 0; i < mtnCount; i++) {
      const m = new THREE.Mesh(cone, Math.random() > 0.5 ? this.mtnNearMat : this.mtnFarMat);
      this.recycleMountain(m, true);
      this.scene.add(m);
      this.mountains.push(m);
      this.mtnSpeeds.push(rand(0.9, 1));
    }

    // clouds
    const puff = new THREE.IcosahedronGeometry(1, 0);
    const cloudCount = this.isMobile ? 5 : 10;
    for (let i = 0; i < cloudCount; i++) {
      const grp = new THREE.Group();
      const n = this.isMobile ? 2 : 2 + Math.floor(rand(0, 3));
      for (let j = 0; j < n; j++) {
        const p = new THREE.Mesh(puff, this.cloudMat);
        p.position.set(rand(-4, 4), rand(-0.6, 0.8), rand(-1.5, 1.5));
        p.scale.set(rand(2.5, 5), rand(1.2, 2), rand(1.8, 3));
        grp.add(p);
      }
      grp.position.set(rand(-90, 90), rand(22, 48), rand(-TRACK_LEN, 20));
      this.scene.add(grp);
      this.clouds.push(grp);
    }

    // walls
    for (let i = 0; i < 9; i++) {
      const group = new THREE.Group();
      const panels: THREE.Mesh[] = [];
      const strips: THREE.Mesh[] = [];
      for (let j = 0; j < 4; j++) {
        const p = new THREE.Mesh(unit, this.wallMat);
        group.add(p);
        panels.push(p);
        const s = new THREE.Mesh(unit, this.glowMat);
        group.add(s);
        strips.push(s);
      }
      group.visible = false;
      this.scene.add(group);
      this.walls.push({
        group, panels, strips, active: false,
        hx: 0, hy: 0, hw: 1, hh: 1,
        slide: false, slideAmp: 0, slideSpeed: 0, slidePhase: 0,
        hit: false, cleared: false, clearance: 99,
      });
    }

    // pillars
    for (let i = 0; i < 9; i++) {
      const group = new THREE.Group();
      const boxes: THREE.Mesh[] = [];
      const caps: THREE.Mesh[] = [];
      for (let j = 0; j < 3; j++) {
        const b = new THREE.Mesh(unit, this.wallMat);
        const cap = new THREE.Mesh(unit, this.glowMat);
        group.add(b, cap);
        boxes.push(b);
        caps.push(cap);
      }
      group.visible = false;
      this.scene.add(group);
      this.pillars.push({
        group, boxes, caps,
        data: [{ x: 0, w: 1, h: 1 }, { x: 0, w: 1, h: 1 }, { x: 0, w: 1, h: 1 }],
        count: 0, active: false, hit: false, cleared: false, clearance: 99,
      });
    }

    // sweepers
    for (let i = 0; i < 6; i++) {
      const group = new THREE.Group();
      const blade = new THREE.Mesh(unit, this.wallMat);
      const g1 = new THREE.Mesh(unit, this.glowMat);
      const g2 = new THREE.Mesh(unit, this.glowMat);
      group.add(blade, g1, g2);
      group.visible = false;
      this.scene.add(group);
      this.sweepers.push({
        group, blade, glows: [g1, g2], active: false,
        amp: 8, speed: 1.2, phase: 0, centerX: 0, t: 0,
        hit: false, cleared: false,
      });
    }

    // rings
    const torusGeo = new THREE.TorusGeometry(2.45, 0.2, 8, 22);
    for (let i = 0; i < 8; i++) {
      const group = new THREE.Group();
      const torus = new THREE.Mesh(torusGeo, this.ringMat);
      group.add(torus);
      group.visible = false;
      this.scene.add(group);
      this.rings.push({ group, torus, active: false, x: 0, y: 0, r: 2.45, prevZ: -1, pulse: 0, done: false });
    }

    // stars / repair orbs
    const oct = new THREE.OctahedronGeometry(0.55);
    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(oct, this.starMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.starsPool.push({ mesh, active: false, repair: false, baseY: 4, phase: rand(0, 6), magnet: false });
    }

    /* ---------------- STAGE II: laser fences ---------------- */
    this.beamMat = new THREE.MeshBasicMaterial({
      color: 0xff3355, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.beamOffMat = new THREE.MeshBasicMaterial({
      color: 0x445566, transparent: true, opacity: 0.16, depthWrite: false,
    });
    for (let i = 0; i < 6; i++) {
      const group = new THREE.Group();
      const beams: THREE.Mesh[] = [];
      const emitters: THREE.Mesh[] = [];
      for (let j = 0; j < 4; j++) {
        const beam = new THREE.Mesh(unit, this.beamMat);
        beam.visible = false;
        group.add(beam);
        beams.push(beam);
        for (let k = 0; k < 2; k++) {
          const em = new THREE.Mesh(unit, this.wallMat);
          em.visible = false;
          group.add(em);
          emitters.push(em);
        }
      }
      group.visible = false;
      this.scene.add(group);
      this.lasers.push({
        group, emitters, beams, active: false, vertical: true, count: 0, coords: [],
        period: 2, offset: 0, duty: 0.55, on: true, hit: false, cleared: false,
      });
    }

    /* ---------------- STAGE II: rotor spinners ---------------- */
    for (let i = 0; i < 5; i++) {
      const group = new THREE.Group();
      const arms: THREE.Mesh[] = [];
      for (let j = 0; j < 4; j++) {
        const arm = new THREE.Mesh(unit, this.wallMat);
        arm.visible = false;
        group.add(arm);
        arms.push(arm);
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.4, 8), this.glowMat);
      hub.rotation.x = Math.PI / 2;
      group.add(hub);
      group.visible = false;
      this.scene.add(group);
      this.spinners.push({
        group, arms, hub, active: false, cx: 0, cy: 7, speed: 1.6,
        armLen: 6, armCount: 2, hit: false, cleared: false,
      });
    }

    /* ---------------- STAGE III: crushers ---------------- */
    for (let i = 0; i < 5; i++) {
      const group = new THREE.Group();
      const top = new THREE.Mesh(unit, this.wallMat);
      const bottom = new THREE.Mesh(unit, this.wallMat);
      const teethT = new THREE.Mesh(unit, this.glowMat);
      const teethB = new THREE.Mesh(unit, this.glowMat);
      group.add(top, bottom, teethT, teethB);
      group.visible = false;
      this.scene.add(group);
      this.crushers.push({
        group, top, bottom, teethT, teethB, active: false,
        period: 2.2, offset: 0, gapMin: 3.2, gapMax: 9, centerY: 7,
        gap: 9, hit: false, cleared: false,
      });
    }

    // speedlines
    const line = new THREE.BoxGeometry(0.06, 0.06, 7);
    const lineCount = this.isMobile ? 12 : 26;
    for (let i = 0; i < lineCount; i++) {
      const m = new THREE.Mesh(line, this.speedlineMat);
      m.position.set(this.randLineCoord(), rand(0.5, 16), rand(SPAWN_Z, 10));
      this.scene.add(m);
      this.speedlines.push(m);
    }
  }

  private randLineCoord() {
    return (Math.random() > 0.5 ? 1 : -1) * rand(10.5, 24);
  }

  /**
   * MODERN UI — a diegetic holographic rig that flies with the craft:
   * hull pips hover above the wings, a boost arc trails beneath it.
   */
  private buildDiegetic() {
    if (this.dieGroup) return;
    const g = new THREE.Group();
    const pipGeo = new THREE.OctahedronGeometry(0.17, 0);
    for (let i = 0; i < 5; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff4d5e, transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
      });
      const pip = new THREE.Mesh(pipGeo, mat);
      pip.renderOrder = 999;
      pip.visible = false;
      g.add(pip);
      this.diePips.push(pip);
    }
    // boost arc — a flat ring segment that fills as the cell recharges
    const arcMat = new THREE.MeshBasicMaterial({
      color: 0x53e9ff, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    });
    const arc = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.12, 28, 1, Math.PI * 0.18, Math.PI * 0.64), arcMat);
    arc.renderOrder = 999;
    g.add(arc);
    this.dieArc = arc;
    this.dieArcMat = arcMat;

    g.visible = false;
    this.scene.add(g);
    this.dieGroup = g;
  }

  private updateDiegetic(dt: number) {
    if (!this.dieGroup) return;
    const show = this.modernUi && (this.mode === "playing" || this.mode === "countdown");
    this.dieGroup.visible = show;
    if (!show) return;

    const sp = this.ship.position;
    this.dieGroup.position.set(sp.x, sp.y, 0.2);
    // face the camera so it always reads clearly
    this.dieGroup.quaternion.copy(this.camera.quaternion);
    this.dieGroup.rotation.z += this.bankZ * 0.4;

    // hull pips arc above the craft
    const n = this.maxHearts;
    for (let i = 0; i < this.diePips.length; i++) {
      const pip = this.diePips[i];
      if (i >= n) {
        pip.visible = false;
        continue;
      }
      pip.visible = true;
      const spread = 0.42;
      const x = (i - (n - 1) / 2) * spread;
      const lift = 1.15 - Math.abs(i - (n - 1) / 2) * 0.05;
      pip.position.set(x, lift + Math.sin(this.time * 3 + i) * 0.03, 0);
      pip.rotation.z = this.time * 1.6 + i;
      const alive = i < this.hearts;
      const mat = pip.material as THREE.MeshBasicMaterial;
      mat.opacity = alive ? (this.hearts <= 1 ? 0.6 + Math.sin(this.time * 12) * 0.4 : 0.95) : 0.14;
      pip.scale.setScalar(alive ? 1 : 0.62);
    }

    // boost arc beneath, colored by state
    if (this.dieArc && this.dieArcMat) {
      const b = this.boost / 100;
      this.dieArc.scale.set(1, 1, 1);
      this.dieArc.position.set(0, -0.15, 0);
      this.dieArc.rotation.z = Math.PI;
      this.dieArcMat.opacity = 0.18 + b * 0.62;
      const boosting = this.isBoosting();
      this.tmpC.setHex(boosting ? 0xffb03a : b > 0.98 ? 0xffffff : this.shipDef.glowColor);
      this.dieArcMat.color.lerp(this.tmpC, 1 - Math.exp(-10 * dt));
      this.dieArc.scale.setScalar(0.86 + b * 0.24);
    }
  }

  /** Build (or rebuild) the player craft from a ship definition. */
  buildShip(def: ShipDef = this.shipDef) {
    this.shipDef = def;
    // tear down the previous craft
    if (this.built) {
      this.ship.remove(this.built.group);
      this.built.dispose();
      this.built = null;
    }
    const built = buildShipMesh(def);
    this.built = built;
    this.ship.add(built.group);
    this.engineGlowL = built.glowL;
    this.engineGlowR = built.glowR;
    this.thrusterMat = built.thrusterMat;

    // shield / ram bubble (built once, reused)
    if (!this.shieldMesh) {
      const sh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          color: 0x53e9ff, wireframe: true, transparent: true, opacity: 0.5,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      sh.visible = false;
      this.shieldMesh = sh;
      this.scene.add(sh);
    }

    this.ship.position.set(0, 7.5, 0);
    if (!this.ship.parent) this.scene.add(this.ship);
  }



  private buildTrail() {
    this.trailPos = new Float32Array(this.TRAIL_N * 3).fill(-999);
    this.trailCol = new Float32Array(this.TRAIL_N * 3);
    this.trailBoost = new Float32Array(this.TRAIL_N);
    this.trailVX = new Float32Array(this.TRAIL_N);
    this.trailVY = new Float32Array(this.TRAIL_N);
    this.trailAges = new Float32Array(this.TRAIL_N).fill(99);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.trailPos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("color", new THREE.BufferAttribute(this.trailCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.trailPts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.34, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.trailPts.frustumCulled = false;
    this.scene.add(this.trailPts);
  }

  private buildExplosion() {
    const N = this.isMobile ? 44 : 80;
    this.boomPos = new Float32Array(N * 3).fill(-999);
    this.boomCol = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      this.sparks.push({ alive: false, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.boomPos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("color", new THREE.BufferAttribute(this.boomCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.boomPts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.5, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.boomPts.frustumCulled = false;
    this.scene.add(this.boomPts);
  }

  /* ============================ THEMES ============================ */

  setTheme(theme: Theme, instant = false) {
    this.currentAccent = theme;
    for (const k of COLOR_KEYS) {
      const hex = theme[k] as number;
      if (!this.tgtC[k]) {
        this.tgtC[k] = new THREE.Color(hex);
        this.curC[k] = new THREE.Color(hex);
      } else this.tgtC[k].setHex(hex);
    }
    this.tgtFogNear = theme.fogNear;
    this.tgtFogFar = theme.fogFar;
    this.tgtSunVis = theme.sunVis;
    this.tgtCloudOp = theme.cloudOp;
    this.tgtStarsOp = theme.night ? 0.9 : 0;
    this.sunMesh.position.set(...theme.sunPos);
    this.sunGlow.position.set(...theme.sunPos);
    this.dirLight.position.set(theme.sunPos[0], Math.max(40, theme.sunPos[1] + 40), -80);

    // instant swaps that live inside textures
    const ctx = this.groundTex.image.getContext("2d") as CanvasRenderingContext2D;
    ctx.fillStyle = `#${theme.ground.toString(16).padStart(6, "0")}`;
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = `#${theme.grid.toString(16).padStart(6, "0")}`;
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 128, 128);
    this.groundTex.needsUpdate = true;
    this.groundMat.opacity = theme.gridOpacity + 0.5;

    if (instant) {
      for (const k of COLOR_KEYS) this.curC[k].copy(this.tgtC[k]);
      this.curFogNear = this.tgtFogNear;
      this.curFogFar = this.tgtFogFar;
      this.curSunVis = this.tgtSunVis;
      this.curCloudOp = this.tgtCloudOp;
      this.curStarsOp = this.tgtStarsOp;
      this.transitioning = false;
      this.applyThemeFrame();
      this.updateSkyColors();
    } else {
      this.transitioning = true;
    }
  }

  private applyThemeFrame() {
    const c = this.curC;
    (this.scene.fog as THREE.Fog).color.copy(c.fog);
    (this.scene.fog as THREE.Fog).near = this.curFogNear;
    (this.scene.fog as THREE.Fog).far = this.curFogFar;
    this.scene.background = c.fog;
    this.hemi.color.copy(c.hemiSky);
    this.hemi.groundColor.copy(c.hemiGround);
    this.dirLight.color.copy(c.dir);
    this.mtnNearMat.color.copy(c.mtnNear);
    this.mtnFarMat.color.copy(c.mtnFar);
    this.wallMat.color.copy(c.wall);
    this.glowMat.color.copy(c.glow);
    this.ringMat.color.copy(c.ring);
    this.starMat.color.copy(c.star);
    const sm = this.sunMesh.material as THREE.MeshBasicMaterial;
    sm.opacity = this.curSunVis;
    sm.color.copy(c.sun);
    const sg = this.sunGlow.material as THREE.SpriteMaterial;
    sg.color.copy(c.sun);
    sg.opacity = this.curSunVis * 0.55;
    this.cloudMat.color.copy(c.cloud);
    this.cloudMat.opacity = this.curCloudOp;
    (this.starsPts.material as THREE.PointsMaterial).opacity = this.curStarsOp;
    this.speedlineMat.color.copy(c.speedline);
  }

  private updateThemeTransition(dt: number) {
    if (!this.transitioning) return;
    const k = 1 - Math.exp(-2.6 * dt);
    let settled = true;
    for (const key of COLOR_KEYS) {
      this.curC[key].lerp(this.tgtC[key], k);
      if (Math.abs(this.curC[key].r - this.tgtC[key].r) > 0.004) settled = false;
    }
    this.curFogNear = damp(this.curFogNear, this.tgtFogNear * (this.isMobile ? 0.82 : 1), 2.6, dt);
    this.curFogFar = damp(this.curFogFar, this.tgtFogFar * (this.isMobile ? 0.78 : 1), 2.6, dt);
    this.curSunVis = damp(this.curSunVis, this.tgtSunVis, 2.6, dt);
    this.curCloudOp = damp(this.curCloudOp, this.tgtCloudOp, 2.6, dt);
    this.curStarsOp = damp(this.curStarsOp, this.tgtStarsOp, 2.6, dt);
    this.applyThemeFrame();
    this.updateSkyColors();
    if (settled && Math.abs(this.curFogNear - this.tgtFogNear) < 0.5) this.transitioning = false;
  }

  /* ============================ INPUT ============================ */

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      // RELATIVE DRAG: accumulate finger movement, like top mobile games.
      // Any finger steers — including the one holding the boost button.
      const t = this.touches.get(e.pointerId);
      if (!t) return;
      // coalesced events give sub-frame precision = smoother tracking
      const evts = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
      if (evts.length) {
        for (const ev of evts) {
          this.dragX += ev.clientX - t.x;
          this.dragY += ev.clientY - t.y;
          t.x = ev.clientX;
          t.y = ev.clientY;
        }
      } else {
        this.dragX += e.clientX - t.x;
        this.dragY += e.clientY - t.y;
        t.x = e.clientX;
        t.y = e.clientY;
      }
      this.pointerSeen = true;
    } else {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.pointerX = clamp((e.clientX / w) * 2 - 1, -1, 1);
      this.pointerY = clamp(-((e.clientY / h) * 2 - 1), -1, 1);
      this.pointerSeen = true;
    }
  };

  private onPointerDown = (e: PointerEvent) => {
    this.sound.ensure();
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      // UI elements marked data-nosteer (pause btn) must not drag the ship
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("[data-nosteer]")) return;
      this.touchMode = true;
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    } else if (e.button === 0) {
      this.mouseBoost = true;
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      this.touches.delete(e.pointerId);
    } else this.mouseBoost = false;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    this.sound.ensure();
    if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
    if (e.code === "Escape" || e.code === "KeyP") {
      this.events.onTogglePause();
      return;
    }
    if (e.code === "KeyE" || e.code === "KeyQ" || e.code === "KeyF") {
      this.activateAbility();
      return;
    }
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onVis = () => {
    if (document.hidden && (this.mode === "playing" || this.mode === "countdown")) {
      this.events.onAutoPause();
    }
  };

  private bindInput() {
    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    window.addEventListener("pointerdown", this.onPointerDown, { passive: true });
    window.addEventListener("pointerup", this.onPointerUp, { passive: true });
    window.addEventListener("pointercancel", this.onPointerUp, { passive: true });
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.onVis);
  }

  private unbindInput() {
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.onVis);
  }

  /* ============================ SPAWNING ============================ */

  private recycleMountain(m: THREE.Mesh, initial = false) {
    const side = Math.random() > 0.5 ? 1 : -1;
    const far = Math.random() > 0.45;
    const h = far ? rand(14, 34) : rand(6, 16);
    m.scale.set(rand(5, 13), h, rand(5, 13));
    m.position.set(
      side * (far ? rand(46, 95) : rand(24, 46)),
      h / 2 - rand(0.5, 2),
      initial ? rand(-TRACK_LEN - 20, 26) : m.position.z - TRACK_LEN,
    );
    if (!initial && m.position.z < -TRACK_LEN - 30) m.position.z += TRACK_LEN;
    m.visible = Math.abs(m.position.x) < 120;
  }

  private clearHazards() {
    for (const w of this.walls) { w.active = false; w.group.visible = false; }
    for (const p of this.pillars) { p.active = false; p.group.visible = false; }
    for (const s of this.sweepers) { s.active = false; s.group.visible = false; }
    for (const r of this.rings) { r.active = false; r.group.visible = false; }
    for (const s of this.starsPool) { s.active = false; s.mesh.visible = false; }
    for (const l of this.lasers) { l.active = false; l.group.visible = false; }
    for (const s of this.spinners) { s.active = false; s.group.visible = false; }
    for (const c of this.crushers) { c.active = false; c.group.visible = false; }
    for (const sp of this.sparks) { sp.alive = false; sp.y = -999; }
    this.boomActive = false;
    for (let i = 0; i < this.TRAIL_N; i++) this.trailAges[i] = 99;
  }

  private freeStar(x: number, y: number, z: number, repair = false) {
    const s = this.starsPool.find((v) => !v.active);
    if (!s) return;
    s.active = true;
    s.repair = repair;
    s.magnet = false;
    s.mesh.material = repair ? this.repairMat : this.starMat;
    s.mesh.scale.setScalar(repair ? 1.25 : 1);
    s.baseY = y;
    s.mesh.position.set(x, y, z);
    s.mesh.visible = true;
  }

  private spawnWall(slide: boolean) {
    const w = this.walls.find((v) => !v.active);
    if (!w) return;
    const lvl = this.level;
    const narrow = 1 - Math.min(0.32, (lvl ? lvl.id : 0) * 0.055 + (this.isEndless ? this.phase * 0.05 : 0));
    w.hw = rand(5.6, 7) * narrow;
    w.hh = rand(4.6, 5.8) * narrow;
    w.hx = rand(-8.5, 8.5);
    w.hy = rand(5.5, 11);
    w.slide = slide;
    if (slide) {
      const headroom = Math.max(0, 16 - (10.5 + w.hw / 2));
      w.slideAmp = rand(3.5, Math.max(4, Math.min(7.5, headroom)));
      w.slideSpeed = rand(0.85, 1.45);
      w.slidePhase = rand(0, Math.PI * 2);
    } else {
      w.slideAmp = 0;
    }
    w.hit = false;
    w.cleared = false;
    w.clearance = 99;
    w.active = true;
    const g = w.group;
    g.visible = true;
    g.position.set(0, 0, SPAWN_Z);
    g.rotation.set(0, 0, 0);

    const [left, right, bottom, top] = w.panels;
    const L = w.hx - w.hw / 2 + 16;
    left.visible = L > 0.1;
    left.scale.set(Math.max(L, 0.01), 20, 1.2);
    left.position.set(-16 + L / 2, 10, 0);
    const R = 16 - (w.hx + w.hw / 2);
    right.visible = R > 0.1;
    right.scale.set(Math.max(R, 0.01), 20, 1.2);
    right.position.set(w.hx + w.hw / 2 + R / 2, 10, 0);
    const B = w.hy - w.hh / 2;
    bottom.visible = B > 0.15;
    bottom.scale.set(32, Math.max(B, 0.01), 1.2);
    bottom.position.set(0, B / 2, 0);
    const T = 20 - (w.hy + w.hh / 2);
    top.visible = T > 0.15;
    top.scale.set(32, Math.max(T, 0.01), 1.2);
    top.position.set(0, (20 + w.hy + w.hh / 2) / 2, 0);

    const [s1, s2, s3, s4] = w.strips;
    // vertical strips at hole sides
    s1.scale.set(0.16, w.hh, 1.45);
    s1.position.set(w.hx - w.hw / 2, w.hy, 0);
    s2.scale.set(0.16, w.hh, 1.45);
    s2.position.set(w.hx + w.hw / 2, w.hy, 0);
    s3.scale.set(w.hw, 0.16, 1.45);
    s3.position.set(w.hx, w.hy - w.hh / 2, 0);
    s4.scale.set(w.hw, 0.16, 1.45);
    s4.position.set(w.hx, w.hy + w.hh / 2, 0);

    if (Math.random() < 0.5) this.freeStar(w.hx, w.hy, SPAWN_Z + rand(-1, 1));
  }

  private spawnPillars() {
    const p = this.pillars.find((v) => !v.active);
    if (!p) return;
    p.hit = false;
    p.cleared = false;
    p.clearance = 99;
    p.active = true;
    p.group.visible = true;
    p.group.position.set(0, 0, SPAWN_Z);

    const gx = rand(-7.5, 7.5);
    const gapW = rand(6.6, 8.4);
    let idx = 0;
    const place = (cx: number, w_: number, h: number) => {
      p.data[idx].x = cx;
      p.data[idx].w = w_;
      p.data[idx].h = h;
      const b = p.boxes[idx];
      b.visible = true;
      b.scale.set(w_, h, 1.8);
      b.position.set(cx, h / 2, 0);
      const cap = p.caps[idx];
      cap.visible = true;
      cap.scale.set(w_ + 0.08, 0.2, 2);
      cap.position.set(cx, h, 0);
      idx++;
    };

    // left region
    const lMin = -15, lMax = gx - gapW / 2;
    if (lMax - lMin > 3) {
      const w_ = rand(2.6, Math.min(4.4, (lMax - lMin) * 0.7));
      place(rand(lMin + w_ / 2, lMax - w_ / 2), w_, Math.random() < 0.8 ? 17 : 4.2);
    }
    // right region
    const rMin = gx + gapW / 2, rMax = 15;
    if (rMax - rMin > 3) {
      const w_ = rand(2.6, Math.min(4.4, (rMax - rMin) * 0.7));
      place(rand(rMin + w_ / 2, rMax - w_ / 2), w_, Math.random() < 0.8 ? 17 : 4.2);
    }
    // occasional low hop-block near the gap edge
    if (Math.random() < 0.5) {
      place(gx + rand(-gapW / 2, gapW / 2), rand(2, 3), 3.4);
    }
    p.count = idx;
    for (let j = idx; j < 3; j++) {
      p.boxes[j].visible = false;
      p.caps[j].visible = false;
    }
    if (Math.random() < 0.45) this.freeStar(gx, rand(5, 10), SPAWN_Z + rand(-1, 1));
  }

  private spawnSweeper() {
    const s = this.sweepers.find((v) => !v.active);
    if (!s) return;
    s.active = true;
    s.hit = false;
    s.cleared = false;
    s.centerX = rand(-3, 3);
    s.amp = rand(6.5, 10.5);
    s.speed = rand(1.4, 2.3) * (Math.random() > 0.5 ? 1 : -1);
    s.phase = rand(0, Math.PI * 2);
    s.t = 0;
    const g = s.group;
    g.visible = true;
    g.position.set(0, 0, SPAWN_Z);
    const h = 11, y0 = 2;
    s.blade.scale.set(2.6, h, 1.2);
    s.blade.position.set(s.centerX, y0 + h / 2, 0);
    s.glows[0].scale.set(2.8, 0.2, 1.4);
    s.glows[1].scale.set(2.8, 0.2, 1.4);
    s.glows[0].position.set(s.centerX, y0, 0);
    s.glows[1].position.set(s.centerX, y0 + h, 0);
  }

  private spawnRing() {
    const r = this.rings.find((v) => !v.active);
    if (!r) return;
    r.active = true;
    r.done = false;
    r.pulse = 0;
    r.x = rand(-10, 10);
    r.y = rand(4.5, 12);
    r.group.position.set(r.x, r.y, SPAWN_Z);
    r.group.scale.setScalar(1);
    r.group.rotation.set(0, 0, 0);
    r.prevZ = SPAWN_Z;
    r.group.visible = true;
    // trail of stars leading to the ring
    if (Math.random() < 0.7) {
      for (let i = 1; i <= 3; i++) {
        this.freeStar(r.x + rand(-1, 1) * (3 - i), r.y + rand(-1, 1) * (3 - i), SPAWN_Z + i * 10);
      }
    }
  }

  /* ---------------- STAGE II — laser fence ---------------- */
  private spawnLaser() {
    const l = this.lasers.find((v) => !v.active);
    if (!l) return;
    l.active = true;
    l.hit = false;
    l.cleared = false;
    l.vertical = Math.random() > 0.42;
    l.period = rand(1.5, 2.6);
    l.offset = rand(0, l.period);
    l.duty = rand(0.42, 0.6);
    l.on = true;
    l.coords = [];
    l.group.position.set(0, 0, SPAWN_Z);
    l.group.visible = true;

    const n = l.vertical ? randInt(2, 3) : randInt(2, 3);
    l.count = n;
    // evenly spread beams with a guaranteed survivable gap
    if (l.vertical) {
      const span = 30;
      const step = span / (n + 1);
      for (let i = 0; i < n; i++) l.coords.push(-15 + step * (i + 1) + rand(-1.5, 1.5));
    } else {
      const lo = 2.5, hi = 14;
      const step = (hi - lo) / (n + 1);
      for (let i = 0; i < n; i++) l.coords.push(lo + step * (i + 1) + rand(-1, 1));
    }

    for (let i = 0; i < l.beams.length; i++) {
      const beam = l.beams[i];
      const e1 = l.emitters[i * 2];
      const e2 = l.emitters[i * 2 + 1];
      if (i >= n) {
        beam.visible = e1.visible = e2.visible = false;
        continue;
      }
      beam.visible = e1.visible = e2.visible = true;
      const c = l.coords[i];
      if (l.vertical) {
        beam.scale.set(0.36, 20, 0.36);
        beam.position.set(c, 10, 0);
        e1.scale.set(1.1, 1.1, 1.4);
        e1.position.set(c, 0.3, 0);
        e2.scale.set(1.1, 1.1, 1.4);
        e2.position.set(c, 19.7, 0);
      } else {
        beam.scale.set(32, 0.36, 0.36);
        beam.position.set(0, c, 0);
        e1.scale.set(1.4, 1.1, 1.4);
        e1.position.set(-15.5, c, 0);
        e2.scale.set(1.4, 1.1, 1.4);
        e2.position.set(15.5, c, 0);
      }
    }
    if (Math.random() < 0.5) {
      // reward star placed in a safe lane
      const safe = l.vertical
        ? (l.coords[0] + (l.coords[1] ?? l.coords[0] + 8)) / 2
        : rand(-9, 9);
      const sy = l.vertical ? rand(4, 11) : (l.coords[0] + (l.coords[1] ?? l.coords[0] + 4)) / 2;
      this.freeStar(l.vertical ? safe : sy * 0 + safe, sy, SPAWN_Z + rand(-2, 2));
    }
  }

  /* ---------------- STAGE II — rotor spinner ---------------- */
  private spawnSpinner() {
    const s = this.spinners.find((v) => !v.active);
    if (!s) return;
    s.active = true;
    s.hit = false;
    s.cleared = false;
    s.cx = rand(-6, 6);
    s.cy = rand(6, 9.5);
    s.armLen = rand(5, 7.5);
    s.armCount = Math.random() > 0.45 ? 2 : 3;
    s.speed = rand(1.3, 2.4) * (Math.random() > 0.5 ? 1 : -1);
    s.group.position.set(s.cx, s.cy, SPAWN_Z);
    s.group.rotation.z = rand(0, Math.PI * 2);
    s.group.visible = true;
    for (let i = 0; i < s.arms.length; i++) {
      const a = s.arms[i];
      if (i >= s.armCount) {
        a.visible = false;
        continue;
      }
      a.visible = true;
      a.scale.set(s.armLen, 0.62, 1.3);
      // arms radiate from the hub
      const ang = (i / s.armCount) * Math.PI * 2;
      a.position.set(Math.cos(ang) * s.armLen * 0.5, Math.sin(ang) * s.armLen * 0.5, 0);
      a.rotation.z = ang;
    }
    if (Math.random() < 0.5) this.freeStar(s.cx, s.cy, SPAWN_Z + rand(-2, 2));
  }

  /* ---------------- STAGE III — crusher ---------------- */
  private spawnCrusher() {
    const c = this.crushers.find((v) => !v.active);
    if (!c) return;
    c.active = true;
    c.hit = false;
    c.cleared = false;
    c.period = rand(1.6, 2.6);
    c.offset = rand(0, c.period);
    c.gapMin = rand(2.8, 3.8);
    c.gapMax = rand(8.5, 11);
    c.centerY = rand(6, 9);
    c.gap = c.gapMax;
    c.group.position.set(0, 0, SPAWN_Z);
    c.group.visible = true;
    if (Math.random() < 0.55) this.freeStar(rand(-8, 8), c.centerY, SPAWN_Z + rand(-2, 2));
  }

  private spawnStarLine() {
    const cx = rand(-10, 10);
    const cy = rand(4, 11);
    for (let i = 0; i < 4; i++) {
      this.freeStar(cx + Math.sin(i * 0.9) * 3, cy + Math.cos(i * 0.7) * 1.5, SPAWN_Z - i * 9);
    }
  }

  private spawner(dt: number) {
    const lv = this.level;
    if (!lv) return;
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    const interval = lerp(lv.spawnStart, lv.spawnMin, this.p01) * rand(0.85, 1.22);
    this.spawnT = interval;

    if (this.hearts < 3 && Math.random() < 0.07) {
      this.freeStar(rand(-10, 10), rand(4, 11), SPAWN_Z, true);
      return;
    }

    const w = lv.weights;
    // endless mode ramps in the advanced hazards as phases climb
    const adv = this.isEndless ? Math.min(1, this.phase / 3) : 1;
    const kind = pickWeighted([
      ["wall", w.wall],
      ["slide", w.slide],
      ["pillars", w.pillars],
      ["sweeper", w.sweeper],
      ["ring", w.ring],
      ["laser", w.laser * adv],
      ["spinner", w.spinner * adv],
      ["crusher", w.crusher * adv],
    ]);
    if (kind === "wall") this.spawnWall(false);
    else if (kind === "slide") this.spawnWall(true);
    else if (kind === "pillars") this.spawnPillars();
    else if (kind === "sweeper") this.spawnSweeper();
    else if (kind === "laser") this.spawnLaser();
    else if (kind === "spinner") this.spawnSpinner();
    else if (kind === "crusher") this.spawnCrusher();
    else this.spawnRing();

    if (Math.random() < lv.starChance) this.spawnStarLine();
  }

  /* ============================ COMBAT ============================ */

  private damage() {
    if (this.mode !== "playing") return;
    // RAM PLATE / GHOST PHASE / SHIELD absorb the hit and shatter the structure
    if (this.abilityT > 0) {
      const id = this.shipDef.ability;
      if (id === "ram" || id === "phase" || id === "shield") {
        if (id === "ram") {
          this.burst(this.ship.position.x, this.ship.position.y, 0);
          this.score += 40 * this.scoreMult();
          this.trauma = Math.min(1, this.trauma + 0.35);
          this.sound.hit();
          this.vibrate(20);
        }
        return;
      }
    }
    if (this.invuln > 0) return;
    this.hearts -= 1;
    this.invuln = 1.8;
    this.trauma = Math.min(1, this.trauma + 0.75);
    this.sound.hit();
    this.vibrate(this.hearts <= 0 ? [90, 55, 160] : 55);
    this.events.onDamage();
    this.pushHUD(true);
    if (this.hearts <= 0) {
      this.mode = "dying";
      this.modeT = 0;
      this.dieVY = 5;
      this.trauma = 1.4;
      this.sound.death();
      this.sound.engineSilent();
      this.burst(this.ship.position.x, this.ship.position.y, 0);
    } else {
      const spd = this.speed;
      for (let i = 0; i < 14; i++) {
        const s = this.sparks.find((v) => !v.alive);
        if (!s) break;
        s.alive = true;
        s.x = this.ship.position.x + rand(-0.5, 0.5);
        s.y = this.ship.position.y + rand(-0.5, 0.5);
        s.z = rand(-0.5, 0.5);
        s.vx = rand(-6, 6);
        s.vy = rand(-2, 6);
        s.vz = spd * 0.4 + rand(0, 8);
        s.age = 0;
        s.life = rand(0.3, 0.7);
      }
    }
  }

  /* ---------------- ABILITY SYSTEM ---------------- */

  /** True while the craft cannot be harmed by structures. */
  private isIntangible() {
    return this.invuln > 0 || this.abilityT > 0 && (this.shipDef.ability === "phase" || this.shipDef.ability === "shield" || this.shipDef.ability === "ram");
  }

  private scoreMult() {
    let m = this.isBoosting() ? 2 : 1;
    if (this.abilityT > 0 && this.shipDef.ability === "magnet") m *= 3;
    return m;
  }

  /** Player pressed the ability key/button. */
  activateAbility() {
    if (this.mode !== "playing" || this.abilityCd > 0 || this.abilityT > 0) return;
    const a = ABILITIES[this.shipDef.ability];
    this.abilityCd = a.cooldown;
    this.abilityT = a.duration;
    this.vibrate(35);
    this.sound.ring();
    this.events.onToast(a.name, "bonus");

    if (a.id === "surge") {
      this.hearts = Math.min(this.maxHearts, this.hearts + 1);
      this.boost = 100;
      this.sound.repair();
    } else if (a.id === "magnet") {
      // yank every on-screen star toward the ship
      for (const s of this.starsPool) {
        if (s.active && s.mesh.position.z < 6) s.magnet = true;
      }
    }
    this.pushHUD(true);
  }

  private updateAbility(dt: number) {
    if (this.abilityCd > 0) this.abilityCd = Math.max(0, this.abilityCd - dt);
    if (this.abilityT > 0) {
      this.abilityT = Math.max(0, this.abilityT - dt);
      if (this.abilityT === 0) this.events.onToast("ABILITY ENDED", "info");
    }
    const on = this.abilityT > 0;
    const id = this.shipDef.ability;

    // visual: ghost phase makes the hull translucent
    if (id === "phase") {
      this.ship.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (m && "opacity" in m) {
          (m as THREE.MeshStandardMaterial).transparent = true;
          (m as THREE.MeshStandardMaterial).opacity = on ? 0.35 : 1;
        }
      });
    }
    // shield bubble
    if (this.shieldMesh) {
      const showShield = on && (id === "shield" || id === "ram");
      this.shieldMesh.visible = showShield;
      if (showShield) {
        this.shieldMesh.position.copy(this.ship.position);
        const p = 1 + Math.sin(this.time * 9) * 0.05;
        this.shieldMesh.scale.setScalar(p * 1.9);
        this.shieldMesh.rotation.y += dt * 1.2;
        (this.shieldMesh.material as THREE.MeshBasicMaterial).color.setHex(id === "ram" ? 0xff7a2f : 0x53e9ff);
      }
    }
  }

  /** Time-scale applied by TIME DILATION. */
  private timeScale() {
    return this.abilityT > 0 && this.shipDef.ability === "slowmo" ? 0.45 : 1;
  }

  /** Mobile haptics — silently ignored on desktop. */
  private vibrate(pattern: number | number[]) {
    if (!this.vibrateOn) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* unsupported */
    }
  }

  private burst(x: number, y: number, z: number) {
    let spawned = 0;
    for (const s of this.sparks) {
      if (s.alive) continue;
      s.alive = true;
      s.x = x; s.y = y; s.z = z;
      const a = rand(0, Math.PI * 2);
      const el = rand(-1, 1);
      const sp = rand(5, 24);
      s.vx = Math.cos(a) * Math.cos(el) * sp;
      s.vy = Math.sin(el) * sp;
      s.vz = Math.abs(Math.sin(a) * Math.cos(el) * sp) * 0.6 + 6;
      s.age = 0;
      s.life = rand(0.6, 1.5);
      if (++spawned >= 64) break;
    }
    this.boomActive = true;
  }

  private nearMissBonus() {
    this.score += 15 * (this.isBoosting() ? 2 : 1);
    this.sound.nearMiss();
    this.events.onToast("NEAR MISS +15", "bonus");
  }

  /* ============================ ENT UPDATES ============================ */

  private isBoosting() {
    // A SECOND finger anywhere on screen = boost (held only, releases instantly)
    const twoFinger = this.touches.size >= 2;
    return (
      (this.mouseBoost || this.boostBtn || twoFinger ||
        this.keys.has("Space") || this.keys.has("ShiftLeft") || this.keys.has("ShiftRight")) &&
      this.boost > 0.5 &&
      this.mode === "playing"
    );
  }

  private updateWalls(dt: number) {
    const sx = this.ship.position.x;
    const sy = this.ship.position.y;
    for (const w of this.walls) {
      if (!w.active) continue;
      const g = w.group;
      g.position.z += this.speed * dt;
      if (w.slide) g.position.x = Math.sin(this.time * w.slideSpeed + w.slidePhase) * w.slideAmp;
      const z = g.position.z;
      if (!w.cleared && Math.abs(z) < 6) {
        const hxw = w.hx + g.position.x;
        const clX = Math.abs(sx - hxw) - w.hw / 2 + 0.12;
        const clY = Math.abs(sy - w.hy) - w.hh / 2 + 0.12;
        w.clearance = Math.min(w.clearance, Math.max(clX, clY));
      }
      const cw = this.speed * dt * 0.5 + 0.75;
      if (!w.hit && !w.cleared && Math.abs(z) < cw) {
        const hxw = w.hx + g.position.x;
        const inHole = Math.abs(sx - hxw) < w.hw / 2 - 0.05 && Math.abs(sy - w.hy) < w.hh / 2 - 0.05;
        if (!inHole) {
          w.hit = true;
          w.cleared = true;
          this.damage();
        }
      }
      if (!w.cleared && z > cw) {
        w.cleared = true;
        if (!w.hit && this.mode === "playing") {
          if (w.clearance < 1.5) this.nearMissBonus();
          else {
            this.score += 10 * (this.isBoosting() ? 2 : 1);
            this.sound.gateClear();
          }
        }
      }
      if (z > 16) {
        w.active = false;
        g.visible = false;
      }
    }
  }

  private updatePillars(dt: number) {
    const sx = this.ship.position.x;
    const sy = this.ship.position.y;
    for (const p of this.pillars) {
      if (!p.active) continue;
      p.group.position.z += this.speed * dt;
      const z = p.group.position.z;
      if (!p.cleared && Math.abs(z) < 6) {
        for (let i = 0; i < p.count; i++) {
          const d = p.data[i];
          const cl = Math.max(Math.abs(sx - d.x) - d.w / 2 - SHIP_R, sy - 0.4 - d.h);
          p.clearance = Math.min(p.clearance, cl);
        }
      }
      const cw = this.speed * dt * 0.5 + 0.9;
      if (!p.hit && !p.cleared && Math.abs(z) < cw) {
        for (let i = 0; i < p.count; i++) {
          const d = p.data[i];
          if (Math.abs(sx - d.x) < d.w / 2 + SHIP_R * 0.8 && sy - 0.35 < d.h) {
            p.hit = true;
            p.cleared = true;
            this.damage();
            break;
          }
        }
      }
      if (!p.cleared && z > cw) {
        p.cleared = true;
        if (!p.hit && this.mode === "playing") {
          if (p.clearance < 1.5) this.nearMissBonus();
          else this.score += 10 * (this.isBoosting() ? 2 : 1);
        }
      }
      if (z > 16) {
        p.active = false;
        p.group.visible = false;
      }
    }
  }

  private updateSweepers(dt: number) {
    const sx = this.ship.position.x;
    const sy = this.ship.position.y;
    for (const s of this.sweepers) {
      if (!s.active) continue;
      s.t += dt;
      s.group.position.z += this.speed * dt;
      const bx = s.centerX + Math.sin(s.t * s.speed + s.phase) * s.amp;
      s.blade.position.x = bx;
      s.glows[0].position.x = bx;
      s.glows[1].position.x = bx;
      const z = s.group.position.z;
      const cw = this.speed * dt * 0.5 + 0.7;
      if (!s.hit && !s.cleared && Math.abs(z) < cw) {
        if (Math.abs(sx - bx) < 1.3 + SHIP_R * 0.7 && sy > 1.55 && sy < 13.05) {
          s.hit = true;
          s.cleared = true;
          this.damage();
        }
      }
      if (!s.cleared && z > cw) {
        s.cleared = true;
        if (!s.hit && this.mode === "playing") this.score += 10 * (this.isBoosting() ? 2 : 1);
      }
      if (z > 16) {
        s.active = false;
        s.group.visible = false;
      }
    }
  }

  private updateRings(dt: number) {
    const sx = this.ship.position.x;
    const sy = this.ship.position.y;
    for (const r of this.rings) {
      if (!r.active) continue;
      r.prevZ = r.group.position.z;
      r.group.position.z += this.speed * dt;
      const z = r.group.position.z;
      r.torus.rotation.z += dt * 0.6;
      if (r.pulse > 0) {
        r.pulse = Math.max(0, r.pulse - dt * 3);
        r.group.scale.setScalar(1 + r.pulse * 0.55);
      }
      if (this.mode !== "playing") {
        if (z > 16) {
          r.active = false;
          r.group.visible = false;
        }
        continue;
      }
      if (!r.done && r.prevZ < 0 && z >= 0) {
        r.done = true;
        const d = Math.hypot(sx - r.x, sy - r.y);
        if (d < r.r - 0.45) {
          const mult = this.isBoosting() ? 2 : 1;
          this.score += 50 * mult;
          r.pulse = 1;
          this.sound.ring();
          this.events.onToast(`GATE +${50 * mult}`, "bonus");
        }
      }
      // glancing hit on ring body
      if (!r.done && Math.abs(z) < 0.9) {
        const d = Math.hypot(sx - r.x, sy - r.y);
        if (d > r.r - 0.3 && d < r.r + 0.5 && this.invuln <= 0) {
          r.done = true;
          this.damage();
        }
      }
      if (z > 16) {
        r.active = false;
        r.group.visible = false;
      }
    }
  }

  private updateLasers(dt: number) {
    const sx = this.ship.position.x;
    const sy = this.ship.position.y;
    let anyWarning = false;
    for (const l of this.lasers) {
      if (!l.active) continue;
      l.group.position.z += this.speed * dt;
      const z = l.group.position.z;
      // pulse cycle
      const t = ((this.time + l.offset) % l.period) / l.period;
      const on = t < l.duty;
      if (on !== l.on) {
        l.on = on;
        for (let i = 0; i < l.count; i++) {
          const beam = l.beams[i];
          beam.material = on ? this.beamMat : this.beamOffMat;
          beam.scale.setComponent(l.vertical ? 0 : 1, on ? 0.36 : 0.12);
        }
      }
      // warning flicker just before firing (shared material, so reset each frame)
      if (!on && t > l.duty && t > l.duty + (1 - l.duty) * 0.55) {
        anyWarning = true;
      }
      const cw = this.speed * dt * 0.5 + 0.7;
      if (!l.hit && !l.cleared && Math.abs(z) < cw) {
        if (l.on && !this.isIntangible()) {
          for (let i = 0; i < l.count; i++) {
            const c = l.coords[i];
            const d = l.vertical ? Math.abs(sx - c) : Math.abs(sy - c);
            if (d < 0.42 + SHIP_R * 0.62) {
              l.hit = true;
              l.cleared = true;
              this.damage();
              break;
            }
          }
        }
      }
      if (!l.cleared && z > cw) {
        l.cleared = true;
        if (!l.hit && this.mode === "playing") {
          this.score += 20 * this.scoreMult();
          this.sound.gateClear();
        }
      }
      if (z > 16) {
        l.active = false;
        l.group.visible = false;
      }
    }
    // pre-fire warning pulse on the shared "off" beam material
    this.beamOffMat.opacity = anyWarning
      ? (Math.sin(this.time * 42) > 0 ? 0.5 : 0.14)
      : 0.16;
  }

  private updateSpinners(dt: number) {
    const sx = this.ship.position.x;
    const sy = this.ship.position.y;
    for (const s of this.spinners) {
      if (!s.active) continue;
      s.group.position.z += this.speed * dt;
      s.group.rotation.z += s.speed * dt;
      const z = s.group.position.z;
      const cw = this.speed * dt * 0.5 + 0.8;
      if (!s.hit && !s.cleared && Math.abs(z) < cw && !this.isIntangible()) {
        // distance from ship to each rotating arm (treated as a capsule)
        const dx = sx - s.cx;
        const dy = sy - s.cy;
        const distToHub = Math.hypot(dx, dy);
        if (distToHub < s.armLen * 0.5 + SHIP_R + 0.4) {
          const ang = Math.atan2(dy, dx);
          for (let i = 0; i < s.armCount; i++) {
            const armAng = s.group.rotation.z + (i / s.armCount) * Math.PI * 2;
            // angular difference folded to [-PI, PI]
            let d = ang - armAng;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            const perp = Math.abs(Math.sin(d)) * distToHub; // perpendicular distance to arm line
            const along = Math.cos(d) * distToHub;
            if (perp < 0.55 + SHIP_R * 0.7 && along > -0.6 && along < s.armLen) {
              s.hit = true;
              s.cleared = true;
              this.damage();
              break;
            }
          }
        }
      }
      if (!s.cleared && z > cw) {
        s.cleared = true;
        if (!s.hit && this.mode === "playing") this.score += 22 * this.scoreMult();
      }
      if (z > 16) {
        s.active = false;
        s.group.visible = false;
      }
    }
  }

  private updateCrushers(dt: number) {
    const sy = this.ship.position.y;
    for (const c of this.crushers) {
      if (!c.active) continue;
      c.group.position.z += this.speed * dt;
      const z = c.group.position.z;
      // slam cycle: ease closed, snap open
      const t = ((this.time + c.offset) % c.period) / c.period;
      const k = t < 0.6 ? Math.pow(t / 0.6, 1.6) : 1 - (t - 0.6) / 0.4;
      c.gap = lerp(c.gapMax, c.gapMin, clamp(k, 0, 1));

      const halfGap = c.gap / 2;
      const topY = c.centerY + halfGap;
      const botY = c.centerY - halfGap;
      const topH = Math.max(0.2, 21 - topY);
      const botH = Math.max(0.2, botY);
      c.top.scale.set(32, topH, 1.9);
      c.top.position.set(0, topY + topH / 2, 0);
      c.bottom.scale.set(32, botH, 1.9);
      c.bottom.position.set(0, botH / 2, 0);
      c.teethT.scale.set(32, 0.22, 2.1);
      c.teethT.position.set(0, topY, 0);
      c.teethB.scale.set(32, 0.22, 2.1);
      c.teethB.position.set(0, botY, 0);

      const cw = this.speed * dt * 0.5 + 0.9;
      if (!c.hit && !c.cleared && Math.abs(z) < cw && !this.isIntangible()) {
        if (sy > topY - SHIP_R * 0.6 || sy < botY + SHIP_R * 0.6) {
          c.hit = true;
          c.cleared = true;
          this.damage();
        }
      }
      if (!c.cleared && z > cw) {
        c.cleared = true;
        if (!c.hit && this.mode === "playing") {
          const tight = c.gap < c.gapMin + 1.6;
          if (tight) this.nearMissBonus();
          else this.score += 22 * this.scoreMult();
        }
      }
      if (z > 16) {
        c.active = false;
        c.group.visible = false;
      }
    }
  }

  private updateStars(dt: number) {
    const sx = this.ship.position.x;
    const sy = this.ship.position.y;
    for (const s of this.starsPool) {
      if (!s.active) continue;
      const m = s.mesh;
      m.position.z += this.speed * dt;
      const magnetOn = this.abilityT > 0 && this.shipDef.ability === "magnet";
      if ((s.magnet || magnetOn) && !s.repair && m.position.z > -55) {
        // vacuum toward the ship
        const pull = 9 * dt;
        m.position.x = lerp(m.position.x, sx, pull);
        m.position.y = lerp(m.position.y, sy, pull);
        m.position.z = lerp(m.position.z, 0, pull * 0.85);
      } else {
        m.position.y = s.baseY + Math.sin(this.time * 2.4 + s.phase) * 0.35;
      }
      m.rotation.y += dt * 3.2;
      m.rotation.x += dt * 1.4;
      const cw2 = this.speed * dt * 0.5 + 1.0;
      if (this.mode === "playing" && Math.abs(m.position.z) < cw2) {
        const d = Math.hypot(sx - m.position.x, sy - m.position.y);
        if (d < 1.75) {
          s.active = false;
          m.visible = false;
          if (s.repair) {
            this.hearts = Math.min(this.maxHearts, this.hearts + 1);
            this.sound.repair();
            this.vibrate(25);
            this.events.onToast("+1 HULL", "bonus");
            this.pushHUD(true);
          } else {
            const mult = this.isBoosting() ? 2 : 1;
            this.score += 25 * mult;
            this.starCount++;
            this.sound.pickup();
          }
          continue;
        }
      }
      if (m.position.z > 14) {
        s.active = false;
        m.visible = false;
      }
    }
  }

  private updateParticles(dt: number) {
    // trail
    const accent = this.curC.trail;
    const boostingNow = this.isBoosting();
    const emitting = this.mode === "playing" || this.mode === "attract" || this.mode === "countdown" || this.mode === "complete";
    if (emitting) {
      const emitRate = this.isMobile ? (boostingNow ? 170 : 48) : boostingNow ? 340 : 90;
      this.emitAcc += dt * emitRate;
      const px = this.ship.position.x;
      const py = this.ship.position.y;
      const engSide = 0.52 * this.shipDef.scale;
      while (this.emitAcc >= 1) {
        this.emitAcc -= 1;
        const i = this.trailHead;
        this.trailHead = (this.trailHead + 1) % this.TRAIL_N;
        const side = this.trailHead % 2 === 0 ? -engSide : engSide;
        const spread = boostingNow ? 0.1 : 0.04;
        this.trailPos[i * 3] = px + side * Math.cos(this.ship.rotation.z) + rand(-spread, spread);
        this.trailPos[i * 3 + 1] = py - 0.02 + rand(-spread, spread);
        this.trailPos[i * 3 + 2] = 1.05 * this.shipDef.scale;
        this.trailAges[i] = 0;
        this.trailBoost[i] = boostingNow ? 1 : 0;
        // afterburner plume billows outward as it cools into smoke
        this.trailVX[i] = boostingNow ? rand(-1.5, 1.5) : rand(-0.25, 0.25);
        this.trailVY[i] = boostingNow ? rand(-0.6, 1.6) : rand(-0.15, 0.15);
      }
    }
    for (let i = 0; i < this.TRAIL_N; i++) {
      if (this.trailAges[i] > this.trailLife) continue;
      this.trailAges[i] += dt;
      this.trailPos[i * 3] += this.trailVX[i] * dt;
      this.trailPos[i * 3 + 1] += this.trailVY[i] * dt;
      this.trailPos[i * 3 + 2] += this.speed * dt * 1.25;
      const t = this.trailAges[i] / this.trailLife;
      const fade = Math.max(0, 1 - t);
      if (this.trailBoost[i] > 0.5) {
        /* AFTERBURNER: white core -> yellow -> orange -> deep red -> grey smoke */
        let r: number, g: number, b: number;
        if (t < 0.14) {
          const k = t / 0.14; // white hot -> yellow
          r = 1; g = lerp(1, 0.85, k); b = lerp(1, 0.35, k);
        } else if (t < 0.36) {
          const k = (t - 0.14) / 0.22; // yellow -> orange
          r = 1; g = lerp(0.85, 0.45, k); b = lerp(0.35, 0.08, k);
        } else if (t < 0.62) {
          const k = (t - 0.36) / 0.26; // orange -> red
          r = lerp(1, 0.85, k); g = lerp(0.45, 0.12, k); b = 0.06;
        } else {
          const k = (t - 0.62) / 0.38; // red -> dark smoke
          r = lerp(0.85, 0.22, k); g = lerp(0.12, 0.2, k); b = lerp(0.06, 0.22, k);
        }
        const heat = t < 0.62 ? 1 : 1 - (t - 0.62) / 0.38;
        this.trailCol[i * 3] = r * fade * (0.5 + heat * 0.8);
        this.trailCol[i * 3 + 1] = g * fade * (0.5 + heat * 0.8);
        this.trailCol[i * 3 + 2] = b * fade * (0.5 + heat * 0.8);
      } else {
        const core = Math.max(0, 1 - t * 2.4);
        this.trailCol[i * 3] = lerp(accent.r, 1, core) * fade;
        this.trailCol[i * 3 + 1] = lerp(accent.g, 1, core) * fade;
        this.trailCol[i * 3 + 2] = lerp(accent.b, 1, core) * fade;
      }
    }
    this.trailPts.geometry.attributes.position.needsUpdate = true;
    this.trailPts.geometry.attributes.color.needsUpdate = true;

    // explosion
    if (this.boomActive) {
      let any = false;
      for (let i = 0; i < this.sparks.length; i++) {
        const s = this.sparks[i];
        if (!s.alive) {
          this.boomCol[i * 3] = this.boomCol[i * 3 + 1] = this.boomCol[i * 3 + 2] = 0;
          continue;
        }
        any = true;
        s.age += dt;
        if (s.age >= s.life) {
          s.alive = false;
          this.boomPos[i * 3 + 1] = -999;
          continue;
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.z += s.vz * dt;
        s.vy -= 4 * dt;
        this.boomPos[i * 3] = s.x;
        this.boomPos[i * 3 + 1] = s.y;
        this.boomPos[i * 3 + 2] = s.z;
        const t = s.age / s.life;
        this.boomCol[i * 3] = lerp(1, 0.35, t);
        this.boomCol[i * 3 + 1] = lerp(0.75, 0.08, t);
        this.boomCol[i * 3 + 2] = lerp(0.3, 0.05, t);
      }
      this.boomPts.geometry.attributes.position.needsUpdate = true;
      this.boomPts.geometry.attributes.color.needsUpdate = true;
      if (!any) this.boomActive = false;
    }
  }

  private updateEnvironment(dt: number) {
    // ground scroll — texture offset (matches plane size 432 / repeat 36 => cell 12)
    this.groundTex.offset.y += (this.speed * dt) / 12 / 36;
    // mountains
    for (let i = 0; i < this.mountains.length; i++) {
      const m = this.mountains[i];
      m.position.z += this.speed * dt * this.mtnSpeeds[i];
      if (m.position.z > 30) this.recycleMountain(m);
    }
    // clouds
    for (const c of this.clouds) {
      c.position.z += this.speed * dt * 0.92;
      c.position.x += dt * 0.6;
      if (c.position.z > 30) {
        c.position.z = -TRACK_LEN + rand(0, 30);
        c.position.x = rand(-90, 90);
        c.position.y = rand(22, 48);
      }
      if (c.position.x > 110) c.position.x = -110;
    }
    // speedlines
    const boosting = this.isBoosting();
    const target = boosting || this.p01 > 0.72 ? (boosting ? 0.6 : 0.3) : 0;
    this.speedlineMat.opacity = damp(this.speedlineMat.opacity, target, 4, dt);
    if (this.speedlineMat.opacity > 0.01) {
      for (const l of this.speedlines) {
        l.position.z += this.speed * dt * 1.9;
        if (l.position.z > 12) {
          l.position.z = SPAWN_Z + rand(0, 40);
          l.position.x = this.randLineCoord();
          l.position.y = rand(0.5, 16);
        }
      }
    }
  }

  /* ============================ SHIP / CAMERA ============================ */

  private updateShip(dt: number) {
    const sp = this.ship.position;
    let desX: number;
    let desY: number;

    if (this.mode === "attract" || this.mode === "complete") {
      desX = Math.sin(this.time * 0.35) * 7.5 + Math.sin(this.time * 0.13) * 3;
      desY = 7.5 + Math.sin(this.time * 0.55) * 2.2;
    } else if (this.mode === "dying") {
      this.dieVY -= 24 * dt;
      sp.y += this.dieVY * dt;
      this.ship.rotation.z += 6.5 * dt;
      this.ship.rotation.x -= 2.4 * dt;
      if (Math.random() < dt * 30) {
        const s = this.sparks.find((v) => !v.alive);
        if (s) {
          s.alive = true;
          s.x = sp.x + rand(-0.6, 0.6);
          s.y = sp.y;
          s.z = rand(-0.5, 0.5);
          s.vx = rand(-3, 3);
          s.vy = rand(0, 5);
          s.vz = this.speed * 0.3;
          s.age = 0;
          s.life = rand(0.3, 0.6);
        }
      }
      return;
    } else {
      const sens = this.sens;
      const kx = (this.keys.has("ArrowRight") || this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("ArrowLeft") || this.keys.has("KeyA") ? 1 : 0);
      const ky = (this.keys.has("ArrowUp") || this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("ArrowDown") || this.keys.has("KeyS") ? 1 : 0);

      if (this.tiltOn && this.tiltReady) {
        /* GYRO: filtered tilt -> absolute target (deadzone applied in onOrient) */
        this.tgtX = this.tiltX * 14.5 * sens;
        this.tgtY = 7.5 + this.tiltY * 6 * sens;
      } else if (this.touchMode) {
        /* RELATIVE DRAG: swiping half the screen sweeps the full track.
           Finger lifted = ship holds its line (no snapping). */
        if (this.dragX !== 0 || this.dragY !== 0) {
          const sx = (28 / (window.innerWidth * 0.5)) * sens;
          const sy = (13 / (window.innerHeight * 0.55)) * sens;
          this.tgtX += this.dragX * sx;
          this.tgtY -= this.dragY * sy;
          this.dragX = 0;
          this.dragY = 0;
        }
      } else if (this.pointerSeen) {
        /* MOUSE: absolute cursor mapping */
        this.tgtX = this.pointerX * 13.5 * sens;
        this.tgtY = 7.5 + this.pointerY * 5.2 * sens;
      }

      if (kx !== 0 || ky !== 0) {
        this.tgtX += kx * 30 * sens * dt;
        this.tgtY += ky * 22 * sens * dt;
      }
      this.tgtX = clamp(this.tgtX, -14, 14);
      this.tgtY = clamp(this.tgtY, 2.1, 14);
      desX = this.tgtX;
      desY = this.tgtY;
    }

    /* ---- critically-damped spring flight model ----
       Fixed substeps make motion identical at 30 / 60 / 144 / 240 fps,
       and kill the micro-stutter the old exponential damp had on phones. */
    const k = (250 - this.smooth * 185) * this.shipDef.handling;
    const c = 2 * Math.sqrt(k); // critical damping = no overshoot wobble
    const steps = Math.min(8, Math.max(1, Math.ceil(dt / 0.005)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.velX += ((desX - sp.x) * k - this.velX * c) * h;
      this.velY += ((desY - sp.y) * k - this.velY * c) * h;
      sp.x += this.velX * h;
      sp.y += this.velY * h;
    }
    sp.x = clamp(sp.x, -15, 15);
    sp.y = clamp(sp.y, 1.7, 15);
    this.shipVX = this.velX;

    // banking / pitch driven by real velocity, smoothed for a heavy-jet feel
    this.bankZ = damp(this.bankZ, clamp(-this.velX * 0.045, -0.68, 0.68), 12, dt);
    this.pitchX = damp(this.pitchX, clamp(this.velY * 0.02, -0.32, 0.32), 12, dt);
    this.ship.rotation.z = this.bankZ;
    this.ship.rotation.x = this.pitchX;
    this.ship.rotation.y = clamp(-this.velX * 0.012, -0.2, 0.2);

    // engine glow flare with boost — nozzles run white-hot orange
    const boostingShip = this.isBoosting();
    const flare = boostingShip ? 2.4 : this.p01 > 0.8 ? 1.35 : 1;
    const fT = this.time * 30;
    const jitter = 1 + Math.sin(fT) * (boostingShip ? 0.16 : 0.07);
    this.engineGlowL.scale.set(flare * jitter, flare * jitter, 3.4 * flare);
    this.engineGlowR.scale.set(flare * jitter, flare * jitter, 3.4 * flare);
    if (this.thrusterMat) {
      this.tmpC.setHex(boostingShip ? 0xffb03a : this.shipDef.glowColor);
      this.thrusterMat.color.lerp(this.tmpC, 1 - Math.exp(-14 * dt));
    }
    (this.trailPts.material as THREE.PointsMaterial).size = boostingShip ? 0.52 : 0.34;

    // invulnerability blink (only during actual combat)
    if (this.invuln > 0 && this.mode === "playing") {
      this.ship.visible = Math.floor(this.time * 14) % 2 === 0;
    } else this.ship.visible = true;
  }

  private updateCamera(dt: number) {
    const boosting = this.isBoosting();
    const targetFov = (this.camera.aspect < 0.8 ? 88 : 74) + this.p01 * 9 + (boosting ? 9 : 0);
    this.camera.fov = damp(this.camera.fov, targetFov, 5, dt);
    this.camera.updateProjectionMatrix();

    const sp = this.ship.position;
    let cx = sp.x * 0.45;
    let cy = sp.y * 0.55 + 3.1;
    const cz = 9;

    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    if (this.shakeOn && this.trauma > 0) {
      const s = this.trauma * this.trauma;
      cx += (Math.random() - 0.5) * s * 2.2;
      cy += (Math.random() - 0.5) * s * 2.2;
    }
    if (this.mode === "attract") {
      cx += Math.sin(this.time * 0.21) * 2.2;
      cy += Math.sin(this.time * 0.17) * 0.8;
    }

    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(sp.x * 0.8, sp.y * 0.92 + 0.6, -28);
    this.camera.rotation.z += clamp(-this.shipVX * 0.004, -0.05, 0.05) + (this.shakeOn ? (Math.random() - 0.5) * this.trauma * 0.02 : 0);
  }

  /* ============================ HUD ============================ */

  private pushHUD(force = false) {
    if (!force && this.hudAcc < 0.1) return;
    this.hudAcc = 0;
    const lv = this.level;
    const progress01 = this.isEndless
      ? (this.dist % 1600) / 1600
      : lv
        ? clamp(this.dist / lv.target, 0, 1)
        : 0;
    this.events.onHUD({
      score: Math.round(this.score),
      stars: this.starCount,
      hearts: this.hearts,
      maxHearts: this.maxHearts,
      fps: Math.round(this.fpsEma),
      modernUi: this.modernUi,
      tiltHud: this.hudShake && !this.isMobile ? clamp(this.velX * 0.03, -6, 6) : 0,
      abilityName: ABILITIES[this.shipDef.ability].name,
      abilityReady: this.abilityCd <= 0 && this.abilityT <= 0,
      abilityActive: this.abilityT > 0,
      abilityCd01: this.abilityCd > 0
        ? 1 - this.abilityCd / ABILITIES[this.shipDef.ability].cooldown
        : 1,
      boost01: this.boost / 100,
      speedKmh: Math.round(this.speed * 5.2),
      dist: Math.round(this.dist),
      target: lv ? lv.target : Infinity,
      progress01,
      countdown: this.countdown,
      mult: this.scoreMult(),
      levelName: lv ? `${lv.name} · ${lv.tag}` : "STANDBY",
      accent: this.currentAccent.accent,
      endless: this.isEndless,
      playing: this.mode === "playing" || this.mode === "countdown" || this.mode === "dying" || this.mode === "complete",
    });
  }

  /* ============================ MAIN LOOP ============================ */

  private update(dt0: number) {
    let dt = dt0;
    this.time += dt;
    this.hudAcc += dt;
    this.updateThemeTransition(dt);

    const paused = this.mode === "paused";
    // TIME DILATION slows the world but not the UI clock
    dt *= this.timeScale();
    if (!paused) {
      /* hide the GO flash shortly after launch */
      if (this.goHideT > 0) {
        this.goHideT -= dt;
        if (this.goHideT <= 0) {
          this.countdown = -1;
          this.pushHUD(true);
        }
      }
      /* ---- mode machines ---- */
      if (this.mode === "attract") {
        this.speed = damp(this.speed, 42, 1.5, dt);
        this.p01 = 0;
        this.spawnT -= dt;
        if (this.spawnT <= 0) {
          this.spawnT = rand(1.4, 2.6);
          Math.random() > 0.45 ? this.spawnRing() : this.spawnStarLine();
        }
      } else if (this.mode === "countdown") {
        this.speed = damp(this.speed, this.level!.baseSpeed, 1.8, dt);
        this.countdownT -= dt;
        const n = Math.max(0, Math.ceil(this.countdownT));
        if (n !== this.countdown) {
          this.countdown = n;
          this.sound.beep(n === 0);
          if (n === 0) {
            this.mode = "playing";
            this.goHideT = 0.75;
          }
          this.pushHUD(true);
        }
      } else if (this.mode === "playing") {
        const lv = this.level!;
        this.p01 = this.isEndless
          ? 1 - Math.exp(-this.dist / 2600)
          : clamp(this.dist / lv.target, 0, 1);
        const targetSpeed = lerp(lv.baseSpeed, Math.min(lv.maxSpeed, this.isEndless ? lv.maxSpeed + this.phase * 2 : lv.maxSpeed), Math.pow(this.p01, 0.85));
        const boosting = this.isBoosting();
        const bp = 1 + 0.55 * this.shipDef.boostPower;
        this.speed = damp(this.speed, targetSpeed * (boosting ? bp : 1), 2.2, dt);

        // boost meter
        if (boosting) this.boost = Math.max(0, this.boost - 30 * this.shipDef.boostDrain * dt);
        else this.boost = Math.min(100, this.boost + 15 * dt);

        // score by distance
        this.score += this.speed * dt * (boosting ? 2 : 1);
        this.dist += this.speed * dt;
        this.invuln = Math.max(0, this.invuln - dt);

        this.spawner(dt);

        // final stretch + completion
        if (!this.isEndless) {
          if (!this.finalShown && this.dist > lv.target * 0.85) {
            this.finalShown = true;
            this.events.onToast("FINAL STRETCH", "warn");
            this.sound.phaseShift();
          }
          if (this.dist >= lv.target) {
            this.mode = "complete";
            this.modeT = 0;
            this.invuln = 99;
            this.countdown = -1;
            this.sound.win();
            this.events.onToast("ZONE CLEARED", "bonus");
          }
        } else {
          const ph = Math.floor(this.dist / 1600);
          if (ph !== this.phase) {
            this.phase = ph;
            const next = ENDLESS_CYCLE[ph % ENDLESS_CYCLE.length];
            this.setTheme(next);
            this.sound.phaseShift();
            this.events.onToast(`PHASE ${ph + 1} · ${next.label}`, "info");
            this.score += 500;
          }
        }
      } else if (this.mode === "complete") {
        this.modeT += dt;
        this.speed = damp(this.speed, this.level!.maxSpeed * 0.75, 1.8, dt);
        if (this.modeT > 1.7) {
          const result: RunResult = { score: Math.round(this.score), dist: Math.round(this.dist), stars: this.starCount };
          this.mode = "attract";
          this.startAttract(this.currentAccent);
          this.events.onComplete(result);
        }
      } else if (this.mode === "dying") {
        this.modeT += dt;
        this.speed = damp(this.speed, 18, 2, dt);
        if (this.modeT > 1.45) {
          const result: RunResult = { score: Math.round(this.score), dist: Math.round(this.dist), stars: this.starCount };
          this.mode = "attract";
          this.sound.lose();
          this.events.onGameOver(result);
        }
      }

      /* ---- world ---- */
      const boosting = this.isBoosting();
      this.sound.updateEngine(clamp(this.speed / 140, 0, 1), boosting && this.mode === "playing");
      this.updateShip(dt);
      this.updateDiegetic(dt);
      this.updateAbility(dt);
      this.updateWalls(dt);
      this.updatePillars(dt);
      this.updateSweepers(dt);
      this.updateLasers(dt);
      this.updateSpinners(dt);
      this.updateCrushers(dt);
      this.updateRings(dt);
      this.updateStars(dt);
      this.updateEnvironment(dt);
      this.updateParticles(dt);
    }
    this.updateCamera(dt);
    this.pushHUD();
  }
}

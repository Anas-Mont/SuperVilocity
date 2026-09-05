/* ------------------------------------------------------------------ */
/*  Themes — flat-shaded low-poly color worlds (cheap = fast)          */
/* ------------------------------------------------------------------ */

export interface Theme {
  id: string;
  label: string;
  skyTop: number;
  skyBottom: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  ground: number;
  grid: number;
  gridOpacity: number;
  mtnNear: number;
  mtnFar: number;
  wall: number;
  glow: number; // emissive trim on structures
  ring: number;
  star: number;
  sun: number;
  sunPos: [number, number, number];
  sunVis: number; // 0..1
  hemiSky: number;
  hemiGround: number;
  dir: number;
  cloud: number;
  cloudOp: number;
  night: boolean;
  trail: number;
  speedline: number;
  accent: string; // css color used by HUD
}

export const THEMES: Record<string, Theme> = {
  dawn: {
    id: "dawn", label: "DAWN PATROL",
    skyTop: 0x241452, skyBottom: 0xff8a5c, fog: 0xc96a52, fogNear: 60, fogFar: 175,
    ground: 0x2a1e3f, grid: 0xff9e73, gridOpacity: 0.4,
    mtnNear: 0x4a2b56, mtnFar: 0x6b3a68, wall: 0x33204f, glow: 0xffb066,
    ring: 0x53e9ff, star: 0xffd166, sun: 0xffd9a0, sunPos: [34, 22, -330], sunVis: 0.95,
    hemiSky: 0x9a7fd6, hemiGround: 0x2a1e3f, dir: 0xffe0b8,
    cloud: 0xffe0cd, cloudOp: 0.5, night: false,
    trail: 0xffb066, speedline: 0xfff3e8, accent: "#ffb066",
  },
  emerald: {
    id: "emerald", label: "EMERALD RUSH",
    skyTop: 0x04303a, skyBottom: 0x5fe8c0, fog: 0x2e8f76, fogNear: 58, fogFar: 172,
    ground: 0x06231f, grid: 0x2fd39a, gridOpacity: 0.4,
    mtnNear: 0x0b4a38, mtnFar: 0x177a58, wall: 0x0a3830, glow: 0x51ffc4,
    ring: 0xffe98a, star: 0xffd166, sun: 0xeafff2, sunPos: [-44, 30, -330], sunVis: 0.85,
    hemiSky: 0x9fe8c8, hemiGround: 0x0a2b22, dir: 0xd8ffe9,
    cloud: 0xeafff2, cloudOp: 0.5, night: false,
    trail: 0x51ffc4, speedline: 0xd6ffe9, accent: "#51ffc4",
  },
  dusk: {
    id: "dusk", label: "SUNSET FURY",
    skyTop: 0x33105e, skyBottom: 0xff5e3a, fog: 0xa8475c, fogNear: 56, fogFar: 168,
    ground: 0x2b1038, grid: 0xff8a56, gridOpacity: 0.4,
    mtnNear: 0x4a1d5c, mtnFar: 0x75296e, wall: 0x38164a, glow: 0xffb14f,
    ring: 0x53e9ff, star: 0xffd166, sun: 0xffc98a, sunPos: [0, 18, -330], sunVis: 1,
    hemiSky: 0xc77bbf, hemiGround: 0x2b1038, dir: 0xffb08a,
    cloud: 0xffd9c0, cloudOp: 0.5, night: false,
    trail: 0xffb14f, speedline: 0xffe9d8, accent: "#ffb14f",
  },
  night: {
    id: "night", label: "NEON DESCENT",
    skyTop: 0x01020e, skyBottom: 0x171d55, fog: 0x0a0f38, fogNear: 60, fogFar: 185,
    ground: 0x04041a, grid: 0x00e5ff, gridOpacity: 0.55,
    mtnNear: 0x0a0f30, mtnFar: 0x151d52, wall: 0x0a0e33, glow: 0xff2fa0,
    ring: 0x00f0ff, star: 0xffd166, sun: 0xcfe8ff, sunPos: [-64, 44, -330], sunVis: 0.55,
    hemiSky: 0x3b4c9e, hemiGround: 0x02021a, dir: 0x8899ff,
    cloud: 0x25335c, cloudOp: 0.28, night: true,
    trail: 0xff2fa0, speedline: 0x9adfff, accent: "#ff2fa0",
  },
  glacier: {
    id: "glacier", label: "GLACIER STORM",
    skyTop: 0x2f6fd0, skyBottom: 0xcfeaff, fog: 0x9fc9ec, fogNear: 62, fogFar: 190,
    ground: 0x1e3a52, grid: 0xbfeeff, gridOpacity: 0.4,
    mtnNear: 0x8fb9dd, mtnFar: 0xc8e0f5, wall: 0x2c4a66, glow: 0x7df0ff,
    ring: 0xffb84d, star: 0xffd166, sun: 0xfff8ea, sunPos: [42, 36, -330], sunVis: 1,
    hemiSky: 0xdff2ff, hemiGround: 0x2c4a66, dir: 0xffffff,
    cloud: 0xffffff, cloudOp: 0.75, night: false,
    trail: 0x7df0ff, speedline: 0xffffff, accent: "#7df0ff",
  },
  inferno: {
    id: "inferno", label: "INFERNO RUN",
    skyTop: 0x160410, skyBottom: 0xff4d2e, fog: 0x8c3027, fogNear: 55, fogFar: 165,
    ground: 0x1c0a10, grid: 0xff7048, gridOpacity: 0.4,
    mtnNear: 0x2e1020, mtnFar: 0x5c1f2c, wall: 0x240d18, glow: 0xff5a36,
    ring: 0x53e9ff, star: 0xffd166, sun: 0xff9a6a, sunPos: [0, 26, -330], sunVis: 0.95,
    hemiSky: 0x9e5648, hemiGround: 0x1c0a10, dir: 0xffb08a,
    cloud: 0x5a3040, cloudOp: 0.35, night: false,
    trail: 0xff5a36, speedline: 0xffe0cc, accent: "#ff5a36",
  },
  canyon: {
    id: "canyon", label: "RED CANYON",
    skyTop: 0x3d1a12, skyBottom: 0xe8895a, fog: 0xb0603f, fogNear: 54, fogFar: 168,
    ground: 0x3d1c12, grid: 0xff9b62, gridOpacity: 0.38,
    mtnNear: 0x6b2f1c, mtnFar: 0x9c4a2a, wall: 0x52251a, glow: 0xffc46b,
    ring: 0x53e9ff, star: 0xffe08a, sun: 0xffd0a0, sunPos: [56, 28, -330], sunVis: 1,
    hemiSky: 0xd99a72, hemiGround: 0x3d1c12, dir: 0xffd4b0,
    cloud: 0xffcfae, cloudOp: 0.42, night: false,
    trail: 0xffc46b, speedline: 0xfff0e2, accent: "#ffc46b",
  },
  toxic: {
    id: "toxic", label: "ACID FIELDS",
    skyTop: 0x0d2410, skyBottom: 0xa8e83a, fog: 0x4e7a24, fogNear: 50, fogFar: 158,
    ground: 0x152c10, grid: 0xb6ff43, gridOpacity: 0.45,
    mtnNear: 0x244a18, mtnFar: 0x3d7526, wall: 0x1c3814, glow: 0xcaff4d,
    ring: 0xff5edb, star: 0xffe98a, sun: 0xe8ffb0, sunPos: [-30, 24, -330], sunVis: 0.8,
    hemiSky: 0xa9d472, hemiGround: 0x152c10, dir: 0xe4ffb8,
    cloud: 0x7fae4a, cloudOp: 0.4, night: false,
    trail: 0xcaff4d, speedline: 0xeaffc4, accent: "#caff4d",
  },
  storm: {
    id: "storm", label: "THUNDERHEAD",
    skyTop: 0x0a0d1c, skyBottom: 0x3d4a63, fog: 0x27334a, fogNear: 46, fogFar: 148,
    ground: 0x111726, grid: 0x8fb4e8, gridOpacity: 0.34,
    mtnNear: 0x1b2436, mtnFar: 0x2e3d56, wall: 0x18202f, glow: 0xbcd8ff,
    ring: 0xffe14d, star: 0xffd166, sun: 0xaebfd8, sunPos: [-20, 40, -330], sunVis: 0.3,
    hemiSky: 0x54648a, hemiGround: 0x111726, dir: 0xa8bcd8,
    cloud: 0x3a465e, cloudOp: 0.85, night: false,
    trail: 0xbcd8ff, speedline: 0xdfeaff, accent: "#bcd8ff",
  },
  void: {
    id: "void", label: "THE VOID",
    skyTop: 0x03010a, skyBottom: 0x2a0b4a, fog: 0x160538, fogNear: 58, fogFar: 190,
    ground: 0x08031a, grid: 0xa64dff, gridOpacity: 0.5,
    mtnNear: 0x1a0838, mtnFar: 0x2e1055, wall: 0x140630, glow: 0xc46bff,
    ring: 0x53ffe9, star: 0xffd166, sun: 0xe0c0ff, sunPos: [40, 52, -330], sunVis: 0.5,
    hemiSky: 0x5a3a9e, hemiGround: 0x08031a, dir: 0xb98cff,
    cloud: 0x2c1152, cloudOp: 0.3, night: true,
    trail: 0xc46bff, speedline: 0xe8d0ff, accent: "#c46bff",
  },
};

/* ------------------------------------------------------------------ */
/*  Levels                                                             */
/* ------------------------------------------------------------------ */

export interface HazardWeights {
  wall: number;
  slide: number;
  pillars: number;
  sweeper: number;
  ring: number;
  /** STAGE II — toggling laser grids */
  laser: number;
  /** STAGE II — rotating rotor blades */
  spinner: number;
  /** STAGE III — vertical crushers that slam shut */
  crusher: number;
}

export interface LevelConfig {
  id: number;
  stage: number; // 1 | 2 | 3
  name: string;
  tag: string;
  theme: Theme;
  target: number; // meters — Infinity for endless
  targetLabel: string;
  baseSpeed: number;
  maxSpeed: number;
  spawnStart: number; // seconds between spawns at level start
  spawnMin: number; // seconds at full throttle end
  weights: HazardWeights;
  starChance: number;
  endless?: boolean;
}

export interface StageInfo {
  id: number;
  name: string;
  subtitle: string;
  blurb: string;
  newHazard: string;
  accent: string;
}

export const STAGES: StageInfo[] = [
  {
    id: 1, name: "STAGE I", subtitle: "SKYLINE",
    blurb: "Learn the airframe. Walls, pillars and sweeper blades across four open-sky zones.",
    newHazard: "WALLS · PILLARS · SWEEPERS", accent: "#ffb066",
  },
  {
    id: 2, name: "STAGE II", subtitle: "GRID WAR",
    blurb: "The grid fights back. Pulsing laser fences and spinning rotor blades join the mix.",
    newHazard: "NEW — LASER GRIDS · ROTORS", accent: "#51ffc4",
  },
  {
    id: 3, name: "STAGE III", subtitle: "DEEP VOID",
    blurb: "Everything at once, plus hydraulic crushers that slam shut on your wings.",
    newHazard: "NEW — CRUSHERS · ALL HAZARDS", accent: "#c46bff",
  },
];

const W = (
  wall: number, slide: number, pillars: number, sweeper: number,
  ring: number, laser = 0, spinner = 0, crusher = 0,
): HazardWeights => ({ wall, slide, pillars, sweeper, ring, laser, spinner, crusher });

export const LEVELS: LevelConfig[] = [
  /* ---------------- STAGE I — SKYLINE ---------------- */
  {
    id: 0, stage: 1, name: "ZONE 01", tag: "DAWN PATROL", theme: THEMES.dawn,
    target: 2400, targetLabel: "2.4 KM", baseSpeed: 46, maxSpeed: 66,
    spawnStart: 1.5, spawnMin: 1.1,
    weights: W(0.5, 0.1, 0.22, 0.08, 0.1),
    starChance: 0.4,
  },
  {
    id: 1, stage: 1, name: "ZONE 02", tag: "EMERALD RUSH", theme: THEMES.emerald,
    target: 2900, targetLabel: "2.9 KM", baseSpeed: 52, maxSpeed: 78,
    spawnStart: 1.35, spawnMin: 0.95,
    weights: W(0.42, 0.16, 0.22, 0.1, 0.1),
    starChance: 0.38,
  },
  {
    id: 2, stage: 1, name: "ZONE 03", tag: "SUNSET FURY", theme: THEMES.dusk,
    target: 3500, targetLabel: "3.5 KM", baseSpeed: 58, maxSpeed: 90,
    spawnStart: 1.22, spawnMin: 0.85,
    weights: W(0.38, 0.2, 0.2, 0.12, 0.1),
    starChance: 0.36,
  },
  {
    id: 3, stage: 1, name: "ZONE 04", tag: "NEON DESCENT", theme: THEMES.night,
    target: 4100, targetLabel: "4.1 KM", baseSpeed: 64, maxSpeed: 102,
    spawnStart: 1.12, spawnMin: 0.78,
    weights: W(0.34, 0.22, 0.2, 0.14, 0.1),
    starChance: 0.34,
  },

  /* ---------------- STAGE II — GRID WAR (lasers + rotors) ---------------- */
  {
    id: 4, stage: 2, name: "ZONE 05", tag: "GLACIER STORM", theme: THEMES.glacier,
    target: 4700, targetLabel: "4.7 KM", baseSpeed: 70, maxSpeed: 114,
    spawnStart: 1.04, spawnMin: 0.72,
    weights: W(0.26, 0.16, 0.16, 0.1, 0.08, 0.16, 0.08),
    starChance: 0.32,
  },
  {
    id: 5, stage: 2, name: "ZONE 06", tag: "INFERNO RUN", theme: THEMES.inferno,
    target: 5400, targetLabel: "5.4 KM", baseSpeed: 76, maxSpeed: 128,
    spawnStart: 0.98, spawnMin: 0.66,
    weights: W(0.22, 0.16, 0.15, 0.11, 0.06, 0.18, 0.12),
    starChance: 0.3,
  },
  {
    id: 6, stage: 2, name: "ZONE 07", tag: "RED CANYON", theme: THEMES.canyon,
    target: 6000, targetLabel: "6.0 KM", baseSpeed: 80, maxSpeed: 136,
    spawnStart: 0.94, spawnMin: 0.62,
    weights: W(0.2, 0.16, 0.15, 0.11, 0.04, 0.2, 0.14),
    starChance: 0.3,
  },
  {
    id: 7, stage: 2, name: "ZONE 08", tag: "ACID FIELDS", theme: THEMES.toxic,
    target: 6600, targetLabel: "6.6 KM", baseSpeed: 84, maxSpeed: 144,
    spawnStart: 0.9, spawnMin: 0.58,
    weights: W(0.18, 0.16, 0.14, 0.12, 0.04, 0.22, 0.14),
    starChance: 0.3,
  },

  /* ---------------- STAGE III — DEEP VOID (crushers + everything) ---------------- */
  {
    id: 8, stage: 3, name: "ZONE 09", tag: "THUNDERHEAD", theme: THEMES.storm,
    target: 7200, targetLabel: "7.2 KM", baseSpeed: 88, maxSpeed: 152,
    spawnStart: 0.86, spawnMin: 0.55,
    weights: W(0.16, 0.14, 0.12, 0.1, 0.04, 0.16, 0.12, 0.16),
    starChance: 0.32,
  },
  {
    id: 9, stage: 3, name: "ZONE 10", tag: "THE VOID", theme: THEMES.void,
    target: 7800, targetLabel: "7.8 KM", baseSpeed: 92, maxSpeed: 158,
    spawnStart: 0.83, spawnMin: 0.52,
    weights: W(0.14, 0.14, 0.12, 0.1, 0.04, 0.17, 0.13, 0.16),
    starChance: 0.32,
  },
  {
    id: 10, stage: 3, name: "ZONE 11", tag: "MIDNIGHT GRID", theme: THEMES.night,
    target: 8400, targetLabel: "8.4 KM", baseSpeed: 96, maxSpeed: 166,
    spawnStart: 0.8, spawnMin: 0.5,
    weights: W(0.13, 0.13, 0.11, 0.1, 0.04, 0.18, 0.13, 0.18),
    starChance: 0.34,
  },
  {
    id: 11, stage: 3, name: "ZONE 12", tag: "FINAL DESCENT", theme: THEMES.inferno,
    target: 9000, targetLabel: "9.0 KM", baseSpeed: 100, maxSpeed: 176,
    spawnStart: 0.78, spawnMin: 0.46,
    weights: W(0.12, 0.12, 0.11, 0.1, 0.03, 0.19, 0.13, 0.2),
    starChance: 0.36,
  },

  /* ---------------- ENDLESS ---------------- */
  {
    id: 12, stage: 3, name: "OVERDRIVE", tag: "ENDLESS MODE", theme: THEMES.night,
    target: Infinity, targetLabel: "∞ KM", baseSpeed: 54, maxSpeed: 180,
    spawnStart: 1.25, spawnMin: 0.48,
    weights: W(0.2, 0.16, 0.14, 0.12, 0.06, 0.14, 0.09, 0.09),
    starChance: 0.35, endless: true,
  },
];

export const ZONES = LEVELS.filter((l) => !l.endless);
export const ENDLESS_LEVEL = LEVELS.find((l) => l.endless)!;

/** palette cycle for endless mode phase shifts */
export const ENDLESS_CYCLE: Theme[] = [
  THEMES.night, THEMES.dawn, THEMES.dusk, THEMES.emerald, THEMES.glacier,
  THEMES.inferno, THEMES.canyon, THEMES.toxic, THEMES.storm, THEMES.void,
];

export const MENU_THEME = THEMES.dawn;

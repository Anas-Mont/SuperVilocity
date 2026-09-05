export type AbilityId = "shield" | "slowmo" | "ram" | "phase" | "surge" | "magnet";

export interface AbilityDef {
  id: AbilityId;
  name: string;
  blurb: string;
  duration: number; // seconds active (0 = instant)
  cooldown: number; // seconds
}

export const ABILITIES: Record<AbilityId, AbilityDef> = {
  shield: { id: "shield", name: "PULSE SHIELD", blurb: "Absorbs all impacts for 3s.", duration: 3, cooldown: 16 },
  slowmo: { id: "slowmo", name: "TIME DILATION", blurb: "Slows the world 55% for 4s — score keeps flowing.", duration: 4, cooldown: 20 },
  ram: { id: "ram", name: "RAM PLATE", blurb: "Shatter any structure you touch for 4s.", duration: 4, cooldown: 22 },
  phase: { id: "phase", name: "GHOST PHASE", blurb: "Go intangible and fly straight through matter for 3s.", duration: 3, cooldown: 18 },
  surge: { id: "surge", name: "REPAIR SURGE", blurb: "Instantly restore 1 hull and refill the boost cell.", duration: 0, cooldown: 26 },
  magnet: { id: "magnet", name: "STAR MAGNET", blurb: "Vacuums every star on screen and pays ×3 for 6s.", duration: 6, cooldown: 24 },
};

export interface ShipDef {
  id: string;
  name: string;
  tag: string;
  cost: number; // in stars
  hull: number; // starting hull points (max 5)
  handling: number; // steering responsiveness multiplier
  boostPower: number; // boost speed multiplier
  boostDrain: number; // boost cell drain rate (lower = better)
  ability: AbilityId;
  hullColor: number;
  darkColor: number;
  glowColor: number;
  trailColor: number;
  /** silhouette shape */
  build: "dart" | "delta" | "wide" | "needle" | "heavy" | "prism";
  scale: number;
  desc: string;
  /** engine voice — each craft sounds distinct */
  sound: {
    wave: OscillatorType;
    base: number; // idle turbine pitch (Hz)
    range: number; // pitch added at full speed
    filter: number; // low-pass cutoff (brightness)
    growl: number; // sub-oscillator level (0..1)
    whine: number; // high turbine whine level (0..1)
    wind: number; // wind-rush level multiplier
  };
}

export const SHIPS: ShipDef[] = [
  {
    id: "dart", name: "MK-I DART", tag: "STARTER", cost: 0,
    hull: 3, handling: 1, boostPower: 1, boostDrain: 1, ability: "shield",
    hullColor: 0xe9eef7, darkColor: 0x232c42, glowColor: 0x53e9ff, trailColor: 0x53e9ff,
    build: "dart", scale: 1,
    sound: { wave: "sawtooth", base: 48, range: 95, filter: 340, growl: 0.35, whine: 0.18, wind: 1 },
    desc: "Balanced trainer airframe. Forgiving, honest, and quick enough to hurt you.",
  },
  {
    id: "delta", name: "V-9 DELTA", tag: "AGILE", cost: 120,
    hull: 3, handling: 1.32, boostPower: 1.05, boostDrain: 1.05, ability: "slowmo",
    hullColor: 0x6ef2c8, darkColor: 0x0d3b32, glowColor: 0x51ffc4, trailColor: 0x51ffc4,
    build: "delta", scale: 0.95,
    sound: { wave: "square", base: 62, range: 132, filter: 620, growl: 0.15, whine: 0.5, wind: 1.05 },
    desc: "Razor-response delta wing. Turns on a coin — twitchy in the wrong hands.",
  },
  {
    id: "vulcan", name: "VULCAN-X", tag: "TANK", cost: 260,
    hull: 5, handling: 0.82, boostPower: 0.95, boostDrain: 0.85, ability: "ram",
    hullColor: 0xffb066, darkColor: 0x4a2510, glowColor: 0xff7a2f, trailColor: 0xff7a2f,
    build: "heavy", scale: 1.12,
    sound: { wave: "sawtooth", base: 30, range: 62, filter: 210, growl: 1, whine: 0.05, wind: 0.85 },
    desc: "Armoured gunship hull: 5 hull points and a deep boost cell. Slow to turn.",
  },
  {
    id: "wraith", name: "WRAITH", tag: "SPEED", cost: 420,
    hull: 2, handling: 1.2, boostPower: 1.28, boostDrain: 1.15, ability: "phase",
    hullColor: 0x1b1f33, darkColor: 0x0a0c18, glowColor: 0xff2fa0, trailColor: 0xff2fa0,
    build: "needle", scale: 0.92,
    sound: { wave: "triangle", base: 74, range: 168, filter: 900, growl: 0.08, whine: 0.72, wind: 1.3 },
    desc: "Stealth needle built for pure velocity. Glass hull — two hits and it's over.",
  },
  {
    id: "aurora", name: "AURORA", tag: "ENDURANCE", cost: 600,
    hull: 4, handling: 1.12, boostPower: 1.15, boostDrain: 0.6, ability: "surge",
    hullColor: 0xcfe8ff, darkColor: 0x25406b, glowColor: 0x7df0ff, trailColor: 0x7df0ff,
    build: "wide", scale: 1.04,
    sound: { wave: "sine", base: 42, range: 88, filter: 480, growl: 0.45, whine: 0.34, wind: 0.9 },
    desc: "Long-haul interceptor with a huge boost reserve that barely drains.",
  },
  {
    id: "phantom", name: "PHANTOM ZERO", tag: "APEX", cost: 900,
    hull: 4, handling: 1.4, boostPower: 1.35, boostDrain: 0.75, ability: "magnet",
    hullColor: 0xf2d98a, darkColor: 0x2a1c0a, glowColor: 0xffd166, trailColor: 0xffd166,
    build: "prism", scale: 1,
    sound: { wave: "sawtooth", base: 56, range: 152, filter: 1150, growl: 0.5, whine: 0.85, wind: 1.15 },
    desc: "Prototype apex frame. Best of everything — the reward for a true pilot.",
  },
];

export const getShipDef = (id: string): ShipDef =>
  SHIPS.find((s) => s.id === id) ?? SHIPS[0];

export interface Settings {
  sfx: boolean;
  music: boolean;
  shake: boolean;
  quality: number; // 1 LOW | 2 MED | 3 HIGH | 4 ULTRA
  fps: number; // 0 = MAX (uncapped) | 60 | 144 | 240
  showFps: boolean;
  sens: number; // 0.4 .. 1.8 steering sensitivity
  smooth: number; // 0.25 (instant) .. 1 (floaty) response delay
  tilt: boolean; // mobile gyro steering
  gyroInv: number; // 0 none | 1 invert Y | 2 invert X | 3 both
  vibrate: boolean;
  modernUi: boolean; // diegetic in-air HUD attached to the craft
  hudShake: boolean; // HUD reacts to steering (desktop only)
  autoPerf: boolean; // dynamic resolution to hold frame rate
}

interface Best {
  score: number;
  dist: number;
}

interface SaveData {
  unlocked: number;
  best: Record<string, Best>;
  settings: Settings;
  stars: number; // spendable currency
  owned: string[]; // ship ids
  ship: string; // selected ship id
  name: string; // pilot callsign for the leaderboard
  boardId: string; // online leaderboard id ("" = offline)
  tutorialDone: boolean;
  /** per-craft upgrade tiers: { shipId: { hull, handling, boost } } 0..3 */
  upgrades: Record<string, { hull: number; handling: number; boost: number }>;
  /** prestige level — the endless star sink */
  prestige: number;
  /** total stars ever spent (lifetime stat) */
  spent: number;
}

/**
 * PERMANENT SAVE KEY — never rename this again.
 * Renaming it orphans every player's progress on the next deploy.
 * New fields must be added with defaults in load() instead.
 */
const KEY = "supervelocity_save";
/** Older keys are migrated once, newest first. */
const LEGACY_KEYS = ["skyvector_save_v2", "skyvector_save_v1"];

const DEFAULTS: SaveData = {
  unlocked: 0,
  best: {},
  settings: {
    sfx: true, music: true, shake: true, quality: 3, fps: 0,
    showFps: false, sens: 1, smooth: 0.5, tilt: false, gyroInv: 0, vibrate: true,
    modernUi: true, hudShake: true, autoPerf: true,
  },
  stars: 0,
  owned: ["dart"],
  ship: "dart",
  name: "",
  boardId: "",
  tutorialDone: false,
  upgrades: {},
  prestige: 0,
  spent: 0,
};

function load(): SaveData {
  try {
    let raw = localStorage.getItem(KEY);
    // one-time migration so updates never wipe progress
    if (!raw) {
      for (const k of LEGACY_KEYS) {
        const old = localStorage.getItem(k);
        if (old) {
          raw = old;
          try {
            localStorage.setItem(KEY, old);
          } catch {
            /* ignore */
          }
          break;
        }
      }
    }
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const settings = { ...DEFAULTS.settings, ...(parsed.settings ?? {}) };
    if (![1, 2, 3, 4].includes(settings.quality)) settings.quality = 3;
    if (![0, 60, 144, 240].includes(settings.fps)) settings.fps = 0;
    settings.sens = Math.min(1.8, Math.max(0.4, settings.sens || 1));
    settings.smooth = Math.min(1, Math.max(0.25, settings.smooth || 0.5));
    if (![0, 1, 2, 3].includes(settings.gyroInv)) settings.gyroInv = 0;
    const owned = Array.isArray(parsed.owned) && parsed.owned.length ? parsed.owned : ["dart"];
    return {
      unlocked: typeof parsed.unlocked === "number" ? parsed.unlocked : 0,
      best: parsed.best ?? {},
      settings,
      stars: typeof parsed.stars === "number" ? parsed.stars : 0,
      owned,
      ship: typeof parsed.ship === "string" && owned.includes(parsed.ship) ? parsed.ship : owned[0],
      name: typeof parsed.name === "string" ? parsed.name : "",
      boardId: typeof parsed.boardId === "string" ? parsed.boardId : "",
      tutorialDone: !!parsed.tutorialDone,
      upgrades: parsed.upgrades ?? {},
      prestige: typeof parsed.prestige === "number" ? parsed.prestige : 0,
      spent: typeof parsed.spent === "number" ? parsed.spent : 0,
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

let cache: SaveData = load();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage unavailable — ignore */
  }
}

export const getUnlocked = () => cache.unlocked;
export const setUnlocked = (n: number) => {
  cache.unlocked = Math.max(cache.unlocked, n);
  persist();
};

export const getBest = (id: number | string): Best | null => cache.best[String(id)] ?? null;

export const saveResult = (id: number | string, score: number, dist: number): boolean => {
  const k = String(id);
  const prev = cache.best[k];
  const isRecord = !prev || score > prev.score;
  cache.best[k] = {
    score: Math.max(prev?.score ?? 0, Math.round(score)),
    dist: Math.max(prev?.dist ?? 0, Math.round(dist)),
  };
  persist();
  return isRecord;
};

export const getSettings = (): Settings => ({ ...cache.settings });
export const saveSettings = (s: Settings) => {
  cache.settings = { ...s };
  persist();
};

/* ---------------- currency + hangar ---------------- */

export const getStars = () => cache.stars;
export const addStars = (n: number) => {
  cache.stars += Math.max(0, Math.round(n));
  persist();
};
export const spendStars = (n: number) => {
  if (cache.stars < n) return false;
  cache.stars -= n;
  persist();
  return true;
};
export const getOwned = () => [...cache.owned];
export const ownShip = (id: string) => {
  if (!cache.owned.includes(id)) cache.owned.push(id);
  persist();
};
export const getName = () => cache.name;
export const setName = (n: string) => {
  cache.name = n.slice(0, 14);
  persist();
};

export const getBoardId = () => cache.boardId;
export const setBoardId = (id: string) => {
  cache.boardId = id;
  persist();
};

export const isTutorialDone = () => cache.tutorialDone;
export const setTutorialDone = () => {
  cache.tutorialDone = true;
  persist();
};

/* ---------------- upgrades (the late-game star sink) ---------------- */

export type UpgradeKind = "hull" | "handling" | "boost";
export const MAX_TIER = 3;

export const getUpgrades = (shipId: string) =>
  cache.upgrades[shipId] ?? { hull: 0, handling: 0, boost: 0 };

/** Cost climbs per tier so stars stay valuable forever. */
export const upgradeCost = (tier: number) => 150 + tier * 220;

export function buyUpgrade(shipId: string, kind: UpgradeKind): boolean {
  const cur = getUpgrades(shipId);
  if (cur[kind] >= MAX_TIER) return false;
  const cost = upgradeCost(cur[kind]);
  if (cache.stars < cost) return false;
  cache.stars -= cost;
  cache.spent += cost;
  cache.upgrades[shipId] = { ...cur, [kind]: cur[kind] + 1 };
  persist();
  return true;
}

/* ---------------- PRESTIGE — the infinite star sink ---------------- */

export const PRESTIGE_TITLES = [
  "ROOKIE", "CADET", "AVIATOR", "ACE", "VETERAN", "ELITE",
  "MAVERICK", "LEGEND", "MYTHIC", "IMMORTAL", "TRANSCENDENT",
];

export const getPrestige = () => cache.prestige;
export const getSpent = () => cache.spent;

/** Cost scales so it always stays a meaningful goal. */
export const prestigeCost = (level: number) => 800 + level * 650;

/** Each level adds +4% score, capped so it never breaks the leaderboard. */
export const prestigeBonus = (level: number) => 1 + Math.min(1, level * 0.04);

export const prestigeTitle = (level: number) =>
  PRESTIGE_TITLES[Math.min(level, PRESTIGE_TITLES.length - 1)];

export function buyPrestige(): boolean {
  const cost = prestigeCost(cache.prestige);
  if (cache.stars < cost) return false;
  cache.stars -= cost;
  cache.spent += cost;
  cache.prestige += 1;
  persist();
  return true;
}

export const getShip = () => cache.ship;
export const selectShip = (id: string) => {
  if (cache.owned.includes(id)) {
    cache.ship = id;
    persist();
  }
};

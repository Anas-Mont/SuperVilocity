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
}

const KEY = "skyvector_save_v2";

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
};

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
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
export const getShip = () => cache.ship;
export const selectShip = (id: string) => {
  if (cache.owned.includes(id)) {
    cache.ship = id;
    persist();
  }
};

export const clamp = (v: number, min: number, max: number) =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Frame-rate independent exponential smoothing */
export const damp = (cur: number, target: number, lambda: number, dt: number) =>
  lerp(cur, target, 1 - Math.exp(-lambda * dt));

export const rand = (min: number, max: number) => min + Math.random() * (max - min);

export const randInt = (min: number, max: number) =>
  Math.floor(rand(min, max + 1));

/** Weighted pick: entries of [key, weight] */
export function pickWeighted(entries: [string, number][]): string {
  let total = 0;
  for (const [, w] of entries) total += w;
  let r = Math.random() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

export const fmtScore = (n: number) => Math.round(n).toLocaleString("en-US");

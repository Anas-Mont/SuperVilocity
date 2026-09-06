import { getBoardId, setBoardId, getName } from "./storage";

/* ------------------------------------------------------------------ */
/*  ONLINE LEADERBOARD                                                 */
/*                                                                     */
/*  Backend: jsonblob.com — a free, no-signup, CORS-enabled JSON store.*/
/*  It works from any static host (Vercel included) with zero server   */
/*  code. A "board" is one blob holding the score list.                */
/*                                                                     */
/*  • DEFAULT_BOARD below is the shared public board.                  */
/*  • Players can host their own private board from Settings.          */
/*  • If the network fails we silently fall back to a device-local     */
/*    board so the screen is never empty or broken.                    */
/* ------------------------------------------------------------------ */

const API = "https://jsonblob.com/api/jsonBlob";

/**
 * Shared public board. Leave "" to run offline-only until someone
 * presses "Create Online Board" in Settings (which fills this in on
 * their device and gives them a shareable link).
 */
const DEFAULT_BOARD = "";

/** The developer's callsign gets a permanent highlight. */
export const DEV_NAME = "MUHAMMED ANAS";

export interface Entry {
  name: string;
  score: number;
  dist: number;
  zone: string;
  ship: string;
  at: number; // epoch ms
  id: string; // stable per-device id so a player updates instead of duplicating
}

const LOCAL_KEY = "supervelocity_board_v1";
const DEVICE_KEY = "supervelocity_device";

export function deviceId(): string {
  let d = "";
  try {
    d = localStorage.getItem(DEVICE_KEY) ?? "";
    if (!d) {
      d = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      localStorage.setItem(DEVICE_KEY, d);
    }
  } catch {
    d = "anon";
  }
  return d;
}

/* ---------------- local mirror ---------------- */

function readLocal(): Entry[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as Entry[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(list: Entry[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 200)));
  } catch {
    /* ignore */
  }
}

/** Keep one best entry per player id, sorted by score. */
function merge(...lists: Entry[][]): Entry[] {
  const byId = new Map<string, Entry>();
  for (const list of lists) {
    for (const e of list) {
      if (!e || typeof e.score !== "number" || !e.name) continue;
      const key = `${e.id}|${e.zone}`;
      const prev = byId.get(key);
      if (!prev || e.score > prev.score) byId.set(key, e);
    }
  }
  return [...byId.values()].sort((a, b) => b.score - a.score).slice(0, 200);
}

/* No fake/seeded entries — this board only ever contains real runs.
   A new board starts empty and fills up as people actually play. */

/* ---------------- network ---------------- */

async function req(url: string, init?: RequestInit, ms = 9000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Accept: "application/json", ...(init?.headers ?? {}) },
    });
  } finally {
    clearTimeout(t);
  }
}

/** Board id from ?board= in the URL, saved setting, or the shared default. */
export function activeBoardId(): string {
  try {
    const p = new URLSearchParams(window.location.search).get("board");
    if (p) {
      if (p !== getBoardId()) setBoardId(p);
      return p;
    }
  } catch {
    /* ignore */
  }
  return getBoardId() || DEFAULT_BOARD;
}

export const isOnline = () => !!activeBoardId();

/** Creates a brand-new online board and stores its id. Returns the id. */
export async function createBoard(): Promise<string> {
  const seeded = merge(readLocal());
  const res = await req(API, { method: "POST", body: JSON.stringify({ v: 1, entries: seeded }) });
  if (!res.ok && res.status !== 201) throw new Error(`create failed (${res.status})`);
  const loc = res.headers.get("Location") ?? res.headers.get("location") ?? "";
  const id = loc.split("/").filter(Boolean).pop() ?? "";
  if (!id) throw new Error("no board id returned");
  setBoardId(id);
  writeLocal(seeded);
  return id;
}

export function joinBoard(idOrUrl: string) {
  const id = idOrUrl.trim().split("/").filter(Boolean).pop() ?? "";
  setBoardId(id);
  return id;
}

export function leaveBoard() {
  setBoardId("");
}

export interface FetchResult {
  entries: Entry[];
  online: boolean;
  error?: string;
}

/** Reads the board (remote if configured, otherwise the local mirror). */
export async function fetchBoard(): Promise<FetchResult> {
  const local = readLocal();
  const id = activeBoardId();
  if (!id) return { entries: local, online: false };
  try {
    const res = await req(`${API}/${id}`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as { entries?: Entry[] } | Entry[];
    const remote = Array.isArray(data) ? data : (data.entries ?? []);
    const merged = merge(remote, local);
    writeLocal(merged);
    return { entries: merged, online: true };
  } catch (e) {
    return {
      entries: local,
      online: false,
      error: e instanceof Error ? e.message : "offline",
    };
  }
}

/** Submits a score. Always saves locally; pushes online when possible. */
export async function submitScore(payload: {
  score: number;
  dist: number;
  zone: string;
  ship: string;
}): Promise<FetchResult> {
  const name = (getName() || "PILOT").toUpperCase().slice(0, 14);
  const entry: Entry = {
    name,
    score: Math.round(payload.score),
    dist: Math.round(payload.dist),
    zone: payload.zone,
    ship: payload.ship,
    at: Date.now(),
    id: deviceId(),
  };

  const local = merge(readLocal(), [entry]);
  writeLocal(local);

  const id = activeBoardId();
  if (!id) return { entries: local, online: false };

  try {
    // read-modify-write (last writer wins — fine for a casual board)
    const res = await req(`${API}/${id}`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as { entries?: Entry[] } | Entry[];
    const remote = Array.isArray(data) ? data : (data.entries ?? []);
    const merged = merge(remote, [entry]);
    const put = await req(`${API}/${id}`, {
      method: "PUT",
      body: JSON.stringify({ v: 1, entries: merged }),
    });
    if (!put.ok) throw new Error(`put ${put.status}`);
    writeLocal(merged);
    return { entries: merged, online: true };
  } catch (e) {
    return {
      entries: local,
      online: false,
      error: e instanceof Error ? e.message : "offline",
    };
  }
}

/** Rank (1-based) of the local player's best entry, or 0 if unranked. */
export function myRank(entries: Entry[]): number {
  const me = deviceId();
  const i = entries.findIndex((e) => e.id === me);
  return i < 0 ? 0 : i + 1;
}

export const isDev = (e: Entry) => e.name.toUpperCase() === DEV_NAME;
export const isMe = (e: Entry) => e.id === deviceId();

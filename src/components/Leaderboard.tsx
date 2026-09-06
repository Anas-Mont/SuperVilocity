import { useEffect, useState } from "react";
import {
  Trophy, ArrowLeft, RefreshCw, Wifi, WifiOff, Crown, Medal, User,
} from "lucide-react";
import {
  Entry, fetchBoard, isDev, isMe, myRank,
} from "../game/leaderboard";
import { fmtScore } from "../game/utils";

export default function Leaderboard({ onBack }: { onBack: () => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | undefined>();

  const load = async () => {
    setLoading(true);
    const r = await fetchBoard();
    setEntries(r.entries);
    setOnline(r.online);
    setErr(r.error);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const rank = myRank(entries);

  return (
    <div className="ui-scroll absolute inset-0 z-20 overflow-y-auto overscroll-contain bg-gradient-to-b from-[#05030e]/92 via-[#05030e]/78 to-[#05030e]/95">
      <div className="mx-auto w-full max-w-2xl p-3 sm:p-6">
        {/* header */}
        <div className="anim-fade-up mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-300" />
              <span className="font-display text-[9px] tracking-[0.45em] text-amber-300/90 sm:text-[10px]">
                GLOBAL RANKINGS
              </span>
            </div>
            <h2 className="mt-1 font-display text-2xl font-black tracking-widest text-white sm:text-4xl">
              LEADERBOARD
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1.5 border px-2.5 py-1.5 font-display text-[9px] tracking-[0.2em] ${
                online
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                  : "border-amber-400/40 bg-amber-400/10 text-amber-300"
              }`}
            >
              {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {online ? "ONLINE" : "LOCAL"}
            </span>
            <button
              type="button"
              onClick={() => void load()}
              className="flex cursor-pointer items-center gap-2 border border-white/15 bg-white/5 px-3 py-1.5 font-display text-[10px] tracking-[0.2em] text-white/70 transition-colors hover:border-cyan-300/50 hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              SYNC
            </button>
            <button
              type="button"
              onClick={onBack}
              className="flex cursor-pointer items-center gap-2 border border-white/15 bg-white/5 px-3 py-1.5 font-display text-[10px] tracking-[0.2em] text-white/70 transition-colors hover:border-cyan-300/50 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> BACK
            </button>
          </div>
        </div>

        {/* your rank */}
        {rank > 0 && (
          <div className="anim-fade-up mb-3 flex items-center gap-3 border border-cyan-300/40 bg-cyan-400/10 px-4 py-2.5">
            <User className="h-4 w-4 text-cyan-300" />
            <span className="font-display text-[10px] tracking-[0.25em] text-cyan-200">
              YOUR RANK
            </span>
            <span className="hud-num ml-auto font-display text-xl font-black text-white">#{rank}</span>
          </div>
        )}

        {!online && (
          <div className="mb-3 border border-amber-300/25 bg-amber-400/[0.07] px-4 py-2.5 text-xs leading-snug text-amber-200/80">
            Showing this device's board{err ? ` (${err})` : ""}. Open{" "}
            <span className="font-display tracking-wider">SYSTEMS → ONLINE BOARD</span> to create or
            join a shared board — then scores sync for everyone with the link.
          </div>
        )}

        {/* table */}
        <div className="overflow-hidden border border-white/12">
          <div className="grid grid-cols-[2.5rem_1fr_5rem] gap-2 border-b border-white/12 bg-white/[0.05] px-3 py-2 font-display text-[9px] tracking-[0.2em] text-white/45 sm:grid-cols-[3rem_1fr_7rem_5rem] sm:px-4">
            <span>#</span>
            <span>PILOT</span>
            <span className="hidden sm:block">ZONE</span>
            <span className="text-right">SCORE</span>
          </div>

          {loading && entries.length === 0 ? (
            <div className="px-4 py-10 text-center font-display text-xs tracking-[0.3em] text-white/40">
              SYNCING…
            </div>
          ) : (
            entries.slice(0, 60).map((e, i) => {
              const dev = isDev(e);
              const me = isMe(e);
              return (
                <div
                  key={`${e.id}-${e.zone}-${i}`}
                  className={`grid grid-cols-[2.5rem_1fr_5rem] items-center gap-2 border-b border-white/[0.06] px-3 py-2 transition-colors sm:grid-cols-[3rem_1fr_7rem_5rem] sm:px-4 ${
                    dev
                      ? "bg-gradient-to-r from-amber-400/20 via-amber-400/[0.07] to-transparent"
                      : me
                        ? "bg-cyan-400/10"
                        : i % 2
                          ? "bg-white/[0.015]"
                          : ""
                  }`}
                  style={dev ? { boxShadow: "inset 3px 0 0 #ffd166" } : me ? { boxShadow: "inset 3px 0 0 #53e9ff" } : undefined}
                >
                  <span
                    className={`hud-num font-display text-sm font-bold ${
                      i === 0 ? "text-amber-300" : i === 1 ? "text-slate-200" : i === 2 ? "text-orange-300" : "text-white/40"
                    }`}
                  >
                    {i < 3 ? (
                      i === 0 ? <Crown className="h-4 w-4" /> : <Medal className="h-4 w-4" />
                    ) : (
                      i + 1
                    )}
                  </span>

                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={`truncate font-display text-xs font-bold tracking-wider sm:text-sm ${
                        dev ? "text-amber-200" : me ? "text-cyan-200" : "text-white/85"
                      }`}
                    >
                      {e.name}
                    </span>
                    {dev && (
                      <span className="shrink-0 rounded-sm bg-amber-300 px-1.5 py-px font-display text-[7px] font-black tracking-[0.15em] text-black">
                        DEV
                      </span>
                    )}
                    {me && !dev && (
                      <span className="shrink-0 rounded-sm bg-cyan-300 px-1.5 py-px font-display text-[7px] font-black tracking-[0.15em] text-black">
                        YOU
                      </span>
                    )}
                  </span>

                  <span className="hidden truncate font-display text-[10px] tracking-wider text-white/45 sm:block">
                    {e.zone}
                  </span>

                  <span className="hud-num text-right font-display text-xs font-bold text-white sm:text-sm">
                    {fmtScore(e.score)}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <p className="mt-4 text-center font-display text-[9px] tracking-[0.3em] text-white/30">
          © 2026 MOHAMMED ANAS. ALL RIGHTS RESERVED.
        </p>
      </div>
    </div>
  );
}

import { useState } from "react";
import {
  Rocket, ChevronRight, ChevronLeft, MousePointer2, Zap, Target,
  Heart, Star, Sparkles, Check, Volume2, VolumeX, Timer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DEV_NAME } from "../game/leaderboard";

/* ------------------------------------------------------------------ */
/*  NAME PROMPT — first launch                                         */
/* ------------------------------------------------------------------ */

export function NamePrompt({ onDone }: { onDone: (name: string, sound: boolean) => void }) {
  const [v, setV] = useState("");
  const [sound, setSound] = useState(true);
  const clean = v.toUpperCase().replace(/[^A-Z0-9 _-]/g, "").slice(0, 14);
  const ok = clean.trim().length >= 2;

  const submit = () => {
    if (ok) onDone(clean.trim(), sound);
  };

  return (
    <div className="ui-scroll absolute inset-0 z-40 overflow-y-auto bg-[#05030e]/92 backdrop-blur-md">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="anim-fade-up w-full max-w-sm">
          {/* logo lockup */}
          <div className="mb-5 text-center">
            <div className="font-display text-[9px] tracking-[0.55em] text-cyan-300/80">
              HYPERVELOCITY DODGE PROTOCOL
            </div>
            <h1 className="title-gradient mt-1.5 font-display text-4xl font-black leading-none tracking-[0.04em] sm:text-5xl">
              SUPERVELOCITY
            </h1>
          </div>

          <div
            className="relative overflow-hidden border p-5 sm:p-6"
            style={{
              borderColor: "rgba(120,200,255,0.22)",
              background: "linear-gradient(160deg, rgba(12,16,38,0.92), rgba(6,8,22,0.82))",
            }}
          >
            {/* accent bar */}
            <div
              className="absolute inset-x-0 top-0 h-[2px]"
              style={{ background: "linear-gradient(90deg, transparent, #53e9ff, #ff7ad9, transparent)" }}
            />
            <div className="flex items-center gap-2">
              <Rocket className="h-3.5 w-3.5 text-cyan-300" />
              <span className="font-display text-[9px] tracking-[0.4em] text-cyan-300/90">
                PILOT REGISTRATION
              </span>
            </div>
            <h2 className="mt-1.5 font-display text-xl font-black tracking-[0.15em] text-white sm:text-2xl">
              ENTER YOUR CALLSIGN
            </h2>
            <p className="mt-1.5 text-xs leading-snug text-white/50">
              Shown on the global leaderboard. Highest score takes rank #1.
            </p>

          <input
            autoFocus
            value={clean}
            onChange={(e) => setV(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="ENTER CALLSIGN"
            maxLength={14}
            className="mt-5 w-full border border-white/20 bg-black/40 px-4 py-3 text-center font-display text-xl font-bold tracking-[0.25em] text-cyan-200 outline-none transition-colors placeholder:text-white/25 focus:border-cyan-300/70"
          />
          <div className="mt-1.5 flex justify-between font-display text-[9px] tracking-[0.2em] text-white/30">
            <span>2–14 CHARACTERS</span>
            <span>{clean.length}/14</span>
          </div>

          {/* sound preference */}
          <div className="mt-4 flex items-center justify-between border border-white/12 bg-white/[0.03] px-3 py-2.5">
            <span className="flex items-center gap-2">
              {sound ? (
                <Volume2 className="h-4 w-4 text-cyan-300" />
              ) : (
                <VolumeX className="h-4 w-4 text-white/40" />
              )}
              <span className="font-display text-[11px] tracking-[0.2em] text-white/75">SOUND</span>
            </span>
            <button
              type="button"
              onClick={() => setSound((s) => !s)}
              className={`relative h-6 w-12 shrink-0 cursor-pointer rounded-full border transition-colors ${
                sound ? "border-cyan-300/70 bg-cyan-400/25" : "border-white/20 bg-white/5"
              }`}
              aria-label="Toggle sound"
            >
              <span
                className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-all ${
                  sound ? "left-[calc(100%-1.15rem)] bg-cyan-300" : "left-1 bg-white/40"
                }`}
              />
            </button>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={!ok}
            className={`btn-sheen clip-notch mt-5 flex w-full items-center justify-center gap-2 border py-3.5 font-display text-sm tracking-[0.25em] transition-colors ${
              ok
                ? "cursor-pointer border-cyan-300/70 bg-cyan-400/20 text-cyan-100 hover:bg-cyan-300 hover:text-black"
                : "cursor-not-allowed border-white/12 text-white/30"
            }`}
          >
            <Check className="h-4 w-4" /> START
          </button>
          </div>

          <p className="mt-4 text-center text-[10px] leading-snug tracking-wider text-white/30">
            Climb the board. Beat{" "}
            <span className="font-display tracking-wider text-amber-300/80">{DEV_NAME}</span>.
          </p>
          <p className="mt-3 text-center font-display text-[8px] tracking-[0.3em] text-white/20">
            © 2026 MOHAMMED ANAS
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TUTORIAL — interactive walkthrough for new pilots                  */
/* ------------------------------------------------------------------ */

interface Step {
  icon: LucideIcon;
  title: string;
  body: string;
  tip: string;
}

const STEPS: Step[] = [
  {
    icon: MousePointer2,
    title: "STEER YOUR CRAFT",
    body: "On PC your ship follows the mouse. On phone, drag anywhere on screen — the ship moves with your finger, and holds its line when you let go.",
    tip: "Small inputs win. At 800 KM/H a twitch is a crash.",
  },
  {
    icon: Target,
    title: "DODGE THE STRUCTURES",
    body: "Fly through the gaps in walls, weave between pillars, and time your run past sweeper blades. Passing close to an edge pays a NEAR MISS bonus.",
    tip: "Aim for the middle of a gap, then drift toward the next one early.",
  },
  {
    icon: Zap,
    title: "BOOST FOR SCORE",
    body: "Hold SPACE (or left-click) on PC. On mobile hold the boost pad — or just put a second finger anywhere on screen. Boosting doubles all points.",
    tip: "Boost on clear straights, release before dense hazard clusters.",
  },
  {
    icon: Sparkles,
    title: "USE YOUR ABILITY",
    body: "Every craft has a signature power — shields, time dilation, ghost phase and more. Press E on PC or tap the ability dial on mobile.",
    tip: "Save it for the final stretch when hazards come fastest.",
  },
  {
    icon: Star,
    title: "COLLECT STARS",
    body: "Stars are worth points AND are real currency. Bank them, then spend them in the Hangar to unlock faster craft with better abilities.",
    tip: "Stars are usually placed along the safest path — follow them.",
  },
  {
    icon: Heart,
    title: "MIND YOUR HULL",
    body: "Each hit costs one hull point. Lose them all and the run ends. Rare green cells repair one point. Tougher craft carry up to five.",
    tip: "After a hit you get brief invulnerability — use it to reposition.",
  },
  {
    icon: Timer,
    title: "BONUS MODES & RANKS",
    body: "Beyond the zones: OVERDRIVE runs forever, TIME ATTACK gives you 45 seconds (gates add +3s), and GAUNTLET gives you a single hull point. Every run posts to the leaderboard.",
    tip: "Own every craft? Stars then buy tier-3 hull, handling and boost upgrades.",
  },
];

export function Tutorial({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const Icon = step.icon;
  const last = i === STEPS.length - 1;

  return (
    <div className="ui-scroll absolute inset-0 z-40 overflow-y-auto overscroll-contain bg-[#05030e]/94 p-4 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center">
        <div className="anim-fade-up w-full max-w-lg">
          <div className="panel-glass clip-notch relative p-5 sm:p-8">
            {/* progress dots */}
            <div className="mb-5 flex items-center gap-1.5">
              {STEPS.map((_, n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setI(n)}
                  className="h-1 flex-1 cursor-pointer rounded-full transition-colors"
                  style={{ background: n <= i ? "#53e9ff" : "rgba(255,255,255,0.15)" }}
                  aria-label={`Step ${n + 1}`}
                />
              ))}
            </div>

            <div className="flex items-center justify-between">
              <span className="font-display text-[9px] tracking-[0.45em] text-cyan-300/90">
                FLIGHT SCHOOL · {i + 1}/{STEPS.length}
              </span>
              <button
                type="button"
                onClick={onSkip}
                className="cursor-pointer font-display text-[9px] tracking-[0.25em] text-white/35 transition-colors hover:text-white/70"
              >
                SKIP
              </button>
            </div>

            <div className="mt-5 flex items-start gap-4">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center border"
                style={{ borderColor: "#53e9ff55", background: "#53e9ff14" }}
              >
                <Icon className="h-7 w-7 text-cyan-300" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-lg font-black tracking-[0.15em] text-white sm:text-xl">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-snug text-white/60">{step.body}</p>
              </div>
            </div>

            <div className="mt-4 border-l-2 border-amber-300/60 bg-amber-400/[0.08] px-3 py-2">
              <span className="font-display text-[9px] tracking-[0.2em] text-amber-300">PRO TIP</span>
              <p className="mt-0.5 text-xs leading-snug text-white/55">{step.tip}</p>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setI((v) => Math.max(0, v - 1))}
                disabled={i === 0}
                className={`flex items-center gap-1.5 border px-4 py-2.5 font-display text-[10px] tracking-[0.25em] transition-colors ${
                  i === 0
                    ? "cursor-not-allowed border-white/10 text-white/20"
                    : "cursor-pointer border-white/20 text-white/70 hover:border-cyan-300/50 hover:text-white"
                }`}
              >
                <ChevronLeft className="h-4 w-4" /> BACK
              </button>
              <button
                type="button"
                onClick={() => (last ? onDone() : setI((v) => v + 1))}
                className="btn-sheen clip-notch flex flex-1 cursor-pointer items-center justify-center gap-2 border border-cyan-300/70 bg-cyan-400/20 py-3 font-display text-xs tracking-[0.25em] text-cyan-100 transition-colors hover:bg-cyan-300 hover:text-black"
              >
                {last ? (
                  <>
                    <Rocket className="h-4 w-4" /> START FLYING
                  </>
                ) : (
                  <>
                    NEXT <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

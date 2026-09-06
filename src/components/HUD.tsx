import { HUDState } from "../game/engine";
import { fmtScore } from "../game/utils";
import { Heart, Zap, Star, Pause, Sparkles } from "lucide-react";

export interface Toast {
  id: number;
  text: string;
  kind: "bonus" | "warn" | "info";
}

interface Props {
  hud: HUDState | null;
  toasts: Toast[];
  flash: number;
  showFps: boolean;
  onBoostDown: () => void;
  onBoostUp: () => void;
  onPause: () => void;
  onAbility: () => void;
}

export default function HUD({
  hud, toasts, flash, showFps, onBoostDown, onBoostUp, onPause, onAbility,
}: Props) {
  if (!hud) return null;
  const accent = hud.accent;
  const lean = hud.tiltHud;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      {/* damage flash */}
      {flash > 0 && (
        <div
          key={flash}
          className="anim-flash absolute inset-0"
          style={{ background: "radial-gradient(ellipse at center, rgba(255,40,60,0.12) 30%, rgba(255,30,50,0.5) 100%)" }}
        />
      )}
      {hud.hearts <= 1 && hud.playing && (
        <div
          className="anim-pulse-soft absolute inset-0"
          style={{ background: "radial-gradient(ellipse at center, transparent 52%, rgba(255,30,50,0.34) 100%)" }}
        />
      )}

      {/* ============ TOP BAR — safe-area aware ============ */}
      <div className="hud-top absolute inset-x-0 top-0 flex items-start justify-between gap-2 px-3 pt-2 sm:px-6 sm:pt-4">
        {/* left: hull (classic mode only — modern mode shows pips on the plane) */}
        <div className="flex flex-col gap-1" style={{ transform: `translateX(${lean * 0.6}px)` }}>
          {!hud.modernUi && (
            <>
              <div className="font-display text-[8px] tracking-[0.3em] text-white/45 sm:text-[10px]">HULL</div>
              <div className="flex gap-1">
                {Array.from({ length: hud.maxHearts }, (_, i) => (
                  <Heart
                    key={i}
                    className={`h-3.5 w-3.5 sm:h-5 sm:w-5 ${i < hud.hearts ? "" : "opacity-25"}`}
                    fill={i < hud.hearts ? "#ff4d5e" : "none"}
                    color={i < hud.hearts ? "#ff4d5e" : "#ffffff88"}
                    strokeWidth={1.5}
                  />
                ))}
              </div>
            </>
          )}
          {hud.stars > 0 && (
            <div className="flex items-center gap-1 text-amber-300">
              <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5" fill="currentColor" />
              <span className="hud-num font-display text-xs sm:text-sm">{hud.stars}</span>
            </div>
          )}
        </div>

        {/* center: zone + progress */}
        <div className="min-w-0 max-w-[46%] flex-1 sm:max-w-[420px]">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="truncate font-display text-[8px] tracking-[0.25em] text-white/55 sm:text-[10px] sm:tracking-[0.35em]">
              {hud.levelName}
            </span>
            <span className="shrink-0 font-display text-[8px] tracking-[0.15em] text-white/40 sm:text-[10px]">
              {hud.endless ? `${hud.dist}M` : `${hud.dist}/${hud.target}M`}
            </span>
          </div>
          {hud.timeLeft > 0 && (
            <div
              className={`mb-1 text-center font-display text-2xl font-black leading-none sm:text-4xl ${
                hud.timeLeft <= 5 ? "anim-blink" : ""
              }`}
              style={{
                color: hud.timeLeft <= 5 ? "#ff5e6e" : hud.timeLeft <= 12 ? "#ffd166" : "#fff",
                textShadow: "0 0 18px rgba(0,0,0,0.7)",
              }}
            >
              {hud.timeLeft.toFixed(1)}
              <span className="ml-0.5 text-[10px] tracking-widest opacity-60">S</span>
            </div>
          )}
          <div className="h-[5px] overflow-hidden rounded-full bg-white/12 sm:h-[7px]">
            <div
              className="h-full rounded-full transition-[width] duration-200"
              style={{
                width: `${Math.min(100, hud.progress01 * 100)}%`,
                background: `linear-gradient(90deg, ${accent}66, ${accent})`,
                boxShadow: `0 0 12px ${accent}88`,
              }}
            />
          </div>
          {showFps && (
            <div
              className="mx-auto mt-1 w-fit rounded-sm border border-white/15 bg-black/45 px-1.5 py-px font-display text-[8px] tracking-[0.15em] sm:text-[10px]"
              style={{ color: hud.fps >= 55 ? "#7dffa8" : hud.fps >= 30 ? "#ffd166" : "#ff6b6b" }}
            >
              {hud.fps} FPS
            </div>
          )}
        </div>

        {/* right: score + pause */}
        <div className="flex items-start gap-2" style={{ transform: `translateX(${lean * 0.6}px)` }}>
          <div className="text-right">
            <div className="font-display text-[8px] tracking-[0.3em] text-white/45 sm:text-[10px]">SCORE</div>
            <div className="hud-num font-display text-lg font-bold leading-tight text-white sm:text-4xl">
              {fmtScore(hud.score)}
            </div>
            {hud.mult > 1 && (
              <div
                className="anim-blink mt-0.5 inline-block rounded-sm px-1.5 py-px font-display text-[8px] font-bold tracking-widest text-black sm:text-xs"
                style={{ background: accent }}
              >
                ×{hud.mult}
              </div>
            )}
          </div>
          <button
            type="button"
            data-nosteer
            onClick={onPause}
            className="pointer-events-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/40 backdrop-blur sm:h-10 sm:w-10"
            aria-label="Pause"
          >
            <Pause className="h-3.5 w-3.5 text-white sm:h-4 sm:w-4" />
          </button>
        </div>
      </div>

      {/* ============ toasts ============ */}
      <div className="absolute left-1/2 top-[22%] flex w-full -translate-x-1/2 flex-col items-center gap-1">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`anim-toast font-display text-xs tracking-[0.25em] sm:text-base sm:tracking-[0.3em] ${
              t.kind === "bonus" ? "text-cyan-200" : t.kind === "warn" ? "text-amber-300" : "text-white"
            }`}
            style={{ textShadow: "0 0 16px rgba(120,220,255,0.55), 0 2px 6px rgba(0,0,0,0.6)" }}
          >
            {t.text}
          </div>
        ))}
      </div>

      {/* ============ countdown ============ */}
      {hud.countdown >= 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            key={hud.countdown}
            className="anim-countdown font-display text-7xl font-black tracking-widest sm:text-9xl"
            style={{ color: hud.countdown === 0 ? accent : "#fff", textShadow: `0 0 44px ${accent}aa` }}
          >
            {hud.countdown === 0 ? "GO" : hud.countdown}
          </div>
        </div>
      )}

      {/* ============ BOTTOM-LEFT: speed (thumb-safe) ============ */}
      <div
        className="hud-bottom absolute bottom-0 left-0 px-3 pb-2 sm:px-6 sm:pb-5"
        style={{ transform: `translateX(${lean}px)` }}
      >
        <div className="hud-num font-display text-2xl font-black leading-none text-white sm:text-5xl">
          {hud.speedKmh}
          <span className="ml-1 text-[9px] font-semibold tracking-widest text-white/50 sm:text-sm">KM/H</span>
        </div>
        {/* classic boost bar (modern mode shows the arc on the plane) */}
        {!hud.modernUi && (
          <div className="mt-1.5 h-[5px] w-28 overflow-hidden rounded-full bg-white/12 sm:h-[7px] sm:w-44">
            <div
              className="h-full rounded-full"
              style={{
                width: `${hud.boost01 * 100}%`,
                background: hud.mult > 1 ? `linear-gradient(90deg,#fff,${accent})` : `${accent}aa`,
                boxShadow: hud.mult > 1 ? `0 0 14px ${accent}` : "none",
              }}
            />
          </div>
        )}
      </div>

      {/* ============ BOTTOM-RIGHT THUMB CLUSTER ============ */}
      {/* Sized/placed per mobile-game convention: primary action lowest-right
          under the thumb arc, secondary action up-left of it.               */}
      <div className="hud-cluster absolute bottom-0 right-0 flex items-end gap-2 px-3 pb-3 sm:px-6 sm:pb-6">
        {/* ability — secondary */}
        <button
          type="button"
          data-nosteer
          onClick={onAbility}
          disabled={!hud.abilityReady}
          className={`pointer-events-auto relative mb-6 flex h-[3.25rem] w-[3.25rem] flex-col items-center justify-center rounded-full border-2 transition-transform sm:mb-8 sm:h-[4.25rem] sm:w-[4.25rem] ${
            hud.abilityActive ? "scale-110" : hud.abilityReady ? "" : "opacity-50"
          }`}
          style={{
            borderColor: hud.abilityActive ? "#fff" : hud.abilityReady ? `${accent}cc` : "#ffffff33",
            background: hud.abilityReady ? `radial-gradient(circle, ${accent}30, transparent 70%)` : "rgba(0,0,0,0.35)",
            boxShadow: hud.abilityActive ? `0 0 26px ${accent}` : hud.abilityReady ? `0 0 14px ${accent}55` : "none",
            touchAction: "none",
          }}
          aria-label="Ability"
        >
          <Sparkles
            className={`h-5 w-5 sm:h-6 sm:w-6 ${hud.abilityReady ? "anim-pulse-soft" : ""}`}
            style={{ color: hud.abilityReady ? accent : "#ffffff77" }}
          />
          <span className="mt-px font-display text-[6px] tracking-[0.12em] text-white/60 sm:text-[7px]">
            {hud.abilityActive ? "ON" : hud.abilityReady ? "READY" : `${Math.round(hud.abilityCd01 * 100)}%`}
          </span>
          {!hud.abilityReady && !hud.abilityActive && (
            <span
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(${accent}66 ${hud.abilityCd01 * 360}deg, transparent 0deg)`,
                mask: "radial-gradient(circle, transparent 62%, black 64%)",
                WebkitMask: "radial-gradient(circle, transparent 62%, black 64%)",
              }}
            />
          )}
        </button>

        {/* boost — primary, biggest target, lowest-right */}
        <div
          className="coarse-only pointer-events-auto relative h-[5.25rem] w-[5.25rem] select-none items-center justify-center rounded-full border-2"
          style={{
            borderColor: `${accent}99`,
            background: `radial-gradient(circle, ${accent}2e, transparent 72%)`,
            boxShadow: `0 0 22px ${accent}44, inset 0 0 18px ${accent}22`,
            touchAction: "none",
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture?.(e.pointerId);
            onBoostDown();
          }}
          onPointerUp={onBoostUp}
          onPointerCancel={onBoostUp}
          onContextMenu={(e) => e.preventDefault()}
          role="button"
          aria-label="Boost"
        >
          {/* radial boost fuel indicator */}
          <span
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(${accent}cc ${hud.boost01 * 360}deg, transparent 0deg)`,
              mask: "radial-gradient(circle, transparent 76%, black 78%)",
              WebkitMask: "radial-gradient(circle, transparent 76%, black 78%)",
            }}
          />
          <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center">
            <Zap className="h-7 w-7" style={{ color: accent }} fill={`${accent}55`} />
            <span className="mt-px font-display text-[6px] tracking-[0.15em] text-white/55">2-FINGER OK</span>
          </div>
        </div>
      </div>

      {/* desktop hint */}
      <div className="pointer-events-none absolute bottom-1 right-4 hidden text-right sm:block">
        <span className="font-display text-[8px] tracking-[0.25em] text-white/30">
          {hud.abilityName} · [E] &nbsp;·&nbsp; BOOST [SPACE]
        </span>
      </div>
    </div>
  );
}

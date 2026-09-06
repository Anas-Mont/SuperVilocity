import { ReactNode } from "react";
import {
  Play, Info, Settings as SettingsIcon, Trophy, Lock, ChevronRight,
  RotateCcw, Home, Rocket, Zap, Heart, Star, MousePointer2, Keyboard,
  Target, Infinity as InfinityIcon, Gauge, ArrowLeft, Check,
  Smartphone, Activity, Sparkles, Layers, Volume2, Wifi, BookOpen, Medal, Crown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SHIPS, ShipDef, ABILITIES } from "../game/ships";
import ShipPreview from "./ShipPreview";
import { LEVELS, ZONES, STAGES, LevelConfig, ENDLESS_LEVEL, EXTRA_MODES } from "../game/levels";
import {
  getUpgrades, upgradeCost, MAX_TIER, UpgradeKind,
  getPrestige, getSpent, prestigeCost, prestigeBonus, prestigeTitle,
} from "../game/storage";
import { RunResult } from "../game/engine";
import { getBest, Settings } from "../game/storage";
import { fmtScore } from "../game/utils";

/* ------------------------------------------------------------------ */
/*  shared bits                                                        */
/* ------------------------------------------------------------------ */

function Corners({ color = "rgba(140,220,255,0.55)" }: { color?: string }) {
  const c = "absolute h-3.5 w-3.5 border-current opacity-90";
  return (
    <span className="pointer-events-none absolute inset-0" style={{ color }}>
      <span className={`${c} left-0 top-0 border-l-2 border-t-2`} />
      <span className={`${c} right-0 top-0 border-r-2 border-t-2`} />
      <span className={`${c} bottom-0 left-0 border-b-2 border-l-2`} />
      <span className={`${c} bottom-0 right-0 border-b-2 border-r-2`} />
    </span>
  );
}

interface BtnProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  primary?: boolean;
  small?: boolean;
}

export function MenuBtn({ icon: Icon, label, onClick, primary, small }: BtnProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        onClick();
        e.currentTarget.blur();
      }}
      className={`btn-sheen clip-notch group relative flex w-full items-center justify-between gap-4 border font-display uppercase tracking-[0.25em] transition-all duration-200 ${
        small ? "px-5 py-2.5 text-xs" : "px-7 py-4 text-sm"
      } ${
        primary
          ? "border-cyan-300/70 bg-cyan-400/15 text-cyan-100 hover:bg-cyan-300 hover:text-black"
          : "border-white/20 bg-white/[0.04] text-white/80 hover:border-cyan-300/60 hover:bg-cyan-400/10 hover:text-white"
      }`}
    >
      <span className="flex items-center gap-3">
        <Icon className={`${small ? "h-4 w-4" : "h-5 w-5"} transition-transform duration-200 group-hover:scale-110`} strokeWidth={primary ? 2.5 : 1.8} />
        {label}
      </span>
      <ChevronRight className="h-4 w-4 opacity-40 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100" />
    </button>
  );
}

function Overlay({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <div className="ui-scroll absolute inset-0 z-20 overflow-y-auto overscroll-contain bg-gradient-to-b from-[#05030e]/88 via-[#05030e]/66 to-[#05030e]/92">
      <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
        <div className="anim-fade-up w-full max-w-3xl" style={{ animationDelay: `${delay}ms` }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function StatBlock({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel-glass clip-notch relative min-w-0 flex-1 px-2.5 py-3 text-center sm:px-5 sm:py-4">
      <div className="font-display text-[8px] tracking-[0.25em] text-white/45 sm:text-[9px] sm:tracking-[0.3em]">{label}</div>
      <div className="hud-num mt-1 truncate font-display text-lg font-bold text-white sm:text-3xl">{value}</div>
      {sub && <div className="mt-0.5 truncate text-[10px] text-white/40 sm:text-xs">{sub}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  MAIN MENU                                                          */
/* ------------------------------------------------------------------ */

export function MainMenu({
  onPlay, onHow, onSettings, onHangar, onBoard, onTutorial, stars, pilot, rank,
}: {
  onPlay: () => void;
  onHow: () => void;
  onSettings: () => void;
  onHangar: () => void;
  onBoard: () => void;
  onTutorial: () => void;
  stars: number;
  pilot: string;
  rank: number;
}) {
  let bestAll = 0;
  for (const lv of LEVELS) {
    const b = getBest(lv.endless ? "endless" : lv.id);
    if (b && b.score > bestAll) bestAll = b.score;
  }
  const isAnas = pilot.toUpperCase() === "MUHAMMED ANAS" || pilot.toUpperCase() === "MOHAMMED ANAS";
  return (
    <div className="menu-root absolute inset-0 z-20 flex flex-col items-center justify-center overflow-y-auto bg-gradient-to-b from-[#05030e]/72 via-[#05030e]/30 to-[#05030e]/80 p-4 sm:p-6">
      {/* top ticker */}
      <div className="absolute left-1/2 top-3 hidden w-full max-w-4xl -translate-x-1/2 items-center justify-between px-6 font-display text-[10px] tracking-[0.4em] text-white/40 sm:top-5 sm:flex">
        <span>SIM // FLIGHT-DECK v2.4</span>
        <span className="anim-pulse-soft text-cyan-300/80">▲ LIVE FEED — AUTOPILOT</span>
        <span>ORBITAL RING SECTOR 7</span>
      </div>

      <div className="menu-inner flex w-full max-w-lg flex-col items-center">
        <div className="anim-fade-up menu-kicker font-display text-[10px] tracking-[0.5em] text-cyan-300/90 sm:text-xs sm:tracking-[0.65em]">
          HYPERVELOCITY DODGE PROTOCOL
        </div>
        <h1
          className="anim-fade-up title-gradient menu-title mt-2 text-center font-display text-6xl font-black leading-[0.95] tracking-[0.06em] sm:mt-3 sm:text-8xl"
          style={{ animationDelay: "80ms" }}
        >
          SUPERVELOCITY
        </h1>
        <p
          className="anim-fade-up menu-sub mt-3 max-w-md text-center text-sm font-medium leading-snug text-white/55 sm:mt-4 sm:text-lg"
          style={{ animationDelay: "160ms" }}
        >
          Thread supersonic gates, dodge the architecture,
          ride the redline. No brakes aboard.
        </p>

        {/* pilot card */}
        <div
          className="anim-fade-up mt-5 flex w-full max-w-sm items-center gap-3 border px-3 py-2"
          style={{
            animationDelay: "200ms",
            borderColor: isAnas ? "#ffd16655" : "rgba(255,255,255,0.14)",
            background: isAnas
              ? "linear-gradient(90deg, rgba(255,209,102,0.16), transparent)"
              : "rgba(255,255,255,0.035)",
          }}
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-display text-sm font-black"
            style={{
              borderColor: isAnas ? "#ffd166" : "#53e9ff66",
              color: isAnas ? "#ffd166" : "#53e9ff",
            }}
          >
            {(pilot || "P").charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className="truncate font-display text-sm font-bold tracking-[0.15em]"
                style={{ color: isAnas ? "#ffe9a8" : "#fff" }}
              >
                {pilot || "PILOT"}
              </span>
              {isAnas && (
                <span className="shrink-0 rounded-sm bg-amber-300 px-1.5 py-px font-display text-[7px] font-black tracking-[0.15em] text-black">
                  DEV
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 font-display text-[9px] tracking-[0.2em] text-white/40">
              <span className="text-amber-200/90">{prestigeTitle(getPrestige())}</span>
              <span className="flex items-center gap-1 text-amber-300/90">
                <Star className="h-2.5 w-2.5" fill="currentColor" />
                {fmtScore(stars)}
              </span>
              {bestAll > 0 && <span>BEST {fmtScore(bestAll)}</span>}
              {rank > 0 && <span className="text-cyan-300">RANK #{rank}</span>}
            </div>
          </div>
        </div>

        <div className="anim-fade-up menu-actions mt-4 flex w-full max-w-sm flex-col gap-2.5 sm:mt-6 sm:gap-3" style={{ animationDelay: "240ms" }}>
          <MenuBtn icon={Play} label="Launch Flight" onClick={onPlay} primary />
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <MenuBtn icon={Rocket} label="Hangar" onClick={onHangar} small />
            <MenuBtn icon={Medal} label="Ranks" onClick={onBoard} small />
            <MenuBtn icon={BookOpen} label="Tutorial" onClick={onTutorial} small />
            <MenuBtn icon={SettingsIcon} label="Systems" onClick={onSettings} small />
          </div>
          <button
            type="button"
            onClick={onHow}
            className="cursor-pointer text-center font-display text-[10px] tracking-[0.3em] text-white/35 transition-colors hover:text-cyan-300"
          >
            <Info className="mr-1.5 inline h-3 w-3" />
            FLIGHT MANUAL
          </button>
        </div>
      </div>

      <div className="absolute bottom-3 left-1/2 flex w-full max-w-4xl -translate-x-1/2 flex-col items-center gap-1 px-6 text-center sm:bottom-5">
        <div className="hidden w-full items-center justify-between font-display text-[10px] tracking-[0.4em] text-white/30 sm:flex">
          <span>WEBGL · REALTIME 3D</span>
          <span>MOUSE / WASD / TOUCH / GYRO</span>
        </div>
        <div className="font-display text-[9px] tracking-[0.3em] text-white/25 sm:text-[10px]">
          SUPERVELOCITY
        </div>
        <div className="font-display text-[9px] tracking-[0.3em] text-white/45 sm:text-[10px] sm:tracking-[0.4em]">
          © 2026 MOHAMMED ANAS. ALL RIGHTS RESERVED.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  LEVEL SELECT                                                       */
/* ------------------------------------------------------------------ */

function hexCss(n: number) {
  return `#${n.toString(16).padStart(6, "0")}`;
}

function LevelCard({
  lv, locked, onSelect, delay,
}: {
  lv: LevelConfig;
  locked: boolean;
  onSelect: () => void;
  delay: number;
}) {
  const best = getBest(lv.endless ? "endless" : lv.id);
  const t = lv.theme;
  return (
    <button
      type="button"
      disabled={locked}
      onClick={(e) => {
        if (!locked) onSelect();
        e.currentTarget.blur();
      }}
      className={`anim-fade-up group relative overflow-hidden border p-3.5 text-left transition-all duration-200 sm:p-5 ${
        locked
          ? "cursor-not-allowed border-white/8 bg-white/[0.02] opacity-45"
          : "border-white/12 bg-white/[0.045] hover:-translate-y-1 hover:bg-white/[0.09]"
      }`}
      style={{
        animationDelay: `${delay}ms`,
        borderColor: locked ? undefined : `${t.accent}30`,
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-[3px] transition-opacity"
        style={{ background: `linear-gradient(90deg, transparent, ${t.accent}, transparent)`, opacity: locked ? 0.2 : 0.85 }}
      />
      <div className="flex items-start justify-between">
        <div>
          <div className="font-display text-[10px] tracking-[0.35em]" style={{ color: locked ? "#ffffff55" : t.accent }}>
            {lv.name}
          </div>
          <div className="mt-1 font-display text-base font-bold tracking-wider text-white sm:mt-1.5 sm:text-xl">
            {lv.tag}
          </div>
        </div>
        {locked ? (
          <Lock className="h-5 w-5 text-white/40" />
        ) : lv.endless ? (
          <InfinityIcon className="h-5 w-5" style={{ color: t.accent }} />
        ) : (
          <Rocket className="h-5 w-5 text-white/35 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:text-white" />
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/55 sm:mt-4 sm:gap-4 sm:text-sm">
        <span className="flex items-center gap-1.5">
          <Gauge className="h-3.5 w-3.5" /> {lv.targetLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5" /> {Math.round(lv.maxSpeed * 5.2)} KM/H
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between sm:mt-3">
        <div className="flex gap-1">
          {[t.skyBottom, t.grid, t.glow, t.star].map((c, i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: hexCss(c) }} />
          ))}
        </div>
        {best ? (
          <span className="font-display text-[10px] tracking-[0.2em] text-amber-300/90">
            BEST {fmtScore(best.score)}
          </span>
        ) : (
          <span className="font-display text-[10px] tracking-[0.2em] text-white/30">
            {locked ? "CLEAR PRIOR ZONE" : "UNFLOWN"}
          </span>
        )}
      </div>
    </button>
  );
}

export function LevelSelect({
  unlocked, onSelect, onBack,
}: {
  unlocked: number;
  onSelect: (lv: LevelConfig) => void;
  onBack: () => void;
}) {
  return (
    <Overlay>
      <div className="mb-4 flex items-end justify-between sm:mb-6">
        <div>
          <div className="font-display text-[9px] tracking-[0.5em] text-cyan-300/80 sm:text-[10px]">FLIGHT DECK</div>
          <h2 className="mt-1 font-display text-2xl font-black tracking-widest text-white sm:text-4xl">
            SELECT ZONE
          </h2>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="flex shrink-0 items-center gap-2 border border-white/15 bg-white/5 px-3 py-1.5 font-display text-[10px] tracking-[0.25em] text-white/70 transition-colors hover:border-cyan-300/50 hover:text-white sm:px-4 sm:py-2 sm:text-xs"
        >
          <ArrowLeft className="h-4 w-4" /> BACK
        </button>
      </div>
      {STAGES.map((st) => {
        const zones = ZONES.filter((z) => z.stage === st.id);
        const stageLocked = zones.every((z) => z.id > unlocked);
        const firstIdx = ZONES.findIndex((z) => z.stage === st.id);
        return (
          <div key={st.id} className="mb-5">
            {/* stage header */}
            <div
              className="anim-fade-up mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-l-4 bg-white/[0.04] px-3 py-2"
              style={{ borderColor: st.accent, animationDelay: `${st.id * 40}ms` }}
            >
              <span className="font-display text-sm font-black tracking-[0.25em]" style={{ color: st.accent }}>
                {st.name}
              </span>
              <span className="font-display text-sm font-bold tracking-[0.2em] text-white">{st.subtitle}</span>
              <span
                className="ml-auto border px-2 py-0.5 font-display text-[8px] tracking-[0.2em]"
                style={{ borderColor: `${st.accent}55`, color: st.accent }}
              >
                {stageLocked ? "LOCKED" : st.newHazard}
              </span>
              <p className="w-full text-xs leading-snug text-white/45">{st.blurb}</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 lg:grid-cols-4">
              {zones.map((lv, i) => (
                <LevelCard
                  key={lv.id}
                  lv={lv}
                  locked={lv.id > unlocked}
                  onSelect={() => onSelect(lv)}
                  delay={(firstIdx + i) * 40}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* bonus modes */}
      <div className="mb-2">
        <div
          className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-l-4 bg-white/[0.04] px-3 py-2"
          style={{ borderColor: "#00f0ff" }}
        >
          <span className="font-display text-sm font-black tracking-[0.25em] text-cyan-300">BONUS MODES</span>
          <span className="font-display text-sm font-bold tracking-[0.2em] text-white">ALWAYS OPEN</span>
          <p className="w-full text-xs leading-snug text-white/45">
            Endless survival, a 45-second time chase where gates buy you seconds, and a one-hull gauntlet.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 lg:grid-cols-4">
          <LevelCard lv={ENDLESS_LEVEL} locked={false} onSelect={() => onSelect(ENDLESS_LEVEL)} delay={0} />
          {EXTRA_MODES.map((m, i) => (
            <LevelCard key={m.id} lv={m} locked={false} onSelect={() => onSelect(m)} delay={(i + 1) * 40} />
          ))}
        </div>
      </div>

      <p className="mt-3 text-center font-display text-[10px] tracking-[0.35em] text-white/35">
        CLEAR A ZONE TO UNLOCK THE NEXT — OVERDRIVE IS ALWAYS LIVE
      </p>
    </Overlay>
  );
}

/* ------------------------------------------------------------------ */
/*  HANGAR — buy craft with stars                                      */
/* ------------------------------------------------------------------ */

function StatBar({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 font-display text-[9px] tracking-[0.15em] text-white/40">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400/60 to-cyan-300"
          style={{ width: `${Math.min(100, v * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function Hangar({
  stars, owned, selected, onBuy, onSelect, onBack, onRev, onUpgrade, onPrestige,
}: {
  stars: number;
  owned: string[];
  selected: string;
  onBuy: (s: ShipDef) => void;
  onSelect: (s: ShipDef) => void;
  onBack: () => void;
  onRev: (s: ShipDef) => void;
  onUpgrade: (s: ShipDef, k: UpgradeKind) => void;
  onPrestige: () => void;
}) {
  const prestige = getPrestige();
  const spent = getSpent();
  return (
    <Overlay>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-display text-[10px] tracking-[0.5em] text-cyan-300/80">CRAFT BAY</div>
          <h2 className="mt-1 font-display text-3xl font-black tracking-widest text-white sm:text-4xl">HANGAR</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 border border-amber-300/40 bg-amber-400/10 px-3 py-2">
            <Star className="h-4 w-4 text-amber-300" fill="currentColor" />
            <span className="hud-num font-display text-sm text-amber-200">{fmtScore(stars)}</span>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="flex cursor-pointer items-center gap-2 border border-white/15 bg-white/5 px-4 py-2 font-display text-xs tracking-[0.25em] text-white/70 transition-colors hover:border-cyan-300/50 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> BACK
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 min-[520px]:grid-cols-2 sm:gap-3.5 lg:grid-cols-3">
        {SHIPS.map((s, i) => {
          const isOwned = owned.includes(s.id);
          const isActive = selected === s.id;
          const canAfford = stars >= s.cost;
          return (
            <div
              key={s.id}
              className="anim-fade-up relative flex flex-col border p-3.5 transition-colors sm:p-5"
              style={{
                animationDelay: `${i * 55}ms`,
                borderColor: isActive ? `${hexCss(s.glowColor)}aa` : "rgba(255,255,255,0.12)",
                background: isActive ? `${hexCss(s.glowColor)}12` : "rgba(255,255,255,0.035)",
              }}
            >
              <div
                className="absolute inset-x-0 top-0 h-[3px]"
                style={{ background: `linear-gradient(90deg, transparent, ${hexCss(s.glowColor)}, transparent)`, opacity: isOwned ? 0.9 : 0.3 }}
              />
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display text-[9px] tracking-[0.3em]" style={{ color: hexCss(s.glowColor) }}>
                    {s.tag}
                  </div>
                  <div className="mt-1 font-display text-lg font-bold tracking-wider text-white">{s.name}</div>
                </div>
                {isActive ? (
                  <Check className="h-5 w-5" style={{ color: hexCss(s.glowColor) }} />
                ) : isOwned ? (
                  <Rocket className="h-5 w-5 text-white/40" />
                ) : (
                  <Lock className="h-5 w-5 text-white/35" />
                )}
              </div>

              {/* live 3D turntable + engine audition */}
              <div className="mt-2 flex items-center justify-center">
                <div
                  className="relative flex items-center justify-center rounded-lg"
                  style={{ background: `radial-gradient(circle, ${hexCss(s.glowColor)}14, transparent 70%)` }}
                >
                  <ShipPreview def={s} size={124} />
                  <button
                    type="button"
                    onClick={() => onRev(s)}
                    title="Hear this engine"
                    className="absolute bottom-0 right-0 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border bg-black/45 backdrop-blur transition-colors hover:bg-black/70"
                    style={{ borderColor: `${hexCss(s.glowColor)}66` }}
                  >
                    <Volume2 className="h-3.5 w-3.5" style={{ color: hexCss(s.glowColor) }} />
                  </button>
                </div>
              </div>

              <p className="mt-1 text-xs leading-snug text-white/50 sm:min-h-[2.5rem] sm:text-sm">{s.desc}</p>

              {/* signature ability */}
              <div
                className="mt-2.5 border-l-2 bg-white/[0.04] px-2.5 py-1.5"
                style={{ borderColor: hexCss(s.glowColor) }}
              >
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" style={{ color: hexCss(s.glowColor) }} />
                  <span className="font-display text-[9px] tracking-[0.2em]" style={{ color: hexCss(s.glowColor) }}>
                    {ABILITIES[s.ability].name}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] leading-snug text-white/45">
                  {ABILITIES[s.ability].blurb}
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-1.5">
                <StatBar label="HULL" v={s.hull / 5} />
                <StatBar label="HANDLING" v={s.handling / 1.5} />
                <StatBar label="BOOST" v={s.boostPower / 1.4} />
                <StatBar label="CELL" v={(1.4 - s.boostDrain) / 0.9} />
              </div>

              {/* upgrades — where late-game stars go */}
              {isOwned && (
                <div className="mt-2.5 border border-white/10 bg-black/25 p-2">
                  <div className="mb-1.5 font-display text-[8px] tracking-[0.25em] text-white/40">
                    UPGRADES
                  </div>
                  {(["hull", "handling", "boost"] as UpgradeKind[]).map((k) => {
                    const tier = getUpgrades(s.id)[k];
                    const maxed = tier >= MAX_TIER;
                    const cost = upgradeCost(tier);
                    const afford = stars >= cost;
                    return (
                      <div key={k} className="flex items-center gap-2 py-0.5">
                        <span className="w-14 font-display text-[8px] tracking-[0.1em] text-white/45">
                          {k.toUpperCase()}
                        </span>
                        <span className="flex flex-1 gap-0.5">
                          {Array.from({ length: MAX_TIER }, (_, n) => (
                            <span
                              key={n}
                              className="h-1.5 flex-1 rounded-full"
                              style={{ background: n < tier ? hexCss(s.glowColor) : "rgba(255,255,255,0.12)" }}
                            />
                          ))}
                        </span>
                        <button
                          type="button"
                          disabled={maxed || !afford}
                          onClick={() => onUpgrade(s, k)}
                          className={`w-14 border px-1 py-0.5 text-center font-display text-[8px] tracking-[0.05em] transition-colors ${
                            maxed
                              ? "border-white/10 text-white/25"
                              : afford
                                ? "cursor-pointer border-amber-300/50 text-amber-200 hover:bg-amber-300 hover:text-black"
                                : "cursor-not-allowed border-white/10 text-white/25"
                          }`}
                        >
                          {maxed ? "MAX" : `★${cost}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-3">
                {isActive ? (
                  <div className="w-full border border-white/15 bg-white/5 py-2 text-center font-display text-[10px] tracking-[0.3em] text-white/70">
                    IN SERVICE
                  </div>
                ) : isOwned ? (
                  <button
                    type="button"
                    onClick={() => onSelect(s)}
                    className="w-full cursor-pointer border border-cyan-300/60 bg-cyan-400/15 py-2 font-display text-[10px] tracking-[0.3em] text-cyan-100 transition-colors hover:bg-cyan-300 hover:text-black"
                  >
                    EQUIP
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => canAfford && onBuy(s)}
                    className={`flex w-full items-center justify-center gap-2 border py-2 font-display text-[10px] tracking-[0.3em] transition-colors ${
                      canAfford
                        ? "cursor-pointer border-amber-300/60 bg-amber-400/15 text-amber-100 hover:bg-amber-300 hover:text-black"
                        : "cursor-not-allowed border-white/12 text-white/30"
                    }`}
                  >
                    <Star className="h-3.5 w-3.5" fill="currentColor" />
                    {fmtScore(s.cost)}
                    {!canAfford && " — NEED MORE"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* STAR VAULT — prestige: the endless star sink */}
      <div
        className="anim-fade-up mt-5 overflow-hidden border p-4 sm:p-5"
        style={{
          borderColor: "rgba(255,209,102,0.32)",
          background: "linear-gradient(140deg, rgba(255,209,102,0.13), rgba(255,122,217,0.06), transparent)",
        }}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Crown className="h-4 w-4 text-amber-300" />
          <span className="font-display text-[10px] tracking-[0.4em] text-amber-300">STAR VAULT</span>
          <span className="ml-auto font-display text-[9px] tracking-[0.2em] text-white/40">
            LIFETIME SPENT ★{fmtScore(spent)}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div>
            <div className="font-display text-[9px] tracking-[0.25em] text-white/45">PILOT RANK</div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="font-display text-2xl font-black tracking-[0.1em] text-amber-200 sm:text-3xl">
                {prestigeTitle(prestige)}
              </span>
              <span className="hud-num font-display text-sm text-white/50">LV {prestige}</span>
            </div>
          </div>
          <div>
            <div className="font-display text-[9px] tracking-[0.25em] text-white/45">SCORE BONUS</div>
            <div className="hud-num mt-0.5 font-display text-2xl font-black text-cyan-300 sm:text-3xl">
              +{Math.round((prestigeBonus(prestige) - 1) * 100)}%
            </div>
          </div>
        </div>

        <p className="mt-2 text-xs leading-snug text-white/45">
          Spend stars to promote your pilot. Every rank permanently boosts <b>all</b> future
          scores and upgrades your leaderboard title. Ranks never stop.
        </p>

        <button
          type="button"
          disabled={stars < prestigeCost(prestige)}
          onClick={onPrestige}
          className={`btn-sheen clip-notch mt-3 flex w-full items-center justify-center gap-2 border py-2.5 font-display text-[11px] tracking-[0.25em] transition-colors sm:w-auto sm:px-8 ${
            stars >= prestigeCost(prestige)
              ? "cursor-pointer border-amber-300/70 bg-amber-400/20 text-amber-100 hover:bg-amber-300 hover:text-black"
              : "cursor-not-allowed border-white/12 text-white/30"
          }`}
        >
          <Crown className="h-4 w-4" />
          PROMOTE TO {prestigeTitle(prestige + 1)} · ★{fmtScore(prestigeCost(prestige))}
        </button>
      </div>

      <p className="mt-4 text-center font-display text-[10px] tracking-[0.3em] text-white/35">
        STARS BUY CRAFT → UPGRADES → PILOT RANKS. NOTHING IS EVER WASTED.
      </p>
    </Overlay>
  );
}

/* ------------------------------------------------------------------ */
/*  HOW TO PLAY                                                        */
/* ------------------------------------------------------------------ */

function ControlRow({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 border border-white/10 bg-white/[0.03] p-3 sm:gap-4 sm:p-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-cyan-300/30 bg-cyan-400/10 sm:h-10 sm:w-10">
        <Icon className="h-4 w-4 text-cyan-300 sm:h-5 sm:w-5" />
      </div>
      <div className="min-w-0">
        <div className="font-display text-xs font-bold tracking-[0.2em] text-white sm:text-sm">{title}</div>
        <div className="mt-1 text-xs leading-snug text-white/55 sm:text-sm">{desc}</div>
      </div>
    </div>
  );
}

export function HowToPlay({ onBack }: { onBack: () => void }) {
  return (
    <Overlay>
      <div className="panel-glass clip-notch relative p-4 sm:p-9">
        <Corners />
        <div className="font-display text-[9px] tracking-[0.5em] text-cyan-300/80 sm:text-[10px]">FLIGHT MANUAL</div>
        <h2 className="mt-1 font-display text-2xl font-black tracking-widest text-white sm:text-3xl">HOW TO FLY</h2>

        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:mt-6 sm:grid-cols-2 sm:gap-3">
          <ControlRow icon={MousePointer2} title="DRAG TO FLY (TOUCH)" desc="Swipe anywhere — the ship moves with your finger, relative to where you started. Lift off and it holds its line. Even the boost button steers: hold it and drag." />
          <ControlRow icon={Smartphone} title="GYRO MODE" desc="Enable Gyro Steering in Systems and tilt the handset to fly. Filtered and dead-zoned for stability; pausing re-centers your neutral hold." />
          <ControlRow icon={Keyboard} title="WASD / ARROWS" desc="Keyboard pilots steer with keys. Works alongside the mouse for fine trim adjustments." />
          <ControlRow icon={Zap} title="BOOST" desc="PC: hold SPACE or left-click. Mobile: hold the boost pad, OR just place a SECOND FINGER anywhere — release to cut thrust instantly." />
          <ControlRow icon={Target} title="RINGS & GATES" desc="Thread neon rings for +50. Slip through wall openings — edge passes pay near-miss bonuses." />
          <ControlRow icon={Heart} title="HULL" desc="Lose all hull points and you are debris. Grab rare green cells to repair. Tougher craft carry up to 5." />
          <ControlRow icon={Sparkles} title="SIGNATURE ABILITY — [E]" desc="Every craft has its own power: shields, time dilation, ram plate, ghost phase, repair surge or star magnet. Press E / Q / F or tap the ability dial." />
          <ControlRow icon={Star} title="STARS = CURRENCY" desc="Worth +25 score each AND banked as currency — spend them in the Hangar on faster craft." />
          <ControlRow icon={Target} title="STAGE II — LASERS & ROTORS" desc="From Zone 05: laser fences pulse on and off (watch the flicker warning) and rotor blades sweep whole sectors." />
          <ControlRow icon={Gauge} title="STAGE III — CRUSHERS" desc="From Zone 09: hydraulic jaws slam shut on a rhythm. Time your run through the gap — tight passes pay near-miss bonuses." />
        </div>

        <div className="mt-6 flex justify-end">
          <div className="w-48">
            <MenuBtn icon={ArrowLeft} label="Back" onClick={onBack} small />
          </div>
        </div>
      </div>
    </Overlay>
  );
}

/* ------------------------------------------------------------------ */
/*  SETTINGS                                                           */
/* ------------------------------------------------------------------ */

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-7 w-14 shrink-0 rounded-full border transition-colors duration-200 ${
        on ? "border-cyan-300/70 bg-cyan-400/25" : "border-white/20 bg-white/5"
      }`}
    >
      <span
        className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all duration-200 ${
          on ? "left-[calc(100%-1.45rem)] bg-cyan-300 shadow-[0_0_12px_rgba(83,233,255,0.8)]" : "left-1 bg-white/40"
        }`}
      />
    </button>
  );
}

/* NOTE: these live at module scope on purpose. Defining them inside
   SettingsPanel made React treat them as new component types on every
   render, unmounting the subtree mid-click so buttons stopped working. */
function SegBtn({
  active, label, onClick, dim,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  dim?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={dim ? "Above your display's refresh rate" : undefined}
      className={`cursor-pointer border px-2.5 py-1.5 font-display text-[10px] tracking-[0.2em] transition-colors sm:px-3 ${
        active
          ? "border-cyan-300/70 bg-cyan-400/20 text-cyan-200"
          : dim
            ? "border-white/10 text-white/25 hover:text-white/50"
            : "border-white/15 text-white/50 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function Row({ label, desc, right }: { label: string; desc: string; right: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-4">
      <div className="min-w-0">
        <div className="font-display text-xs font-bold tracking-[0.2em] text-white sm:text-sm">{label}</div>
        <div className="mt-0.5 text-xs leading-snug text-white/50 sm:text-sm">{desc}</div>
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

export function SettingsPanel({
  s, onChange, onBack, fpsLive, refreshHz, board,
}: {
  s: Settings;
  onChange: (s: Settings) => void;
  onBack: () => void;
  fpsLive: number;
  refreshHz: number;
  board: {
    id: string;
    busy: boolean;
    msg: string;
    onCreate: () => void;
    onJoin: (v: string) => void;
    onLeave: () => void;
  };
}) {

  return (
    <Overlay>
      <div className="panel-glass clip-notch relative p-4 sm:p-9">
        <Corners />
        <div className="font-display text-[9px] tracking-[0.5em] text-cyan-300/80 sm:text-[10px]">ONBOARD SYSTEMS</div>
        <h2 className="mt-1 font-display text-2xl font-black tracking-widest text-white sm:text-3xl">SETTINGS</h2>

        <div className="mt-4 flex flex-col gap-2.5 sm:mt-6 sm:gap-3">
          <Row label="SOUND FX" desc="Engines, impacts, pickups" right={<Toggle on={s.sfx} onClick={() => onChange({ ...s, sfx: !s.sfx })} />} />
          <Row label="MUSIC" desc="Ambient flight drone" right={<Toggle on={s.music} onClick={() => onChange({ ...s, music: !s.music })} />} />
          <Row label="CAMERA SHAKE" desc="Impact + speed feedback" right={<Toggle on={s.shake} onClick={() => onChange({ ...s, shake: !s.shake })} />} />
          <Row
            label="RENDER QUALITY"
            desc="LOW renders fewer pixels = faster"
            right={
              <div className="flex gap-1.5">
                {([1, 2, 3, 4] as const).map((q) => (
                  <SegBtn
                    key={q}
                    active={s.quality === q}
                    label={q === 1 ? "LOW" : q === 2 ? "MED" : q === 3 ? "HIGH" : "ULTRA"}
                    onClick={() => onChange({ ...s, quality: q })}
                  />
                ))}
              </div>
            }
          />
          <Row
            label="FPS LIMIT"
            desc={
              refreshHz > 0
                ? `Detected display: ${refreshHz}Hz. Browsers lock rendering to your screen's refresh rate, so ${refreshHz} FPS is the true ceiling — set MAX to use all of it.`
                : "Cap the frame rate — MAX uses your display's full refresh rate."
            }
            right={
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex gap-1.5">
                  {([60, 144, 240, 0] as const).map((f) => (
                    <SegBtn
                      key={f}
                      active={s.fps === f}
                      label={f === 0 ? "MAX" : String(f)}
                      onClick={() => onChange({ ...s, fps: f })}
                      dim={f !== 0 && refreshHz > 0 && f > refreshHz}
                    />
                  ))}
                </div>
                <span
                  className="hud-num min-w-[4.5rem] text-right font-display text-xs tracking-widest"
                  style={{ color: fpsLive >= 55 ? "#7dffa8" : fpsLive >= 30 ? "#ffd166" : "#ff6b6b" }}
                >
                  {fpsLive} FPS
                </span>
              </div>
            }
          />
          <Row
            label="SHOW FPS"
            desc="Live counter in-game"
            right={<Toggle on={s.showFps} onClick={() => onChange({ ...s, showFps: !s.showFps })} />}
          />

          <Row
            label="AUTO PERFORMANCE"
            desc="Dynamically scales resolution to hold a steady frame rate"
            right={<Toggle on={s.autoPerf} onClick={() => onChange({ ...s, autoPerf: !s.autoPerf })} />}
          />

          <div className="mt-2 flex items-center gap-3">
            <Trophy className="h-4 w-4 text-amber-300/80" />
            <span className="font-display text-[10px] tracking-[0.4em] text-amber-300/80">ONLINE BOARD</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <div className="border border-white/10 bg-white/[0.03] p-3 sm:p-4">
            <div className="font-display text-xs font-bold tracking-[0.2em] text-white sm:text-sm">
              SHARED LEADERBOARD
            </div>
            <div className="mt-0.5 text-xs leading-snug text-white/50">
              {board.id
                ? "Connected. Share your game link and everyone competes on the same board."
                : "Create a board to sync scores across devices and friends. No account needed."}
            </div>

            {board.id && (
              <div className="mt-2.5 flex items-center gap-2 border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1.5">
                <Wifi className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                <code className="truncate font-mono text-[11px] text-emerald-200">{board.id}</code>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {!board.id && (
                <button
                  type="button"
                  disabled={board.busy}
                  onClick={board.onCreate}
                  className="cursor-pointer border border-amber-300/60 bg-amber-400/15 px-3 py-2 font-display text-[10px] tracking-[0.2em] text-amber-100 transition-colors hover:bg-amber-300 hover:text-black disabled:opacity-50"
                >
                  {board.busy ? "CREATING…" : "CREATE BOARD"}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const v = window.prompt("Paste a board ID or a shared game link:");
                  if (v) board.onJoin(v);
                }}
                className="cursor-pointer border border-white/20 px-3 py-2 font-display text-[10px] tracking-[0.2em] text-white/70 transition-colors hover:border-cyan-300/50 hover:text-white"
              >
                JOIN BOARD
              </button>
              {board.id && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${window.location.origin}${window.location.pathname}?board=${board.id}`;
                      void navigator.clipboard?.writeText(url);
                      board.onJoin(board.id);
                    }}
                    className="cursor-pointer border border-cyan-300/50 bg-cyan-400/10 px-3 py-2 font-display text-[10px] tracking-[0.2em] text-cyan-200 transition-colors hover:bg-cyan-300 hover:text-black"
                  >
                    COPY INVITE LINK
                  </button>
                  <button
                    type="button"
                    onClick={board.onLeave}
                    className="cursor-pointer border border-white/15 px-3 py-2 font-display text-[10px] tracking-[0.2em] text-white/45 transition-colors hover:border-red-400/50 hover:text-red-300"
                  >
                    DISCONNECT
                  </button>
                </>
              )}
            </div>
            {board.msg && (
              <div className="mt-2 text-[11px] leading-snug text-cyan-200/80">{board.msg}</div>
            )}
          </div>

          <div className="mt-2 flex items-center gap-3">
            <Layers className="h-4 w-4 text-cyan-300/70" />
            <span className="font-display text-[10px] tracking-[0.4em] text-cyan-300/70">INTERFACE</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <Row
            label="MODERN HUD"
            desc="Holographic hull pips and boost arc fly attached to your craft"
            right={<Toggle on={s.modernUi} onClick={() => onChange({ ...s, modernUi: !s.modernUi })} />}
          />
          <Row
            label="HUD LEAN (PC)"
            desc="Interface tilts with your steering — desktop only"
            right={<Toggle on={s.hudShake} onClick={() => onChange({ ...s, hudShake: !s.hudShake })} />}
          />

          <div className="mt-2 flex items-center gap-3">
            <Activity className="h-4 w-4 text-cyan-300/70" />
            <span className="font-display text-[10px] tracking-[0.4em] text-cyan-300/70">CONTROL FEEL</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <Row
            label="SENSITIVITY"
            desc="How far the ship travels for your input"
            right={
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0.4}
                  max={1.8}
                  step={0.1}
                  value={s.sens}
                  onChange={(e) => onChange({ ...s, sens: Number(e.target.value) })}
                  className="h-1.5 w-32 cursor-pointer appearance-none rounded-full bg-white/15 accent-cyan-300 sm:w-40"
                />
                <span className="hud-num w-10 text-right font-display text-xs text-cyan-200">
                  {s.sens.toFixed(1)}×
                </span>
              </div>
            }
          />
          <Row
            label="RESPONSE"
            desc="Low = instant & twitchy · High = smooth & floaty"
            right={
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0.25}
                  max={1}
                  step={0.05}
                  value={s.smooth}
                  onChange={(e) => onChange({ ...s, smooth: Number(e.target.value) })}
                  className="h-1.5 w-32 cursor-pointer appearance-none rounded-full bg-white/15 accent-cyan-300 sm:w-40"
                />
                <span className="hud-num w-16 text-right font-display text-[10px] tracking-wider text-cyan-200">
                  {s.smooth <= 0.4 ? "SNAPPY" : s.smooth >= 0.8 ? "FLOATY" : "NORMAL"}
                </span>
              </div>
            }
          />

          <div className="mt-2 flex items-center gap-3">
            <Smartphone className="h-4 w-4 text-cyan-300/70" />
            <span className="font-display text-[10px] tracking-[0.4em] text-cyan-300/70">MOBILE</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <Row
            label="GYRO STEERING"
            desc="Tilt your phone to fly instead of dragging"
            right={<Toggle on={s.tilt} onClick={() => onChange({ ...s, tilt: !s.tilt })} />}
          />
          <Row
            label="INVERT GYRO"
            desc="Flip tilt axes — pick what feels natural"
            right={
              <div className="flex flex-wrap gap-1.5">
                {([0, 1, 2, 3] as const).map((g) => (
                  <SegBtn
                    key={g}
                    active={s.gyroInv === g}
                    label={g === 0 ? "OFF" : g === 1 ? "INV Y" : g === 2 ? "INV X" : "BOTH"}
                    onClick={() => onChange({ ...s, gyroInv: g })}
                  />
                ))}
              </div>
            }
          />
          <Row
            label="VIBRATION"
            desc="Haptic kick on impacts and pickups"
            right={<Toggle on={s.vibrate} onClick={() => onChange({ ...s, vibrate: !s.vibrate })} />}
          />
        </div>

        <div className="mt-6 flex justify-end">
          <div className="w-48">
            <MenuBtn icon={ArrowLeft} label="Back" onClick={onBack} small />
          </div>
        </div>
      </div>
    </Overlay>
  );
}

/* ------------------------------------------------------------------ */
/*  PAUSE                                                              */
/* ------------------------------------------------------------------ */

export function PauseMenu({
  score, dist, onResume, onRestart, onQuit,
}: {
  score: number;
  dist: number;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}) {
  return (
    <Overlay>
      <div className="mx-auto flex max-w-md flex-col items-center">
        <div className="font-display text-[10px] tracking-[0.55em] text-cyan-300/80">FLIGHT SUSPENDED</div>
        <h2 className="text-glow mt-1 font-display text-3xl font-black tracking-[0.12em] text-white sm:mt-2 sm:text-6xl">
          PAUSED
        </h2>
        <div className="mt-4 flex w-full gap-2 sm:mt-5 sm:gap-3">
          <StatBlock label="SCORE" value={fmtScore(score)} />
          <StatBlock label="DISTANCE" value={`${fmtScore(dist)}M`} />
        </div>
        <div className="mt-4 flex w-full max-w-xs flex-col gap-2 sm:mt-6 sm:gap-3">
          <MenuBtn icon={Play} label="Resume" onClick={onResume} primary />
          <MenuBtn icon={RotateCcw} label="Restart Zone" onClick={onRestart} />
          <MenuBtn icon={Home} label="Abort to Menu" onClick={onQuit} />
        </div>
        <div className="mt-5 font-display text-[10px] tracking-[0.4em] text-white/35">ESC / P TO RESUME</div>
      </div>
    </Overlay>
  );
}

/* ------------------------------------------------------------------ */
/*  GAME OVER / COMPLETE                                               */
/* ------------------------------------------------------------------ */

export function GameOverScreen({
  result, levelName, isRecord, onRetry, onQuit,
}: {
  result: RunResult;
  levelName: string;
  isRecord: boolean;
  onRetry: () => void;
  onQuit: () => void;
}) {
  return (
    <Overlay>
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <div className="anim-pop font-display text-[10px] tracking-[0.55em] text-red-400/90">HULL INTEGRITY ZERO · {levelName}</div>
        <h2 className="anim-pop mt-1 font-display text-3xl font-black tracking-[0.1em] text-white sm:mt-2 sm:text-7xl" style={{ textShadow: "0 0 40px rgba(255,60,80,0.45)" }}>
          SHIP DOWN
        </h2>
        {isRecord && (
          <div className="anim-pop mt-4 flex items-center gap-2 border border-amber-300/50 bg-amber-400/10 px-4 py-1.5 font-display text-xs tracking-[0.3em] text-amber-300">
            <Trophy className="h-4 w-4" /> NEW PILOT RECORD
          </div>
        )}
        <div className="anim-fade-up mt-6 flex w-full gap-3" style={{ animationDelay: "120ms" }}>
          <StatBlock label="SCORE" value={fmtScore(result.score)} />
          <StatBlock label="DISTANCE" value={`${fmtScore(result.dist)}M`} />
          <StatBlock label="STARS" value={`+${result.stars}`} sub="banked" />
        </div>
        <div className="anim-fade-up mt-7 flex w-full max-w-xs flex-col gap-3" style={{ animationDelay: "220ms" }}>
          <MenuBtn icon={RotateCcw} label="Retry Zone" onClick={onRetry} primary />
          <MenuBtn icon={Home} label="Flight Deck" onClick={onQuit} />
        </div>
      </div>
    </Overlay>
  );
}

export function CompleteScreen({
  result, levelName, hasNext, onNext, onReplay, onQuit,
}: {
  result: RunResult;
  levelName: string;
  hasNext: boolean;
  onNext: () => void;
  onReplay: () => void;
  onQuit: () => void;
}) {
  return (
    <Overlay>
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <div className="anim-pop font-display text-[10px] tracking-[0.55em] text-cyan-300/90">MISSION LOG · {levelName}</div>
        <h2 className="anim-pop title-gradient mt-1 font-display text-3xl font-black tracking-[0.08em] sm:mt-2 sm:text-7xl">
          ZONE CLEARED
        </h2>
        <div className="anim-fade-up mt-6 flex w-full gap-3" style={{ animationDelay: "120ms" }}>
          <StatBlock label="SCORE" value={fmtScore(result.score)} />
          <StatBlock label="DISTANCE" value={`${fmtScore(result.dist)}M`} />
          <StatBlock label="STARS" value={`+${result.stars}`} sub="incl. clear bonus" />
        </div>
        <div className="anim-fade-up mt-7 flex w-full max-w-xs flex-col gap-3" style={{ animationDelay: "220ms" }}>
          {hasNext && <MenuBtn icon={Rocket} label="Next Zone" onClick={onNext} primary />}
          <MenuBtn icon={RotateCcw} label="Fly Again" onClick={onReplay} primary={!hasNext} />
          <MenuBtn icon={Home} label="Flight Deck" onClick={onQuit} />
        </div>
      </div>
    </Overlay>
  );
}

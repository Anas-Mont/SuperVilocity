import { useEffect, useState } from "react";
import { RotateCw, Maximize } from "lucide-react";

/** Request fullscreen and lock to landscape (best effort — silently ignored on iOS). */
export async function goFullscreenLandscape() {
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void>;
  };
  try {
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
      else await el.webkitRequestFullscreen?.();
    }
  } catch {
    /* denied — fine */
  }
  try {
    const o = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
    };
    await o?.lock?.("landscape");
  } catch {
    /* unsupported (iOS Safari) — the rotate prompt covers it */
  }
}

/** True when the device is a touch device held in portrait. */
export function usePortraitPhone() {
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    const check = () => {
      const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
      setPortrait(coarse && window.innerHeight > window.innerWidth);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);
  return portrait;
}

/** Full-screen prompt asking the player to rotate the handset. */
export function RotateGate() {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-[#05030e] p-8 text-center">
      <div className="relative">
        <div
          className="absolute inset-0 rounded-full blur-2xl"
          style={{ background: "radial-gradient(circle, rgba(83,233,255,0.35), transparent 70%)" }}
        />
        <RotateCw
          className="relative h-20 w-20 text-cyan-300"
          style={{ animation: "kf-rotate-hint 2s ease-in-out infinite" }}
          strokeWidth={1.5}
        />
      </div>
      <h2 className="mt-8 font-display text-2xl font-black tracking-[0.2em] text-white">
        ROTATE YOUR DEVICE
      </h2>
      <p className="mt-3 max-w-xs text-base leading-snug text-white/55">
        SKYVECTOR flies in landscape. Turn your phone sideways for the full cockpit view.
      </p>
      <button
        type="button"
        onClick={goFullscreenLandscape}
        className="mt-8 flex items-center gap-2 border border-cyan-300/60 bg-cyan-400/15 px-6 py-3 font-display text-xs tracking-[0.3em] text-cyan-100"
      >
        <Maximize className="h-4 w-4" /> GO FULLSCREEN
      </button>
      <div className="mt-10 font-display text-[9px] tracking-[0.3em] text-white/30">
        © 2026 MOHAMMED ANAS. ALL RIGHTS RESERVED.
      </div>
    </div>
  );
}

/** Small fullscreen toggle shown on touch devices. */
export function FullscreenButton() {
  return (
    <button
      type="button"
      data-nosteer
      onClick={goFullscreenLandscape}
      className="coarse-only pointer-events-auto absolute left-4 top-4 z-30 h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur"
      aria-label="Fullscreen"
    >
      <Maximize className="h-4 w-4 text-white/80" />
    </button>
  );
}

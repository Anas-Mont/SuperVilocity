import { useEffect, useRef, useState } from "react";
import GameCanvas from "./components/GameCanvas";
import HUD, { Toast } from "./components/HUD";
import {
  MainMenu, LevelSelect, HowToPlay, SettingsPanel, Hangar,
  PauseMenu, GameOverScreen, CompleteScreen,
} from "./components/Screens";
import { RotateGate, FullscreenButton, usePortraitPhone, goFullscreenLandscape } from "./components/Orientation";
import Leaderboard from "./components/Leaderboard";
import { NamePrompt, Tutorial } from "./components/Onboarding";
import {
  submitScore, fetchBoard, myRank, createBoard, joinBoard, leaveBoard, activeBoardId,
} from "./game/leaderboard";
import { Game, HUDState, RunResult, ToastKind } from "./game/engine";
import { LevelConfig, LEVELS } from "./game/levels";
import { ShipDef, getShipDef } from "./game/ships";
import {
  getSettings, saveSettings, saveResult, setUnlocked, getUnlocked, Settings,
  getStars, addStars, spendStars, getOwned, ownShip, getShip, selectShip,
  getName, setName, isTutorialDone, setTutorialDone, buyUpgrade,
  buyPrestige, getPrestige, prestigeTitle,
} from "./game/storage";

type Screen =
  | "menu" | "levels" | "howto" | "settings" | "hangar"
  | "board" | "playing" | "over" | "complete";

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [paused, setPaused] = useState(false);
  const [settings, setSettings] = useState<Settings>(getSettings);
  const [hud, setHud] = useState<HUDState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [flash, setFlash] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);
  const [record, setRecord] = useState(false);
  const [unlocked, setUnlockedState] = useState(getUnlocked());
  const [fpsLive, setFpsLive] = useState(0);
  const [refreshHz, setRefreshHz] = useState(0);
  const [stars, setStars] = useState(getStars());
  const [owned, setOwned] = useState<string[]>(getOwned());
  const [shipId, setShipId] = useState(getShip());
  const [pilot, setPilot] = useState(getName());
  const [showTut, setShowTut] = useState(false);
  const [rank, setRank] = useState(0);
  const [boardId, setBoardIdState] = useState(activeBoardId());
  const [boardBusy, setBoardBusy] = useState(false);
  const [boardMsg, setBoardMsg] = useState("");
  const [upgTick, setUpgTick] = useState(0);

  const engineRef = useRef<Game | null>(null);
  const levelRef = useRef<LevelConfig | null>(null);
  const toastId = useRef(0);
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const portrait = usePortraitPhone();

  /* persist + apply settings */
  useEffect(() => {
    saveSettings(settings);
    engineRef.current?.applySettings(settings);
  }, [settings]);

  /* rotating to portrait mid-flight pauses the run */
  useEffect(() => {
    if (portrait && screenRef.current === "playing" && !engineRef.current?.isPaused) {
      engineRef.current?.pause();
      setPaused(true);
    }
  }, [portrait]);

  /* live fps polling on the settings screen */
  useEffect(() => {
    if (screen !== "settings") return;
    const id = window.setInterval(() => setFpsLive(engineRef.current?.fpsReading ?? 0), 400);
    return () => window.clearInterval(id);
  }, [screen]);

  /* measure the display's true refresh ceiling once */
  useEffect(() => {
    void Game.detectRefreshRate().then(setRefreshHz);
  }, []);

  /* pull the player's rank for the menu card */
  useEffect(() => {
    if (screen !== "menu" || !pilot) return;
    void fetchBoard().then((r) => setRank(myRank(r.entries)));
  }, [screen, pilot]);

  /* show the tutorial once, right after registration */
  useEffect(() => {
    if (pilot && !isTutorialDone()) setShowTut(true);
  }, [pilot]);

  const addToast = (text: string, kind: ToastKind) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev.slice(-2), { id, text, kind }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 1350);
  };

  const startLevel = (lv: LevelConfig) => {
    levelRef.current = lv;
    setResult(null);
    setRecord(false);
    setPaused(false);
    setScreen("playing");
    // launching is a user gesture: grab fullscreen + landscape on phones
    if (window.matchMedia?.("(pointer: coarse)")?.matches) void goFullscreenLandscape();
    // gyro needs a user gesture on iOS — request right as the flight starts
    if (settings.tilt) void engineRef.current?.enableTilt();
    engineRef.current?.recenterTilt();
    engineRef.current?.startLevel(lv);
  };

  const togglePause = () => {
    if (screenRef.current !== "playing") return;
    const g = engineRef.current;
    if (!g) return;
    if (g.isPaused) {
      g.resume();
      setPaused(false);
    } else {
      g.pause();
      g.sound.uiClick();
      setPaused(true);
    }
  };

  const resumeGame = () => {
    engineRef.current?.resume();
    engineRef.current?.recenterTilt();
    engineRef.current?.sound.uiClick();
    setPaused(false);
  };

  const restartLevel = () => {
    if (levelRef.current) startLevel(levelRef.current);
  };

  const quitToMenu = () => {
    engineRef.current?.startAttract();
    engineRef.current?.sound.uiClick();
    setPaused(false);
    setScreen("menu");
  };

  /** bank collected stars into the wallet */
  const bankStars = (r: RunResult) => {
    if (r.stars > 0) {
      addStars(r.stars);
      setStars(getStars());
    }
  };

  /** Push a finished run to the leaderboard (never blocks the UI). */
  const postScore = (r: RunResult) => {
    const lv = levelRef.current;
    if (!pilot || r.score < 100) return;
    void submitScore({
      score: r.score,
      dist: r.dist,
      zone: lv ? lv.name : "—",
      ship: `${prestigeTitle(getPrestige())} · ${getShipDef(shipId).name}`,
    }).then((res) => setRank(myRank(res.entries)));
  };

  const handleGameOver = (r: RunResult) => {
    const lv = levelRef.current;
    const rec = saveResult(lv?.endless ? "endless" : (lv?.id ?? 0), r.score, r.dist);
    bankStars(r);
    postScore(r);
    setRecord(rec);
    setResult(r);
    setPaused(false);
    setScreen("over");
  };

  const handleComplete = (r: RunResult) => {
    const lv = levelRef.current;
    if (lv && !lv.endless) {
      saveResult(lv.id, r.score, r.dist);
      setUnlocked(lv.id + 1);
      setUnlockedState(getUnlocked());
    }
    // clearing a zone pays a star bonus
    const bonus = lv && !lv.endless ? 30 : 0;
    bankStars({ ...r, stars: r.stars + bonus });
    postScore(r);
    setResult({ ...r, stars: r.stars + bonus });
    setScreen("complete");
  };

  const goNext = () => {
    const lv = levelRef.current;
    if (!lv || lv.endless) return;
    const idx = LEVELS.findIndex((l) => l.id === lv.id);
    if (idx >= 0 && idx + 1 < LEVELS.length) startLevel(LEVELS[idx + 1]);
  };

  const buyShip = (s: ShipDef) => {
    if (!spendStars(s.cost)) return;
    ownShip(s.id);
    selectShip(s.id);
    setStars(getStars());
    setOwned(getOwned());
    setShipId(s.id);
    engineRef.current?.setShip(s.id);
    engineRef.current?.sound.repair();
  };

  const equipShip = (s: ShipDef) => {
    selectShip(s.id);
    setShipId(s.id);
    engineRef.current?.setShip(s.id);
    engineRef.current?.sound.uiClick();
  };

  /* ---------------- online board handlers ---------------- */
  const boardCreate = () => {
    setBoardBusy(true);
    setBoardMsg("");
    void createBoard()
      .then((id) => {
        setBoardIdState(id);
        setBoardMsg("Board created. Use COPY INVITE LINK to share it.");
      })
      .catch((e: unknown) => setBoardMsg(`Could not create board: ${e instanceof Error ? e.message : "network error"}`))
      .finally(() => setBoardBusy(false));
  };

  const boardJoin = (v: string) => {
    const id = joinBoard(v);
    setBoardIdState(id);
    setBoardMsg(id ? "Joined. Open RANKS to sync." : "That did not look like a board id.");
  };

  const boardLeave = () => {
    leaveBoard();
    setBoardIdState("");
    setBoardMsg("Disconnected — scores stay on this device.");
  };

  const lv = levelRef.current;
  const levelName = lv ? `${lv.name} · ${lv.tag}` : "";
  const hasNext = !!lv && !lv.endless;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#070512]">
      <GameCanvas
        onReady={(g) => {
          engineRef.current = g;
          g.applySettings(getSettings());
          g.setShip(getShip());
          g.startAttract();
        }}
        onHUD={setHud}
        onToast={addToast}
        onDamage={() => setFlash((f) => f + 1)}
        onGameOver={handleGameOver}
        onComplete={handleComplete}
        onTogglePause={togglePause}
        onAutoPause={() => {
          if (screenRef.current === "playing") {
            engineRef.current?.pause();
            setPaused(true);
          }
        }}
      />

      <div className="vignette pointer-events-none absolute inset-0 z-[5]" />
      <div className="scanlines pointer-events-none absolute inset-0 z-[6]" />

      {screen !== "playing" && <FullscreenButton />}

      {screen === "playing" && (
        <HUD
          hud={hud}
          toasts={toasts}
          flash={flash}
          showFps={settings.showFps}
          onBoostDown={() => engineRef.current?.setBoostBtn(true)}
          onBoostUp={() => engineRef.current?.setBoostBtn(false)}
          onPause={togglePause}
          onAbility={() => engineRef.current?.activateAbility()}
        />
      )}

      {screen === "playing" && paused && (
        <PauseMenu
          score={hud?.score ?? 0}
          dist={hud?.dist ?? 0}
          onResume={resumeGame}
          onRestart={restartLevel}
          onQuit={quitToMenu}
        />
      )}

      {screen === "menu" && (
        <MainMenu
          stars={stars}
          pilot={pilot}
          rank={rank}
          onPlay={() => setScreen("levels")}
          onHangar={() => setScreen("hangar")}
          onBoard={() => setScreen("board")}
          onTutorial={() => setShowTut(true)}
          onHow={() => setScreen("howto")}
          onSettings={() => setScreen("settings")}
        />
      )}
      {screen === "board" && <Leaderboard onBack={() => setScreen("menu")} />}
      {screen === "levels" && (
        <LevelSelect unlocked={unlocked} onSelect={startLevel} onBack={() => setScreen("menu")} />
      )}
      {screen === "hangar" && (
        <Hangar
          key={upgTick}
          stars={stars}
          owned={owned}
          selected={shipId}
          onBuy={buyShip}
          onSelect={equipShip}
          onBack={() => setScreen("menu")}
          onRev={(s) => {
            const g = engineRef.current;
            if (!g) return;
            g.sound.ensure();
            g.sound.rev(s.sound);
          }}
          onUpgrade={(s, k) => {
            if (buyUpgrade(s.id, k)) {
              setStars(getStars());
              setUpgTick((t) => t + 1);
              engineRef.current?.sound.repair();
            }
          }}
          onPrestige={() => {
            if (buyPrestige()) {
              setStars(getStars());
              setUpgTick((t) => t + 1);
              engineRef.current?.sound.win();
            }
          }}
        />
      )}
      {screen === "howto" && <HowToPlay onBack={() => setScreen("menu")} />}
      {screen === "settings" && (
        <SettingsPanel
          s={settings}
          onChange={setSettings}
          onBack={() => setScreen("menu")}
          fpsLive={fpsLive}
          refreshHz={refreshHz}
          board={{
            id: boardId,
            busy: boardBusy,
            msg: boardMsg,
            onCreate: boardCreate,
            onJoin: boardJoin,
            onLeave: boardLeave,
          }}
        />
      )}
      {screen === "over" && result && (
        <GameOverScreen
          result={result}
          levelName={levelName}
          isRecord={record}
          onRetry={restartLevel}
          onQuit={quitToMenu}
        />
      )}
      {screen === "complete" && result && (
        <CompleteScreen
          result={result}
          levelName={levelName}
          hasNext={hasNext}
          onNext={goNext}
          onReplay={restartLevel}
          onQuit={quitToMenu}
        />
      )}

      {/* first-launch registration, then the tutorial */}
      {!pilot && (
        <NamePrompt
          onDone={(n, snd) => {
            setName(n);
            setPilot(n);
            const next = { ...settings, sfx: snd, music: snd };
            saveSettings(next);
            setSettings(next);
            // apply immediately — the effect runs after paint, which let
            // audio start before the player's choice registered.
            const g = engineRef.current;
            if (g) {
              g.sound.ensure();
              g.applySettings(next);
              if (snd) g.sound.uiClick();
            }
          }}
        />
      )}
      {pilot && showTut && screen !== "playing" && (
        <Tutorial
          onDone={() => {
            setTutorialDone();
            setShowTut(false);
            setScreen("levels");
          }}
          onSkip={() => {
            setTutorialDone();
            setShowTut(false);
          }}
        />
      )}

      {/* phones must fly in landscape */}
      {portrait && <RotateGate />}
    </div>
  );
}

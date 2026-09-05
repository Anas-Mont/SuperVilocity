import { useEffect, useRef } from "react";
import { Game, HUDState, RunResult, ToastKind } from "../game/engine";

interface Props {
  onReady: (g: Game) => void;
  onHUD: (h: HUDState) => void;
  onToast: (text: string, kind: ToastKind) => void;
  onDamage: () => void;
  onGameOver: (r: RunResult) => void;
  onComplete: (r: RunResult) => void;
  onTogglePause: () => void;
  onAutoPause: () => void;
}

export default function GameCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cbRef = useRef(props);
  cbRef.current = props;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const game = new Game(canvas, {
      onHUD: (h) => cbRef.current.onHUD(h),
      onToast: (t, k) => cbRef.current.onToast(t, k),
      onDamage: () => cbRef.current.onDamage(),
      onGameOver: (r) => cbRef.current.onGameOver(r),
      onComplete: (r) => cbRef.current.onComplete(r),
      onTogglePause: () => cbRef.current.onTogglePause(),
      onAutoPause: () => cbRef.current.onAutoPause(),
    });
    cbRef.current.onReady(game);
    return () => game.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 block h-full w-full touch-none"
    />
  );
}

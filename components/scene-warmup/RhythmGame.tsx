'use client';

/**
 * RhythmGame — 自研轻量节奏游戏引擎
 *
 * 决策 #1（暖场）：自研下落 lane + 判定线，原创美术/命名。
 *
 * 玩法：
 *   - N 条 lane（4-6），音符从顶部下落
 *   - 到达判定线时玩家按对应键（或点击/触摸）
 *   - 判定：Perfect（±50ms）/ Good（±120ms）/ Miss
 *   - 连击加倍
 *
 * 通信：
 *   - 每次命中 → scoreBus.dispatch（通过 onScore prop）
 *   - 游戏结束 → onComplete(finalScore)
 *
 * 简化版（PR-15）：
 *   - 不播放音频（后续 PR 接 Web Audio）
 *   - 用 requestAnimationFrame 驱动下落动画
 *   - 键盘 D/F/J/K（4 lane）或 D/F/G/J/K（5）或 S/D/F/J/K/L（6）
 *   - 移动端：点击对应 lane 区域
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BeatmapNote } from '@/lib/engpk/types/scene-v2';

const LANE_KEYS_4 = ['d', 'f', 'j', 'k'];
const LANE_KEYS_5 = ['d', 'f', 'g', 'j', 'k'];
const LANE_KEYS_6 = ['s', 'd', 'f', 'j', 'k', 'l'];

const PERFECT_WINDOW_MS = 50;
const GOOD_WINDOW_MS = 120;
const FALL_DURATION_MS = 2000; // 音符从顶到判定线的时间

const LANE_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

interface RhythmGameProps {
  beatmap: BeatmapNote[];
  laneCount: 4 | 5 | 6;
  durationMs: number;
  onScore?: (delta: number, judgment: 'perfect' | 'good' | 'miss') => void;
  onComplete?: (finalScore: number) => void;
}

interface NoteState {
  note: BeatmapNote;
  hit: boolean;
  judgment?: 'perfect' | 'good' | 'miss';
}

export function RhythmGame({
  beatmap,
  laneCount,
  durationMs,
  onScore,
  onComplete,
}: RhythmGameProps) {
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [finished, setFinished] = useState(false);
  const [lastJudgment, setLastJudgment] = useState<string>('');
  const startTimeRef = useRef(0);
  const notesRef = useRef<NoteState[]>([]);
  const animRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const laneKeys =
    laneCount === 5 ? LANE_KEYS_5 : laneCount === 6 ? LANE_KEYS_6 : LANE_KEYS_4;

  const initGame = useCallback(() => {
    notesRef.current = beatmap.map((note) => ({ note, hit: false }));
    startTimeRef.current = performance.now();
    setStarted(true);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setFinished(false);
    setLastJudgment('');
  }, [beatmap]);

  // 渲染循环
  useEffect(() => {
    if (!started || finished) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const laneW = W / laneCount;
    const judgeLine = H * 0.85;

    function draw() {
      if (!ctx) return;
      const now = performance.now() - startTimeRef.current;

      ctx.clearRect(0, 0, W, H);

      // 背景
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, W, H);

      // Lane 分隔线
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      for (let i = 1; i < laneCount; i++) {
        ctx.beginPath();
        ctx.moveTo(i * laneW, 0);
        ctx.lineTo(i * laneW, H);
        ctx.stroke();
      }

      // 判定线
      ctx.strokeStyle = '#ffffff44';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, judgeLine);
      ctx.lineTo(W, judgeLine);
      ctx.stroke();

      // 音符
      for (const ns of notesRef.current) {
        if (ns.hit) continue;
        const { timeMs, lane } = ns.note;
        const arriveTime = timeMs; // 音符应该在 timeMs 到达判定线
        const spawnTime = arriveTime - FALL_DURATION_MS;
        const elapsed = now - spawnTime;
        if (elapsed < 0) continue; // 还没出现

        const progress = elapsed / FALL_DURATION_MS;
        const y = progress * judgeLine;

        if (y > H + 40) {
          // 超过屏幕底部 → miss
          ns.hit = true;
          ns.judgment = 'miss';
          setCombo(0);
          setLastJudgment('Miss');
          onScore?.(0, 'miss');
          continue;
        }

        // 画音符
        const x = lane * laneW + laneW / 2;
        const radius = Math.min(laneW * 0.35, 24);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = LANE_COLORS[lane % LANE_COLORS.length];
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 检查是否全部结束
      const allDone = notesRef.current.every((ns) => ns.hit);
      if (allDone || now > durationMs + 2000) {
        setFinished(true);
        onComplete?.(score);
        return;
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [started, finished, laneCount, durationMs, onComplete, onScore, score]);

  // 键盘输入
  useEffect(() => {
    if (!started || finished) return;

    function handleKey(e: KeyboardEvent) {
      const laneIdx = laneKeys.indexOf(e.key.toLowerCase());
      if (laneIdx < 0) return;
      hitLane(laneIdx);
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [started, finished, laneKeys]);

  function hitLane(lane: number) {
    const now = performance.now() - startTimeRef.current;
    // 找最近的未命中音符
    let best: NoteState | null = null;
    let bestDiff = Infinity;

    for (const ns of notesRef.current) {
      if (ns.hit || ns.note.lane !== lane) continue;
      const diff = Math.abs(now - ns.note.timeMs);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = ns;
      }
    }

    if (!best) return;

    if (bestDiff <= PERFECT_WINDOW_MS) {
      best.hit = true;
      best.judgment = 'perfect';
      const pts = 10 * (1 + Math.floor(combo / 5));
      setScore((s) => s + pts);
      setCombo((c) => {
        const next = c + 1;
        setMaxCombo((m) => Math.max(m, next));
        return next;
      });
      setLastJudgment('Perfect!');
      onScore?.(pts, 'perfect');
    } else if (bestDiff <= GOOD_WINDOW_MS) {
      best.hit = true;
      best.judgment = 'good';
      const pts = 5 * (1 + Math.floor(combo / 5));
      setScore((s) => s + pts);
      setCombo((c) => {
        const next = c + 1;
        setMaxCombo((m) => Math.max(m, next));
        return next;
      });
      setLastJudgment('Good');
      onScore?.(pts, 'good');
    }
    // 超出 GOOD_WINDOW 不算命中
  }

  // 触摸/点击
  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!started || finished) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const lane = Math.floor((x / rect.width) * laneCount);
    hitLane(lane);
  }

  if (!started) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-900 text-white">
        <h2 className="text-2xl font-bold">节奏热身</h2>
        <p className="text-sm text-slate-400">
          按键：{laneKeys.map((k) => k.toUpperCase()).join(' ')} 或点击对应 lane
        </p>
        <button
          type="button"
          onClick={initGame}
          className="rounded-full bg-emerald-500 px-6 py-3 text-lg font-bold shadow-lg"
        >
          开始
        </button>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-slate-900 text-white">
        <h2 className="text-3xl font-bold">完成！</h2>
        <div className="text-5xl font-bold text-emerald-400">{score}</div>
        <div className="text-sm text-slate-400">最大连击：{maxCombo}</div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col items-center bg-slate-900">
      {/* HUD */}
      <div className="absolute left-4 top-4 z-10 flex gap-4 text-white">
        <span className="text-lg font-bold">{score}</span>
        <span className="text-sm text-emerald-400">×{combo}</span>
      </div>
      <div className="absolute right-4 top-4 z-10 text-lg font-bold text-amber-300">
        {lastJudgment}
      </div>

      {/* 游戏画布 */}
      <canvas
        ref={canvasRef}
        width={400}
        height={600}
        onClick={handleCanvasClick}
        className="h-full w-full max-w-md cursor-pointer"
        style={{ imageRendering: 'pixelated' }}
      />

      {/* 底部按键提示 */}
      <div className="absolute bottom-4 flex gap-2">
        {laneKeys.map((k, i) => (
          <button
            key={i}
            type="button"
            onPointerDown={() => hitLane(i)}
            className="flex h-12 w-12 items-center justify-center rounded-lg text-lg font-bold text-white shadow-md"
            style={{ background: LANE_COLORS[i % LANE_COLORS.length] + '99' }}
          >
            {k.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

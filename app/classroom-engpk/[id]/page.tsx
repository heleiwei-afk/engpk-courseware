'use client';

/**
 * /classroom-engpk/[id]
 *
 * engpk 课堂播放页（PR-10：接入封面渲染器）。
 *
 * 功能：
 *   - 通过 /api/engpk/lessons/[id] 拉当前已就绪的 lesson 数据
 *   - 注入到 classroom-session store
 *   - 渲染 SceneShell；中央根据 currentScene.type 路由到具体渲染器
 *     · cover  → CoverSceneView
 *     · 其它    → ScenePlaceholder（PR-11/12/… 替换）
 *   - 轮询 fallback：lesson 仍在生成时每 2s 拉一次
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { SceneShell } from '@/components/scene-shell';
import { PlaybackControls } from '@/components/scene-shell/PlaybackControls';
import { CoverSceneView } from '@/components/scene-cover';
import { ArticleSceneView } from '@/components/scene-article';
import { EndingSceneView } from '@/components/scene-ending';
import { DiscussionSceneView } from '@/components/scene-discussion';
import { GameSceneView } from '@/components/scene-game';
import { WarmupSceneView } from '@/components/scene-warmup';
import { VideoReviewSceneView } from '@/components/scene-video-review';
import { useClassroomSession } from '@/lib/engpk/store/classroom-session';
import { useEngpkFlush } from '@/lib/engpk/client/use-engpk-flush';
import { usePlaybackRuntime } from '@/lib/engpk/client/use-playback-runtime';
import { useKeyboardShortcuts } from '@/lib/engpk/client/use-keyboard-shortcuts';
import { useTeammateChatter } from '@/lib/engpk/chatter/teammate-chatter';
import type { Lesson, Scene } from '@/lib/engpk/types/scene-v2';
import { SCENE_MODE_LABELS } from '@/lib/engpk/instruction/types';

export default function EngpkClassroomPage() {
  const params = useParams<{ id: string }>();
  const lessonId = params?.id;

  // 积分 + 指标批量 flush 到后端
  useEngpkFlush({ userId: 'dev-user', disabled: !lessonId });

  // ─── Playback Engine ───────────────────────────────────────────
  const chatterRef = useRef<(() => void) | null>(null);
  const playback = usePlaybackRuntime({
    onActionEnd: () => { chatterRef.current?.(); },
  });
  const [speed, setSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const hydrate = useClassroomSession((s) => s.hydrate);
  const upsertScene = useClassroomSession((s) => s.upsertScene);
  const scenes = useClassroomSession((s) => s.scenes);
  const currentIndex = useClassroomSession((s) => s.currentSceneIndex);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lessonStatus, setLessonStatus] = useState<Lesson['status']>('generating');
  const hydratedRef = useRef(false);

  const fetchLesson = useCallback(async () => {
    if (!lessonId) return;
    try {
      const res = await fetch(`/api/engpk/lessons/${lessonId}`);
      if (!res.ok) {
        // 404 在 SSE 保存 lesson 之前可能出现，让轮询继续重试，不展示错误。
        if (res.status !== 404) {
          const body = await res.json().catch(() => null);
          setError(body?.error?.message ?? `HTTP ${res.status}`);
          setLoading(false);
        }
        return;
      }
      const { lesson } = (await res.json()) as { lesson: Lesson };

      const needsTeammateRefresh =
        hydratedRef.current && lesson.teammates.length > 0;

      if (!hydratedRef.current || needsTeammateRefresh) {
        hydrate({
          lessonId: lesson.id,
          user: {
            id: 'dev-user',
            nickname: '你',
            avatar: '/avatars/default.png',
            score: 0,
          },
          teammates: lesson.teammates,
          scenes: lesson.scenes,
        });
        hydratedRef.current = true;
      } else {
        for (const s of lesson.scenes) upsertScene(s);
      }

      setError(null);
      setLessonStatus(lesson.status);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [lessonId, hydrate, upsertScene]);

  // 首次加载 + 持续轮询直到 lesson 完成生成
  useEffect(() => {
    fetchLesson();
    const timer = setInterval(() => {
      // 完成后停止轮询
      if (lessonStatus === 'ready' || lessonStatus === 'partial-failure') {
        clearInterval(timer);
        return;
      }
      fetchLesson();
    }, 2000);
    return () => clearInterval(timer);
  }, [fetchLesson, lessonStatus]);

  // ─── Load scenes into playback engine + auto-start ───────────
  const startedRef = useRef(false);
  useEffect(() => {
    if (scenes.length > 0) {
      playback.loadScenes(scenes);
      // Auto-start on first load when lesson is ready
      if (!startedRef.current && (lessonStatus === 'ready' || lessonStatus === 'partial-failure')) {
        startedRef.current = true;
        playback.start();
      }
    }
  }, [scenes, lessonStatus, playback]);

  // ─── Fullscreen handling ─────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ─── Keyboard shortcuts ──────────────────────────────────────
  const handlePlayPause = useCallback(() => {
    if (playback.state.status === 'playing') playback.pause();
    else if (playback.state.status === 'paused') playback.resume();
    else if (playback.state.status === 'idle') playback.start();
  }, [playback]);

  const handlePrevScene = useCallback(() => {
    const idx = Math.max(0, playback.state.currentSceneIndex - 1);
    playback.goToScene(idx);
  }, [playback]);

  const handleNextScene = useCallback(() => {
    const idx = Math.min(scenes.length - 1, playback.state.currentSceneIndex + 1);
    playback.goToScene(idx);
  }, [playback, scenes.length]);

  useKeyboardShortcuts({
    onPlayPause: handlePlayPause,
    onPrevScene: handlePrevScene,
    onNextScene: handleNextScene,
    onFullscreenToggle: toggleFullscreen,
  });

  // ─── Speed change ────────────────────────────────────────────
  const handleSpeedChange = useCallback((s: number) => {
    setSpeed(s);
    playback.setSpeed(s);
  }, [playback]);

  const currentScene = scenes[currentIndex];

  // ─── AI Teammate Chatter Engine ──────────────────────────────
  const currentContext = currentScene
    ? currentScene.instruction.description + ' ' + currentScene.instruction.content
    : '';
  const { triggerProactiveChatter } = useTeammateChatter({
    currentContext,
    enabled: !loading && scenes.length > 0,
  });

  // Wire chatter to playback engine's onActionEnd
  chatterRef.current = triggerProactiveChatter;

  return (
    <div ref={containerRef} className="flex h-screen flex-col">
      <SceneShell>
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs">
          <Link
            href="/new"
            className="text-muted-foreground hover:text-foreground"
          >
            ← 返回编辑器
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-mono text-muted-foreground">
            lesson: {lessonId?.slice(0, 8)}…
          </span>
          <span className="ml-auto flex items-center gap-2">
            <ShareButton />
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {lessonStatus === 'generating' ? '生成中…' : lessonStatus === 'ready' ? '就绪' : '部分失败'}
            </span>
          </span>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {loading ? (
            <Centered text="正在载入课程…" />
          ) : error ? (
            <ErrorBox message={error} />
          ) : currentScene ? (
            <SceneRouter
              scene={currentScene}
              onContinue={() => handleNextScene()}
            />
          ) : (
            <Centered text="等待第一页生成完成…" />
          )}
        </div>
      </div>
    </SceneShell>
    <PlaybackControls
      status={playback.state.status}
      onPlay={() => playback.start()}
      onPause={() => playback.pause()}
      onResume={() => playback.resume()}
      speed={speed}
      onSpeedChange={handleSpeedChange}
      onFullscreen={toggleFullscreen}
      isFullscreen={isFullscreen}
    />
    </div>
  );
}

function SceneRouter({
  scene,
  onContinue,
}: {
  scene: Scene;
  onContinue: () => void;
}) {
  switch (scene.type) {
    case 'cover':
      return <CoverSceneView scene={scene} onContinue={onContinue} />;
    case 'article':
      return <ArticleSceneView scene={scene} onContinue={onContinue} />;
    case 'ending':
      return <EndingSceneView scene={scene} onContinue={onContinue} />;
    case 'discussion':
      return <DiscussionSceneView scene={scene} onContinue={onContinue} />;
    case 'game':
      return <GameSceneView scene={scene} onContinue={onContinue} />;
    case 'warmup':
      return <WarmupSceneView scene={scene} onContinue={onContinue} />;
    case 'video-review':
      return <VideoReviewSceneView scene={scene} onContinue={onContinue} />;
    default:
      return <ScenePlaceholder scene={scene} onContinue={onContinue} />;
  }
}

function Centered({ text }: { text: string }) {
  return (
    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="m-auto max-w-md rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
      <div className="font-medium">载入失败</div>
      <div className="mt-1 text-xs">{message}</div>
    </div>
  );
}

function ScenePlaceholder({
  scene,
  onContinue,
}: {
  scene: Scene;
  onContinue: () => void;
}) {
  return (
    <div className="m-auto max-w-2xl space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
          第 {scene.order} 页
        </span>
        <span className="rounded bg-secondary px-1.5 py-0.5">
          {SCENE_MODE_LABELS[scene.type]}
        </span>
        <span className="ml-auto text-muted-foreground/70">
          status: {scene.status}
        </span>
      </div>
      <h2 className="text-xl font-semibold">{scene.instruction.description}</h2>
      <p className="text-sm text-muted-foreground">
        {scene.instruction.content}
      </p>
      <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted/50 p-3 text-[11px]">
        {JSON.stringify(scene.payload, null, 2).slice(0, 800)}
      </pre>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground/70">
          真正的渲染器将在 PR-11/12/13/14/15/16 接入。
        </span>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground"
        >
          下一页 →
        </button>
      </div>
    </div>
  );
}

function ShareButton() {
  const [copied, setCopied] = useState(false);

  function handleShare() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // fallback: select + copy
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium hover:bg-muted transition-colors"
      title="复制课堂链接"
    >
      {copied ? '已复制 ✓' : '分享链接'}
    </button>
  );
}

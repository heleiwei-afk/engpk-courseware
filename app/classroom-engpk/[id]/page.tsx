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
import { CoverSceneView } from '@/components/scene-cover';
import { ArticleSceneView } from '@/components/scene-article';
import { EndingSceneView } from '@/components/scene-ending';
import { DiscussionSceneView } from '@/components/scene-discussion';
import { GameSceneView } from '@/components/scene-game';
import { WarmupSceneView } from '@/components/scene-warmup';
import { VideoReviewSceneView } from '@/components/scene-video-review';
import { useClassroomSession } from '@/lib/engpk/store/classroom-session';
import { useEngpkFlush } from '@/lib/engpk/client/use-engpk-flush';
import type { Lesson, Scene } from '@/lib/engpk/types/scene-v2';
import { SCENE_MODE_LABELS } from '@/lib/engpk/instruction/types';

export default function EngpkClassroomPage() {
  const params = useParams<{ id: string }>();
  const lessonId = params?.id;

  // 积分 + 指标批量 flush 到后端
  useEngpkFlush({ userId: 'dev-user', disabled: !lessonId });

  const hydrate = useClassroomSession((s) => s.hydrate);
  const upsertScene = useClassroomSession((s) => s.upsertScene);
  const selectScene = useClassroomSession((s) => s.selectScene);
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
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? `HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      const { lesson } = (await res.json()) as { lesson: Lesson };

      if (!hydratedRef.current) {
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

  const currentScene = scenes[currentIndex];

  return (
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
          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {lessonStatus === 'generating' ? '生成中…' : lessonStatus === 'ready' ? '就绪' : '部分失败'}
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
              onContinue={() =>
                selectScene(Math.min(currentIndex + 1, scenes.length - 1))
              }
            />
          ) : (
            <Centered text="等待第一页生成完成…" />
          )}
        </div>
      </div>
    </SceneShell>
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

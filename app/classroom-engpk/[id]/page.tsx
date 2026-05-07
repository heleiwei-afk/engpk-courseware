'use client';

/**
 * /classroom-engpk/[id]
 *
 * engpk 课堂播放页（骨架版 · PR-08）。
 *
 * 功能范围：
 *   - 通过 /api/engpk/lessons/[id] 拉当前已就绪的 lesson 数据
 *   - 注入到 classroom-session store
 *   - 渲染 SceneShell，中央展示当前场景的最简信息（真正渲染器由 PR-10/11/… 接入）
 *   - 支持主动轮询一次（PR-08 mock 生成通常 2-3 秒就 done，不做真正重连）
 *
 * 后续 PR 会把 mock 的中央内容替换为各类场景的真实渲染器。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { SceneShell } from '@/components/scene-shell';
import { useClassroomSession } from '@/lib/engpk/store/classroom-session';
import type { Lesson, Scene } from '@/lib/engpk/types/scene-v2';
import { SCENE_MODE_LABELS } from '@/lib/engpk/instruction/types';

export default function EngpkClassroomPage() {
  const params = useParams<{ id: string }>();
  const lessonId = params?.id;

  const hydrate = useClassroomSession((s) => s.hydrate);
  const upsertScene = useClassroomSession((s) => s.upsertScene);
  const scenes = useClassroomSession((s) => s.scenes);
  const currentIndex = useClassroomSession((s) => s.currentSceneIndex);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
        // 增量补齐场景
        for (const s of lesson.scenes) {
          upsertScene(s);
        }
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [lessonId, hydrate, upsertScene]);

  // 首次加载 + 每 2s 轮询直到 lesson 的 status=ready（PR-08 骨架，PR-09+ 改为 SSE 持续订阅）
  useEffect(() => {
    fetchLesson();
    const timer = setInterval(() => {
      fetchLesson();
    }, 2000);
    return () => clearInterval(timer);
  }, [fetchLesson]);

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
        </div>

        <div className="flex flex-1 items-center justify-center p-8">
          {loading ? (
            <div className="text-sm text-muted-foreground">正在载入课程…</div>
          ) : error ? (
            <div className="max-w-md rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              <div className="font-medium">载入失败</div>
              <div className="mt-1 text-xs">{error}</div>
            </div>
          ) : currentScene ? (
            <ScenePlaceholder scene={currentScene} />
          ) : (
            <div className="text-sm text-muted-foreground">等待第一页生成完成…</div>
          )}
        </div>
      </div>
    </SceneShell>
  );
}

function ScenePlaceholder({ scene }: { scene: Scene }) {
  return (
    <div className="max-w-2xl space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
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
      <h2 className="text-xl font-semibold">
        {scene.instruction.description}
      </h2>
      <p className="text-sm text-muted-foreground">
        {scene.instruction.content}
      </p>
      <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted/50 p-3 text-[11px]">
        {JSON.stringify(scene.payload, null, 2).slice(0, 800)}
      </pre>
      <div className="text-xs text-muted-foreground/70">
        真正的场景渲染器将在 PR-10 起陆续替换此占位。
      </div>
    </div>
  );
}

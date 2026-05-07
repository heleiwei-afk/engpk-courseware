'use client';

/**
 * /new — engpk 指令编辑器页面
 *
 * 决策 #6：纯文本多行输入 + 实时预览。
 * 决策 #7：首页保留 MAIC 视觉，所有功能入口指向 /new。
 *
 * PR-08：接入 /api/engpk/generate-lesson-from-instructions SSE。
 * 流程：点"生成课件" → SSE 开始 → 收到第一个 scene-ready 立即跳转 /classroom-engpk/[id]
 *      → 课堂页继续轮询/订阅获取后续场景。
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { InstructionEditor } from '@/components/engpk-editor/InstructionEditor';
import { useGenerationSSE } from '@/lib/engpk/client/use-generation-sse';

export default function NewLessonPage() {
  const router = useRouter();
  const { state, start, abort, reset } = useGenerationSSE();
  const [navigated, setNavigated] = useState(false);

  // 收到 lessonId（parsed 帧）就立刻跳，无需等第一个 scene-ready：
  // 课堂页会自己轮询补齐。
  useEffect(() => {
    if (!navigated && state.lessonId && state.status === 'streaming') {
      setNavigated(true);
      router.push(`/classroom-engpk/${state.lessonId}`);
    }
  }, [navigated, state.lessonId, state.status, router]);

  const submitting =
    state.status === 'connecting' || state.status === 'streaming';

  function handleSubmit(rawText: string) {
    setNavigated(false);
    start(rawText);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            ← 返回首页
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <h1 className="text-base font-semibold">engpk · 互动课件生成</h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {submitting ? (
            <button
              type="button"
              onClick={() => abort()}
              className="rounded-md border border-border bg-background px-2 py-1 hover:bg-muted"
            >
              停止生成
            </button>
          ) : null}
          {state.status === 'error' ? (
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1 text-destructive hover:bg-destructive/10"
            >
              失败 · 重置
            </button>
          ) : null}
          <span>逐页指令式 · 7 类场景 · 边播边生成</span>
        </div>
      </header>

      {state.status === 'error' && state.error ? (
        <div className="border-b border-destructive/30 bg-destructive/5 px-6 py-2 text-sm text-destructive">
          ⚠ {state.error.code} · {state.error.message}
        </div>
      ) : null}

      <main className="flex-1 overflow-hidden p-6">
        <InstructionEditor onSubmit={handleSubmit} submitting={submitting} />
      </main>
    </div>
  );
}

'use client';

/**
 * /new — engpk 指令编辑器页面
 *
 * 流程：
 *   1. 用户输入指令 → 实时预览
 *   2. 点"生成课件" → 展示生成进度面板（不跳转）
 *   3. SSE 实时推送步骤：解析 → 队友 → 风格 → 逐页内容 → 完成
 *   4. 全部完成后用户点"进入课堂" → 跳转 /classroom-engpk/[id]
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { InstructionEditor } from '@/components/engpk-editor/InstructionEditor';
import { GenerationProgress } from '@/components/engpk-editor/GenerationProgress';
import { useGenerationSSE } from '@/lib/engpk/client/use-generation-sse';

export default function NewLessonPage() {
  const router = useRouter();
  const { state, start, abort, reset } = useGenerationSSE();
  const [showProgress, setShowProgress] = useState(false);

  const submitting =
    state.status === 'connecting' || state.status === 'streaming';

  function handleSubmit(rawText: string) {
    setShowProgress(true);
    start(rawText);
  }

  function handleEnterClassroom() {
    if (state.lessonId) {
      router.push('/classroom-engpk/' + state.lessonId);
    }
  }

  function handleAbort() {
    abort();
    setShowProgress(false);
  }

  function handleReset() {
    reset();
    setShowProgress(false);
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
          {showProgress && !submitting && state.status !== 'done' ? (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-md border border-border bg-background px-2 py-1 hover:bg-muted"
            >
              返回编辑
            </button>
          ) : null}
          {submitting ? (
            <button
              type="button"
              onClick={handleAbort}
              className="rounded-md border border-border bg-background px-2 py-1 hover:bg-muted"
            >
              停止生成
            </button>
          ) : null}
          <span>逐页指令式 · 7 类场景 · 边播边生成</span>
        </div>
      </header>

      {state.status === 'error' && state.error && !showProgress ? (
        <div className="border-b border-destructive/30 bg-destructive/5 px-6 py-2 text-sm text-destructive">
          ⚠ {state.error.code} · {state.error.message}
        </div>
      ) : null}

      <main className="flex-1 overflow-hidden p-6">
        {showProgress ? (
          <GenerationProgress
            state={state}
            onEnterClassroom={handleEnterClassroom}
            onAbort={handleAbort}
          />
        ) : (
          <InstructionEditor onSubmit={handleSubmit} submitting={submitting} />
        )}
      </main>
    </div>
  );
}

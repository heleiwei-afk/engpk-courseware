'use client';

/**
 * GenerationProgress — 生成进度面板
 *
 * 按 SSE 事件实时展示生成步骤：
 *   1. 指令解析
 *   2. 队友生成
 *   3. 风格确定
 *   4. 第 N 页生成（逐页）
 *   5. 完成
 *
 * 全部完成后显示"进入课堂"按钮。
 */

import type { GenerationState } from '@/lib/engpk/client/use-generation-sse';
import { cn } from '@/lib/utils';

interface GenerationProgressProps {
  state: GenerationState;
  onEnterClassroom: () => void;
  onAbort: () => void;
}

interface Step {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
  detail?: string;
}

export function GenerationProgress({
  state,
  onEnterClassroom,
  onAbort,
}: GenerationProgressProps) {
  const steps = buildSteps(state);
  const isDone = state.status === 'done';
  const isError = state.status === 'error';
  const totalScenes = Object.keys(state.scenes).length;
  const totalErrors = Object.keys(state.sceneErrors).length;

  return (
    <div className="mx-auto max-w-lg space-y-6 py-12">
      <div className="text-center">
        <h2 className="text-2xl font-bold">
          {isDone ? '生成完成' : isError ? '生成出错' : '正在生成课件…'}
        </h2>
        {!isDone && !isError ? (
          <p className="mt-1 text-sm text-muted-foreground">
            请稍候，AI 正在为你创建互动课件
          </p>
        ) : null}
      </div>

      {/* 步骤列表 */}
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div
            key={step.id}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-4 py-3 transition-all',
              step.status === 'done' && 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20',
              step.status === 'active' && 'border-primary/40 bg-primary/5',
              step.status === 'pending' && 'border-border bg-muted/30 opacity-50',
              step.status === 'error' && 'border-destructive/40 bg-destructive/5',
            )}
          >
            {/* 状态图标 */}
            <div className="shrink-0">
              {step.status === 'done' ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs text-white">
                  ✓
                </span>
              ) : step.status === 'active' ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground animate-pulse">
                  {i + 1}
                </span>
              ) : step.status === 'error' ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-xs text-white">
                  !
                </span>
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-muted-foreground/30 text-xs text-muted-foreground">
                  {i + 1}
                </span>
              )}
            </div>

            {/* 标签 + 详情 */}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{step.label}</div>
              {step.detail ? (
                <div className="truncate text-xs text-muted-foreground">
                  {step.detail}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* 统计 */}
      {(totalScenes > 0 || totalErrors > 0) ? (
        <div className="text-center text-xs text-muted-foreground">
          已生成 {totalScenes} 页
          {totalErrors > 0 ? (
            <span className="ml-2 text-destructive">（{totalErrors} 页失败）</span>
          ) : null}
        </div>
      ) : null}

      {/* 操作按钮 */}
      <div className="flex justify-center gap-3">
        {isDone ? (
          <button
            type="button"
            onClick={onEnterClassroom}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-transform hover:scale-105"
          >
            进入课堂 →
          </button>
        ) : isError ? (
          <button
            type="button"
            onClick={onEnterClassroom}
            className="rounded-full border border-border bg-background px-5 py-2 text-sm font-medium hover:bg-muted"
          >
            查看已生成的内容
          </button>
        ) : (
          <button
            type="button"
            onClick={onAbort}
            className="rounded-md border border-border bg-background px-4 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            取消生成
          </button>
        )}
      </div>
    </div>
  );
}

function buildSteps(state: GenerationState): Step[] {
  const steps: Step[] = [];

  // Step 1: 指令解析
  if (state.parsed) {
    const count = state.parsed.batch.validInstructions.length;
    steps.push({
      id: 'parse',
      label: '指令解析',
      status: 'done',
      detail: count + ' 条指令已解析' + (state.parsed.usedFallback ? '（含 AI 归一化）' : ''),
    });
  } else if (state.status === 'connecting' || state.status === 'streaming') {
    steps.push({ id: 'parse', label: '指令解析', status: 'active' });
  } else {
    steps.push({ id: 'parse', label: '指令解析', status: 'pending' });
  }

  // Step 2: 队友生成
  if (state.teammates) {
    const names = state.teammates.teammates.map((t) => t.nickname).join('、');
    steps.push({
      id: 'teammates',
      label: 'AI 队友生成',
      status: 'done',
      detail: names,
    });
  } else if (state.parsed) {
    steps.push({ id: 'teammates', label: 'AI 队友生成', status: 'active' });
  } else {
    steps.push({ id: 'teammates', label: 'AI 队友生成', status: 'pending' });
  }

  // Step 2.5: 教学大纲生成
  if (state.outline) {
    steps.push({
      id: 'outline',
      label: '教学大纲生成',
      status: 'done',
      detail: state.outline.lessonTitle + ' · ' + state.outline.learningObjectives.length + ' 个学习目标',
    });
  } else if (state.teammates) {
    steps.push({ id: 'outline', label: '教学大纲生成', status: 'active', detail: '正在扩写知识点…' });
  } else {
    steps.push({ id: 'outline', label: '教学大纲生成', status: 'pending' });
  }

  // Step 3: 风格确定
  if (state.style) {
    steps.push({
      id: 'style',
      label: '课程风格确定',
      status: 'done',
      detail: state.style.styleToken.motif + ' · ' + state.style.styleToken.primaryColor,
    });
  } else if (state.outline) {
    steps.push({ id: 'style', label: '课程风格确定', status: 'active' });
  } else {
    steps.push({ id: 'style', label: '课程风格确定', status: 'pending' });
  }

  // Step 4: 场景生成（逐页）
  const sceneCount = Object.keys(state.scenes).length;
  const errorCount = Object.keys(state.sceneErrors).length;
  const totalExpected = state.parsed?.batch.validInstructions.length || 0;

  if (state.done) {
    steps.push({
      id: 'scenes',
      label: '内容生成',
      status: errorCount > 0 ? 'error' : 'done',
      detail: sceneCount + '/' + totalExpected + ' 页完成' + (errorCount > 0 ? '，' + errorCount + ' 页失败' : ''),
    });
  } else if (state.style) {
    steps.push({
      id: 'scenes',
      label: '内容生成',
      status: 'active',
      detail: sceneCount + '/' + totalExpected + ' 页…',
    });
  } else {
    steps.push({ id: 'scenes', label: '内容生成', status: 'pending' });
  }

  // Step 5: 完成
  if (state.done) {
    steps.push({ id: 'done', label: '生成完成', status: 'done' });
  } else if (state.status === 'error') {
    steps.push({
      id: 'done',
      label: '生成出错',
      status: 'error',
      detail: state.error?.message,
    });
  } else {
    steps.push({ id: 'done', label: '等待完成', status: 'pending' });
  }

  return steps;
}

'use client';

/**
 * InstructionEditor — engpk 指令编辑器
 *
 * 决策 #6：纯文本多行输入 + 实时预览解析结果。
 * 决策 #7：首页保留 MAIC 视觉，但功能入口指向这里。
 *
 * 左侧：textarea 多行输入
 * 右侧：实时预览（防抖 150ms）
 *   - 每行渲染为卡片：第 N 页 | 类型徽章 | 描述 | 内容摘要
 *   - 错误行高亮 + 错误说明
 *   - 顶部统计：合法 X 条 / 错误 Y 条
 *
 * 不调后端：解析全部走 parseLocally（前端正则）；
 * 提交到 /api/generate-lesson-from-instructions 由 PR-08 接入，
 * 此处的"生成课件"按钮先 stub 成 onSubmit prop。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseLocally } from '@/lib/engpk/instruction';
import { SCENE_MODE_LABELS, type SceneMode } from '@/lib/engpk/instruction/types';
import { useAIPlanner } from '@/lib/engpk/client/use-ai-planner';
import { cn } from '@/lib/utils';

const PLACEHOLDER = `第1页：【封面】+奇幻英语冒险+内容：Level 1 启程
第2页：【暖场】+节奏热身+内容：rhythm.mp4
第3页：【视频赏析】+角色口型模仿+内容：https://example.com/scene.mp4
第10页：【游戏】+单词闯关+内容：is, you, here, this
第12页：【讨论】+我们应该如何使用 this？+内容：this 的四种用法
第15页：【图文】+语法拆解+内容：this 作主语 / 宾语 / 定语
第16页：【结尾】+闯关庆功+内容：本课共掌握 4 个词`;

const MODE_COLOR: Record<SceneMode, string> = {
  cover: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  warmup: 'bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300',
  'video-review':
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
  game: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  discussion: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  article: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  ending: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
};

interface InstructionEditorProps {
  /** 提交回调（点"生成课件"按钮触发，PR-08 接入 SSE 生成） */
  onSubmit?: (rawText: string) => void;
  /** 是否处于提交中 */
  submitting?: boolean;
  /** 默认值 */
  defaultValue?: string;
}

export function InstructionEditor({
  onSubmit,
  submitting = false,
  defaultValue = '',
}: InstructionEditorProps) {
  const [rawText, setRawText] = useState(defaultValue);
  const [debouncedText, setDebouncedText] = useState(rawText);

  // 防抖 150ms
  useEffect(() => {
    const id = setTimeout(() => setDebouncedText(rawText), 150);
    return () => clearTimeout(id);
  }, [rawText]);

  const result = useMemo(() => parseLocally(debouncedText), [debouncedText]);

  const validCount = result.validInstructions.length;
  const errorCount = result.lines.filter((l) => !l.ok).length;
  const hasContent = result.lines.length > 0;
  const canSubmit = validCount > 0 && errorCount === 0 && !submitting;

  // AI Planner
  const planner = useAIPlanner();
  const [plannerTopic, setPlannerTopic] = useState('');
  const [showPlannerInput, setShowPlannerInput] = useState(false);

  const handlePlan = useCallback(async () => {
    if (!plannerTopic.trim()) return;
    const instructions = await planner.plan(plannerTopic.trim());
    if (instructions) {
      // Replace textarea content with AI-generated instructions
      setRawText(instructions);
      setShowPlannerInput(false);
      setPlannerTopic('');
    }
  }, [plannerTopic, planner]);

  return (
    <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-2">
      {/* 左：输入区 */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">指令编辑器</h2>
          <span className="text-xs text-muted-foreground">
            每行一条；格式：第N页：【模式】+描述+内容：XXX
          </span>
        </div>

        {/* AI 规划区域 */}
        <div className="flex flex-col gap-2">
          {!showPlannerInput ? (
            <button
              type="button"
              onClick={() => setShowPlannerInput(true)}
              disabled={planner.status === 'loading' || submitting}
              className={cn(
                'self-start rounded-md border border-dashed border-primary/50 px-3 py-1.5',
                'text-xs font-medium text-primary hover:bg-primary/5',
                'transition-colors disabled:opacity-40',
              )}
              data-testid="ai-planner-button"
            >
              AI 帮我规划课程
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={plannerTopic}
                onChange={(e) => setPlannerTopic(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handlePlan();
                  if (e.key === 'Escape') setShowPlannerInput(false);
                }}
                placeholder="输入主题，如：学习英语单词 this, that, these"
                autoFocus
                className={cn(
                  'flex-1 rounded-md border border-input bg-background px-3 py-1.5',
                  'text-sm outline-none focus:ring-2 focus:ring-ring',
                )}
                data-testid="ai-planner-input"
              />
              <button
                type="button"
                onClick={handlePlan}
                disabled={!plannerTopic.trim() || planner.status === 'loading'}
                className={cn(
                  'rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground',
                  'transition-opacity disabled:opacity-40',
                )}
              >
                {planner.status === 'loading' ? '规划中…' : '规划'}
              </button>
              <button
                type="button"
                onClick={() => { setShowPlannerInput(false); planner.abort(); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                取消
              </button>
            </div>
          )}
          {planner.status === 'error' && (
            <p className="text-xs text-destructive">{planner.error || '规划失败，请重试'}</p>
          )}
        </div>

        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          className={cn(
            'min-h-[60vh] flex-1 resize-none rounded-lg border border-input bg-background p-3',
            'font-mono text-sm leading-relaxed',
            'outline-none focus:ring-2 focus:ring-ring',
          )}
          data-testid="instruction-textarea"
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onSubmit?.(rawText)}
            disabled={!canSubmit}
            className={cn(
              'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
              'transition-opacity disabled:opacity-40',
            )}
            data-testid="submit-button"
          >
            {submitting ? '生成中…' : '生成课件'}
          </button>
          <span className="text-xs text-muted-foreground">
            合法 {validCount} 条
            {errorCount > 0 ? (
              <span className="ml-2 text-destructive">错误 {errorCount} 条</span>
            ) : null}
          </span>
        </div>
      </div>

      {/* 右：预览区 */}
      <div className="flex min-h-0 flex-col gap-3">
        <h2 className="text-sm font-semibold">实时预览</h2>

        <div
          className="flex-1 space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3"
          data-testid="preview-list"
        >
          {!hasContent ? (
            <div className="flex h-full items-center justify-center py-12 text-center text-sm text-muted-foreground">
              在左侧输入指令开始预览
            </div>
          ) : (
            <>
              {result.lines.map((line, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'rounded-md border px-3 py-2 text-sm',
                    line.ok
                      ? 'border-border bg-card'
                      : 'border-destructive/40 bg-destructive/5',
                  )}
                >
                  {line.ok ? (
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        第 {line.instruction.index} 页
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                          MODE_COLOR[line.instruction.mode],
                        )}
                      >
                        {SCENE_MODE_LABELS[line.instruction.mode]}
                      </span>
                      <span className="font-medium">
                        {line.instruction.description}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        {line.instruction.content}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-destructive">
                          ⚠ {line.error.code}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {line.error.message}
                        </span>
                      </div>
                      <div className="truncate font-mono text-xs text-muted-foreground/80">
                        {line.error.rawLine || '（空行）'}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {result.batchErrors.length > 0 ? (
                <div className="mt-3 space-y-1 border-t border-border pt-3">
                  <div className="text-xs font-medium text-destructive">
                    跨行错误：
                  </div>
                  {result.batchErrors.map((e, i) => (
                    <div key={i} className="text-xs text-muted-foreground">
                      · {e.message}
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          提示：解析失败时服务端会用 LLM 自动归一化（如把"第10页 游戏 单词闯关"修为标准格式）。
        </p>
      </div>
    </div>
  );
}

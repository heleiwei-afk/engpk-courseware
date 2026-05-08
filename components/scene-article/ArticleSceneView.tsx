'use client';

/**
 * ArticleSceneView — 图文类场景渲染器
 *
 * 渲染规则：
 *   - heading 为大标题
 *   - blocks 顺序渲染：paragraph / bullet-list / highlight / image
 *   - 老师讲解词胶囊列表（focusBlockIndexes 决定对应的 block 高亮）
 *   - 未提供 url 的 image block：显示占位 + prompt 摘要
 *   - 提供 onContinue 进入下一页
 */

import { useState } from 'react';
import type { ArticleScene } from '@/lib/engpk/types/scene-v2';
import { SpeakButton } from '@/components/engpk-editor/SpeakButton';
import { SpotlightBlock } from './SpotlightBlock';
import { WhiteboardPanel } from './whiteboard/WhiteboardPanel';

interface ArticleSceneViewProps {
  scene: ArticleScene;
  onContinue?: () => void;
}

export function ArticleSceneView({ scene, onContinue }: ArticleSceneViewProps) {
  const { heading, blocks, focusBlockIndexes = [] } = scene.payload;
  const speeches = scene.actions
    .filter(
      (a): a is Extract<typeof a, { type: 'speech' }> => a.type === 'speech',
    )
    .map((a) => a.text);

  const [activeSpeechIdx, setActiveSpeechIdx] = useState<number>(0);
  const activeBlock = focusBlockIndexes[activeSpeechIdx] ?? -1;

  function renderBlock(block: typeof blocks[number]) {
    switch (block.type) {
      case 'paragraph':
        return <p className="rounded-lg bg-card p-4 leading-relaxed">{block.text}</p>;
      case 'bullet-list':
        return (
          <ul className="list-inside list-disc rounded-lg bg-card p-4 space-y-1.5">
            {block.items.map((it, idx) => (
              <li key={idx} className="leading-relaxed">{it}</li>
            ))}
          </ul>
        );
      case 'highlight':
        return (
          <div className="border-l-4 border-primary bg-primary/10 px-4 py-3 font-medium rounded-lg">
            {block.text}
          </div>
        );
      case 'image':
        return (
          <figure className="overflow-hidden rounded-lg border bg-card">
            {block.url ? (
              <img src={block.url} alt={block.caption ?? block.prompt} className="w-full object-cover" />
            ) : (
              <div className="flex aspect-video items-center justify-center bg-muted/50 px-4 text-center text-xs text-muted-foreground">
                图片生成中 · {block.prompt.slice(0, 80)}
              </div>
            )}
            {block.caption ? (
              <figcaption className="p-2 text-center text-xs text-muted-foreground">{block.caption}</figcaption>
            ) : null}
          </figure>
        );
      default:
        return null;
    }
  }

  return (
    <div
      className="flex h-full w-full gap-6 overflow-hidden p-6"
      data-testid="article-scene"
    >
      {/* 左侧：图文内容 */}
      <div className="flex-1 overflow-y-auto pr-2">
        <h2 className="mb-6 text-2xl font-bold">{heading}</h2>
        <div className="space-y-4">
          {blocks.map((block, i) => {
            return (
              <SpotlightBlock
                key={i}
                activeIndex={activeBlock}
                blockIndex={i}
                totalBlocks={blocks.length}
              >
                {renderBlock(block)}
              </SpotlightBlock>
            );
          })}
        </div>
      </div>

      {/* 右侧：白板 + 老师讲解 */}
      <div className="flex w-80 flex-col gap-3 overflow-hidden">
        {/* 白板面板（有内容时显示） */}
        <WhiteboardPanel />

        {/* 讲解列表 */}
        <div className="flex flex-1 flex-col rounded-xl border border-border bg-muted/30 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">
            老师
          </span>
          讲解序列
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {speeches.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              （这一页暂无讲解词）
            </p>
          ) : (
            speeches.map((s, i) => (
              <div key={i} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveSpeechIdx(i)}
                  className={
                    'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ' +
                    (i === activeSpeechIdx
                      ? 'bg-primary/15 ring-1 ring-primary'
                      : 'bg-card hover:bg-card/80')
                  }
                >
                  <span className="mr-1 text-[10px] font-mono text-muted-foreground">
                    #{i + 1}
                  </span>
                  {s}
                </button>
                <SpeakButton text={s} autoPlay={i === 0} className="ml-3" />
              </div>
            ))
          )}
        </div>
        </div>
        <button
          type="button"
          onClick={onContinue}
          className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
        >
          下一页 →
        </button>
      </div>
    </div>
  );
}

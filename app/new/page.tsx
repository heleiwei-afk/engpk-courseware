'use client';

/**
 * /new — engpk 指令编辑器页面
 *
 * 决策 #6：纯文本多行输入 + 实时预览。
 * 决策 #7：首页保留 MAIC 视觉，所有功能入口指向 /new。
 *
 * 当前 PR-07：仅完成布局与本地预览；
 * 提交动作 stub 为 alert，PR-08 接 SSE 生成。
 */

import { useState } from 'react';
import { InstructionEditor } from '@/components/engpk-editor/InstructionEditor';
import Link from 'next/link';

export default function NewLessonPage() {
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(rawText: string) {
    setSubmitting(true);
    // PR-08 会替换为：fetch /api/generate-lesson-from-instructions + SSE
    // 这里仅占位，提示用户后续 PR 才接通
    // eslint-disable-next-line no-alert
    alert(
      '生成接口尚未接通（PR-08 待实现）。\n\n当前已校验的指令文本：\n\n' +
        rawText.slice(0, 200) +
        (rawText.length > 200 ? '…' : ''),
    );
    setSubmitting(false);
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
        <div className="text-xs text-muted-foreground">
          逐页指令式生成 · 7 类场景 · 边播边生成
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-6">
        <InstructionEditor
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      </main>
    </div>
  );
}

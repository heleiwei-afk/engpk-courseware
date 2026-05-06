'use client';

/**
 * SceneShell — 课堂统一外壳
 *
 * 6 区块布局（按 README 描述）：
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  [User] [Teammates]  ─  [ProgressBar]                    │
 *   │                                                          │
 *   │   ┌────────────────────┐    ┌──────────────┐             │
 *   │   │                    │    │  LessonToc   │             │
 *   │   │   children         │    │              │             │
 *   │   │   (各场景渲染器)    │    └──────────────┘             │
 *   │   │                    │    ┌──────────────┐             │
 *   │   │                    │    │  BulletChat  │             │
 *   │   │                    │    └──────────────┘             │
 *   │   └────────────────────┘    ┌──────────────┐             │
 *   │                              │ DiscussionInput│           │
 *   │                              └──────────────┘             │
 *   └──────────────────────────────────────────────────────────┘
 *
 * 7 类场景渲染器都包在 SceneShell 里（决策 #2：保持 7 个独立实现 + 公共外壳）。
 * 渲染器从 useClassroomSession 读 currentSceneIndex 决定渲染哪页。
 */

import type { ReactNode } from 'react';
import { UserPanel } from './UserPanel';
import { TeammatePanel } from './TeammatePanel';
import { BulletChat } from './BulletChat';
import { DiscussionInput } from './DiscussionInput';
import { LessonToc } from './LessonToc';
import { ProgressBar } from './ProgressBar';

interface SceneShellProps {
  /** 中央场景内容 */
  children: ReactNode;
  /** 是否启用举手按钮（仅讨论场景） */
  raiseHandEnabled?: boolean;
  /** 举手回调 */
  onRaiseHand?: () => void;
}

export function SceneShell({
  children,
  raiseHandEnabled = false,
  onRaiseHand,
}: SceneShellProps) {
  return (
    <div className="grid h-screen grid-cols-[260px_1fr_300px] grid-rows-[auto_1fr] gap-3 bg-background p-3">
      {/* 顶部全宽：用户 + 队友 + 进度 */}
      <header className="col-span-3 grid grid-cols-[260px_1fr_320px] items-center gap-3">
        <UserPanel />
        <ProgressBar />
        <div /> {/* 占位让右侧区块对齐 */}
      </header>

      {/* 左：队友 */}
      <aside className="overflow-y-auto" data-testid="left-rail">
        <TeammatePanel />
      </aside>

      {/* 中：场景渲染器 */}
      <main
        className="min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-sm"
        data-testid="scene-main"
      >
        {children}
      </main>

      {/* 右：目录 + 弹幕 + 输入 */}
      <aside
        className="flex min-h-0 flex-col gap-3 overflow-hidden"
        data-testid="right-rail"
      >
        <LessonToc />
        <BulletChat />
        <DiscussionInput
          onRaiseHand={onRaiseHand}
          raiseHandDisabled={!raiseHandEnabled}
        />
      </aside>
    </div>
  );
}

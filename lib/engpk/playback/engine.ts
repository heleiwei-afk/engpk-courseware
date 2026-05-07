/**
 * engpk · EngpkPlaybackEngine
 *
 * 驱动 `Scene.actions` 顺序执行，并在遇到 `await_user_interaction` 时
 * 进入 awaiting_user 状态，等待外部调用 notifySceneComplete 或超时降级。
 *
 * 状态机（决策 #8）：
 *
 *   idle ─start()→ playing ─pause()→ paused ─resume()→ playing
 *         ↓
 *         selectScene(n) / 场景结束
 *         ↓
 *   playing ─await_user_interaction→ awaiting_user
 *                                       ├─ notifySceneComplete(sceneId) → playing (next scene)
 *                                       └─ timeoutMs 到 → playing (按 fallback)
 *
 * 不管理 speech / 白板 / 视频等具体动作的画面效果；这些由
 *   ActionRuntime.onUnknown 转交给 MAIC 原 ActionEngine（PR-11 图文类再打通）。
 *
 * 本 PR-09 重点只是让状态机 + await_user_interaction 可用。
 */

import { createLogger } from '@/lib/logger';
import type { Scene } from '@/lib/engpk/types/scene-v2';
import {
  ActionRuntime,
  type RuntimeAction,
  type ActionRuntimeOptions,
} from '@/lib/engpk/action/runtime';
import type { AwaitUserInteractionAction } from '@/lib/engpk/types/action-ext';

const log = createLogger('engpk:playback');

export type PlaybackStatus =
  | 'idle'
  | 'playing'
  | 'paused'
  | 'awaiting_user'
  | 'ended';

export interface EngpkPlaybackEngineOptions {
  /** 未知 action 的兜底（由上层传入，通常桥接 MAIC ActionEngine） */
  onUnknownAction?: ActionRuntimeOptions['onUnknown'];
  /** 状态变化通知 */
  onStatusChange?: (status: PlaybackStatus) => void;
  /** 场景切换通知（已完成第 N 个或跳到第 N 个） */
  onSceneChange?: (sceneIndex: number, scene: Scene | null) => void;
  /** 调试用：每条 action 开始 */
  onActionStart?: (action: RuntimeAction) => void;
  /** 调试用：每条 action 结束 */
  onActionEnd?: (action: RuntimeAction) => void;
}

interface PendingAwait {
  sceneId: string;
  resolve: () => void;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

export class EngpkPlaybackEngine {
  private status: PlaybackStatus = 'idle';
  private scenes: Scene[] = [];
  private sceneIndex = 0;
  private pendingAwait: PendingAwait | null = null;

  /** 当前 play loop 的中止令牌；pause / select 时置换 */
  private runToken = 0;

  private runtime: ActionRuntime;

  constructor(private options: EngpkPlaybackEngineOptions = {}) {
    this.runtime = new ActionRuntime({
      onUnknown: options.onUnknownAction,
      onAwaitUserInteraction: (action) => this.onAwaitUserInteraction(action),
    });
  }

  // ==================== 公共 API ====================

  getStatus(): PlaybackStatus {
    return this.status;
  }

  getSceneIndex(): number {
    return this.sceneIndex;
  }

  getCurrentScene(): Scene | null {
    return this.scenes[this.sceneIndex] ?? null;
  }

  /** 载入 / 替换场景数组（通常在 lesson 加载完成或有新场景 ready 时调用） */
  setScenes(scenes: Scene[]): void {
    this.scenes = [...scenes].sort((a, b) => a.order - b.order);
    // 当前 sceneIndex 超限时夹回
    if (this.sceneIndex >= this.scenes.length) {
      this.sceneIndex = Math.max(0, this.scenes.length - 1);
    }
  }

  /** 启动播放（从当前 sceneIndex 开始） */
  async start(): Promise<void> {
    if (this.status === 'playing' || this.status === 'awaiting_user') return;
    this.setStatus('playing');
    await this.playLoop();
  }

  /** 暂停：停留在当前 action，next resume 继续 */
  pause(): void {
    if (this.status !== 'playing') return;
    this.setStatus('paused');
    this.runToken += 1;
  }

  resume(): void {
    if (this.status !== 'paused') return;
    this.setStatus('playing');
    void this.playLoop();
  }

  /** 外部事件：当前场景用户交互完成 */
  notifySceneComplete(sceneId: string): boolean {
    if (!this.pendingAwait) return false;
    if (this.pendingAwait.sceneId !== sceneId) {
      log.warn(
        'notifySceneComplete sceneId mismatch',
        sceneId,
        'expected',
        this.pendingAwait.sceneId,
      );
      return false;
    }
    this.resolveAwait();
    return true;
  }

  /** 跳到指定场景（0-based），触发播放 */
  async selectScene(index: number): Promise<void> {
    if (index < 0 || index >= this.scenes.length) return;
    // 中止当前 loop
    this.runToken += 1;
    this.resolveAwait();
    this.sceneIndex = index;
    this.options.onSceneChange?.(index, this.scenes[index]);
    if (this.status === 'playing' || this.status === 'idle') {
      this.setStatus('playing');
      await this.playLoop();
    }
  }

  /** 停止并释放（比如退出课堂页） */
  dispose(): void {
    this.runToken += 1;
    this.resolveAwait();
    this.setStatus('idle');
  }

  // ==================== 内部循环 ====================

  private async playLoop(): Promise<void> {
    const token = ++this.runToken;

    while (
      token === this.runToken &&
      this.status === 'playing' &&
      this.sceneIndex < this.scenes.length
    ) {
      const scene = this.scenes[this.sceneIndex];
      this.options.onSceneChange?.(this.sceneIndex, scene);

      // 为当前 scene 更新 runtime 上下文
      this.runtime.updateContext({ sceneId: scene.id });

      // 场景状态非 ready：跳过执行（avoid 死循环等待生成）
      if (scene.status !== 'ready') {
        log.debug(
          `scene ${scene.id} not ready (status=${scene.status}); skipping actions`,
        );
        this.advanceScene();
        continue;
      }

      // 顺序执行 actions
      for (const action of scene.actions) {
        if (token !== this.runToken) break;
        if (this.status !== 'playing' && this.status !== 'awaiting_user') break;

        this.options.onActionStart?.(action as RuntimeAction);
        try {
          await this.runtime.execute(action as RuntimeAction);
        } catch (err) {
          log.error('action execution error', err);
        }
        this.options.onActionEnd?.(action as RuntimeAction);
      }

      if (token !== this.runToken) return;
      // pause() 在 action 执行过程中可能切到 paused；TS 因为循环守卫无法 narrow，强转一下
      if ((this.status as PlaybackStatus) === 'paused') return;

      this.advanceScene();
    }

    // 到达末尾
    if (
      token === this.runToken &&
      this.sceneIndex >= this.scenes.length &&
      this.status === 'playing'
    ) {
      this.setStatus('ended');
    }
  }

  private advanceScene(): void {
    if (this.sceneIndex + 1 < this.scenes.length) {
      this.sceneIndex += 1;
      this.options.onSceneChange?.(this.sceneIndex, this.scenes[this.sceneIndex]);
    } else {
      // 走到末尾
      this.sceneIndex = this.scenes.length;
    }
  }

  private onAwaitUserInteraction(
    action: AwaitUserInteractionAction,
  ): Promise<void> {
    const scene = this.getCurrentScene();
    if (!scene) return Promise.resolve();

    this.setStatus('awaiting_user');

    return new Promise<void>((resolve) => {
      const timeoutId = action.timeoutMs
        ? setTimeout(() => {
            log.debug(
              `await_user_interaction timeout (${action.timeoutMs}ms); fallback=${action.fallback}`,
            );
            this.resolveAwait(); // 超时视为 scene_complete
            // fallback=skip 即默认：继续下一个；fallback=repeat 由场景自己处理
          }, action.timeoutMs)
        : null;

      this.pendingAwait = {
        sceneId: scene.id,
        resolve,
        timeoutId,
      };
    });
  }

  private resolveAwait(): void {
    if (!this.pendingAwait) return;
    const { resolve, timeoutId } = this.pendingAwait;
    this.pendingAwait = null;
    if (timeoutId !== null) clearTimeout(timeoutId);
    resolve();
    // 状态从 awaiting_user 回到 playing（如未被 pause 替代）
    if (this.status === 'awaiting_user') {
      this.setStatus('playing');
    }
  }

  private setStatus(next: PlaybackStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.options.onStatusChange?.(next);
  }
}

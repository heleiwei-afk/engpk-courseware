/**
 * engpk · ActionRuntime
 *
 * 为什么不直接改 OpenMAIC 原 lib/action/engine.ts？
 *   - 原 ActionEngine 深度耦合 stage/canvas/whiteboard/audio store；
 *   - engpk 的新 3 个 action（bullet_send / score_reward / await_user_interaction）
 *     只和 engpk 的总线 + 内部 store 交互，不涉及白板画布；
 *   - 因此做一层薄 Runtime，把"engpk 新 action"与"MAIC 原 action（可选委托）"分流，
 *     这样既不改侵入原引擎，也能统一给 Playback 调用。
 *
 * 使用：
 *   const runtime = new ActionRuntime({ onAwaitUserInteraction });
 *   await runtime.execute(action);
 *
 * MAIC 原 action（speech / wb_* / spotlight / discussion / widget_*）暂由 onUnknown
 * 回调兜底：PR-11 接图文类时若需要真正渲染画面，可在该回调里桥接到原 ActionEngine。
 */

import type { Action } from '@/lib/types/action';
import {
  bulletBus,
  makeBulletEvent,
  type BulletEvent,
} from '@/lib/engpk/bullet/bus';
import { scoreBus, makeScoreEvent } from '@/lib/engpk/score/bus';
import { createLogger } from '@/lib/logger';
import type {
  AwaitUserInteractionAction,
  BulletSendAction,
  ScoreRewardAction,
  ExtendedActionType,
} from '@/lib/engpk/types/action-ext';

const log = createLogger('engpk:action-runtime');

/**
 * 为了不让编译器对"未知 action.type"抱怨，我们把 action 当作宽松联合使用。
 * extended 联合：原 Action | EngpkAction
 */
export type RuntimeAction =
  | Action
  | BulletSendAction
  | ScoreRewardAction
  | AwaitUserInteractionAction;

export interface ActionRuntimeOptions {
  /** 当前 lessonId / sceneId（写入事件用） */
  lessonId?: string;
  sceneId?: string;
  /**
   * await_user_interaction 的拦截器：
   * Runtime 会返回该回调产出的 Promise，直到外部触发 notifySceneComplete 才 resolve。
   */
  onAwaitUserInteraction?: (
    action: AwaitUserInteractionAction,
  ) => Promise<void>;
  /**
   * 未识别 action 的兜底回调（通常由 Playback 传入，让它桥接到原 MAIC ActionEngine）。
   * 如果不提供，未知 action 会被忽略并记一条日志。
   */
  onUnknown?: (action: RuntimeAction) => Promise<void> | void;
}

export class ActionRuntime {
  constructor(private options: ActionRuntimeOptions = {}) {}

  updateContext(ctx: Pick<ActionRuntimeOptions, 'lessonId' | 'sceneId'>): void {
    this.options = { ...this.options, ...ctx };
  }

  async execute(action: RuntimeAction): Promise<void> {
    const type = action.type as ExtendedActionType;

    switch (type) {
      case 'bullet_send':
        return this.executeBulletSend(action as BulletSendAction);
      case 'score_reward':
        return this.executeScoreReward(action as ScoreRewardAction);
      case 'await_user_interaction':
        return this.executeAwaitUserInteraction(
          action as AwaitUserInteractionAction,
        );
      default:
        if (this.options.onUnknown) {
          await this.options.onUnknown(action);
        } else {
          log.debug('unhandled action type (no onUnknown)', type);
        }
    }
  }

  // ==================== handlers ====================

  private executeBulletSend(action: BulletSendAction): void {
    const evt: BulletEvent = makeBulletEvent({
      text: action.text,
      emoji: action.emoji,
      from: action.from,
      agentId: action.agentId,
      style: action.style ?? 'normal',
    });
    bulletBus.dispatch(evt);
  }

  private executeScoreReward(action: ScoreRewardAction): void {
    scoreBus.dispatch(
      makeScoreEvent({
        target: action.target,
        delta: action.delta,
        reason: action.reason,
        source: 'manual', // action 来自脚本，归为 manual；iframe / 游戏走 game-event 协议
        lessonId: this.options.lessonId,
        sceneId: this.options.sceneId,
      }),
    );
  }

  private async executeAwaitUserInteraction(
    action: AwaitUserInteractionAction,
  ): Promise<void> {
    if (this.options.onAwaitUserInteraction) {
      return this.options.onAwaitUserInteraction(action);
    }
    // 没注入拦截器，直接跳过，避免死等
    log.warn(
      'await_user_interaction without onAwaitUserInteraction handler; skipping',
    );
  }
}

/**
 * engpk · Action DSL 扩展
 *
 * 在 OpenMAIC 原有 Action 集合之外新增 3 种动作，覆盖 engpk 的三个全局总线：
 *   - bullet_send            → bulletBus（弹幕）
 *   - score_reward           → scoreBus（积分）
 *   - await_user_interaction → playback 进入 awaiting_user 状态，等待用户驱动的交互完成
 *
 * 这些 action 的 handler 在 `lib/action/engine.ts` 中新增，保持与原 action 一致的
 * await 语义（fire-and-forget 或同步阻塞）。
 */

import type { ActionBase, ActionType } from '@/lib/types/action';

// ==================== Fire-and-forget ====================

/**
 * 发送弹幕（即发即弃）。
 * 由 AI 老师 / AI 队友 / 系统触发；用户弹幕直接走 UI，不经 Action。
 */
export interface BulletSendAction extends ActionBase {
  type: 'bullet_send';
  /** 弹幕文本 */
  text: string;
  /** 可选 emoji 前缀 */
  emoji?: string;
  /** 弹幕来源 */
  from: 'ai-teacher' | 'ai-teammate' | 'system';
  /** 当 from='ai-teammate' 时必填 */
  agentId?: string;
  /** 视觉样式（高光/普通） */
  style?: 'highlight' | 'normal';
}

/**
 * 对指定目标加分（即发即弃）。
 * target='user' 或 agentId（队友 id）。
 */
export interface ScoreRewardAction extends ActionBase {
  type: 'score_reward';
  /** 分数增量（可为负） */
  delta: number;
  /** 原因描述（用于弹幕高光 & 审计日志） */
  reason: string;
  /** 目标：'user' 表示当前学生，其它为队友 agentId */
  target: 'user' | string;
}

// ==================== 同步阻塞 ====================

/**
 * 等待用户交互完成。
 *
 * PlaybackEngine 遇到此 action 切换到 awaiting_user 状态，
 * 直到外部调用 `notifySceneComplete(sceneId)` 或超时触发 fallback。
 *
 * 典型用例：
 *   - 游戏类场景：等待 iframe 游戏通关
 *   - 暖场类：等待节奏游戏结束
 *   - 视频赏析：等待视频播放结束 + 所有表演检测完成
 *   - 结尾类：等待抽奖小游戏完成
 */
export interface AwaitUserInteractionAction extends ActionBase {
  type: 'await_user_interaction';
  /** 等待什么事件（目前只支持 scene_complete，预留扩展） */
  waitFor: 'scene_complete';
  /** 超时毫秒数；不设则永久等待（不建议） */
  timeoutMs?: number;
  /** 超时后的降级策略 */
  fallback?: 'skip' | 'repeat';
  /** 用于 UI 提示的文案（例如"完成游戏后继续"） */
  hint?: string;
}

// ==================== 联合与分类 ====================

/** engpk 新增的所有 action type */
export type EngpkActionType =
  | 'bullet_send'
  | 'score_reward'
  | 'await_user_interaction';

/** engpk 新增的 action 联合 */
export type EngpkAction =
  | BulletSendAction
  | ScoreRewardAction
  | AwaitUserInteractionAction;

/**
 * 新增的 fire-and-forget action
 * （bullet_send / score_reward 不阻塞；await_user_interaction 阻塞）
 */
export const ENGPK_FIRE_AND_FORGET_ACTIONS: EngpkActionType[] = [
  'bullet_send',
  'score_reward',
];

/** 新增的同步阻塞 action */
export const ENGPK_SYNC_ACTIONS: EngpkActionType[] = ['await_user_interaction'];

/**
 * 把 engpk 新增的 action 合入 OpenMAIC 原 Action union。
 * 在 `lib/action/engine.ts` 中消费这个扩展类型。
 */
export type ExtendedActionType = ActionType | EngpkActionType;

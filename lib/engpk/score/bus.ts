/**
 * engpk · scoreBus
 *
 * 全局积分流。所有"加分/扣分"动作都派发到这里，由：
 *   - classroom-session store 实时聚合 user/teammate 的当前分
 *   - teammate-engine 监听用户事件做"共振"反应（决策 #7）
 *   - bulletBus 监听做高光弹幕
 *   - 后端 flush worker 批量上报到 /api/score/submit
 *
 * 决策 #12：MVP 不做服务端校验。但事件结构已经预留 source / clientReportedAt
 * 以便后期增加防作弊。
 */

import { createBus } from '../bus/bus';

export interface ScoreEvent {
  /** 唯一 id（前端生成 UUID/时间戳，便于幂等去重） */
  id: string;
  /**
   * 加分对象。
   * - 'user' 表示当前学生
   * - 其它字符串视为 teammateId（agentId）
   */
  target: 'user' | string;
  /** 积分增量（可正可负） */
  delta: number;
  /** 简短原因（用于审计 + 高光弹幕） */
  reason: string;
  /** 触发来源 */
  source:
    | 'rhythm-game' // 节奏游戏判定
    | 'video-performance' // 视频赏析表演检测
    | 'game-complete' // 通关游戏
    | 'game-event' // 游戏内任意 score 事件
    | 'discussion-reward' // 老师讨论奖励
    | 'encouragement' // 结尾鼓励小游戏
    | 'teammate-resonance' // 队友共振（来自 teammate-engine）
    | 'manual'; // 手动调试
  /** 关联场景 id */
  sceneId?: string;
  /** 关联课程 id */
  lessonId?: string;
  /** 客户端报告时间（毫秒时间戳） */
  clientReportedAt: number;
}

export const scoreBus = createBus<ScoreEvent>('score');

/** 工具：构造一个 scoreEvent 模板（自动填 id 与时间戳） */
export function makeScoreEvent(
  partial: Omit<ScoreEvent, 'id' | 'clientReportedAt'>,
): ScoreEvent {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `score-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    clientReportedAt: Date.now(),
    ...partial,
  };
}

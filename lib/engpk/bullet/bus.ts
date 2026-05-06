/**
 * engpk · bulletBus
 *
 * 弹幕流。所有"在弹幕墙上滚动出现的一行文字"都走这里。
 *
 * 来源：
 *   - AI 老师/队友通过 bullet_send action 触发
 *   - 用户在 DiscussionInput 输入并发送
 *   - scoreBus 监听用户事件，派发"高光弹幕"
 *   - teammate-engine 共振时派发鼓励弹幕
 *   - 系统消息（场景切换、奖励发放）
 */

import { createBus } from '../bus/bus';

export interface BulletEvent {
  id: string;
  text: string;
  emoji?: string;
  /** 弹幕来源 */
  from: 'user' | 'ai-teacher' | 'ai-teammate' | 'system';
  /** 当 from='ai-teammate' 或 'user' 时填，便于头像查找 */
  agentId?: string;
  /** 视觉样式 */
  style: 'highlight' | 'normal';
  /** 创建时间 */
  createdAt: number;
}

export const bulletBus = createBus<BulletEvent>('bullet');

export function makeBulletEvent(
  partial: Omit<BulletEvent, 'id' | 'createdAt'>,
): BulletEvent {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `bullet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    ...partial,
  };
}

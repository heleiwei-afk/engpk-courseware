/**
 * engpk · metricBus
 *
 * 业务指标埋点流。
 *
 * 决策 #19：埋点 + 业务指标仪表板。
 * 客户端事件由后续的 useMetricsFlush hook 节流后批量 POST 到 /api/metrics/ingest。
 */

import { createBus } from '../bus/bus';

export type MetricName =
  | 'generation.duration' // 单页生成耗时（ms）
  | 'generation.failure' // 生成失败计数
  | 'generation.retry' // 生成重试计数
  | 'narration.length' // 单条 speech 字数
  | 'narration.count' // 单页 speech 条数
  | 'scene.dropout' // 用户提前跳过场景
  | 'scene.complete' // 场景正常完成
  | 'parse.fallback' // 指令解析走了 LLM 兜底
  | 'parse.error' // 指令解析最终失败
  | 'consent.granted' // 监护人同意
  | 'consent.denied' // 监护人拒绝
  | 'camera.unavailable' // 摄像头不可用降级
  | 'game.validator.fail' // 游戏 HTML 校验失败
  | 'llm.call' // LLM 调用次数
  | 'llm.cost-tokens'; // LLM 消耗 token

export interface MetricEvent {
  id: string;
  name: MetricName;
  /** 数值指标，可空 */
  value?: number;
  /** 维度标签（结构化） */
  tags?: Record<string, string | number | boolean>;
  /** 详细 payload，便于事后分析 */
  payload?: Record<string, unknown>;
  /** 关联课程/场景 */
  lessonId?: string;
  sceneId?: string;
  /** 客户端时间 */
  clientReportedAt: number;
}

export const metricBus = createBus<MetricEvent>('metric');

export function makeMetricEvent(
  partial: Omit<MetricEvent, 'id' | 'clientReportedAt'>,
): MetricEvent {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `metric-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    clientReportedAt: Date.now(),
    ...partial,
  };
}

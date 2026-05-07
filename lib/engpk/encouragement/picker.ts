/**
 * engpk · 鼓励语选取器
 *
 * 决策 #11：模板池 + 占位符替换。LLM 不参与金额生成。
 *
 * 流程：
 *   1. 根据本课成绩计算 mood（high ≥ 80%, mid ≥ 50%, low < 50%）
 *   2. 从对应 moodTag 的模板中随机挑 2-3 条不重复
 *   3. {amount} 占位符从 vars.amount 中随机抽数（白名单 [1,2,3,5]）
 *   4. 返回 Encouragement[]（已替换占位符的最终文本）
 *
 * 金额硬上限 5 元通过 AMOUNT_WHITELIST 保证；
 * 任何 vars.amount 定义 > 5 都会被 pickAmount 过滤。
 */

import type { Encouragement } from '@/lib/engpk/types/scene-v2';
import {
  TEMPLATES,
  MAX_AMOUNT,
  type EncouragementTemplate,
  type MoodTag,
} from './templates';

export interface PickEncouragementOptions {
  /** 本课得分率（0-1），用于推断 mood */
  scoreRate: number;
  /** 需要几条（默认 3） */
  count?: number;
  /** 可选：显式指定 mood（覆盖 scoreRate 推断） */
  mood?: MoodTag;
}

export function pickEncouragements(
  options: PickEncouragementOptions,
): Encouragement[] {
  const count = options.count ?? 3;
  const mood: MoodTag =
    options.mood ??
    (options.scoreRate >= 0.8
      ? 'high'
      : options.scoreRate >= 0.5
        ? 'mid'
        : 'low');

  // 筛选当前 mood 的模板
  const pool = TEMPLATES.filter((t) => t.moodTag === mood);
  if (pool.length === 0) return [];

  // 随机不重复抽取
  const picked = shufflePick(pool, count);

  return picked.map((tpl) => {
    const amount = pickAmount(tpl);
    const text = amount !== undefined
      ? tpl.text.replace(/\{amount\}/g, String(amount))
      : tpl.text;
    return {
      templateId: tpl.id,
      text,
      category: tpl.category,
      amount,
    };
  });
}

function shufflePick<T>(arr: T[], n: number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function pickAmount(tpl: EncouragementTemplate): number | undefined {
  if (tpl.category !== 'monetary' || !tpl.vars?.amount) return undefined;
  const valid = tpl.vars.amount.filter((n) => n <= MAX_AMOUNT && n > 0);
  if (valid.length === 0) return 1;
  return valid[Math.floor(Math.random() * valid.length)];
}

export const __test__ = { shufflePick, pickAmount };

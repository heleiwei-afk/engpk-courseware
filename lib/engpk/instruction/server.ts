/**
 * engpk · 指令解析器（服务端入口）
 *
 * 包含 LLM 归一化兜底逻辑。仅在 API route 中 import。
 * 浏览器代码请用 `@/lib/engpk/instruction`（index.ts）。
 */

import {
  parseInstructionLines,
  finalize,
} from './index';
import type {
  InstructionBatchResult,
  ParsedLineResult,
} from './types';
import { normalizeInstructions } from './normalizer';

interface ParseWithFallbackOptions {
  /** 是否允许走 LLM 兜底（服务端调用为 true，前端预览为 false） */
  enableLLMFallback?: boolean;
  /** 已注入的归一化函数，便于测试时 mock */
  normalizer?: (rawText: string) => Promise<string>;
}

/**
 * 正则 + 可选 LLM 兜底。
 * 服务端在收到用户输入时调用。
 */
export async function parseWithFallback(
  rawText: string,
  options?: ParseWithFallbackOptions,
): Promise<InstructionBatchResult> {
  const { lines, duplicates } = parseInstructionLines(rawText);

  // 看是否有 UNPARSEABLE 行需要兜底
  const unparseable = lines.some(
    (l) => !l.ok && l.error.code === 'UNPARSEABLE',
  );

  if (!options?.enableLLMFallback || !unparseable) {
    return finalize(lines, duplicates);
  }

  // 调用归一化器（默认走真 LLM；测试可注入）
  const normalize = options.normalizer ?? normalizeInstructions;

  let normalized: string;
  try {
    normalized = await normalize(rawText);
  } catch {
    // 归一化失败时，保留原始解析结果
    return finalize(lines, duplicates);
  }

  if (!normalized.trim()) {
    return finalize(lines, duplicates);
  }

  // 用归一化结果再走一次正则
  const second = parseInstructionLines(normalized);
  // 用 normalized 标记走过兜底
  const merged: ParsedLineResult[] = second.lines.map((l) =>
    l.ok ? { ...l, normalized: true } : l,
  );

  return finalize(merged, second.duplicates);
}

// 重新导出客户端安全的函数（便于服务端也能用）
export { parseLocally, parseInstructionLine, parseInstructionLines } from './index';
export type { InstructionBatchResult, ParsedLineResult, PageInstruction } from './types';

/**
 * engpk · 指令解析器（聚合层）
 *
 * 对外暴露两个核心函数：
 *   - parseLocally(rawText)             仅正则，前端实时预览用
 *   - parseWithFallback(rawText, opts)  正则 + LLM 兜底归一化，服务端使用
 *
 * 解析层级（决策 #1）：
 *   1. 正则快路径（parser.ts）
 *   2. 失败行 → LLM 归一化（normalizer.ts，仅服务端）
 *   3. 再走一次正则
 *   4. 仍失败 → 保留错误
 *
 * 跨行校验：
 *   - 同 index 重复 → 第二次起标记 INVALID_INDEX
 *   - 收尾返回 InstructionBatchResult，便于 UI 渲染
 */

import {
  parseInstructionLine,
  parseInstructionLines,
} from './parser';
import type {
  InstructionBatchResult,
  InstructionParseError,
  PageInstruction,
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
 * 仅正则解析，附带跨行校验。前端预览使用。
 */
export function parseLocally(rawText: string): InstructionBatchResult {
  const { lines, duplicates } = parseInstructionLines(rawText);
  return finalize(lines, duplicates);
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
  } catch (err) {
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

function finalize(
  lines: ParsedLineResult[],
  duplicates: Map<number, number[]>,
): InstructionBatchResult {
  const validInstructions: PageInstruction[] = [];
  const seen = new Set<number>();
  const batchErrors: InstructionParseError[] = [];

  for (const line of lines) {
    if (!line.ok) continue;
    const ins = line.instruction;
    if (seen.has(ins.index)) {
      // 同 index 重复，标记 batch 错误
      batchErrors.push({
        code: 'INVALID_INDEX',
        message: `页码 ${ins.index} 重复出现`,
        rawLine: ins.rawLine,
      });
      continue;
    }
    seen.add(ins.index);
    validInstructions.push(ins);
  }

  validInstructions.sort((a, b) => a.index - b.index);

  // 把跨行重复信息也作为 batchErrors 输出（便于 UI 高亮）
  for (const [idx, lns] of duplicates) {
    if (lns.length > 1) {
      batchErrors.push({
        code: 'INVALID_INDEX',
        message: `页码 ${idx} 在第 ${lns.join(', ')} 行重复`,
        rawLine: '',
      });
    }
  }

  return { lines, validInstructions, batchErrors };
}

// 重新导出底层 API，便于测试或细粒度使用
export { parseInstructionLine, parseInstructionLines };
export type { InstructionBatchResult, ParsedLineResult, PageInstruction };

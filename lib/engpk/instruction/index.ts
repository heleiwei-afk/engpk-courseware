/**
 * engpk · 指令解析器（客户端安全入口）
 *
 * 此文件可以被浏览器代码安全 import。
 * 不包含任何服务端依赖（node:dns / resolve-model / callLLM 等）。
 *
 * 对外暴露：
 *   - parseLocally(rawText)  仅正则，前端实时预览用
 *   - parseInstructionLine   单行解析
 *   - parseInstructionLines  多行解析（不含 LLM 兜底）
 *   - finalize               跨行校验 + 汇总
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

/**
 * 仅正则解析，附带跨行校验。前端预览使用。
 */
export function parseLocally(rawText: string): InstructionBatchResult {
  const { lines, duplicates } = parseInstructionLines(rawText);
  return finalize(lines, duplicates);
}

export function finalize(
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

// 重新导出底层 API
export { parseInstructionLine, parseInstructionLines };
export type { InstructionBatchResult, ParsedLineResult, PageInstruction };

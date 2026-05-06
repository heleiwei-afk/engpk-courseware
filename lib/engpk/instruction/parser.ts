/**
 * engpk · 指令解析器（正则快路径）
 *
 * 输入示例：`第10页：【游戏】+单词闯关+内容：is, you, here, this`
 * 容忍：全角/半角冒号、加号、空格、不同长度的"页"前后空白、模式同义词。
 *
 * 解析失败时返回 { ok: false, error }，由调用方决定是否走 LLM 兜底归一化。
 */

import {
  MODE_ALIASES,
  type InstructionParseError,
  type PageInstruction,
  type ParsedLineResult,
  type SceneMode,
} from './types';

/**
 * 主正则：尽量宽松。
 *
 * 捕获组（按出现顺序）：
 *   1: 页码 N
 *   2: 模式
 *   3: 描述
 *   4: 内容
 *
 * 不使用命名捕获组以兼容 ES2017 编译目标。
 */
const LINE_REGEX =
  /^\s*第\s*(\d+)\s*页\s*[：:]\s*[【\[]\s*([^】\]]+?)\s*[】\]]\s*[+＋]\s*(.+?)\s*[+＋]\s*内容\s*[：:]\s*(.+?)\s*$/u;

function err(
  code: InstructionParseError['code'],
  rawLine: string,
  message: string,
  lineNumber?: number,
): InstructionParseError {
  return { code, rawLine, message, lineNumber };
}

/**
 * 解析单行；不做归一化。
 * - rawLine 为空 → EMPTY_INPUT
 * - 整体不匹配 → UNPARSEABLE（可由 normalizer 兜底）
 * - 模式不在白名单 → UNKNOWN_MODE
 * - index ≤ 0 → INVALID_INDEX
 */
export function parseInstructionLine(
  rawLine: string,
  lineNumber?: number,
): ParsedLineResult {
  const trimmed = rawLine.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: err('EMPTY_INPUT', rawLine, '空指令', lineNumber),
    };
  }

  const match = trimmed.match(LINE_REGEX);
  if (!match) {
    return {
      ok: false,
      error: err('UNPARSEABLE', rawLine, '指令格式不规范', lineNumber),
    };
  }

  const [, indexStr, modeRawWithSpace, descRaw, contentRaw] = match;
  const idxNum = Number.parseInt(indexStr, 10);
  if (!Number.isFinite(idxNum) || idxNum <= 0) {
    return {
      ok: false,
      error: err('INVALID_INDEX', rawLine, '页码必须是正整数', lineNumber),
    };
  }

  const modeRaw = modeRawWithSpace.trim();
  const mode: SceneMode | undefined = MODE_ALIASES[modeRaw];
  if (!mode) {
    return {
      ok: false,
      error: err(
        'UNKNOWN_MODE',
        rawLine,
        `未识别的模式：${modeRaw}`,
        lineNumber,
      ),
    };
  }

  const description = descRaw.trim();
  if (!description) {
    return {
      ok: false,
      error: err('MISSING_DESCRIPTION', rawLine, '描述为空', lineNumber),
    };
  }

  const content = contentRaw.trim();
  if (!content) {
    return {
      ok: false,
      error: err('MISSING_CONTENT', rawLine, '内容为空', lineNumber),
    };
  }

  const instruction: PageInstruction = {
    index: idxNum,
    mode,
    description,
    content,
    rawLine,
  };
  return { ok: true, instruction };
}

/**
 * 多行批量解析。不做 LLM 兜底（调用方在外层补）。
 *
 * 跨行校验：
 *   - 同一 index 不允许重复（保留首次出现，后续标 INVALID_INDEX）
 */
export function parseInstructionLines(rawText: string): {
  lines: ParsedLineResult[];
  duplicates: Map<number, number[]>; // index → 行号列表
} {
  const lines: ParsedLineResult[] = [];
  const indexToLineNumbers = new Map<number, number[]>();

  const rows = rawText.split(/\r?\n/);
  rows.forEach((row, i) => {
    const lineNumber = i + 1;
    if (!row.trim()) return; // 空行不计入
    const result = parseInstructionLine(row, lineNumber);
    lines.push(result);
    if (result.ok) {
      const arr = indexToLineNumbers.get(result.instruction.index) ?? [];
      arr.push(lineNumber);
      indexToLineNumbers.set(result.instruction.index, arr);
    }
  });

  // 找出重复（出现 ≥ 2 次的）
  const duplicates = new Map<number, number[]>();
  for (const [idx, lns] of indexToLineNumbers) {
    if (lns.length > 1) duplicates.set(idx, lns);
  }

  return { lines, duplicates };
}

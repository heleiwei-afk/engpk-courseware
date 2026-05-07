/**
 * engpk · 游戏 HTML 校验器（决策 #10 + 设计文档 §七）
 *
 * 校验规则：
 *   1. 禁用 API：fetch / XMLHttpRequest / WebSocket / importScripts / document.write → 命中即失败
 *   2. 必需 API：必须包含 parent.postMessage({source:'openmaic-game',...}) 调用
 *   3. 学习目标覆盖：每个 learningGoal 词必须在 HTML 中至少出现一次
 *   4. 大小：≤ 200KB
 *   5. 完整性：能被 DOMParser 解析（仅在浏览器环境可用；服务端跳过此项）
 *
 * 返回 { valid: true } 或 { valid: false, reasons: string[] }。
 */

export interface ValidatorResult {
  valid: boolean;
  reasons: string[];
}

const FORBIDDEN_APIS =
  /\bfetch\s*\(|\bXMLHttpRequest\b|\bnew\s+WebSocket\b|\bimportScripts\b|\bdocument\.write\b/;

const REQUIRED_POSTMESSAGE = /parent\.postMessage\s*\(\s*\{[^}]*source\s*:\s*['"]openmaic-game['"]/;

const MAX_SIZE_BYTES = 200_000;

export function validateGameHtml(
  html: string,
  learningGoals: string[],
): ValidatorResult {
  const reasons: string[] = [];

  // 1. 大小
  if (new TextEncoder().encode(html).length > MAX_SIZE_BYTES) {
    reasons.push(`HTML 超过 ${MAX_SIZE_BYTES / 1000}KB 限制`);
  }

  // 2. 禁用 API
  if (FORBIDDEN_APIS.test(html)) {
    reasons.push('包含禁用 API（fetch/XMLHttpRequest/WebSocket/importScripts/document.write）');
  }

  // 3. 必需 postMessage
  if (!REQUIRED_POSTMESSAGE.test(html)) {
    reasons.push('缺少 parent.postMessage({source:"openmaic-game",...}) 调用');
  }

  // 4. 学习目标覆盖
  for (const goal of learningGoals) {
    const trimmed = goal.trim().toLowerCase();
    if (trimmed && !html.toLowerCase().includes(trimmed)) {
      reasons.push(`学习目标 "${goal}" 未在 HTML 中出现`);
    }
  }

  return { valid: reasons.length === 0, reasons };
}

export const __test__ = {
  FORBIDDEN_APIS,
  REQUIRED_POSTMESSAGE,
  MAX_SIZE_BYTES,
};

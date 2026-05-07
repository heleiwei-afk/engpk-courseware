/**
 * engpk · 模型配置
 *
 * 集中管理 engpk 模块使用的模型默认值。
 *
 * 优先级（从高到低）：
 *   1. API 请求 header 中指定的模型（由 resolveModelFromRequest 解析）
 *   2. ENGPK_GENERATION_MODEL 环境变量
 *   3. 硬编码默认值 anthropic/claude-opus-4-7
 *
 * 归一化模型单独由 ENGPK_NORMALIZER_MODEL 控制（Phase C 会升级）。
 */

import { resolveModel } from '@/lib/server/resolve-model';
import type { ResolvedModel } from '@/lib/server/resolve-model';

/**
 * engpk 场景生成的默认模型。
 * 当 API route 未能从请求中解析到模型时使用。
 */
export const ENGPK_DEFAULT_MODEL_STRING = 'anthropic/claude-opus-4-7';

/**
 * 获取 engpk 生成管线使用的模型字符串。
 * 优先读环境变量，否则使用硬编码默认值。
 */
export function getEngpkGenerationModelString(): string {
  return (
    process.env.ENGPK_GENERATION_MODEL || ENGPK_DEFAULT_MODEL_STRING
  );
}

/**
 * 获取 engpk 归一化使用的模型字符串。
 * 归一化任务较轻，可以用更便宜的模型；但 Phase 3 决策统一用 opus。
 */
export function getEngpkNormalizerModelString(): string {
  return (
    process.env.ENGPK_NORMALIZER_MODEL ||
    process.env.ENGPK_GENERATION_MODEL ||
    ENGPK_DEFAULT_MODEL_STRING
  );
}

/**
 * 解析 engpk 生成管线的默认模型。
 * 当上层 resolveModelFromRequest 失败时调用此函数作为 fallback。
 */
export async function resolveEngpkGenerationModel(): Promise<ResolvedModel> {
  return resolveModel({
    modelString: getEngpkGenerationModelString(),
  });
}

/**
 * 解析 engpk 归一化的默认模型。
 */
export async function resolveEngpkNormalizerModel(): Promise<ResolvedModel> {
  return resolveModel({
    modelString: getEngpkNormalizerModelString(),
  });
}

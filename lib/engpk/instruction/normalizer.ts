/**
 * engpk · 指令归一化（LLM 兜底）
 *
 * 当正则解析失败（UNPARSEABLE）或多行批量中存在异常行时，
 * 调用便宜模型把整段输入规范化为标准格式：
 *
 *   第N页：【模式】+描述+内容：XXX
 *
 * 设计原则：
 *   - 只做"格式归一化"，不做内容创作；保留用户原意
 *   - 输出严格按行；模型若不知道怎么改就保留原样（前端再报错）
 *   - 模型选择由 ENGPK_NORMALIZER_MODEL 环境变量决定，建议用 mini/flash 级
 *   - 失败时 throw，不静默吞错
 *
 * 注：本模块仅在服务端使用（API route），不要在浏览器代码中 import。
 */

import { callLLM } from '@/lib/ai/llm';
import { resolveModel } from '@/lib/server/resolve-model';
import type { ResolvedModel } from '@/lib/server/resolve-model';
import { getEngpkNormalizerModelString } from '@/lib/engpk/generation/model-config';

const SYSTEM_PROMPT = `你是一个严格的格式归一化器。把用户输入的多行指令转写为标准格式：
第{N}页：【{模式}】+{描述}+内容：{内容}

模式必须是以下七个之一：封面 / 暖场 / 视频赏析 / 游戏 / 讨论 / 图文 / 结尾

要求：
1. 不创作新内容；只整理用户已经表达过的意思。
2. 一行一条；空行与无关字符直接去掉。
3. 页码缺失时按出现顺序从 1 开始补；若无法判断顺序就保留为"第?页"。
4. 模式名称必须落在七个模式之一；同义词请映射（如 cover→封面，warmup→暖场，video-review→视频赏析）。
5. 描述与内容字段如果不能区分，把整段放到内容里，描述字段填一个简短摘要（≤8字）。
6. 严格只输出归一化后的指令文本，不要任何解释、不要 Markdown、不要代码块。`;

/**
 * 把整段原始指令文本归一化为标准格式（多行）。
 * 失败抛错。
 */
export async function normalizeInstructions(
  rawText: string,
  options?: {
    /** 显式指定 ResolvedModel，便于复用上层已解析的模型 */
    model?: ResolvedModel;
    /** 最长输出 token */
    maxOutputTokens?: number;
  },
): Promise<string> {
  if (!rawText.trim()) return '';

  const modelString = getEngpkNormalizerModelString();

  const resolved =
    options?.model ??
    (await resolveModel({
      modelString,
    }));

  const result = await callLLM(
    {
      model: resolved.model,
      maxOutputTokens: options?.maxOutputTokens ?? 800,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: rawText },
      ],
    },
    'engpk-instruction-normalizer',
  );

  // 简单清洗：去掉可能残留的 markdown 代码块标记
  return result.text
    .replace(/^```[\w]*\n?/m, '')
    .replace(/\n?```\s*$/m, '')
    .trim();
}

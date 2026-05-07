/**
 * POST /api/engpk/performance-check
 *
 * 接收一帧 base64 图像，调用视觉 LLM 判定"是否在表演"。
 * 判定完成后立即丢弃图像数据，不落日志（决策 #9）。
 *
 * Body: { frameBase64: string, sceneId: string, videoTimestampMs: number }
 * Response: { isPerforming: boolean, confidence?: number }
 *
 * 注意：
 *   - 需要配置支持 vision 的模型（如 gpt-4o / gemini-flash）
 *   - 无 API key 时返回 { isPerforming: false, error: 'no model' }
 */

import { NextRequest } from 'next/server';
import { resolveModel } from '@/lib/server/resolve-model';
import { callLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';

const log = createLogger('engpk:performance-check');

interface RequestBody {
  frameBase64?: string;
  sceneId?: string;
  videoTimestampMs?: number;
}

const SYSTEM_PROMPT = `你是一个视觉判定助手。给你一张图片，请判断图中的人是否在做表演动作（如唱歌、跳舞、模仿口型、做手势、表情夸张等）。
只回答一个 JSON：{ "isPerforming": true/false, "confidence": 0.0-1.0 }
不要任何解释。`;

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { isPerforming: false, error: 'invalid body' });
  }

  const { frameBase64, sceneId } = body;
  if (!frameBase64 || typeof frameBase64 !== 'string') {
    return jsonResponse(400, { isPerforming: false, error: 'missing frameBase64' });
  }

  // 解析模型（优先用 vision 模型）
  let resolved;
  try {
    resolved = await resolveModel({
      modelString: process.env.ENGPK_VISION_MODEL || process.env.DEFAULT_MODEL,
    });
  } catch (err) {
    log.warn('no model available for performance check', err);
    return jsonResponse(200, { isPerforming: false, error: 'no model' });
  }

  try {
    const result = await callLLM(
      {
        model: resolved.model,
        maxOutputTokens: 100,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: '请判断这张图中的人是否在表演。' },
              {
                type: 'image',
                image: frameBase64.startsWith('data:')
                  ? frameBase64.split(',')[1]
                  : frameBase64,
                mimeType: 'image/jpeg',
              },
            ],
          },
        ],
      },
      'engpk-performance-check',
    );

    // 解析 LLM 回复
    const text = result.text.trim();
    try {
      const parsed = JSON.parse(
        text.replace(/```json\s*/g, '').replace(/```/g, ''),
      );
      return jsonResponse(200, {
        isPerforming: !!parsed.isPerforming,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : undefined,
      });
    } catch {
      // 尝试简单匹配
      const isPerforming = /true/i.test(text);
      return jsonResponse(200, { isPerforming });
    }
  } catch (err) {
    log.error('performance check LLM call failed', err);
    return jsonResponse(200, { isPerforming: false, error: 'llm_error' });
  }
}

function jsonResponse(status: number, data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

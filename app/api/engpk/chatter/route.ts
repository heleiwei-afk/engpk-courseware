/**
 * POST /api/engpk/chatter
 *
 * Generates a short chat message (10-20 chars) from an AI teammate.
 * Used for:
 *   - Proactive comments during playback (problem 3)
 *   - Responses to user messages (problem 4)
 *
 * Body: { context, archetype, agentName, userMessage? }
 * Response: { text }
 */

import { NextRequest } from 'next/server';
import { callLLM } from '@/lib/ai/llm';
import { resolveEngpkGenerationModel } from '@/lib/engpk/generation/model-config';
import { createLogger } from '@/lib/logger';

const log = createLogger('engpk:chatter');

export const maxDuration = 10;

const SYSTEM_PROMPT = [
  '你是一个 6-12 岁小朋友的 AI 学习伙伴。',
  '你需要用一句话（10-20 个字）发一条弹幕。',
  '',
  '要求：',
  '- 语气要符合你的性格（archetype）',
  '- 内容要与当前课堂内容相关',
  '- 像真的小朋友在课堂上的反应',
  '- 可以是：惊叹、提问、补充、鼓励、搞笑',
  '- 不要超过 20 个字',
  '- 不要加引号',
  '- 只输出弹幕文字，不要任何解释',
  '',
  '性格参考：',
  '- scholar：认真、爱补充知识点',
  '- energetic：活泼、爱用感叹号和 emoji',
  '- creative：脑洞大、爱联想',
  '- rookie：好奇、爱提问',
  '- veteran：淡定、偶尔点评',
].join('\n');

interface RequestBody {
  context?: string;
  archetype?: string;
  agentName?: string;
  userMessage?: string;
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: 'invalid body' });
  }

  const context = body.context || '';
  const archetype = body.archetype || 'energetic';
  const agentName = body.agentName || 'AI';
  const userMessage = body.userMessage;

  let resolved;
  try {
    resolved = await resolveEngpkGenerationModel();
  } catch {
    return jsonResponse(500, { error: 'model unavailable' });
  }

  try {
    let userPrompt = '当前课堂内容：' + context + '\n你的性格：' + archetype + '\n你的名字：' + agentName;
    if (userMessage) {
      userPrompt += '\n\n刚才有同学说："' + userMessage + '"\n请回应这位同学（10-20字）。';
    } else {
      userPrompt += '\n\n请发一条与课堂内容相关的弹幕（10-20字）。';
    }

    const result = await callLLM(
      {
        model: resolved.model,
        maxOutputTokens: 50,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      },
      'engpk-chatter',
    );

    const text = result.text.trim().replace(/^["']|["']$/g, '').slice(0, 30);
    return jsonResponse(200, { text });
  } catch (err) {
    log.warn('chatter LLM failed', err);
    return jsonResponse(200, { text: '' });
  }
}

function jsonResponse(status: number, data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * POST /api/engpk/plan-lesson
 *
 * Takes a short topic and returns a full set of lesson instructions (8-12 pages).
 * Used by the "AI 帮我规划" button in the instruction editor.
 *
 * Body: { topic: string }
 * Response: { instructions: string }
 */

import { NextRequest } from 'next/server';
import { callLLM } from '@/lib/ai/llm';
import { resolveEngpkGenerationModel } from '@/lib/engpk/generation/model-config';
import { PLANNER_SYSTEM_PROMPT, buildPlannerUserPrompt } from '@/lib/engpk/generation/planner-prompt';
import { createLogger } from '@/lib/logger';

const log = createLogger('engpk:plan-lesson');

export const maxDuration = 30;

interface RequestBody {
  topic?: string;
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: 'invalid body' });
  }

  const topic = body.topic?.trim();
  if (!topic) {
    return jsonResponse(400, { error: 'missing topic' });
  }

  let resolved;
  try {
    resolved = await resolveEngpkGenerationModel();
  } catch (err) {
    log.error('model resolution failed', err);
    return jsonResponse(500, { error: 'model unavailable' });
  }

  try {
    const result = await callLLM(
      {
        model: resolved.model,
        maxOutputTokens: 1500,
        messages: [
          { role: 'system', content: PLANNER_SYSTEM_PROMPT },
          { role: 'user', content: buildPlannerUserPrompt(topic) },
        ],
      },
      'engpk-plan-lesson',
    );

    // Clean up: remove markdown code blocks if present
    const text = result.text
      .replace(/^```[\w]*\n?/m, '')
      .replace(/\n?```\s*$/m, '')
      .trim();

    return jsonResponse(200, { instructions: text });
  } catch (err) {
    log.error('plan-lesson LLM call failed', err);
    return jsonResponse(500, {
      error: err instanceof Error ? err.message : 'generation failed',
    });
  }
}

function jsonResponse(status: number, data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

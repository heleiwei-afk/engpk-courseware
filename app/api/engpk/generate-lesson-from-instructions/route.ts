/**
 * POST /api/engpk/generate-lesson-from-instructions
 *
 * Body:
 *   { rawInstructions: string }
 *
 * Response: SSE stream of GenerationEvent
 *
 * 决策 #13：边播边生成。客户端收到第一个 scene-ready 立即跳转课堂，
 * 后续场景流式补齐。
 *
 * PR-08：使用 mock 生成器，便于打通端到端 SSE 链路。
 * PR-10+：会把 mock 替换为真 LLM 生成。
 */

import { NextRequest } from 'next/server';
import { createLogger } from '@/lib/logger';
import { parseWithFallback } from '@/lib/engpk/instruction';
import { formatSSE, type GenerationEvent } from '@/lib/engpk/types/generation-events';
import {
  makeLessonId,
  runMockGenerationPipeline,
} from '@/lib/engpk/generation/pipeline';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';

const log = createLogger('engpk:generate-lesson');

export const maxDuration = 120; // 单课最多 120 秒

const HEARTBEAT_INTERVAL_MS = 15_000;

interface RequestBody {
  rawInstructions?: string;
  /** 默认 true；调用方可显式禁用 LLM 兜底（如离线测试） */
  enableLLMFallback?: boolean;
  /** 显式指定模型（与 OpenMAIC 其它 API 一致，body.model 也可通过 header 覆盖） */
  model?: string;
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'INVALID_INPUT', '请求体不是合法 JSON');
  }

  const rawInstructions = body.rawInstructions?.trim();
  if (!rawInstructions) {
    return jsonError(400, 'INVALID_INPUT', '缺少 rawInstructions 字段');
  }

  // 解析 + LLM 兜底
  const enableLLMFallback = body.enableLLMFallback !== false;
  let parseBatch;
  try {
    parseBatch = await parseWithFallback(rawInstructions, {
      enableLLMFallback,
    });
  } catch (err) {
    log.error('Parse failed', err);
    return jsonError(
      500,
      'PARSE_FAILED',
      err instanceof Error ? err.message : String(err),
    );
  }

  if (parseBatch.validInstructions.length === 0) {
    return jsonError(
      400,
      'NO_VALID_INSTRUCTIONS',
      '没有解析到任何合法指令',
    );
  }

  // 解析模型（来自 header 或环境默认值）；失败不阻塞，封面会降级 mock
  let resolvedModel;
  try {
    resolvedModel = await resolveModelFromRequest(req, body);
  } catch (err) {
    log.warn(
      'Model resolution failed; falling back to mock pipeline only',
      err,
    );
  }

  const lessonId = makeLessonId();

  // 是否走过 LLM 兜底（只要有任何一行被标记 normalized 即视为是）
  const usedFallback = parseBatch.lines.some((l) => l.ok && l.normalized);

  // 构造 SSE 流
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const signal = req.signal;

  const writeEvent = async (event: GenerationEvent) => {
    if (signal.aborted) return;
    await writer.write(encoder.encode(formatSSE(event)));
  };

  // 心跳
  const heartbeatTimer = setInterval(() => {
    writer
      .write(encoder.encode(`:heartbeat\n\n`))
      .catch(() => clearInterval(heartbeatTimer));
  }, HEARTBEAT_INTERVAL_MS);

  // 后台异步推流
  (async () => {
    try {
      // parsed 帧
      await writeEvent({
        type: 'parsed',
        data: {
          lessonId,
          batch: parseBatch,
          usedFallback,
        },
      });

      // 跑 pipeline
      for await (const event of runMockGenerationPipeline({
        lessonId,
        rawInstructions,
        parseResult: {
          lessonId,
          batch: parseBatch,
          usedFallback,
        },
        signal,
        resolvedModel,
      })) {
        if (signal.aborted) break;
        await writeEvent(event);
      }
    } catch (err) {
      log.error('Pipeline error', err);
      try {
        await writeEvent({
          type: 'error',
          data: {
            code: 'INTERNAL',
            message: err instanceof Error ? err.message : String(err),
          },
        });
      } catch {
        // writer 可能已关
      }
    } finally {
      clearInterval(heartbeatTimer);
      try {
        await writer.close();
      } catch {
        // already closed
      }
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

function jsonError(status: number, code: string, message: string) {
  return new Response(
    JSON.stringify({ error: { code, message } }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

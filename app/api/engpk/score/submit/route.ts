/**
 * POST /api/engpk/score/submit
 *
 * 批量接收 ScoreEvent 并写入 Postgres（通过 Prisma）。
 * 前端 scoreBus 通过 flush hook 定期批量上报。
 *
 * Body: { events: ScoreEventPayload[] }
 * Response: { accepted: number }
 *
 * 决策 #12：MVP 不做服务端校验（速率/上限），仅落库。
 * ScoreEvent 表已预留 clientReportedAt / serverReceivedAt 双时间戳。
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/engpk/db';
import { createLogger } from '@/lib/logger';

const log = createLogger('engpk:score:submit');

interface ScoreEventPayload {
  target: string;
  delta: number;
  reason: string;
  source: string;
  sceneId?: string;
  lessonId?: string;
  clientReportedAt: number;
}

interface RequestBody {
  events?: ScoreEventPayload[];
  userId?: string;
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: 'invalid body' });
  }

  const events = body.events;
  if (!Array.isArray(events) || events.length === 0) {
    return jsonResponse(400, { error: 'events array required' });
  }

  const userId = body.userId || 'anonymous';

  try {
    // 批量写入
    const data = events.map((e) => ({
      userId,
      lessonId: e.lessonId || 'unknown',
      sceneId: e.sceneId || null,
      target: e.target,
      delta: e.delta,
      reason: e.reason,
      source: e.source,
      clientReportedAt: new Date(e.clientReportedAt),
    }));

    await prisma.scoreEvent.createMany({ data });

    return jsonResponse(200, { accepted: data.length });
  } catch (err) {
    log.error('score submit failed', err);
    return jsonResponse(500, {
      error: 'db_error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

function jsonResponse(status: number, data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

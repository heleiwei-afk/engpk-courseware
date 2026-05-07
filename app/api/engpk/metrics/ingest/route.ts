/**
 * POST /api/engpk/metrics/ingest
 *
 * 批量接收 MetricEvent 并写入 Postgres。
 * 前端 metricBus 通过 flush hook 定期批量上报。
 *
 * Body: { events: MetricEventPayload[] }
 * Response: { accepted: number }
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/engpk/db';
import { Prisma } from '@prisma/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('engpk:metrics:ingest');

interface MetricEventPayload {
  name: string;
  value?: number;
  tags?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  lessonId?: string;
  sceneId?: string;
  clientReportedAt: number;
}

interface RequestBody {
  events?: MetricEventPayload[];
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

  try {
    const data = events.map((e) => ({
      name: e.name,
      value: e.value ?? null,
      tags: e.tags ? (e.tags as Prisma.InputJsonValue) : Prisma.JsonNull,
      payload: e.payload ? (e.payload as Prisma.InputJsonValue) : Prisma.JsonNull,
      lessonId: e.lessonId ?? null,
      sceneId: e.sceneId ?? null,
      createdAt: new Date(e.clientReportedAt),
    }));

    await prisma.metricEvent.createMany({ data });

    return jsonResponse(200, { accepted: data.length });
  } catch (err) {
    log.error('metrics ingest failed', err);
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

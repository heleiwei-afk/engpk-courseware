/**
 * GET /api/engpk/score/session-summary?lessonId=xxx&userId=xxx
 *
 * 返回指定课程的积分汇总（用户 + 队友排名）。
 * 结尾页用来展示最终成绩。
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/engpk/db';

export async function GET(req: NextRequest) {
  const lessonId = req.nextUrl.searchParams.get('lessonId');
  const userId = req.nextUrl.searchParams.get('userId') || 'anonymous';

  if (!lessonId) {
    return jsonResponse(400, { error: 'lessonId required' });
  }

  try {
    // 按 target 聚合
    const aggregated = await prisma.scoreEvent.groupBy({
      by: ['target'],
      where: { lessonId, userId },
      _sum: { delta: true },
    });

    const ranking = aggregated
      .map((row) => ({
        target: row.target,
        totalScore: row._sum.delta ?? 0,
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

    return jsonResponse(200, { lessonId, userId, ranking });
  } catch (err) {
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

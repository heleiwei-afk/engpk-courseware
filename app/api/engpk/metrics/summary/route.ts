/**
 * GET /api/engpk/metrics/summary
 *
 * 返回 MetricEvent 按 name 聚合的统计（count / avg / max）。
 * 供 /admin/metrics 仪表板使用。
 */

import { prisma } from '@/lib/engpk/db';

export async function GET() {
  try {
    const aggregated = await prisma.metricEvent.groupBy({
      by: ['name'],
      _count: { id: true },
      _avg: { value: true },
      _max: { value: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const metrics = aggregated.map((row) => ({
      name: row.name,
      count: row._count.id,
      avgValue: row._avg.value,
      maxValue: row._max.value,
    }));

    return new Response(JSON.stringify({ metrics }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: 'db_error',
        message: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

/**
 * GET /api/engpk/lessons/[id]
 *
 * 返回指定 lesson 的完整数据（含 scenes 列表）。
 * 客户端在 SSE 断线时可用此 fallback 同步当前进度。
 *
 * PR-08：从内存 lesson-registry 读取；PR-17 改为 DB。
 */

import { NextRequest } from 'next/server';
import { getLesson } from '@/lib/engpk/generation/lesson-registry';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const lesson = getLesson(id);
  if (!lesson) {
    return new Response(
      JSON.stringify({ error: { code: 'NOT_FOUND', message: 'lesson not found' } }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    );
  }
  return new Response(JSON.stringify({ lesson }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

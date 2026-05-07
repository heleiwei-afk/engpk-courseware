/**
 * engpk · in-memory lesson registry
 *
 * MVP 阶段：生成的 lesson + scenes 暂存在进程内存中，
 * 由 /classroom-engpk/[id] 读取展示。
 *
 * 注意：
 *   - Next.js dev server 热重载会清空，刷新页面会丢失数据；这是已知行为，PR-17 接 Prisma 后才稳定。
 *   - 多实例部署不可用（无共享）；上线前必须切到 DB。
 *   - 这里只是"骨架占位"，便于 PR-08 跑通端到端 SSE。
 */

import type { Lesson, Scene } from '@/lib/engpk/types/scene-v2';

// 用 globalThis 持有，避免 dev 热重载时模块被多次加载导致拿不到老数据
const globalForLessons = globalThis as unknown as {
  __engpkLessons?: Map<string, Lesson>;
};

const lessons: Map<string, Lesson> =
  globalForLessons.__engpkLessons ?? new Map<string, Lesson>();

if (process.env.NODE_ENV !== 'production') {
  globalForLessons.__engpkLessons = lessons;
}

export function saveLesson(lesson: Lesson): void {
  lessons.set(lesson.id, lesson);
}

export function getLesson(id: string): Lesson | undefined {
  return lessons.get(id);
}

export function upsertScene(lessonId: string, scene: Scene): void {
  const lesson = lessons.get(lessonId);
  if (!lesson) return;
  const idx = lesson.scenes.findIndex((s) => s.id === scene.id);
  if (idx >= 0) {
    lesson.scenes[idx] = scene;
  } else {
    lesson.scenes.push(scene);
    lesson.scenes.sort((a, b) => a.order - b.order);
  }
}

export function setLessonStatus(
  lessonId: string,
  status: Lesson['status'],
): void {
  const lesson = lessons.get(lessonId);
  if (!lesson) return;
  lesson.status = status;
}

export function listLessons(): Lesson[] {
  return Array.from(lessons.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

export function clearAll(): void {
  lessons.clear();
}

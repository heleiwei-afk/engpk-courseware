/**
 * engpk · classroom-session store
 *
 * 课堂运行时的所有客户端状态，用 Zustand 管理。
 *
 * 职责：
 *   - 持有 user / teammates / scenes / currentIndex 等核心视图数据
 *   - 订阅 scoreBus，实时维护每个人的当前积分与排名（决策 #4.1 +  #7）
 *   - 订阅 bulletBus，维护弹幕列表（FIFO，仅保留近 N 条用于渲染）
 *   - 提供 UI 层调用的 actions：selectScene / markSceneReady / notifySpeaking
 *
 * 不做的：
 *   - 不做持久化（由 api/score/submit 异步落库）
 *   - 不做 LLM 调用
 *   - 不做网络请求
 */

import { create } from 'zustand';
import type { AITeammate, User } from '@/lib/engpk/types/teammate';
import type { Scene } from '@/lib/engpk/types/scene-v2';
import { scoreBus, type ScoreEvent } from '@/lib/engpk/score/bus';
import { bulletBus, type BulletEvent } from '@/lib/engpk/bullet/bus';

/** 渲染用的弹幕保留条数 */
const BULLET_MAX_KEEP = 50;

interface ScoreBoardEntry {
  /** user 或 teammate id */
  id: string;
  score: number;
  rank: number;
}

interface ClassroomSessionState {
  // ==================== 核心实体 ====================
  lessonId?: string;
  user?: User;
  teammates: AITeammate[];
  scenes: Scene[];
  /** 当前播放页 index（0-based） */
  currentSceneIndex: number;

  // ==================== 派生视图 ====================
  /** 排序后的积分榜（user + teammates 合并） */
  scoreBoard: ScoreBoardEntry[];
  /** 近 N 条弹幕 */
  bullets: BulletEvent[];
  /** 当前正在说话的 agentId（teammate / 'user' / 'ai-teacher'） */
  speakingAgentId?: string;

  // ==================== actions ====================
  hydrate(payload: {
    lessonId: string;
    user: User;
    teammates: AITeammate[];
    scenes: Scene[];
  }): void;

  /** 由 SSE 推送新场景时调用 */
  upsertScene(scene: Scene): void;

  /** 切换当前场景 */
  selectScene(index: number): void;

  /** 将某人标为正在发言（LangGraph agent_start 时） */
  notifySpeaking(agentId: string | undefined): void;

  /** 内部：scoreBus 回调 */
  _applyScoreEvent(event: ScoreEvent): void;
  /** 内部：bulletBus 回调 */
  _applyBulletEvent(event: BulletEvent): void;

  /** 清空（切换课程时调用） */
  reset(): void;
}

function computeScoreBoard(
  user: User | undefined,
  teammates: AITeammate[],
): ScoreBoardEntry[] {
  const entries: ScoreBoardEntry[] = [];
  if (user) entries.push({ id: user.id, score: user.score, rank: 0 });
  for (const t of teammates) {
    entries.push({ id: t.id, score: t.score, rank: 0 });
  }
  entries.sort((a, b) => b.score - a.score);
  entries.forEach((e, i) => {
    e.rank = i + 1;
  });
  return entries;
}

export const useClassroomSession = create<ClassroomSessionState>((set, get) => ({
  user: undefined,
  teammates: [],
  scenes: [],
  currentSceneIndex: 0,
  scoreBoard: [],
  bullets: [],
  speakingAgentId: undefined,

  hydrate({ lessonId, user, teammates, scenes }) {
    set({
      lessonId,
      user,
      teammates,
      scenes,
      currentSceneIndex: 0,
      scoreBoard: computeScoreBoard(user, teammates),
      bullets: [],
      speakingAgentId: undefined,
    });
  },

  upsertScene(scene) {
    set((state) => {
      const idx = state.scenes.findIndex((s) => s.id === scene.id);
      const next = state.scenes.slice();
      if (idx >= 0) {
        next[idx] = scene;
      } else {
        next.push(scene);
        next.sort((a, b) => a.order - b.order);
      }
      return { scenes: next };
    });
  },

  selectScene(index) {
    set((state) => {
      if (index < 0 || index >= state.scenes.length) return {};
      return { currentSceneIndex: index };
    });
  },

  notifySpeaking(agentId) {
    set({ speakingAgentId: agentId });
  },

  _applyScoreEvent(event) {
    set((state) => {
      let user = state.user;
      let teammates = state.teammates;

      if (event.target === 'user') {
        if (user) {
          user = { ...user, score: user.score + event.delta };
        }
      } else {
        teammates = teammates.map((t) =>
          t.id === event.target ? { ...t, score: t.score + event.delta } : t,
        );
      }

      const scoreBoard = computeScoreBoard(user, teammates);
      // 将 rank 回填到 user / teammates（UI 用）
      if (user) {
        const entry = scoreBoard.find((e) => e.id === user!.id);
        if (entry) user = { ...user, rank: entry.rank };
      }
      teammates = teammates.map((t) => {
        const entry = scoreBoard.find((e) => e.id === t.id);
        return entry ? { ...t, rank: entry.rank } : t;
      });

      return { user, teammates, scoreBoard };
    });
  },

  _applyBulletEvent(event) {
    set((state) => {
      const next = [...state.bullets, event];
      if (next.length > BULLET_MAX_KEEP) {
        next.splice(0, next.length - BULLET_MAX_KEEP);
      }
      return { bullets: next };
    });
  },

  reset() {
    set({
      lessonId: undefined,
      user: undefined,
      teammates: [],
      scenes: [],
      currentSceneIndex: 0,
      scoreBoard: [],
      bullets: [],
      speakingAgentId: undefined,
    });
  },
}));

// ==================== 总线订阅 ====================
//
// 模块首次 import 时挂上订阅。
// Next.js 会在服务端短暂执行此模块，但 createBus 是纯内存单例，无副作用。
// 若未来需要在热重载时清理，可用 module.hot 钩子。

let subscribed = false;
export function ensureClassroomBusWired() {
  if (subscribed) return;
  subscribed = true;

  scoreBus.subscribe((e) => useClassroomSession.getState()._applyScoreEvent(e));
  bulletBus.subscribe((e) => useClassroomSession.getState()._applyBulletEvent(e));
}

// 自动挂载（仅客户端）
if (typeof window !== 'undefined') {
  ensureClassroomBusWired();
}

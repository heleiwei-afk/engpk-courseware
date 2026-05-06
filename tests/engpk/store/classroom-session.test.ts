import { describe, it, expect, beforeEach } from 'vitest';
import {
  useClassroomSession,
  ensureClassroomBusWired,
} from '@/lib/engpk/store/classroom-session';
import { scoreBus, makeScoreEvent } from '@/lib/engpk/score/bus';
import { bulletBus, makeBulletEvent } from '@/lib/engpk/bullet/bus';
import type { AITeammate, User } from '@/lib/engpk/types/teammate';

const user: User = { id: 'u1', nickname: '小明', avatar: '/u.png', score: 0 };
const teammates: AITeammate[] = [
  { id: 't1', nickname: '阿华', avatar: '/t1.png', archetype: 'scholar', bio: '', score: 0 },
  { id: 't2', nickname: '小风', avatar: '/t2.png', archetype: 'energetic', bio: '', score: 0 },
  { id: 't3', nickname: '点点', avatar: '/t3.png', archetype: 'creative', bio: '', score: 0 },
];

describe('classroom-session store', () => {
  beforeEach(() => {
    useClassroomSession.getState().reset();
    // 确保 bus 订阅已挂载（vitest 在 node 环境，没有 window，需要手动挂）
    ensureClassroomBusWired();
  });

  it('hydrates initial state and computes scoreBoard', () => {
    useClassroomSession.getState().hydrate({
      lessonId: 'L1',
      user,
      teammates,
      scenes: [],
    });
    const state = useClassroomSession.getState();
    expect(state.lessonId).toBe('L1');
    expect(state.user?.id).toBe('u1');
    expect(state.teammates).toHaveLength(3);
    // 全 0 分时排名按插入顺序，user 第 1
    expect(state.scoreBoard).toHaveLength(4);
  });

  it('applies a user score event and updates user.score + rank', () => {
    useClassroomSession.getState().hydrate({
      lessonId: 'L1',
      user,
      teammates,
      scenes: [],
    });

    scoreBus.dispatch(
      makeScoreEvent({
        target: 'user',
        delta: 50,
        reason: '游戏通关',
        source: 'game-complete',
        sceneId: 's1',
        lessonId: 'L1',
      }),
    );

    const state = useClassroomSession.getState();
    expect(state.user?.score).toBe(50);
    expect(state.user?.rank).toBe(1);
    // 用户领先时，scoreBoard[0] 是用户
    expect(state.scoreBoard[0].id).toBe('u1');
    expect(state.scoreBoard[0].score).toBe(50);
  });

  it('applies a teammate score event', () => {
    useClassroomSession.getState().hydrate({
      lessonId: 'L1',
      user,
      teammates,
      scenes: [],
    });

    scoreBus.dispatch(
      makeScoreEvent({
        target: 't1',
        delta: 80,
        reason: '队友加分',
        source: 'teammate-resonance',
      }),
    );

    const state = useClassroomSession.getState();
    expect(state.teammates.find((t) => t.id === 't1')?.score).toBe(80);
    // t1 当前最高分
    expect(state.scoreBoard[0].id).toBe('t1');
  });

  it('keeps recent bullets and trims old ones', () => {
    useClassroomSession.getState().hydrate({
      lessonId: 'L1',
      user,
      teammates,
      scenes: [],
    });

    for (let i = 0; i < 60; i++) {
      bulletBus.dispatch(
        makeBulletEvent({
          text: `msg-${i}`,
          from: 'system',
          style: 'normal',
        }),
      );
    }

    const state = useClassroomSession.getState();
    // BULLET_MAX_KEEP = 50
    expect(state.bullets.length).toBe(50);
    expect(state.bullets[0].text).toBe('msg-10');
    expect(state.bullets[49].text).toBe('msg-59');
  });

  it('selectScene clamps to valid range', () => {
    useClassroomSession.getState().hydrate({
      lessonId: 'L1',
      user,
      teammates,
      scenes: [
        // 用占位类型，store 不校验 type
        { id: 's1', order: 1, type: 'cover' } as never,
        { id: 's2', order: 2, type: 'cover' } as never,
      ],
    });

    useClassroomSession.getState().selectScene(1);
    expect(useClassroomSession.getState().currentSceneIndex).toBe(1);

    useClassroomSession.getState().selectScene(99);
    // 越界不变
    expect(useClassroomSession.getState().currentSceneIndex).toBe(1);

    useClassroomSession.getState().selectScene(-1);
    expect(useClassroomSession.getState().currentSceneIndex).toBe(1);
  });
});

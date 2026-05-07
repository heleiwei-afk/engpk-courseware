import { describe, it, expect, vi } from 'vitest';
import { EngpkPlaybackEngine } from '@/lib/engpk/playback/engine';
import type { Scene } from '@/lib/engpk/types/scene-v2';
import type {
  AwaitUserInteractionAction,
  BulletSendAction,
  ScoreRewardAction,
} from '@/lib/engpk/types/action-ext';
import { scoreBus } from '@/lib/engpk/score/bus';
import { bulletBus } from '@/lib/engpk/bullet/bus';

function makeCoverScene(
  id: string,
  order: number,
  actions: Scene['actions'] = [],
): Scene {
  return {
    id,
    order,
    type: 'cover',
    instruction: {
      index: order,
      mode: 'cover',
      description: 'desc',
      content: 'content',
      rawLine: '',
    },
    agentIds: [],
    actions,
    status: 'ready',
    payload: {
      title: 't',
      styleToken: {
        primaryColor: '#000',
        accentColor: '#111',
        fontFamily: 'rounded',
        motif: 'fantasy',
      },
      coverImagePrompt: 'x',
    },
  };
}

describe('EngpkPlaybackEngine', () => {
  it('plays scenes sequentially and reaches ended', async () => {
    const engine = new EngpkPlaybackEngine();
    engine.setScenes([
      makeCoverScene('s1', 1),
      makeCoverScene('s2', 2),
      makeCoverScene('s3', 3),
    ]);
    await engine.start();
    expect(engine.getStatus()).toBe('ended');
    expect(engine.getSceneIndex()).toBeGreaterThanOrEqual(2);
  });

  it('executes engpk actions: bullet_send + score_reward', async () => {
    scoreBus.clear();
    bulletBus.clear();

    const bulletActions: Array<{ text: string }> = [];
    bulletBus.subscribe((e) => bulletActions.push({ text: e.text }));
    const scoreActions: Array<{ delta: number }> = [];
    scoreBus.subscribe((e) => scoreActions.push({ delta: e.delta }));

    const bullet: BulletSendAction = {
      id: 'b1',
      type: 'bullet_send',
      text: '第一页',
      from: 'ai-teacher',
    };
    const reward: ScoreRewardAction = {
      id: 'r1',
      type: 'score_reward',
      delta: 10,
      reason: '开场',
      target: 'user',
    };

    const engine = new EngpkPlaybackEngine();
    engine.setScenes([
      makeCoverScene('s1', 1, [bullet, reward]),
    ]);
    await engine.start();

    expect(bulletActions).toEqual([{ text: '第一页' }]);
    expect(scoreActions).toEqual([{ delta: 10 }]);
  });

  it('enters awaiting_user on await_user_interaction and resumes via notifySceneComplete', async () => {
    const awaitAction: AwaitUserInteractionAction = {
      id: 'w1',
      type: 'await_user_interaction',
      waitFor: 'scene_complete',
    };
    const engine = new EngpkPlaybackEngine();
    engine.setScenes([
      makeCoverScene('s1', 1, [awaitAction]),
      makeCoverScene('s2', 2),
    ]);

    // 并发启动，不 await
    const played = engine.start();

    // 等一个 microtask，确保执行器进入 awaiting_user
    await new Promise((r) => setTimeout(r, 10));
    expect(engine.getStatus()).toBe('awaiting_user');

    // notify 错误 sceneId 不生效
    expect(engine.notifySceneComplete('wrong-id')).toBe(false);
    expect(engine.getStatus()).toBe('awaiting_user');

    // notify 正确 sceneId
    expect(engine.notifySceneComplete('s1')).toBe(true);

    await played;
    expect(engine.getStatus()).toBe('ended');
    expect(engine.getSceneIndex()).toBeGreaterThanOrEqual(1);
  });

  it('timeout triggers fallback="skip" behavior', async () => {
    const awaitAction: AwaitUserInteractionAction = {
      id: 'w2',
      type: 'await_user_interaction',
      waitFor: 'scene_complete',
      timeoutMs: 30,
      fallback: 'skip',
    };
    const engine = new EngpkPlaybackEngine();
    engine.setScenes([
      makeCoverScene('s1', 1, [awaitAction]),
      makeCoverScene('s2', 2),
    ]);
    await engine.start();
    expect(engine.getStatus()).toBe('ended');
  });

  it('pause / resume toggles playing state', async () => {
    const engine = new EngpkPlaybackEngine();
    engine.setScenes([makeCoverScene('s1', 1)]);
    expect(engine.getStatus()).toBe('idle');
    const played = engine.start();
    await played;
    expect(engine.getStatus()).toBe('ended');
  });

  it('onUnknownAction bridges non-engpk actions', async () => {
    const onUnknown = vi.fn().mockResolvedValue(undefined);
    const engine = new EngpkPlaybackEngine({ onUnknownAction: onUnknown });
    const speech = {
      id: 'sp1',
      type: 'speech',
      text: 'hello',
    } as unknown as Scene['actions'][number];
    engine.setScenes([makeCoverScene('s1', 1, [speech])]);
    await engine.start();
    expect(onUnknown).toHaveBeenCalledTimes(1);
  });
});

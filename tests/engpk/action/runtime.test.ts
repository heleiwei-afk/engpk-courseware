import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActionRuntime } from '@/lib/engpk/action/runtime';
import { scoreBus } from '@/lib/engpk/score/bus';
import { bulletBus } from '@/lib/engpk/bullet/bus';
import type {
  BulletSendAction,
  ScoreRewardAction,
  AwaitUserInteractionAction,
} from '@/lib/engpk/types/action-ext';

describe('ActionRuntime', () => {
  beforeEach(() => {
    scoreBus.clear();
    bulletBus.clear();
  });

  it('dispatches bullet_send to bulletBus', async () => {
    const runtime = new ActionRuntime();
    const received: unknown[] = [];
    bulletBus.subscribe((e) => received.push(e));

    const action: BulletSendAction = {
      id: 'a1',
      type: 'bullet_send',
      text: '加油！',
      emoji: '🔥',
      from: 'ai-teammate',
      agentId: 't1',
      style: 'highlight',
    };
    await runtime.execute(action);

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      text: '加油！',
      emoji: '🔥',
      from: 'ai-teammate',
      style: 'highlight',
    });
  });

  it('dispatches score_reward to scoreBus with runtime context', async () => {
    const runtime = new ActionRuntime({
      lessonId: 'L1',
      sceneId: 'S1',
    });
    const received: unknown[] = [];
    scoreBus.subscribe((e) => received.push(e));

    const action: ScoreRewardAction = {
      id: 'a2',
      type: 'score_reward',
      delta: 20,
      reason: '游戏通关',
      target: 'user',
    };
    await runtime.execute(action);

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      target: 'user',
      delta: 20,
      reason: '游戏通关',
      source: 'manual',
      lessonId: 'L1',
      sceneId: 'S1',
    });
  });

  it('await_user_interaction uses onAwaitUserInteraction hook', async () => {
    let resolveHook: (() => void) | null = null;
    const hookPromise = new Promise<void>((resolve) => {
      resolveHook = resolve;
    });

    const runtime = new ActionRuntime({
      onAwaitUserInteraction: () => hookPromise,
    });

    const action: AwaitUserInteractionAction = {
      id: 'a3',
      type: 'await_user_interaction',
      waitFor: 'scene_complete',
    };
    const execPromise = runtime.execute(action);

    // execute 应该还在 pending
    const raceSentinel = Symbol('still-pending');
    const winner = await Promise.race([
      execPromise.then(() => 'resolved'),
      new Promise((r) => setTimeout(() => r(raceSentinel), 10)),
    ]);
    expect(winner).toBe(raceSentinel);

    // resolve hook，execute 应该随之 resolve
    resolveHook!();
    await execPromise;
  });

  it('falls back to onUnknown for non-engpk actions', async () => {
    const onUnknown = vi.fn();
    const runtime = new ActionRuntime({ onUnknown });

    const speech = {
      id: 'a4',
      type: 'speech',
      text: 'hi',
    } as unknown as Parameters<typeof runtime.execute>[0];
    await runtime.execute(speech);

    expect(onUnknown).toHaveBeenCalledWith(speech);
  });

  it('await_user_interaction without hook resolves immediately (fail-safe)', async () => {
    const runtime = new ActionRuntime(); // no hook
    const action: AwaitUserInteractionAction = {
      id: 'a5',
      type: 'await_user_interaction',
      waitFor: 'scene_complete',
    };
    // should not hang
    await runtime.execute(action);
  });
});

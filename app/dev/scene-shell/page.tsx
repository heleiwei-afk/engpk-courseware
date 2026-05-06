'use client';

/**
 * /dev/scene-shell — SceneShell 开发预览页
 *
 * 用 mock 数据填充 classroom-session store，验证 6 区块视觉布局。
 * 不参与真实生成流程。
 *
 * 提供按钮模拟：加分、加弹幕、切换正在说话。
 */

import { useEffect } from 'react';
import { SceneShell } from '@/components/scene-shell';
import { useClassroomSession } from '@/lib/engpk/store/classroom-session';
import { scoreBus, makeScoreEvent } from '@/lib/engpk/score/bus';
import { bulletBus, makeBulletEvent } from '@/lib/engpk/bullet/bus';
import type { Scene } from '@/lib/engpk/types/scene-v2';

const MOCK_SCENES: Scene[] = [
  {
    id: 's1',
    order: 1,
    type: 'cover',
    instruction: {
      index: 1,
      mode: 'cover',
      description: '奇幻英语冒险',
      content: 'Level 1 启程',
      rawLine: '第1页：【封面】+奇幻英语冒险+内容：Level 1 启程',
    },
    agentIds: [],
    actions: [],
    status: 'ready',
    payload: {
      title: '奇幻英语冒险 · Level 1 启程',
      styleToken: {
        primaryColor: '#7c3aed',
        accentColor: '#22d3ee',
        fontFamily: 'rounded',
        motif: 'fantasy',
      },
      coverImagePrompt: '',
    },
  } as Scene,
  {
    id: 's2',
    order: 2,
    type: 'warmup',
    instruction: {
      index: 2,
      mode: 'warmup',
      description: '节奏热身',
      content: 'rhythm.mp4',
      rawLine: '第2页：【暖场】+节奏热身+内容：rhythm.mp4',
    },
    agentIds: [],
    actions: [],
    status: 'generating',
    payload: { warmupVideoUrl: '', rhythmGame: { durationMs: 0, laneCount: 4, difficulty: 'easy', beatmap: [] } },
  } as Scene,
  {
    id: 's3',
    order: 3,
    type: 'game',
    instruction: {
      index: 3,
      mode: 'game',
      description: '单词闯关',
      content: 'is, you, here, this',
      rawLine: '第3页：【游戏】+单词闯关+内容：is, you, here, this',
    },
    agentIds: [],
    actions: [],
    status: 'pending',
    payload: { learningGoals: [], gameDesign: { title: '', mechanics: '', winCondition: '' }, gameHtml: '' },
  } as Scene,
  {
    id: 's4',
    order: 4,
    type: 'discussion',
    instruction: {
      index: 4,
      mode: 'discussion',
      description: '我们应该如何使用 this？',
      content: 'this 的四种用法',
      rawLine: '第4页：【讨论】+我们应该如何使用 this？+内容：this 的四种用法',
    },
    agentIds: [],
    actions: [],
    status: 'failed',
    error: 'mock failure',
    payload: { topic: '', task: '', rule: '', expectedRounds: 3 },
  } as Scene,
];

export default function SceneShellDevPage() {
  const hydrate = useClassroomSession((s) => s.hydrate);
  const teammates = useClassroomSession((s) => s.teammates);
  const notifySpeaking = useClassroomSession((s) => s.notifySpeaking);
  const speakingAgentId = useClassroomSession((s) => s.speakingAgentId);

  useEffect(() => {
    hydrate({
      lessonId: 'dev-lesson',
      user: {
        id: 'dev-user',
        nickname: '小明',
        avatar: '/avatars/default.png',
        score: 0,
      },
      teammates: [
        {
          id: 't1',
          nickname: '阿华',
          avatar: '/avatars/default.png',
          archetype: 'scholar',
          bio: '稳重的学霸',
          score: 0,
        },
        {
          id: 't2',
          nickname: '小风',
          avatar: '/avatars/default.png',
          archetype: 'energetic',
          bio: '元气满满',
          score: 0,
        },
        {
          id: 't3',
          nickname: '点点',
          avatar: '/avatars/default.png',
          archetype: 'creative',
          bio: '点子大王',
          score: 0,
        },
      ],
      scenes: MOCK_SCENES,
    });
  }, [hydrate]);

  function rewardUser() {
    scoreBus.dispatch(
      makeScoreEvent({
        target: 'user',
        delta: 10,
        reason: '答对了',
        source: 'manual',
      }),
    );
    bulletBus.dispatch(
      makeBulletEvent({
        text: '+10 答对了！',
        emoji: '🎯',
        from: 'system',
        style: 'highlight',
      }),
    );
  }

  function rewardRandomTeammate() {
    const idx = Math.floor(Math.random() * teammates.length);
    const t = teammates[idx];
    if (!t) return;
    scoreBus.dispatch(
      makeScoreEvent({
        target: t.id,
        delta: 5 + Math.floor(Math.random() * 15),
        reason: '队友加分',
        source: 'manual',
      }),
    );
  }

  function pushBullet() {
    const samples = [
      { text: '老师讲得真清楚', emoji: '👏' },
      { text: '这个游戏太好玩了', emoji: '🎮' },
      { text: '我懂了！', emoji: '💡' },
      { text: '加油！', emoji: '🔥' },
    ];
    const pick = samples[Math.floor(Math.random() * samples.length)];
    const teammate = teammates[Math.floor(Math.random() * teammates.length)];
    bulletBus.dispatch(
      makeBulletEvent({
        text: pick.text,
        emoji: pick.emoji,
        from: 'ai-teammate',
        agentId: teammate?.id,
        style: 'normal',
      }),
    );
  }

  function toggleSpeaker() {
    if (speakingAgentId) {
      notifySpeaking(undefined);
    } else {
      const t = teammates[Math.floor(Math.random() * teammates.length)];
      notifySpeaking(t?.id);
    }
  }

  return (
    <SceneShell raiseHandEnabled onRaiseHand={() => alert('举手了')}>
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-bold">SceneShell 开发预览</h1>
        <p className="max-w-md text-center text-sm text-muted-foreground">
          这是一个仅用于布局调试的开发页。点击下方按钮派发事件到 scoreBus / bulletBus，
          观察四周区块的实时反应。
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={rewardUser}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            +10 用户得分
          </button>
          <button
            type="button"
            onClick={rewardRandomTeammate}
            className="rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
          >
            随机队友加分
          </button>
          <button
            type="button"
            onClick={pushBullet}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            发一条弹幕
          </button>
          <button
            type="button"
            onClick={toggleSpeaker}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            {speakingAgentId ? '停止说话' : '随机谁在说话'}
          </button>
        </div>
      </div>
    </SceneShell>
  );
}

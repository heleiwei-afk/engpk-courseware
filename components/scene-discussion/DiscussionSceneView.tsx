'use client';

/**
 * DiscussionSceneView — 讨论类场景渲染器
 *
 * 运行时流程（决策 #5：完全 LangGraph LLM 决策）：
 *   1. 显示老师开场白（来自 scene.actions[0] speech）
 *   2. 用户点"开始讨论"→ 调 /api/chat SSE 启动 LangGraph 讨论
 *   3. 实时显示 agent 发言（text_delta 流式 + action 事件）
 *   4. 收到 cue_user → 提示用户发言
 *   5. 用户输入后再次调 /api/chat 继续讨论
 *   6. 收到 done → 讨论结束，显示"下一页"按钮
 *
 * 简化版（PR-13）：
 *   - 不接入真 TTS / 白板（后续 PR）
 *   - agent 发言以文字气泡展示
 *   - 举手 = 用户主动发言（不等 cue_user）
 *
 * 注意：需要 LLM API key 才能真正运行讨论。无 key 时显示提示。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiscussionScene } from '@/lib/engpk/types/scene-v2';
import type { AITeammate } from '@/lib/engpk/types/teammate';
import { useClassroomSession } from '@/lib/engpk/store/classroom-session';
import { scoreBus, makeScoreEvent } from '@/lib/engpk/score/bus';
import { bulletBus, makeBulletEvent } from '@/lib/engpk/bullet/bus';
import { useServerTTS } from '@/lib/engpk/client/use-server-tts';
import { getTeacherVoice, assignTeammateVoices } from '@/lib/engpk/audio/voice-config';
import { cn } from '@/lib/utils';
import { AnimatePresence } from 'motion/react';
import type { RoundtableState } from './RoundtableStage';
import { ProactiveCard } from './ProactiveCard';
import { VoiceInputButton } from './VoiceInputButton';

interface ChatMessage {
  id: string;
  role: 'teacher' | 'teammate' | 'user' | 'system';
  agentId?: string;
  agentName?: string;
  text: string;
  streaming?: boolean;
}

interface DiscussionSceneViewProps {
  scene: DiscussionScene;
  onContinue?: () => void;
}

export function DiscussionSceneView({
  scene,
  onContinue,
}: DiscussionSceneViewProps) {
  const { topic, task, rule, expectedRounds } = scene.payload;
  const teammates = useClassroomSession((s) => s.teammates);
  const notifySpeaking = useClassroomSession((s) => s.notifySpeaking);
  const speakingAgentId = useClassroomSession((s) => s.speakingAgentId);
  const tts = useServerTTS({ fallbackToBrowser: true });

  // Assign different voices to each teammate
  const teammateVoicesRef = useRef<Record<string, string>>({});
  if (teammates.length > 0 && Object.keys(teammateVoicesRef.current).length === 0) {
    const teacherVoice = getTeacherVoice();
    const voices = assignTeammateVoices(teacherVoice, teammates.length);
    teammates.forEach((t, i) => {
      teammateVoicesRef.current[t.id] = voices[i] || teacherVoice;
    });
  }

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<
    'idle' | 'running' | 'waiting-user' | 'done' | 'error'
  >('idle');
  const [userInput, setUserInput] = useState('');
  const [round, setRound] = useState(0);
  const [showProactive, setShowProactive] = useState(true);
  const [roundtableState, setRoundtableState] = useState<RoundtableState>('idle');
  const [currentBubbleText, setCurrentBubbleText] = useState('');
  const [currentSpeakerName, setCurrentSpeakerName] = useState('');
  const [isBubbleStreaming, setIsBubbleStreaming] = useState(false);
  const [sendCooldown, setSendCooldown] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AbortController | null>(null);

  // 自动滚到底
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 老师开场白
  useEffect(() => {
    const opening = scene.actions.find((a) => a.type === 'speech');
    if (opening && opening.type === 'speech') {
      setMessages([
        {
          id: 'opening',
          role: 'teacher',
          agentName: 'AI 老师',
          text: opening.text,
        },
      ]);
    }
  }, [scene.actions]);

  const startDiscussion = useCallback(async () => {
    setStatus('running');
    await runDiscussionRound(undefined);
  }, []);

  const handleUserSend = useCallback(async () => {
    const text = userInput.trim();
    if (!text) return;
    setUserInput('');
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', text },
    ]);
    setStatus('running');
    await runDiscussionRound(text);
  }, [userInput]);

  async function runDiscussionRound(userMessage?: string) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    // 构造 messages 历史（简化版：只传最近 20 条）
    const history = messages.slice(-20).map((m) => ({
      id: m.id,
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.text,
      parts: [{ type: 'text' as const, text: m.text }],
      createdAt: new Date(),
    }));

    if (userMessage) {
      history.push({
        id: `user-${Date.now()}`,
        role: 'user',
        content: userMessage,
        parts: [{ type: 'text', text: userMessage }],
        createdAt: new Date(),
      });
    }

    const body = {
      messages: history,
      storeState: {
        stage: null,
        scenes: [],
        currentSceneId: scene.id,
        mode: 'discussion',
        whiteboardOpen: false,
      },
      config: {
        agentIds: scene.agentIds,
        sessionType: 'discussion',
        discussionTopic: topic,
        discussionPrompt: `任务：${task}\n规则：${rule}`,
        agentConfigs: teammates.map((t) => ({
          id: t.id,
          name: t.nickname,
          role: t.archetype,
          persona: t.bio,
          avatar: t.avatar,
          color: '#7c3aed',
          allowedActions: ['speech'],
          priority: 1,
          isGenerated: true,
        })),
      },
      apiKey: '', // 由服务端 resolveModel 从 env 读取
    };

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setStatus('error');
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'system',
            text: `讨论接口错误 (HTTP ${res.status})。请确认已配置 LLM API Key。`,
          },
        ]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentMsgId = '';
      let currentAgentId = '';
      let currentAgentName = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep: number;
        while ((sep = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          processSSEFrame(frame);
        }
      }

      function processSSEFrame(frame: string) {
        const trimmed = frame.trim();
        if (!trimmed || trimmed.startsWith(':')) return;
        const dataLine = trimmed
          .split('\n')
          .find((l) => l.startsWith('data:'));
        if (!dataLine) return;
        try {
          const event = JSON.parse(dataLine.slice(5).trim());
          handleEvent(event);
        } catch {
          // ignore
        }
      }

      function handleEvent(event: { type: string; data: Record<string, unknown> }) {
        switch (event.type) {
          case 'agent_start': {
            currentMsgId = (event.data.messageId as string) || `msg-${Date.now()}`;
            currentAgentId = (event.data.agentId as string) || '';
            currentAgentName = (event.data.agentName as string) || '';
            notifySpeaking(currentAgentId);
            setRoundtableState('speaking');
            setCurrentBubbleText('');
            setCurrentSpeakerName(currentAgentName);
            setIsBubbleStreaming(true);
            setSendCooldown(false);
            setMessages((prev) => [
              ...prev,
              {
                id: currentMsgId,
                role: 'teammate',
                agentId: currentAgentId,
                agentName: currentAgentName,
                text: '',
                streaming: true,
              },
            ]);
            break;
          }
          case 'text_delta': {
            const content = (event.data.content as string) || '';
            setCurrentBubbleText((prev) => prev + content);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === currentMsgId
                  ? { ...m, text: m.text + content }
                  : m,
              ),
            );
            break;
          }
          case 'agent_end': {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === currentMsgId ? { ...m, streaming: false } : m,
              ),
            );
            notifySpeaking(undefined);
            // TTS: 朗读 agent 的完整发言
            const finishedMsg = messages.find((m) => m.id === currentMsgId);
            if (finishedMsg?.text) {
              tts.speak(finishedMsg.text);
            }
            // 每轮 agent 发言给该 agent 加分
            scoreBus.dispatch(
              makeScoreEvent({
                target: currentAgentId,
                delta: 5,
                reason: '讨论发言',
                source: 'discussion-reward',
                sceneId: scene.id,
              }),
            );
            // 发言间延迟 1.5s（模拟思考）— 用 setTimeout 避免 async 问题
            break;
          }
          case 'cue_user': {
            setStatus('waiting-user');
            setRoundtableState('cue-user');
            setMessages((prev) => [
              ...prev,
              {
                id: `cue-${Date.now()}`,
                role: 'system',
                text: '轮到你了！请输入你的想法。',
              },
            ]);
            break;
          }
          case 'done': {
            setRound((r) => r + 1);
            notifySpeaking(undefined);
            if (round + 1 >= expectedRounds) {
              setStatus('done');
              setRoundtableState('ended');
              bulletBus.dispatch(
                makeBulletEvent({
                  text: '讨论结束！',
                  emoji: '🎉',
                  from: 'system',
                  style: 'highlight',
                }),
              );
              // 给用户加分
              scoreBus.dispatch(
                makeScoreEvent({
                  target: 'user',
                  delta: 15,
                  reason: '完成讨论',
                  source: 'discussion-reward',
                  sceneId: scene.id,
                }),
              );
            } else {
              setStatus('waiting-user');
            }
            break;
          }
          case 'error': {
            setStatus('error');
            setMessages((prev) => [
              ...prev,
              {
                id: `err-${Date.now()}`,
                role: 'system',
                text: `讨论出错：${event.data.message || '未知错误'}`,
              },
            ]);
            break;
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setStatus('error');
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'system',
          text: `网络错误：${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
    }
  }

  function getTeammate(agentId?: string): AITeammate | undefined {
    return teammates.find((t) => t.id === agentId);
  }

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      data-testid="discussion-scene"
    >
      {/* 顶部：话题 + 头像行 */}
      <div className="shrink-0 border-b border-border bg-sky-50/50 px-6 py-3 dark:bg-sky-950/20">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-sky-800 dark:text-sky-200">
            {topic}
          </h2>
          <span className="text-xs text-muted-foreground">
            第 {round}/{expectedRounds} 轮
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{task}</p>

        {/* 头像行 */}
        <div className="mt-3 flex items-center gap-3">
          {/* 老师 */}
          <div className={cn(
            'flex flex-col items-center gap-0.5 transition-all duration-300',
            roundtableState === 'speaking' && currentSpeakerName === 'AI 老师' ? 'scale-110' : 'opacity-70',
          )}>
            <div className={cn(
              'h-10 w-10 rounded-full border-2 flex items-center justify-center bg-amber-100 text-xs font-bold dark:bg-amber-900/40',
              roundtableState === 'speaking' && currentSpeakerName === 'AI 老师'
                ? 'border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
                : 'border-border',
            )}>
              AI
            </div>
            <span className="text-[9px] text-muted-foreground">老师</span>
          </div>

          {/* 学员们 */}
          {teammates.slice(0, 3).map((t) => {
            const isSpeaking = speakingAgentId === t.id;
            return (
              <div key={t.id} className={cn(
                'flex flex-col items-center gap-0.5 transition-all duration-300',
                isSpeaking ? 'scale-110' : 'opacity-70',
              )}>
                <div className={cn(
                  'relative h-10 w-10 rounded-full border-2 overflow-hidden',
                  isSpeaking
                    ? 'border-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.4)]'
                    : 'border-border',
                )}>
                  <img src={t.avatar} alt={t.nickname} className="h-full w-full object-cover" />
                  {isSpeaking ? (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-1 ring-white" />
                  ) : null}
                </div>
                <span className="text-[9px] text-muted-foreground">{t.nickname}</span>
              </div>
            );
          })}

          {/* 用户 */}
          <div className={cn(
            'flex flex-col items-center gap-0.5 transition-all duration-300',
            roundtableState === 'cue-user' ? 'scale-110' : 'opacity-70',
          )}>
            <div className={cn(
              'h-10 w-10 rounded-full border-2 flex items-center justify-center bg-emerald-100 text-xs font-bold dark:bg-emerald-900/40',
              roundtableState === 'cue-user'
                ? 'border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)] animate-pulse'
                : 'border-border',
            )}>
              你
            </div>
            <span className="text-[9px] text-muted-foreground">我</span>
          </div>
        </div>
      </div>

      {/* 中间：ProactiveCard 或 群聊消息列表 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <AnimatePresence mode="wait">
          {status === 'idle' && showProactive ? (
            <ProactiveCard
              key="proactive"
              topic={topic}
              onJoin={() => { setShowProactive(false); startDiscussion(); }}
              onSkip={() => { setShowProactive(false); onContinue?.(); }}
            />
          ) : null}
        </AnimatePresence>

        {/* 群聊消息列表 */}
        {!(status === 'idle' && showProactive) ? (
          <div className="mx-auto max-w-2xl space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-2',
                  msg.role === 'user' ? 'flex-row-reverse' : 'flex-row',
                )}
              >
                {msg.role === 'system' ? (
                  <div className="w-full text-center text-xs text-muted-foreground/70 py-1">
                    {msg.text}
                  </div>
                ) : (
                  <>
                    <div className="shrink-0">
                      {msg.role === 'teacher' ? (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold dark:bg-amber-900/40">AI</div>
                      ) : msg.role === 'user' ? (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold dark:bg-emerald-900/40">你</div>
                      ) : (
                        <img src={getTeammate(msg.agentId)?.avatar || '/avatars/default.png'} alt="" className="h-8 w-8 rounded-full object-cover" />
                      )}
                    </div>
                    <div className={cn(
                      'max-w-[70%] rounded-xl px-3 py-2 text-sm',
                      msg.role === 'user' ? 'bg-primary text-primary-foreground' :
                      msg.role === 'teacher' ? 'bg-amber-50 dark:bg-amber-950/40' : 'bg-muted',
                    )}>
                      {msg.role !== 'user' && msg.agentName ? (
                        <div className="mb-0.5 text-[10px] font-medium text-muted-foreground">{msg.agentName}</div>
                      ) : null}
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {msg.text || (msg.streaming ? '…' : '')}
                        {msg.streaming ? (
                          <span className="ml-0.5 inline-block h-3.5 w-1 animate-pulse bg-primary/60 align-middle" />
                        ) : null}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        ) : null}
      </div>

      {/* 底部：输入区（文字/语音切换） */}
      <div className="shrink-0 border-t border-border bg-card px-6 py-3">
        {status === 'idle' && !showProactive ? (
          <button
            type="button"
            onClick={startDiscussion}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm"
          >
            开始讨论
          </button>
        ) : status === 'waiting-user' ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { handleUserSend(); setSendCooldown(true); }
              }}
              placeholder="输入你的想法…"
              autoFocus
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <VoiceInputButton
              onTranscript={(text) => { setUserInput(text); }}
              disabled={sendCooldown}
            />
            <button
              type="button"
              onClick={() => { handleUserSend(); setSendCooldown(true); }}
              disabled={!userInput.trim() || sendCooldown}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              {sendCooldown ? '…' : '发送'}
            </button>
          </div>
        ) : status === 'running' ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            讨论进行中…
          </div>
        ) : status === 'done' ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              讨论已结束（{round} 轮）
            </span>
            <button
              type="button"
              onClick={onContinue}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm"
            >
              下一页 →
            </button>
          </div>
        ) : status === 'error' ? (
          <div className="text-sm text-destructive">
            讨论出错。
            <button type="button" onClick={startDiscussion} className="ml-2 underline">重试</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

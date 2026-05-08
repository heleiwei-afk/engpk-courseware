'use client';

/**
 * RoundtableStage - MAIC-style roundtable discussion layout
 *
 * Three-column layout:
 *   Left: Teacher avatar (with glow when speaking)
 *   Center: Current speech bubble + thinking/cue animations
 *   Right: Student avatars + user avatar with mic button
 */

import { cn } from '@/lib/utils';
import { AnimatePresence } from 'motion/react';
import { SpeechBubble } from './SpeechBubble';
import { CueUserRipple } from './CueUserRipple';
import { ThinkingDots } from '@/components/scene-shell/ThinkingDots';
import type { AITeammate } from '@/lib/engpk/types/teammate';

export type RoundtableState = 'idle' | 'speaking' | 'thinking' | 'cue-user' | 'ended';

interface RoundtableStageProps {
  state: RoundtableState;
  teammates: AITeammate[];
  speakingAgentId?: string;
  speakingAgentName?: string;
  currentText: string;
  isStreaming: boolean;
  userAvatar?: string;
  userNickname?: string;
}

export function RoundtableStage({
  state,
  teammates,
  speakingAgentId,
  speakingAgentName,
  currentText,
  isStreaming,
  userAvatar,
  userNickname,
}: RoundtableStageProps) {
  // Determine bubble variant
  const bubbleVariant: 'teacher' | 'agent' | 'user' =
    speakingAgentName === 'AI 老师' ? 'teacher' : 'agent';

  return (
    <div className="flex items-center gap-4 rounded-3xl border border-border bg-card/50 backdrop-blur-sm px-6 py-5 shadow-sm">
      {/* Left: Teacher avatar */}
      <div className="flex flex-col items-center gap-1">
        <div
          className={cn(
            'relative h-14 w-14 rounded-full border-2 transition-all duration-300',
            state === 'speaking' && speakingAgentName === 'AI 老师'
              ? 'border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.4)] scale-110'
              : 'border-border opacity-70 scale-95',
          )}
        >
          <div className="flex h-full w-full items-center justify-center rounded-full bg-amber-100 text-lg dark:bg-amber-900/40">
            AI
          </div>
          {state === 'speaking' && speakingAgentName === 'AI 老师' ? (
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-card">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
            </span>
          ) : null}
        </div>
        <span className="text-[10px] text-muted-foreground">老师</span>
      </div>

      {/* Center: Speech bubble / Thinking / Cue */}
      <div className="flex min-h-[100px] flex-1 items-center justify-center">
        <AnimatePresence mode="wait">
          {state === 'speaking' && currentText ? (
            <SpeechBubble
              key="bubble"
              text={currentText}
              speakerName={speakingAgentName || 'AI'}
              isStreaming={isStreaming}
              variant={bubbleVariant}
            />
          ) : state === 'thinking' ? (
            <div key="thinking" className="flex flex-col items-center gap-2">
              <ThinkingDots />
              <span className="text-[10px] text-muted-foreground">思考中…</span>
            </div>
          ) : state === 'cue-user' ? (
            <div key="cue" className="text-center">
              <div className="mb-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                轮到你了！
              </div>
              <div className="text-xs text-muted-foreground">
                在下方输入你的想法
              </div>
            </div>
          ) : state === 'ended' ? (
            <div key="ended" className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              讨论结束
            </div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Right: Student avatars + User */}
      <div className="flex flex-col items-center gap-2">
        {/* Student avatars (vertical stack) */}
        <div className="flex flex-col gap-1.5">
          {teammates.slice(0, 3).map((t) => {
            const isSpeaking = speakingAgentId === t.id;
            return (
              <div
                key={t.id}
                className={cn(
                  'relative h-10 w-10 rounded-full border-2 transition-all duration-300',
                  isSpeaking
                    ? 'border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.4)] scale-110 opacity-100'
                    : 'border-border opacity-50 scale-90 grayscale-[0.2]',
                )}
              >
                <img
                  src={t.avatar}
                  alt={t.nickname}
                  className="h-full w-full rounded-full object-cover"
                />
                {isSpeaking ? (
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card">
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className="h-px w-8 bg-border" />

        {/* User avatar */}
        <div className="relative">
          <div
            className={cn(
              'h-12 w-12 rounded-full border-2 transition-all duration-300',
              state === 'cue-user'
                ? 'border-amber-400 scale-110'
                : 'border-border opacity-80',
            )}
          >
            <img
              src={userAvatar || '/avatars/default.png'}
              alt={userNickname || 'You'}
              className="h-full w-full rounded-full object-cover"
            />
          </div>
          <CueUserRipple active={state === 'cue-user'} />
        </div>
        <span className="text-[10px] text-muted-foreground">{userNickname || '你'}</span>
      </div>
    </div>
  );
}

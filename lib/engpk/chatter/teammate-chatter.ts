'use client';

/**
 * engpk - Teammate Chatter Engine
 *
 * Makes AI teammates post contextual chat messages during playback:
 *   - Proactive: After each speech action, 30% chance to trigger
 *   - Responsive: When user sends a message, 1-2 teammates respond
 *
 * Uses /api/engpk/chatter for real-time LLM generation.
 */

import { useCallback, useEffect, useRef } from 'react';
import { bulletBus, makeBulletEvent, type BulletEvent } from '@/lib/engpk/bullet/bus';
import { useClassroomSession } from '@/lib/engpk/store/classroom-session';
import type { AITeammate } from '@/lib/engpk/types/teammate';

interface UseTeammateChatterOptions {
  /** Current page content (for context) */
  currentContext: string;
  /** Whether chatter is enabled */
  enabled?: boolean;
}

export function useTeammateChatter(options: UseTeammateChatterOptions) {
  const { currentContext, enabled = true } = options;
  const teammates = useClassroomSession((s) => s.teammates);
  const contextRef = useRef(currentContext);
  contextRef.current = currentContext;

  // ─── Proactive chatter: call after speech actions ───────────
  const triggerProactiveChatter = useCallback(async () => {
    if (!enabled || teammates.length === 0) return;
    // 30% chance
    if (Math.random() > 0.3) return;

    const agent = teammates[Math.floor(Math.random() * teammates.length)];
    const text = await fetchChatter(contextRef.current, agent);
    if (text) {
      bulletBus.dispatch(
        makeBulletEvent({
          text,
          from: 'ai-teammate',
          agentId: agent.id,
          style: 'normal',
        }),
      );
    }
  }, [enabled, teammates]);

  // ─── Responsive chatter: respond to user messages ──────────
  useEffect(() => {
    if (!enabled || teammates.length === 0) return;

    const unsub = bulletBus.subscribe(async (event: BulletEvent) => {
      if (event.from !== 'user') return;
      // 1-2 teammates respond after 1-3s delay
      const respondCount = 1 + Math.floor(Math.random() * 2);
      const shuffled = [...teammates].sort(() => Math.random() - 0.5);
      const responders = shuffled.slice(0, respondCount);

      for (const agent of responders) {
        const delay = 1000 + Math.floor(Math.random() * 2000);
        setTimeout(async () => {
          const text = await fetchChatter(
            contextRef.current,
            agent,
            event.text,
          );
          if (text) {
            bulletBus.dispatch(
              makeBulletEvent({
                text,
                from: 'ai-teammate',
                agentId: agent.id,
                style: 'normal',
              }),
            );
          }
        }, delay);
      }
    });

    return unsub;
  }, [enabled, teammates]);

  return { triggerProactiveChatter };
}

async function fetchChatter(
  context: string,
  agent: AITeammate,
  userMessage?: string,
): Promise<string> {
  try {
    const res = await fetch('/api/engpk/chatter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: context.slice(0, 200),
        archetype: agent.archetype,
        agentName: agent.nickname,
        userMessage,
      }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    return data.text || '';
  } catch {
    return '';
  }
}

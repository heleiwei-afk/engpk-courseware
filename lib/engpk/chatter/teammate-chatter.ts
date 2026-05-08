'use client';

/**
 * engpk - Teammate Chatter Engine
 *
 * Makes AI teammates post contextual chat messages during playback:
 *   - Proactive: Timer-based, every 1-5 seconds randomly triggers one teammate
 *   - Responsive: When user sends a message, 1-2 teammates respond after 1-3s
 *
 * Uses /api/engpk/chatter for real-time LLM generation.
 */

import { useEffect, useRef } from 'react';
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
  const teammatesRef = useRef(teammates);
  teammatesRef.current = teammates;

  // ─── Proactive chatter: timer-based, every 1-5 seconds ─────
  useEffect(() => {
    if (!enabled || teammates.length === 0) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function scheduleNext() {
      const delay = 1000 + Math.floor(Math.random() * 4000); // 1-5s
      timeoutId = setTimeout(async () => {
        const agents = teammatesRef.current;
        if (agents.length === 0) { scheduleNext(); return; }

        const agent = agents[Math.floor(Math.random() * agents.length)];
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
        scheduleNext();
      }, delay);
    }

    scheduleNext();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [enabled, teammates.length]);

  // ─── Responsive chatter: respond to user messages ──────────
  useEffect(() => {
    if (!enabled || teammates.length === 0) return;

    const unsub = bulletBus.subscribe(async (event: BulletEvent) => {
      if (event.from !== 'user') return;
      // 1-2 teammates respond after 1-3s delay
      const respondCount = 1 + Math.floor(Math.random() * 2);
      const shuffled = [...teammatesRef.current].sort(() => Math.random() - 0.5);
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
  }, [enabled, teammates.length]);
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

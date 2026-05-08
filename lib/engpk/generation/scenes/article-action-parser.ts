/**
 * engpk - Article action parser
 *
 * Parses the Stage 2 LLM output (JSON array of spotlight+speech)
 * into a typed action array for the PlaybackEngine.
 */

import { parseJsonResponse } from '@/lib/generation/json-repair';

function uuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'act-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

interface RawActionItem {
  type: 'spotlight' | 'speech';
  blockIndex?: number;
  text?: string;
}

export interface ParsedAction {
  id: string;
  type: 'spotlight' | 'speech';
  blockIndex?: number;
  text?: string;
}

/**
 * Parse the Stage 2 LLM response into action array.
 * Handles both clean JSON and markdown-wrapped JSON.
 */
export function parseArticleActions(rawText: string): ParsedAction[] {
  let items: RawActionItem[];

  try {
    // Try direct parse first
    const parsed = parseJsonResponse<unknown>(rawText);
    if (Array.isArray(parsed)) {
      items = parsed as RawActionItem[];
    } else if (parsed && typeof parsed === 'object' && 'actions' in (parsed as Record<string, unknown>)) {
      items = (parsed as { actions: RawActionItem[] }).actions;
    } else {
      return fallbackActions();
    }
  } catch {
    return fallbackActions();
  }

  if (!Array.isArray(items) || items.length === 0) {
    return fallbackActions();
  }

  const actions: ParsedAction[] = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;

    if (item.type === 'spotlight' && typeof item.blockIndex === 'number') {
      actions.push({
        id: uuid(),
        type: 'spotlight',
        blockIndex: item.blockIndex,
      });
    } else if (item.type === 'speech' && typeof item.text === 'string' && item.text.trim()) {
      actions.push({
        id: uuid(),
        type: 'speech',
        text: item.text.trim(),
      });
    }
  }

  // Ensure we have at least some speeches
  if (actions.filter((a) => a.type === 'speech').length === 0) {
    return fallbackActions();
  }

  return actions;
}

function fallbackActions(): ParsedAction[] {
  return [
    { id: uuid(), type: 'spotlight', blockIndex: 0 },
    { id: uuid(), type: 'speech', text: '我们一起来看看这一页的内容吧。' },
    { id: uuid(), type: 'spotlight', blockIndex: -1 },
  ];
}
